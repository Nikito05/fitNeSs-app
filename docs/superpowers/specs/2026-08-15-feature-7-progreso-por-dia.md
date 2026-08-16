# Feature 7 — El progreso de un ejercicio no debe mezclarse entre distintas apariciones en la rutina

## Motivación

Feedback real de un usuario probando la app: el mismo ejercicio (ej. press inclinado con mancuernas) aparece dos veces por semana en días distintos de la rutina, con estados de fatiga muy distintos (un día 30kg×10, otro día —más avanzada la semana, todavía dolorido— 40kg×4). Son sesiones de entrenamiento distintas por diseño, no una progresión del mismo contexto. Hoy el historial y la sugerencia de progresión (Feature 5) tratan "el mismo ejercicio" como una sola línea de datos sin importar en qué día de la rutina aparece — la sugerencia de un día se contamina con los números del otro.

## Causa raíz confirmada

- `workout_sessions.routine_day_id` ya existe desde el esquema inicial y ya identifica correctamente en qué día de rutina se originó cada sesión.
- `logged_sets` referencia `exercise_id` directamente, sin ningún vínculo al día de rutina.
- `listSessionsForExercise(exerciseId)` (la función que alimenta tanto el historial general como la sugerencia de Feature 5, y desde Feature 6 también el comentario) filtra **solo por `exercise_id`**, mezclando sesiones de cualquier día de rutina donde aparezca ese ejercicio.

**El fix es de consulta/consumo de datos, no de esquema — no hace falta ninguna migración.** El dato que falta usar (`routine_day_id`) ya existe en cada fila de `workout_sessions` desde el día 1.

## Alcance

Trackear el historial y la sugerencia de progresión por la combinación **día de rutina + ejercicio**, no solo por ejercicio. Esto incluye, como consecuencia de compartir la misma lista de historial filtrada, que **el comentario de Feature 6 también queda acotado al día de rutina** (una nota escrita en el Día A no aparece precargada en el Día B, aunque sea el mismo ejercicio) — decisión confirmada con el usuario para mantener una sola ruta de datos en vez de dos rutas paralelas (una filtrada, otra global).

La vista de historial general (`/rutina/historial/[exerciseId]`) también se reorganiza: en vez de un gráfico y una lista únicos mezclando todos los días, se muestra **un bloque por día de rutina** (nombre del día, su propio gráfico de volumen, su propia lista de sesiones). Sesiones cuyo día de rutina fue borrado (`workout_sessions.routine_day_id` queda `null` por el `on delete set null` ya existente en el esquema) se agrupan aparte, bajo el label "Otros registros".

## Capa de acceso a datos (`src/lib/rutina/sessions-api.ts`)

`listSessionsForExercise` se extiende para traer también el día de rutina de cada sesión, vía un join adicional a `routine_days(name)` a través de `workout_sessions.routine_day_id`. Tipo de retorno actualizado:

```ts
export async function listSessionsForExercise(exerciseId: string): Promise<
  {
    sessionId: string
    sessionDate: string
    routineDayId: string | null
    routineDayName: string | null
    note: string | null
    sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[]
  }[]
>
```

Ambas consultas internas (la de `logged_sets` y la de `exercise_notes`, ya presentes desde Feature 6) agregan `routine_day_id, routine_days(name)` al `select` sobre `workout_sessions`. Cuando cualquiera de las dos ramas del merge crea una entrada nueva en el mapa de sesiones (porque todavía no existía), extrae `routineDayId`/`routineDayName` de la fila igual que ya extrae `sessionDate` — mismo patrón, ningún cambio de forma. `routineDayName` es `null` cuando `routine_day_id` es `null` (día borrado) o cuando el join no encuentra el día por cualquier otra razón.

El resultado sigue ordenado descendente por `sessionDate` (sin cambios en esa parte).

## Lógica pura nueva, con TDD (`src/lib/rutina/entrenar-flow.ts`)

**`filterSessionsForRoutineDay`** — filtra el historial de un ejercicio a las sesiones de un día de rutina específico:

```ts
export function filterSessionsForRoutineDay<T extends { routineDayId: string | null }>(
  sessions: T[],
  routineDayId: string
): T[] {
  return sessions.filter((session) => session.routineDayId === routineDayId)
}
```

Esta es la función que lleva el test explícito del bug reportado: mismo `exerciseId`, historial con sesiones del Día A (30kg×10) y del Día B (40kg×4) mezcladas, filtrando por cada día por separado y verificando que las listas resultantes no se cruzan. Además, un test de integración (en `progression-suggestion.test.ts` o `entrenar-flow.test.ts`) encadena `filterSessionsForRoutineDay` con `suggestProgressionForExercise` (ya existente, sin tocar) para probar el escenario completo reportado por el usuario: mismo ejercicio, dos días, pesos/reps muy distintos, sugerencias independientes por día.

**`groupSessionsByRoutineDay`** — agrupa el historial completo de un ejercicio en bloques por día de rutina, para la pantalla de historial general:

```ts
export type RoutineDayGroup<T> = {
  routineDayId: string | null
  routineDayName: string
  sessions: T[]
}

export function groupSessionsByRoutineDay<
  T extends { routineDayId: string | null; routineDayName: string | null }
>(sessions: T[]): RoutineDayGroup<T>[] {
  const groups = new Map<string, RoutineDayGroup<T>>()

  for (const session of sessions) {
    const key = session.routineDayId ?? 'sin-dia'
    const existing = groups.get(key)
    if (existing) {
      existing.sessions.push(session)
    } else {
      groups.set(key, {
        routineDayId: session.routineDayId,
        routineDayName: session.routineDayName ?? 'Otros registros',
        sessions: [session],
      })
    }
  }

  return Array.from(groups.values())
}
```

**Precondición documentada**: `groupSessionsByRoutineDay` asume que `sessions` ya viene ordenado descendente por fecha (la garantía que ya da `listSessionsForExercise`). Bajo esa precondición, el orden de los grupos en el resultado queda automáticamente ordenado por la sesión más reciente de cada grupo (el primer encuentro de cada `routineDayId` en un array ya ordenado desc determina el orden de inserción en el `Map`, que JavaScript preserva) — no hace falta un sort adicional. Los tests de esta función deben cubrir explícitamente que el orden de los grupos es correcto a partir de una lista ya ordenada, no solo que el agrupado en sí es correcto.

## Pantalla de entrenar (`src/app/(app)/rutina/entrenar/[dayId]/page.tsx`)

Dentro del `forEach` sobre `uniqueExerciseIds` en `init()`, se agrega un filtrado por día antes de calcular `pastSessions`:

```ts
const allSessions = histories[i]
const sessionsForThisDay = filterSessionsForRoutineDay(allSessions, dayId)
const pastSessions = sessionsForThisDay.filter((s) => s.sessionId !== session.id)
```

`currentSessionEntry` (usado para la precarga de la nota de Feature 6) también se busca dentro de `sessionsForThisDay` en vez de `allSessions`. Como la sesión actual siempre pertenece al día que se está entrenando (se crea con `getOrCreateWorkoutSession(dayId)`), este cambio no altera si se la encuentra o no — solo mantiene consistente que todo el cálculo de esa sección parte de la misma lista ya acotada al día.

No se toca `progression-suggestion.ts`: `suggestProgressionForExercise` sigue recibiendo `pastSessions` como parámetro, agnóstico de que ahora viene pre-filtrado por día — la responsabilidad de qué cuenta como "historial relevante" queda, como ya era, del lado de quien arma los datos antes de llamarla.

## Pantalla de historial (`src/app/(app)/rutina/historial/[exerciseId]/page.tsx`)

Se reemplaza el bloque único (un `ExerciseProgressionChart` + una lista de sesiones) por un bloque por grupo de `groupSessionsByRoutineDay(sessions)`. Por cada grupo:

- Encabezado con `group.routineDayName`.
- Su propio `ExerciseProgressionChart`, alimentado por `buildProgressionSeries` (sin cambios, función ya existente) sobre `group.sessions.map(...)`.
- Su propia lista de sesiones (mismo render por sesión que ya existe hoy, sin cambios en cómo se muestra cada serie).

`buildProgressionSeries` y `ExerciseProgressionChart` no se modifican — se siguen usando tal cual, solo que ahora se invocan una vez por grupo en vez de una vez para toda la pantalla.

## Testing

- **TDD real** (test primero, rojo, verde) para `filterSessionsForRoutineDay` y `groupSessionsByRoutineDay`, incluyendo:
  - `filterSessionsForRoutineDay`: caso vacío, caso sin coincidencias, caso con sesiones de múltiples días mezcladas.
  - El test de integración explícito del bug reportado (mismo ejercicio, Día A vs Día B, sugerencias independientes vía `suggestProgressionForExercise`).
  - `groupSessionsByRoutineDay`: agrupado correcto, orden de grupos correcto a partir de una lista ya ordenada desc, y el caso de sesiones con `routineDayId: null` agrupadas bajo "Otros registros".
- Los cambios en `sessions-api.ts` (join adicional) y en las dos pantallas son principalmente de integración/UI — se verifican con build + smoke manual, sin TDD dogmático (política del proyecto), salvo que durante la implementación surja lógica no trivial extraíble como función pura.

## Fuera de alcance (documentado, no implementado ahora)

- No se distingue entre rutinas distintas que tengan un día con el mismo nombre (ej. dos rutinas distintas, cada una con un día "Empuje") — el agrupado es por `routine_day_id` (identificador único), así que no se mezclan entre sí, pero el label mostrado no aclara a qué rutina pertenece cada día. Si en el futuro esto genera confusión real, se resuelve mostrando también el nombre de la rutina.
- **Consecuencia aceptada**: cambiar de carpeta de rutina (ej. alternar entre "Full-body" y "Tren superior/inferior", el flujo de uso real descripto en el CLAUDE.md del proyecto) hace que el mismo ejercicio, al aparecer en un día de rutina distinto, arranque su historial/sugerencia/nota desde cero — no se reutiliza lo acumulado en la otra carpeta, aunque sea el mismo ejercicio. Es consistente con el diseño elegido (separar por contexto real de entrenamiento), pero es una consecuencia real, no solo una ambigüedad de label. Si en la práctica esto molesta al usuario, se evalúa como feature aparte (ej. usar el historial global como fallback cuando el día actual no tiene datos propios) — no resuelto ahora.
- No hay migración de datos: el campo que faltaba usar (`routine_day_id`) ya existe y ya está poblado correctamente en todo el historial existente.

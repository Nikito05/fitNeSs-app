# Ajuste a la guía de progresión — incremento por equipamiento y frecuencia por objetivo

**Fecha**: 2026-07-19
**Estado**: Aprobado

## Contexto

Feature 5 (sugerencia de progresión de peso) ya está en producción, con un bug reciente corregido (la sugerencia se anclaba a la serie de mayor número en vez de a la serie propia — ver commit `fix: anchor progression suggestion per set number, not per exercise`). Este spec cubre un rediseño posterior, no un bug: el tamaño del incremento sugerido dejaba de tener sentido físico, porque los discos de gimnasio se cargan de a pares y el mínimo cargable depende del tipo de equipamiento, no del objetivo de entrenamiento del usuario.

**Decisión de diseño**: el tipo de equipamiento del ejercicio pasa a definir el **tamaño** del incremento (reemplaza la tabla anterior de incremento por objetivo). El objetivo de entrenamiento (Fuerza/Hipertrofia/Resistencia/General) pasa a definir la **frecuencia/exigencia** — cuántas sesiones seguidas con buen desempeño hacen falta antes de sugerir subir — en vez del tamaño. Motivo: dos reglas de magnitud (objetivo y equipamiento) compitiendo entre sí para el mismo número no tenía sentido; separar "cuánto" (equipamiento) de "cuán seguido" (objetivo) sí.

## Diseño

### Modelo de datos: `exercises.equipment` pasa de texto libre a enum fijo

Hoy `equipment` es `text not null` sin restricción, cargado por un `Input` de texto libre en `exercise-picker.tsx`. El catálogo predefinido usa 5 valores consistentes (`Barra`, `Mancuernas`, `Máquina`, `Peso corporal`, `Polea`); los 4 ejercicios custom existentes usan variantes sin tilde (`Maquina`, `Barra`).

Se convierte a un enum de 5 códigos en minúscula sin tilde, mismo criterio ya usado en `rpe`/`training_goal`: `barra`, `mancuernas`, `maquina`, `peso_corporal`, `polea`.

**Migración**:
```sql
update public.exercises set equipment = 'barra' where equipment in ('Barra', 'barra');
update public.exercises set equipment = 'mancuernas' where equipment in ('Mancuernas', 'mancuernas');
update public.exercises set equipment = 'maquina' where equipment in ('Máquina', 'máquina', 'Maquina', 'maquina');
update public.exercises set equipment = 'peso_corporal' where equipment in ('Peso corporal', 'peso corporal');
update public.exercises set equipment = 'polea' where equipment in ('Polea', 'polea');
update public.exercises set equipment = 'maquina'
  where equipment not in ('barra', 'mancuernas', 'maquina', 'peso_corporal', 'polea');

alter table public.exercises
  add constraint exercises_equipment_check
  check (equipment in ('barra', 'mancuernas', 'maquina', 'peso_corporal', 'polea'));
```
El último `update` (fallback a `'maquina'`) cubre cualquier valor no reconocido antes de agregar el `check`, para que la migración nunca falle por datos preexistentes inesperados. No requiere GRANT nuevo (columna existente, tabla ya expuesta).

### Selector de equipamiento en la creación de ejercicios

`src/components/rutina/exercise-picker.tsx`: el campo `newEquipment` (hoy `Input` de texto libre) pasa a 5 botones (`Barra`/`Mancuernas`/`Máquina`/`Peso corporal`/`Polea`), mismo patrón visual que los selectores de tamaño de letra y objetivo de entrenamiento — `Button` con `variant={selected ? 'default' : 'outline'}`, guardando el código en minúscula. El listado de ejercicios (`{exercise.muscleGroup} · {exercise.equipment}`) pasa a mostrar la etiqueta en español correspondiente al código, no el código crudo.

### Algoritmo de sugerencia (reescritura completa de `progression-suggestion.ts`)

Se elimina `GOAL_PROFILES`. Nuevos tipos y tablas:

```ts
export type Equipment = 'barra' | 'mancuernas' | 'maquina' | 'peso_corporal' | 'polea'

const EQUIPMENT_INCREMENTS: Record<Equipment, number | null> = {
  barra: 5,
  mancuernas: 2,
  maquina: 2.5,
  polea: 2.5,
  peso_corporal: null,
}

const GOAL_SESSIONS_REQUIRED: Record<TrainingGoal, number> = {
  fuerza: 1,
  hipertrofia: 2,
  resistencia: 3,
  general: 2,
}
```

`suggestProgression` cambia de firma — ya no recibe una única "última serie", sino el equipamiento, el objetivo de reps actual, y el **historial completo** de esa misma serie a través de las sesiones pasadas (ordenado de más reciente a más antiguo):

```ts
export type HistoricalSetEntry = {
  actualReps: number
  actualWeight: number | null
  rpe: Rpe
}

export function suggestProgression(
  goal: TrainingGoal,
  equipment: Equipment,
  targetReps: number,
  history: HistoricalSetEntry[]
): ProgressionSuggestion {
  if (history.length === 0 || history[0].actualWeight === null) return { action: 'sin_datos' }

  const increment = EQUIPMENT_INCREMENTS[equipment]
  if (increment === null) return { action: 'sin_datos' }

  const last = history[0]
  const lastMetTarget = last.actualReps >= targetReps

  if (!lastMetTarget && last.rpe === 'al_limite') {
    return { action: 'bajar', suggestedWeight: Math.max(0, last.actualWeight - increment) }
  }

  const required = GOAL_SESSIONS_REQUIRED[goal]
  let qualifying = 0
  for (const set of history) {
    const met = set.actualReps >= targetReps
    const goodRpe = set.rpe === 'facil' || set.rpe === 'justo'
    if (met && goodRpe) {
      qualifying += 1
      if (qualifying >= required) {
        return { action: 'subir', suggestedWeight: last.actualWeight + increment }
      }
    }
    // sesión que no califica: se saltea, no resetea el conteo acumulado
  }

  return { action: 'mantener', suggestedWeight: last.actualWeight }
}
```

Reglas encapsuladas en esta función:
- **Bajar**: siempre por una sola sesión (la más reciente) — no requiere racha, prioriza seguridad.
- **Subir**: requiere `GOAL_SESSIONS_REQUIRED[goal]` sesiones "buenas" (cumplió objetivo de reps + RPE Fácil o Justo) entre el historial disponible para esa serie. Una sesión que no califica se saltea sin resetear el conteo acumulado — no hay límite de cuántas sesiones atrás se mira.
- **Polea** usa el mismo incremento que **Máquina** (+2.5kg). **Peso corporal** nunca genera sugerencia numérica (`sin_datos`), independientemente del peso registrado.
- El peso base para "subir"/"bajar" es siempre el de la sesión más reciente (`history[0]`), nunca el de la sesión que completó la racha.

`suggestProgressionForExercise` (la función de integración por ejercicio) cambia para pasar el historial completo por número de serie en vez de una sola sesión:

```ts
export function suggestProgressionForExercise(
  goal: TrainingGoal,
  equipment: Equipment,
  plannedSets: { setNumber: number; targetReps: number }[],
  pastSessions: { sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[] }[]
): Record<number, ProgressionSuggestion> {
  const suggestions: Record<number, ProgressionSuggestion> = {}

  for (const plannedSet of plannedSets) {
    const history = pastSessions
      .map((session) => session.sets.find((set) => set.setNumber === plannedSet.setNumber))
      .filter((set): set is NonNullable<typeof set> => set !== undefined)

    if (history.length > 0) {
      suggestions[plannedSet.setNumber] = suggestProgression(goal, equipment, plannedSet.targetReps, history)
    }
  }

  return suggestions
}
```

`pastSessions` ya viene ordenado de más reciente a más antiguo (mismo orden que ya devuelve `listSessionsForExercise`), así que `history` conserva ese orden.

### Integración en `entrenar/[dayId]/page.tsx`

- `getRoutineDayDetail` (routines-api.ts) suma `equipment` al `select` del embed `exercises(...)` y a `RoutineDayExerciseDetail.equipment: Equipment` (types.ts).
- El `init()` de la pantalla ya tiene `histories[i]` (todas las sesiones pasadas de cada ejercicio, filtradas para excluir la sesión actual) — hoy solo usa `pastSessions[0]`. Pasa a usar `pastSessions` completo como `pastSessions` de `suggestProgressionForExercise`, junto con `exerciseDetail.equipment`.

## Fuera de alcance

- Pantalla de edición de ejercicios existentes — los 4 ejercicios custom actuales se migran automáticamente sin intervención manual; si algún mapeo automático quedó mal, se corrige a mano en la base por ahora.
- Límite de ventana temporal para el escaneo de la racha de sesiones "buenas".
- Mostrar la sugerencia en el editor de rutina (`mis-rutinas`) — sigue fuera de alcance, como en el spec original.

## Criterio de éxito

Build y tests corren sin errores. Crear un ejercicio nuevo pide elegir uno de los 5 tipos de equipamiento (sin texto libre). La sugerencia de progresión en `entrenar` usa el incremento correspondiente al equipamiento del ejercicio, y solo sugiere subir tras la cantidad de sesiones buenas seguidas (con saltos permitidos) que corresponde al objetivo de entrenamiento del usuario. Los ejercicios de peso corporal nunca muestran sugerencia numérica.

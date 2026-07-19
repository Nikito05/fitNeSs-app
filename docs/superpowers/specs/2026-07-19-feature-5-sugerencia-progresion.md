# Feature 5 — Sugerencia de progresión de peso

**Fecha**: 2026-07-19
**Estado**: Aprobado

## Contexto

Quinta y última de las 5 features de pulido post-Módulo 1, y la más grande en lógica real. El pedido: que la app le diga al usuario si debería subir, mantener o bajar el peso del próximo entrenamiento para cada ejercicio, en base a cómo le fue la sesión anterior (reps logradas vs. objetivo, y qué tan exigente fue esa serie) y a su objetivo de entrenamiento declarado.

El objetivo de entrenamiento (Fuerza/Hipertrofia/Resistencia/General) no existe todavía como campo — se agrega ahora al perfil, pensado para que el futuro Módulo de Macros lo reutilice en vez de volver a preguntarlo.

## Diseño

### Modelo de datos

**`profiles.training_goal`** (nueva columna):
```sql
alter table public.profiles
  add column training_goal text not null default 'general'
  check (training_goal in ('fuerza', 'hipertrofia', 'resistencia', 'general'));
```
Todo perfil existente y nuevo arranca en `'general'`. Es un `ALTER TABLE` sobre una tabla ya expuesta con GRANT — no requiere GRANT nuevo.

**`logged_sets.rpe`** (nueva columna):
```sql
alter table public.logged_sets
  add column rpe text not null default 'justo'
  check (rpe in ('facil', 'justo', 'al_limite'));
```
Se agrega con `default 'justo'` para que las filas ya existentes (registradas antes de esta feature, sin RPE real) queden con un valor de relleno neutral — no hay forma de reconstruir el esfuerzo percibido real de esas series retroactivamente. El default se retira de las escrituras nuevas de la aplicación (el selector de RPE en la UI siempre manda un valor explícito), pero queda como default de columna por robustez.

### Captura de RPE (`entrenar/[dayId]`)

Se agrega un tercer selector de 3 botones (Fácil / Justo / Al límite) debajo del stepper de peso existente, mismo patrón visual (`Button` con `variant={selected ? 'default' : 'outline'}`) que ya se usa para el tamaño de letra en Perfil.

- Al entrar a una serie sin guardar: arranca en `'justo'`.
- Al entrar a una serie ya guardada (revisitada): carga el `rpe` guardado en esa serie.
- Se envía como parte de `saveLoggedSet` al confirmar — el selector es obligatorio (siempre hay un valor, no hay estado "sin elegir").

`SetLogState` gana un campo `rpe: Rpe`. `saveLoggedSet` (en `sessions-api.ts`) gana el parámetro `rpe` en su input y en el insert/update de `logged_sets`. `getLoggedSetsForSession` y `listSessionsForExercise` devuelven `rpe` en cada set. `LoggedSet` (en `types.ts`) gana el campo `rpe: Rpe`.

### Selector de objetivo (Perfil)

Fila de 4 botones (Fuerza / Hipertrofia / Resistencia / General) en `/perfil`, mismo patrón que el selector de tamaño de letra ya existente en esa pantalla. A diferencia de tamaño de letra (que vive en `localStorage`), el objetivo se guarda directo en `profiles.training_goal` vía Supabase — es un dato que alimenta un cálculo real y que el futuro Módulo de Macros va a reusar, no una preferencia de dispositivo.

### Algoritmo de sugerencia (función pura, TDD)

Nuevo archivo `src/lib/rutina/progression-suggestion.ts`. Por ejercicio, se toma la **última serie (mayor `set_number`) de la sesión anterior más reciente** de ese ejercicio, y se la compara contra el objetivo de reps *actual* del plan para ese mismo número de serie.

```ts
export type TrainingGoal = 'fuerza' | 'hipertrofia' | 'resistencia' | 'general'
export type Rpe = 'facil' | 'justo' | 'al_limite'

type GoalProfile = {
  increaseOnRpe: Rpe[]
  weightIncrement: number
}

const GOAL_PROFILES: Record<TrainingGoal, GoalProfile> = {
  fuerza:      { increaseOnRpe: ['facil', 'justo', 'al_limite'], weightIncrement: 5 },
  hipertrofia: { increaseOnRpe: ['facil', 'justo'],              weightIncrement: 2.5 },
  resistencia: { increaseOnRpe: ['facil'],                       weightIncrement: 1.25 },
  general:     { increaseOnRpe: ['facil', 'justo'],              weightIncrement: 2.5 },
}

export type ProgressionSuggestion =
  | { action: 'subir'; suggestedWeight: number }
  | { action: 'mantener'; suggestedWeight: number }
  | { action: 'bajar'; suggestedWeight: number }
  | { action: 'sin_datos' }

export function suggestProgression(
  goal: TrainingGoal,
  lastSet: { actualReps: number; actualWeight: number | null; rpe: Rpe; targetReps: number } | null
): ProgressionSuggestion {
  if (!lastSet || lastSet.actualWeight === null) return { action: 'sin_datos' }

  const profile = GOAL_PROFILES[goal]
  const metTarget = lastSet.actualReps >= lastSet.targetReps

  if (metTarget && profile.increaseOnRpe.includes(lastSet.rpe)) {
    return { action: 'subir', suggestedWeight: lastSet.actualWeight + profile.weightIncrement }
  }

  if (!metTarget && lastSet.rpe === 'al_limite') {
    return { action: 'bajar', suggestedWeight: Math.max(0, lastSet.actualWeight - profile.weightIncrement) }
  }

  return { action: 'mantener', suggestedWeight: lastSet.actualWeight }
}
```

`action: 'sin_datos'` cubre tanto "sin sesión previa" como "última serie sin peso registrado" (ejercicios de peso corporal) — en ambos casos no se muestra sugerencia.

### Integración en `entrenar/[dayId]`

Al construir `lastByKey` (ya existe, itera `histories` por ejercicio), se agrega el cálculo de `suggestByExercise: Record<string, ProgressionSuggestion>`: para cada `exerciseId`, se toma el set con mayor `setNumber` de `pastSessions[0]` (la sesión anterior más reciente, mismo dato que ya se usa para `lastValue`), se busca el `targetReps` actual de ese mismo `setNumber` dentro de `detail.exercises` (fallback: el último `plannedSet` del ejercicio si el número de series cambió desde entonces), y se llama a `suggestProgression(trainingGoal, {...})`.

`trainingGoal` se obtiene con una lectura a `profiles.training_goal` del usuario en el mismo `init()` que ya carga `detail`/`session`/`existingLogs`.

### Visualización

Texto simple con flecha, debajo del "último: Xkg × Y" ya existente, mostrado en cada serie del ejercicio (no solo en la primera):

```
↑ Sugerencia: subir a 42.5kg
= Mantener 40kg
↓ Bajar a 37.5kg
```

Si la sugerencia es `sin_datos`, no se renderiza nada (mismo criterio que "sin registros anteriores").

### Testing

TDD real sobre `suggestProgression`: los 4 perfiles de objetivo cruzados con (cumplió/no cumplió objetivo) × (los 3 RPE), más los casos borde `lastSet: null` y `actualWeight: null`. El resto de los cambios (columnas nuevas, wiring de `sessions-api.ts`, UI) se verifica con build + prueba manual, mismo criterio ya usado en el proyecto para código de efectos secundarios.

## Fuera de alcance

- Incremento fijo en kg por objetivo es poco realista en ejercicios de aislamiento liviano (ej. +5kg de Fuerza en un curl de bíceps). Limitación conocida — se resuelve en una fase futura categorizando ejercicios por tipo (compuesto/aislamiento) para ajustar el incremento. Documentar en la sección de decisiones de `CLAUDE.md`.
- Sincronización de `training_goal` con el futuro Módulo de Macros — solo se deja el campo listo para reuso, sin integrarlo todavía.
- Mostrar la sugerencia en el editor de rutina (`mis-rutinas`) — solo en la pantalla de entrenar.
- RPE opcional o escala numérica — ya decidido: 3 niveles cualitativos, obligatorio.

## Criterio de éxito

Build y tests corren sin errores. Cargar una serie con RPE y objetivo de entrenamiento funciona de punta a punta. Al volver a entrenar el mismo ejercicio en una sesión nueva, aparece la sugerencia correcta según la última serie de la sesión anterior, el objetivo del usuario, y las reglas de la tabla `GOAL_PROFILES`. Ejercicios sin historial o sin peso registrado no muestran sugerencia.

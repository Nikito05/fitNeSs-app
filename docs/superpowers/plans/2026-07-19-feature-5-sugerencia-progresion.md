# Feature 5 — Sugerencia de progresión de peso Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app sugiera subir/mantener/bajar el peso de un ejercicio para la próxima sesión, en base a la última serie de la sesión anterior (reps vs. objetivo, y RPE cualitativo) y al objetivo de entrenamiento declarado por el usuario (Fuerza/Hipertrofia/Resistencia/General).

**Architecture:** Función pura de decisión (`suggestProgression`) con una tabla de configuración por objetivo, testeada con TDD real. Se agrega captura de RPE obligatoria en la pantalla de entrenar y un selector de objetivo en Perfil (persistido en Supabase, a diferencia de tamaño de letra). La integración final calcula la sugerencia por ejercicio a partir de datos ya cargados (última sesión + plan actual) y la muestra junto al hint "último: Xkg × Y" ya existente.

**Tech Stack:** Reutiliza el stack existente, sin componentes ni dependencias nuevas.

## Global Constraints

- Package manager: npm únicamente
- RPE: 3 niveles cualitativos (`facil` / `justo` / `al_limite`), selector obligatorio, arranca en `'justo'` para series nuevas
- Objetivo de entrenamiento: 4 valores fijos (`fuerza` / `hipertrofia` / `resistencia` / `general`), default `'general'`, persistido en `profiles.training_goal` vía Supabase (NO en `localStorage` — a diferencia de tamaño de letra, es un dato que alimenta un cálculo real y lo reusará el futuro Módulo de Macros)
- La sugerencia se calcula sobre la **última serie (mayor `set_number`)** de la sesión anterior más reciente de cada ejercicio, comparada contra el objetivo de reps *actual* del plan para ese mismo número de serie
- Tabla `GOAL_PROFILES` exacta (incrementos en kg): `fuerza` → sube con cualquier RPE, +5kg; `hipertrofia` → sube con `facil`/`justo`, +2.5kg; `resistencia` → sube solo con `facil`, +1.25kg; `general` → igual que `hipertrofia`, +2.5kg. Baja solo si no cumplió el objetivo de reps y el RPE fue `al_limite`, mismo incremento en negativo, nunca por debajo de 0
- Visualización: texto simple con flecha (`↑`/`=`/`↓`), sin badges de color, sin sugerencia cuando no hay sesión previa o el peso de la última serie es `null` (ejercicio de peso corporal)
- Solo `suggestProgression` se testea con TDD (es la única función pura nueva) — el resto (columnas nuevas, wiring de API, UI) se verifica con build, mismo criterio ya usado en el proyecto
- Las migraciones se escriben y commitean en esta rama pero **no se aplican en vivo** durante la ejecución — se aplican después, junto con el usuario, en la fase de conexión de infraestructura
- Rama de trabajo: `feat-sugerencia-progresion` (crear desde `main` antes de la Tarea 1)

---

### Task 1: Migración — `training_goal` y `rpe`

**Files:**
- Create: `supabase/migrations/20260719010000_add_training_goal_and_rpe.sql`

**Interfaces:**
- Produces: columnas `profiles.training_goal` (`text not null default 'general'`) y `logged_sets.rpe` (`text not null default 'justo'`), ambas con `check` a sus valores válidos — consumidas por las Tareas 3 y 4 (a través de la app, no de tipos generados).

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260719010000_add_training_goal_and_rpe.sql`:

```sql
alter table public.profiles
  add column training_goal text not null default 'general'
  check (training_goal in ('fuerza', 'hipertrofia', 'resistencia', 'general'));

alter table public.logged_sets
  add column rpe text not null default 'justo'
  check (rpe in ('facil', 'justo', 'al_limite'));
```

Nota: son `ALTER TABLE` sobre tablas ya existentes y ya expuestas con `grant` a `authenticated` (`profiles` desde Fase 0, `logged_sets` desde Módulo 1) — no hace falta agregar ningún `grant` nuevo, el permiso ya cubre las columnas nuevas de esas tablas.

El `default 'justo'` en `rpe` es para las filas ya existentes, registradas antes de esta feature (no hay forma de reconstruir el esfuerzo percibido real de esas series retroactivamente). Las escrituras nuevas de la app siempre mandan un valor explícito.

- [ ] **Step 2: NO aplicar la migración todavía**

No correr `supabase db push` ni ningún comando que la aplique contra la base real — se aplica más adelante, junto con el usuario, en la fase de conexión de infraestructura (mismo criterio usado en Fase 0 y Módulo 1).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260719010000_add_training_goal_and_rpe.sql
git commit -m "feat: add training_goal and rpe columns migration"
```

---

### Task 2: Lógica de sugerencia de progresión (TDD)

**Files:**
- Create: `src/lib/rutina/progression-suggestion.ts`
- Test: `src/lib/rutina/progression-suggestion.test.ts`

**Interfaces:**
- Produces: tipos `TrainingGoal`, `Rpe`, `ProgressionSuggestion`, función `suggestProgression(goal, lastSet)` — consumidos por las Tareas 3 (tipo `Rpe`), 4 (tipo `TrainingGoal`) y 5 (todo).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/rutina/progression-suggestion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { suggestProgression } from './progression-suggestion'

describe('suggestProgression', () => {
  describe('sin datos', () => {
    it('returns sin_datos when there is no last set', () => {
      expect(suggestProgression('general', null)).toEqual({ action: 'sin_datos' })
    })

    it('returns sin_datos when the last set has no weight (bodyweight exercise)', () => {
      expect(
        suggestProgression('general', {
          actualReps: 10,
          actualWeight: null,
          rpe: 'facil',
          targetReps: 10,
        })
      ).toEqual({ action: 'sin_datos' })
    })
  })

  describe('fuerza', () => {
    it('sube con facil cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 5, actualWeight: 100, rpe: 'facil', targetReps: 5 })
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('sube con justo cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 5, actualWeight: 100, rpe: 'justo', targetReps: 5 })
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('sube con al_limite cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 5, actualWeight: 100, rpe: 'al_limite', targetReps: 5 })
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('baja con al_limite cuando no cumplió el objetivo', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 3, actualWeight: 100, rpe: 'al_limite', targetReps: 5 })
      ).toEqual({ action: 'bajar', suggestedWeight: 95 })
    })

    it('mantiene cuando no cumplió el objetivo pero no fue al_limite', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 3, actualWeight: 100, rpe: 'justo', targetReps: 5 })
      ).toEqual({ action: 'mantener', suggestedWeight: 100 })
    })

    it('nunca baja el peso sugerido debajo de 0', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 3, actualWeight: 3, rpe: 'al_limite', targetReps: 5 })
      ).toEqual({ action: 'bajar', suggestedWeight: 0 })
    })
  })

  describe('hipertrofia', () => {
    it('sube con facil cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('hipertrofia', { actualReps: 12, actualWeight: 40, rpe: 'facil', targetReps: 12 })
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('sube con justo cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('hipertrofia', { actualReps: 12, actualWeight: 40, rpe: 'justo', targetReps: 12 })
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('mantiene con al_limite aunque haya cumplido el objetivo', () => {
      expect(
        suggestProgression('hipertrofia', { actualReps: 12, actualWeight: 40, rpe: 'al_limite', targetReps: 12 })
      ).toEqual({ action: 'mantener', suggestedWeight: 40 })
    })

    it('baja con al_limite cuando no cumplió el objetivo', () => {
      expect(
        suggestProgression('hipertrofia', { actualReps: 8, actualWeight: 40, rpe: 'al_limite', targetReps: 12 })
      ).toEqual({ action: 'bajar', suggestedWeight: 37.5 })
    })
  })

  describe('resistencia', () => {
    it('sube solo con facil cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('resistencia', { actualReps: 20, actualWeight: 10, rpe: 'facil', targetReps: 20 })
      ).toEqual({ action: 'subir', suggestedWeight: 11.25 })
    })

    it('mantiene con justo aunque haya cumplido el objetivo', () => {
      expect(
        suggestProgression('resistencia', { actualReps: 20, actualWeight: 10, rpe: 'justo', targetReps: 20 })
      ).toEqual({ action: 'mantener', suggestedWeight: 10 })
    })

    it('mantiene con al_limite aunque haya cumplido el objetivo', () => {
      expect(
        suggestProgression('resistencia', { actualReps: 20, actualWeight: 10, rpe: 'al_limite', targetReps: 20 })
      ).toEqual({ action: 'mantener', suggestedWeight: 10 })
    })

    it('baja con al_limite cuando no cumplió el objetivo', () => {
      expect(
        suggestProgression('resistencia', { actualReps: 15, actualWeight: 10, rpe: 'al_limite', targetReps: 20 })
      ).toEqual({ action: 'bajar', suggestedWeight: 8.75 })
    })
  })

  describe('general', () => {
    it('sube con facil cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('general', { actualReps: 10, actualWeight: 30, rpe: 'facil', targetReps: 10 })
      ).toEqual({ action: 'subir', suggestedWeight: 32.5 })
    })

    it('mantiene con al_limite aunque haya cumplido el objetivo', () => {
      expect(
        suggestProgression('general', { actualReps: 10, actualWeight: 30, rpe: 'al_limite', targetReps: 10 })
      ).toEqual({ action: 'mantener', suggestedWeight: 30 })
    })
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npm test
```
Expected: FAIL — `Cannot find module './progression-suggestion'`.

- [ ] **Step 3: Escribir la implementación**

Crear `src/lib/rutina/progression-suggestion.ts`:

```ts
export type TrainingGoal = 'fuerza' | 'hipertrofia' | 'resistencia' | 'general'
export type Rpe = 'facil' | 'justo' | 'al_limite'

type GoalProfile = {
  increaseOnRpe: Rpe[]
  weightIncrement: number
}

const GOAL_PROFILES: Record<TrainingGoal, GoalProfile> = {
  fuerza: { increaseOnRpe: ['facil', 'justo', 'al_limite'], weightIncrement: 5 },
  hipertrofia: { increaseOnRpe: ['facil', 'justo'], weightIncrement: 2.5 },
  resistencia: { increaseOnRpe: ['facil'], weightIncrement: 1.25 },
  general: { increaseOnRpe: ['facil', 'justo'], weightIncrement: 2.5 },
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

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
npm test
```
Expected: PASS — 18 tests nuevos (más los 27 ya existentes, total 45).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add training progression suggestion logic with TDD"
```

---

### Task 3: RPE en la capa de datos y en la pantalla de entrenar

**Files:**
- Modify: `src/lib/rutina/types.ts`
- Modify: `src/lib/rutina/sessions-api.ts`
- Modify: `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`

**Interfaces:**
- Consumes: tipo `Rpe` (Tarea 2).
- Produces: `LoggedSet.rpe: Rpe`; `saveLoggedSet` con parámetro `rpe: Rpe` obligatorio; `getLoggedSetsForSession`/`listSessionsForExercise` devuelven `rpe` en cada set; selector de RPE obligatorio en la pantalla de entrenar — consumidos por la Tarea 5.

Nota: esta tarea combina la capa de datos y la pantalla de entrenar porque están acopladas — cambiar la firma de `saveLoggedSet` para exigir `rpe` deja el build roto hasta que el único call site (esta pantalla) se actualice. Se hace todo en una sola tarea para que el build quede en verde al final.

- [ ] **Step 1: Agregar `rpe` al tipo `LoggedSet`**

En `src/lib/rutina/types.ts`, agregar el import al principio del archivo:

```ts
import type { Rpe } from './progression-suggestion'
```

Y reemplazar:

```ts
export type LoggedSet = {
  id: string
  workoutSessionId: string
  exerciseId: string
  setNumber: number
  actualReps: number
  actualWeight: number | null
}
```

por:

```ts
export type LoggedSet = {
  id: string
  workoutSessionId: string
  exerciseId: string
  setNumber: number
  actualReps: number
  actualWeight: number | null
  rpe: Rpe
}
```

- [ ] **Step 2: Actualizar `sessions-api.ts`**

En `src/lib/rutina/sessions-api.ts`, agregar el import al principio del archivo:

```ts
import type { Rpe } from './progression-suggestion'
```

Reemplazar `getLoggedSetsForSession`:

```ts
export async function getLoggedSetsForSession(workoutSessionId: string): Promise<LoggedSet[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('logged_sets')
    .select('id, workout_session_id, exercise_id, set_number, actual_reps, actual_weight')
    .eq('workout_session_id', workoutSessionId)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    workoutSessionId: row.workout_session_id,
    exerciseId: row.exercise_id,
    setNumber: row.set_number,
    actualReps: row.actual_reps,
    actualWeight: row.actual_weight,
  }))
}
```

por:

```ts
export async function getLoggedSetsForSession(workoutSessionId: string): Promise<LoggedSet[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('logged_sets')
    .select('id, workout_session_id, exercise_id, set_number, actual_reps, actual_weight, rpe')
    .eq('workout_session_id', workoutSessionId)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    workoutSessionId: row.workout_session_id,
    exerciseId: row.exercise_id,
    setNumber: row.set_number,
    actualReps: row.actual_reps,
    actualWeight: row.actual_weight,
    rpe: row.rpe as Rpe,
  }))
}
```

Reemplazar `saveLoggedSet`:

```ts
export async function saveLoggedSet(input: {
  workoutSessionId: string
  exerciseId: string
  setNumber: number
  actualReps: number
  actualWeight: number | null
}): Promise<void> {
  const supabase = createClient()

  const { data: existing, error: findError } = await supabase
    .from('logged_sets')
    .select('id')
    .eq('workout_session_id', input.workoutSessionId)
    .eq('exercise_id', input.exerciseId)
    .eq('set_number', input.setNumber)
    .maybeSingle()

  if (findError) throw findError

  if (existing) {
    const { error } = await supabase
      .from('logged_sets')
      .update({ actual_reps: input.actualReps, actual_weight: input.actualWeight })
      .eq('id', existing.id)

    if (error) throw error
    return
  }

  const { error } = await supabase.from('logged_sets').insert({
    workout_session_id: input.workoutSessionId,
    exercise_id: input.exerciseId,
    set_number: input.setNumber,
    actual_reps: input.actualReps,
    actual_weight: input.actualWeight,
  })

  if (error) throw error
}
```

por:

```ts
export async function saveLoggedSet(input: {
  workoutSessionId: string
  exerciseId: string
  setNumber: number
  actualReps: number
  actualWeight: number | null
  rpe: Rpe
}): Promise<void> {
  const supabase = createClient()

  const { data: existing, error: findError } = await supabase
    .from('logged_sets')
    .select('id')
    .eq('workout_session_id', input.workoutSessionId)
    .eq('exercise_id', input.exerciseId)
    .eq('set_number', input.setNumber)
    .maybeSingle()

  if (findError) throw findError

  if (existing) {
    const { error } = await supabase
      .from('logged_sets')
      .update({ actual_reps: input.actualReps, actual_weight: input.actualWeight, rpe: input.rpe })
      .eq('id', existing.id)

    if (error) throw error
    return
  }

  const { error } = await supabase.from('logged_sets').insert({
    workout_session_id: input.workoutSessionId,
    exercise_id: input.exerciseId,
    set_number: input.setNumber,
    actual_reps: input.actualReps,
    actual_weight: input.actualWeight,
    rpe: input.rpe,
  })

  if (error) throw error
}
```

Reemplazar `listSessionsForExercise`:

```ts
export async function listSessionsForExercise(exerciseId: string): Promise<
  {
    sessionId: string
    sessionDate: string
    sets: { setNumber: number; actualReps: number; actualWeight: number | null }[]
  }[]
> {
  const supabase = createClient()

  const { data: setsData, error: setsError } = await supabase
    .from('logged_sets')
    .select(
      'set_number, actual_reps, actual_weight, workout_session_id, workout_sessions(session_date)'
    )
    .eq('exercise_id', exerciseId)
    .order('set_number')

  if (setsError) throw setsError

  const rows = setsData ?? []

  const sessionMap = new Map<
    string,
    { sessionDate: string; sets: { setNumber: number; actualReps: number; actualWeight: number | null }[] }
  >()

  for (const row of rows) {
    const sessionDate =
      (row.workout_sessions as unknown as { session_date: string })?.session_date ?? ''
    const existing = sessionMap.get(row.workout_session_id)
    const set = {
      setNumber: row.set_number,
      actualReps: row.actual_reps,
      actualWeight: row.actual_weight,
    }

    if (existing) {
      existing.sets.push(set)
    } else {
      sessionMap.set(row.workout_session_id, { sessionDate, sets: [set] })
    }
  }

  return Array.from(sessionMap.entries())
    .map(([sessionId, value]) => ({ sessionId, ...value }))
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
}
```

por:

```ts
export async function listSessionsForExercise(exerciseId: string): Promise<
  {
    sessionId: string
    sessionDate: string
    sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[]
  }[]
> {
  const supabase = createClient()

  const { data: setsData, error: setsError } = await supabase
    .from('logged_sets')
    .select(
      'set_number, actual_reps, actual_weight, rpe, workout_session_id, workout_sessions(session_date)'
    )
    .eq('exercise_id', exerciseId)
    .order('set_number')

  if (setsError) throw setsError

  const rows = setsData ?? []

  const sessionMap = new Map<
    string,
    { sessionDate: string; sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[] }
  >()

  for (const row of rows) {
    const sessionDate =
      (row.workout_sessions as unknown as { session_date: string })?.session_date ?? ''
    const existing = sessionMap.get(row.workout_session_id)
    const set = {
      setNumber: row.set_number,
      actualReps: row.actual_reps,
      actualWeight: row.actual_weight,
      rpe: row.rpe as Rpe,
    }

    if (existing) {
      existing.sets.push(set)
    } else {
      sessionMap.set(row.workout_session_id, { sessionDate, sets: [set] })
    }
  }

  return Array.from(sessionMap.entries())
    .map(([sessionId, value]) => ({ sessionId, ...value }))
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
}
```

- [ ] **Step 3: Agregar el import del tipo `Rpe` en la pantalla de entrenar**

Reemplazar:

```tsx
import { flattenPlannedSets, findFirstUnsavedIndex, type FlatPlannedSet } from '@/lib/rutina/entrenar-flow'
import type { RoutineDayDetail } from '@/lib/rutina/types'
```

por:

```tsx
import { flattenPlannedSets, findFirstUnsavedIndex, type FlatPlannedSet } from '@/lib/rutina/entrenar-flow'
import type { RoutineDayDetail } from '@/lib/rutina/types'
import type { Rpe } from '@/lib/rutina/progression-suggestion'
```

- [ ] **Step 4: Agregar `rpe` al tipo `SetLogState`**

Reemplazar:

```tsx
type SetLogState = {
  actualReps: number
  actualWeight: number | null
  isSaved: boolean
  isSaving: boolean
}
```

por:

```tsx
type SetLogState = {
  actualReps: number
  actualWeight: number | null
  rpe: Rpe
  isSaved: boolean
  isSaving: boolean
}
```

- [ ] **Step 5: Inicializar `rpe` al construir los logs**

Reemplazar:

```tsx
        const initialLogs: Record<string, SetLogState> = {}
        for (const flatSet of flat) {
          const key = `${flatSet.exerciseId}-${flatSet.setNumber}`
          const existing = existingByKey.get(key)
          initialLogs[key] = existing
            ? {
                actualReps: existing.actualReps,
                actualWeight: existing.actualWeight,
                isSaved: true,
                isSaving: false,
              }
            : {
                actualReps: flatSet.targetReps,
                actualWeight: flatSet.targetWeight,
                isSaved: false,
                isSaving: false,
              }
        }
```

por:

```tsx
        const initialLogs: Record<string, SetLogState> = {}
        for (const flatSet of flat) {
          const key = `${flatSet.exerciseId}-${flatSet.setNumber}`
          const existing = existingByKey.get(key)
          initialLogs[key] = existing
            ? {
                actualReps: existing.actualReps,
                actualWeight: existing.actualWeight,
                rpe: existing.rpe,
                isSaved: true,
                isSaving: false,
              }
            : {
                actualReps: flatSet.targetReps,
                actualWeight: flatSet.targetWeight,
                rpe: 'justo',
                isSaved: false,
                isSaving: false,
              }
        }
```

- [ ] **Step 6: Agregar la función `setRpe`**

Reemplazar:

```tsx
  function adjustWeight(delta: number) {
    const current = flatSets[currentIndex]
    if (!current) return
    const key = `${current.exerciseId}-${current.setNumber}`
    setLogs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        actualWeight: Math.max(0, (prev[key].actualWeight ?? 0) + delta),
        isSaved: false,
      },
    }))
  }
```

por:

```tsx
  function adjustWeight(delta: number) {
    const current = flatSets[currentIndex]
    if (!current) return
    const key = `${current.exerciseId}-${current.setNumber}`
    setLogs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        actualWeight: Math.max(0, (prev[key].actualWeight ?? 0) + delta),
        isSaved: false,
      },
    }))
  }

  function setRpe(rpe: Rpe) {
    const current = flatSets[currentIndex]
    if (!current) return
    const key = `${current.exerciseId}-${current.setNumber}`
    setLogs((prev) => ({
      ...prev,
      [key]: { ...prev[key], rpe, isSaved: false },
    }))
  }
```

- [ ] **Step 7: Pasar `rpe` al guardar**

Reemplazar:

```tsx
      await saveLoggedSet({
        workoutSessionId: sessionId,
        exerciseId: current.exerciseId,
        setNumber: current.setNumber,
        actualReps: log.actualReps,
        actualWeight: log.actualWeight,
      })
```

por:

```tsx
      await saveLoggedSet({
        workoutSessionId: sessionId,
        exerciseId: current.exerciseId,
        setNumber: current.setNumber,
        actualReps: log.actualReps,
        actualWeight: log.actualWeight,
        rpe: log.rpe,
      })
```

- [ ] **Step 8: Agregar el selector de RPE en la UI**

Reemplazar:

```tsx
        <div>
          <p className="mb-2 text-sm text-muted-foreground">Peso (kg)</p>
          <div className="flex items-center justify-center gap-4">
            <Button type="button" variant="outline" size="icon" onClick={() => adjustWeight(-2.5)}>
              −
            </Button>
            <span className="w-16 text-2xl font-semibold">{currentLog?.actualWeight ?? 0}</span>
            <Button type="button" variant="outline" size="icon" onClick={() => adjustWeight(2.5)}>
              +
            </Button>
          </div>
        </div>
      </div>

      <Button type="button" size="lg" onClick={handleConfirm} disabled={currentLog?.isSaving}>
```

por:

```tsx
        <div>
          <p className="mb-2 text-sm text-muted-foreground">Peso (kg)</p>
          <div className="flex items-center justify-center gap-4">
            <Button type="button" variant="outline" size="icon" onClick={() => adjustWeight(-2.5)}>
              −
            </Button>
            <span className="w-16 text-2xl font-semibold">{currentLog?.actualWeight ?? 0}</span>
            <Button type="button" variant="outline" size="icon" onClick={() => adjustWeight(2.5)}>
              +
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Esfuerzo</p>
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant={currentLog?.rpe === 'facil' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRpe('facil')}
            >
              Fácil
            </Button>
            <Button
              type="button"
              variant={currentLog?.rpe === 'justo' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRpe('justo')}
            >
              Justo
            </Button>
            <Button
              type="button"
              variant={currentLog?.rpe === 'al_limite' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRpe('al_limite')}
            >
              Al límite
            </Button>
          </div>
        </div>
      </div>

      <Button type="button" size="lg" onClick={handleConfirm} disabled={currentLog?.isSaving}>
```

- [ ] **Step 9: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add rpe to logged sets data layer and capture it when logging a set"
```

---

### Task 4: Selector de objetivo de entrenamiento en Perfil

**Files:**
- Modify: `src/app/(app)/perfil/page.tsx`

**Interfaces:**
- Consumes: tipo `TrainingGoal` (Tarea 2); columna `profiles.training_goal` (Tarea 1).

- [ ] **Step 1: Reemplazar la página de Perfil**

Reemplazar el contenido completo de `src/app/(app)/perfil/page.tsx`:

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  applyFontSize,
  getStoredFontSize,
  setStoredFontSize,
  type FontSize,
} from '@/lib/font-size'
import type { TrainingGoal } from '@/lib/rutina/progression-suggestion'

export default function PerfilPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<FontSize>('normal')
  const [trainingGoal, setTrainingGoal] = useState<TrainingGoal>('general')

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setFontSize(getStoredFontSize())

      if (!user) {
        setIsLoading(false)
        return
      }

      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, training_goal')
        .eq('id', user.id)
        .single()

      setDisplayName(profile?.display_name ?? '')
      setTrainingGoal((profile?.training_goal as TrainingGoal) ?? 'general')
      setIsLoading(false)
    }

    loadProfile()
  }, [])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setIsSaving(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setIsSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id)

    setIsSaving(false)
    setMessage(error ? 'No pudimos guardar los cambios.' : 'Perfil actualizado.')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleFontSizeChange(size: FontSize) {
    setStoredFontSize(size)
    applyFontSize(size)
    setFontSize(size)
  }

  async function handleTrainingGoalChange(goal: TrainingGoal) {
    setTrainingGoal(goal)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ training_goal: goal })
      .eq('id', user.id)

    if (error) setMessage('No pudimos guardar el objetivo de entrenamiento.')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Nombre</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2">
            <Label>Tamaño de letra</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={fontSize === 'normal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange('normal')}
              >
                Normal
              </Button>
              <Button
                type="button"
                variant={fontSize === 'large' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange('large')}
              >
                Grande
              </Button>
              <Button
                type="button"
                variant={fontSize === 'xlarge' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange('xlarge')}
              >
                Muy grande
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Label>Objetivo de entrenamiento</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={trainingGoal === 'fuerza' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTrainingGoalChange('fuerza')}
              >
                Fuerza
              </Button>
              <Button
                type="button"
                variant={trainingGoal === 'hipertrofia' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTrainingGoalChange('hipertrofia')}
              >
                Hipertrofia
              </Button>
              <Button
                type="button"
                variant={trainingGoal === 'resistencia' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTrainingGoalChange('resistencia')}
              >
                Resistencia
              </Button>
              <Button
                type="button"
                variant={trainingGoal === 'general' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTrainingGoalChange('general')}
              >
                General
              </Button>
            </div>
          </div>

          <Button variant="outline" className="mt-6 w-full" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

Nota: `handleTrainingGoalChange` actualiza el estado local antes de guardar (respuesta visual inmediata al tocar el botón, mismo criterio que `handleFontSizeChange`), y solo muestra un mensaje si Supabase devuelve error — no revierte el estado local, mismo nivel de manejo de errores que `handleSave` ya usa en esta pantalla.

- [ ] **Step 2: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la ruta `/perfil` sigue presente.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add training goal selector to Perfil"
```

---

### Task 5: Integrar la sugerencia en la pantalla de entrenar

**Files:**
- Modify: `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`

**Interfaces:**
- Consumes: `suggestProgression`, `ProgressionSuggestion`, `TrainingGoal` (Tarea 2); `listSessionsForExercise` con `rpe` por set (Tarea 3); `profiles.training_goal` (Tarea 1).

- [ ] **Step 1: Ampliar el import de `progression-suggestion` y agregar `createClient`**

Reemplazar:

```tsx
import type { Rpe } from '@/lib/rutina/progression-suggestion'
```

por:

```tsx
import {
  suggestProgression,
  type ProgressionSuggestion,
  type Rpe,
  type TrainingGoal,
} from '@/lib/rutina/progression-suggestion'
import { createClient } from '@/lib/supabase/client'
```

- [ ] **Step 2: Agregar el estado `suggestByExercise`**

Reemplazar:

```tsx
  const [lastByKey, setLastByKey] = useState<Record<string, LastValue>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
```

por:

```tsx
  const [lastByKey, setLastByKey] = useState<Record<string, LastValue>>({})
  const [suggestByExercise, setSuggestByExercise] = useState<Record<string, ProgressionSuggestion>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
```

- [ ] **Step 3: Calcular la sugerencia por ejercicio en `init()`**

Reemplazar:

```tsx
        const uniqueExerciseIds = Array.from(new Set(detail.exercises.map((e) => e.exerciseId)))
        const histories = await Promise.all(
          uniqueExerciseIds.map((id) => listSessionsForExercise(id))
        )

        const lastValues: Record<string, LastValue> = {}
        uniqueExerciseIds.forEach((exerciseId, i) => {
          const pastSessions = histories[i].filter((s) => s.sessionId !== session.id)
          const mostRecent = pastSessions[0]
          if (mostRecent) {
            for (const set of mostRecent.sets) {
              lastValues[`${exerciseId}-${set.setNumber}`] = {
                actualReps: set.actualReps,
                actualWeight: set.actualWeight,
              }
            }
          }
        })

        const isSavedByKey: Record<string, boolean> = {}
        for (const key of Object.keys(initialLogs)) {
          isSavedByKey[key] = initialLogs[key].isSaved
        }

        setDayDetail(detail)
        setSessionId(session.id)
        setFlatSets(flat)
        setLogs(initialLogs)
        setLastByKey(lastValues)
        setCurrentIndex(findFirstUnsavedIndex(flat, isSavedByKey))
```

por:

```tsx
        const uniqueExerciseIds = Array.from(new Set(detail.exercises.map((e) => e.exerciseId)))
        const histories = await Promise.all(
          uniqueExerciseIds.map((id) => listSessionsForExercise(id))
        )

        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        let trainingGoal: TrainingGoal = 'general'
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('training_goal')
            .eq('id', user.id)
            .single()
          trainingGoal = (profile?.training_goal as TrainingGoal) ?? 'general'
        }

        const lastValues: Record<string, LastValue> = {}
        const suggestions: Record<string, ProgressionSuggestion> = {}

        uniqueExerciseIds.forEach((exerciseId, i) => {
          const pastSessions = histories[i].filter((s) => s.sessionId !== session.id)
          const mostRecent = pastSessions[0]
          if (mostRecent) {
            for (const set of mostRecent.sets) {
              lastValues[`${exerciseId}-${set.setNumber}`] = {
                actualReps: set.actualReps,
                actualWeight: set.actualWeight,
              }
            }

            const lastSet = mostRecent.sets.reduce((max, set) =>
              set.setNumber > max.setNumber ? set : max
            )
            const exerciseDetail = detail.exercises.find((e) => e.exerciseId === exerciseId)
            const matchingPlanned = exerciseDetail?.plannedSets.find(
              (planned) => planned.setNumber === lastSet.setNumber
            )
            const targetReps =
              matchingPlanned?.targetReps ??
              exerciseDetail?.plannedSets[exerciseDetail.plannedSets.length - 1]?.targetReps

            if (targetReps !== undefined) {
              suggestions[exerciseId] = suggestProgression(trainingGoal, {
                actualReps: lastSet.actualReps,
                actualWeight: lastSet.actualWeight,
                rpe: lastSet.rpe,
                targetReps,
              })
            }
          }
        })

        const isSavedByKey: Record<string, boolean> = {}
        for (const key of Object.keys(initialLogs)) {
          isSavedByKey[key] = initialLogs[key].isSaved
        }

        setDayDetail(detail)
        setSessionId(session.id)
        setFlatSets(flat)
        setLogs(initialLogs)
        setLastByKey(lastValues)
        setSuggestByExercise(suggestions)
        setCurrentIndex(findFirstUnsavedIndex(flat, isSavedByKey))
```

- [ ] **Step 4: Leer la sugerencia del ejercicio actual**

Reemplazar:

```tsx
  const current = flatSets[currentIndex]
  const currentKey = `${current.exerciseId}-${current.setNumber}`
  const currentLog = logs[currentKey]
  const lastValue = lastByKey[currentKey]
```

por:

```tsx
  const current = flatSets[currentIndex]
  const currentKey = `${current.exerciseId}-${current.setNumber}`
  const currentLog = logs[currentKey]
  const lastValue = lastByKey[currentKey]
  const suggestion = suggestByExercise[current.exerciseId]
```

- [ ] **Step 5: Mostrar la sugerencia en la UI**

Reemplazar:

```tsx
        <div>
          <h1 className="text-xl font-semibold">{current.exerciseName}</h1>
          <p className="text-xs text-muted-foreground">
            {lastValue
              ? `último: ${lastValue.actualWeight ?? 0}kg × ${lastValue.actualReps}`
              : 'sin registros anteriores'}
          </p>
        </div>
```

por:

```tsx
        <div>
          <h1 className="text-xl font-semibold">{current.exerciseName}</h1>
          <p className="text-xs text-muted-foreground">
            {lastValue
              ? `último: ${lastValue.actualWeight ?? 0}kg × ${lastValue.actualReps}`
              : 'sin registros anteriores'}
          </p>
          {suggestion && suggestion.action !== 'sin_datos' && (
            <p className="text-xs text-muted-foreground">
              {suggestion.action === 'subir' && `↑ Sugerencia: subir a ${suggestion.suggestedWeight}kg`}
              {suggestion.action === 'mantener' && `= Mantener ${suggestion.suggestedWeight}kg`}
              {suggestion.action === 'bajar' && `↓ Bajar a ${suggestion.suggestedWeight}kg`}
            </p>
          )}
        </div>
```

- [ ] **Step 6: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: show weight progression suggestion in entrenar screen"
```

---

## Fuera de este plan

- Aplicar la migración de la Tarea 1 contra la base real (se hace junto con el usuario en la fase de conexión de infraestructura, con verificación end-to-end)
- Documentar en `CLAUDE.md` la limitación conocida del incremento fijo en kg para ejercicios de aislamiento, y la nueva columna `profiles.training_goal` como decisión reutilizable por el futuro Módulo de Macros (se hace al cerrar la rama)
- Mostrar la sugerencia en el editor de rutina (`mis-rutinas`)
- Sincronización de `training_goal` con Macros
- Merge de `feat-sugerencia-progresion` a `main` (vía `superpowers:finishing-a-development-branch`)

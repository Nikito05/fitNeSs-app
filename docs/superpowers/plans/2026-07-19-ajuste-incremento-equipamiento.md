# Ajuste — incremento por equipamiento y frecuencia por objetivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El tamaño del incremento sugerido pasa a depender del tipo de equipamiento del ejercicio (Barra +5kg / Mancuernas +2kg / Máquina y Polea +2.5kg / Peso corporal sin sugerencia), y el objetivo de entrenamiento pasa a controlar cuántas sesiones seguidas con buen desempeño hacen falta antes de sugerir subir (Fuerza 1 / Hipertrofia 2 / Resistencia 3 / General 2).

**Architecture:** Reescritura completa de `progression-suggestion.ts` (TDD) con un historial completo por serie en vez de una sola sesión. El campo `exercises.equipment` pasa de texto libre a un enum fijo de 5 valores. Dos frentes de integración independientes entre sí: (1) el cálculo de sugerencia en `entrenar`, que necesita `equipment` en `RoutineDayExerciseDetail`; (2) la creación de ejercicios, que necesita el selector fijo en vez del input libre. Se separan en tareas distintas porque no comparten archivos.

**Tech Stack:** Reutiliza el stack existente, sin componentes ni dependencias nuevas.

## Global Constraints

- Package manager: npm únicamente
- `Equipment`: `'barra' | 'mancuernas' | 'maquina' | 'peso_corporal' | 'polea'` — definido en `progression-suggestion.ts`, mismo criterio que `TrainingGoal`/`Rpe`
- `EQUIPMENT_INCREMENTS`: `barra: 5, mancuernas: 2, maquina: 2.5, polea: 2.5, peso_corporal: null` (kg)
- `GOAL_SESSIONS_REQUIRED`: `fuerza: 1, hipertrofia: 2, resistencia: 3, general: 2`
- "Sesión buena" = cumplió el objetivo de reps actual Y RPE fue `facil` o `justo` (nunca `al_limite`), para los 4 objetivos por igual — solo cambia cuántas hacen falta
- El escaneo de racha no tiene límite de historial: una sesión que no califica se saltea sin resetear el conteo acumulado
- "Bajar" siempre por una sola sesión (la más reciente), sin requerir racha
- El peso base para subir/bajar es siempre el de la sesión más reciente del historial de esa serie
- `peso_corporal` nunca genera sugerencia numérica (`sin_datos`), independientemente del peso registrado
- Las migraciones se escriben y commitean en esta rama pero **no se aplican en vivo** durante la ejecución — se aplican después, junto con el usuario
- Rama de trabajo: `feat-incremento-equipamiento` (crear desde `main` antes de la Tarea 1)

---

### Task 1: Migración — normalizar `exercises.equipment` a enum fijo

**Files:**
- Create: `supabase/migrations/20260719020000_normalize_exercise_equipment.sql`

**Interfaces:**
- Produces: columna `exercises.equipment` restringida a `('barra', 'mancuernas', 'maquina', 'peso_corporal', 'polea')` — consumida por las Tareas 2 y 3 (a través de la app).

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260719020000_normalize_exercise_equipment.sql`:

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

Nota: es un `ALTER TABLE`/`UPDATE` sobre una tabla ya expuesta con `grant` a `authenticated` desde Módulo 1 — no hace falta GRANT nuevo. El último `update` (fallback a `'maquina'`) corre después de los `update` específicos y antes del `constraint`, así que cualquier valor no reconocido en los datos actuales queda cubierto antes de que el `check` pueda fallar.

- [ ] **Step 2: NO aplicar la migración todavía**

No correr `supabase db push` ni ningún comando que la aplique contra la base real — se aplica más adelante, junto con el usuario.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260719020000_normalize_exercise_equipment.sql
git commit -m "feat: normalize exercise equipment to a fixed enum"
```

---

### Task 2: Algoritmo de sugerencia (TDD) + integración en Entrenar

**Files:**
- Modify: `src/lib/rutina/progression-suggestion.ts` (reescritura completa)
- Modify: `src/lib/rutina/progression-suggestion.test.ts` (reescritura completa)
- Modify: `src/lib/rutina/types.ts`
- Modify: `src/lib/rutina/routines-api.ts`
- Modify: `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`

**Interfaces:**
- Produces: tipo `Equipment`, `suggestProgression(goal, equipment, targetReps, history)`, `suggestProgressionForExercise(goal, equipment, plannedSets, pastSessions)`, `RoutineDayExerciseDetail.equipment: Equipment` — consumidos por la Tarea 3 (solo el tipo `Equipment`).

Nota: esta tarea NO toca `Exercise.equipment` (en `types.ts`) ni `exercises-api.ts` ni `exercise-picker.tsx` — esos son la Tarea 3, un frente completamente independiente (la creación de ejercicios no depende del cálculo de sugerencia).

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar el contenido completo de `src/lib/rutina/progression-suggestion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { suggestProgression, suggestProgressionForExercise } from './progression-suggestion'

describe('suggestProgression', () => {
  describe('sin datos', () => {
    it('sin historial', () => {
      expect(suggestProgression('general', 'barra', 10, [])).toEqual({ action: 'sin_datos' })
    })

    it('la sesión más reciente no tiene peso registrado', () => {
      expect(
        suggestProgression('general', 'barra', 10, [
          { actualReps: 10, actualWeight: null, rpe: 'facil' },
        ])
      ).toEqual({ action: 'sin_datos' })
    })

    it('peso corporal nunca sugiere, aunque haya peso registrado (ej. dominadas lastradas)', () => {
      expect(
        suggestProgression('fuerza', 'peso_corporal', 10, [
          { actualReps: 10, actualWeight: 80, rpe: 'facil' },
        ])
      ).toEqual({ action: 'sin_datos' })
    })
  })

  describe('bajar', () => {
    it('baja con una sola sesión: no cumplió objetivo y RPE al límite', () => {
      expect(
        suggestProgression('general', 'barra', 8, [
          { actualReps: 5, actualWeight: 60, rpe: 'al_limite' },
        ])
      ).toEqual({ action: 'bajar', suggestedWeight: 55 })
    })

    it('nunca baja el peso sugerido debajo de 0', () => {
      expect(
        suggestProgression('general', 'mancuernas', 8, [
          { actualReps: 5, actualWeight: 1, rpe: 'al_limite' },
        ])
      ).toEqual({ action: 'bajar', suggestedWeight: 0 })
    })
  })

  describe('mantener', () => {
    it('no cumplió objetivo pero el RPE no fue al límite: mantiene', () => {
      expect(
        suggestProgression('general', 'barra', 8, [
          { actualReps: 5, actualWeight: 60, rpe: 'justo' },
        ])
      ).toEqual({ action: 'mantener', suggestedWeight: 60 })
    })

    it('hipertrofia con una sola sesión buena (necesita 2): mantiene', () => {
      expect(
        suggestProgression('hipertrofia', 'maquina', 10, [
          { actualReps: 10, actualWeight: 40, rpe: 'facil' },
        ])
      ).toEqual({ action: 'mantener', suggestedWeight: 40 })
    })

    it('resistencia con 2 sesiones buenas (necesita 3): mantiene', () => {
      expect(
        suggestProgression('resistencia', 'mancuernas', 12, [
          { actualReps: 12, actualWeight: 10, rpe: 'facil' },
          { actualReps: 12, actualWeight: 10, rpe: 'facil' },
        ])
      ).toEqual({ action: 'mantener', suggestedWeight: 10 })
    })
  })

  describe('subir por frecuencia', () => {
    it('fuerza sube con una sola sesión buena', () => {
      expect(
        suggestProgression('fuerza', 'barra', 5, [
          { actualReps: 5, actualWeight: 100, rpe: 'justo' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('hipertrofia sube al completar 2 sesiones buenas seguidas', () => {
      expect(
        suggestProgression('hipertrofia', 'maquina', 10, [
          { actualReps: 10, actualWeight: 40, rpe: 'facil' },
          { actualReps: 10, actualWeight: 40, rpe: 'justo' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('resistencia sube al completar 3 sesiones buenas', () => {
      expect(
        suggestProgression('resistencia', 'mancuernas', 12, [
          { actualReps: 12, actualWeight: 10, rpe: 'facil' },
          { actualReps: 12, actualWeight: 10, rpe: 'facil' },
          { actualReps: 12, actualWeight: 10, rpe: 'justo' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 12 })
    })

    it('general sube al completar 2 sesiones buenas', () => {
      expect(
        suggestProgression('general', 'maquina', 10, [
          { actualReps: 10, actualWeight: 30, rpe: 'facil' },
          { actualReps: 10, actualWeight: 30, rpe: 'facil' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 32.5 })
    })

    it('una sesión que no califica en el medio de la racha no resetea el conteo', () => {
      // Sesión más reciente: buena. Sesión del medio: no cumplió objetivo (se saltea).
      // Sesión más antigua: buena. Hipertrofia necesita 2 — se alcanzan igual.
      expect(
        suggestProgression('hipertrofia', 'maquina', 10, [
          { actualReps: 10, actualWeight: 40, rpe: 'facil' },
          { actualReps: 5, actualWeight: 40, rpe: 'justo' },
          { actualReps: 10, actualWeight: 38, rpe: 'facil' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('el peso base para subir es siempre el de la sesión más reciente, no el de la sesión que completó la racha', () => {
      expect(
        suggestProgression('hipertrofia', 'barra', 5, [
          { actualReps: 5, actualWeight: 100, rpe: 'facil' },
          { actualReps: 5, actualWeight: 90, rpe: 'facil' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })
  })

  describe('incrementos por equipamiento', () => {
    it('barra: +5kg', () => {
      expect(
        suggestProgression('fuerza', 'barra', 5, [{ actualReps: 5, actualWeight: 100, rpe: 'facil' }])
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('mancuernas: +2kg', () => {
      expect(
        suggestProgression('fuerza', 'mancuernas', 10, [{ actualReps: 10, actualWeight: 20, rpe: 'facil' }])
      ).toEqual({ action: 'subir', suggestedWeight: 22 })
    })

    it('maquina: +2.5kg', () => {
      expect(
        suggestProgression('fuerza', 'maquina', 10, [{ actualReps: 10, actualWeight: 40, rpe: 'facil' }])
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('polea: +2.5kg (igual que máquina)', () => {
      expect(
        suggestProgression('fuerza', 'polea', 10, [{ actualReps: 10, actualWeight: 15, rpe: 'facil' }])
      ).toEqual({ action: 'subir', suggestedWeight: 17.5 })
    })
  })
})

describe('suggestProgressionForExercise', () => {
  it('calcula una sugerencia independiente por cada número de serie', () => {
    const plannedSets = [
      { setNumber: 1, targetReps: 10 },
      { setNumber: 2, targetReps: 10 },
    ]
    const pastSessions = [
      {
        sets: [
          { setNumber: 1, actualReps: 10, actualWeight: 45, rpe: 'facil' as const },
          { setNumber: 2, actualReps: 10, actualWeight: 35, rpe: 'facil' as const },
        ],
      },
    ]

    const result = suggestProgressionForExercise('fuerza', 'barra', plannedSets, pastSessions)

    expect(result[1]).toEqual({ action: 'subir', suggestedWeight: 50 })
    expect(result[2]).toEqual({ action: 'subir', suggestedWeight: 40 })
  })

  it('omite la serie que no tiene ningún historial previo', () => {
    const plannedSets = [
      { setNumber: 1, targetReps: 10 },
      { setNumber: 2, targetReps: 10 },
    ]
    const pastSessions = [
      { sets: [{ setNumber: 1, actualReps: 10, actualWeight: 45, rpe: 'facil' as const }] },
    ]

    const result = suggestProgressionForExercise('fuerza', 'barra', plannedSets, pastSessions)

    expect(result[1]).toEqual({ action: 'subir', suggestedWeight: 50 })
    expect(result[2]).toBeUndefined()
  })

  it('devuelve un objeto vacío cuando no hay sesiones pasadas', () => {
    const plannedSets = [{ setNumber: 1, targetReps: 10 }]

    expect(suggestProgressionForExercise('fuerza', 'barra', plannedSets, [])).toEqual({})
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npm test
```
Expected: FAIL — los tests nuevos no matchean la firma actual de `suggestProgression`/`suggestProgressionForExercise` (siguen esperando el formato viejo con `GOAL_PROFILES`).

- [ ] **Step 3: Escribir la implementación**

Reemplazar el contenido completo de `src/lib/rutina/progression-suggestion.ts`:

```ts
export type TrainingGoal = 'fuerza' | 'hipertrofia' | 'resistencia' | 'general'
export type Rpe = 'facil' | 'justo' | 'al_limite'
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

export type ProgressionSuggestion =
  | { action: 'subir'; suggestedWeight: number }
  | { action: 'mantener'; suggestedWeight: number }
  | { action: 'bajar'; suggestedWeight: number }
  | { action: 'sin_datos' }

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
  const lastActualWeight = last.actualWeight
  const lastMetTarget = last.actualReps >= targetReps

  if (!lastMetTarget && last.rpe === 'al_limite') {
    return { action: 'bajar', suggestedWeight: Math.max(0, lastActualWeight - increment) }
  }

  const required = GOAL_SESSIONS_REQUIRED[goal]
  let qualifying = 0
  for (const set of history) {
    const met = set.actualReps >= targetReps
    const goodRpe = set.rpe === 'facil' || set.rpe === 'justo'
    if (met && goodRpe) {
      qualifying += 1
      if (qualifying >= required) {
        return { action: 'subir', suggestedWeight: lastActualWeight + increment }
      }
    }
  }

  return { action: 'mantener', suggestedWeight: lastActualWeight }
}

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

Nota: `HistoricalSetEntry` no incluye `setNumber` (a diferencia del historial crudo de `listSessionsForExercise`) porque `suggestProgression` ya recibe el historial filtrado a una sola serie — `suggestProgressionForExercise` es quien hace ese filtrado por `setNumber` antes de llamar a `suggestProgression`.

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
npm test
```
Expected: PASS — 20 tests en este archivo (reemplazan los 22 anteriores: 18 originales + 4 agregados en el fix de series piramidales), resto de la suite sin cambios. Total de la suite: 47 (49 actuales − 22 + 20).

- [ ] **Step 5: Sumar `equipment` a `RoutineDayExerciseDetail`**

En `src/lib/rutina/types.ts`, reemplazar la línea de import:

```ts
import type { Rpe } from './progression-suggestion'
```

por:

```ts
import type { Rpe, Equipment } from './progression-suggestion'
```

Y reemplazar:

```ts
export type RoutineDayExerciseDetail = {
  id: string
  exerciseId: string
  exerciseName: string
  exerciseOrder: number
  plannedSets: PlannedSet[]
}
```

por:

```ts
export type RoutineDayExerciseDetail = {
  id: string
  exerciseId: string
  exerciseName: string
  exerciseOrder: number
  equipment: Equipment
  plannedSets: PlannedSet[]
}
```

- [ ] **Step 6: Traer `equipment` en `getRoutineDayDetail`**

En `src/lib/rutina/routines-api.ts`, agregar el import al principio del archivo:

```ts
import type { Equipment } from './progression-suggestion'
```

Reemplazar:

```ts
  const { data: exercisesData, error: exercisesError } = await supabase
    .from('routine_day_exercises')
    .select('id, exercise_id, exercise_order, exercises(name)')
    .eq('routine_day_id', dayId)
    .order('exercise_order')
```

por:

```ts
  const { data: exercisesData, error: exercisesError } = await supabase
    .from('routine_day_exercises')
    .select('id, exercise_id, exercise_order, exercises(name, equipment)')
    .eq('routine_day_id', dayId)
    .order('exercise_order')
```

Reemplazar:

```ts
    exercises: dayExercises.map((e) => ({
      id: e.id,
      exerciseId: e.exercise_id,
      exerciseName: (e.exercises as unknown as { name: string })?.name ?? '',
      exerciseOrder: e.exercise_order,
      plannedSets: sets
```

por:

```ts
    exercises: dayExercises.map((e) => ({
      id: e.id,
      exerciseId: e.exercise_id,
      exerciseName: (e.exercises as unknown as { name: string; equipment: Equipment })?.name ?? '',
      exerciseOrder: e.exercise_order,
      equipment:
        (e.exercises as unknown as { name: string; equipment: Equipment })?.equipment ?? 'maquina',
      plannedSets: sets
```

- [ ] **Step 7: Actualizar la pantalla de entrenar para usar el historial completo y el equipamiento**

En `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`, reemplazar:

```tsx
import {
  suggestProgressionForExercise,
  type ProgressionSuggestion,
  type Rpe,
  type TrainingGoal,
} from '@/lib/rutina/progression-suggestion'
```

por:

```tsx
import {
  suggestProgressionForExercise,
  type Equipment,
  type ProgressionSuggestion,
  type Rpe,
  type TrainingGoal,
} from '@/lib/rutina/progression-suggestion'
```

Reemplazar:

```tsx
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

            const exerciseDetail = detail.exercises.find((e) => e.exerciseId === exerciseId)
            const suggestionsForExercise = suggestProgressionForExercise(
              trainingGoal,
              exerciseDetail?.plannedSets ?? [],
              mostRecent.sets
            )
            for (const [setNumber, suggestion] of Object.entries(suggestionsForExercise)) {
              suggestions[`${exerciseId}-${setNumber}`] = suggestion
            }
          }
        })
```

por:

```tsx
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

          const exerciseDetail = detail.exercises.find((e) => e.exerciseId === exerciseId)
          const equipment: Equipment = exerciseDetail?.equipment ?? 'maquina'
          const suggestionsForExercise = suggestProgressionForExercise(
            trainingGoal,
            equipment,
            exerciseDetail?.plannedSets ?? [],
            pastSessions
          )
          for (const [setNumber, suggestion] of Object.entries(suggestionsForExercise)) {
            suggestions[`${exerciseId}-${setNumber}`] = suggestion
          }
        })
```

Nota: `lastValues` (el hint "último: Xkg × Y") sigue anclado a `mostRecent` únicamente — no cambia, sigue mostrando la sesión más reciente. Lo que cambia es que la sugerencia ahora se calcula sobre `pastSessions` completo (todas las sesiones pasadas, no solo la más reciente), y ya no depende de que `mostRecent` exista — si `pastSessions` está vacío, `suggestProgressionForExercise` simplemente no genera sugerencias para ese ejercicio (mismo resultado que antes, pero sin la guarda redundante).

- [ ] **Step 8: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: redesign progression suggestion around equipment increments and goal frequency"
```

---

### Task 3: Selector de equipamiento en la creación de ejercicios

**Files:**
- Modify: `src/lib/rutina/types.ts`
- Modify: `src/lib/rutina/exercises-api.ts`
- Modify: `src/components/rutina/exercise-picker.tsx`

**Interfaces:**
- Consumes: tipo `Equipment` (Tarea 2).
- Produces: `Exercise.equipment: Equipment`, `createCustomExercise` con `equipment: Equipment`.

- [ ] **Step 1: Cambiar `Exercise.equipment` a `Equipment`**

En `src/lib/rutina/types.ts`, reemplazar:

```ts
import type { Rpe, Equipment } from './progression-suggestion'

export type Exercise = {
  id: string
  userId: string | null
  name: string
  muscleGroup: string
  equipment: string
}
```

por:

```ts
import type { Rpe, Equipment } from './progression-suggestion'

export type Exercise = {
  id: string
  userId: string | null
  name: string
  muscleGroup: string
  equipment: Equipment
}
```

- [ ] **Step 2: Tipar `equipment` en la capa de datos de ejercicios**

En `src/lib/rutina/exercises-api.ts`, reemplazar:

```ts
import { createClient } from '@/lib/supabase/client'
import type { Exercise } from './types'

type ExerciseRow = {
  id: string
  user_id: string | null
  name: string
  muscle_group: string
  equipment: string
}
```

por:

```ts
import { createClient } from '@/lib/supabase/client'
import type { Exercise } from './types'
import type { Equipment } from './progression-suggestion'

type ExerciseRow = {
  id: string
  user_id: string | null
  name: string
  muscle_group: string
  equipment: Equipment
}
```

Reemplazar:

```ts
export async function createCustomExercise(input: {
  name: string
  muscleGroup: string
  equipment: string
}): Promise<Exercise> {
```

por:

```ts
export async function createCustomExercise(input: {
  name: string
  muscleGroup: string
  equipment: Equipment
}): Promise<Exercise> {
```

- [ ] **Step 3: Reemplazar el input de texto libre por el selector de 5 opciones**

En `src/components/rutina/exercise-picker.tsx`, reemplazar:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listExercises, createCustomExercise } from '@/lib/rutina/exercises-api'
import type { Exercise } from '@/lib/rutina/types'

export function ExercisePicker({ onSelect }: { onSelect: (exercise: Exercise) => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMuscleGroup, setNewMuscleGroup] = useState('')
  const [newEquipment, setNewEquipment] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
```

por:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listExercises, createCustomExercise } from '@/lib/rutina/exercises-api'
import type { Exercise } from '@/lib/rutina/types'
import type { Equipment } from '@/lib/rutina/progression-suggestion'

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'barra', label: 'Barra' },
  { value: 'mancuernas', label: 'Mancuernas' },
  { value: 'maquina', label: 'Máquina' },
  { value: 'peso_corporal', label: 'Peso corporal' },
  { value: 'polea', label: 'Polea' },
]

function equipmentLabel(equipment: Equipment): string {
  return EQUIPMENT_OPTIONS.find((option) => option.value === equipment)?.label ?? equipment
}

export function ExercisePicker({ onSelect }: { onSelect: (exercise: Exercise) => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMuscleGroup, setNewMuscleGroup] = useState('')
  const [newEquipment, setNewEquipment] = useState<Equipment | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
```

Reemplazar:

```tsx
  async function handleCreate() {
    if (!newName || !newMuscleGroup || !newEquipment) {
      setError('Completá nombre, grupo muscular y equipo.')
      return
    }

    setError(null)
    setIsCreating(true)
    try {
      const exercise = await createCustomExercise({
        name: newName,
        muscleGroup: newMuscleGroup,
        equipment: newEquipment,
      })
      setExercises((prev) => [...prev, exercise])
      setNewName('')
      setNewMuscleGroup('')
      setNewEquipment('')
      setShowCreateForm(false)
      onSelect(exercise)
    } catch {
      setError('No pudimos crear el ejercicio.')
    } finally {
      setIsCreating(false)
    }
  }
```

por:

```tsx
  async function handleCreate() {
    if (!newName || !newMuscleGroup || !newEquipment) {
      setError('Completá nombre, grupo muscular y equipo.')
      return
    }

    setError(null)
    setIsCreating(true)
    try {
      const exercise = await createCustomExercise({
        name: newName,
        muscleGroup: newMuscleGroup,
        equipment: newEquipment,
      })
      setExercises((prev) => [...prev, exercise])
      setNewName('')
      setNewMuscleGroup('')
      setNewEquipment(null)
      setShowCreateForm(false)
      onSelect(exercise)
    } catch {
      setError('No pudimos crear el ejercicio.')
    } finally {
      setIsCreating(false)
    }
  }
```

Reemplazar:

```tsx
              <span className="text-xs text-muted-foreground">
                {exercise.muscleGroup} · {exercise.equipment}
              </span>
```

por:

```tsx
              <span className="text-xs text-muted-foreground">
                {exercise.muscleGroup} · {equipmentLabel(exercise.equipment)}
              </span>
```

Reemplazar:

```tsx
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-exercise-equipment">Equipo</Label>
            <Input
              id="new-exercise-equipment"
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value)}
            />
          </div>
```

por:

```tsx
          <div className="flex flex-col gap-1">
            <Label>Equipo</Label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={newEquipment === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewEquipment(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
```

- [ ] **Step 4: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace free-text equipment input with fixed selector"
```

---

## Fuera de este plan

- Aplicar la migración de la Tarea 1 contra la base real (se hace junto con el usuario en la fase de conexión de infraestructura, con verificación end-to-end)
- Documentar en `CLAUDE.md` la decisión de separar magnitud (equipamiento) de frecuencia (objetivo) (se hace al cerrar la rama)
- Pantalla de edición de ejercicios existentes
- Límite de ventana temporal para el escaneo de racha
- Merge de `feat-incremento-equipamiento` a `main` (vía `superpowers:finishing-a-development-branch`)

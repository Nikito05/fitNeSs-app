# Feature 1 — Layouts entrenar + editor de rutina Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el layout de "registrar entrenamiento" por un flujo enfocado (un ejercicio/serie a la vez, navegación libre) y el layout del editor de rutina por lista de días + hoja de edición, sin tocar el modelo de datos ni la capa de acceso existente del Módulo 1.

**Architecture:** Reescritura de dos páginas ya existentes sobre las mismas funciones de `src/lib/rutina/{routines,sessions}-api.ts`. Se agrega un módulo chico de lógica pura (aplanar series planeadas + encontrar la primera sin guardar) con TDD, y se instala el componente `sheet` de shadcn/ui (ya verificado que existe y funciona en este proyecto).

**Tech Stack:** Reutiliza el stack del Módulo 1. Se suma el componente `sheet` de shadcn/ui (sobre `@base-ui/react/dialog`, mismas dependencias ya instaladas — no agrega paquetes npm nuevos). Se reutiliza `DropdownMenu` (instalado en Fase 0, sin uso hasta ahora).

## Global Constraints

- Package manager: npm únicamente
- Sin cambios al modelo de datos ni a `routines-api.ts`/`sessions-api.ts` — esta feature es reorganización de UI pura
- Ningún componente de UI llama a Supabase directo — sigue yendo todo vía las funciones `*-api.ts` existentes
- Incrementos de los steppers en "registrar entrenamiento": reps ±1 (mínimo 0), peso ±2.5kg (mínimo 0)
- El detalle de colapso/expansión de ejercicios dentro de la hoja del editor de rutina es intencionalmente simple en esta feature (toggle mostrar/ocultar) — Feature 3 lo refina, no hay que anticiparse a esa feature
- Rama de trabajo: `feat-layouts-entrenar-editor` (crear desde `main` antes de la Tarea 1)

---

### Task 1: Lógica pura del flujo de registro (TDD)

**Files:**
- Create: `src/lib/rutina/entrenar-flow.ts`
- Test: `src/lib/rutina/entrenar-flow.test.ts`

**Interfaces:**
- Produces: `flattenPlannedSets(exercises): FlatPlannedSet[]`, `findFirstUnsavedIndex(flatSets, isSavedByKey): number`, tipo `FlatPlannedSet` — consumidos por la Tarea 2.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/rutina/entrenar-flow.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { flattenPlannedSets, findFirstUnsavedIndex } from './entrenar-flow'

describe('flattenPlannedSets', () => {
  it('returns an empty array when there are no exercises', () => {
    expect(flattenPlannedSets([])).toEqual([])
  })

  it('flattens a single exercise with multiple sets in order', () => {
    const exercises = [
      {
        exerciseId: 'ex-1',
        exerciseName: 'Press banca',
        plannedSets: [
          { setNumber: 1, targetReps: 10, targetWeight: 50 },
          { setNumber: 2, targetReps: 8, targetWeight: 55 },
        ],
      },
    ]
    expect(flattenPlannedSets(exercises)).toEqual([
      { exerciseId: 'ex-1', exerciseName: 'Press banca', setNumber: 1, targetReps: 10, targetWeight: 50 },
      { exerciseId: 'ex-1', exerciseName: 'Press banca', setNumber: 2, targetReps: 8, targetWeight: 55 },
    ])
  })

  it('concatenates multiple exercises in the given order', () => {
    const exercises = [
      {
        exerciseId: 'ex-1',
        exerciseName: 'Press banca',
        plannedSets: [{ setNumber: 1, targetReps: 10, targetWeight: 50 }],
      },
      {
        exerciseId: 'ex-2',
        exerciseName: 'Sentadilla',
        plannedSets: [{ setNumber: 1, targetReps: 8, targetWeight: null }],
      },
    ]
    const result = flattenPlannedSets(exercises)
    expect(result).toHaveLength(2)
    expect(result[0].exerciseId).toBe('ex-1')
    expect(result[1].exerciseId).toBe('ex-2')
  })
})

describe('findFirstUnsavedIndex', () => {
  const flatSets = [
    { exerciseId: 'ex-1', exerciseName: 'Press banca', setNumber: 1, targetReps: 10, targetWeight: 50 },
    { exerciseId: 'ex-1', exerciseName: 'Press banca', setNumber: 2, targetReps: 8, targetWeight: 55 },
  ]

  it('returns 0 when nothing is saved', () => {
    expect(findFirstUnsavedIndex(flatSets, {})).toBe(0)
  })

  it('returns the index of the first unsaved set', () => {
    expect(findFirstUnsavedIndex(flatSets, { 'ex-1-1': true })).toBe(1)
  })

  it('returns the array length when everything is saved', () => {
    expect(findFirstUnsavedIndex(flatSets, { 'ex-1-1': true, 'ex-1-2': true })).toBe(2)
  })

  it('returns 0 for an empty list of flat sets', () => {
    expect(findFirstUnsavedIndex([], {})).toBe(0)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npm test
```
Expected: FAIL — `Cannot find module './entrenar-flow'`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `src/lib/rutina/entrenar-flow.ts`:

```ts
export type FlatPlannedSet = {
  exerciseId: string
  exerciseName: string
  setNumber: number
  targetReps: number
  targetWeight: number | null
}

export function flattenPlannedSets(
  exercises: {
    exerciseId: string
    exerciseName: string
    plannedSets: { setNumber: number; targetReps: number; targetWeight: number | null }[]
  }[]
): FlatPlannedSet[] {
  const flat: FlatPlannedSet[] = []
  for (const exercise of exercises) {
    for (const set of exercise.plannedSets) {
      flat.push({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        setNumber: set.setNumber,
        targetReps: set.targetReps,
        targetWeight: set.targetWeight,
      })
    }
  }
  return flat
}

export function findFirstUnsavedIndex(
  flatSets: FlatPlannedSet[],
  isSavedByKey: Record<string, boolean>
): number {
  const index = flatSets.findIndex(
    (set) => !isSavedByKey[`${set.exerciseId}-${set.setNumber}`]
  )
  return index === -1 ? flatSets.length : index
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npm test
```
Expected: PASS — 7 tests nuevos pasando (más los 14 ya existentes, total 21).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add pure logic for focused workout flow with TDD"
```

---

### Task 2: Registrar entrenamiento — flujo enfocado

**Files:**
- Modify: `src/app/(app)/rutina/entrenar/[dayId]/page.tsx` (reescritura completa)

**Interfaces:**
- Consumes: `flattenPlannedSets`/`findFirstUnsavedIndex`/`FlatPlannedSet` (Tarea 1), `getRoutineDayDetail` (Módulo 1), `getOrCreateWorkoutSession`/`getLoggedSetsForSession`/`saveLoggedSet`/`listSessionsForExercise` (Módulo 1), `DropdownMenu`/`DropdownMenuContent`/`DropdownMenuItem`/`DropdownMenuTrigger` de `@/components/ui/dropdown-menu` (ya instalado en Fase 0).

- [ ] **Step 1: Reemplazar la página de registro de entrenamiento**

Reemplazar el contenido completo de `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getRoutineDayDetail } from '@/lib/rutina/routines-api'
import {
  getOrCreateWorkoutSession,
  getLoggedSetsForSession,
  saveLoggedSet,
  listSessionsForExercise,
} from '@/lib/rutina/sessions-api'
import { flattenPlannedSets, findFirstUnsavedIndex, type FlatPlannedSet } from '@/lib/rutina/entrenar-flow'
import type { RoutineDayDetail } from '@/lib/rutina/types'

type SetLogState = {
  actualReps: number
  actualWeight: number | null
  isSaved: boolean
  isSaving: boolean
}

type LastValue = {
  actualReps: number
  actualWeight: number | null
}

export default function EntrenarPage() {
  const params = useParams<{ dayId: string }>()
  const router = useRouter()
  const dayId = params.dayId

  const [dayDetail, setDayDetail] = useState<RoutineDayDetail | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [flatSets, setFlatSets] = useState<FlatPlannedSet[]>([])
  const [logs, setLogs] = useState<Record<string, SetLogState>>({})
  const [lastByKey, setLastByKey] = useState<Record<string, LastValue>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      try {
        const detail = await getRoutineDayDetail(dayId)
        const session = await getOrCreateWorkoutSession(dayId)
        const existingLogs = await getLoggedSetsForSession(session.id)

        const flat = flattenPlannedSets(detail.exercises)

        const existingByKey = new Map(
          existingLogs.map((log) => [`${log.exerciseId}-${log.setNumber}`, log])
        )

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
      } catch {
        setError('No pudimos cargar el entrenamiento de hoy.')
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [dayId])

  function adjustReps(delta: number) {
    const current = flatSets[currentIndex]
    if (!current) return
    const key = `${current.exerciseId}-${current.setNumber}`
    setLogs((prev) => ({
      ...prev,
      [key]: { ...prev[key], actualReps: Math.max(0, prev[key].actualReps + delta), isSaved: false },
    }))
  }

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

  async function handleConfirm() {
    const current = flatSets[currentIndex]
    if (!current || !sessionId) return
    const key = `${current.exerciseId}-${current.setNumber}`
    const log = logs[key]
    if (!log) return

    setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: true } }))
    try {
      await saveLoggedSet({
        workoutSessionId: sessionId,
        exerciseId: current.exerciseId,
        setNumber: current.setNumber,
        actualReps: log.actualReps,
        actualWeight: log.actualWeight,
      })
      setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: false, isSaved: true } }))
      setCurrentIndex((prev) => prev + 1)
    } catch {
      setError('No pudimos guardar esa serie.')
      setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: false } }))
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!dayDetail) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (flatSets.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
        <p className="text-sm text-muted-foreground">
          Este día no tiene series para registrar todavía.
        </p>
        <Button type="button" onClick={() => router.push('/rutina')}>
          Volver a Rutina
        </Button>
      </div>
    )
  }

  if (currentIndex >= flatSets.length) {
    const completedCount = flatSets.filter((flatSet) => {
      const key = `${flatSet.exerciseId}-${flatSet.setNumber}`
      return logs[key]?.isSaved
    }).length

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-lg font-semibold">¡Entrenamiento completo!</h1>
        <p className="text-sm text-muted-foreground">
          {completedCount} de {flatSets.length} series completadas en {dayDetail.name}.
        </p>
        <Button type="button" onClick={() => router.push('/rutina')}>
          Volver a Rutina
        </Button>
      </div>
    )
  }

  const current = flatSets[currentIndex]
  const currentKey = `${current.exerciseId}-${current.setNumber}`
  const currentLog = logs[currentKey]
  const lastValue = lastByKey[currentKey]

  return (
    <div className="flex min-h-dvh flex-col gap-6 p-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <DropdownMenu>
        <DropdownMenuTrigger className="self-center rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
          Serie {currentIndex + 1} de {flatSets.length}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {flatSets.map((flatSet, index) => {
            const key = `${flatSet.exerciseId}-${flatSet.setNumber}`
            const saved = logs[key]?.isSaved
            return (
              <DropdownMenuItem key={key} onClick={() => setCurrentIndex(index)}>
                {flatSet.exerciseName} — Serie {flatSet.setNumber} {saved ? '✓' : ''}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">{current.exerciseName}</h1>
          <p className="text-xs text-muted-foreground">
            {lastValue
              ? `último: ${lastValue.actualWeight ?? 0}kg × ${lastValue.actualReps}`
              : 'sin registros anteriores'}
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Repeticiones</p>
          <div className="flex items-center justify-center gap-4">
            <Button type="button" variant="outline" size="icon" onClick={() => adjustReps(-1)}>
              −
            </Button>
            <span className="w-12 text-2xl font-semibold">{currentLog?.actualReps ?? 0}</span>
            <Button type="button" variant="outline" size="icon" onClick={() => adjustReps(1)}>
              +
            </Button>
          </div>
        </div>

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
        {currentLog?.isSaving ? 'Guardando...' : 'Confirmar y siguiente →'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la ruta `/rutina/entrenar/[dayId]` sigue presente.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: rewrite workout logging as a focused one-set-at-a-time flow"
```

---

### Task 3: Editor de rutina — lista de días + hoja de edición

**Files:**
- Create: `src/components/ui/sheet.tsx` (vía `npx shadcn@latest add sheet -y`)
- Modify: `src/app/(app)/rutina/mis-rutinas/[routineId]/page.tsx` (reescritura completa)

**Interfaces:**
- Consumes: `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` de `@/components/ui/sheet` (nuevo), `ExercisePicker` (Módulo 1), `PlannedSetsEditor` (Módulo 1), `getRoutineWithDays`/`addRoutineDay`/`deleteRoutineDay`/`getRoutineDayDetail`/`addExerciseToDay`/`removeExerciseFromDay` (Módulo 1).

- [ ] **Step 1: Instalar el componente sheet de shadcn/ui**

```bash
npx --yes shadcn@latest add sheet -y
```
Expected: crea `src/components/ui/sheet.tsx`. Ya verificado en el brainstorming de esta feature que este comando funciona en este proyecto sin agregar dependencias npm nuevas (reutiliza `@base-ui/react` y `lucide-react`, ya instalados) — si `npm install` instala algo de todos modos, no es un problema, solo confirmalo en el reporte.

- [ ] **Step 2: Reemplazar la página de edición de rutina**

Reemplazar el contenido completo de `src/app/(app)/rutina/mis-rutinas/[routineId]/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ExercisePicker } from '@/components/rutina/exercise-picker'
import { PlannedSetsEditor } from '@/components/rutina/planned-sets-editor'
import {
  getRoutineWithDays,
  addRoutineDay,
  deleteRoutineDay,
  getRoutineDayDetail,
  addExerciseToDay,
  removeExerciseFromDay,
} from '@/lib/rutina/routines-api'
import type { Routine, RoutineDay, RoutineDayDetail } from '@/lib/rutina/types'

export default function EditarRutinaPage() {
  const params = useParams<{ routineId: string }>()
  const routineId = params.routineId

  const [routine, setRoutine] = useState<Routine | null>(null)
  const [days, setDays] = useState<RoutineDay[]>([])
  const [openDayId, setOpenDayId] = useState<string | null>(null)
  const [dayDetail, setDayDetail] = useState<RoutineDayDetail | null>(null)
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [newDayName, setNewDayName] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function initialLoad() {
      await loadRoutine()
      setIsLoading(false)
    }

    initialLoad()
  }, [routineId])

  async function loadRoutine() {
    try {
      const data = await getRoutineWithDays(routineId)
      setRoutine(data.routine)
      setDays(data.days)
    } catch {
      setError('No pudimos cargar la rutina.')
    }
  }

  async function loadDayDetail(dayId: string) {
    try {
      const detail = await getRoutineDayDetail(dayId)
      setDayDetail(detail)
    } catch {
      setError('No pudimos cargar el día.')
    }
  }

  async function handleOpenDay(dayId: string) {
    setOpenDayId(dayId)
    setExpandedExerciseId(null)
    setShowPicker(false)
    await loadDayDetail(dayId)
  }

  function handleSheetOpenChange(open: boolean) {
    if (!open) {
      setOpenDayId(null)
      setDayDetail(null)
      setExpandedExerciseId(null)
      setShowPicker(false)
    }
  }

  async function handleAddDay() {
    if (!newDayName.trim()) {
      setError('Ponele un nombre al día.')
      return
    }
    setError(null)
    try {
      await addRoutineDay(routineId, newDayName.trim())
      setNewDayName('')
      await loadRoutine()
    } catch {
      setError('No pudimos agregar el día.')
    }
  }

  async function handleDeleteDay(dayId: string) {
    setError(null)
    try {
      await deleteRoutineDay(dayId)
      if (openDayId === dayId) {
        setOpenDayId(null)
        setDayDetail(null)
      }
      await loadRoutine()
    } catch {
      setError('No pudimos borrar el día.')
    }
  }

  async function handleAddExercise(exerciseId: string) {
    if (!openDayId) return
    setError(null)
    try {
      await addExerciseToDay(openDayId, exerciseId)
      setShowPicker(false)
      await loadDayDetail(openDayId)
    } catch {
      setError('No pudimos agregar el ejercicio.')
    }
  }

  async function handleRemoveExercise(routineDayExerciseId: string) {
    if (!openDayId) return
    setError(null)
    try {
      await removeExerciseFromDay(routineDayExerciseId)
      await loadDayDetail(openDayId)
    } catch {
      setError('No pudimos quitar el ejercicio.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!routine) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  const openDay = days.find((day) => day.id === openDayId)

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{routine.name}</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Input
          placeholder="Nombre del nuevo día (ej. Día 1)"
          value={newDayName}
          onChange={(e) => setNewDayName(e.target.value)}
        />
        <Button type="button" onClick={handleAddDay}>
          Agregar día
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {days.map((day) => (
          <Card key={day.id}>
            <button
              type="button"
              onClick={() => handleOpenDay(day.id)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="font-medium">{day.name}</span>
              <span className="text-sm text-muted-foreground">›</span>
            </button>
          </Card>
        ))}
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no agregaste ningún día.</p>
        )}
      </div>

      <Sheet open={openDayId !== null} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{openDay?.name}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Borrar este día</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openDayId && handleDeleteDay(openDayId)}
              >
                Borrar día
              </Button>
            </div>

            {dayDetail?.exercises.map((exercise) => (
              <div key={exercise.id} className="rounded-md border">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedExerciseId((prev) => (prev === exercise.id ? null : exercise.id))
                  }
                  className="flex w-full items-center justify-between p-3 text-left"
                >
                  <span className="text-sm font-medium">{exercise.exerciseName}</span>
                  <span className="text-xs text-muted-foreground">
                    {exercise.plannedSets.length} series
                  </span>
                </button>
                {expandedExerciseId === exercise.id && (
                  <div className="border-t p-3">
                    <PlannedSetsEditor
                      routineDayExerciseId={exercise.id}
                      initialSets={exercise.plannedSets}
                      onSaved={() => openDayId && loadDayDetail(openDayId)}
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <Link
                        href={`/rutina/historial/${exercise.exerciseId}`}
                        className="text-xs underline"
                      >
                        Ver historial
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExercise(exercise.id)}
                      >
                        Quitar ejercicio
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {showPicker ? (
              <ExercisePicker onSelect={(exercise) => handleAddExercise(exercise.id)} />
            ) : (
              <Button type="button" variant="outline" onClick={() => setShowPicker(true)}>
                Agregar ejercicio
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

Nota: se preserva el link "Ver historial" hacia `/rutina/historial/[exerciseId]` (antes estaba en el nombre del ejercicio, ahora el nombre del ejercicio abre el editor de series inline dentro de la hoja).

- [ ] **Step 3: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la ruta `/rutina/mis-rutinas/[routineId]` sigue presente.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: rewrite routine editor as day list + bottom sheet"
```

---

## Fuera de este plan

- Que las tarjetas/filas de otras pantallas del módulo (no tocadas acá) sean completamente táctiles — Feature 2
- Pulir la interacción exacta de colapso/expansión ejercicio→series dentro de la hoja — Feature 3
- Verificación en vivo con el usuario (build/tests ya cubren esto localmente; no hay cambios de infraestructura en esta feature)
- Merge de `feat-layouts-entrenar-editor` a `main` (vía `superpowers:finishing-a-development-branch`)

# Feature 7 — Progreso por día de rutina + ejercicio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar el historial y la sugerencia de progresión de un ejercicio por el día de rutina en el que se registró, en vez de mezclar todas las apariciones del ejercicio sin importar el día. Sin migración de datos — el campo `routine_day_id` ya existe y ya está poblado.

**Architecture:** `listSessionsForExercise` se extiende para traer también `routineDayId`/`routineDayName` de cada sesión (mismo patrón de extensión ya usado en Feature 6 para `note`) → dos funciones puras nuevas con TDD (`filterSessionsForRoutineDay`, `groupSessionsByRoutineDay`) en `entrenar-flow.ts` → la pantalla de entrenar filtra el historial al día actual antes de calcular último peso, sugerencia y nota → la pantalla de historial general agrupa el historial completo en un bloque por día de rutina.

**Tech Stack:** Next.js App Router + TypeScript, Supabase (Postgres + RLS), Vitest.

## Global Constraints

- No hay migración de base de datos en esta feature — `workout_sessions.routine_day_id` ya existe y ya está poblado desde el esquema inicial.
- No se toca `progression-suggestion.ts` — `suggestProgressionForExercise` sigue recibiendo `pastSessions` como parámetro, agnóstico de que ahora viene pre-filtrado por día.
- El comentario de Feature 6 también queda acotado al día de rutina (misma lista `pastSessions` filtrada alimenta último peso, sugerencia y nota — decisión confirmada con el usuario, una sola ruta de datos en vez de dos paralelas).
- `groupSessionsByRoutineDay` asume que su input ya viene ordenado descendente por `sessionDate` (la garantía que ya da `listSessionsForExercise`) — bajo esa precondición, el orden de los grupos resultantes queda correcto sin sort adicional.
- Sesiones con `routineDayId: null` (día de rutina borrado) se agrupan bajo el label `"Otros registros"`.
- TDD real (test primero, rojo, verde) para ambas funciones puras nuevas, incluyendo el caso explícito del bug reportado: mismo ejercicio, dos días de rutina distintos, sugerencias independientes.

---

### Task 1: Capa de datos — `listSessionsForExercise` con `routineDayId`/`routineDayName`

**Files:**
- Modify: `src/lib/rutina/sessions-api.ts`

**Interfaces:**
- Produces: `listSessionsForExercise(exerciseId: string): Promise<{ sessionId: string; sessionDate: string; routineDayId: string | null; routineDayName: string | null; note: string | null; sets: {...}[] }[]>`, consumida por Task 2 y Task 3.

- [ ] **Step 1: Extender el `select` de ambas consultas internas**

En `listSessionsForExercise`, cambiar el `select` de la consulta a `logged_sets`:

```ts
  const { data: setsData, error: setsError } = await supabase
    .from('logged_sets')
    .select(
      'set_number, actual_reps, actual_weight, rpe, workout_session_id, workout_sessions(session_date, routine_day_id, routine_days(name))'
    )
    .eq('exercise_id', exerciseId)
    .order('set_number')
```

Y el `select` de la consulta a `exercise_notes`:

```ts
  const { data: notesData, error: notesError } = await supabase
    .from('exercise_notes')
    .select('note, workout_session_id, workout_sessions(session_date, routine_day_id, routine_days(name))')
    .eq('exercise_id', exerciseId)
```

- [ ] **Step 2: Actualizar el tipo de retorno y el tipo del `Map` interno**

Reemplazar la firma de la función:

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
> {
```

Y el tipo del `Map`:

```ts
  const sessionMap = new Map<
    string,
    {
      sessionDate: string
      routineDayId: string | null
      routineDayName: string | null
      note: string | null
      sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[]
    }
  >()
```

- [ ] **Step 3: Extraer `routineDayId`/`routineDayName` en ambos loops de merge**

En el loop que procesa `rows` (sets), reemplazar la extracción de `sessionDate` y la creación de entrada nueva:

```ts
  for (const row of rows) {
    const sessionMeta = row.workout_sessions as unknown as {
      session_date: string
      routine_day_id: string | null
      routine_days: { name: string } | null
    } | null
    const sessionDate = sessionMeta?.session_date ?? ''
    const routineDayId = sessionMeta?.routine_day_id ?? null
    const routineDayName = sessionMeta?.routine_days?.name ?? null
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
      sessionMap.set(row.workout_session_id, { sessionDate, routineDayId, routineDayName, note: null, sets: [set] })
    }
  }
```

Y en el loop que procesa `notesData`:

```ts
  for (const row of notesData ?? []) {
    const sessionMeta = row.workout_sessions as unknown as {
      session_date: string
      routine_day_id: string | null
      routine_days: { name: string } | null
    } | null
    const sessionDate = sessionMeta?.session_date ?? ''
    const routineDayId = sessionMeta?.routine_day_id ?? null
    const routineDayName = sessionMeta?.routine_days?.name ?? null
    const existing = sessionMap.get(row.workout_session_id)

    if (existing) {
      existing.note = row.note
    } else {
      sessionMap.set(row.workout_session_id, { sessionDate, routineDayId, routineDayName, note: row.note, sets: [] })
    }
  }
```

El `return` final (map + sort) no cambia — sigue siendo `Array.from(sessionMap.entries()).map(([sessionId, value]) => ({ sessionId, ...value })).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compila limpio. `src/app/(app)/rutina/historial/[exerciseId]/page.tsx` puede seguir compilando sin tocarse en esta tarea (no referencia `routineDayId`/`routineDayName` todavía — eso es Task 3), igual que no se rompió con el campo `note` agregado en Feature 6.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rutina/sessions-api.ts
git commit -m "feat: extender listSessionsForExercise con día de rutina de cada sesión"
```

---

### Task 2: Lógica pura con TDD — `filterSessionsForRoutineDay` y `groupSessionsByRoutineDay`

**Files:**
- Modify: `src/lib/rutina/entrenar-flow.ts`
- Test: `src/lib/rutina/entrenar-flow.test.ts`

**Interfaces:**
- Consumes: la forma de retorno de `listSessionsForExercise` de Task 1 (campos `routineDayId`, `routineDayName`).
- Produces:
  - `filterSessionsForRoutineDay<T extends { routineDayId: string | null }>(sessions: T[], routineDayId: string): T[]`, consumida por Task 3.
  - `RoutineDayGroup<T>` y `groupSessionsByRoutineDay<T extends { routineDayId: string | null; routineDayName: string | null }>(sessions: T[]): RoutineDayGroup<T>[]`, consumida por Task 3.

- [ ] **Step 1: Escribir los tests fallidos de `filterSessionsForRoutineDay`**

Agregar al final de `src/lib/rutina/entrenar-flow.test.ts`. Primero actualizar el import de la línea 2:

```ts
import {
  flattenPlannedSets,
  findFirstUnsavedIndex,
  resolveInitialNote,
  filterSessionsForRoutineDay,
  groupSessionsByRoutineDay,
} from './entrenar-flow'
```

Y agregar:

```ts
describe('filterSessionsForRoutineDay', () => {
  it('devuelve vacío si no hay sesiones', () => {
    expect(filterSessionsForRoutineDay([], 'day-a')).toEqual([])
  })

  it('devuelve vacío si ninguna sesión pertenece al día pedido', () => {
    const sessions = [{ id: 1, routineDayId: 'day-b' }]
    expect(filterSessionsForRoutineDay(sessions, 'day-a')).toEqual([])
  })

  it('filtra sesiones de múltiples días a solo las del día pedido', () => {
    const sessions = [
      { id: 1, routineDayId: 'day-a' },
      { id: 2, routineDayId: 'day-b' },
      { id: 3, routineDayId: 'day-a' },
    ]
    expect(filterSessionsForRoutineDay(sessions, 'day-a')).toEqual([
      { id: 1, routineDayId: 'day-a' },
      { id: 3, routineDayId: 'day-a' },
    ])
  })

  it('excluye sesiones sin día de rutina asociado (routineDayId null)', () => {
    const sessions = [
      { id: 1, routineDayId: 'day-a' },
      { id: 2, routineDayId: null },
    ]
    expect(filterSessionsForRoutineDay(sessions, 'day-a')).toEqual([{ id: 1, routineDayId: 'day-a' }])
  })
})

describe('filterSessionsForRoutineDay + suggestProgressionForExercise: caso reportado por el usuario', () => {
  it('el mismo ejercicio en dos días de rutina distintos calcula sugerencias independientes, sin contaminarse', () => {
    const allSessions = [
      {
        sessionId: 'session-dia-b-reciente',
        routineDayId: 'dia-b',
        sets: [{ setNumber: 1, actualReps: 4, actualWeight: 40, rpe: 'al_limite' as const }],
      },
      {
        sessionId: 'session-dia-a-reciente',
        routineDayId: 'dia-a',
        sets: [{ setNumber: 1, actualReps: 10, actualWeight: 30, rpe: 'facil' as const }],
      },
    ]

    const plannedSets = [{ setNumber: 1, targetReps: 10 }]

    const sugerenciaDiaA = suggestProgressionForExercise(
      'general',
      'mancuernas',
      plannedSets,
      filterSessionsForRoutineDay(allSessions, 'dia-a')
    )
    const sugerenciaDiaB = suggestProgressionForExercise(
      'general',
      'mancuernas',
      plannedSets,
      filterSessionsForRoutineDay(allSessions, 'dia-b')
    )

    // Día A: cumplió el objetivo (10 reps) con RPE fácil — no baja, y con una sola sesión buena
    // (general necesita 2) todavía no sube: mantiene.
    expect(sugerenciaDiaA[1]).toEqual({ action: 'mantener', suggestedWeight: 30 })

    // Día B: no cumplió el objetivo (4 de 10 reps) con RPE al límite — baja, independientemente
    // de lo que pasó en el Día A con el mismo ejercicio.
    expect(sugerenciaDiaB[1]).toEqual({ action: 'bajar', suggestedWeight: 38 })
  })
})
```

Agregar también el import de `suggestProgressionForExercise` al inicio del archivo:

```ts
import { suggestProgressionForExercise } from './progression-suggestion'
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/rutina/entrenar-flow.test.ts`
Expected: FAIL — `filterSessionsForRoutineDay is not exported` o similar (todavía no existe).

- [ ] **Step 3: Implementar `filterSessionsForRoutineDay`**

Agregar al final de `src/lib/rutina/entrenar-flow.ts`:

```ts
export function filterSessionsForRoutineDay<T extends { routineDayId: string | null }>(
  sessions: T[],
  routineDayId: string
): T[] {
  return sessions.filter((session) => session.routineDayId === routineDayId)
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/rutina/entrenar-flow.test.ts`
Expected: PASS — todos los tests, incluidos los 5 nuevos de `filterSessionsForRoutineDay` (4 casos + el caso de integración con `suggestProgressionForExercise`).

- [ ] **Step 5: Escribir los tests fallidos de `groupSessionsByRoutineDay`**

Agregar al final de `src/lib/rutina/entrenar-flow.test.ts`:

```ts
describe('groupSessionsByRoutineDay', () => {
  it('devuelve vacío si no hay sesiones', () => {
    expect(groupSessionsByRoutineDay([])).toEqual([])
  })

  it('agrupa sesiones del mismo día de rutina en un solo grupo', () => {
    const sessions = [
      { sessionId: 's1', routineDayId: 'dia-a', routineDayName: 'Empuje' },
      { sessionId: 's2', routineDayId: 'dia-a', routineDayName: 'Empuje' },
    ]
    expect(groupSessionsByRoutineDay(sessions)).toEqual([
      {
        routineDayId: 'dia-a',
        routineDayName: 'Empuje',
        sessions: [
          { sessionId: 's1', routineDayId: 'dia-a', routineDayName: 'Empuje' },
          { sessionId: 's2', routineDayId: 'dia-a', routineDayName: 'Empuje' },
        ],
      },
    ])
  })

  it('separa sesiones de días de rutina distintos en grupos distintos, preservando el orden de la entrada (más reciente primero)', () => {
    const sessions = [
      { sessionId: 's1', routineDayId: 'dia-b', routineDayName: 'Tirón' },
      { sessionId: 's2', routineDayId: 'dia-a', routineDayName: 'Empuje' },
      { sessionId: 's3', routineDayId: 'dia-b', routineDayName: 'Tirón' },
    ]
    const result = groupSessionsByRoutineDay(sessions)
    expect(result).toHaveLength(2)
    expect(result[0].routineDayId).toBe('dia-b')
    expect(result[0].sessions).toHaveLength(2)
    expect(result[1].routineDayId).toBe('dia-a')
    expect(result[1].sessions).toHaveLength(1)
  })

  it('agrupa sesiones sin día de rutina asociado bajo "Otros registros"', () => {
    const sessions = [{ sessionId: 's1', routineDayId: null, routineDayName: null }]
    expect(groupSessionsByRoutineDay(sessions)).toEqual([
      {
        routineDayId: null,
        routineDayName: 'Otros registros',
        sessions: [{ sessionId: 's1', routineDayId: null, routineDayName: null }],
      },
    ])
  })
})
```

- [ ] **Step 6: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/rutina/entrenar-flow.test.ts`
Expected: FAIL — `groupSessionsByRoutineDay is not exported`.

- [ ] **Step 7: Implementar `groupSessionsByRoutineDay`**

Agregar al final de `src/lib/rutina/entrenar-flow.ts`:

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

- [ ] **Step 8: Correr todos los tests y verificar que pasan**

Run: `npx vitest run`
Expected: PASS — todos los tests del proyecto, sin regresiones (deberían ser 53 + 5 (`filterSessionsForRoutineDay`) + 4 (`groupSessionsByRoutineDay`) = 62 tests).

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: compila limpio.

- [ ] **Step 10: Commit**

```bash
git add src/lib/rutina/entrenar-flow.ts src/lib/rutina/entrenar-flow.test.ts
git commit -m "feat: agregar filterSessionsForRoutineDay y groupSessionsByRoutineDay con TDD"
```

---

### Task 3: Integración en las pantallas de entrenar e historial

**Files:**
- Modify: `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`
- Modify: `src/app/(app)/rutina/historial/[exerciseId]/page.tsx`

**Interfaces:**
- Consumes: `listSessionsForExercise` (con `routineDayId`/`routineDayName`) de Task 1, `filterSessionsForRoutineDay` y `groupSessionsByRoutineDay` de Task 2.

- [ ] **Step 1: Pantalla de entrenar — importar `filterSessionsForRoutineDay`**

En `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`, actualizar el import de `entrenar-flow`:

```ts
import {
  flattenPlannedSets,
  findFirstUnsavedIndex,
  resolveInitialNote,
  filterSessionsForRoutineDay,
  type FlatPlannedSet,
} from '@/lib/rutina/entrenar-flow'
```

- [ ] **Step 2: Filtrar el historial al día actual antes de calcular `pastSessions`**

Dentro del `uniqueExerciseIds.forEach((exerciseId, i) => { ... })` en `init()`, reemplazar:

```ts
        uniqueExerciseIds.forEach((exerciseId, i) => {
          const allSessions = histories[i]
          const pastSessions = allSessions.filter((s) => s.sessionId !== session.id)
          const mostRecent = pastSessions[0]
          if (mostRecent) {
            for (const set of mostRecent.sets) {
              lastValues[`${exerciseId}-${set.setNumber}`] = {
                actualReps: set.actualReps,
                actualWeight: set.actualWeight,
              }
            }
          }

          const currentSessionEntry = allSessions.find((s) => s.sessionId === session.id)
```

por:

```ts
        uniqueExerciseIds.forEach((exerciseId, i) => {
          const allSessions = histories[i]
          const sessionsForThisDay = filterSessionsForRoutineDay(allSessions, dayId)
          const pastSessions = sessionsForThisDay.filter((s) => s.sessionId !== session.id)
          const mostRecent = pastSessions[0]
          if (mostRecent) {
            for (const set of mostRecent.sets) {
              lastValues[`${exerciseId}-${set.setNumber}`] = {
                actualReps: set.actualReps,
                actualWeight: set.actualWeight,
              }
            }
          }

          const currentSessionEntry = sessionsForThisDay.find((s) => s.sessionId === session.id)
```

El resto del `forEach` (cálculo de `notes[exerciseId]`, `suggestionsForExercise`) queda igual — ya usa `pastSessions`, `mostRecent` y `currentSessionEntry`, que ahora vienen filtrados por día automáticamente.

- [ ] **Step 3: Build de la pantalla de entrenar**

Run: `npm run build`
Expected: compila limpio.

- [ ] **Step 4: Pantalla de historial — leer el archivo actual antes de editarlo**

Leer `src/app/(app)/rutina/historial/[exerciseId]/page.tsx` para confirmar contra qué versión exacta aplicar el Step 5 (el contenido de referencia de este plan es el de antes de esta tarea; si cambió por alguna razón, adaptar la edición al archivo real sin alterar el comportamiento pedido).

- [ ] **Step 5: Reescribir la pantalla de historial para agrupar por día de rutina**

Reemplazar el contenido completo de `src/app/(app)/rutina/historial/[exerciseId]/page.tsx` por:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExerciseProgressionChart } from '@/components/rutina/exercise-progression-chart'
import { listSessionsForExercise } from '@/lib/rutina/sessions-api'
import { buildProgressionSeries } from '@/lib/rutina/progression'
import { groupSessionsByRoutineDay } from '@/lib/rutina/entrenar-flow'

export default function HistorialEjercicioPage() {
  const params = useParams<{ exerciseId: string }>()
  const exerciseId = params.exerciseId

  const [sessions, setSessions] = useState<
    {
      sessionId: string
      sessionDate: string
      routineDayId: string | null
      routineDayName: string | null
      sets: { setNumber: number; actualReps: number; actualWeight: number | null }[]
    }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSessions() {
      setIsLoading(true)
      try {
        const data = await listSessionsForExercise(exerciseId)
        setSessions(data)
      } catch {
        setError('No pudimos cargar el historial.')
      } finally {
        setIsLoading(false)
      }
    }

    loadSessions()
  }, [exerciseId])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  const groups = groupSessionsByRoutineDay(sessions)

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Historial</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no registraste este ejercicio.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const progressionData = buildProgressionSeries(
              group.sessions.map((session) => ({
                sessionDate: session.sessionDate,
                sets: session.sets.map((set) => ({
                  actualReps: set.actualReps,
                  actualWeight: set.actualWeight,
                })),
              }))
            )

            return (
              <div key={group.routineDayId ?? 'sin-dia'} className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-muted-foreground">{group.routineDayName}</h2>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Evolución del volumen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ExerciseProgressionChart data={progressionData} />
                  </CardContent>
                </Card>
                <div className="flex flex-col gap-3">
                  {group.sessions.map((session) => (
                    <Card key={session.sessionId}>
                      <CardHeader>
                        <CardTitle className="text-sm font-normal text-muted-foreground">
                          {session.sessionDate}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-1">
                        {session.sets.map((set) => (
                          <p key={set.setNumber} className="text-sm">
                            Serie {set.setNumber}: {set.actualReps} reps
                            {set.actualWeight != null ? ` @ ${set.actualWeight}kg` : ''}
                          </p>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: compila limpio.

- [ ] **Step 7: Smoke manual**

Correr `npm run dev` y verificar en el navegador (con sesión logueada):
1. En un ejercicio que aparezca en dos días distintos de una rutina, entrenar una serie en el Día A y otra en el Día B con pesos/reps bien distintos.
2. En la pantalla de entrenar de cada día, confirmar que "último" y la sugerencia de progresión de ese ejercicio reflejan solo el historial de ESE día, no del otro.
3. Confirmar que la nota (Feature 6) escrita en el Día A no aparece precargada al entrar al mismo ejercicio en el Día B.
4. Entrar a `/rutina/historial/<exerciseId>` de ese ejercicio y confirmar que aparecen dos bloques separados (uno por día de rutina), cada uno con su propio gráfico y lista.
5. Para un ejercicio que solo aparece en un día, confirmar que el historial sigue mostrando un solo bloque, sin cambios visibles de comportamiento respecto a antes.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/rutina/entrenar/[dayId]/page.tsx" "src/app/(app)/rutina/historial/[exerciseId]/page.tsx"
git commit -m "feat: separar historial y sugerencia por día de rutina en las pantallas de entrenar e historial"
```

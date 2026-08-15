# Feature 6 — Comentario en el registro del ejercicio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una casilla de comentario de texto libre por ejercicio y por sesión de entrenamiento, visible en la pantalla de entrenar debajo del bloque de Esfuerzo, precargada con el comentario de la sesión anterior y editable sin afectar el historial.

**Architecture:** Tabla nueva `exercise_notes` (RLS igual que `logged_sets`) → extensión de `listSessionsForExercise` para traer el comentario de cada sesión + función nueva `saveExerciseNote` en `sessions-api.ts` → función pura `resolveInitialNote` en `entrenar-flow.ts` (TDD) para decidir qué comentario precargar → estado y UI nuevos en la pantalla de entrenar, guardado junto con `saveLoggedSet` en `handleConfirm`.

**Tech Stack:** Next.js App Router + TypeScript, Supabase (Postgres + RLS), Vitest.

## Global Constraints

- Un comentario es por `(workout_session_id, exercise_id)`, no por serie — constraint `unique (workout_session_id, exercise_id)` en la tabla.
- El comentario es puramente informativo: no debe tocarse `progression-suggestion.ts` en esta feature.
- El comentario se muestra **debajo del bloque de Esfuerzo**, antes del botón "Confirmar y siguiente →".
- El guardado ocurre dentro de `handleConfirm()`, junto al `saveLoggedSet` ya existente — no se agrega ningún mecanismo de guardado nuevo (nada de `onBlur`/debounce).
- Precarga: si la sesión actual ya tiene un comentario no vacío guardado, se usa ese; si no, se usa el de la sesión pasada más reciente (`pastSessions[0]`); si ninguno, vacío.
- RLS en `exercise_notes` sigue exactamente el patrón de `logged_sets`: 4 policies (select/insert/update/delete) que validan `user_id` a través de un join con `workout_sessions`, más el `grant` explícito a `authenticated` (el proyecto tiene "Automatically expose new tables" deshabilitado).

---

### Task 1: Migración `exercise_notes`

**Files:**
- Create: `supabase/migrations/20260815010000_add_exercise_notes.sql`

**Interfaces:**
- Produces: tabla `public.exercise_notes(id, workout_session_id, exercise_id, note, created_at, updated_at)` con constraint `unique (workout_session_id, exercise_id)`, consumida por Task 2.

- [ ] **Step 1: Escribir la migración**

```sql
create table public.exercise_notes (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_session_id, exercise_id)
);

alter table public.exercise_notes enable row level security;

create policy "Users can view exercise notes of their own sessions"
  on public.exercise_notes for select
  using (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = exercise_notes.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can create exercise notes on their own sessions"
  on public.exercise_notes for insert
  with check (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = exercise_notes.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can update exercise notes of their own sessions"
  on public.exercise_notes for update
  using (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = exercise_notes.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can delete exercise notes of their own sessions"
  on public.exercise_notes for delete
  using (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = exercise_notes.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.exercise_notes to authenticated;
```

- [ ] **Step 2: Verificar que el proyecto sigue buildeando (la migración no se aplica en esta tarea, solo se escribe el archivo)**

Run: `npm run build`
Expected: build limpio, sin errores (esta migración todavía no toca código TypeScript).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260815010000_add_exercise_notes.sql
git commit -m "feat: agregar tabla exercise_notes con RLS"
```

---

### Task 2: Capa de datos — `resolveInitialNote` (TDD), `listSessionsForExercise` extendido, `saveExerciseNote`

**Files:**
- Modify: `src/lib/rutina/entrenar-flow.ts`
- Test: `src/lib/rutina/entrenar-flow.test.ts`
- Modify: `src/lib/rutina/sessions-api.ts`

**Interfaces:**
- Consumes: tabla `exercise_notes` de Task 1.
- Produces:
  - `resolveInitialNote(currentSessionNote: string | undefined, mostRecentPastNote: string | undefined): string`, consumida por Task 3.
  - `listSessionsForExercise(exerciseId: string): Promise<{ sessionId: string; sessionDate: string; note: string; sets: {...}[] }[]>` (tipo de retorno con `note` agregado), consumida por Task 3.
  - `saveExerciseNote(input: { workoutSessionId: string; exerciseId: string; note: string }): Promise<void>`, consumida por Task 3.

- [ ] **Step 1: Escribir los tests fallidos de `resolveInitialNote`**

Agregar al final de `src/lib/rutina/entrenar-flow.test.ts`:

```ts
import { flattenPlannedSets, findFirstUnsavedIndex, resolveInitialNote } from './entrenar-flow'
```

(reemplaza el import existente en la línea 2 por este, agregando `resolveInitialNote`)

```ts
describe('resolveInitialNote', () => {
  it('usa el comentario de la sesión actual si no está vacío', () => {
    expect(resolveInitialNote('subir', 'polea lejos')).toBe('subir')
  })

  it('usa el comentario de la sesión pasada más reciente si la actual está vacía', () => {
    expect(resolveInitialNote('', 'polea lejos')).toBe('polea lejos')
  })

  it('usa el comentario de la sesión pasada más reciente si la actual no existe', () => {
    expect(resolveInitialNote(undefined, 'polea lejos')).toBe('polea lejos')
  })

  it('devuelve vacío si ninguna de las dos tiene comentario', () => {
    expect(resolveInitialNote('', '')).toBe('')
    expect(resolveInitialNote(undefined, undefined)).toBe('')
  })

  it('devuelve vacío si el comentario de la sesión pasada es solo espacios', () => {
    expect(resolveInitialNote(undefined, '   ')).toBe('')
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/rutina/entrenar-flow.test.ts`
Expected: FAIL — `resolveInitialNote is not exported` o similar (la función todavía no existe).

- [ ] **Step 3: Implementar `resolveInitialNote`**

Agregar al final de `src/lib/rutina/entrenar-flow.ts`:

```ts
export function resolveInitialNote(
  currentSessionNote: string | undefined,
  mostRecentPastNote: string | undefined
): string {
  if (currentSessionNote && currentSessionNote.trim() !== '') return currentSessionNote
  if (mostRecentPastNote && mostRecentPastNote.trim() !== '') return mostRecentPastNote
  return ''
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/rutina/entrenar-flow.test.ts`
Expected: PASS — todos los tests, incluidos los 5 nuevos de `resolveInitialNote`.

- [ ] **Step 5: Extender `listSessionsForExercise` para incluir `note`**

En `src/lib/rutina/sessions-api.ts`, reemplazar la función `listSessionsForExercise` completa (líneas 115-162 en la versión actual) por:

```ts
export async function listSessionsForExercise(exerciseId: string): Promise<
  {
    sessionId: string
    sessionDate: string
    note: string
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

  const { data: notesData, error: notesError } = await supabase
    .from('exercise_notes')
    .select('note, workout_session_id, workout_sessions(session_date)')
    .eq('exercise_id', exerciseId)

  if (notesError) throw notesError

  const rows = setsData ?? []

  const sessionMap = new Map<
    string,
    {
      sessionDate: string
      note: string
      sets: { setNumber: number; actualReps: number; actualWeight: number | null; rpe: Rpe }[]
    }
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
      sessionMap.set(row.workout_session_id, { sessionDate, note: '', sets: [set] })
    }
  }

  for (const row of notesData ?? []) {
    const sessionDate =
      (row.workout_sessions as unknown as { session_date: string })?.session_date ?? ''
    const existing = sessionMap.get(row.workout_session_id)

    if (existing) {
      existing.note = row.note
    } else {
      sessionMap.set(row.workout_session_id, { sessionDate, note: row.note, sets: [] })
    }
  }

  return Array.from(sessionMap.entries())
    .map(([sessionId, value]) => ({ sessionId, ...value }))
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
}
```

- [ ] **Step 6: Agregar `saveExerciseNote`**

Al final de `src/lib/rutina/sessions-api.ts`, agregar:

```ts
export async function saveExerciseNote(input: {
  workoutSessionId: string
  exerciseId: string
  note: string
}): Promise<void> {
  const supabase = createClient()

  const { data: existing, error: findError } = await supabase
    .from('exercise_notes')
    .select('id')
    .eq('workout_session_id', input.workoutSessionId)
    .eq('exercise_id', input.exerciseId)
    .maybeSingle()

  if (findError) throw findError

  if (existing) {
    const { error } = await supabase
      .from('exercise_notes')
      .update({ note: input.note })
      .eq('id', existing.id)

    if (error) throw error
    return
  }

  const { error } = await supabase.from('exercise_notes').insert({
    workout_session_id: input.workoutSessionId,
    exercise_id: input.exerciseId,
    note: input.note,
  })

  if (error) throw error
}
```

- [ ] **Step 7: Build y test completo**

Run: `npm run build && npx vitest run`
Expected: build limpio; todos los tests pasan (los existentes de `progression-suggestion.test.ts` y `entrenar-flow.test.ts` sin regresiones, más los 5 nuevos de `resolveInitialNote`).

Nota: `src/app/(app)/rutina/historial/[exerciseId]/page.tsx` ya consume `listSessionsForExercise` tipando localmente `{ sessionId, sessionDate, sets }[]` sin `note` — el campo extra no rompe el build (TypeScript no aplica excess-property-check sobre una variable, solo sobre literales), no hace falta tocar ese archivo en esta tarea.

- [ ] **Step 8: Commit**

```bash
git add src/lib/rutina/entrenar-flow.ts src/lib/rutina/entrenar-flow.test.ts src/lib/rutina/sessions-api.ts
git commit -m "feat: extender listSessionsForExercise con comentario y agregar saveExerciseNote"
```

---

### Task 3: UI en la pantalla de entrenar

**Files:**
- Modify: `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`

**Interfaces:**
- Consumes: `resolveInitialNote`, `listSessionsForExercise` (con `note`), `saveExerciseNote` de Task 2.

- [ ] **Step 1: Agregar imports**

En `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`, actualizar los imports existentes:

```ts
import { Input } from '@/components/ui/input'
```

(agregar esta línea junto a los demás imports de `@/components/ui/*`)

```ts
import {
  getOrCreateWorkoutSession,
  getLoggedSetsForSession,
  saveLoggedSet,
  saveExerciseNote,
  listSessionsForExercise,
} from '@/lib/rutina/sessions-api'
import {
  flattenPlannedSets,
  findFirstUnsavedIndex,
  resolveInitialNote,
  type FlatPlannedSet,
} from '@/lib/rutina/entrenar-flow'
```

(reemplaza los imports existentes de `sessions-api` y `entrenar-flow` por estos)

- [ ] **Step 2: Agregar estado `notesByExercise`**

Junto a las demás declaraciones de estado (después de `const [suggestBySet, setSuggestBySet] = useState<Record<string, ProgressionSuggestion>>({})`):

```ts
  const [notesByExercise, setNotesByExercise] = useState<Record<string, string>>({})
```

- [ ] **Step 3: Calcular las notas iniciales dentro de `init()`**

Dentro del `uniqueExerciseIds.forEach((exerciseId, i) => { ... })` en `init()`, reemplazar el cuerpo actual:

```ts
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

por:

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
          notes[exerciseId] = resolveInitialNote(currentSessionEntry?.note, mostRecent?.note)

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

Justo antes de ese `uniqueExerciseIds.forEach(...)`, junto a la declaración de `const lastValues: Record<string, LastValue> = {}` y `const suggestions: Record<string, ProgressionSuggestion> = {}`, agregar:

```ts
        const notes: Record<string, string> = {}
```

Y en el bloque final donde se llama a los `set*` (junto a `setSuggestBySet(suggestions)`), agregar:

```ts
        setNotesByExercise(notes)
```

- [ ] **Step 4: Agregar el handler `setNote`**

Junto a las demás funciones de handler (después de `function setRpe(rpe: Rpe) { ... }`):

```ts
  function setNote(value: string) {
    const current = flatSets[currentIndex]
    if (!current) return
    setNotesByExercise((prev) => ({ ...prev, [current.exerciseId]: value }))
  }
```

- [ ] **Step 5: Guardar la nota en `handleConfirm`**

En `handleConfirm()`, dentro del bloque `try`, después del `await saveLoggedSet({...})` y antes de `setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: false, isSaved: true } }))`, agregar:

```ts
      await saveExerciseNote({
        workoutSessionId: sessionId,
        exerciseId: current.exerciseId,
        note: notesByExercise[current.exerciseId] ?? '',
      })
```

- [ ] **Step 6: Renderizar el campo de nota debajo de Esfuerzo**

Dentro del `<div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">`, después del bloque de Esfuerzo (el `<div>` que contiene `<p className="mb-2 text-sm text-muted-foreground">Esfuerzo</p>` y `.rpe-row`) y antes del cierre de ese div contenedor, agregar:

```tsx
        <div className="w-full max-w-xs text-left">
          <label htmlFor="exercise-note" className="mb-2 block text-sm text-muted-foreground">
            Nota (opcional)
          </label>
          <Input
            id="exercise-note"
            type="text"
            placeholder="ej. 'subir', 'polea lejos'..."
            value={notesByExercise[current.exerciseId] ?? ''}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build limpio, sin errores de tipo.

- [ ] **Step 8: Smoke manual**

Correr `npm run dev`, entrar a un día de rutina en `/rutina/entrenar/<dayId>`, verificar:
1. El campo "Nota" aparece debajo de Esfuerzo, antes de "Confirmar y siguiente →".
2. Escribir una nota, confirmar la serie, y verificar que la nota persiste al navegar a la siguiente serie del mismo ejercicio.
3. Terminar la sesión, volver a entrar al mismo día (nueva sesión si es otro día calendario, o la misma si es el mismo día) y verificar que la nota de la sesión pasada aparece precargada.
4. Verificar que la sugerencia de progresión (Feature 5) sigue funcionando sin cambios.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/rutina/entrenar/[dayId]/page.tsx"
git commit -m "feat: agregar campo de comentario a la pantalla de entrenar"
```

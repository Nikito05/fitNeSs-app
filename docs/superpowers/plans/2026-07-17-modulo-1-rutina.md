# Módulo 1 — Rutina de gimnasio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ciclo completo de rutina de gimnasio: catálogo de ejercicios, armado de rutinas semanales con series piramidales, registro del entrenamiento real serie por serie, e historial + gráfico de progresión por ejercicio.

**Architecture:** 6 tablas nuevas con RLS sobre el esquema de Fase 0 (`profiles`, auth). Capa de acceso a datos por sub-dominio (`src/lib/rutina/{exercises,routines,sessions}-api.ts`), lógica pura de cálculo de volumen/progresión con TDD (`src/lib/rutina/progression.ts`), componentes de UI en `src/components/rutina/`, y 5 rutas bajo `(app)/rutina/*`.

**Tech Stack:** Reutiliza el stack de Fase 0 (Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase vía `@supabase/ssr`, Vitest). Se suma `recharts` vía el componente `chart` de shadcn/ui para el gráfico de progresión.

## Global Constraints

- Package manager: npm únicamente
- **RLS + GRANT obligatorios en toda tabla nueva**: cada migración de este plan incluye tanto las policies de RLS como el `grant ... to authenticated` explícito en el mismo archivo. Lección aprendida en Fase 0: sin el GRANT explícito, una tabla con RLS correcto igual falla con `42501 permission denied` en el Data API, porque este proyecto tiene "Automatically expose new tables" deshabilitado y las tablas se crean por SQL crudo (no por el Table Editor, que sí aplicaría el GRANT solo).
- **Las migraciones de las Tareas 1-3 se escriben como archivos pero NO se aplican contra el proyecto Supabase real durante la ejecución de las tareas de este plan.** Se aplican todas juntas en una fase final de verificación en vivo (fuera de este plan, guiada con el usuario), donde se hace `supabase db push` y se verifica el GRANT de cada tabla nueva con una consulta directa al Data API antes de dar por buena la fase — igual que se hizo en Fase 0.
- Columnas de peso (`target_weight`, `actual_weight`) usan `double precision`, no `numeric` — PostgREST serializa `numeric` como string en el JSON de respuesta, lo que rompería la aritmética en TypeScript (`number | null` en todo el código cliente).
- `logged_sets` no tiene FK a `planned_sets`: el registro real es independiente del objetivo planeado, para no romper el historial si se edita la rutina después.
- Capa de acceso a datos dividida por sub-dominio dentro de la carpeta `rutina/`: `exercises-api.ts`, `routines-api.ts`, `sessions-api.ts` — ningún componente de UI llama a Supabase directamente, siempre a través de estas funciones.
- Todas las pantallas son client components (`'use client'`) con `useState`/`useEffect`, mismo patrón que Fase 0. Sin react-hook-form/zod.
- Rutas nuevas, todas bajo `(app)/rutina/`: `/rutina` (ya existe como placeholder, se reemplaza), `/rutina/mis-rutinas`, `/rutina/mis-rutinas/[routineId]`, `/rutina/entrenar/[dayId]`, `/rutina/historial/[exerciseId]`. No requieren cambios en `src/middleware.ts` (ya protegidas por estar bajo el grupo `(app)`).
- Rama de trabajo: `modulo-1-rutina` (crear desde `main` antes de la Tarea 1)

---

### Task 1: Migración — catálogo de ejercicios

**Files:**
- Create: `supabase/migrations/<timestamp>_init_exercises_catalog.sql`

**Interfaces:**
- Produces: tabla `public.exercises(id, user_id, name, muscle_group, equipment)` — consumida por las Tareas 5, 7, 9, 10.

- [ ] **Step 1: Generar el archivo de migración**

```bash
npx supabase migration new init_exercises_catalog
```
Expected: imprime una ruta tipo `supabase/migrations/20260718..._init_exercises_catalog.sql` — anotá la ruta exacta impresa.

- [ ] **Step 2: Escribir el SQL de la migración**

```sql
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text not null,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "Users can view predefined exercises"
  on public.exercises for select
  using (user_id is null);

create policy "Users can view their own custom exercises"
  on public.exercises for select
  using (auth.uid() = user_id);

create policy "Users can create their own custom exercises"
  on public.exercises for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own custom exercises"
  on public.exercises for update
  using (auth.uid() = user_id);

create policy "Users can delete their own custom exercises"
  on public.exercises for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.exercises to authenticated;

insert into public.exercises (user_id, name, muscle_group, equipment) values
  (null, 'Press banca', 'Pecho', 'Barra'),
  (null, 'Press inclinado con mancuernas', 'Pecho', 'Mancuernas'),
  (null, 'Aperturas con mancuernas', 'Pecho', 'Mancuernas'),
  (null, 'Sentadilla', 'Piernas', 'Barra'),
  (null, 'Prensa de piernas', 'Piernas', 'Máquina'),
  (null, 'Zancadas', 'Piernas', 'Mancuernas'),
  (null, 'Peso muerto', 'Espalda', 'Barra'),
  (null, 'Dominadas', 'Espalda', 'Peso corporal'),
  (null, 'Remo con barra', 'Espalda', 'Barra'),
  (null, 'Jalón al pecho', 'Espalda', 'Máquina'),
  (null, 'Press militar', 'Hombros', 'Barra'),
  (null, 'Elevaciones laterales', 'Hombros', 'Mancuernas'),
  (null, 'Curl de bíceps', 'Brazos', 'Mancuernas'),
  (null, 'Extensión de tríceps', 'Brazos', 'Polea'),
  (null, 'Fondos', 'Brazos', 'Peso corporal'),
  (null, 'Plancha', 'Core', 'Peso corporal'),
  (null, 'Crunch abdominal', 'Core', 'Peso corporal'),
  (null, 'Elevación de talones', 'Piernas', 'Máquina');
```

- [ ] **Step 3: Verificar**

```bash
cat supabase/migrations/*_init_exercises_catalog.sql | head -3
```
Expected: muestra la línea `create table if not exists public.exercises`. No se aplica contra el proyecto remoto en esta tarea (ver Global Constraints).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add exercises catalog migration with RLS and seed data"
```

---

### Task 2: Migración — rutinas, días, ejercicios por día y series objetivo

**Files:**
- Create: `supabase/migrations/<timestamp>_init_rutinas_planning.sql`

**Interfaces:**
- Produces: tablas `public.routines`, `public.routine_days`, `public.routine_day_exercises`, `public.planned_sets` — consumidas por las Tareas 6, 7, 8, 9.
- Consumes: `public.exercises` (Tarea 1).

- [ ] **Step 1: Generar el archivo de migración**

```bash
npx supabase migration new init_rutinas_planning
```

- [ ] **Step 2: Escribir el SQL de la migración**

```sql
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.routines enable row level security;

create policy "Users can view their own routines"
  on public.routines for select
  using (auth.uid() = user_id);

create policy "Users can create their own routines"
  on public.routines for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own routines"
  on public.routines for update
  using (auth.uid() = user_id);

create policy "Users can delete their own routines"
  on public.routines for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.routines to authenticated;

create table if not exists public.routine_days (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  name text not null,
  day_order int not null,
  created_at timestamptz not null default now()
);

alter table public.routine_days enable row level security;

create policy "Users can view days of their own routines"
  on public.routine_days for select
  using (
    exists (
      select 1 from public.routines
      where routines.id = routine_days.routine_id
      and routines.user_id = auth.uid()
    )
  );

create policy "Users can create days on their own routines"
  on public.routine_days for insert
  with check (
    exists (
      select 1 from public.routines
      where routines.id = routine_days.routine_id
      and routines.user_id = auth.uid()
    )
  );

create policy "Users can update days of their own routines"
  on public.routine_days for update
  using (
    exists (
      select 1 from public.routines
      where routines.id = routine_days.routine_id
      and routines.user_id = auth.uid()
    )
  );

create policy "Users can delete days of their own routines"
  on public.routine_days for delete
  using (
    exists (
      select 1 from public.routines
      where routines.id = routine_days.routine_id
      and routines.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.routine_days to authenticated;

-- on delete restrict: no se puede borrar un ejercicio custom que está en uso
-- en una rutina sin sacarlo antes explícitamente de esa rutina.
create table if not exists public.routine_day_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_day_id uuid not null references public.routine_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  exercise_order int not null,
  created_at timestamptz not null default now()
);

alter table public.routine_day_exercises enable row level security;

create policy "Users can view exercises of their own routine days"
  on public.routine_day_exercises for select
  using (
    exists (
      select 1 from public.routine_days
      join public.routines on routines.id = routine_days.routine_id
      where routine_days.id = routine_day_exercises.routine_day_id
      and routines.user_id = auth.uid()
    )
  );

create policy "Users can add exercises to their own routine days"
  on public.routine_day_exercises for insert
  with check (
    exists (
      select 1 from public.routine_days
      join public.routines on routines.id = routine_days.routine_id
      where routine_days.id = routine_day_exercises.routine_day_id
      and routines.user_id = auth.uid()
    )
  );

create policy "Users can update exercises of their own routine days"
  on public.routine_day_exercises for update
  using (
    exists (
      select 1 from public.routine_days
      join public.routines on routines.id = routine_days.routine_id
      where routine_days.id = routine_day_exercises.routine_day_id
      and routines.user_id = auth.uid()
    )
  );

create policy "Users can delete exercises from their own routine days"
  on public.routine_day_exercises for delete
  using (
    exists (
      select 1 from public.routine_days
      join public.routines on routines.id = routine_days.routine_id
      where routine_days.id = routine_day_exercises.routine_day_id
      and routines.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.routine_day_exercises to authenticated;

create table if not exists public.planned_sets (
  id uuid primary key default gen_random_uuid(),
  routine_day_exercise_id uuid not null references public.routine_day_exercises(id) on delete cascade,
  set_number int not null,
  target_reps int not null,
  target_weight double precision,
  created_at timestamptz not null default now()
);

alter table public.planned_sets enable row level security;

create policy "Users can view planned sets of their own routines"
  on public.planned_sets for select
  using (
    exists (
      select 1 from public.routine_day_exercises
      join public.routine_days on routine_days.id = routine_day_exercises.routine_day_id
      join public.routines on routines.id = routine_days.routine_id
      where routine_day_exercises.id = planned_sets.routine_day_exercise_id
      and routines.user_id = auth.uid()
    )
  );

create policy "Users can create planned sets on their own routines"
  on public.planned_sets for insert
  with check (
    exists (
      select 1 from public.routine_day_exercises
      join public.routine_days on routine_days.id = routine_day_exercises.routine_day_id
      join public.routines on routines.id = routine_days.routine_id
      where routine_day_exercises.id = planned_sets.routine_day_exercise_id
      and routines.user_id = auth.uid()
    )
  );

create policy "Users can update planned sets of their own routines"
  on public.planned_sets for update
  using (
    exists (
      select 1 from public.routine_day_exercises
      join public.routine_days on routine_days.id = routine_day_exercises.routine_day_id
      join public.routines on routines.id = routine_days.routine_id
      where routine_day_exercises.id = planned_sets.routine_day_exercise_id
      and routines.user_id = auth.uid()
    )
  );

create policy "Users can delete planned sets of their own routines"
  on public.planned_sets for delete
  using (
    exists (
      select 1 from public.routine_day_exercises
      join public.routine_days on routine_days.id = routine_day_exercises.routine_day_id
      join public.routines on routines.id = routine_days.routine_id
      where routine_day_exercises.id = planned_sets.routine_day_exercise_id
      and routines.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.planned_sets to authenticated;
```

- [ ] **Step 3: Verificar**

```bash
cat supabase/migrations/*_init_rutinas_planning.sql | head -3
```
Expected: muestra la línea `create table if not exists public.routines`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add routines/days/exercises/planned-sets migration with RLS"
```

---

### Task 3: Migración — sesiones de entrenamiento y series registradas

**Files:**
- Create: `supabase/migrations/<timestamp>_init_workout_sessions.sql`

**Interfaces:**
- Produces: tablas `public.workout_sessions`, `public.logged_sets` — consumidas por la Tarea 9.
- Consumes: `public.routine_days` (Tarea 2), `public.exercises` (Tarea 1).

- [ ] **Step 1: Generar el archivo de migración**

```bash
npx supabase migration new init_workout_sessions
```

- [ ] **Step 2: Escribir el SQL de la migración**

```sql
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_day_id uuid references public.routine_days(id) on delete set null,
  session_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.workout_sessions enable row level security;

create policy "Users can view their own workout sessions"
  on public.workout_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create their own workout sessions"
  on public.workout_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own workout sessions"
  on public.workout_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own workout sessions"
  on public.workout_sessions for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.workout_sessions to authenticated;

-- exercise_id references exercises directamente (no planned_sets): el registro
-- real es independiente del objetivo planeado, no se rompe si se edita la rutina.
create table if not exists public.logged_sets (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number int not null,
  actual_reps int not null,
  actual_weight double precision,
  created_at timestamptz not null default now()
);

alter table public.logged_sets enable row level security;

create policy "Users can view logged sets of their own sessions"
  on public.logged_sets for select
  using (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = logged_sets.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can create logged sets on their own sessions"
  on public.logged_sets for insert
  with check (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = logged_sets.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can update logged sets of their own sessions"
  on public.logged_sets for update
  using (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = logged_sets.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can delete logged sets of their own sessions"
  on public.logged_sets for delete
  using (
    exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = logged_sets.workout_session_id
      and workout_sessions.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.logged_sets to authenticated;
```

- [ ] **Step 3: Verificar**

```bash
cat supabase/migrations/*_init_workout_sessions.sql | head -3
```
Expected: muestra la línea `create table if not exists public.workout_sessions`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add workout sessions and logged sets migration with RLS"
```

---

### Task 4: Lógica pura de progresión (TDD)

**Files:**
- Create: `src/lib/rutina/progression.ts`
- Test: `src/lib/rutina/progression.test.ts`

**Interfaces:**
- Produces: `calculateSessionVolume(sets: SetEntry[]): number`, `buildProgressionSeries(sessions: SessionLog[]): ProgressionPoint[]`, tipos `SetEntry`, `SessionLog`, `ProgressionPoint` — consumidos por la Tarea 10.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/rutina/progression.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calculateSessionVolume, buildProgressionSeries } from './progression'

describe('calculateSessionVolume', () => {
  it('returns 0 for an empty list of sets', () => {
    expect(calculateSessionVolume([])).toBe(0)
  })

  it('multiplies reps by weight for a single set', () => {
    expect(calculateSessionVolume([{ actualReps: 10, actualWeight: 50 }])).toBe(500)
  })

  it('treats a null weight as 0 (bodyweight exercises)', () => {
    expect(calculateSessionVolume([{ actualReps: 12, actualWeight: null }])).toBe(0)
  })

  it('sums volume across multiple sets', () => {
    const sets = [
      { actualReps: 10, actualWeight: 50 },
      { actualReps: 8, actualWeight: 55 },
    ]
    expect(calculateSessionVolume(sets)).toBe(940)
  })
})

describe('buildProgressionSeries', () => {
  it('returns an empty array for no sessions', () => {
    expect(buildProgressionSeries([])).toEqual([])
  })

  it('computes volume per session', () => {
    const sessions = [
      { sessionDate: '2026-07-01', sets: [{ actualReps: 10, actualWeight: 50 }] },
    ]
    expect(buildProgressionSeries(sessions)).toEqual([{ date: '2026-07-01', volume: 500 }])
  })

  it('sorts sessions chronologically ascending regardless of input order', () => {
    const sessions = [
      { sessionDate: '2026-07-10', sets: [{ actualReps: 10, actualWeight: 50 }] },
      { sessionDate: '2026-07-01', sets: [{ actualReps: 10, actualWeight: 40 }] },
    ]
    const result = buildProgressionSeries(sessions)
    expect(result.map((point) => point.date)).toEqual(['2026-07-01', '2026-07-10'])
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npm test
```
Expected: FAIL — `Cannot find module './progression'`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `src/lib/rutina/progression.ts`:

```ts
export type SetEntry = {
  actualReps: number
  actualWeight: number | null
}

export function calculateSessionVolume(sets: SetEntry[]): number {
  return sets.reduce((total, set) => total + set.actualReps * (set.actualWeight ?? 0), 0)
}

export type SessionLog = {
  sessionDate: string
  sets: SetEntry[]
}

export type ProgressionPoint = {
  date: string
  volume: number
}

export function buildProgressionSeries(sessions: SessionLog[]): ProgressionPoint[] {
  return sessions
    .map((session) => ({ date: session.sessionDate, volume: calculateSessionVolume(session.sets) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npm test
```
Expected: PASS — 7 tests pasando (más los 7 ya existentes de Fase 0, total 14).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add rutina progression calculations with TDD"
```

---

### Task 5: Tipos compartidos, catálogo de ejercicios y selector de ejercicio

**Files:**
- Create: `src/lib/rutina/types.ts`
- Create: `src/lib/rutina/exercises-api.ts`
- Create: `src/components/rutina/exercise-picker.tsx`

**Interfaces:**
- Consumes: `createClient()` de `@/lib/supabase/client`, `Button`/`Input`/`Label` de `@/components/ui/*`.
- Produces: tipo `Exercise`; `listExercises(): Promise<Exercise[]>`, `createCustomExercise(input): Promise<Exercise>`; componente `ExercisePicker` — consumidos por las Tareas 6, 7, 9, 10.

- [ ] **Step 1: Escribir los tipos compartidos**

Crear `src/lib/rutina/types.ts`:

```ts
export type Exercise = {
  id: string
  userId: string | null
  name: string
  muscleGroup: string
  equipment: string
}

export type Routine = {
  id: string
  userId: string
  name: string
  isActive: boolean
}

export type RoutineDay = {
  id: string
  routineId: string
  name: string
  dayOrder: number
}

export type PlannedSet = {
  id: string
  routineDayExerciseId: string
  setNumber: number
  targetReps: number
  targetWeight: number | null
}

export type RoutineDayExerciseDetail = {
  id: string
  exerciseId: string
  exerciseName: string
  exerciseOrder: number
  plannedSets: PlannedSet[]
}

export type RoutineDayDetail = {
  id: string
  routineId: string
  name: string
  dayOrder: number
  exercises: RoutineDayExerciseDetail[]
}

export type WorkoutSession = {
  id: string
  userId: string
  routineDayId: string | null
  sessionDate: string
  notes: string | null
}

export type LoggedSet = {
  id: string
  workoutSessionId: string
  exerciseId: string
  setNumber: number
  actualReps: number
  actualWeight: number | null
}
```

- [ ] **Step 2: Escribir la capa de acceso a datos de ejercicios**

Crear `src/lib/rutina/exercises-api.ts`:

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

function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
  }
}

export async function listExercises(): Promise<Exercise[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('exercises')
    .select('id, user_id, name, muscle_group, equipment')
    .order('name')

  if (error) throw error
  return (data ?? []).map(mapExercise)
}

export async function createCustomExercise(input: {
  name: string
  muscleGroup: string
  equipment: string
}): Promise<Exercise> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: user.id,
      name: input.name,
      muscle_group: input.muscleGroup,
      equipment: input.equipment,
    })
    .select('id, user_id, name, muscle_group, equipment')
    .single()

  if (error) throw error
  return mapExercise(data)
}
```

- [ ] **Step 3: Escribir el selector de ejercicio**

Crear `src/components/rutina/exercise-picker.tsx`:

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

  useEffect(() => {
    loadExercises()
  }, [])

  async function loadExercises() {
    setIsLoading(true)
    try {
      const data = await listExercises()
      setExercises(data)
    } catch {
      setError('No pudimos cargar el catálogo de ejercicios.')
    } finally {
      setIsLoading(false)
    }
  }

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

  const filtered = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando ejercicios...</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Buscar ejercicio..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {filtered.map((exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              onClick={() => onSelect(exercise)}
              className="flex w-full flex-col rounded-md border p-2 text-left hover:bg-accent"
            >
              <span className="text-sm font-medium">{exercise.name}</span>
              <span className="text-xs text-muted-foreground">
                {exercise.muscleGroup} · {exercise.equipment}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-sm text-muted-foreground">Sin resultados.</li>
        )}
      </ul>
      {!showCreateForm && (
        <Button type="button" variant="outline" onClick={() => setShowCreateForm(true)}>
          Crear ejercicio nuevo
        </Button>
      )}
      {showCreateForm && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-exercise-name">Nombre</Label>
            <Input
              id="new-exercise-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-exercise-muscle">Grupo muscular</Label>
            <Input
              id="new-exercise-muscle"
              value={newMuscleGroup}
              onChange={(e) => setNewMuscleGroup(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-exercise-equipment">Equipo</Label>
            <Input
              id="new-exercise-equipment"
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value)}
            />
          </div>
          <Button type="button" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creando...' : 'Crear y seleccionar'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`. `ExercisePicker` no tiene ruta propia todavía (se consume en la Tarea 7) — la verificación es que TypeScript compila sin errores.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add rutina shared types, exercises data layer, and exercise picker"
```

---

### Task 6: Gestión de rutinas (listar, crear, marcar activa)

**Files:**
- Create: `src/lib/rutina/routines-api.ts`
- Create: `src/app/(app)/rutina/mis-rutinas/page.tsx`

**Interfaces:**
- Consumes: `Routine`/`RoutineDay`/`RoutineDayDetail`/`PlannedSet` de `@/lib/rutina/types` (Tarea 5).
- Produces: `listRoutines()`, `createRoutine(name)`, `setActiveRoutine(routineId)`, `getActiveRoutine()`, `getRoutineWithDays(routineId)`, `addRoutineDay(routineId, name)`, `deleteRoutineDay(dayId)`, `getRoutineDayDetail(dayId)`, `addExerciseToDay(dayId, exerciseId)`, `removeExerciseFromDay(routineDayExerciseId)`, `savePlannedSets(routineDayExerciseId, sets)` — consumidos por las Tareas 7, 8, 9.

- [ ] **Step 1: Escribir la capa de acceso a datos de rutinas**

Crear `src/lib/rutina/routines-api.ts`:

```ts
import { createClient } from '@/lib/supabase/client'
import type { Routine, RoutineDay, RoutineDayDetail } from './types'

type RoutineRow = { id: string; user_id: string; name: string; is_active: boolean }
type RoutineDayRow = { id: string; routine_id: string; name: string; day_order: number }

function mapRoutine(row: RoutineRow): Routine {
  return { id: row.id, userId: row.user_id, name: row.name, isActive: row.is_active }
}

function mapRoutineDay(row: RoutineDayRow): RoutineDay {
  return { id: row.id, routineId: row.routine_id, name: row.name, dayOrder: row.day_order }
}

export async function listRoutines(): Promise<Routine[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routines')
    .select('id, user_id, name, is_active')
    .order('created_at')

  if (error) throw error
  return (data ?? []).map(mapRoutine)
}

export async function createRoutine(name: string): Promise<Routine> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name })
    .select('id, user_id, name, is_active')
    .single()

  if (error) throw error
  return mapRoutine(data)
}

export async function setActiveRoutine(routineId: string): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { error: deactivateError } = await supabase
    .from('routines')
    .update({ is_active: false })
    .eq('user_id', user.id)

  if (deactivateError) throw deactivateError

  const { error: activateError } = await supabase
    .from('routines')
    .update({ is_active: true })
    .eq('id', routineId)

  if (activateError) throw activateError
}

export async function getActiveRoutine(): Promise<Routine | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routines')
    .select('id, user_id, name, is_active')
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data ? mapRoutine(data) : null
}

export async function getRoutineWithDays(routineId: string): Promise<{
  routine: Routine
  days: RoutineDay[]
}> {
  const supabase = createClient()

  const { data: routineData, error: routineError } = await supabase
    .from('routines')
    .select('id, user_id, name, is_active')
    .eq('id', routineId)
    .single()

  if (routineError) throw routineError

  const { data: daysData, error: daysError } = await supabase
    .from('routine_days')
    .select('id, routine_id, name, day_order')
    .eq('routine_id', routineId)
    .order('day_order')

  if (daysError) throw daysError

  return {
    routine: mapRoutine(routineData),
    days: (daysData ?? []).map(mapRoutineDay),
  }
}

export async function addRoutineDay(routineId: string, name: string): Promise<RoutineDay> {
  const supabase = createClient()

  const { data: existingDays, error: countError } = await supabase
    .from('routine_days')
    .select('day_order')
    .eq('routine_id', routineId)
    .order('day_order', { ascending: false })
    .limit(1)

  if (countError) throw countError

  const nextOrder = existingDays && existingDays.length > 0 ? existingDays[0].day_order + 1 : 0

  const { data, error } = await supabase
    .from('routine_days')
    .insert({ routine_id: routineId, name, day_order: nextOrder })
    .select('id, routine_id, name, day_order')
    .single()

  if (error) throw error
  return mapRoutineDay(data)
}

export async function deleteRoutineDay(dayId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('routine_days').delete().eq('id', dayId)
  if (error) throw error
}

export async function getRoutineDayDetail(dayId: string): Promise<RoutineDayDetail> {
  const supabase = createClient()

  const { data: dayData, error: dayError } = await supabase
    .from('routine_days')
    .select('id, routine_id, name, day_order')
    .eq('id', dayId)
    .single()

  if (dayError) throw dayError

  const { data: exercisesData, error: exercisesError } = await supabase
    .from('routine_day_exercises')
    .select('id, exercise_id, exercise_order, exercises(name)')
    .eq('routine_day_id', dayId)
    .order('exercise_order')

  if (exercisesError) throw exercisesError

  const dayExercises = exercisesData ?? []

  const { data: setsData, error: setsError } = await supabase
    .from('planned_sets')
    .select('id, routine_day_exercise_id, set_number, target_reps, target_weight')
    .in(
      'routine_day_exercise_id',
      dayExercises.map((e) => e.id)
    )
    .order('set_number')

  if (setsError) throw setsError

  const sets = setsData ?? []

  return {
    id: dayData.id,
    routineId: dayData.routine_id,
    name: dayData.name,
    dayOrder: dayData.day_order,
    exercises: dayExercises.map((e) => ({
      id: e.id,
      exerciseId: e.exercise_id,
      exerciseName: (e.exercises as unknown as { name: string })?.name ?? '',
      exerciseOrder: e.exercise_order,
      plannedSets: sets
        .filter((s) => s.routine_day_exercise_id === e.id)
        .map((s) => ({
          id: s.id,
          routineDayExerciseId: s.routine_day_exercise_id,
          setNumber: s.set_number,
          targetReps: s.target_reps,
          targetWeight: s.target_weight,
        })),
    })),
  }
}

export async function addExerciseToDay(dayId: string, exerciseId: string): Promise<string> {
  const supabase = createClient()

  const { data: existing, error: countError } = await supabase
    .from('routine_day_exercises')
    .select('exercise_order')
    .eq('routine_day_id', dayId)
    .order('exercise_order', { ascending: false })
    .limit(1)

  if (countError) throw countError

  const nextOrder = existing && existing.length > 0 ? existing[0].exercise_order + 1 : 0

  const { data, error } = await supabase
    .from('routine_day_exercises')
    .insert({ routine_day_id: dayId, exercise_id: exerciseId, exercise_order: nextOrder })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function removeExerciseFromDay(routineDayExerciseId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routine_day_exercises')
    .delete()
    .eq('id', routineDayExerciseId)

  if (error) throw error
}

export async function savePlannedSets(
  routineDayExerciseId: string,
  sets: { setNumber: number; targetReps: number; targetWeight: number | null }[]
): Promise<void> {
  const supabase = createClient()

  const { error: deleteError } = await supabase
    .from('planned_sets')
    .delete()
    .eq('routine_day_exercise_id', routineDayExerciseId)

  if (deleteError) throw deleteError

  if (sets.length === 0) return

  const { error: insertError } = await supabase.from('planned_sets').insert(
    sets.map((s) => ({
      routine_day_exercise_id: routineDayExerciseId,
      set_number: s.setNumber,
      target_reps: s.targetReps,
      target_weight: s.targetWeight,
    }))
  )

  if (insertError) throw insertError
}
```

- [ ] **Step 2: Escribir la pantalla "Mis rutinas"**

Crear `src/app/(app)/rutina/mis-rutinas/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listRoutines, createRoutine, setActiveRoutine } from '@/lib/rutina/routines-api'
import type { Routine } from '@/lib/rutina/types'

export default function MisRutinasPage() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRoutines()
  }, [])

  async function loadRoutines() {
    setIsLoading(true)
    try {
      const data = await listRoutines()
      setRoutines(data)
    } catch {
      setError('No pudimos cargar tus rutinas.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) {
      setError('Ponele un nombre a la rutina.')
      return
    }

    setError(null)
    setIsCreating(true)
    try {
      await createRoutine(newName.trim())
      setNewName('')
      await loadRoutines()
    } catch {
      setError('No pudimos crear la rutina.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleSetActive(routineId: string) {
    setError(null)
    try {
      await setActiveRoutine(routineId)
      await loadRoutines()
    } catch {
      setError('No pudimos marcar la rutina como activa.')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Mis rutinas</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Input
          placeholder="Nombre de la nueva rutina"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="button" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? 'Creando...' : 'Crear'}
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {routines.map((routine) => (
            <Card key={routine.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <Link href={`/rutina/mis-rutinas/${routine.id}`} className="underline">
                    {routine.name}
                  </Link>
                  {routine.isActive && (
                    <span className="text-xs font-normal text-muted-foreground">Activa</span>
                  )}
                </CardTitle>
              </CardHeader>
              {!routine.isActive && (
                <CardContent>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetActive(routine.id)}
                  >
                    Marcar como activa
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
          {routines.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no creaste ninguna rutina.</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la tabla de rutas incluye `/rutina/mis-rutinas`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add routines data layer and mis-rutinas management screen"
```

---

### Task 7: Editor de día de rutina (días, ejercicios, series piramidales)

**Files:**
- Create: `src/components/rutina/planned-sets-editor.tsx`
- Create: `src/app/(app)/rutina/mis-rutinas/[routineId]/page.tsx`

**Interfaces:**
- Consumes: `ExercisePicker` (Tarea 5), `getRoutineWithDays`/`addRoutineDay`/`deleteRoutineDay`/`getRoutineDayDetail`/`addExerciseToDay`/`removeExerciseFromDay`/`savePlannedSets` (Tarea 6).

- [ ] **Step 1: Escribir el editor de series piramidales**

Crear `src/components/rutina/planned-sets-editor.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { savePlannedSets } from '@/lib/rutina/routines-api'
import type { PlannedSet } from '@/lib/rutina/types'

type SetInput = {
  setNumber: number
  targetReps: number
  targetWeight: number | null
}

export function PlannedSetsEditor({
  routineDayExerciseId,
  initialSets,
  onSaved,
}: {
  routineDayExerciseId: string
  initialSets: PlannedSet[]
  onSaved: () => void
}) {
  const [sets, setSets] = useState<SetInput[]>(
    initialSets.length > 0
      ? initialSets.map((s) => ({
          setNumber: s.setNumber,
          targetReps: s.targetReps,
          targetWeight: s.targetWeight,
        }))
      : [{ setNumber: 1, targetReps: 10, targetWeight: null }]
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateSet(index: number, field: 'targetReps' | 'targetWeight', value: string) {
    setSets((prev) =>
      prev.map((set, i) => {
        if (i !== index) return set
        if (field === 'targetReps') {
          return { ...set, targetReps: Number(value) || 0 }
        }
        return { ...set, targetWeight: value === '' ? null : Number(value) }
      })
    )
  }

  function addSet() {
    setSets((prev) => [...prev, { setNumber: prev.length + 1, targetReps: 10, targetWeight: null }])
  }

  function removeSet(index: number) {
    setSets((prev) =>
      prev.filter((_, i) => i !== index).map((set, i) => ({ ...set, setNumber: i + 1 }))
    )
  }

  async function handleSave() {
    setError(null)
    setIsSaving(true)
    try {
      await savePlannedSets(routineDayExerciseId, sets)
      onSaved()
    } catch {
      setError('No pudimos guardar las series.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sets.map((set, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-14 text-xs text-muted-foreground">Serie {set.setNumber}</span>
          <Input
            type="number"
            className="w-20"
            value={set.targetReps}
            onChange={(e) => updateSet(index, 'targetReps', e.target.value)}
            placeholder="Reps"
          />
          <Input
            type="number"
            className="w-24"
            value={set.targetWeight ?? ''}
            onChange={(e) => updateSet(index, 'targetWeight', e.target.value)}
            placeholder="Peso (kg)"
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => removeSet(index)}>
            Quitar
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addSet}>
          Agregar serie
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar series'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Escribir la pantalla de edición de una rutina**

Crear `src/app/(app)/rutina/mis-rutinas/[routineId]/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const [dayDetail, setDayDetail] = useState<RoutineDayDetail | null>(null)
  const [newDayName, setNewDayName] = useState('')
  const [showPickerForDay, setShowPickerForDay] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRoutine()
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

  async function handleExpandDay(dayId: string) {
    if (expandedDayId === dayId) {
      setExpandedDayId(null)
      setDayDetail(null)
      return
    }
    setExpandedDayId(dayId)
    await loadDayDetail(dayId)
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
      if (expandedDayId === dayId) {
        setExpandedDayId(null)
        setDayDetail(null)
      }
      await loadRoutine()
    } catch {
      setError('No pudimos borrar el día.')
    }
  }

  async function handleAddExercise(dayId: string, exerciseId: string) {
    setError(null)
    try {
      await addExerciseToDay(dayId, exerciseId)
      setShowPickerForDay(null)
      await loadDayDetail(dayId)
    } catch {
      setError('No pudimos agregar el ejercicio.')
    }
  }

  async function handleRemoveExercise(dayId: string, routineDayExerciseId: string) {
    setError(null)
    try {
      await removeExerciseFromDay(routineDayExerciseId)
      await loadDayDetail(dayId)
    } catch {
      setError('No pudimos quitar el ejercicio.')
    }
  }

  if (!routine) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

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
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <button type="button" onClick={() => handleExpandDay(day.id)} className="underline">
                  {day.name}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDay(day.id)}
                >
                  Borrar día
                </Button>
              </CardTitle>
            </CardHeader>
            {expandedDayId === day.id && dayDetail && (
              <CardContent className="flex flex-col gap-3">
                {dayDetail.exercises.map((exercise) => (
                  <div key={exercise.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/rutina/historial/${exercise.exerciseId}`}
                        className="text-sm font-medium underline"
                      >
                        {exercise.exerciseName}
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExercise(day.id, exercise.id)}
                      >
                        Quitar
                      </Button>
                    </div>
                    <PlannedSetsEditor
                      routineDayExerciseId={exercise.id}
                      initialSets={exercise.plannedSets}
                      onSaved={() => loadDayDetail(day.id)}
                    />
                  </div>
                ))}
                {showPickerForDay === day.id ? (
                  <ExercisePicker onSelect={(exercise) => handleAddExercise(day.id, exercise.id)} />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPickerForDay(day.id)}
                  >
                    Agregar ejercicio
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        ))}
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no agregaste ningún día.</p>
        )}
      </div>
    </div>
  )
}
```

Nota: el nombre del ejercicio dentro de un día ya es un link a `/rutina/historial/[exerciseId]` (pantalla que se crea en la Tarea 10) — se deja escrito acá para no tener que volver a tocar este archivo después.

- [ ] **Step 3: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la tabla de rutas incluye `/rutina/mis-rutinas/[routineId]`. El link a `/rutina/historial/[exerciseId]` apunta a una ruta que todavía no existe (se crea en la Tarea 10) — esto no rompe el build, Next.js no valida en build time que las rutas de un `<Link href>` dinámico existan.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add routine day editor with pyramidal planned sets"
```

---

### Task 8: Pestaña principal de Rutina

**Files:**
- Modify: `src/app/(app)/rutina/page.tsx` (reemplaza el placeholder de Fase 0)

**Interfaces:**
- Consumes: `getActiveRoutine`, `getRoutineWithDays` (Tarea 6).

- [ ] **Step 1: Reemplazar la página de Rutina**

Reemplazar el contenido de `src/app/(app)/rutina/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getActiveRoutine, getRoutineWithDays } from '@/lib/rutina/routines-api'
import type { Routine, RoutineDay } from '@/lib/rutina/types'

export default function RutinaPage() {
  const router = useRouter()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [days, setDays] = useState<RoutineDay[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadActiveRoutine()
  }, [])

  async function loadActiveRoutine() {
    setIsLoading(true)
    try {
      const active = await getActiveRoutine()
      setRoutine(active)
      if (active) {
        const data = await getRoutineWithDays(active.id)
        setDays(data.days)
      }
    } finally {
      setIsLoading(false)
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Todavía no tenés una rutina activa.</p>
        <Button type="button" onClick={() => router.push('/rutina/mis-rutinas')}>
          Crear tu primera rutina
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{routine.name}</h1>
        <Link href="/rutina/mis-rutinas" className="text-sm underline">
          Mis rutinas
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {days.map((day) => (
          <Card key={day.id}>
            <CardHeader>
              <CardTitle className="text-base">{day.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                size="sm"
                onClick={() => router.push(`/rutina/entrenar/${day.id}`)}
              >
                Registrar entrenamiento
              </Button>
            </CardContent>
          </Card>
        ))}
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Esta rutina todavía no tiene días. Andá a &quot;Mis rutinas&quot; para agregarlos.
          </p>
        )}
      </div>
    </div>
  )
}
```

Nota: el botón "Registrar entrenamiento" apunta a `/rutina/entrenar/[dayId]`, ruta que se crea en la Tarea 9 — no rompe el build por la misma razón que la nota de la Tarea 7.

- [ ] **Step 2: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: replace rutina placeholder with active routine view"
```

---

### Task 9: Registro de entrenamiento real (serie por serie)

**Files:**
- Create: `src/lib/rutina/sessions-api.ts`
- Create: `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`

**Interfaces:**
- Consumes: `getRoutineDayDetail` (Tarea 6), `LoggedSet`/`WorkoutSession` de `@/lib/rutina/types` (Tarea 5).
- Produces: `getOrCreateWorkoutSession(routineDayId)`, `saveLoggedSet(input)`, `getLoggedSetsForSession(workoutSessionId)`, `listSessionsForExercise(exerciseId)` — `listSessionsForExercise` consumido por la Tarea 10.

- [ ] **Step 1: Escribir la capa de acceso a datos de sesiones**

Crear `src/lib/rutina/sessions-api.ts`:

```ts
import { createClient } from '@/lib/supabase/client'
import type { WorkoutSession, LoggedSet } from './types'

type WorkoutSessionRow = {
  id: string
  user_id: string
  routine_day_id: string | null
  session_date: string
  notes: string | null
}

function mapSession(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    userId: row.user_id,
    routineDayId: row.routine_day_id,
    sessionDate: row.session_date,
    notes: row.notes,
  }
}

export async function getOrCreateWorkoutSession(routineDayId: string): Promise<WorkoutSession> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const today = new Date().toISOString().slice(0, 10)

  const { data: existing, error: findError } = await supabase
    .from('workout_sessions')
    .select('id, user_id, routine_day_id, session_date, notes')
    .eq('user_id', user.id)
    .eq('routine_day_id', routineDayId)
    .eq('session_date', today)
    .maybeSingle()

  if (findError) throw findError
  if (existing) return mapSession(existing)

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ user_id: user.id, routine_day_id: routineDayId })
    .select('id, user_id, routine_day_id, session_date, notes')
    .single()

  if (error) throw error
  return mapSession(data)
}

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

- [ ] **Step 2: Escribir la pantalla de registro de entrenamiento**

Crear `src/app/(app)/rutina/entrenar/[dayId]/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getRoutineDayDetail } from '@/lib/rutina/routines-api'
import {
  getOrCreateWorkoutSession,
  getLoggedSetsForSession,
  saveLoggedSet,
} from '@/lib/rutina/sessions-api'
import type { RoutineDayDetail } from '@/lib/rutina/types'

type SetLogState = {
  actualReps: number
  actualWeight: number | null
  isSaved: boolean
  isSaving: boolean
}

export default function EntrenarPage() {
  const params = useParams<{ dayId: string }>()
  const dayId = params.dayId

  const [dayDetail, setDayDetail] = useState<RoutineDayDetail | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, SetLogState>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    init()
  }, [dayId])

  async function init() {
    try {
      const detail = await getRoutineDayDetail(dayId)
      const session = await getOrCreateWorkoutSession(dayId)
      const existingLogs = await getLoggedSetsForSession(session.id)
      setDayDetail(detail)
      setSessionId(session.id)

      const existingByKey = new Map(
        existingLogs.map((log) => [`${log.exerciseId}-${log.setNumber}`, log])
      )

      const initialLogs: Record<string, SetLogState> = {}
      for (const exercise of detail.exercises) {
        for (const set of exercise.plannedSets) {
          const key = `${exercise.exerciseId}-${set.setNumber}`
          const existing = existingByKey.get(key)
          initialLogs[key] = existing
            ? {
                actualReps: existing.actualReps,
                actualWeight: existing.actualWeight,
                isSaved: true,
                isSaving: false,
              }
            : {
                actualReps: set.targetReps,
                actualWeight: set.targetWeight,
                isSaved: false,
                isSaving: false,
              }
        }
      }
      setLogs(initialLogs)
    } catch {
      setError('No pudimos cargar el entrenamiento de hoy.')
    }
  }

  function updateLog(key: string, field: 'actualReps' | 'actualWeight', value: string) {
    setLogs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        isSaved: false,
        [field]: field === 'actualReps' ? Number(value) || 0 : value === '' ? null : Number(value),
      },
    }))
  }

  async function handleSaveSet(exerciseId: string, setNumber: number) {
    if (!sessionId) return
    const key = `${exerciseId}-${setNumber}`
    const log = logs[key]
    if (!log) return

    setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: true } }))
    try {
      await saveLoggedSet({
        workoutSessionId: sessionId,
        exerciseId,
        setNumber,
        actualReps: log.actualReps,
        actualWeight: log.actualWeight,
      })
      setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: false, isSaved: true } }))
    } catch {
      setError('No pudimos guardar esa serie.')
      setLogs((prev) => ({ ...prev, [key]: { ...prev[key], isSaving: false } }))
    }
  }

  if (!dayDetail) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{dayDetail.name}</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-3">
        {dayDetail.exercises.map((exercise) => (
          <Card key={exercise.id}>
            <CardHeader>
              <CardTitle className="text-base">{exercise.exerciseName}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {exercise.plannedSets.map((set) => {
                const key = `${exercise.exerciseId}-${set.setNumber}`
                const log = logs[key]
                if (!log) return null

                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-14 text-xs text-muted-foreground">
                      Serie {set.setNumber}
                    </span>
                    <Input
                      type="number"
                      className="w-20"
                      value={log.actualReps}
                      onChange={(e) => updateLog(key, 'actualReps', e.target.value)}
                    />
                    <Input
                      type="number"
                      className="w-24"
                      value={log.actualWeight ?? ''}
                      onChange={(e) => updateLog(key, 'actualWeight', e.target.value)}
                      placeholder="Peso (kg)"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={log.isSaved ? 'outline' : 'default'}
                      onClick={() => handleSaveSet(exercise.exerciseId, set.setNumber)}
                      disabled={log.isSaving}
                    >
                      {log.isSaved ? 'Guardado' : log.isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )
              })}
              {exercise.plannedSets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Este ejercicio no tiene series objetivo definidas.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la tabla de rutas incluye `/rutina/entrenar/[dayId]`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add workout session logging flow, set by set"
```

---

### Task 10: Historial y gráfico de progresión por ejercicio

**Files:**
- Create: `src/components/rutina/exercise-progression-chart.tsx`
- Create: `src/app/(app)/rutina/historial/[exerciseId]/page.tsx`
- Modify: `package.json` (agrega `recharts` vía el componente `chart` de shadcn/ui)

**Interfaces:**
- Consumes: `buildProgressionSeries`/`ProgressionPoint` (Tarea 4), `listSessionsForExercise` (Tarea 9).

- [ ] **Step 1: Instalar el componente chart de shadcn/ui**

```bash
npx --yes shadcn@latest add chart -y
```
Expected: crea `src/components/ui/chart.tsx`, agrega `recharts` a `package.json`.

- [ ] **Step 2: Escribir el gráfico de progresión**

Crear `src/components/rutina/exercise-progression-chart.tsx`:

```tsx
'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { ProgressionPoint } from '@/lib/rutina/progression'

const chartConfig = {
  volume: {
    label: 'Volumen (kg)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function ExerciseProgressionChart({ data }: { data: ProgressionPoint[] }) {
  return (
    <ChartContainer config={chartConfig}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="volume"
          type="monotone"
          stroke="var(--color-volume)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 3: Escribir la pantalla de historial**

Crear `src/app/(app)/rutina/historial/[exerciseId]/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExerciseProgressionChart } from '@/components/rutina/exercise-progression-chart'
import { listSessionsForExercise } from '@/lib/rutina/sessions-api'
import { buildProgressionSeries } from '@/lib/rutina/progression'

export default function HistorialEjercicioPage() {
  const params = useParams<{ exerciseId: string }>()
  const exerciseId = params.exerciseId

  const [sessions, setSessions] = useState<
    {
      sessionId: string
      sessionDate: string
      sets: { setNumber: number; actualReps: number; actualWeight: number | null }[]
    }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [exerciseId])

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

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  const progressionData = buildProgressionSeries(
    sessions.map((session) => ({
      sessionDate: session.sessionDate,
      sets: session.sets.map((set) => ({
        actualReps: set.actualReps,
        actualWeight: set.actualWeight,
      })),
    }))
  )

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Historial</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no registraste este ejercicio.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolución del volumen</CardTitle>
            </CardHeader>
            <CardContent>
              <ExerciseProgressionChart data={progressionData} />
            </CardContent>
          </Card>
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
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
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar que el build pasa**

```bash
npm run build
```
Expected: `✓ Compiled successfully`, la tabla de rutas incluye `/rutina/historial/[exerciseId]`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add exercise progression chart and history screen"
```

---

## Fuera de este plan (se ejecuta guiado con el usuario, no vía subagentes)

- Aplicar las 3 migraciones (Tareas 1-3) contra el proyecto Supabase real (`supabase db push`)
- Verificar explícitamente el GRANT de cada tabla nueva con una consulta directa al Data API (curl con la anon key, igual que en Fase 0) antes de dar por buena la fase
- Deploy a Vercel (push a una rama genera preview automáticamente vía la integración de GitHub ya conectada)
- Verificación end-to-end contra el proyecto real: crear una rutina con días y ejercicios (series piramidales), marcarla activa, registrar un entrenamiento real serie por serie, ver historial + gráfico de progresión
- Merge de `modulo-1-rutina` a `main` (vía `superpowers:finishing-a-development-branch`), solo después de que el usuario confirme que todo lo anterior funciona

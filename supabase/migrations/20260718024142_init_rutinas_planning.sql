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

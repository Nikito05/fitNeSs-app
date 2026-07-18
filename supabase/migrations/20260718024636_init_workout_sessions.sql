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

create table if not exists public.exercise_notes (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  note text not null default '',
  created_at timestamptz not null default now(),
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

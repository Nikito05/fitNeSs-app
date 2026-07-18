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

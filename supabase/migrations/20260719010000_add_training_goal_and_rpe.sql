alter table public.profiles
  add column training_goal text not null default 'general'
  check (training_goal in ('fuerza', 'hipertrofia', 'resistencia', 'general'));

alter table public.logged_sets
  add column rpe text not null default 'justo'
  check (rpe in ('facil', 'justo', 'al_limite'));

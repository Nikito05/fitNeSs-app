alter table public.profiles
  add column height_cm double precision check (height_cm > 0 and height_cm < 300),
  add column biological_sex text check (biological_sex in ('masculino', 'femenino')),
  add column birth_date date check (birth_date < current_date),
  add column activity_level text check (activity_level in ('sedentario', 'ligero', 'moderado', 'intenso', 'muy_intenso')),
  add column weight_goal text not null default 'mantener' check (weight_goal in ('bajar', 'mantener', 'subir')),
  add column target_weight_kg double precision check (target_weight_kg > 0 and target_weight_kg < 1000),
  add column target_date date;

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  calories_per_100g double precision not null check (calories_per_100g >= 0 and calories_per_100g <= 900),
  protein_per_100g double precision not null check (protein_per_100g >= 0 and protein_per_100g <= 100),
  fat_per_100g double precision not null check (fat_per_100g >= 0 and fat_per_100g <= 100),
  carbs_per_100g double precision not null check (carbs_per_100g >= 0 and carbs_per_100g <= 100),
  typical_portion_g double precision check (typical_portion_g > 0 and typical_portion_g < 5000),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.foods enable row level security;

create policy "Users can view their own foods"
  on public.foods for select
  using (auth.uid() = user_id);

create policy "Users can create their own foods"
  on public.foods for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own foods"
  on public.foods for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own foods"
  on public.foods for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.foods to authenticated;

create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  name text not null,
  quantity_g double precision not null check (quantity_g > 0 and quantity_g < 5000),
  calories double precision not null check (calories >= 0 and calories < 50000),
  protein_g double precision not null check (protein_g >= 0 and protein_g < 5000),
  fat_g double precision not null check (fat_g >= 0 and fat_g < 5000),
  carbs_g double precision not null check (carbs_g >= 0 and carbs_g < 5000),
  source text not null check (source in ('custom', 'off')),
  food_id uuid references public.foods(id) on delete set null,
  off_barcode text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.food_log_entries enable row level security;

create policy "Users can view their own food log entries"
  on public.food_log_entries for select
  using (auth.uid() = user_id);

create policy "Users can create their own food log entries"
  on public.food_log_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own food log entries"
  on public.food_log_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own food log entries"
  on public.food_log_entries for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.food_log_entries to authenticated;

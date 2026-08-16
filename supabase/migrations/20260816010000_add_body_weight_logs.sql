create table public.body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  weight_kg double precision not null,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.body_weight_logs enable row level security;

create policy "Users can view their own weight logs"
  on public.body_weight_logs for select
  using (auth.uid() = user_id);

create policy "Users can create their own weight logs"
  on public.body_weight_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own weight logs"
  on public.body_weight_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own weight logs"
  on public.body_weight_logs for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.body_weight_logs to authenticated;

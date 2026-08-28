-- Employee training system: owner-authored modules (rules, equipment
-- instructions, chemical warnings, videos/photos with descriptions, and a
-- graded multiple-choice quiz) plus per-employee completion records.
-- Uses the same lightweight full-replace-on-load / full-upsert-on-change
-- sync shape as the automations table (0086) since module volume is low.

create table if not exists public.training_modules (
  id text primary key,
  owner_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists training_modules_owner_id_idx on public.training_modules (owner_id);
alter table public.training_modules enable row level security;
create policy training_modules_owner_scoped on public.training_modules
  for all using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

create table if not exists public.training_completions (
  id text primary key,
  owner_id text not null,
  module_id text not null,
  employee_id text not null,
  employee_name text,
  score numeric,
  passed boolean not null default false,
  answers jsonb,
  completed_at timestamptz not null default now()
);
create index if not exists training_completions_owner_id_idx on public.training_completions (owner_id);
create index if not exists training_completions_module_id_idx on public.training_completions (module_id);
create index if not exists training_completions_employee_id_idx on public.training_completions (employee_id);
alter table public.training_completions enable row level security;
create policy training_completions_owner_scoped on public.training_completions
  for all using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- 0086_automations_table.sql
--
-- FEATURE — "make automations run in the background, not just when your CRM
-- is open." Root prerequisite: automations lived ONLY in this browser's own
-- localStorage (usePersistent("smocks.automations", ...), see App.tsx) —
-- nothing server-side could ever see them, so a background job had nothing
-- to read no matter how it was built. This table mirrors the local
-- Automation shape (see src/types.ts) so App.tsx can sync it the same way
-- jobs/customers/estimates already sync, and functions/api/run-automations.ts
-- (new) can evaluate and send from it independent of any browser being open.
--
-- Run this in the Supabase SQL Editor.

create table if not exists public.automations (
  id text primary key,
  owner_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists automations_owner_id_idx on public.automations (owner_id);

alter table public.automations enable row level security;
drop policy if exists automations_owner_scoped on public.automations;
create policy automations_owner_scoped on public.automations
  for all
  using (owner_id = current_owner_id())
  with check (owner_id = current_owner_id());

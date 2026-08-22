-- 0039_employee_onboarding.sql
-- FEATURE — new-hire onboarding packets. The owner defines a reusable
-- onboarding TEMPLATE (list of items like "Sign tax forms," "Review safety
-- policy") once, in Settings (stored in app_settings.data.onboardingTemplateItems
-- — same JSONB blob every other owner-editable template setting already
-- syncs through, no new table needed for the template itself). When a NEW
-- employee is invited, the owner can optionally assign a PER-EMPLOYEE COPY
-- of the current template — a real row here, not just a reference back to
-- the shared template — so that employee's checked-off progress stays tied
-- to what they were actually assigned even if the owner edits the template
-- later. The employee checks items off from their portal; the owner sees
-- completion progress on the Employees page.
--
-- Safe to re-run: every statement below is guarded (IF NOT EXISTS / DROP ...
-- IF EXISTS before CREATE POLICY, since Postgres has no CREATE POLICY IF NOT
-- EXISTS). Run this ENTIRE file in the Supabase SQL Editor — the app's anon
-- key cannot run DDL (see CLAUDE.md).
--
-- current_owner_id() already exists (defined in 0033) — reused here, not
-- redefined. It resolves to the caller's own owner_id whether the caller is
-- the owner themselves or one of that owner's employees (looked up via
-- employees.user_id), which is exactly what's needed here: the owner needs
-- to read/write every one of their employees' onboarding rows, and each
-- employee needs to read/write their own.

create table if not exists public.employee_onboarding (
  id text primary key,
  owner_id text not null,
  employee_id text not null,
  -- Each item: { id, title, description, done, completedAt }. A snapshot
  -- copied from settings.onboardingTemplateItems at assignment time, not a
  -- live reference — see comment above.
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One onboarding packet per employee.
create unique index if not exists employee_onboarding_employee_id_idx
  on public.employee_onboarding (employee_id);
create index if not exists employee_onboarding_owner_id_idx
  on public.employee_onboarding (owner_id);

alter table public.employee_onboarding enable row level security;

drop policy if exists "employee_onboarding_owner_scoped" on public.employee_onboarding;
create policy "employee_onboarding_owner_scoped" on public.employee_onboarding for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

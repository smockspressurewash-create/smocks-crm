-- 0097_manual_budget_entries.sql
--
-- FEATURE — "there's no way to edit your budget stuff, like your income
-- streams, all that stuff, manually adding things, manually subtracting
-- things, all that." BudgetPage.tsx's income/expense totals were 100%
-- derived from real jobs/expenses records with no way to add an ad-hoc
-- entry (a cash tip not tied to a job, a one-off reimbursement, a manual
-- correction) — this table is exactly that: a plain manual line item,
-- income or expense, that BudgetPage.tsx folds into its own totals
-- alongside the auto-derived numbers. Deleting a row is how a manual entry
-- gets "subtracted" back out.
--
-- Run this in the Supabase SQL Editor.

create table if not exists public.manual_budget_entries (
  id text primary key,
  owner_id text not null,
  kind text not null check (kind in ('income', 'expense')),
  category text not null default 'misc',
  label text not null default '',
  amount numeric not null default 0,
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists manual_budget_entries_owner_id_idx on public.manual_budget_entries (owner_id);

alter table public.manual_budget_entries enable row level security;
drop policy if exists manual_budget_entries_owner_scoped on public.manual_budget_entries;
create policy manual_budget_entries_owner_scoped on public.manual_budget_entries
  for all
  using (owner_id = current_owner_id())
  with check (owner_id = current_owner_id());

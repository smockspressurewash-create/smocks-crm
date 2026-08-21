-- Multi-tenant conversion (Phase A + F.1) — CrewBoss CRM.
-- Run this ENTIRE file in the Supabase SQL Editor — the app's anon key
-- cannot run DDL (see CLAUDE.md). Safe to re-run (every statement is
-- idempotent via IF EXISTS/IF NOT EXISTS).
--
-- WHAT THIS DOES: converts the app from single-tenant (one business per
-- deployment, zero data isolation) to multi-tenant (many businesses sharing
-- this one Supabase project, isolated by `owner_id`).
--
-- WHY `owner_id` (text) and not the existing `organizations`/`profiles`/
-- `org_id` (uuid) scaffold: that scaffold has 0 rows in `organizations`,
-- is written from exactly one dead code path (App.tsx saveCompanySetup,
-- wrapped in try/catch, never read anywhere downstream), and every table's
-- `org_id` column is 100% NULL today. `owner_id` (text) is the convention
-- ALREADY working and populated on app_settings/alfred_conversations/
-- alfred_memory/mileage_logs — the owning business's Supabase Auth user id.
-- This migration makes that the universal tenant key instead of building a
-- second, parallel system.
--
-- KNOWN FOLLOW-UPS NOT SOLVED HERE (flagged inline below, addressed in the
-- app-code phase): (1) unauthenticated `#/portal?invite=CODE` lookup needs a
-- way to read one invites row by code before any owner_id/session exists;
-- (2) resolveUserRole()'s email-fallback employees lookup (App.tsx) has the
-- same chicken-and-egg problem before user_id linkage exists on a row.
--
-- Current single owner in this deployment (used for backfill below):
--   9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 1 — add owner_id (text) to every table that needs one, or convert a
-- mistyped owner_id to text so every tenant column compares consistently.
-- ═══════════════════════════════════════════════════════════════════════

alter table customers      add column if not exists owner_id text;
alter table estimates      add column if not exists owner_id text;
alter table employees      add column if not exists owner_id text;
alter table expenses       add column if not exists owner_id text;
alter table jobs           add column if not exists owner_id text;
alter table inbox_threads  add column if not exists owner_id text;
alter table invites        add column if not exists owner_id text;
alter table campaigns      add column if not exists owner_id text;
alter table services       add column if not exists owner_id text;
alter table reviews        add column if not exists owner_id text;

alter table job_requests alter column owner_id type text using owner_id::text;
alter table promotions   alter column owner_id type text using owner_id::text;

-- jobs_backup intentionally left alone — stale/unused backup table, RLS
-- already enabled with zero policies (fully inaccessible via anon/
-- authenticated). That's already the correct, safe state for it.

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 2 — backfill every existing row to the current single owner, so the
-- live deployment doesn't lose access to its own data the moment RLS below
-- starts enforcing owner_id.
-- ═══════════════════════════════════════════════════════════════════════

update customers     set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update estimates     set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update employees     set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update expenses      set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update jobs          set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update inbox_threads set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update invites       set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update campaigns     set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update services      set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update reviews       set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update job_requests  set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;
update promotions    set owner_id = '9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9' where owner_id is null;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 3 — tenant-resolution helper used by every RLS policy below.
-- SECURITY DEFINER so it can look up the caller's own employees row even
-- though the policy ON employees (below) would otherwise block that same
-- lookup from inside itself — the one deliberate RLS-bypass in this
-- migration, and it only ever returns a single id string, never row data.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.current_owner_id()
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select e.owner_id from public.employees e where e.user_id = auth.uid() limit 1),
    auth.uid()::text
  );
$$;

-- Second SECURITY DEFINER helper: resolveUserRole()'s email-fallback path
-- (App.tsx) — a first-time Google sign-in for an employee whose row was
-- pre-created by the owner with just an email (no user_id link yet) needs
-- to find and link that row by email. The plain `employees_owner_scoped`
-- policy below can't allow this: current_owner_id() has nothing to resolve
-- to until the link exists, so it's a chicken-and-egg case just like the
-- invites lookup (see functions/api/invite-action.ts). Scoped tightly to
-- the CALLER'S OWN verified JWT email and only rows with no user_id yet —
-- cannot be used to enumerate or link any other business's employees.
-- Bounded to exactly one row via the LIMIT-1 subquery below — email is NOT
-- enforced globally unique across businesses in this schema (see plan doc's
-- Phase C note), so a plain WHERE-email UPDATE could match placeholder rows
-- at two different businesses simultaneously and link this one user_id to
-- both. This picks (arbitrarily but singly) the first unlinked match.
create or replace function public.link_own_employee_by_email()
returns table (id text, role text, owner_id text, user_id uuid)
language sql
security definer
volatile
set search_path = public, pg_temp
as $$
  update public.employees e
  set user_id = auth.uid()
  where e.id = (
    select id from public.employees
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and user_id is null
    limit 1
  )
  returning e.id, e.role, e.owner_id, e.user_id;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 4 — replace every permissive USING(true) policy with owner_id
-- scoping. Postgres OR's multiple permissive policies together, so any
-- leftover `USING (true)` policy on a table silently defeats every other
-- policy on that table — every DROP below is required, not optional.
-- ═══════════════════════════════════════════════════════════════════════

-- customers
drop policy if exists "Users can manage their org's customers" on customers;
drop policy if exists "customers_all" on customers;
drop policy if exists "customers_all_read" on customers;
drop policy if exists "customers_org_isolation" on customers;
create policy "customers_owner_scoped" on customers for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- employees
drop policy if exists "allow_all_employees" on employees;
drop policy if exists "employees_all" on employees;
drop policy if exists "org_employees" on employees;
-- "see_by_email" (SELECT true) dropped here — it backed resolveUserRole()'s
-- email-fallback lookup (App.tsx). Replaced by the link_own_employee_by_email()
-- SECURITY DEFINER RPC above; App.tsx now calls that instead of querying
-- this table directly for the email-fallback path.
drop policy if exists "see_by_email" on employees;
-- "see_own_record" (user_id = auth.uid()) kept as-is — safe, restrictive,
-- and still needed as the self-lookup path once user_id IS linked.
create policy "employees_owner_scoped" on employees for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- estimates
drop policy if exists "Users can manage their org's estimates" on estimates;
drop policy if exists "estimates_all" on estimates;
create policy "estimates_owner_scoped" on estimates for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- expenses (already had a real org_id-scoped policy; replaced with the
-- owner_id equivalent)
drop policy if exists "Users can manage their org's expenses" on expenses;
create policy "expenses_owner_scoped" on expenses for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- jobs
drop policy if exists "jobs_all" on jobs;
drop policy if exists "jobs_insert_update" on jobs;
drop policy if exists "jobs_org_isolation" on jobs;
create policy "jobs_owner_scoped" on jobs for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- app_settings, alfred_conversations, alfred_memory, mileage_logs — already
-- keyed by owner_id, just wide open; tighten in place.
drop policy if exists "app_settings_all" on app_settings;
create policy "app_settings_owner_scoped" on app_settings for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

drop policy if exists "alfred_conversations_all" on alfred_conversations;
create policy "alfred_conversations_owner_scoped" on alfred_conversations for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

drop policy if exists "alfred_memory_all" on alfred_memory;
create policy "alfred_memory_owner_scoped" on alfred_memory for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

drop policy if exists "mileage_logs_all" on mileage_logs;
create policy "mileage_logs_owner_scoped" on mileage_logs for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- inbox_threads
drop policy if exists "inbox_threads_all" on inbox_threads;
create policy "inbox_threads_owner_scoped" on inbox_threads for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- job_requests
drop policy if exists "job_requests_all" on job_requests;
drop policy if exists "requests_insert" on job_requests;
drop policy if exists "requests_select" on job_requests;
drop policy if exists "requests_update" on job_requests;
create policy "job_requests_owner_scoped" on job_requests for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- promotions
drop policy if exists "promotions_all" on promotions;
create policy "promotions_owner_scoped" on promotions for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- reviews — public INSERT stays (a customer submitting a review from an
-- unauthenticated `#/rate` link has no owner-linked session); the review
-- link itself must carry owner_id going forward (Phase D) so this check can
-- require it to be non-null instead of trusting an authenticated session.
drop policy if exists "reviews_all" on reviews;
drop policy if exists "reviews_insert_public" on reviews;
create policy "reviews_owner_scoped" on reviews for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());
create policy "reviews_insert_public" on reviews for insert to public
  with check (owner_id is not null);

-- services
drop policy if exists "services_all" on services;
create policy "services_owner_scoped" on services for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- invites — created_by-based delete policy is untouched (already
-- restrictive). Select/insert/update now owner-scoped. NOTE: this blocks
-- the unauthenticated `#/portal?invite=CODE` code lookup, which currently
-- relies on a public SELECT true policy — that flow needs a narrow
-- code-only public policy or a service-role Cloudflare Function in the
-- app-code phase; not solved in this migration.
drop policy if exists "invites_select" on invites;
drop policy if exists "invites_insert" on invites;
drop policy if exists "invites_update" on invites;
create policy "invites_owner_scoped_select" on invites for select
  using (owner_id = current_owner_id());
create policy "invites_owner_scoped_insert" on invites for insert to authenticated
  with check (owner_id = current_owner_id());
create policy "invites_owner_scoped_update" on invites for update
  using (owner_id = current_owner_id());

-- campaigns (had RLS enabled with zero policies — was already deny-all)
create policy "campaigns_owner_scoped" on campaigns for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 5 (Phase F.1) — per-owner Stripe credentials. Deliberately NO policy
-- for anon/authenticated roles: this table is reachable ONLY from Cloudflare
-- Functions using the Supabase service role key (SUPABASE_SERVICE_ROLE_KEY
-- env var, set in the Cloudflare Pages dashboard — never shipped to the
-- client), which bypasses RLS entirely. Same reasoning as the round-12
-- Stripe secret-key fix (functions/api/stripe-action.ts's header comment)
-- applied per-tenant instead of platform-wide: a Stripe secret key must
-- never be readable through the anon key or ride along in app_settings.data
-- (which IS loaded into every session, including unauthenticated portals).
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.owner_stripe_accounts (
  owner_id text primary key,
  stripe_publishable_key text,
  stripe_secret_key text,
  stripe_webhook_secret text,
  stripe_mode text not null default 'test' check (stripe_mode in ('test', 'live')),
  updated_at timestamptz not null default now()
);

alter table public.owner_stripe_accounts enable row level security;
-- No policies added on purpose — default-deny for anon/authenticated.

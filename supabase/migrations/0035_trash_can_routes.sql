-- Trash Can Cleaning — saved/named routes (TrashCanPage.tsx "Routes" panel).
-- Run this ENTIRE file in the Supabase SQL Editor — the app's anon key
-- cannot run DDL (see CLAUDE.md). Safe to re-run (every statement is
-- idempotent via IF EXISTS/IF NOT EXISTS).
--
-- Distinct from the existing ad-hoc same-day route builder (buildOptimizedRoute
-- in lib/utils.ts, computed on the fly and never persisted) — this table lets
-- the owner save a NAMED, reusable route (e.g. "Tuesday West Side") with an
-- ordered list of customers, editable and re-optimizable at any time.
--
-- Layers on top of migration 0033_multitenant_owner_scoping.sql, which
-- already defines current_owner_id() — reused here, not redefined.

create table if not exists public.trash_can_routes (
  id text primary key,
  owner_id text not null,
  name text not null,
  -- Ordered array of customer ids (JSONB, not a join table) — mirrors the
  -- app's existing preference for JSONB arrays on jobs (checklists, crew)
  -- over normalized child tables for small, whole-row-read/write lists.
  customer_ids jsonb not null default '[]'::jsonb,
  lunch_minutes numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trash_can_routes enable row level security;

drop policy if exists "trash_can_routes_owner_scoped" on trash_can_routes;
create policy "trash_can_routes_owner_scoped" on trash_can_routes for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

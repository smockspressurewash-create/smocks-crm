-- FEATURE — employee-submitted mileage tracking, synced across devices so
-- the owner can see and approve it (the existing ExpensesPage.tsx mileage
-- tab is manual-entry too, but OWNER-side and localStorage-only — an
-- employee logging miles from their own portal had nowhere to write to that
-- the owner could ever see). Manual entry only; no automatic GPS distance
-- tracking exists anywhere in this codebase to build on top of.
-- Run this in the Supabase SQL editor (Project -> SQL Editor).
-- owner_id is nullable, not NOT NULL — this is a single-tenant app (see
-- CLAUDE.md), so there's exactly one owner and no per-tenant scoping is
-- needed; the employee-side submit form has no reliable way to look up the
-- owner's id, and RLS below is already fully permissive regardless.
CREATE TABLE IF NOT EXISTS mileage_logs (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  "from" TEXT,
  "to" TEXT,
  miles NUMERIC NOT NULL DEFAULT 0,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS mileage_logs_employee_id_idx ON mileage_logs (employee_id);
CREATE INDEX IF NOT EXISTS mileage_logs_owner_id_idx ON mileage_logs (owner_id);
CREATE INDEX IF NOT EXISTS mileage_logs_status_idx ON mileage_logs (status);

ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;

-- Single-owner app (see CLAUDE.md) — permissive policy, same as every other
-- table in this project, not scoped per-tenant.
DROP POLICY IF EXISTS mileage_logs_all ON mileage_logs;
CREATE POLICY mileage_logs_all ON mileage_logs FOR ALL USING (true) WITH CHECK (true);

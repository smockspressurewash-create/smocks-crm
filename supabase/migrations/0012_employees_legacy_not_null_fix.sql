-- Run this in the Supabase SQL editor (Project → SQL Editor) — the app's
-- anon key cannot run DDL itself, so these fixes have to be applied manually.

-- ─── FIX 1 (mobile round 4) ─────────────────────────────────────────────────
-- Migration 0011 added the camelCase "firstName"/"lastName"/"hourlyRate"
-- columns this app actually reads/writes, but the ORIGINAL snake_case
-- columns (first_name/last_name/hourly_rate) are still NOT NULL on this
-- project — so every insert/upsert that only supplies the camelCase columns
-- (owner self-assign in App.tsx, the invite pre-create row in
-- EmployeesPage.tsx, the invite-accept insert in EmployeePortal.tsx) fails
-- with "null value in column 'first_name' of relation 'employees' violates
-- not-null constraint", even though PostgREST no longer complains about a
-- missing column. Drop the NOT NULL constraint on the legacy columns so a
-- camelCase-only write succeeds — this is a no-op if a column is already
-- nullable or doesn't exist, so it's safe to run regardless of this
-- project's history.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'first_name') THEN
    ALTER TABLE employees ALTER COLUMN first_name DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'last_name') THEN
    ALTER TABLE employees ALTER COLUMN last_name DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'hourly_rate') THEN
    ALTER TABLE employees ALTER COLUMN hourly_rate DROP NOT NULL;
  END IF;
END $$;

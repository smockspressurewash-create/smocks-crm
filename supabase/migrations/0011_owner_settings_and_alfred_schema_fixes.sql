-- Run this in the Supabase SQL editor (Project → SQL Editor) — the app's
-- anon key cannot run DDL itself, so these fixes have to be applied manually.

-- ─── FIX 1 — employees.firstName/lastName/hourlyRate ───────────────────────
-- The app (owner self-assign, employee invite-accept, EmployeesPage, every
-- crew dropdown/Live Crew View/JobDetailModal) reads/writes these as
-- camelCase. The base `employees` table predates this app's migrations
-- folder and was apparently created with snake_case columns
-- (first_name/last_name/hourly_rate) instead — so PostgREST rejects every
-- insert/upsert that includes "firstName" with "Could not find the
-- 'firstName' column of 'employees' in the schema cache", and the owner's
-- own crew-profile row (and possibly new employee invite-accepts, which use
-- the identical shape) never gets created. Add the camelCase columns and
-- backfill them from the snake_case ones if those exist, so existing
-- employee rows don't lose their names.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "hourlyRate" NUMERIC DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'first_name') THEN
    UPDATE employees SET "firstName" = first_name WHERE "firstName" IS NULL AND first_name IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'last_name') THEN
    UPDATE employees SET "lastName" = last_name WHERE "lastName" IS NULL AND last_name IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'hourly_rate') THEN
    UPDATE employees SET "hourlyRate" = hourly_rate WHERE "hourlyRate" = 0 AND hourly_rate IS NOT NULL;
  END IF;
END $$;

-- ─── FIX 2 — alfred_conversations.owner_id type conflict ───────────────────
-- Migration 0003 created this table with owner_id UUID; migration 0006 (not
-- knowing 0003 already defined it — CREATE TABLE IF NOT EXISTS silently
-- no-ops when the table already exists) assumed owner_id TEXT, matching the
-- convention every other owner_id column in this app uses (app_settings,
-- inbox_threads, job_requests). Whichever one actually ran, normalize to
-- TEXT so it's consistent and a UUID-vs-string comparison can never silently
-- fail to match rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alfred_conversations' AND column_name = 'owner_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE alfred_conversations ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;
  END IF;
END $$;

-- ─── FIX 6 — app_settings table ────────────────────────────────────────────
-- Creates it if this Supabase project never had it (or it was created
-- ad-hoc without a unique constraint on owner_id, which the app's
-- `.upsert(..., { onConflict: "owner_id" })` calls require to resolve
-- conflicts — without one, every settings save fails).
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_owner_id_unique ON app_settings (owner_id);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_all ON app_settings;
CREATE POLICY app_settings_all ON app_settings FOR ALL USING (true) WITH CHECK (true);

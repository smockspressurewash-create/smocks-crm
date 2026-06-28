-- Adds the employee Google-account columns the app reads/writes for per-employee
-- Gmail send + Calendar sync (separate from the owner's Supabase-session token).
-- Run this in the Supabase SQL editor (Project → SQL Editor) — the app's anon
-- key cannot run DDL itself, so this fix has to be applied manually here.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS google_token TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS google_email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "autoSyncCalendar" BOOLEAN DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "locationSharing" BOOLEAN DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "lastLocation" JSONB;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dayClockInAt" BIGINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "paidPeriods" JSONB;

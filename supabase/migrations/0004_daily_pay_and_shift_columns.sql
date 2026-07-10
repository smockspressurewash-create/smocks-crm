-- FIX 3 — per-DAY paid/unpaid marking in the employee Pay tab's calendar view
-- and the owner's Employees > Daily Breakdown, parallel to the existing
-- 14-day paidPeriods column but keyed by individual date (YYYY-MM-DD).
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "paidDays" JSONB;

-- FIX 1 / FIX 2 — if migrations 0001 and 0002 were never actually run against
-- this project, dayClockInAt/dayLunchStartAt/dayPausedMinutes/lastShiftHours/
-- lastShiftDate don't exist, which silently breaks both the Live Team View
-- (employees never show as "on shift") and the Resume Day button (the app
-- can never tell it already logged hours today). Re-asserted here (all
-- IF NOT EXISTS, safe to run even if 0001/0002 already ran) so a single
-- migration file covers a fresh project that skipped straight to this one.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dayClockInAt" BIGINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dayLunchStartAt" BIGINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dayPausedMinutes" NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "lastShiftHours" NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "lastShiftDate" TEXT;

-- FEATURE 5 — employee availability & days-off limits. "availability" (specific
-- blocked dates) was already read/written via `as any` in the app before this
-- migration existed, so it may or may not already exist depending on the
-- project — IF NOT EXISTS makes this safe to run either way.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "availability" JSONB;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "recurringDaysOff" JSONB;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "maxDaysOffPerWeek" NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "maxDaysOffPerMonth" NUMERIC;

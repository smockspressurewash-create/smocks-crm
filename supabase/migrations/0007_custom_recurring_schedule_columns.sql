-- FEATURE 3 — custom recurring job schedules (every X days/weeks/months, or
-- specific weekdays), layered on top of the original preset-only recurringFreq.
-- Missing columns here don't just fail silently — JobDetailModal's updateJob
-- retries with a safe column subset that does NOT include these, so without
-- this migration the fields would only ever exist in local state.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "recurringMode" TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "recurringInterval" NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "recurringWeekdays" JSONB;

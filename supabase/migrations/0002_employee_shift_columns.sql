-- Adds columns for the full "Start My Day" shift-timer feature (pause/resume
-- via lunch, and the last-completed-shift summary the owner sees on the
-- employee's record). Run this in the Supabase SQL editor.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dayLunchStartAt" BIGINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dayPausedMinutes" NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "lastShiftHours" NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "lastShiftDate" TEXT;

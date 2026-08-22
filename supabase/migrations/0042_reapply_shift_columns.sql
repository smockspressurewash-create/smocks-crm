-- 0004_daily_pay_and_shift_columns.sql existed as a file in this repo but was
-- never actually run against this live project (a different, wrong-cased
-- "last_shift_hours" column existed instead of "lastShiftHours", and
-- "lastShiftDate" didn't exist at all) — root cause of "Saved locally, but
-- failed to sync — Could not find the 'lastShiftDate' column" when saving an
-- employee's permissions from the owner CRM (EmployeesPage.tsx's save()
-- writes the whole employee record in one PATCH; one missing column blocked
-- the entire write, including the permissions the owner was actually trying
-- to change). Re-running it here (all IF NOT EXISTS, safe either way).
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "paidDays" JSONB;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dayClockInAt" BIGINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dayLunchStartAt" BIGINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dayPausedMinutes" NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "lastShiftHours" NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "lastShiftDate" TEXT;

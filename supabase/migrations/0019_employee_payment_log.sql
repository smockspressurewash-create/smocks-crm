-- AUDIT — live testing confirmed "Mark as Paid" was never actually working on
-- this deployment: the exact PostgREST error ("Could not find the
-- 'paidPeriods' column of 'employees' in the schema cache") shows that column
-- never existed here at all, despite extensive existing code (EmployeesPage.tsx's
-- markPeriodPaidFor/togglePeriod/toggleDay, going back several rounds of fixes)
-- already reading/writing it. Same story for paidDays (the per-day pay status
-- the employee's own Pay tab calendar and the owner's "Daily Breakdown" both
-- use) — no migration for either of these ever existed in this folder.
-- paymentLog (new, this round) additionally records WHEN a payment was made
-- and how much, needed for the new Payroll Calendar view.
-- Run this in the Supabase SQL editor (Project -> SQL Editor).
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "paidPeriods" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "paidDays" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "paymentLog" JSONB DEFAULT '[]'::jsonb;

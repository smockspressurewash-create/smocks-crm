-- ITEM 5 — "Mark as Paid" already existed (paidPeriods/paidDays), but there
-- was no record of WHEN a payment was made or how much, so there was no way
-- to build a calendar view of payments. EmployeesPage.tsx's markPeriodPaidFor/
-- togglePeriod/toggleDay now append to this new append-only log every time
-- something is marked paid; PayrollCalendar reads it to plot a month grid.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "paymentLog" JSONB DEFAULT '[]'::jsonb;

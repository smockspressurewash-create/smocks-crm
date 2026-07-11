-- AUDIT 2 — payroll/hours defensive re-assert. `loggedHours` on jobs has
-- been read/written by the app for a while (owner Hours/Payroll tabs,
-- employee MyPay tab, the daily pay calendar) but was never actually listed
-- in any migration file here, so there is no durable record that this
-- project's real Supabase table has it. If it's missing, PostgREST rejects
-- the WHOLE update patch that includes it (see CORE_JOB_COLUMNS retry
-- pattern in EmployeePortal.tsx/JobsPage.tsx) — which would silently also
-- drop `status`, explaining "job completes but nothing shows in payroll."
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "loggedHours" NUMERIC;

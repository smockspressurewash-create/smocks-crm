-- FEATURE — per-JOB paid/unpaid marking for employee payroll (owner request:
-- "Payroll Tab ... owner can't mark jobs as paid"). Distinct from the
-- existing paidPeriods (whole 14-day rolling period) and paidDays
-- (per-calendar-day) columns from migration 0019 — this tracks pay status
-- per individual completed job, keyed by job id, so the owner can mark a
-- specific job's labor cost as paid without it being tied to a period.
-- Run this in the Supabase SQL editor (Project -> SQL Editor).
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "paidJobs" JSONB DEFAULT '{}'::jsonb;

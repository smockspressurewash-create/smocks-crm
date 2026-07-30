-- AUDIT — same situation 0016_inbox_threads_table.sql fixed: `job_requests`
-- (the "Request Crew" pending-accept/decline flow — JobDetailModal.tsx's
-- sendJobRequest, JobsPage.tsx's newJobCrewMode "request" path and quick
-- crew-request form, AlfredPage.tsx's request_employee tool, and every
-- accept/decline handler in EmployeePortal.tsx) has been coded against this
-- table for a long time, with every insert's error path literally saying
-- "run the job_requests SQL in Supabase first" — but no migration file for
-- it ever existed in this folder. On a deployment where this table was never
-- manually created (or was created missing a column added later, like
-- denial_reason/scheduled_date), every request insert/update fails outright,
-- which reads as "the request flow doesn't work" even though the app code
-- is correct.
-- Run this in the Supabase SQL editor (Project → SQL Editor).
CREATE TABLE IF NOT EXISTS job_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  denial_reason TEXT,
  scheduled_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- Columns added after initial creation on some deployments — safe no-ops if
-- the table above was just created fresh with them already included.
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS denial_reason TEXT;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS scheduled_date TEXT;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS job_requests_employee_id_idx ON job_requests (employee_id);
CREATE INDEX IF NOT EXISTS job_requests_job_id_idx ON job_requests (job_id);
CREATE INDEX IF NOT EXISTS job_requests_status_idx ON job_requests (status);

ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;

-- Single-owner app (see CLAUDE.md) — permissive policy, same as every other
-- table in this project, not scoped per-tenant.
DROP POLICY IF EXISTS job_requests_all ON job_requests;
CREATE POLICY job_requests_all ON job_requests FOR ALL USING (true) WITH CHECK (true);

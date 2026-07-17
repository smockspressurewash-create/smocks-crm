-- Console error: "Could not find the 'completedAt' column of 'jobs' in the
-- schema cache". EmployeePortal.tsx's finalizeCompletion() has always set
-- completedAt: new Date().toISOString() when a job is marked complete, and
-- JobsPage.tsx's recurring-job generator also writes completedAt: null on the
-- freshly-scheduled next occurrence — but the column was never added to this
-- project's real Supabase table, so PostgREST rejects the whole patch/insert
-- that includes it (see CORE_JOB_COLUMNS retry pattern in EmployeePortal.tsx).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "completedAt" TEXT;

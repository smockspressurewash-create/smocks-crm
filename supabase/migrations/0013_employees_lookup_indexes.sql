-- Run this in the Supabase SQL editor (Project → SQL Editor) — the app's
-- anon key cannot run DDL itself, so these fixes have to be applied manually.

-- FIX 12 (mobile round 6) — "Session bootstrap exceeded 5s" on every load.
-- resolveUserRole (App.tsx) looks up `employees` by user_id on every
-- session resolution (every page load, for every owner/manager/employee),
-- falling back to an email lookup the first time a Google-linked employee
-- signs in before their row has a user_id yet. Neither column had an index,
-- so both lookups were sequential scans on every load.
CREATE INDEX IF NOT EXISTS employees_user_id_idx ON employees (user_id);
CREATE INDEX IF NOT EXISTS employees_email_idx ON employees (email);

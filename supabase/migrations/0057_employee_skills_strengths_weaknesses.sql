-- FEATURE — owner-set skills/strengths/weaknesses per employee (e.g.
-- "doesn't like roofs"), visible on the employee's profile and used as a
-- lightweight job-assignment hint. Run in the Supabase SQL Editor.
alter table employees add column if not exists skills jsonb default '[]'::jsonb;
alter table employees add column if not exists strengths text;
alter table employees add column if not exists weaknesses text;

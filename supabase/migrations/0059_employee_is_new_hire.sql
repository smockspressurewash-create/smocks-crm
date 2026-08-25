-- FEATURE — "Add Team Member" invite flow lets the owner flag someone as a
-- new hire (vs. an existing employee just being added to the CRM directly).
-- Stored on the employee row so it can drive onboarding-progress reporting
-- later. Run in the Supabase SQL Editor. Already applied live.
alter table public.employees add column if not exists "isNewHire" boolean default false;

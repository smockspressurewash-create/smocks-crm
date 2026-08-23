-- FEATURE — Hiring section: a Kanban board of job candidates (Applied ->
-- Interview -> Offer -> Hired, phases are owner-editable in app_settings.data
-- .hiringPhases). Real Supabase table from the start, owner_id-scoped RLS
-- via current_owner_id() same as every other tenant-scoped table
-- (0033_multitenant_owner_scoping.sql) — NOT localStorage-only, since a
-- public "Apply" link (#/apply?oid=OWNER_ID) needs to write candidates that
-- show up on the owner's own device, same reasoning as mileage_logs/
-- alfred_reminders needing real cross-device sync.
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  "firstName" text not null,
  "lastName" text,
  email text,
  phone text,
  phase text not null default 'Applied',
  notes text,
  source text,
  "resumeUrl" text,
  "sortOrder" bigint not null default extract(epoch from now()) * 1000,
  "createdAt" timestamptz not null default now()
);

alter table public.candidates enable row level security;

create policy candidates_owner_scoped on public.candidates
  for all using (owner_id = current_owner_id())
  with check (owner_id = current_owner_id());

-- Public "Apply" page submissions go through functions/api/public-data.ts's
-- submit_job_application action (service role), same pattern as
-- submit_lead_form/submit_trashcan_signup — an anonymous applicant has no
-- session for current_owner_id() to resolve, so the anon-scoped policy above
-- alone can't accept their insert.

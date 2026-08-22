-- Per-employee Google Calendar event id map for a job, e.g.
-- { "<employeeId>": "<googleCalendarEventId>" }. Needed because a job's
-- SINGLE existing "googleEventId" column is the OWNER's own calendar event
-- id — a job with 3 crew assigned needs up to 3 more event ids (one per
-- employee's own personal Google Calendar, if they've connected one),
-- tracked separately so employee-calendar-sync.ts can create/update/delete
-- the right event when crew is assigned/unassigned/rescheduled, without
-- touching the owner's own event.
alter table public.jobs
  add column if not exists "crewGoogleEventIds" jsonb not null default '{}'::jsonb;

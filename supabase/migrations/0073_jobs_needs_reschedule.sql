-- Adds a flag for "marked not-finished / needs a reschedule from the field
-- portal" (EmployeePortal.tsx's "Can't Finish / Reschedule" action), kept
-- distinct from just having no scheduledDate — a job the owner already
-- picked a new date for should still surface in the owner's Unscheduled
-- section (per explicit request) until the owner clears it by confirming
-- the new schedule, not just because a date happens to be blank.
alter table public.jobs add column if not exists "needsReschedule" boolean default false;

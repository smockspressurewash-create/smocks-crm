-- BUG FIX — "it wasn't saving my home base when I entered it as an
-- employee." EmployeePortal.tsx's Home Base field has always written to
-- employees."homeBaseAddress" (used by Auto-Estimate mileage tracking and
-- the "use my home base as the trip origin" GPS fallback), but this
-- column never actually existed on the table — every save 400'd, and
-- while the UI does show a toast on failure, it's easy to miss on mobile
-- and the value still fell back to localStorage-only (never synced
-- cross-device, exactly the "why didn't this save" symptom).
alter table public.employees add column if not exists "homeBaseAddress" text;

-- FEATURE — "jobs should automatically get added to an employee's Google
-- Calendar unless the employee turns it off." The column existed already
-- (migration 0001) but defaulted to FALSE, the opposite of what was
-- actually wanted — a brand-new employee (or one who'd never touched the
-- toggle) silently had auto-sync off with no obvious reason why. Flips the
-- default to TRUE and backfills any row that isn't already explicitly
-- FALSE (i.e. never touched, so there's no real preference to respect) —
-- a row someone genuinely already turned off is left alone.
-- Already applied live via mcp__supabase__apply_migration.
alter table public.employees alter column "autoSyncCalendar" set default true;
update public.employees set "autoSyncCalendar" = true where "autoSyncCalendar" is distinct from false;

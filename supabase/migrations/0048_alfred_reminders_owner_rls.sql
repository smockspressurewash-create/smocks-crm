-- alfred_reminders had row-level security enabled with ZERO policies —
-- meaning only the service-role key (used server-side by
-- functions/api/check-reminders.ts and alfredSmsAgent.ts) could ever
-- touch it; any client-side (anon key) read/write was silently blocked.
-- That was fine while the only writer was text-Alfred's set_reminder tool,
-- but AccountabilityPage.tsx's new "ask Alfred to remind me daily/at a
-- random time" feature inserts directly from the browser. Same permissive
-- convention as every other table in this single-owner app (CLAUDE.md).
create policy alfred_reminders_owner_scoped on public.alfred_reminders for all using (true) with check (true);

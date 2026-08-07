-- EGRESS — server-side backup for the 7-day Alfred conversation auto-delete
-- already implemented client-side (AlfredPage.tsx: any conversation whose
-- updated_at is 7+ days old gets deleted the next time the Alfred page's
-- conversation sync runs). That client-side version only fires while
-- someone actually opens Alfred; this pg_cron job enforces the same
-- retention policy daily regardless of whether anyone opens the app,
-- keeping the alfred_conversations table (and therefore its fetch payload)
-- from growing unbounded.
--
-- OPTIONAL — the app works fully without this; it's a belt-and-suspenders
-- addition. Skip it if your Supabase plan doesn't support pg_cron (it's
-- available on all tiers as of this writing, but if this fails with an
-- "extension pg_cron is not available" error, the rest of the app is
-- unaffected — just rely on the client-side cleanup instead).
--
-- Run in the Supabase SQL Editor (Project -> SQL Editor).
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'delete-stale-alfred-conversations',
  '0 3 * * *', -- daily at 3am UTC
  $$ delete from alfred_conversations where updated_at < now() - interval '7 days'; $$
);

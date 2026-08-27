-- SECURITY FIX — found via a full security/compliance audit. Two policies
-- were effectively USING(true)/ALL-with-no-real-scope, meaning ANY signed-in
-- user (any business, not just the row's own owner) could read/write/delete
-- another tenant's rows through them, even though every other table already
-- follows the real owner_id = current_owner_id() pattern from migration
-- 0033_multitenant_owner_scoping.sql.
--
-- alfred_reminders — contains phone numbers + message text for Alfred's
-- "text me at 3" follow-ups. The wide-open ALL policy meant any other
-- business's signed-in owner/employee could read, edit, or delete these.
drop policy if exists alfred_reminders_owner_scoped on public.alfred_reminders;
create policy alfred_reminders_owner_scoped on public.alfred_reminders
  for all using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- push_subscriptions — the UPDATE policy's qual was `true` (no scoping at
-- all), while its own SELECT/DELETE siblings on the same table were
-- correctly owner-scoped right next to it. Any signed-in user could
-- overwrite another business's push endpoint/keys, silently breaking (or
-- redirecting) that business's push notifications. with_check is left as
-- the existing NOT NULL guard (that part was fine); qual now matches every
-- other policy on this table.
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update using (owner_id = current_owner_id())
  with check ((owner_id is not null) and (endpoint is not null));

-- NOTE — sms_dedupe (Twilio MessageSid dedupe only, no owner_id column, no
-- PII beyond an opaque SID) and reviews_insert_public (owner_id IS NOT NULL
-- only) were reviewed and deliberately left as-is: sms_dedupe holds nothing
-- sensitive and isn't tenant data by nature; reviews_insert_public is only
-- reachable from the app via public-data.ts, which resolves owner_id
-- server-side from a real customerId lookup before ever inserting, so the
-- permissive INSERT check isn't independently exploitable through the
-- app's own UI (it would only matter to someone hitting PostgREST directly
-- with a spoofed owner_id, a lower-severity residual risk noted for a
-- future pass, not fixed here).

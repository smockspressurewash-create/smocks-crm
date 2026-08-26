-- FEATURE — real Web Push notifications (owner requested "actual push
-- notifications for mobile when you download it, for iPhones and
-- Androids"). One row per device that's opted in (a phone can have more
-- than one — home screen app + a browser tab, for instance). `endpoint` is
-- the push service URL the browser/OS gave us (unique per device+browser
-- install) — used as the natural dedupe key on re-subscribe.
--
-- Sending goes through functions/api/send-push.ts using the SERVICE ROLE
-- key (bypasses RLS entirely, same as every other service-role-only flow in
-- this app), so the RLS below only matters for the client-side subscribe
-- flow itself, not for actually delivering notifications.
--
-- Run in the Supabase SQL Editor.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  employee_id text,
  customer_id uuid,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Any signed-in session (owner, employee, or an unauthenticated-to-Postgres
-- customer session under ClientAuthPortal's own Supabase auth) can register
-- its OWN device — owner_id is trusted from the client here the same way
-- several other insert paths in this app already trust a client-supplied
-- owner_id (see App.tsx's own direct writes), since current_owner_id()
-- can't resolve a customer session (it only looks up via `employees`).
create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert
  with check (owner_id is not null and endpoint is not null);

-- Re-subscribing (same endpoint, refreshed keys) updates in place rather
-- than erroring on the unique constraint.
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update
  using (true)
  with check (owner_id is not null and endpoint is not null);

-- Owner/employee sessions (current_owner_id() resolves both, per every
-- other table's policy) can list/remove their own tenant's registered
-- devices — e.g. an "Enabled on 2 devices" status line, or explicitly
-- turning notifications off.
create policy "push_subscriptions_owner_read" on public.push_subscriptions
  for select
  using (owner_id = public.current_owner_id());

create policy "push_subscriptions_owner_delete" on public.push_subscriptions
  for delete
  using (owner_id = public.current_owner_id());

create index if not exists push_subscriptions_owner_idx on public.push_subscriptions (owner_id);

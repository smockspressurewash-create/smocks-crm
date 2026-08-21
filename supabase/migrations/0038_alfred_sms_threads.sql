-- 0038_alfred_sms_threads.sql
-- FEATURE — two-way SMS conversations with Alfred (the AI assistant). An
-- owner can text their own CRM Twilio number from their personal phone
-- (settings.myPhone, matched in functions/api/twilio-sms-webhook.ts) and
-- have Alfred read/act on the CRM (schedule jobs, reschedule, assign crew,
-- text customers, report status) via SMS. This table holds the rolling
-- conversation history per owner+phone so replies stay contextual across
-- multiple texts, the same way the in-app Alfred chat keeps history.
--
-- Safe to re-run: every statement below is guarded (IF NOT EXISTS / DROP ...
-- IF EXISTS before CREATE POLICY, since Postgres has no CREATE POLICY IF NOT
-- EXISTS).

create table if not exists public.alfred_sms_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  phone text not null,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists alfred_sms_threads_owner_phone_idx
  on public.alfred_sms_threads (owner_id, phone);

alter table public.alfred_sms_threads enable row level security;

-- Same reasoning as owner_stripe_accounts (see 0033) — this table is written
-- exclusively by the Twilio SMS webhook Cloudflare Function using the
-- service-role key, never the anon/authenticated client, so it deliberately
-- gets NO policy for anon/authenticated roles.
drop policy if exists "alfred_sms_threads_owner_read" on public.alfred_sms_threads;
create policy "alfred_sms_threads_owner_read" on public.alfred_sms_threads
  for select using (owner_id = current_owner_id());

-- Twilio can (and does, per an owner report of Alfred replying twice to one
-- text) redeliver the SAME inbound webhook more than once — usually when
-- the response takes long enough that Twilio's own retry policy kicks in.
-- twilio-sms-webhook.ts already deduped the INBOUND message log by
-- MessageSid, but nothing stopped the agent itself from being invoked (and
-- a real second SMS reply sent) a second time for the same inbound
-- message — that's the actual cause of the duplicate "Will what?" replies
-- found in inbox_threads. This table is a simple atomic dedupe: the first
-- delivery of a given MessageSid successfully inserts and proceeds
-- normally; any redelivery hits the primary key conflict and is dropped
-- before the agent (or any SMS send) ever runs.
create table if not exists public.sms_dedupe (
  sid text primary key,
  created_at timestamptz not null default now()
);
alter table public.sms_dedupe enable row level security;
create policy sms_dedupe_all on public.sms_dedupe for all using (true) with check (true);

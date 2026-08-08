-- Twilio A2P "via text" keyword opt-in (double opt-in) — texting the
-- configured keyword (Settings -> Integrations -> Twilio, default "DEALS")
-- sets smsOptInPending and sends a confirmation request; only a Y/YES reply
-- flips smsOptIn to true. See functions/api/twilio-sms-webhook.ts.
-- Run this in the Supabase SQL editor (Project -> SQL Editor).
alter table customers add column if not exists "smsOptInPending" boolean default false;
alter table customers add column if not exists "smsOptInPendingAt" text;

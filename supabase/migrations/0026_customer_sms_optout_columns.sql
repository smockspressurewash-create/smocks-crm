-- SMS opt-out enforcement (Twilio A2P compliance audit) — Customer.smsOptOut
-- and Customer.optOutDate have existed in the TypeScript type for a while
-- (useAutomationEngine.ts's sendOne already gated automation sends on
-- smsOptOut), but nothing ever actually SET them, and there was never a
-- migration creating these columns either — so even after wiring up real
-- STOP-reply handling (InboxPage.tsx polling + functions/api/twilio-sms-
-- webhook.ts), the write would have 400'd with "column does not exist"
-- until this runs. Run in the Supabase SQL Editor.
alter table customers add column if not exists "smsOptOut" boolean default false;
alter table customers add column if not exists "optOutDate" text;

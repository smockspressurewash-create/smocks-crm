-- Round 13 batch — new columns for:
--   * Trash Can Cleaning (items 16-23): jobs gain a service category +
--     can count + inconvenience-fee tracking.
--   * Testing Mode (item 12): customers gain an isTestClient flag.
--   * Mandatory/optional deposits (item 4): estimates gain a flag.
-- Run in the Supabase SQL Editor.
alter table jobs add column if not exists "serviceCategory" text;
alter table jobs add column if not exists "cansCount" numeric;
alter table jobs add column if not exists "inconvenienceFeeCharged" numeric;
alter table jobs add column if not exists "inconvenienceFeeChargedAt" text;

-- Client-portal reschedule requests (item 7).
alter table jobs add column if not exists "rescheduleRequested" boolean default false;
alter table jobs add column if not exists "rescheduleRequestNote" text;
alter table jobs add column if not exists "rescheduleRequestedAt" text;

alter table customers add column if not exists "isTestClient" boolean default false;

alter table estimates add column if not exists "depositMandatory" boolean default false;

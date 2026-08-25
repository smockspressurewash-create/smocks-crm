-- FEATURE — job application form now asks about strengths/weaknesses
-- (owner request), stored alongside the rest of the candidate record.
-- Run in the Supabase SQL Editor. Already applied live.
alter table public.candidates add column if not exists "strengths" text;
alter table public.candidates add column if not exists "weaknesses" text;

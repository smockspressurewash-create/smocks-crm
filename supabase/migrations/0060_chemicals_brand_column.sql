-- BUG FIX — console error "Could not find the 'brand' column of 'chemicals'
-- in the schema cache" on every chemicals auto-save. The chemicals list UI
-- (ChemicalsPage.tsx) reads/displays c.brand, but the chemicals table
-- (migration 0056) never had this column, so every upsert including it
-- failed outright (PostgREST rejects the whole write if any column is
-- unknown). Run in the Supabase SQL Editor. Already applied live.
alter table public.chemicals add column if not exists "brand" text;

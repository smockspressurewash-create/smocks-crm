-- FEATURE — equipment items can now have a dedicated maintenance contact
-- (distinct from a chemical supplier). Run in the Supabase SQL Editor.
-- Already applied live.
alter table public.chemicals add column if not exists "maintenanceContactName" text;
alter table public.chemicals add column if not exists "maintenanceContactPhone" text;

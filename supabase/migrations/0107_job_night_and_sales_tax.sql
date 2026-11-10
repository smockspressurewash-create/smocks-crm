-- Work orders: night job flag, and sales tax on jobs / work orders.
-- Run this whole file in the Supabase SQL Editor. Safe to re-run.
--
-- isNightJob: the work order form has always saved it, but no migration
-- ever added the column, so saving a work order failed with
-- "Could not find the 'isNightJob' column of 'jobs' in the schema cache".
-- tax / taxRate: a job's amount is what the customer pays, tax included;
-- tax is the sales tax part of it and taxRate the percent used.
alter table public.jobs add column if not exists "isNightJob" boolean not null default false;
alter table public.jobs add column if not exists "tax" numeric not null default 0;
alter table public.jobs add column if not exists "taxRate" numeric;
notify pgrst, 'reload schema';

-- Run in the Supabase SQL Editor (or applied live via mcp__supabase__apply_migration).

-- BUG FIX — sop_documents was defined in migration 0032 but was never
-- actually created in the live database (PostgREST 404 "Could not find the
-- table 'public.sop_documents' in the schema cache" on every SOP save).
-- Recreated here, owner-scoped per the migration-0033 multi-tenant
-- convention, plus the fields needed for real SOP management: which
-- employees it's assigned to, a checklist, and a daily/monthly/general
-- frequency tag.
create table if not exists sop_documents (
  id text primary key,
  owner_id text,
  title text not null,
  kind text not null default 'markdown', -- 'markdown' | 'pdf'
  content text,           -- markdown body, when kind = 'markdown'
  file_url text,          -- data: URL, when kind = 'pdf'
  frequency text default 'general', -- 'daily' | 'monthly' | 'general'
  "assignedEmployeeIds" jsonb default '[]'::jsonb, -- [] = visible to every employee
  checklist jsonb default '[]'::jsonb, -- [{ id, text, done }]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table sop_documents add column if not exists owner_id text;
alter table sop_documents add column if not exists frequency text default 'general';
alter table sop_documents add column if not exists "assignedEmployeeIds" jsonb default '[]'::jsonb;
alter table sop_documents add column if not exists checklist jsonb default '[]'::jsonb;
alter table sop_documents enable row level security;
drop policy if exists "sop_documents_all" on sop_documents;
drop policy if exists "sop_documents_owner_scoped" on sop_documents;
create policy "sop_documents_owner_scoped" on sop_documents for all using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

-- BUG FIX — promotions' live schema still had its original snake_case column
-- names (discount_type, valid_from, valid_until, usage_count, usage_limit)
-- from before the Promotion type was rewritten to camelCase field names
-- (discountType, validFrom, validTo, usageLimit, channel, status, etc.) —
-- every save has been silently failing ("Could not find the 'channel'
-- column of 'promotions' in the schema cache") since that rewrite, because
-- PromotionsPage.tsx upserts the whole in-memory object and PostgREST
-- rejects the entire write if any key in the payload has no matching
-- column. Adding the columns the app actually writes today rather than
-- renaming the old ones, to avoid any risk to existing rows.
alter table promotions add column if not exists description text;
alter table promotions add column if not exists "discountType" text;
alter table promotions add column if not exists "discountValue" numeric;
alter table promotions add column if not exists "validFrom" text;
alter table promotions add column if not exists "validTo" text;
alter table promotions add column if not exists "serviceRestrictions" jsonb;
alter table promotions add column if not exists "usageLimit" numeric;
alter table promotions add column if not exists "audienceTag" text;
alter table promotions add column if not exists "audienceFolder" text;
alter table promotions add column if not exists "audienceCity" text;
alter table promotions add column if not exists "audienceLastServiceBefore" numeric;
alter table promotions add column if not exists "audienceCustomerIds" jsonb;
alter table promotions add column if not exists channel text;
alter table promotions add column if not exists status text default 'draft';
alter table promotions add column if not exists "sentAt" text;
alter table promotions add column if not exists "sentCount" numeric;
alter table promotions add column if not exists "openedCount" numeric;
alter table promotions add column if not exists "redeemedCount" numeric;
alter table promotions add column if not exists "createdAt" text;

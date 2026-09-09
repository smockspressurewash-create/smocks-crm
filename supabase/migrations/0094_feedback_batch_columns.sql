-- Batch of new columns/tables for a large owner-feedback round. Run this
-- whole file once in the Supabase SQL Editor (the anon key can't run DDL —
-- see CLAUDE.md's Database section). Every ALTER TABLE below is
-- IF NOT EXISTS / safe to re-run.

-- ── Review nudge in the customer portal — "prompt if they haven't reviewed
-- yet." Stamped by public-data.ts's submit_review action; ClientAuthPortal.tsx
-- shows a nudge banner when this is null and the customer has a completed job.
alter table public.customers add column if not exists "reviewSubmittedAt" timestamptz;

-- ── "Don't send a review request after this job" — a job-level opt-out an
-- employee/owner can set from the Report a Problem area, independent of the
-- owner's global review-automation settings.
alter table public.jobs add column if not exists "skipReviewRequest" boolean not null default false;

-- ── Commercial/night job work orders. A work order is still a `jobs` row
-- (same table, same portal, same crew-assignment/checklist machinery) with
-- extra fields describing the stricter commercial workflow — not a separate
-- entity, matching this app's existing "invoices are just estimates with
-- invoiced:true" convention (see CLAUDE.md).
alter table public.jobs add column if not exists "isWorkOrder" boolean not null default false;
alter table public.jobs add column if not exists "workOrderNumber" text;
alter table public.jobs add column if not exists "workOrderClient" text; -- e.g. "Home Depot #4521"
alter table public.jobs add column if not exists "requiresManagerSignoff" boolean not null default false;
-- photoRequirements: [{ id, label, kind: "photo"|"video", minCount, instructions }]
alter table public.jobs add column if not exists "photoRequirements" jsonb not null default '[]'::jsonb;
-- Per-photo tag linking an uploaded photo to which requirement it satisfies —
-- photos themselves already live in jobs.photos (existing column); this maps
-- photo id -> requirement id so progress can be computed without re-modeling
-- the existing photo array.
alter table public.jobs add column if not exists "photoRequirementTags" jsonb not null default '{}'::jsonb;
alter table public.jobs add column if not exists "managerSignatureDataUrl" text;
alter table public.jobs add column if not exists "managerSignedAt" timestamptz;
alter table public.jobs add column if not exists "managerSignedBy" text;
alter table public.jobs add column if not exists "workOrderSummary" text; -- Alfred-generated branded summary text
alter table public.jobs add column if not exists "workOrderSummarySentAt" timestamptz;
alter table public.jobs add column if not exists "workOrderNotes" jsonb not null default '[]'::jsonb; -- [{id,text,at,by}]

-- ── Alfred's per-owner work-order email template (subject/body/branding
-- instructions) — lives in app_settings.data (JSONB blob), no new column
-- needed there; this comment documents the shape for anyone reading the
-- schema fresh: settings.workOrderEmailTemplate = { subject, bodyInstructions,
-- maxWords, includeLogo, includeSignature }.

-- ── Trash-can holiday-aware routing — settings.trashCanHolidaySkip /
-- settings.trashCanHolidayDates live in app_settings.data (JSONB), no new
-- column needed. Documented here so the schema audit trail is complete.

-- ── CRM-subscriber-to-subscriber referral program (owner invites another
-- business owner to CrewBoss) — separate from the existing customer-refers-
-- customer program (ReferralsPage.tsx/customers.referralCode).
alter table public.platform_subscriptions add column if not exists "referralCode" text;
alter table public.platform_subscriptions add column if not exists "referredByCode" text;
alter table public.platform_subscriptions add column if not exists "referralDiscountAppliedAt" timestamptz;
alter table public.platform_subscriptions add column if not exists "trialDiscountEmailSentAt" timestamptz;

create unique index if not exists platform_subscriptions_referral_code_idx
  on public.platform_subscriptions ("referralCode") where "referralCode" is not null;

-- owner_referral_credits — records each successful referral so both sides'
-- discount is auditable/reversible (not just a running counter). One row per
-- referred signup.
create table if not exists public.owner_referral_credits (
  id uuid primary key default gen_random_uuid(),
  referrer_owner_id text not null,
  referred_owner_id text not null unique,
  referral_code text not null,
  referrer_discount_percent int not null default 20,
  referee_discount_percent int not null default 20,
  applied_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','reversed'))
);
alter table public.owner_referral_credits enable row level security;
drop policy if exists owner_referral_credits_owner_scoped on public.owner_referral_credits;
create policy owner_referral_credits_owner_scoped on public.owner_referral_credits
  for select using (referrer_owner_id = current_owner_id() or referred_owner_id = current_owner_id());
-- Deliberately no insert/update/delete policy for anon/authenticated — this
-- table is written exclusively by platform-billing.ts using the service role
-- key (same reasoning as owner_stripe_accounts), never directly by a client.

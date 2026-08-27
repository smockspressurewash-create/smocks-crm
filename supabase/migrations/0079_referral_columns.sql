-- Referral tracking/crediting was completely broken: referredBy,
-- referralCreditOwed, and referralCreditApplied are all read/written
-- throughout ReferralLanding.tsx/ReferralsPage.tsx/JobsPage.tsx but never
-- existed as real columns on customers. PostgREST rejects any insert/update
-- containing an unrecognized column, so every referral signup (which sets
-- referredBy) and every automatic referral-credit award (which sets
-- referralCreditOwed) has been silently failing since these features were
-- built. CamelCase names double-quoted per CLAUDE.md's Postgres column
-- folding note.
alter table public.customers add column if not exists "referredBy" text;
alter table public.customers add column if not exists "referralCreditOwed" numeric default 0;
alter table public.customers add column if not exists "referralCreditApplied" numeric default 0;

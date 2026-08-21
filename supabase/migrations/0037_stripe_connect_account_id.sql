-- Stripe Connect — adds the connected account id column. Run in the
-- Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
--
-- Owners who complete the "Connect with Stripe" OAuth flow (Settings →
-- Integrations → Stripe → Connect with Stripe) get their stripe_account_id
-- (acct_...) stored here by functions/api/stripe-connect-oauth.ts. This
-- column coexists with the pre-existing stripe_secret_key/stripe_webhook_secret
-- manual-key columns (migration 0033) — an owner with stripe_account_id set
-- uses Connect (this platform's own STRIPE_SECRET_KEY + a Stripe-Account
-- header, see functions/api/stripe-action.ts), an owner without it but with
-- stripe_secret_key set uses their own raw key (the original per-owner
-- flow) — both keep working, Connect is simply the newer/recommended path.

alter table public.owner_stripe_accounts add column if not exists stripe_account_id text;

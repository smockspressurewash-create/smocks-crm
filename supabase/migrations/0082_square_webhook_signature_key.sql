-- 0082_square_webhook_signature_key.sql
--
-- AUDIT FIX — Square recurring subscriptions had NO webhook/status sync at
-- all (functions/api/square-action.ts's create_square_recurring_plan
-- comment openly flagged this as out of scope). A declined renewal or a
-- subscription cancelled from Square's own dashboard was invisible to the
-- CRM forever — customers.recurringPlan.status just stayed "active".
--
-- This column stores the per-owner Signature Key Square hands out when you
-- create a webhook subscription (Square Developer Dashboard → your app →
-- Webhooks → Subscriptions → Signature Key) — needed to verify that an
-- incoming webhook call really came from Square (see
-- functions/api/square-webhook.ts), the same role stripe_webhook_secret
-- already plays for owner_stripe_accounts.
--
-- Run this in the Supabase SQL Editor.

alter table public.owner_square_accounts
  add column if not exists square_webhook_signature_key text;

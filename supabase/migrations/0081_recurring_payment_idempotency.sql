-- 0081_recurring_payment_idempotency.sql
--
-- AUDIT FIX — functions/api/stripe-webhook.ts's `invoice.paid` handler
-- (recordRecurringPayment) inserted a brand-new `estimates` row for every
-- delivery of that event with no de-duplication at all. Stripe delivers
-- webhooks AT LEAST ONCE (retries on any non-2xx response from this
-- endpoint, plus a manual "Resend" from the Stripe dashboard) — any
-- redelivery of the same invoice.paid event created a second, third, etc.
-- duplicate "paid" invoice for the exact same real recurring charge,
-- inflating revenue totals shown in Dashboard/Invoices.
--
-- This column lets the webhook check "have I already recorded THIS Stripe
-- invoice?" before inserting, the same way stripePaymentIntentId already
-- disambiguates one-time payments elsewhere in this table.
--
-- Run this in the Supabase SQL Editor (this repo has no backend server that
-- can run DDL with the anon key — see CLAUDE.md's Database section).

alter table public.estimates
  add column if not exists "stripeInvoiceId" text;

create index if not exists estimates_stripe_invoice_id_idx
  on public.estimates ("stripeInvoiceId")
  where "stripeInvoiceId" is not null;

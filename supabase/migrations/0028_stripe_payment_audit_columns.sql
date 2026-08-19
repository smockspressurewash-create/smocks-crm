-- Stripe payment security/audit (round 12) — functions/api/stripe-webhook.ts
-- now handles payment_intent.payment_failed, charge.refunded, and
-- charge.dispute.created (previously only checkout.session.completed/
-- checkout.session.async_payment_succeeded/payment_intent.succeeded were
-- handled), and logs every payment event to a per-invoice history instead of
-- only ever recording the most recent paidAt. Run in the Supabase SQL Editor.
alter table estimates add column if not exists "paymentFailedAt" text;
alter table estimates add column if not exists "refundedAt" text;
alter table estimates add column if not exists "disputedAt" text;
alter table estimates add column if not exists "paymentLog" jsonb default '[]'::jsonb;

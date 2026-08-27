-- 0083_square_invoice_idempotency.sql
--
-- Companion to 0081 (stripeInvoiceId dedup) for Square's own recurring
-- invoice payments, recorded by functions/api/square-webhook.ts. Square
-- also redelivers webhooks on a non-2xx response, so the same
-- "have I already recorded this one" check is needed here.

alter table public.estimates
  add column if not exists "squareInvoiceId" text;

create index if not exists estimates_square_invoice_id_idx
  on public.estimates ("squareInvoiceId")
  where "squareInvoiceId" is not null;

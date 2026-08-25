-- Adds the saved-card columns already referenced throughout the app
-- (CustomerDetail.tsx, ClientAuthPortal.tsx, SaveCardModal.tsx,
-- types/index.ts) but never actually created in the database. Every
-- "save card" write was silently rejected by PostgREST (column does not
-- exist) and swallowed by a .catch(console.warn) that still showed
-- "Card saved ✓" to the user — the card really was saved on Stripe's
-- side, but the CRM lost the link back to it the moment the page
-- reloaded, so it never displayed on the customer profile. Same
-- "missing column -> whole write silently rejected" bug class documented
-- in CLAUDE.md's Database section.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "stripeCustomerId" text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "savedPaymentMethodId" text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "savedPaymentMethodLabel" text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "cardConsentAt" text;

-- Recurring billing (Stripe subscriptions + Square subscriptions) — owner
-- can set up a recurring charge against one of their own customers.
-- "recurringPlan" is camelCase and MUST stay double-quoted here — an
-- unquoted identifier folds to lowercase in Postgres and every app read/
-- write (customers.recurringPlan) would then silently miss it. See
-- CLAUDE.md's "Postgres folds unquoted column identifiers" note.
alter table public.customers add column if not exists "recurringPlan" jsonb;

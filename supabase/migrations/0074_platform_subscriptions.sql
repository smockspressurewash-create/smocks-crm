-- FEATURE — "help me set it up so I get paid" — the SaaS-level billing
-- table (the PLATFORM charging each signed-up business a subscription),
-- completely separate from owner_stripe_accounts (which is for THAT
-- business charging ITS OWN customers). Written by platform-billing.ts /
-- platform-billing-webhook.ts using the service-role key (owner_id is
-- always resolved server-side from the caller's own JWT or a webhook's
-- verified event, never trusted from a client body) — the owner can only
-- ever READ their own row directly (status/plan/trial countdown for the
-- Settings → Billing UI), never write it.
create table if not exists public.platform_subscriptions (
  owner_id text primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'trialing', -- trialing | active | past_due | canceled
  plan text,     -- solo | crew | growth
  "interval" text, -- month | year
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platform_subscriptions enable row level security;
drop policy if exists platform_subscriptions_owner_read on public.platform_subscriptions;
create policy platform_subscriptions_owner_read on public.platform_subscriptions
  for select using (owner_id = current_owner_id());
-- Deliberately no insert/update/delete policy for anon/authenticated —
-- every write goes through platform-billing.ts / platform-billing-webhook.ts
-- with the service-role key, same trust model as owner_stripe_accounts.

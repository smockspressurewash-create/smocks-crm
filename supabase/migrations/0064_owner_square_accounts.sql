-- FEATURE — Square as an alternative payment provider to Stripe (owner
-- request: "give another option for users to connect payments... free on
-- our end... switch between each one easily"). Mirrors owner_stripe_accounts
-- exactly — service-role-only, never reachable from the client. Run in the
-- Supabase SQL Editor. Already applied live.
create table if not exists public.owner_square_accounts (
  owner_id text primary key,
  square_access_token text,
  square_location_id text,
  square_application_id text,
  square_mode text not null default 'sandbox' check (square_mode in ('sandbox','production')),
  updated_at timestamptz not null default now()
);
alter table public.owner_square_accounts enable row level security;
-- No policy for anon/authenticated — service-role-only.

-- Backs the customer-facing Alfred auto-response feature (opt-in per
-- customer, off by default — see customers."alfredAutoRespond" below).
-- functions/api/_lib/alfredCustomerAgent.ts runs a deliberately narrow
-- agent for inbound texts from customers who've been opted in: it can
-- answer routine questions directly (hours/pricing/their own appointment
-- status), but anything that changes a booking or involves money creates a
-- row here and texts the OWNER for a yes/no first — see
-- functions/api/_lib/alfredSmsAgent.ts's list_pending_customer_requests/
-- approve_customer_request/decline_customer_request tools, which the
-- owner's own Alfred conversation uses to resolve them.
create table if not exists public.alfred_pending_actions (
  id text primary key,
  owner_id text not null,
  customer_id text not null,
  job_id text,
  kind text not null, -- e.g. 'reschedule'
  proposed jsonb not null default '{}'::jsonb,
  customer_phone text not null,
  status text not null default 'pending', -- pending | approved | declined
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.alfred_pending_actions enable row level security;
create index if not exists alfred_pending_actions_owner_status_idx on public.alfred_pending_actions (owner_id, status);

-- Postgres folds unquoted camelCase to lowercase — must double-quote it
-- (see CLAUDE.md's Database section) or this lands as "alfredautorespond".
alter table public.customers add column if not exists "alfredAutoRespond" boolean not null default false;

-- Backs Alfred's SMS "remind me..." feature (functions/api/_lib/alfredSmsAgent.ts's
-- set_reminder/list_reminders/cancel_reminder tools) and the cron-triggered
-- functions/api/check-reminders.ts endpoint that actually sends them when due.
-- Service-role-only, same reasoning as owner_stripe_accounts — nothing in the
-- client app touches this table directly.
create table if not exists public.alfred_reminders (
  id text primary key,
  owner_id text not null,
  phone text not null,
  message text not null,
  due_at timestamptz not null,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.alfred_reminders enable row level security;
create index if not exists alfred_reminders_due_idx on public.alfred_reminders (due_at) where not sent;

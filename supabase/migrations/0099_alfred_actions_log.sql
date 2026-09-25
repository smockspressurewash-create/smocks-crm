-- FEATURE (user report) — "Alfred should remember what it did last. If a
-- day later — or even five minutes later — I say 'undo that' or 'what did
-- you do' or 'delete those' or 'change them,' it should know what I'm
-- referring to." The in-conversation undo stack (AlfredPage.tsx's
-- lastActionsRef) only lives in memory for the current browser session —
-- a reload, a new tab, or coming back the next day loses it entirely. This
-- table is the durable version: every reversible action Alfred takes gets
-- logged here (not just kept in memory), so undo_last_action/
-- list_recent_actions can look back across sessions, not just the current
-- one.
create table if not exists public.alfred_actions_log (
  id text primary key,
  owner_id text not null,
  tool_name text not null,
  label text not null,
  undo_kind text not null,
  undo_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
alter table public.alfred_actions_log enable row level security;

drop policy if exists alfred_actions_log_owner_scoped on public.alfred_actions_log;
create policy alfred_actions_log_owner_scoped on public.alfred_actions_log for all
  using (owner_id = current_owner_id())
  with check (owner_id = current_owner_id());

create index if not exists alfred_actions_log_owner_created_idx on public.alfred_actions_log (owner_id, created_at desc);

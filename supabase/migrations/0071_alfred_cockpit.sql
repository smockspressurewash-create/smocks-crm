-- FEATURE — "Alfred Cockpit": an in-app section, gated to the owner's own
-- personal email, for reporting bugs/ideas to Claude from a phone and
-- tracking them on a kanban board (backlog / in progress / done) without
-- needing this terminal session open. A human (Claude, working the same
-- way as this whole conversation) reads/updates this table directly via
-- Supabase MCP — there is no live "Claude usage limit" API to read from,
-- so that specific ask isn't representable as a column; everything else
-- requested (kanban status, type, notes, timestamps) is.
create table if not exists public.cockpit_items (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  title text not null,
  description text default '',
  type text not null default 'bug' check (type in ('bug', 'idea', 'question')),
  status text not null default 'backlog' check (status in ('backlog', 'in_progress', 'done')),
  claude_notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cockpit_items enable row level security;
create policy cockpit_items_owner_scoped on public.cockpit_items
  for all using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

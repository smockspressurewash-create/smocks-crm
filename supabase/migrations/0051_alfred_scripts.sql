-- Run in the Supabase SQL Editor (or applied live via mcp__supabase__apply_migration).

-- FEATURE — Alfred content-script generator (viral video scripts/ideas the
-- owner swipes right to save / left to pass on, in the new Alfred "Scripts"
-- panel). Owner-scoped per the migration-0033 multi-tenant convention —
-- current_owner_id() already exists live, same pattern as sop_documents
-- (0050) and alfred_reminders (0041).
create table if not exists alfred_scripts (
  id text primary key,
  owner_id text not null,
  category text not null default 'informational', -- 'commercial' | 'funny_short' | 'long_form' | 'informational' | 'viral_idea'
  title text,
  script_content text not null,
  status text not null default 'saved', -- 'saved' | 'declined'
  source text not null default 'ai_generated', -- 'ai_generated' | 'custom'
  photo_url text, -- optional before/after job photo picked to pair with this script
  job_id text,
  created_at timestamptz not null default now()
);
alter table alfred_scripts add column if not exists owner_id text;
alter table alfred_scripts add column if not exists category text default 'informational';
alter table alfred_scripts add column if not exists title text;
alter table alfred_scripts add column if not exists script_content text;
alter table alfred_scripts add column if not exists status text default 'saved';
alter table alfred_scripts add column if not exists source text default 'ai_generated';
alter table alfred_scripts add column if not exists photo_url text;
alter table alfred_scripts add column if not exists job_id text;
alter table alfred_scripts enable row level security;
drop policy if exists "alfred_scripts_all" on alfred_scripts;
drop policy if exists "alfred_scripts_owner_scoped" on alfred_scripts;
create policy "alfred_scripts_owner_scoped" on alfred_scripts for all using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());
create index if not exists alfred_scripts_owner_status_idx on alfred_scripts (owner_id, status);

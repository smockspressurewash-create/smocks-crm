-- FEATURE — public product feedback/roadmap board. Cross-tenant by design
-- (this is feedback about CrewBoss the PRODUCT, not any one business's
-- data) — deliberately NOT owner_id-scoped like every other table in this
-- app. Submitting/voting requires being signed in (any CrewBoss owner or
-- employee, any tenant); reading is fully public (logged-out landing-page
-- visitors can see the public roadmap — planned/in-progress/done items);
-- only the platform admin (smockspressurewash@gmail.com) can change status.
create table if not exists public.feedback_items (
  id text primary key,
  title text not null,
  description text,
  type text not null default 'feature' check (type in ('bug', 'feature')),
  status text not null default 'submitted' check (status in ('submitted', 'planned', 'in_progress', 'done', 'declined')),
  submitted_by_email text,
  submitted_by_name text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.feedback_items enable row level security;

drop policy if exists feedback_items_public_read on public.feedback_items;
create policy feedback_items_public_read on public.feedback_items for select using (true);

drop policy if exists feedback_items_auth_insert on public.feedback_items;
create policy feedback_items_auth_insert on public.feedback_items for insert
  with check (auth.uid() is not null);

drop policy if exists feedback_items_admin_update on public.feedback_items;
create policy feedback_items_admin_update on public.feedback_items for update
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'smockspressurewash@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'smockspressurewash@gmail.com');

drop policy if exists feedback_items_admin_delete on public.feedback_items;
create policy feedback_items_admin_delete on public.feedback_items for delete
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'smockspressurewash@gmail.com');

-- One vote per (item, voter) — a real unique constraint prevents a client
-- bug or a determined user from stuffing votes, not just UI throttling.
create table if not exists public.feedback_votes (
  feedback_id text not null references public.feedback_items(id) on delete cascade,
  voter_id text not null, -- auth.uid() of the voter
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (feedback_id, voter_id)
);
alter table public.feedback_votes enable row level security;

drop policy if exists feedback_votes_public_read on public.feedback_votes;
create policy feedback_votes_public_read on public.feedback_votes for select using (true);

drop policy if exists feedback_votes_own_write on public.feedback_votes;
create policy feedback_votes_own_write on public.feedback_votes for all
  using (voter_id = auth.uid()::text)
  with check (voter_id = auth.uid()::text);

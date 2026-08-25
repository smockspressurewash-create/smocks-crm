-- FEATURE — Chemicals & Equipment (stock, reorder levels, per-item supplier
-- contacts) has only ever lived in usePersistent localStorage — it never
-- had a Supabase table at all, so it never synced cross-device AND
-- text-Alfred/the SMS agent (server-side, no access to a browser's
-- localStorage) had no way to read it — a hard blocker for giving Alfred
-- real check_stock/text_supplier/email_supplier tools over SMS to match
-- what the in-app chat could already do. Run in the Supabase SQL Editor.
create table if not exists public.chemicals (
  id text primary key,
  owner_id text not null default current_owner_id(),
  name text not null,
  "itemType" text default 'chemical', -- 'chemical' | 'equipment'
  stock numeric default 0,
  unit text,
  "unitCost" numeric default 0,
  "reorderLevel" numeric default 0,
  supplier text, -- deprecated single-string fallback, mirrors the TS type
  suppliers jsonb default '[]'::jsonb, -- [{id, name, phone, email, notes}]
  notes text,
  "lastOrdered" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chemicals enable row level security;

drop policy if exists "chemicals_all" on public.chemicals;
drop policy if exists "chemicals_owner_scoped" on public.chemicals;
create policy "chemicals_owner_scoped" on public.chemicals for all
  using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

create index if not exists chemicals_owner_id_idx on public.chemicals (owner_id);

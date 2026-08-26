-- FEATURE — "owner should be able to add general suppliers — a main
-- mechanic or main shop — with phone, address, and details, and Alfred
-- should be able to access that information." The existing supplier
-- fields on `chemicals` are tied to a specific chemical/equipment ITEM
-- (see ChemicalModal.tsx's suppliers array) — there was no way to record
-- a general contact (a mechanic, a main hardware shop) not tied to any
-- one item. This is a separate, owner-scoped table for exactly that,
-- following the same real owner_id RLS pattern as every other table added
-- since the multi-tenant conversion (see current_owner_id()).
-- Already applied live.
create table if not exists public.general_suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null,
  category text,
  phone text,
  email text,
  address text,
  website text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.general_suppliers enable row level security;
create policy general_suppliers_owner_scoped on public.general_suppliers
  for all using (owner_id = current_owner_id()) with check (owner_id = current_owner_id());

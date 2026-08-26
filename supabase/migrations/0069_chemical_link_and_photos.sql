-- FEATURE — "assign a link to a chemical or equipment, and upload photos of
-- equipment so an employee can see what they need." itemLink is a plain
-- reference URL (spec sheet, manual, ordering page) for the item itself —
-- distinct from a supplier's own website link on the per-supplier entries.
-- photos is a JSONB array of {id, url} objects, same shape as job photos,
-- uploaded to Supabase Storage (see ChemicalModal.tsx).
-- Already applied live.
alter table public.chemicals add column if not exists "itemLink" text;
alter table public.chemicals add column if not exists photos jsonb default '[]'::jsonb;

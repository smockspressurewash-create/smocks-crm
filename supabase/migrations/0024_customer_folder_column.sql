-- FEATURE — customer folders (simplified: one flat folder name per customer,
-- filterable in CustomersPage.tsx — not nested subfolders or drag-and-drop).
-- Without this column, PostgREST rejects the WHOLE customer save/upsert the
-- moment a folder is assigned (same class of bug documented throughout this
-- project's migration history — see CLAUDE.md's Database section).
-- Run this in the Supabase SQL editor (Project -> SQL Editor).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS folder TEXT;

-- FEATURE 2 (mobile round 7) — Alfred's remember_fact tool only ever wrote to
-- local usePersistent state (smocks.alfredMemory), so anything Alfred was
-- asked to remember ("I prefer morning jobs", "text me at...") never left the
-- browser it was saved on — the exact opposite of what the feature is for.
-- Mirrors alfred_conversations' cross-device sync pattern (see
-- 0006_alfred_conversations_table.sql).
CREATE TABLE IF NOT EXISTS alfred_memory (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alfred_memory_owner_id_idx ON alfred_memory (owner_id);

ALTER TABLE alfred_memory ENABLE ROW LEVEL SECURITY;

-- Single-owner app (see CLAUDE.md) — permissive policy, same as every other
-- table in this project, not scoped per-tenant.
DROP POLICY IF EXISTS alfred_memory_all ON alfred_memory;
CREATE POLICY alfred_memory_all ON alfred_memory FOR ALL USING (true) WITH CHECK (true);

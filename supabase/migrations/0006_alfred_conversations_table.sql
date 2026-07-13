-- FEATURE 2 — cross-device Alfred conversation sync (App.tsx's alfred_conversations
-- effect). Documents the table this app actually depends on, in case it was created
-- ad-hoc before this migrations folder existed, or its RLS never explicitly allowed
-- DELETE (needed so a conversation removed on one device doesn't reappear from the
-- server on the next 5s poll or on another device).
CREATE TABLE IF NOT EXISTS alfred_conversations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alfred_conversations_owner_id_idx ON alfred_conversations (owner_id);

ALTER TABLE alfred_conversations ENABLE ROW LEVEL SECURITY;

-- Single-owner app (see CLAUDE.md) — permissive policy, same as every other
-- table in this project, not scoped per-tenant.
DROP POLICY IF EXISTS alfred_conversations_all ON alfred_conversations;
CREATE POLICY alfred_conversations_all ON alfred_conversations FOR ALL USING (true) WITH CHECK (true);

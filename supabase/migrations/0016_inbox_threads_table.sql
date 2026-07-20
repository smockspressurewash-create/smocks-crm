-- AUDIT — `inbox_threads` is the shared source of truth for the SMS Inbox
-- (owner's InboxPage.tsx AND every employee OTW/Running Late/invoice-text
-- send via lib/messaging.ts's logOutboundSmsToInbox — see CLAUDE.md's
-- "Critical rules" section). Both call sites have handled a missing table
-- gracefully (console.warn + no-op) for several rounds now, and code
-- comments have said "run the inbox_threads SQL" the whole time, but no
-- migration file for it ever actually existed in this folder until now —
-- so on a fresh/never-fixed deployment, SMS sent from the field portal
-- silently never appears in the owner's Inbox on any device.
-- Run this in the Supabase SQL editor (Project → SQL Editor).
CREATE TABLE IF NOT EXISTS inbox_threads (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'sms',
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  customer_id TEXT,
  unread BOOLEAN DEFAULT false,
  messages JSONB DEFAULT '[]'::jsonb,
  last_message_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbox_threads_channel_idx ON inbox_threads (channel);
CREATE INDEX IF NOT EXISTS inbox_threads_contact_phone_idx ON inbox_threads (contact_phone);

ALTER TABLE inbox_threads ENABLE ROW LEVEL SECURITY;

-- Single-owner app (see CLAUDE.md) — permissive policy, same as every other
-- table in this project, not scoped per-tenant.
DROP POLICY IF EXISTS inbox_threads_all ON inbox_threads;
CREATE POLICY inbox_threads_all ON inbox_threads FOR ALL USING (true) WITH CHECK (true);

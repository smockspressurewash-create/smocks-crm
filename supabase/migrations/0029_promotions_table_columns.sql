-- Promotions sync fix — PromotionsPage.tsx upserts a Promotion object
-- (src/types/index.ts) straight into this table, but the table (created ad
-- hoc, no prior migration file for it) was missing several columns the app
-- writes, most visibly "audience" — PostgREST rejects the whole upsert when
-- any single column in the patch doesn't exist, so every promotion send was
-- failing with "Saved locally, but failed to sync". CREATE TABLE IF NOT
-- EXISTS covers a fresh project; the ALTER TABLE ADD COLUMN IF NOT EXISTS
-- lines patch an existing table missing individual columns. Run in the
-- Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "discountType" TEXT NOT NULL DEFAULT 'percent',
  "discountValue" NUMERIC NOT NULL DEFAULT 0,
  "validFrom" TEXT,
  "validTo" TEXT,
  "serviceRestrictions" JSONB DEFAULT '[]'::jsonb,
  "usageLimit" NUMERIC,
  code TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  "audienceTag" TEXT,
  "audienceCity" TEXT,
  "audienceLastServiceBefore" NUMERIC,
  "audienceCustomerIds" JSONB DEFAULT '[]'::jsonb,
  channel TEXT DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'draft',
  "sentAt" TEXT,
  "sentCount" NUMERIC DEFAULT 0,
  "openedCount" NUMERIC DEFAULT 0,
  "redeemedCount" NUMERIC DEFAULT 0,
  "createdAt" TEXT
);

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "discountType" TEXT NOT NULL DEFAULT 'percent';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "discountValue" NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "validFrom" TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "validTo" TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "serviceRestrictions" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "usageLimit" NUMERIC;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "audienceTag" TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "audienceCity" TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "audienceLastServiceBefore" NUMERIC;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "audienceCustomerIds" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "sentAt" TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "sentCount" NUMERIC DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "openedCount" NUMERIC DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "redeemedCount" NUMERIC DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "createdAt" TEXT;

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Single-owner app (see CLAUDE.md) — permissive policy, same as every other
-- table in this project, not scoped per-tenant. Also needs to be readable by
-- anonymous #/estimate visitors validating a promo code at checkout.
DROP POLICY IF EXISTS promotions_all ON promotions;
CREATE POLICY promotions_all ON promotions FOR ALL USING (true) WITH CHECK (true);

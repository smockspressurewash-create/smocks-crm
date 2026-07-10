-- FIX 2 — per-job-type pay rate overrides (e.g. commercial jobs pay $18/hr
-- vs $15/hr residential) on top of an employee's flat hourlyRate.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "jobTypeRates" JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "jobType" TEXT;

-- FIX 8 — CRM-side feature permissions for a "Manager" role employee
-- (Alfred/Inbox/Accountability/Google Workspace — everything else in the CRM
-- is open to managers by default). Distinct from the existing `permissions`
-- column, which governs the field/employee portal instead.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "managerPermissions" JSONB;

-- Cross-device sync for Alfred AI conversations (see App.tsx's alfred_conversations
-- load/save effects).
CREATE TABLE IF NOT EXISTS alfred_conversations (
  id TEXT PRIMARY KEY,
  owner_id UUID NOT NULL,
  title TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE alfred_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alfred_conversations_all" ON alfred_conversations;
CREATE POLICY "alfred_conversations_all" ON alfred_conversations FOR ALL USING (true) WITH CHECK (true);

-- FIX 14 — promotions previously lived only in this device's localStorage
-- (never synced to Supabase at all), so a promo code entered by a real
-- customer on the public #/estimate page could never be validated against
-- anything the owner actually set up. This table + RLS makes promotions a
-- real cross-device/anon-readable record like jobs/customers/estimates.
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  "discountType" TEXT,
  "discountValue" NUMERIC,
  "validFrom" TEXT,
  "validTo" TEXT,
  "serviceRestrictions" JSONB,
  "usageLimit" INTEGER,
  code TEXT,
  audience TEXT,
  "audienceTag" TEXT,
  "audienceCity" TEXT,
  "audienceLastServiceBefore" INTEGER,
  "audienceCustomerIds" JSONB,
  channel TEXT,
  status TEXT,
  "sentAt" TEXT,
  "sentCount" INTEGER,
  "openedCount" INTEGER,
  "redeemedCount" INTEGER,
  "createdAt" TEXT
);
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promotions_all" ON promotions;
CREATE POLICY "promotions_all" ON promotions FOR ALL USING (true) WITH CHECK (true);

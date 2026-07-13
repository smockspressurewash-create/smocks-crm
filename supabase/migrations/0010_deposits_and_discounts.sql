-- FEATURE 6 — deposit can now be a flat $ or a % of total (depositType),
-- plus a manual "marked paid outside the CRM" timestamp.
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS "depositType" TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS "depositPaidAt" TEXT;

-- FEATURE 7 — stackable manual discounts (title + $ or % each) on both
-- estimates and jobs, on top of the legacy single `discount` number column.
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS "discounts" JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "discounts" JSONB;

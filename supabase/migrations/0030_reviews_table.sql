-- AUDIT FIX (mobile round 10) — "Review wall, showcase wall, and analytics
-- are not showing reviews that have been left". Root cause: the public
-- #/rate review page (src/components/pages/CustomerReviewPage.tsx) has
-- always written real customer submissions to a Supabase "reviews" table
-- that never actually existed — the insert was wrapped in a bare try/catch
-- ("reviews table may not exist yet"), so every real review was silently
-- discarded before this migration. Run in the Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  "customerId" TEXT,
  "customerName" TEXT,
  rating NUMERIC NOT NULL,
  text TEXT,
  "createdAt" TEXT,
  source TEXT,
  status TEXT
);

CREATE INDEX IF NOT EXISTS reviews_customer_id_idx ON reviews ("customerId");

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Single-owner app (see CLAUDE.md) — permissive policy, same as every other
-- table in this project. Also needs to be writable by anonymous #/rate
-- visitors submitting a review with no login.
DROP POLICY IF EXISTS reviews_all ON reviews;
CREATE POLICY reviews_all ON reviews FOR ALL USING (true) WITH CHECK (true);

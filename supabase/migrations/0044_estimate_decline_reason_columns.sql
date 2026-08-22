-- The client decline flow (ClientPortal.tsx onDecline handlers, both the
-- public #/estimate/:id route and the owner's "Preview as Customer" path)
-- has been writing declinedAt/declineReason on every decline since these
-- were added, but this table never had those columns — PostgREST rejects
-- the ENTIRE PATCH if any single column doesn't exist (see CLAUDE.md
-- "safe column" note), so every decline silently failed to persist despite
-- the local optimistic UI showing "Estimate declined" successfully.
--
-- declineReasonCategory is new: a preset reason (price / went_elsewhere /
-- changed_mind / other) the customer picks when declining, shown to the
-- owner as a quick badge instead of only free text.
alter table public.estimates
  add column if not exists "declinedAt" text,
  add column if not exists "declineReason" text,
  add column if not exists "declineReasonCategory" text;

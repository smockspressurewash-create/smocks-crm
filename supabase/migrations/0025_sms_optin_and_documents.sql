-- FEATURE — Twilio A2P 10DLC campaign compliance: durable proof of SMS
-- opt-in consent (captured at the point a phone number is first collected —
-- see LeadFormPage.tsx's opt-in checkbox), plus the customer-documents
-- column for the now-cross-device DocumentVault (insurance certs, contracts,
-- etc. — previously localStorage-only, see src/components/ui/DocumentVault.tsx).
-- Run this in the Supabase SQL editor (Project -> SQL Editor).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "smsOptIn" BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "smsOptInAt" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "documents" JSONB DEFAULT '[]'::jsonb;

-- Storage bucket for customer documents (insurance certs, contracts, etc.),
-- same pattern as job-media (migration 0017) — public bucket (consistent
-- with this app's existing permissive-RLS security posture; see CLAUDE.md),
-- with an explicit write policy scoped to this bucket only.
insert into storage.buckets (id, name, public)
values ('customer-docs', 'customer-docs', true)
on conflict (id) do nothing;

drop policy if exists customer_docs_objects_all on storage.objects;
create policy customer_docs_objects_all on storage.objects
  for all
  using (bucket_id = 'customer-docs')
  with check (bucket_id = 'customer-docs');

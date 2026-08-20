-- Round 14 batch. Run in the Supabase SQL Editor.

-- ITEM 16 — invoices (estimates rows with invoiced:true) need to remember
-- which job they were generated from, so marking an invoice paid can also
-- flip the job's own paymentStatus (the field/employee portal reads
-- job.paymentStatus, not the estimates table).
alter table estimates add column if not exists "jobId" text;

-- ITEMS 3/5 — granular employee permissions (send/create invoices, process
-- payments). Stored as a single JSONB object per employee rather than one
-- column per permission so new permission flags never need another migration.
alter table employees add column if not exists "permissions" jsonb;

-- ITEM 2 — SOP / instructions documents the owner uploads (PDF or Markdown),
-- visible to all employees at all times in the portal.
create table if not exists sop_documents (
  id text primary key,
  title text not null,
  kind text not null default 'markdown', -- 'markdown' | 'pdf'
  content text,           -- markdown body, when kind = 'markdown'
  file_url text,          -- storage URL, when kind = 'pdf'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table sop_documents enable row level security;
drop policy if exists "sop_documents_all" on sop_documents;
create policy "sop_documents_all" on sop_documents for all using (true) with check (true);

-- ITEM 11/12 — trash-can day assignment (owner sorts new signups into
-- specific service days before confirming/sending).
alter table jobs add column if not exists "dayAssignmentConfirmed" boolean default false;

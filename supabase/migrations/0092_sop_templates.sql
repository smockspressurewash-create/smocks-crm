-- FEATURE — "have SOP templates which you save and edit." A reusable
-- template is just a sop_document with is_template = true — same table,
-- same RLS, no new sync path. "Use Template" in the UI copies one into a
-- new, real (non-template) SOP the owner can then assign/adjust.
alter table public.sop_documents add column if not exists is_template boolean not null default false;

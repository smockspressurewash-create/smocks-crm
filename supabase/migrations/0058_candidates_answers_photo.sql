-- FEATURE — custom application questions (multiple-choice/fill-in-the-blank)
-- store their answers here per candidate; photoUrl is a separate field from
-- the existing resumeUrl since an applicant may attach both. Run in the
-- Supabase SQL Editor.
alter table candidates add column if not exists answers jsonb default '{}'::jsonb;
alter table candidates add column if not exists "photoUrl" text;

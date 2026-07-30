-- EGRESS FIX (deep) — job photos/videos/signatures have always been stored
-- as full base64 data URLs inside jobs.photos / jobs.videos /
-- jobs.preChecklist[].photos / jobs.signOff.sigData (JSONB columns — see
-- src/types/index.ts Photo.dataUrl / JobVideo.dataUrl / JobSignOff.sigData).
-- Every select("*") poll of jobs re-transfers all of that on every tick —
-- root cause of this project exceeding its Supabase egress cap. A prior fix
-- widened the fallback poll 10s -> 60s (slowed the bleeding); this is the
-- actual fix — new captures upload here instead of inlining base64 (see
-- uploadJobMedia in src/lib/utils.ts). Existing dataUrl-only photos on old
-- jobs are left as-is; mediaSrc() reads either field.
--
-- Run in the Supabase SQL Editor (Project -> SQL Editor).
insert into storage.buckets (id, name, public)
values ('job-media', 'job-media', true)
on conflict (id) do nothing;

-- storage.objects has RLS on by default with zero policies out of the box —
-- the bucket's public flag above only covers reads, not uploads. Single-
-- owner app (see CLAUDE.md) — permissive policy, same as every other table
-- in this project, scoped to this bucket only so it can never grant access
-- to some other bucket added later.
drop policy if exists job_media_objects_all on storage.objects;
create policy job_media_objects_all on storage.objects
  for all
  using (bucket_id = 'job-media')
  with check (bucket_id = 'job-media');

-- SECURITY — Storage buckets (job-media, customer-docs) previously had NO
-- tenant scoping at all: any authenticated caller could list, overwrite, or
-- delete ANY file in either bucket, regardless of which business it
-- belonged to. Replaces the old bucket-wide policies with ones that trace
-- each object's path back to the job/customer row that actually owns it
-- and require that row's owner_id to match the caller's own
-- (current_owner_id(), the same function every table's RLS policy uses).
--
-- Path conventions relied on here (already how every upload call site in
-- the app writes, no code changes needed for the bulk of files):
--   job-media:     "<jobId>/<filename>"
--   customer-docs: "<customerId>/<filename>"
-- One exception: Alfred's inbound-file staging area (a photo/PDF texted or
-- uploaded to Alfred before the target customer is known) writes to
-- "_alfred-inbound/<ownerId>/<filename>" instead — scoped by owner_id
-- directly since there's no customer row yet at upload time.
--
-- NOTE ON READ ACCESS: both buckets are public (public: true), which is
-- how the app displays photos/documents/serves Twilio MMS attachments
-- without a signed-URL round trip on every render — a public bucket's
-- plain public URL always bypasses RLS for GET requests, by design,
-- regardless of these policies. These policies close the real,
-- exploitable gap (any authenticated user could list/overwrite/delete
-- another business's files via the Storage API) but do not make
-- individual file URLs unguessable-proof — that already relies on paths
-- containing real UUIDs, the same "public but unguessable" model this app
-- already uses elsewhere. Converting to fully private (signed-URL)
-- storage is a larger change, out of scope here.
drop policy if exists "Allow authenticated users to delete from job-media" on storage.objects;
drop policy if exists "Allow authenticated users to select from job-media" on storage.objects;
drop policy if exists "Allow authenticated users to upload to job-media" on storage.objects;
drop policy if exists "customer_docs_objects_all" on storage.objects;

create policy "job_media_owner_scoped" on storage.objects
for all
using (
  bucket_id = 'job-media' and exists (
    select 1 from public.jobs j
    where j.id = (storage.foldername(name))[1]
      and j.owner_id = public.current_owner_id()
  )
)
with check (
  bucket_id = 'job-media' and exists (
    select 1 from public.jobs j
    where j.id = (storage.foldername(name))[1]
      and j.owner_id = public.current_owner_id()
  )
);

create policy "customer_docs_owner_scoped" on storage.objects
for all
using (
  bucket_id = 'customer-docs' and (
    exists (
      select 1 from public.customers c
      where c.id = (storage.foldername(name))[1]
        and c.owner_id = public.current_owner_id()
    )
    or (
      (storage.foldername(name))[1] = '_alfred-inbound'
      and (storage.foldername(name))[2] = public.current_owner_id()
    )
  )
)
with check (
  bucket_id = 'customer-docs' and (
    exists (
      select 1 from public.customers c
      where c.id = (storage.foldername(name))[1]
        and c.owner_id = public.current_owner_id()
    )
    or (
      (storage.foldername(name))[1] = '_alfred-inbound'
      and (storage.foldername(name))[2] = public.current_owner_id()
    )
  )
);

-- alfred-voice: written ONLY server-side via the service role key (Twilio
-- fetches the resulting public URL directly, never through the
-- authenticated Storage API) — service role bypasses RLS entirely, so
-- deliberately NO policy here at all means zero non-service-role access,
-- same intentional pattern as owner_stripe_accounts.

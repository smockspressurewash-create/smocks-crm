-- FEATURE — "when scheduling or editing a job, you should be able to
-- add-on additional services." New optional multi-select of Settings ->
-- Service Catalog entries attached to a job (JobDetailModal.tsx), used to
-- help build/recalculate the job's price from selected services.
alter table public.jobs add column if not exists "serviceIds" jsonb default '[]'::jsonb;

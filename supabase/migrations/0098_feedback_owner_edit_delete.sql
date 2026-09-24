-- FEATURE (user report) — "people should be able to delete or edit their
-- feedback, and it should show that it was edited." Update/delete on
-- feedback_items was previously ADMIN-ONLY (0075_feedback_board.sql) — a
-- regular submitter had no way to fix a typo or retract their own item.
-- submitted_by_uid identifies the real owner (auth.uid(), same convention
-- feedback_votes.voter_id already uses) rather than trusting the
-- client-supplied email string for a security-relevant match.
alter table public.feedback_items add column if not exists submitted_by_uid text;
alter table public.feedback_items add column if not exists edited_at timestamptz;

-- Best-effort backfill so existing submitters can manage feedback they
-- already posted before this column existed, not just new items going
-- forward.
update public.feedback_items f
set submitted_by_uid = u.id::text
from auth.users u
where f.submitted_by_uid is null
  and f.submitted_by_email is not null
  and lower(u.email) = lower(f.submitted_by_email);

drop policy if exists feedback_items_owner_update on public.feedback_items;
create policy feedback_items_owner_update on public.feedback_items for update
  using (submitted_by_uid = auth.uid()::text)
  with check (submitted_by_uid = auth.uid()::text);

drop policy if exists feedback_items_owner_delete on public.feedback_items;
create policy feedback_items_owner_delete on public.feedback_items for delete
  using (submitted_by_uid = auth.uid()::text);

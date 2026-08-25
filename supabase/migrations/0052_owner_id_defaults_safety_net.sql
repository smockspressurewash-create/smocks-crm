-- Run in the Supabase SQL Editor (or applied live via mcp__supabase__apply_migration).
--
-- ROOT-CAUSE FIX for a recurring bug class this whole session: RLS policies
-- everywhere are `owner_id = current_owner_id()`, and several client-side
-- insert/upsert calls simply forget to include `owner_id` in the payload
-- (SOP documents, promotions, invoices, and now inbox_threads — every one
-- caused a silent-looking "doesn't save" / "403 Forbidden" bug that had to
-- be hunted down individually). Rather than keep finding these one at a
-- time, give every owner-scoped table a DEFAULT that fills in owner_id from
-- current_owner_id() whenever an insert omits it. This is purely a safety
-- net: it never overrides a value the application DOES provide, only fills
-- the gap when it doesn't. `employees` is deliberately excluded — its
-- owner_id is the EMPLOYER's id, not the inserting session's own id, and
-- current_owner_id() can't resolve that correctly for a brand-new employee
-- row (no employees row exists yet to look up); that table's inserts must
-- keep setting owner_id explicitly.
alter table alfred_conversations   alter column owner_id set default current_owner_id();
alter table alfred_memory          alter column owner_id set default current_owner_id();
alter table alfred_pending_actions alter column owner_id set default current_owner_id();
alter table alfred_reminders       alter column owner_id set default current_owner_id();
alter table alfred_scripts         alter column owner_id set default current_owner_id();
alter table alfred_sms_threads     alter column owner_id set default current_owner_id();
alter table app_settings           alter column owner_id set default current_owner_id();
alter table campaigns              alter column owner_id set default current_owner_id();
alter table candidates             alter column owner_id set default current_owner_id();
alter table customers              alter column owner_id set default current_owner_id();
alter table employee_onboarding    alter column owner_id set default current_owner_id();
alter table estimates              alter column owner_id set default current_owner_id();
alter table expenses               alter column owner_id set default current_owner_id();
alter table inbox_threads          alter column owner_id set default current_owner_id();
alter table invites                alter column owner_id set default current_owner_id();
alter table job_requests           alter column owner_id set default current_owner_id();
alter table jobs                   alter column owner_id set default current_owner_id();
alter table mileage_logs           alter column owner_id set default current_owner_id();
alter table promotions             alter column owner_id set default current_owner_id();
alter table reviews                alter column owner_id set default current_owner_id();
alter table services               alter column owner_id set default current_owner_id();
alter table sop_documents          alter column owner_id set default current_owner_id();
alter table trash_can_routes       alter column owner_id set default current_owner_id();

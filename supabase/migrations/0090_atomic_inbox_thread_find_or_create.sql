-- BUG FIX — "my SMS inbox conversation got split up again." append_inbox_message
-- (migration 0062) already made APPENDING to an existing thread atomic, but
-- every call site still did its own separate "fetch all threads, find by
-- normalized phone in JS, insert a new row if none found" — a classic
-- check-then-act race. Two callers running near-simultaneously (e.g. the
-- inbound Twilio webhook logging a customer's reply at the same moment the
-- app logs an outbound Alfred/owner send to that same number) could both
-- conclude "no thread exists yet" and both insert a brand-new thread row,
-- permanently splitting one conversation into two.
--
-- contact_phone_digits is a generated column holding the same normalized
-- form the app's own normalizePhoneDigits() computes (strip non-digits,
-- drop a leading US country code "1" from an 11-digit number), so lookups
-- here always agree with what the client considers "the same number."
--
-- find_or_create_inbox_thread wraps the whole find-or-create-and-append
-- into ONE atomic function, serialized per (owner, channel, phone) via a
-- transaction-scoped advisory lock — a concurrent second caller for the
-- same number blocks until the first finishes, then correctly finds (and
-- appends to) the thread the first call just created instead of racing it.

alter table public.inbox_threads add column if not exists contact_phone_digits text
  generated always as (
    case when length(regexp_replace(coalesce(contact_phone,''), '\D', '', 'g')) = 11
              and left(regexp_replace(coalesce(contact_phone,''), '\D', '', 'g'), 1) = '1'
         then substring(regexp_replace(coalesce(contact_phone,''), '\D', '', 'g') from 2)
         else regexp_replace(coalesce(contact_phone,''), '\D', '', 'g')
    end
  ) stored;

create index if not exists inbox_threads_phone_digits_idx on public.inbox_threads (owner_id, channel, contact_phone_digits);

create or replace function public.find_or_create_inbox_thread(
  p_owner_id text,
  p_channel text,
  p_contact_phone text,
  p_contact_name text,
  p_customer_id text,
  p_message jsonb,
  p_unread boolean default true
) returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id text;
  v_digits text;
begin
  if auth.role() <> 'service_role' and p_owner_id is distinct from current_owner_id() then
    raise exception 'not authorized';
  end if;

  v_digits := case when length(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g')) = 11
                        and left(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g'), 1) = '1'
                   then substring(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g') from 2)
                   else regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g')
              end;

  perform pg_advisory_xact_lock(hashtext(coalesce(p_owner_id, '') || '|' || coalesce(p_channel, '') || '|' || v_digits));

  select id into v_id
  from public.inbox_threads
  where channel = p_channel
    and coalesce(owner_id, '') = coalesce(p_owner_id, '')
    and contact_phone_digits = v_digits
    and v_digits <> ''
  limit 1;

  if v_id is not null then
    update public.inbox_threads
    set messages = coalesce(messages, '[]'::jsonb) || jsonb_build_array(p_message),
        unread = p_unread,
        last_message_at = (p_message->>'ts')::bigint,
        updated_at = now(),
        customer_id = coalesce(customer_id, p_customer_id)
    where id = v_id;
    return v_id;
  end if;

  v_id := gen_random_uuid()::text;
  insert into public.inbox_threads (id, channel, contact_name, contact_phone, customer_id, unread, messages, last_message_at, updated_at, owner_id)
  values (v_id, p_channel, p_contact_name, p_contact_phone, p_customer_id, p_unread, jsonb_build_array(p_message), (p_message->>'ts')::bigint, now(), p_owner_id);
  return v_id;
end;
$$;

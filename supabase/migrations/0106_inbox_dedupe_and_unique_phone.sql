-- SMS inbox clean-up: one conversation per phone number.
--
-- BUG FIX (owner report: "duplicate phone numbers, random messages, and when
-- I click on it, it just disappears"). Some senders created a second
-- conversation for the same number, and the app tried to merge them by
-- deleting rows from the browser — tapping a conversation could delete the
-- one you had just opened. The app no longer deletes anything; this file
-- merges the existing duplicates once and then makes a duplicate impossible.
--
-- Run once in the Supabase SQL Editor. Safe to run again.

-- 1. Merge duplicates. For each owner + number, keep the conversation that
--    has a real contact name (else the one with the most messages), fold in
--    every message from the others (no repeats), then delete the others.
with ranked as (
  select id, owner_id, channel, contact_phone_digits,
         row_number() over (
           partition by coalesce(owner_id, ''), channel, contact_phone_digits
           order by
             (contact_name is null or contact_name = '' or contact_name ~ '^[+0-9() .-]+$' or lower(contact_name) = 'alfred') asc,
             jsonb_array_length(coalesce(messages, '[]'::jsonb)) desc,
             id asc
         ) as rn
  from public.inbox_threads
  where coalesce(contact_phone_digits, '') <> ''
),
groups as (
  select coalesce(owner_id, '') as o, channel, contact_phone_digits as d,
         (array_agg(id) filter (where rn = 1))[1] as keep_id
  from ranked
  group by 1, 2, 3
  having count(*) > 1
),
merged as (
  select g.keep_id,
         (select coalesce(jsonb_agg(m order by (m->>'ts')::bigint nulls last), '[]'::jsonb)
            from (
              select distinct on (coalesce(m->>'sid', m->>'id', md5(m::text))) m
              from public.inbox_threads t2, jsonb_array_elements(coalesce(t2.messages, '[]'::jsonb)) m
              where coalesce(t2.owner_id, '') = g.o and t2.channel = g.channel and t2.contact_phone_digits = g.d
            ) x) as msgs,
         bool_or(t.unread) as any_unread,
         (array_agg(t.customer_id) filter (where t.customer_id is not null))[1] as cust
  from groups g
  join public.inbox_threads t on coalesce(t.owner_id, '') = g.o and t.channel = g.channel and t.contact_phone_digits = g.d
  group by g.keep_id, g.o, g.channel, g.d
)
update public.inbox_threads t
set messages = m.msgs,
    unread = m.any_unread,
    customer_id = coalesce(t.customer_id, m.cust),
    last_message_at = coalesce((m.msgs->-1->>'ts')::bigint, t.last_message_at),
    updated_at = now()
from merged m
where t.id = m.keep_id;

delete from public.inbox_threads t
using (
  select id, row_number() over (
           partition by coalesce(owner_id, ''), channel, contact_phone_digits
           order by
             (contact_name is null or contact_name = '' or contact_name ~ '^[+0-9() .-]+$' or lower(contact_name) = 'alfred') asc,
             jsonb_array_length(coalesce(messages, '[]'::jsonb)) desc,
             id asc
         ) as rn
  from public.inbox_threads
  where coalesce(contact_phone_digits, '') <> ''
) r
where t.id = r.id and r.rn > 1;

-- 2. Never again: one conversation per owner + channel + number.
create unique index if not exists inbox_threads_one_per_phone
  on public.inbox_threads (coalesce(owner_id, ''), channel, contact_phone_digits)
  where coalesce(contact_phone_digits, '') <> '';

-- 3. Appending the same message twice (a retried send, a Twilio retry) is a
--    no-op instead of a repeated message.
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
  v_owner_id text;
begin
  if auth.role() = 'service_role' then
    v_owner_id := p_owner_id;
  else
    v_owner_id := coalesce(p_owner_id, current_owner_id());
    if p_owner_id is not null and p_owner_id is distinct from current_owner_id() then
      raise exception 'not authorized';
    end if;
  end if;

  v_digits := case when length(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g')) = 11
                        and left(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g'), 1) = '1'
                   then substring(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g') from 2)
                   else regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g')
              end;

  perform pg_advisory_xact_lock(hashtext(coalesce(v_owner_id, '') || '|' || coalesce(p_channel, '') || '|' || v_digits));

  select id into v_id
  from public.inbox_threads
  where channel = p_channel
    and coalesce(owner_id, '') = coalesce(v_owner_id, '')
    and contact_phone_digits = v_digits
    and v_digits <> ''
  limit 1;

  if v_id is not null then
    update public.inbox_threads
    set messages = case
          when p_message ? 'id' and coalesce(messages, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_message->>'id'))
            then messages
          else coalesce(messages, '[]'::jsonb) || jsonb_build_array(p_message)
        end,
        unread = case when p_unread then true else unread end,
        last_message_at = greatest(coalesce(last_message_at, 0), (p_message->>'ts')::bigint),
        updated_at = now(),
        customer_id = coalesce(customer_id, p_customer_id)
    where id = v_id;
    return v_id;
  end if;

  v_id := gen_random_uuid()::text;
  insert into public.inbox_threads (id, channel, contact_name, contact_phone, customer_id, unread, messages, last_message_at, updated_at, owner_id)
  values (v_id, p_channel, p_contact_name, p_contact_phone, p_customer_id, p_unread, jsonb_build_array(p_message), (p_message->>'ts')::bigint, now(), v_owner_id);
  return v_id;
end;
$$;

-- 4. Update one message's status ("sending" -> "sent"/"failed") without
--    rewriting the whole conversation (rewrites could drop a message that
--    arrived at the same moment).
create or replace function public.set_inbox_message_status(
  p_message_id text,
  p_status text,
  p_error text default null
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.inbox_threads t
  set messages = (
        select jsonb_agg(
                 case when m->>'id' = p_message_id
                      then m || jsonb_build_object('status', p_status) || case when p_error is null then '{}'::jsonb else jsonb_build_object('error', p_error) end
                      else m end
                 order by ord)
        from jsonb_array_elements(t.messages) with ordinality as e(m, ord)
      ),
      updated_at = now()
  where t.messages @> jsonb_build_array(jsonb_build_object('id', p_message_id))
    and (auth.role() = 'service_role' or coalesce(t.owner_id, '') = coalesce(current_owner_id(), ''));
end;
$$;

grant execute on function public.set_inbox_message_status(text, text, text) to authenticated;

-- FIX — find_or_create_inbox_thread (0090) rejected any call that passed
-- p_owner_id = null for a non-service-role caller, even though every
-- OTHER owner-scoped write in this app treats "no owner_id supplied" as
-- "use my own", not "reject". Most client call sites (logOutboundSmsToInbox
-- in lib/messaging.ts) don't have a ready ownerId to hand — resolve it
-- server-side via current_owner_id() when the caller didn't supply one,
-- same as every other owner-scoped table already does, instead of forcing
-- every call site to thread an explicit ownerId through just to avoid an
-- auth error.
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
  values (v_id, p_channel, p_contact_name, p_contact_phone, p_customer_id, p_unread, jsonb_build_array(p_message), (p_message->>'ts')::bigint, now(), v_owner_id);
  return v_id;
end;
$$;

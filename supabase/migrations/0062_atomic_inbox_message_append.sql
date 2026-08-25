-- BUG FIX — "some conversations aren't showing Alfred's responses" / "it
-- accidentally separated two chats." Root cause: every SMS write path
-- (inbound log, Alfred's outbound reply log, auto-reply log) does a plain
-- read-then-write against inbox_threads.messages (fetch the row, append in
-- application code, PATCH the whole array back). Two of these firing close
-- together for the same thread is a classic lost-update race: whichever
-- PATCH lands second overwrites the first with no idea the other happened,
-- silently dropping a message. This function makes the append itself
-- atomic — single UPDATE, no read-modify-write gap for two concurrent
-- calls to race inside. Run in the Supabase SQL Editor. Already applied live.
create or replace function public.append_inbox_message(
  p_thread_id text,
  p_message jsonb,
  p_unread boolean default true
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.inbox_threads
  set messages = coalesce(messages, '[]'::jsonb) || jsonb_build_array(p_message),
      unread = p_unread,
      last_message_at = (p_message->>'ts')::bigint,
      updated_at = now()
  where id = p_thread_id;
$$;

-- 0084_scope_append_inbox_message.sql
--
-- SECURITY AUDIT FIX — found via Supabase's own security advisor (get_advisors):
-- append_inbox_message (migration 0062) is a SECURITY DEFINER function
-- exposed to both the `anon` and `authenticated` roles via
-- /rest/v1/rpc/append_inbox_message, with NO ownership check inside it at
-- all — it unconditionally appends p_message to whichever inbox_threads
-- row matches p_thread_id, full stop. Since it's SECURITY DEFINER it
-- bypasses inbox_threads' own owner_id-scoped RLS entirely, so the RLS
-- policy on that table provides zero protection here. Any caller who knows
-- (or enumerates/leaks) a thread id — including a fully unauthenticated
-- anon caller, since src/lib/messaging.ts's logOutboundSmsToInbox calls
-- this straight from the browser for legitimate owner/employee sends —
-- could inject an arbitrary fake message into ANY business's customer SMS
-- inbox thread, on any tenant, not just their own.
--
-- Fix: scope the UPDATE to the caller's own tenant (owner_id =
-- current_owner_id(), the same SECURITY DEFINER helper every other
-- owner-scoped RLS policy already uses) so a legitimate owner/employee
-- session keeps working exactly as before, but a caller who doesn't
-- resolve to that thread's owner gets a 0-row no-op instead of a write.
--
-- IMPORTANT — this function is ALSO called server-side (Cloudflare Pages
-- Functions: twilio-sms-webhook.ts, alfredSmsAgent.ts/alfredCustomerAgent.ts/
-- alfredEmployeeAgent.ts, stripe-action.ts, public-data.ts) using the
-- SUPABASE SERVICE ROLE KEY — those calls have no real end-user JWT at all,
-- so auth.uid() is NULL there just like an anonymous caller, and
-- current_owner_id() would resolve to NULL too. Those call sites already
-- resolved and trust the correct owner_id themselves server-side before
-- calling this — the whole point of using the service-role key — so they
-- must keep bypassing this check, or every inbound Twilio SMS / Alfred
-- reply logged via this RPC would silently stop working. auth.role()
-- (a standard Supabase auth helper) reads the JWT role claim, which is
-- 'service_role' for those calls and 'anon'/'authenticated' for a real
-- browser session — that's what distinguishes the two cases here.
--
-- Run this in the Supabase SQL Editor.

create or replace function public.append_inbox_message(
  p_thread_id text,
  p_message jsonb,
  p_unread boolean default true
)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  update public.inbox_threads
  set messages = coalesce(messages, '[]'::jsonb) || jsonb_build_array(p_message),
      unread = p_unread,
      last_message_at = (p_message->>'ts')::bigint,
      updated_at = now()
  where id = p_thread_id
    and (auth.role() = 'service_role' or owner_id = current_owner_id());
$function$;

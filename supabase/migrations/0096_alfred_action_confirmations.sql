-- Generalizes alfred_pending_actions (previously customer-reschedule-only,
-- see 0043_alfred_customer_agent.sql) to also hold an owner-facing "ask
-- first" confirmation row, created when the owner's Alfred autonomy level
-- (app_settings.data.alfredAutonomyLevel, or a temporary vacation-mode
-- override) is "ask_first" and Alfred wants to run a capability-gated tool
-- (see ALFRED_TOOL_CAPABILITY in src/components/pages/AlfredPage.tsx and
-- SMS_TOOL_CAPABILITY in functions/api/_lib/alfredSmsAgent.ts). This kind
-- of row (kind = 'action_confirmation') has no customer attached, so the
-- two customer columns — NOT NULL until now because only the customer-
-- reschedule flow ever wrote this table — need to become nullable.
alter table public.alfred_pending_actions alter column customer_id drop not null;
alter table public.alfred_pending_actions alter column customer_phone drop not null;

-- Previously service-role-only (RLS enabled, zero policy — correct while
-- only the server-side SMS agents, which use the service role key, ever
-- touched it; see 0054_security_audit_fixes.sql's comment). The owner's
-- own in-app browser session now also needs to read/approve/decline these
-- rows directly (a "Pending Approvals" list in the Alfred chat UI) — same
-- owner_id-scoped pattern every other tenant table already uses (see
-- CLAUDE.md's RLS section), never opened up to anon or to any other
-- tenant. A customer's own portal session can never match this policy:
-- current_owner_id() falls back to the caller's OWN uid when they aren't
-- found in `employees`, and a customer never is, so it can't collide with
-- a real owner_id here.
drop policy if exists "alfred_pending_actions_owner_scoped" on public.alfred_pending_actions;
create policy "alfred_pending_actions_owner_scoped" on public.alfred_pending_actions for all
  using (owner_id = current_owner_id())
  with check (owner_id = current_owner_id());

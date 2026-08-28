-- 0085_owner_secrets.sql
--
-- SECURITY FIX — found via audit: Twilio auth token, every AI-provider API
-- key (Claude/Gemini/OpenAI/etc.), and the Google OAuth refresh_token all
-- lived directly in app_settings.data (JSONB), which syncs to EVERY signed-in
-- session for that owner — not just the owner. Because current_owner_id()
-- resolves through the employees table for any employee row, and
-- app_settings RLS is owner_id = current_owner_id() (migration 0033), ANY
-- employee/technician's own portal session could read these straight off the
-- app_settings REST response in plaintext (confirmed: EmployeePortal.tsx
-- reads `.select("data")` with no field projection). A technician opening
-- devtools on their own phone could see the business's live Twilio token
-- (send SMS as the business / run up charges), every AI API key (run up
-- LLM charges), and the Google refresh token (persistent Gmail/Calendar
-- access) — this is the exact vulnerability class already fixed for Stripe
-- (owner_stripe_accounts) and Square (owner_square_accounts); this table is
-- the same fix extended to these three.
--
-- Service-role-only, same as owner_stripe_accounts/owner_square_accounts —
-- deliberately NO policy for anon/authenticated, reachable exclusively from
-- Cloudflare Functions using the service role key.
--
-- Run this in the Supabase SQL Editor.

create table if not exists public.owner_secrets (
  owner_id text primary key,
  twilio_account_sid text,
  twilio_auth_token text,
  twilio_from_number text,
  twilio_messaging_service_sid text,
  google_refresh_token text,
  model_keys jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.owner_secrets enable row level security;
-- No policy for anon/authenticated — service-role-only.

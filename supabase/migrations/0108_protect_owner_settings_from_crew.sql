-- 0108 — Crew can't change the owner's texting/Alfred/integration settings.
--
-- Audit 2026-11-17: app_settings is one JSON row per business, and every
-- signed-in member of the business (crew included) can write it. The text
-- webhook trusts myPhone / alfredExtraPhones from that row to decide who is
-- "the owner" when texting Alfred, so a crew member could add their own
-- number and get owner-level Alfred by text. The same row holds the Twilio
-- number and Google connection fields.
--
-- This trigger keeps the old value of those keys whenever someone signed in
-- as crew (an employees row whose role isn't owner or manager) saves the
-- row. The owner, managers and server code (service role, no auth.uid())
-- are unaffected, and crew can still save every other setting.
--
-- Safe to run more than once.

create or replace function public.app_settings_protect_owner_keys()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role text;
  k text;
  protected_keys text[] := array[
    'myPhone', 'alfredExtraPhones', 'alfredExtraPhoneRoles', 'alfredSmsEnabled',
    'alfredAutoApproveReschedules', 'alfredFullAccess',
    'twilioFrom', 'twilioSid', 'twilioToken', 'twilioFromNumber', 'twilioMessagingServiceSid',
    'googleConnected', 'googleProviderToken', 'googleRefreshToken', 'googleTokenExpiresAt', 'googleEmail',
    'stripePublishableKey', 'squareApplicationId', 'squareLocationId',
    'modelPriority', 'activeModel', 'timeZone'
  ];
begin
  if auth.uid() is null then
    return new; -- server code (service role)
  end if;
  select lower(coalesce(e.role, '')) into caller_role
    from public.employees e where e.user_id = auth.uid() limit 1;
  if caller_role is null or caller_role in ('owner', 'manager') then
    return new; -- the owner (no employees row, or role owner) or a manager
  end if;
  foreach k in array protected_keys loop
    if old.data ? k then
      new.data := jsonb_set(new.data, array[k], old.data -> k, true);
    else
      new.data := new.data - k;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists app_settings_protect_owner_keys on public.app_settings;
create trigger app_settings_protect_owner_keys
  before update on public.app_settings
  for each row execute function public.app_settings_protect_owner_keys();

-- Security audit (Supabase advisor scan). Only one real finding needed a
-- fix: handle_new_user() (the auth.users signup trigger) had no locked
-- search_path, which is the classic Postgres SECURITY DEFINER privilege-
-- escalation vector — an attacker-controlled schema earlier in an unset
-- search_path could shadow an unqualified object reference. Practical risk
-- here was low (the function already fully qualifies public.profiles) but
-- this is free to close outright with zero behavior change.
--
-- Everything else the advisor flagged was verified safe and left as-is:
--   - owner_stripe_accounts / alfred_pending_actions: RLS enabled with NO
--     policy is INTENTIONAL — these are service-role-only tables (Stripe
--     secret keys / internal Alfred state), so "no policy" correctly means
--     zero access for anon/authenticated, not a bug.
--   - current_owner_id() / link_own_employee_by_email(): both already have
--     search_path locked and scope every match to the CALLER's own
--     auth.uid()/JWT email — reviewed the actual logic, not just the
--     linter's generic "callable by anon" flag, and confirmed neither can
--     act on another tenant's data.
--   - jobs_backup: a stale, unreferenced table (grep confirms nothing in
--     the app reads/writes it) — harmless with RLS locked down.
--   - "Leaked Password Protection Disabled" is a Supabase Auth *project
--     setting*, not something a migration can fix — enable it in the
--     Supabase dashboard under Authentication -> Policies/Settings.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4))
  );
  RETURN new;
END;
$function$;

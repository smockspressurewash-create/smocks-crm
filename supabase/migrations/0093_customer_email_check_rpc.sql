-- BUG FIX (security audit finding, Medium) — "every customer reset
-- silently routes to /portal instead of /client." ResetPassword.tsx tries
-- to tell a customer's password-reset session apart from an owner/employee
-- one by querying `customers` directly with the anon key for a row whose
-- email matches the session's own email. But `customers` only carries the
-- `customers_owner_scoped` policy (owner_id = current_owner_id()) — for a
-- customer's own session, current_owner_id() never resolves to that row's
-- real owner_id (customers aren't in the `employees` table current_owner_id
-- relies on), so the query always returns 0 rows under RLS regardless of
-- whether a matching customer row exists. This function follows the same
-- SECURITY DEFINER + auth.jwt()-anchored pattern as
-- link_own_employee_by_email() (0078) — narrow, read-only, returns only a
-- boolean, and can't be used to probe any other row's data.
drop function if exists public.is_registered_customer_email();

create or replace function public.is_registered_customer_email()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.customers
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_registered_customer_email() to authenticated;

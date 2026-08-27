-- Employee access control — fire / suspend (leave/break) / restore.
--
-- employees.status was already free-text ("active"/"inactive") but nothing
-- actually enforced it at login: resolveUserRole() in App.tsx never read it,
-- so an "inactive" employee's Supabase Auth account still logged straight
-- into the field portal exactly as if nothing had changed — the existing
-- toggle only ever affected payroll totals and how dimmed the row looked in
-- EmployeesPage, never real access. This migration only needs to widen the
-- RPC path (link_own_employee_by_email, used the FIRST time an employee
-- signs in via Google, before their employees row has a user_id link yet)
-- to also return status, so the client can enforce it there too — the
-- direct-query paths in resolveUserRole() already select whatever columns
-- the client asks for and need no DB change, just an added column in the
-- select list (done in App.tsx).
--
-- Status values used by the app: "active" (normal), "leave" (owner marked
-- them on a break / took leave — temporary, access paused, restoring to
-- "active" brings back everything exactly as it was since nothing else is
-- touched), "terminated" (owner fired them — access revoked, record kept
-- for history; the owner can separately delete the employee row entirely
-- once terminated, per their own explicit action).

drop function if exists public.link_own_employee_by_email();

create or replace function public.link_own_employee_by_email()
returns table (id text, role text, owner_id text, user_id uuid, status text)
language sql
security definer
volatile
set search_path = public, pg_temp
as $$
  update public.employees e
  set user_id = auth.uid()
  where e.id = (
    select id from public.employees
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and user_id is null
    limit 1
  )
  returning e.id, e.role, e.owner_id, e.user_id, e.status;
$$;

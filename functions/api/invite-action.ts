// MULTI-TENANT (Phase C) — under the new owner_id-scoped RLS (migration
// 0033_multitenant_owner_scoping.sql), the `invites` table can no longer
// have a public `SELECT true` policy: that would let anyone dump every
// business's pending invites (employee names/emails/hourly rates) across
// every tenant, not just look up the one row matching a code they were
// given. But a brand-new employee opening `#/portal?invite=CODE` has NO
// session yet — nothing to scope an owner_id-restricted RLS policy by.
//
// Same problem one step later: right after that employee signs up, linking
// their new `employees.user_id` and marking the invite used both need to
// write to owner_id-scoped tables (`employees`, `invites`) before their own
// session even has a linked employees row for `current_owner_id()` to
// resolve through — a chicken-and-egg RLS deadlock.
//
// This function is the fix for both, using the Supabase service role key
// (server-side only, bypasses RLS) — but unlike a public policy, it only
// ever touches the ONE row matched by an exact `code`, never exposes the
// table.
const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" };

  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;
    const code = (body?.code || "").trim();
    if (!code) return json({ error: "Missing code" }, 400);

    if (action === "lookup") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/invites?code=eq.${encodeURIComponent(code)}&select=*`, { headers });
      const rows = await res.json().catch(() => []);
      const invite = Array.isArray(rows) ? rows[0] : null;
      if (!invite) return json({ error: "Invite not found" }, 404);
      if (invite.used) return json({ error: "This invite has already been used." }, 410);
      return json({ invite });
    }

    if (action === "consume") {
      const { newUserId, employeeId, email } = body;
      if (!newUserId) return json({ error: "Missing newUserId" }, 400);

      // Mark used — `used=eq.false` guard makes this a no-op (not an error)
      // if the invite was already consumed by a concurrent request.
      await fetch(`${SUPABASE_URL}/rest/v1/invites?code=eq.${encodeURIComponent(code)}&used=eq.false`, {
        method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ used: true, used_at: new Date().toISOString(), used_by: newUserId }),
      });

      // Link the placeholder employees row to the new auth user, by id if
      // known, otherwise by email — same fallback order EmployeePortal.tsx
      // already used client-side.
      const filter = employeeId ? `id=eq.${encodeURIComponent(employeeId)}` : email ? `email=ilike.${encodeURIComponent(email)}` : null;
      let linkedEmployee: any = null;
      if (filter) {
        await fetch(`${SUPABASE_URL}/rest/v1/employees?${filter}`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: newUserId }),
        });
        const getRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?${filter}&select=*`, { headers });
        const rows = await getRes.json().catch(() => []);
        linkedEmployee = Array.isArray(rows) ? rows[0] : null;
      }
      return json({ success: true, employee: linkedEmployee });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "invite-action error" }, 400);
  }
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

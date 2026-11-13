// Public POST endpoint wrapping _lib/employeeCalendarSync.ts — the browser
// (owner's session in JobsPage.tsx/JobDetailModal.tsx/AlfredPage.tsx) has no
// access to any employee's Google token, only the service-role key on this
// server does, so assigning/unassigning crew calls this instead of talking
// to Google directly. Fire-and-forget from the caller's side — a sync
// failure here should never block or fail the crew assignment itself.
//
// SECURITY FIX (audit finding) — this endpoint had NO caller authentication
// at all: a client-supplied ownerId was trusted outright (and simply omitted
// entirely scoped the employee lookup by employeeId alone, no owner check
// whatsoever). Anyone who obtained a real employeeId+jobId (visible in this
// app's own authenticated network traffic — a former employee, a compromised
// device) could create/overwrite/delete a real event on that employee's
// connected Google Calendar. Now requires a real session and derives
// ownerId from IT (resolveCallerOwnerId), never from the request body — the
// existing ownerScope filter inside syncEmployeeJobToCalendar then does the
// real work of rejecting a target employee who isn't on the caller's own
// tenant (returns "employee not found" rather than syncing).
const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";
import { syncEmployeeJobToCalendar, removeAllCrewEventsForJob } from "./_lib/employeeCalendarSync";

const resolveCallerOwnerId = async (accessToken: string): Promise<string | null> => {
  if (!accessToken) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null) as any;
  const uid = user?.id;
  if (!uid) return null;
  const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?user_id=eq.${encodeURIComponent(uid)}&select=owner_id&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const empRows = await empRes.json().catch(() => []);
  return Array.isArray(empRows) && empRows[0]?.owner_id ? empRows[0].owner_id : uid;
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const callerOwnerId = await resolveCallerOwnerId(accessToken);
    if (!callerOwnerId) {
      return new Response(JSON.stringify({ error: "Not authenticated — sign in and try again." }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const body = await context.request.json() as {
      employeeId?: string; jobId?: string; action?: "upsert" | "delete" | "deleteAllForJob";
      title?: string; date?: string; time?: string; durationMinutes?: number; location?: string; notes?: string;
      knownEventIds?: Record<string, string>;
    };
    // BUG FIX (integration audit 2026-11-13) — cancelling or deleting a job
    // never removed it from the crew's own calendars. "deleteAllForJob"
    // removes every crew member's event for this job (knownEventIds is the
    // caller's last-known map, used only if the job row is already deleted).
    if (body.action === "deleteAllForJob") {
      if (!body.jobId) return new Response(JSON.stringify({ error: "jobId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
      const known = body.knownEventIds && typeof body.knownEventIds === "object" ? body.knownEventIds : undefined;
      const r = await removeAllCrewEventsForJob(context.env, { ownerId: callerOwnerId, jobId: body.jobId, knownEventIds: known, origin: new URL(context.request.url).origin });
      return new Response(JSON.stringify({ success: true, ...r }), { headers: { "Content-Type": "application/json" } });
    }
    if (!body.employeeId || !body.jobId || !body.action) {
      return new Response(JSON.stringify({ error: "employeeId, jobId, and action required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const result = await syncEmployeeJobToCalendar(context.env, {
      employeeId: body.employeeId, ownerId: callerOwnerId, jobId: body.jobId, action: body.action,
      title: body.title, date: body.date, time: body.time, durationMinutes: body.durationMinutes,
      location: body.location, notes: body.notes, origin: new URL(context.request.url).origin,
    });
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "sync failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

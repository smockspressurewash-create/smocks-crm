// employeeCalendarSync.ts — pushes a job onto (or off of) an assigned
// EMPLOYEE's own Google Calendar, from the OWNER's side of an assignment.
//
// EmployeePortal.tsx already has a working sync (syncJobToCalendar) — but it
// only ever runs in the EMPLOYEE's own browser session, using their token
// out of localStorage, triggered when THEY accept/view a job. It never runs
// when the OWNER is the one doing the assigning (JobsPage.tsx, JobDetailModal,
// either Alfred's assign_employee tool) — the owner's browser has no access
// to any employee's Google token at all, so that has to happen server-side,
// with the service-role key, against the employee's own stored
// google_token/google_refresh_token (employees table — see CLAUDE.md).
//
// This is what makes "when I assign someone to a job it should show up on
// their calendar" actually true regardless of which side does the
// assigning, not just when the employee happens to open their own portal.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

export type SyncAction = "upsert" | "delete";

// BUG FIX (integration audit 2026-11-13) — the business's own time zone, so
// a 9:00 job lands at 9:00 local on the crew's calendar. Same setting
// run-automations.ts uses (app_settings.data.timeZone), default Eastern.
const DEFAULT_TZ = "America/New_York";
const isValidTz = (tz: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };
const loadOwnerTimeZone = async (env: Record<string, string>, ownerId: string | null, authHeaders: Record<string, string>): Promise<string> => {
  const fallback = env.OWNER_TZ && isValidTz(env.OWNER_TZ) ? env.OWNER_TZ : DEFAULT_TZ;
  if (!ownerId) return fallback;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data&limit=1`, { headers: authHeaders });
    const rows = await r.json().catch(() => []);
    const tz = Array.isArray(rows) ? rows[0]?.data?.timeZone : null;
    return typeof tz === "string" && tz && isValidTz(tz) ? tz : fallback;
  } catch { return fallback; }
};
// Wall-clock "YYYY-MM-DDTHH:MM:00" plus N minutes, with no server-time-zone
// conversion (Google applies timeZone itself).
const wallClock = (date: string, time: string, addMinutes = 0): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m || !t) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]) + addMinutes * 60000);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
};

export interface SyncOpts {
  employeeId: string;
  ownerId: string | null;
  jobId: string;
  action: SyncAction;
  title?: string;
  date?: string; // YYYY-MM-DD, required for "upsert"
  time?: string; // HH:MM, defaults to 09:00
  durationMinutes?: number; // default 120
  location?: string;
  notes?: string;
  origin: string; // kept for callers; token refresh now happens in-process
  // BUG FIX (integration audit 2026-11-13) — for "delete" when the job row
  // is already gone (hard delete): the event id the caller still knows.
  eventId?: string;
}

export type SyncResult = { success: true; eventId?: string } | { skipped: true; reason: string } | { error: string };

export const syncEmployeeJobToCalendar = async (env: Record<string, string>, opts: SyncOpts): Promise<SyncResult> => {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return { skipped: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured — employee calendar sync needs it to read the employee's stored Google token safely (never exposed to the browser)." };
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  const ownerScope = opts.ownerId ? `&owner_id=eq.${encodeURIComponent(opts.ownerId)}` : "";
  const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${encodeURIComponent(opts.employeeId)}&select=google_token,google_refresh_token,google_token_expires_at,autoSyncCalendar${ownerScope}`, { headers: authHeaders });
  const empRows = await empRes.json().catch(() => []);
  const emp = Array.isArray(empRows) ? empRows[0] : null;
  if (!emp) return { skipped: true, reason: "employee not found" };
  if (!emp.google_refresh_token && !emp.google_token) return { skipped: true, reason: "employee hasn't connected their Google account" };
  // BUG FIX — this used to read `autosynccalendar` (all-lowercase) on the
  // theory that the real column had been created unquoted and folded to
  // lowercase (CLAUDE.md's documented casing gotcha) — but that theory was
  // never actually verified against the live schema. There are TWO real
  // columns on this table: a stale `autosynccalendar` (lowercase, defaults
  // false, never written by anything) and the real `"autoSyncCalendar"`
  // (camelCase, properly quoted) that EmployeePortal.tsx's own toggle
  // actually reads and writes. Checking the wrong one meant an employee who
  // correctly turned sync ON in their portal (writing true to the real
  // column) still got silently skipped here forever, because the OTHER,
  // never-updated column still read false.
  if (emp.autoSyncCalendar === false) return { skipped: true, reason: "employee turned off calendar auto-sync in their portal" };

  let accessToken = emp.google_token || "";
  if (emp.google_refresh_token && (!emp.google_token_expires_at || Date.now() > Number(emp.google_token_expires_at) - 60000)) {
    try {
      // BUG FIX (integration audit 2026-11-13) — exchange the token here
      // instead of an HTTP hop to /api/google-refresh (same OAuth exchange).
      if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: emp.google_refresh_token, grant_type: "refresh_token" }).toString(),
        });
        const refreshData = await refreshRes.json().catch(() => null) as any;
        if (refreshRes.ok && refreshData?.access_token) accessToken = refreshData.access_token;
      }
    } catch { /* fall through with whatever token we have */ }
  }
  if (!accessToken) return { skipped: true, reason: "couldn't get a valid Google token for this employee" };

  // Look up any existing event id for THIS employee on THIS job.
  const jobRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(opts.jobId)}&select=id,crewGoogleEventIds`, { headers: authHeaders });
  const jobRows = await jobRes.json().catch(() => []);
  const job = Array.isArray(jobRows) ? jobRows[0] : null;
  if (!job && !(opts.action === "delete" && opts.eventId)) return { skipped: true, reason: "job not found" };
  const eventMap: Record<string, string> = job?.crewGoogleEventIds || {};
  const existingEventId = eventMap[opts.employeeId] || (opts.action === "delete" ? opts.eventId : undefined);

  if (opts.action === "delete") {
    if (!existingEventId) return { success: true };
    // BUG FIX (integration audit 2026-11-13) — the id used to be dropped from
    // the map even when Google's DELETE failed (expired token, 5xx),
    // orphaning the event. Only forget it once Google confirms it's gone.
    const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);
    if (!delRes || !(delRes.ok || delRes.status === 404 || delRes.status === 410)) {
      return { error: `Google Calendar delete failed (HTTP ${delRes?.status ?? "network"}) — event id kept to retry` };
    }
    if (!job) return { success: true };
    const nextMap = { ...eventMap };
    delete nextMap[opts.employeeId];
    await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(opts.jobId)}`, {
      method: "PATCH", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ crewGoogleEventIds: nextMap }),
    }).catch(() => {});
    return { success: true };
  }

  // upsert
  if (!opts.date) return { error: "date required to create/update a calendar event" };
  // BUG FIX (integration audit 2026-11-13) — `new Date("YYYY-MM-DDTHH:MM:00")`
  // is read in the SERVER's zone (UTC on Cloudflare), so crew events landed
  // 4-5h early. Send Google wall-clock times plus the business's time zone.
  const timeZone = await loadOwnerTimeZone(env, opts.ownerId, authHeaders);
  const startWall = wallClock(opts.date, opts.time || "09:00");
  const endWall = wallClock(opts.date, opts.time || "09:00", opts.durationMinutes || 120);
  if (!startWall || !endWall) return { error: "couldn't parse date/time" };
  const body = JSON.stringify({
    summary: opts.title || "Pressure Washing Job",
    description: opts.notes || "",
    location: opts.location || "",
    start: { dateTime: startWall, timeZone },
    end: { dateTime: endWall, timeZone },
  });

  if (existingEventId) {
    const patchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body,
    });
    if (patchRes.ok) return { success: true, eventId: existingEventId };
    // BUG FIX (integration audit 2026-11-13) — any failure (expired token,
    // rate limit, 5xx) used to fall through and create a SECOND event. Only
    // re-create when Google says the event is really gone (404/410).
    if (patchRes.status !== 404 && patchRes.status !== 410) {
      return { error: `Google Calendar update failed (HTTP ${patchRes.status}) — kept the existing event` };
    }
  }

  const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body,
  });
  if (!createRes.ok) return { error: "Google Calendar error: " + (await createRes.text().catch(() => "")).slice(0, 200) };
  const created = await createRes.json().catch(() => null) as any;
  if (!created?.id) return { error: "Google Calendar didn't return an event id" };
  await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(opts.jobId)}`, {
    method: "PATCH", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ crewGoogleEventIds: { ...eventMap, [opts.employeeId]: created.id } }),
  }).catch(() => {});
  return { success: true, eventId: created.id };
};

// BUG FIX (integration audit 2026-11-13) — a cancelled or deleted job left
// every crew member's copy on their own calendar. Removes them all. The job
// row may already be hard-deleted, so the caller's last-known map is the
// fallback; each employee lookup is still scoped to ownerId.
export const removeAllCrewEventsForJob = async (
  env: Record<string, string>,
  opts: { ownerId: string; jobId: string; knownEventIds?: Record<string, string>; origin: string },
): Promise<{ removed: number; failed: number }> => {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return { removed: 0, failed: 0 };
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const jobRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(opts.jobId)}&select=id,crewGoogleEventIds`, { headers: authHeaders }).catch(() => null);
  const jobRows = jobRes ? await jobRes.json().catch(() => []) : [];
  const job = Array.isArray(jobRows) ? jobRows[0] : null;
  const map: Record<string, string> = job ? (job.crewGoogleEventIds || {}) : (opts.knownEventIds || {});
  let removed = 0, failed = 0;
  for (const [employeeId, eventId] of Object.entries(map)) {
    if (!employeeId || typeof eventId !== "string" || !eventId) continue;
    const r: SyncResult = await syncEmployeeJobToCalendar(env, { employeeId, ownerId: opts.ownerId, jobId: opts.jobId, action: "delete", eventId, origin: opts.origin }).catch(() => ({ error: "failed" }));
    if ("success" in r) removed++; else if ("error" in r) failed++;
  }
  return { removed, failed };
};

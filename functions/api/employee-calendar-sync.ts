// Public POST endpoint wrapping _lib/employeeCalendarSync.ts — the browser
// (owner's session in JobsPage.tsx/JobDetailModal.tsx/AlfredPage.tsx) has no
// access to any employee's Google token, only the service-role key on this
// server does, so assigning/unassigning crew calls this instead of talking
// to Google directly. Fire-and-forget from the caller's side — a sync
// failure here should never block or fail the crew assignment itself.
import { syncEmployeeJobToCalendar } from "./_lib/employeeCalendarSync";

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const body = await context.request.json() as {
      employeeId?: string; ownerId?: string | null; jobId?: string; action?: "upsert" | "delete";
      title?: string; date?: string; time?: string; durationMinutes?: number; location?: string; notes?: string;
    };
    if (!body.employeeId || !body.jobId || !body.action) {
      return new Response(JSON.stringify({ error: "employeeId, jobId, and action required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const result = await syncEmployeeJobToCalendar(context.env, {
      employeeId: body.employeeId, ownerId: body.ownerId || null, jobId: body.jobId, action: body.action,
      title: body.title, date: body.date, time: body.time, durationMinutes: body.durationMinutes,
      location: body.location, notes: body.notes, origin: new URL(context.request.url).origin,
    });
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "sync failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

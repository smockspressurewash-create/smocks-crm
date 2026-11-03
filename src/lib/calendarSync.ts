// Keeps the owner's Google Calendar in step with CrewBoss jobs, from one
// place instead of each screen that happens to create or delete a job.
//
// BUG FIX (user report: "they appeared on my Google Calendar, but when I
// deleted them in the CRM, they didn't delete from my Google Calendar") —
// only cancelling a job on the Jobs page removed its event. Deleting a job,
// deleting a trash-can customer, or deleting a customer (whose jobs were left
// behind) never did. And only some ways of adding a job put it on the
// calendar (bulk imports and next-repeat jobs never did; next-repeat jobs
// also copied the finished job's event id, so they pointed at the old event).
//
// Now:
// - ensureJobsOnGoogle() puts every upcoming job without an event on the
//   calendar. A job is claimed in the database first (googleEventId set to
//   "pending:<time>" only if it is still empty), so two open tabs or phones
//   can never both create an event for the same job.
// - removeJobsFromGoogle() deletes the events of jobs that were deleted.
// - ensureJobsOnGoogle() also removes the event of a cancelled job ("Take
//   off schedule" on Trash Cans left it there) and moves the event when a
//   job's date or time changes on a screen that didn't move it itself.
import { createGCalEvent, deleteGCalEvent, updateGCalEvent } from "./googleApi";
import { getFreshOwnerGoogleToken } from "./messaging";
import { buildJobCalendarDescription } from "./utils";
import { supabase } from "./supabase";

const PENDING = "pending:";
const STALE_CLAIM_MS = 10 * 60 * 1000;
const MAX_PER_RUN = 20;

export const isRealEventId = (id?: string | null): id is string => !!id && !String(id).startsWith(PENDING);

// Job id -> its event id, for every job this tab has seen. Deletes look the
// event up here because the job is often already gone from state by then.
const knownEvents = new Map<string, string>();
// Events this tab deleted. A job restored by Undo still carries one of these
// ids, so it gets a new event instead of pointing at a deleted one.
const removedEvents = new Set<string>();
const inFlight = new Set<string>();
// Job id -> when creating its event last failed; retried after a pause
// instead of on every run.
const failedAt = new Map<string, number>();

// Event id -> the date and time it was last put at.
const eventWhen = new Map<string, string>();
const whenOf = (j: any) => `${j.scheduledDate || ""}|${j.scheduledTime || ""}`;

export function rememberJobEvents(jobs: any[]) {
  for (const j of jobs) {
    if (!j?.id || !isRealEventId(j.googleEventId)) continue;
    knownEvents.set(j.id, j.googleEventId);
    if (!eventWhen.has(j.googleEventId)) eventWhen.set(j.googleEventId, whenOf(j));
  }
}

const syncOn = (settings: any) => !!settings?.googleConnected && (settings?.autoSyncCalendar ?? true) !== false;

export async function removeJobsFromGoogle(jobIds: string[], settings: any): Promise<number> {
  const eventIds = jobIds.map(id => knownEvents.get(id)).filter(isRealEventId);
  jobIds.forEach(id => knownEvents.delete(id));
  if (eventIds.length === 0 || !settings?.googleConnected) return 0;
  const token = await getFreshOwnerGoogleToken(settings).catch(() => null);
  if (!token) { console.warn("[calendarSync] no Google token — couldn't remove", eventIds.length, "event(s)"); return 0; }
  let removed = 0;
  for (const eventId of eventIds) {
    try { await deleteGCalEvent(token, eventId); removedEvents.add(eventId); removed++; }
    catch (e: any) { console.warn("[calendarSync] event delete failed:", e?.message || e); }
  }
  return removed;
}

const eventTimes = (j: any) => {
  const start = new Date(j.scheduledDate + "T" + (j.scheduledTime || "09:00") + ":00");
  const hours = Number(j.duration) || (j.serviceCategory === "trash_can" ? 0.5 : 2);
  return { start: start.toISOString(), end: new Date(start.getTime() + hours * 3600000).toISOString() };
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const jobEventTitle = (job: any, c: any) =>
  (c ? `${c.firstName || ""} ${c.lastName || ""}`.trim() + " — " : "") + (job.serviceCategory === "trash_can" ? "Trash Can Cleaning" : "Pressure Washing");

// Jobs that should be on the calendar but aren't.
export function jobsMissingFromGoogle(jobs: any[]): any[] {
  const today = localToday();
  const open = (j: any) => j.status !== "completed" && j.status !== "cancelled" && j.scheduledDate && j.scheduledDate >= today && j.dayAssignmentConfirmed !== false;
  // One event shared by two jobs (an old repeat copied it): the earliest
  // open job keeps it, the others need their own.
  const owner = new Map<string, any>();
  for (const j of jobs) {
    if (!isRealEventId(j.googleEventId)) continue;
    const cur = owner.get(j.googleEventId);
    const better = !cur || (open(j) && !open(cur)) || (open(j) === open(cur) && (j.scheduledDate || "") < (cur.scheduledDate || ""));
    if (better) owner.set(j.googleEventId, j);
  }
  return jobs.filter(j => {
    if (!open(j) || inFlight.has(j.id)) return false;
    if (Date.now() - (failedAt.get(j.id) || 0) < STALE_CLAIM_MS) return false;
    const id = j.googleEventId;
    if (!id) return true;
    if (String(id).startsWith(PENDING)) return Date.now() - Number(String(id).slice(PENDING.length)) > STALE_CLAIM_MS;
    return removedEvents.has(id) || owner.get(id) !== j;
  });
}

export async function ensureJobsOnGoogle(opts: { jobs: any[]; customers: any[]; employees: any[]; settings: any; onLinked: (jobId: string, eventId: string) => void }): Promise<number> {
  const { jobs, customers, employees, settings, onLinked } = opts;
  if (!syncOn(settings)) return 0;
  const todo = jobsMissingFromGoogle(jobs).slice(0, MAX_PER_RUN);
  const cancelled = jobs.filter(j => j.status === "cancelled" && isRealEventId(j.googleEventId) && !removedEvents.has(j.googleEventId));
  const moved = jobs.filter(j => j.status !== "cancelled" && j.status !== "completed" && j.scheduledDate && isRealEventId(j.googleEventId)
    && !removedEvents.has(j.googleEventId) && eventWhen.has(j.googleEventId) && eventWhen.get(j.googleEventId) !== whenOf(j));
  if (todo.length === 0 && cancelled.length === 0 && moved.length === 0) return 0;
  const token = await getFreshOwnerGoogleToken(settings).catch(() => null);
  if (!token) return 0;
  for (const j of cancelled.slice(0, MAX_PER_RUN)) {
    try {
      await deleteGCalEvent(token, j.googleEventId);
      removedEvents.add(j.googleEventId);
      await (supabase as any).from("jobs").update({ googleEventId: null }).eq("id", j.id).eq("googleEventId", j.googleEventId);
    } catch (e: any) { console.warn("[calendarSync] cancelled job's event delete failed:", e?.message || e); }
  }
  for (const j of moved.slice(0, MAX_PER_RUN)) {
    eventWhen.set(j.googleEventId, whenOf(j));
    try { await updateGCalEvent(token, j.googleEventId, eventTimes(j)); }
    catch (e: any) { console.warn("[calendarSync] event move failed:", e?.message || e); }
  }
  let linked = 0;
  for (const j of todo) {
    inFlight.add(j.id);
    try {
      const prev = j.googleEventId || null;
      let claim = (supabase as any).from("jobs").update({ googleEventId: PENDING + Date.now() }).eq("id", j.id);
      claim = prev ? claim.eq("googleEventId", prev) : claim.is("googleEventId", null);
      const { data: claimed, error: claimErr } = await claim.select("id");
      if (claimErr || !Array.isArray(claimed) || claimed.length === 0) continue; // another tab has it, or the row changed
      const c = customers.find((x: any) => x.id === j.customerId);
      const crewIsEmployee = (j.crew || []).some((id: string) => employees.find((e: any) => e.id === id)?.role !== "owner");
      const base = `${window.location.origin}${window.location.pathname}`;
      const description = crewIsEmployee
        ? buildJobCalendarDescription(j, c, `${base}#/portal?job=${encodeURIComponent(j.id)}`, "View job in Crew Portal")
        : buildJobCalendarDescription(j, c, `${base}#/jobs?open=${encodeURIComponent(j.id)}`);
      let eventId = "";
      try {
        eventId = await createGCalEvent(token, { title: jobEventTitle(j, c), ...eventTimes(j), location: j.address || "", description });
      } catch (e: any) {
        failedAt.set(j.id, Date.now());
        console.warn("[calendarSync] event create failed for job", j.id, "—", e?.message || e);
      }
      await (supabase as any).from("jobs").update({ googleEventId: eventId || null }).eq("id", j.id);
      if (eventId) { knownEvents.set(j.id, eventId); eventWhen.set(eventId, whenOf(j)); onLinked(j.id, eventId); linked++; }
    } finally {
      inFlight.delete(j.id);
    }
  }
  return linked;
}

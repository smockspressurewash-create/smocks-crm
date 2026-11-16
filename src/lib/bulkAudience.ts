// Who a bulk text from Alfred goes to.
//
// BUG FIX (owner report): "text all the people that are scheduled for the
// Wednesday trash can cleanings" got "No customers matched". Alfred could
// only pick customers by an exact tag, so it passed a made-up tag
// ("Wednesday trash can cleaning") that no customer has. Customers can now
// be picked by the kind of job they have (trash cans, …) and the day of the
// week (or exact date) of that job, and a tag only has to be close.
// Used by the in-app Alfred and the text-message Alfred.

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export type AudienceFilter = {
  tag?: string;
  serviceCategory?: string; // "trash_can", "pressure_washing", … or plain words
  jobWeekday?: string;      // "wednesday"
  jobDate?: string;         // "2026-12-09"
};

const norm = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const weekdayOf = (ymd: string) => { const d = new Date(ymd + "T12:00:00"); return isNaN(d.getTime()) ? "" : WEEKDAYS[d.getDay()]; };

// "trash cans", "trash can cleaning", "trash_can" all mean trash_can.
export const categoryMatches = (job: any, want: string) => {
  const w = norm(want).replace(/s\b/g, "");
  if (!w) return true;
  const have = norm(job?.serviceCategory).replace(/s\b/g, "");
  if (have && (have.includes(w) || w.includes(have))) return true;
  if (/trash/.test(w)) return /trash/.test(have) || /trash can/i.test(String(job?.title || job?.serviceType || ""));
  return norm(job?.title || job?.serviceType || job?.description).includes(w);
};

// Jobs that count for a customer: not cancelled, of the wanted kind; the
// upcoming ones when there are any, else the latest one.
const countingJobs = (list: any[], todayYmd: string) => {
  const live = list.filter(j => j?.scheduledDate && j.status !== "cancelled");
  const upcoming = live.filter(j => j.scheduledDate >= todayYmd && j.status !== "completed");
  if (upcoming.length) return upcoming;
  const latest = live.sort((x, y) => y.scheduledDate.localeCompare(x.scheduledDate))[0];
  return latest ? [latest] : [];
};

export function filterAudience<T extends { id: string; tags?: string[] }>(customers: T[], jobs: any[], f: AudienceFilter, todayYmd: string): { rows: T[]; note?: string } {
  let rows = customers;
  let note: string | undefined;
  if (f.tag) {
    const t = norm(f.tag);
    const exact = rows.filter(c => (c.tags || []).some(x => norm(x) === t));
    const close = exact.length ? exact : rows.filter(c => (c.tags || []).some(x => { const n = norm(x); return n && (n.includes(t) || t.includes(n)); }));
    // A tag nobody has is usually a description ("Wednesday trash can
    // cleaning"): read it as a job type and day instead of matching nobody.
    if (!close.length && !f.serviceCategory && !f.jobWeekday && !f.jobDate) {
      const day = WEEKDAYS.find(d => t.includes(d));
      const cat = /trash/.test(t) ? "trash_can" : "";
      if (day || cat) { f = { ...f, jobWeekday: day, serviceCategory: cat || undefined }; note = `No customer has the tag "${f.tag}", so it was read as ${cat ? "trash can " : ""}jobs${day ? " on " + day[0].toUpperCase() + day.slice(1) : ""}.`; }
      else rows = [];
    } else rows = close;
  }
  const wantDay = f.jobWeekday ? WEEKDAYS.find(d => norm(f.jobWeekday).startsWith(d.slice(0, 3))) : undefined;
  if (f.serviceCategory || wantDay || f.jobDate) {
    const byCust = new Map<string, any[]>();
    for (const j of jobs || []) if (j?.customerId && (!f.serviceCategory || categoryMatches(j, f.serviceCategory))) (byCust.get(j.customerId) || byCust.set(j.customerId, []).get(j.customerId)!).push(j);
    rows = rows.filter(c => countingJobs(byCust.get(c.id) || [], todayYmd).some(j =>
      (!wantDay || weekdayOf(j.scheduledDate) === wantDay) &&
      (!f.jobDate || j.scheduledDate === f.jobDate)));
  }
  return { rows, note };
}

export const AUDIENCE_SCHEMA = {
  serviceCategory: { type: "string", description: "Only customers with a job of this kind, e.g. 'trash_can' for trash can cleaning customers" },
  jobWeekday: { type: "string", description: "Only customers whose upcoming job (or last job if none is coming) is on this day of the week, e.g. 'wednesday'" },
  jobDate: { type: "string", description: "Only customers with a job on this date (YYYY-MM-DD)" },
};

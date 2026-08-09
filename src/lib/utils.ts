import { supabase } from "./supabase";

// ─── Configurable poll interval (EGRESS) ───────────────────────────────────────
// Single source of truth for "how often do the cross-device fallback polls
// re-check Supabase" (jobs/customers/estimates, employees, app_settings,
// Alfred conversations/memory). Clamped so a bad/missing settings value can
// never produce a runaway fast poll (min 30s) or a value so long it stops
// being a meaningful fallback at all (max 600s).
export const DEFAULT_POLL_INTERVAL_MS = 120000;
export const POLL_INTERVAL_OPTIONS = [
  { label: "30 seconds (most responsive, highest egress)", value: 30000 },
  { label: "60 seconds", value: 60000 },
  { label: "120 seconds (recommended)", value: 120000 },
  { label: "300 seconds (lowest egress)", value: 300000 },
] as const;
export const getPollIntervalMs = (settings: { pollIntervalMs?: number } | null | undefined): number => {
  const v = Number(settings?.pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS;
  return Math.min(600000, Math.max(30000, v));
};

// ─── Job media (Storage-backed photos/videos/signatures) ──────────────────────
// Every Photo/ChecklistPhoto/JobVideo/JobSignOff can carry EITHER a Storage
// `url` (new captures, once the job-media bucket exists — see
// supabase/migrations/0017) OR a legacy inline `dataUrl`/`sigData` (every
// capture before this migration, or any capture where the Storage upload
// failed and fell back). Every render site must call mediaSrc() instead of
// reading .dataUrl directly, or Storage-backed media renders as broken.
export const mediaSrc = (url?: string | null, dataUrl?: string | null): string => url || dataUrl || "";

// Reconstructs a Blob from a data: URL (compressImageFile's output) for upload.
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

// ─── Image compression (FIX 6) ────────────────────────────────────────────────
// Job photos are stored as base64 dataURLs directly inside the `jobs.photos`
// JSONB column. An uncompressed phone-camera photo is routinely 3-8MB; each
// upload PATCHes the ENTIRE photos array back to Supabase, so a few full-res
// photos on one job blow past PostgREST/Cloudflare's request-body limit and
// the whole update is rejected — which look exactly like "photos don't sync",
// since nothing in the UI ever reports the failure as a size problem. Downscale
// to a reasonable max dimension and re-encode as JPEG before ever touching
// Supabase; this alone takes most photos from several MB down to ~100-300KB.
export const compressImageFile = (file: File, maxDim = 1600, quality = 0.72): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result as string); // fall back to uncompressed rather than losing the photo
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(reader.result as string); return; }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// ITEM 11 — shared video length/size cap. Previously only the top-level
// before/after video capture (EmployeePortal.tsx's addVideo) enforced this;
// the checklist-item video capture (PortalChecklistSection's file input) had
// no check at all, so a long/large video uploaded through a checklist item
// could still blow past Storage/egress limits (and, falling back to an
// inline dataUrl on an upload timeout, bloat the jobs row enough to make
// "Complete Job" saves intermittently fail — see CLAUDE.md's Complete Job
// wizard reliability notes). Both capture points now call this one check.
// Tightened from 30s/50MB — long/large field videos were the single biggest
// contributor to jobs-table egress bloat before Storage uploads existed, and
// still fall back to an inline base64 blob on any upload timeout/offline
// capture, so a hard low cap matters even with Storage in place.
export const MAX_JOB_VIDEO_SECONDS = 10;
export const MAX_JOB_VIDEO_MB = 10;

export const checkVideoLimits = (file: File): Promise<string | null> => {
  if (file.size > MAX_JOB_VIDEO_MB * 1024 * 1024) {
    return Promise.resolve(`Video exceeds ${MAX_JOB_VIDEO_MB}MB limit — trim to under ${MAX_JOB_VIDEO_SECONDS} seconds`);
  }
  return new Promise(resolve => {
    const vid = document.createElement("video");
    vid.preload = "metadata";
    const url = URL.createObjectURL(file);
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(vid.duration > MAX_JOB_VIDEO_SECONDS ? `Video exceeds ${MAX_JOB_VIDEO_SECONDS} seconds — please trim it first` : null);
    };
    // Can't read metadata (unsupported format, corrupt file) — don't block the
    // upload over a check that itself failed; let it through.
    vid.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    vid.src = url;
  });
};

// ─── Formatting ───────────────────────────────────────────────────────────────

export const fmt = (n: number | undefined | null): string => {
  if (n == null || isNaN(Number(n))) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// Generate a real RFC-4122 UUID v4 rather than a short base-36 string. The
// Supabase tables (jobs, estimates, customers, employees, job_requests) have
// `id` columns that are frequently typed `uuid` — a short id like "a3f9k2m1"
// makes every INSERT fail with "invalid input syntax for type uuid", which is
// why job saves timed out and estimate sync errored. A UUID is accepted by a
// `uuid` column AND by a `text` column, so this works no matter how the schema
// is set up. Falls back to a manual v4 build where crypto.randomUUID is absent
// (older/non-secure contexts).
export const uid = (): string => {
  try {
    if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
  } catch { /* fall through */ }
  // Manual RFC-4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const today = (): string => new Date().toISOString().slice(0, 10);

// AUDIT 3 — `today()` is UTC-based (toISOString), which rolls over to the
// next calendar date at 7-8pm US local time, not local midnight. That's fine
// for most call sites (scheduling dates set via <input type=date>, which is
// already local and only ever compared to itself), but the shift-timer's
// "same calendar day" check (Resume Day vs Start My Day, reset only at
// midnight) explicitly needs the EMPLOYEE'S local day boundary — using
// today() there meant an evening shift could get treated as spanning two
// different "days" hours before actual local midnight, causing Resume Day
// to incorrectly show Start My Day (which resets the clock) in the evening.
export const localDateStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// AUDIT FIX (Pay tab hours/earnings drift) — same class of bug as AUDIT 3
// above, but for arbitrary dates rather than "now": pay-period/chart bucket
// boundaries are built via `new Date(now); d.setDate(d.getDate() - n)`, which
// operates in the browser's LOCAL timezone, then were converted back to a
// YYYY-MM-DD key via `toISOString().slice(0,10)` — a UTC conversion. For any
// timezone west of UTC (all of the US), that can roll the boundary back to
// the PREVIOUS calendar day, especially in the evening — silently shifting a
// job right at a period/week/month boundary into the wrong bucket, or off
// the edge of the tracked window entirely. Use this instead of toISOString()
// whenever the Date was constructed via local-time arithmetic and needs to
// be compared against a local calendar-date string like job.scheduledDate.
export const localDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// BLOCKER 13 (mobile round 9) — the whole-day shift timer's "same day" check
// (Resume Day vs Start My Day) used localDateStr()'s plain midnight boundary,
// so a night-shift worker who ends (or auto-resumes via "I'm Here") a shift
// a few minutes either side of local midnight got treated as two different
// "days" — alreadyWorkedTodayHours came back 0, isResuming flipped to false,
// and the next clock-in silently reset the running total to zero instead of
// continuing it. Shift-continuity checks should use a 4am cutover instead:
// anything before 4am local still counts as part of the previous calendar
// day for shift-tracking purposes only (job scheduling/today's-date display
// elsewhere should keep using localDateStr()/today() unchanged).
export const shiftDayStr = (): string => {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ISSUE 2 — root cause of "Mark as Paid reverts after reload": both the
// employee's Pay tab (EmployeePortal.tsx) and the owner's Payroll tab
// (EmployeesPage.tsx's getCurrentPayPeriod) used to independently compute
// "the current pay period" as a SLIDING window — literally "today minus 13
// days" — recomputed fresh on every render from `new Date()`. That value
// shifts by one calendar day every day (and can differ between the owner's
// and employee's device if rendered at slightly different moments straddling
// midnight), so the `paidPeriods` key written when marking a period paid
// today (e.g. "2026-07-26") stops matching the "current period" key computed
// on the very next render that happens on a different day (e.g.
// "2026-07-27") — paidPeriodsMap[currentStart] comes back undefined, i.e.
// "unpaid", even though the write genuinely succeeded and is still sitting
// in Supabase under the old key. Anchoring every period to a fixed epoch
// (a Monday) makes period boundaries deterministic and IDENTICAL no matter
// who computes them or when — a period a device computed yesterday and one
// computed today for "the period that contains today" only differ once the
// real 14-day boundary is crossed, matching what "Mark as Paid" actually
// means (pay for a fixed period, not a rolling one).
const PAY_PERIOD_EPOCH = new Date(2024, 0, 1); // Monday, Jan 1 2024 — arbitrary fixed anchor
export const getPayPeriodBounds = (referenceDate: Date = new Date(), periodsAgo = 0): { start: string; end: string } => {
  const daysSinceEpoch = Math.floor((referenceDate.getTime() - PAY_PERIOD_EPOCH.getTime()) / 86400000);
  const periodIndex = Math.floor(daysSinceEpoch / 14) - periodsAgo;
  const start = new Date(PAY_PERIOD_EPOCH);
  start.setDate(start.getDate() + periodIndex * 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  return { start: localDateKey(start), end: localDateKey(end) };
};

export const daysFromNow = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysSince = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

// BLOCKER 2 (mobile round 7) — root cause of "Employees Hours/Payroll shows
// zero despite the hours existing in Supabase": jobs fetched from Supabase
// were used as-is with no casing normalization (unlike normalizeEmployee in
// App.tsx). `loggedHours` is quoted correctly in migration 0005, but any job
// row written before that migration ran, or a column added by hand through
// the Supabase dashboard without quoting, folds to `loggedhours` — every
// downstream `Number(j.loggedHours || j.duration || 0)` (EmployeesPage,
// Dashboard, JobsPage, EmployeePortal) then silently reads undefined as 0
// even though the real number is sitting right there under the lowercase
// key. Shared here so every Supabase job-fetch site (App.tsx's refetchData,
// EmployeePortal.tsx's own jobs poll) normalizes the same way.
// BLOCKER 12 (mobile round 7) — "photo count" badges (Live Crew View,
// Jobs list) only ever counted the top-level job.photos array (the
// dedicated Before/After gallery), but most of the photos an employee
// actually takes come from the per-checklist-item camera button
// (PortalChecklistSection.addItemPhoto in EmployeePortal.tsx), which stores
// them nested on preChecklist/duringChecklist/postChecklist items instead —
// a genuinely separate field, not just a naming mismatch. Counting only
// job.photos made real, saved photo activity look like it "went missing."
export const totalJobPhotoCount = (job: any): number => {
  if (!job) return 0;
  const top = Array.isArray(job.photos) ? job.photos.length : 0;
  const checklists = [job.preChecklist, job.duringChecklist, job.postChecklist, job.checklist];
  const nested = checklists.reduce((s: number, list: any) => s + (Array.isArray(list)
    ? list.reduce((s2: number, item: any) => s2 + (Array.isArray(item?.photos) ? item.photos.length : 0), 0)
    : 0), 0);
  return top + nested;
};

export const normalizeJobRow = (j: any): any => ({
  ...j,
  loggedHours: j.loggedHours ?? j.loggedhours ?? j.logged_hours ?? j.duration ?? 0,
  clockInAt: j.clockInAt ?? j.clockinat ?? j.clock_in_at ?? null,
  arrivedAt: j.arrivedAt ?? j.arrivedat ?? j.arrived_at ?? null,
  lunchStartAt: j.lunchStartAt ?? j.lunchstartat ?? j.lunch_start_at ?? null,
  lunchMinutes: j.lunchMinutes ?? j.lunchminutes ?? j.lunch_minutes ?? 0,
  invoiceSentAt: j.invoiceSentAt ?? j.invoicesentat ?? j.invoice_sent_at ?? null,
  amountCollected: j.amountCollected ?? j.amountcollected ?? j.amount_collected ?? 0,
  scheduledTime: j.scheduledTime ?? j.scheduledtime ?? j.scheduled_time ?? "",
  // crewAssignedAt was never in this list (unlike every other camelCase
  // field above) despite CLAUDE.md flagging it as JSONB and this project's
  // repeated history of unquoted-DDL columns folding to lowercase in
  // Postgres. If it was ever created without quotes, every read of
  // job.crewAssignedAt silently comes back undefined (crew visibility is
  // unaffected — that's a separate array field — but the "New Assignment"
  // banner and cross-actor crew merge in reconcileCrewAfterAssign both rely
  // on this being populated).
  crewAssignedAt: j.crewAssignedAt ?? j.crewassignedat ?? j.crew_assigned_at ?? {},
});

// ─── Timeframes ───────────────────────────────────────────────────────────────

export interface Timeframe {
  key: string;
  label: string;
  days: number;
}

export const TIMEFRAMES: Timeframe[] = [
  { key: "7d",  label: "7D",  days: 7   },
  { key: "30d", label: "30D", days: 30  },
  { key: "90d", label: "90D", days: 90  },
  { key: "6m",  label: "6M",  days: 180 },
  { key: "1y",  label: "1Y",  days: 365 },
  { key: "all", label: "All", days: 9999},
];

export const filterByTimeframe = <T extends Record<string, unknown>>(
  arr: T[],
  dateKey: keyof T,
  timeframe: string,
  customStart?: string,
  customEnd?: string
): T[] => {
  if (timeframe === "custom" && customStart && customEnd) {
    return arr.filter(item => {
      const d = item[dateKey] as string;
      return d >= customStart && d <= customEnd;
    });
  }
  const tf = TIMEFRAMES.find(t => t.key === timeframe);
  if (!tf || tf.days === 9999) return arr;
  const cutoff = daysFromNow(-tf.days);
  return arr.filter(item => (item[dateKey] as string) >= cutoff);
};

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineStage {
  key: string;
  label: string;
  color: string;
  border: string;
  text: string;
}

export const pipelineStages: PipelineStage[] = [
  { key: "lead",          label: "Lead",       color: "bg-gray-600",    border: "border-gray-600/40",    text: "text-gray-300"    },
  { key: "contacted",     label: "Contacted",  color: "bg-blue-600",    border: "border-blue-600/40",    text: "text-blue-300"    },
  { key: "estimate_sent", label: "Est Sent",   color: "bg-purple-600",  border: "border-purple-600/40",  text: "text-purple-300"  },
  { key: "approved",      label: "Approved",   color: "bg-yellow-500",  border: "border-yellow-500/40",  text: "text-yellow-300"  },
  { key: "scheduled",     label: "Scheduled",  color: "bg-orange-500",  border: "border-orange-500/40",  text: "text-orange-300"  },
  { key: "completed",     label: "Completed",  color: "bg-green-600",   border: "border-green-600/40",   text: "text-green-300"   },
  { key: "paid",          label: "Paid",       color: "bg-emerald-500", border: "border-emerald-500/40", text: "text-emerald-300" },
  { key: "lost",          label: "Lost",       color: "bg-red-800",     border: "border-red-800/40",     text: "text-red-400"     },
];

// ─── Priority Levels ──────────────────────────────────────────────────────────

export interface PriorityLevel {
  key: string;
  label: string;
  color: string;
  tone: string;
}

export const priorityLevels: PriorityLevel[] = [
  { key: "low",    label: "Low",    color: "bg-gray-600",   tone: "gray"   },
  { key: "normal", label: "Normal", color: "bg-blue-600",   tone: "blue"   },
  { key: "high",   label: "High",   color: "bg-yellow-600", tone: "yellow" },
  { key: "urgent", label: "Urgent", color: "bg-red-600",    tone: "red"    },
];

// ─── Job / Estimate Dropdowns ─────────────────────────────────────────────────

export const cancelReasons = [
  "Customer cancelled",
  "Weather",
  "No show",
  "Rescheduled",
  "Price dispute",
  "Equipment failure",
  "Other",
];

export const recurringFreqs = [
  { key: "weekly",    label: "Weekly",    days: 7   },
  { key: "biweekly",  label: "Bi-Weekly", days: 14  },
  { key: "monthly",   label: "Monthly",   days: 30  },
  { key: "quarterly", label: "Quarterly", days: 90  },
  { key: "biannual",  label: "Bi-Annual", days: 182 },
  { key: "annual",    label: "Annual",    days: 365 },
];

export const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// FEATURE 6 — resolves an estimate's deposit to an actual dollar figure,
// whether the owner configured it as a flat amount (depositType "amount",
// the default/back-compat behavior) or a percentage of the total.
export const computeDepositAmount = (
  est: { depositRequired?: number; depositType?: string } | undefined | null,
  total: number
): number => {
  if (!est?.depositRequired) return 0;
  if (est.depositType === "percent") return Math.round(total * (Number(est.depositRequired) / 100) * 100) / 100;
  return Number(est.depositRequired) || 0;
};

// FEATURE 7 — combines every stacked manual discount (each either a flat $ or
// a % of subtotal) into one dollar total. Single shared implementation so
// EstimateBuilder/ClientPortal/JobsPage/JobDetailModal can never disagree on
// what a given discounts[] array actually totals to.
export const computeDiscountsTotal = (discounts: Array<{ type?: string; value?: number }> | undefined, subtotal: number): number => {
  return (discounts || []).reduce((sum, d) => {
    const amt = d.type === "percent" ? subtotal * (Number(d.value) / 100) : Number(d.value) || 0;
    return sum + Math.max(0, amt);
  }, 0);
};

// FEATURE 5 — single shared "is this employee unavailable on this date" check
// (specific blocked date OR a recurring weekday-off), so every place that
// assigns crew (JobsPage's quick-request AND new-job dropdown, JobDetailModal's
// crew section) agrees on the same answer instead of each reimplementing —
// and possibly disagreeing on — the availability.includes() check.
export const isEmployeeUnavailable = (emp: { availability?: string[]; recurringDaysOff?: number[] } | undefined | null, dateStr: string | undefined | null): boolean => {
  if (!emp || !dateStr) return false;
  if ((emp.availability || []).includes(dateStr)) return true;
  const daysOff = emp.recurringDaysOff || [];
  if (daysOff.length === 0) return false;
  const day = new Date(dateStr + "T12:00:00").getDay();
  return daysOff.includes(day);
};

// FEATURE 5 — counts days off actually taken within [startDate, endDate]
// (inclusive, YYYY-MM-DD strings): specific blocked dates in range, plus every
// occurrence of a recurring weekday-off within that range. Used to compare
// against the owner-set maxDaysOffPerWeek/maxDaysOffPerMonth caps.
export const countDaysOffInRange = (emp: { availability?: string[]; recurringDaysOff?: number[] } | undefined | null, startDate: string, endDate: string): number => {
  if (!emp) return 0;
  const specific = (emp.availability || []).filter(d => d >= startDate && d <= endDate);
  const daysOff = emp.recurringDaysOff || [];
  let recurringCount = 0;
  if (daysOff.length > 0) {
    const start = new Date(startDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      if (daysOff.includes(d.getDay()) && !specific.includes(ds)) recurringCount++;
    }
  }
  return specific.length + recurringCount;
};

// FEATURE 4 — combines every distinct linked service's checklistTemplate into
// one flat job checklist (e.g. House Wash checklist + Deck Wash checklist),
// deduped by serviceId so a service appearing as multiple line items (a
// quantity split, say) doesn't duplicate its checklist. Single shared
// implementation so every job-creation call site (new job, estimate→job
// conversion, recurring next-occurrence) builds the same combined list the
// same way, rather than each one reimplementing — and possibly disagreeing
// on — the combine logic.
export const buildChecklistFromServices = (
  lineItems: Array<{ serviceId?: string }> | undefined,
  services: Array<{ id: string; checklistTemplate?: Array<{ label: string; required?: boolean; photoRequired?: boolean }> }> | undefined
): Array<{ id: string; label: string; done: boolean; required?: boolean; photoRequired?: boolean }> => {
  // id included (not just label/done) so this same array can seed BOTH the
  // legacy job.checklist field (CrewView/JobsPage progress %) and the real
  // field-portal checklist (job.preChecklist, which is what EmployeePortal.tsx
  // actually shows the crew — it only falls back to hardcoded PRE_DEFAULTS
  // when empty, so this is what makes custom items visible in the field,
  // not just sit unused in the legacy field).
  const combined: Array<{ id: string; label: string; done: boolean; required?: boolean; photoRequired?: boolean }> = [];
  const seenServiceIds = new Set<string>();
  for (const li of lineItems || []) {
    if (!li.serviceId || seenServiceIds.has(li.serviceId)) continue;
    seenServiceIds.add(li.serviceId);
    const svc = (services || []).find(s => s.id === li.serviceId);
    for (const item of svc?.checklistTemplate || []) {
      combined.push({ id: uid(), label: item.label, done: false, required: item.required, photoRequired: item.photoRequired });
    }
  }
  if (seenServiceIds.size > 1) console.log("[Verify] custom checklists per service (combining) — working — combined", seenServiceIds.size, "services into", combined.length, "items");
  return combined;
};

// FEATURE 3 — single source of truth for "what's the next occurrence date"
// across all recurring-schedule modes, so the owner-side (JobsPage.tsx) and
// employee-side (EmployeePortal.tsx) Complete-Job flows can never compute two
// different next dates for the same job (the exact "two independent copies
// of the same logic disagree" bug class this codebase has hit before).
export const computeNextRecurringDate = (job: { recurringMode?: string; recurringFreq?: string; recurringInterval?: number; recurringWeekdays?: number[]; scheduledDate?: string }, fromDateStr?: string): string => {
  const from = new Date((fromDateStr || job.scheduledDate || today()) + "T12:00:00");
  const mode = job.recurringMode || "preset";
  if (mode === "weekdays" && Array.isArray(job.recurringWeekdays) && job.recurringWeekdays.length > 0) {
    const wanted = new Set(job.recurringWeekdays);
    const d = new Date(from);
    for (let i = 1; i <= 14; i++) {
      d.setDate(from.getDate() + i);
      if (wanted.has(d.getDay())) return d.toISOString().slice(0, 10);
    }
    return from.toISOString().slice(0, 10);
  }
  if (mode === "days") {
    const n = Math.max(1, Number(job.recurringInterval) || 1);
    const d = new Date(from); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  if (mode === "weeks") {
    const n = Math.max(1, Number(job.recurringInterval) || 1);
    const d = new Date(from); d.setDate(d.getDate() + n * 7);
    return d.toISOString().slice(0, 10);
  }
  if (mode === "months") {
    const n = Math.max(1, Number(job.recurringInterval) || 1);
    const d = new Date(from); d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 10);
  }
  // Preset (back-compat): fixed day-count lookup, same table used before
  // custom schedules existed.
  const days = recurringFreqs.find(f => f.key === job.recurringFreq)?.days || 30;
  const d = new Date(from); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// AUDIT A (mobile round 4) — the Jobs list badge used to always print
// job.recurringFreq regardless of recurringMode, so a "days"/"weeks"/
// "months"/"weekdays" schedule (anything but the legacy "preset" mode)
// showed a misleading label like "monthly" even when the actual schedule was
// e.g. "every 2 weeks" or "Mon/Wed". Single shared label builder so the Jobs
// list, Estimates list, and Calendar can't independently drift on this again.
export const describeRecurringSchedule = (job: { recurringMode?: string; recurringFreq?: string; recurringInterval?: number; recurringWeekdays?: number[] } | undefined | null): string => {
  if (!job) return "";
  const mode = job.recurringMode || "preset";
  if (mode === "weekdays") {
    const days = (job.recurringWeekdays || []).map(i => weekdayLabels[i]).filter(Boolean);
    return days.length ? days.join("/") : "weekly";
  }
  if (mode === "days") return "every " + Math.max(1, Number(job.recurringInterval) || 1) + "d";
  if (mode === "weeks") return "every " + Math.max(1, Number(job.recurringInterval) || 1) + "wk";
  if (mode === "months") return "every " + Math.max(1, Number(job.recurringInterval) || 1) + "mo";
  return recurringFreqs.find(f => f.key === job.recurringFreq)?.label || job.recurringFreq || "recurring";
};

export const equipmentList = [
  "4GPM Cold Water Pressure Washer",
  "8GPM Hot Water Pressure Washer",
  "Roof Pump (12V)",
  "Surface Cleaner (20\")",
  "Telescoping Wand (24ft)",
  "Downstream Injector",
  "Buffer Tank (65gal)",
];

export const requiredChemicalsList = [
  "SH 12.5%",
  "Surfactant",
  "Oxalic Acid",
  "Degreaser",
  "Rust Remover",
  "Roof Cleaner (SH blend)",
];

export const jobTagOptions = [
  "Emergency", "Warranty", "Follow-up", "HOA", "Commercial", "VIP",
];

export const expenseCats = [
  "Fuel", "Chemicals", "Equipment", "Insurance", "Marketing",
  "Truck Payment", "Maintenance", "Subcontractors", "Office", "Other",
];

// ─── Alfred personalities ─────────────────────────────────────────────────────

export interface Personality {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  systemPrompt: string;
  greeting?: string;
  icon?: string;
  color?: string;
}

// FIX 6 — these systemPrompt strings are the single source of truth for how
// each personality actually talks (AlfredPage.tsx looks these up by `id`,
// not by array position — see the fix note there for why that mattered).
export const personalities: Personality[] = [
  {
    id: "drillsergeant",
    name: "Drill Sergeant",
    emoji: "🪖",
    desc: "No excuses. Get to work.",
    systemPrompt: "You are Alfred, AI chief-of-staff for Crew Boss, a pressure-washing business in York, PA. Personality: DRILL SERGEANT. Be aggressive and motivating — every response is a pep talk crossed with an order. Use military terminology constantly (mission, sitrep, deploy, fall in line, at ease, dismissed, roger that, no excuses soldier). Use ALL CAPS for emphasis on key words or commands (e.g. 'GET THAT INVOICE OUT NOW' / 'OUTSTANDING WORK'). Keep responses SHORT and punchy — 2-4 lines usually. Call out laziness or slipping numbers hard. Celebrate wins hard. End every response with 'Alfred out.'",
    greeting: "LISTEN UP. What's the mission today? Alfred out.",
  },
  {
    id: "butler",
    name: "Butler",
    emoji: "🎩",
    desc: "Refined, efficient, loyal.",
    systemPrompt: "You are Alfred, a distinguished AI chief-of-staff for Crew Boss in York, PA. Personality: a formal, composed British butler. Always address the user as 'sir'. Be courteous, polished, and refined in every response — use British expressions and vocabulary (e.g. 'right away, sir', 'quite so', 'brilliant', 'I dare say', 'splendid', 'shall I'). Anticipate needs before being asked. Never use slang or casual American phrasing. Keep responses concise and unfailingly professional. End responses with 'Your servant, Alfred.'",
    greeting: "Good day, sir. How may I be of service?",
  },
  {
    id: "quietpro",
    name: "Quiet Pro",
    emoji: "🧠",
    desc: "Facts only. No filler.",
    systemPrompt: "You are Alfred, a no-nonsense AI assistant for Crew Boss in York, PA. Personality: silent professional. Terse and data-driven — lead with numbers and facts, prefer bullet points over prose. Zero pleasantries: no greetings, no 'I hope you're well', no small talk, no sign-off. Never pad a response with filler or restate the question. If a one-word or one-line answer suffices, give only that.",
    greeting: "Ready.",
  },
  {
    id: "savage",
    name: "Savage Mode",
    emoji: "🔥",
    desc: "Roasts you into productivity.",
    systemPrompt: "You are Alfred in Savage Mode for Crew Boss in York, PA. Personality: roast comedian crossed with a sharp business coach. Sarcastic, witty, and brutally honest — roast the user's slipping numbers or procrastination, don't hold back on the jokes. Underneath the roasting, always be genuinely helpful and push them to actually improve. Never actually cruel or harmful, just savage. End with 'Stay dangerous. — Alfred'",
    greeting: "Oh look who decided to show up. What do you need? — Alfred",
  },
];

// ─── Weather helpers ──────────────────────────────────────────────────────────

export const weatherRisk = (rainChance: number, temp: number, wind: number): "none" | "rain" | "freeze" | "wind" | "hot" => {
  if (temp < 35) return "freeze";
  if (rainChance > 50) return "rain";
  if (wind > 20) return "wind";
  if (temp > 90) return "hot";
  return "none";
};

export const forecastFor = <T extends { date: string }>(forecast: T[], dateStr: string): T | undefined =>
  forecast.find(f => f.date === dateStr);

// ─── Automation helpers ───────────────────────────────────────────────────────

export const normalizeAutomation = (a: Record<string, unknown>) => ({
  id: (a.id as string) ?? uid(),
  name: (a.name as string) ?? "Untitled",
  trigger: (a.trigger as string) ?? "",
  action: (a.action as string) ?? "",
  active: (a.active as boolean) ?? false,
  lastTriggered: (a.lastTriggered as string | null) ?? null,
  count: (a.count as number) ?? 0,
  steps: (a.steps as unknown[]) ?? [],
  description: (a.description as string) ?? "",
});

// ─── Employee job rating ──────────────────────────────────────────────────────
// Scores a single completed job out of 100: on-time arrival (30pts), checklist
// completion (40pts), customer sign-off obtained (30pts). Used to roll up an
// employee's overall rating after each job they complete.
export const computeJobRatingScore = (job: Record<string, any>): number => {
  let score = 0;
  // On-time arrival
  if (job.scheduledDate && job.clockInAt) {
    const scheduled = new Date(`${job.scheduledDate}T${job.scheduledTime || "09:00"}:00`).getTime();
    const lateMinutes = (job.clockInAt - scheduled) / 60000;
    if (lateMinutes <= 5) score += 30;
    else if (lateMinutes <= 15) score += 20;
    else if (lateMinutes <= 30) score += 10;
  } else {
    score += 15; // no schedule to judge against — neutral credit
  }
  // Checklist completion
  const allItems = [...(job.preChecklist || []), ...(job.duringChecklist || []), ...(job.postChecklist || [])];
  if (allItems.length > 0) {
    score += Math.round((allItems.filter((i: any) => i.done).length / allItems.length) * 40);
  } else {
    score += 20;
  }
  // Customer sign-off
  if (job.signOff) score += 30;
  return Math.max(0, Math.min(100, score));
};

// ─── IRS Rate (mileage deduction) ────────────────────────────────────────────

export const IRS_RATE = 0.67; // 2024 rate per mile

// ─── Per-job-type pay rate override ──────────────────────────────────────────
// Employees have a default hourlyRate plus optional overrides keyed by job
// type (employee.jobTypeRates = { residential: 15, commercial: 18, ... }).
// A job's own jobType (falling back to its linked customer address's
// propertyType, since older jobs never set jobType directly) decides which
// override applies; no override/no match falls back to the flat hourlyRate.
export const getEffectiveRate = (employee: any, job: any): number => {
  const jobType = job?.jobType || job?.propertyType;
  const override = jobType ? employee?.jobTypeRates?.[jobType] : undefined;
  return override !== undefined && override !== null && override !== ("" as any)
    ? Number(override) || 0
    : Number(employee?.hourlyRate) || 0;
};

// ─── Job <-> Supabase columns ─────────────────────────────────────────────────
// The `jobs` table's columns are named to match the Job type's camelCase field
// names exactly (e.g. "customerId", "scheduledDate") — see the SQL in the
// Supabase SQL editor that adds these camelCase columns. No code-side mapping
// is needed; reads/writes pass Job objects straight through to Supabase.

// ─── withTimeout ──────────────────────────────────────────────────────────────
// Races a promise against a hard timeout so a hung await (no error, no
// resolve — e.g. a stuck Supabase internal navigator-lock, or a dead network
// request) can never block a button's loading state forever. A normal
// rejection from the wrapped promise still propagates to the caller as usual.
export const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label + " timed out")), ms)),
  ]);

// ─── stripLegacyJobFields ───────────────────────────────────────────────────
// organizationId/org_id have been added to a job payload twice now on the
// strength of evidence that didn't hold up — the column has never existed on
// this deployment (see JobsPage.tsx/AlfredPage.tsx revert comments). The real
// danger isn't the insert that adds it — it's that once such a field lands on
// a job object sitting in React state (and therefore in the "smocks.jobs"
// localStorage cache via usePersistent), EVERY future spread of that job
// object (the 30s bulk autosave, "complete recurring job" duplicating it into
// next occurrence, etc.) carries it forward and keeps failing, even after the
// code that originally added it is reverted. Stripping defensively at every
// write site self-heals any job already poisoned in a user's browser instead
// of requiring them to clear localStorage.
const LEGACY_BAD_JOB_FIELDS = ["organizationId", "org_id"] as const;
export const stripLegacyJobFields = <T extends Record<string, any>>(job: T): T => {
  const copy: any = { ...job };
  LEGACY_BAD_JOB_FIELDS.forEach(f => delete copy[f]);
  return copy;
};

// ─── reconcileCrewAfterAssign ───────────────────────────────────────────────
// Four independent places compute a job's new crew array the same way:
// read whatever `crew` this surface's own local state last knew about,
// append/accept, blind-overwrite the whole array back to Supabase.
//   - JobDetailModal.tsx toggleCrew (owner direct-assign, every Edit Job UI)
//   - EmployeePortal.tsx handleAcceptRequest / handleInlineAccept (employee
//     accepting a pending request)
//   - AlfredPage.tsx's assign_employee tool
// None of them know about each other's in-flight writes, and `crew` is a
// plain JSONB array (not a Postgres array column), so there's no DB-side
// atomic append to fall back on. If two of these fire close together for
// the SAME job from two different actors/devices — the exact pattern of
// testing "assign X directly" and "request Y then have Y accept" back to
// back — each computes its new array from a snapshot that doesn't know
// about the other's addition, and whichever write reaches Supabase LAST
// silently overwrites the other's, dropping that person from the crew with
// no error anywhere. This is almost certainly why assignment/requests have
// seemed to "come and go" with no obvious trigger.
// This can't be made fully atomic without a Postgres function, but
// re-reading the live row immediately after writing and merging in anyone
// present there but missing from what was just written shrinks the danger
// window from "however stale local state is" (up to a full poll interval,
// tens of seconds) down to a single round trip. `writeFn` is whatever the
// caller normally uses to persist a patch, so this reuses each surface's
// own retry/toast/error handling rather than writing raw.
export const reconcileCrewAfterAssign = async (
  jobId: string,
  writtenCrew: string[],
  writtenCrewAssignedAt: Record<string, number>,
  writeFn: (patch: { crew: string[]; crewAssignedAt: Record<string, number> }) => void | Promise<any>
): Promise<void> => {
  try {
    const { data } = await (supabase as any).from("jobs").select("crew, crewAssignedAt").eq("id", jobId).maybeSingle();
    const liveCrew: any[] = Array.isArray(data?.crew) ? data.crew : [];
    const missing = liveCrew.filter(id => !writtenCrew.includes(id));
    if (missing.length === 0) return;
    console.warn("[CrewRace] another actor added", missing, "to job", jobId, "between our read and write — merging instead of overwriting");
    const merged = [...writtenCrew, ...missing];
    const mergedAssignedAt = { ...(data?.crewAssignedAt || {}), ...writtenCrewAssignedAt };
    await writeFn({ crew: merged, crewAssignedAt: mergedAssignedAt });
  } catch (e: any) {
    console.warn("[CrewRace] reconcile check failed (non-fatal):", e?.message);
  }
};

// ─── Timeout-safe insert retries ───────────────────────────────────────────
// withTimeout() rejecting on an insert means the CLIENT gave up waiting —
// not that the write failed server-side. Under real-world Supabase slowness
// (e.g. an over-quota/throttled project), the original request can still
// land a few seconds after the 15s window lapses. A naive "just retry" is
// unsafe though: retrying blindly can create a genuine duplicate row. These
// two helpers make retrying safe for the two shapes of insert this app does.

// For inserts where WE pick the id client-side (uid()) before writing — e.g.
// jobs. If the first attempt actually landed, Postgres rejects the identical
// retry with a primary-key violation, which reads as "already saved" instead
// of a real failure. Never use this for a server-generated-id table.
export const isDuplicateKeyError = (error: any): boolean =>
  error?.code === "23505" || /duplicate key/i.test(error?.message || "");

export const insertClientIdRowWithRetry = async (
  table: string,
  row: { id: string; [k: string]: any }
): Promise<{ error: any }> => {
  try {
    return await withTimeout<any>((supabase as any).from(table).insert(row), 30000, `Save ${table}`);
  } catch (e: any) {
    if (!String(e?.message || "").includes("timed out")) throw e;
    console.warn(`[insertClientIdRowWithRetry] ${table} insert timed out — retrying once (duplicate-key response on retry means the first attempt actually landed)`);
    const retry: any = await withTimeout<any>((supabase as any).from(table).insert(row), 30000, `Save ${table} (retry after timeout)`).catch((e2: any) => ({ error: e2 }));
    if (!retry?.error || isDuplicateKeyError(retry.error)) return { error: null };
    return retry;
  }
};

// job_requests.id is server-generated (gen_random_uuid()) — a blind retry
// would leave two live "pending" rows for the same job+employee. Check for a
// just-created matching request before retrying; if the first attempt
// actually landed, use that row instead of inserting a second one.
export const insertJobRequestSafely = async (payload: {
  job_id: string; employee_id: string; owner_id: string; status?: string; message?: string | null;
}): Promise<{ data: { id: string } | null; error: any }> => {
  try {
    return await withTimeout<any>(
      (supabase as any).from("job_requests").insert(payload).select("id").single(),
      30000, "Save request"
    );
  } catch (e: any) {
    if (!String(e?.message || "").includes("timed out")) throw e;
    console.warn("[insertJobRequestSafely] insert timed out — checking whether it landed before retrying");
    const existing: any = await withTimeout<any>(
      (supabase as any).from("job_requests").select("id").eq("job_id", payload.job_id).eq("employee_id", payload.employee_id)
        .eq("status", payload.status || "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      8000, "Check existing request"
    ).catch(() => ({ data: null }));
    if (existing?.data?.id) {
      console.log("[insertJobRequestSafely] found the original request — it actually saved, just responded slowly");
      return { data: existing.data, error: null };
    }
    return await withTimeout<any>(
      (supabase as any).from("job_requests").insert(payload).select("id").single(),
      30000, "Save request (retry after timeout)"
    ).catch((e2: any) => ({ data: null, error: e2 }));
  }
};

const JOB_MEDIA_BUCKET = "job-media";

// Uploads a photo/video/signature to the job-media Storage bucket and
// returns its public URL — or `null` on ANY failure (bucket/policy not
// applied yet — see supabase/migrations/0017 — offline, timeout, etc.).
// Callers MUST treat null as "fall back to the dataUrl behavior from before
// this migration," never as a thrown error — this function itself never
// throws, so photo capture can never regress to worse than it was before
// Storage existed.
export const uploadJobMedia = async (blob: Blob, path: string, contentType?: string): Promise<string | null> => {
  try {
    const { error } = await withTimeout<any>(
      (supabase as any).storage.from(JOB_MEDIA_BUCKET).upload(path, blob, {
        contentType: contentType || blob.type || "application/octet-stream",
        upsert: true,
      }),
      15000,
      "Media upload to Storage"
    );
    if (error) { console.warn("[uploadJobMedia] upload failed, falling back to inline dataUrl:", error.message); return null; }
    const { data } = (supabase as any).storage.from(JOB_MEDIA_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e: any) {
    console.warn("[uploadJobMedia] threw, falling back to inline dataUrl:", e?.message);
    return null;
  }
};

// FEATURE — photo/video auto-deletion (owner opt-in, Settings → Data;
// disabled by default — see settings.mediaRetentionDays). Recovers the
// job-media Storage object's path from the public URL uploadJobMedia's
// getPublicUrl() produced, since deleting from Storage needs the path, not
// the URL. Returns null for legacy dataUrl-only media (nothing in Storage to
// delete for those — clearing the JSONB field is enough).
const jobMediaPathFromUrl = (url: string): string | null => {
  const marker = `/object/public/${JOB_MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
};

// Sweeps completed jobs older than `retentionDays` and strips their
// photos/videos/checklist-item photos (both the JSONB references AND the
// actual Storage objects behind any `url`-backed one) — irreversible, only
// ever called when the owner has explicitly enabled this in Settings.
// Signatures (job.signOff) are deliberately left untouched — they're a
// service/approval record, not capture media. Called once per session from
// wherever it's wired in (see Dashboard.tsx), same "runs on page load,
// harmless no-op if nothing qualifies" pattern as Alfred's 7-day cleanup.
export const purgeOldJobMedia = async (
  jobs: any[],
  retentionDays: number,
  setJobs: (updater: (prev: any[]) => any[]) => void
): Promise<{ jobsPurged: number; filesDeleted: number }> => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const CHECKLIST_KEYS = ["preChecklist", "duringChecklist", "postChecklist"] as const;
  const hasMedia = (j: any) =>
    (j.photos || []).length > 0 || (j.videos || []).length > 0 ||
    CHECKLIST_KEYS.some(k => ((j[k] || []) as any[]).some((it: any) => (it.photos || []).length > 0));
  const candidates = jobs.filter(j => j.status === "completed" && j.scheduledDate && j.scheduledDate < cutoffStr && hasMedia(j));
  if (candidates.length === 0) return { jobsPurged: 0, filesDeleted: 0 };

  const paths: string[] = [];
  const collect = (arr: any[]) => (arr || []).forEach((m: any) => { const p = m.url && jobMediaPathFromUrl(m.url); if (p) paths.push(p); });
  for (const j of candidates) {
    collect(j.photos);
    collect(j.videos);
    for (const k of CHECKLIST_KEYS) for (const it of (j[k] || []) as any[]) collect(it.photos);
  }
  if (paths.length > 0) {
    try { await (supabase as any).storage.from(JOB_MEDIA_BUCKET).remove(paths); }
    catch (e: any) { console.warn("[MediaRetention] Storage delete failed (still clearing DB references):", e?.message); }
  }

  const stripJob = (j: any) => ({
    ...j,
    photos: [], videos: [],
    ...Object.fromEntries(CHECKLIST_KEYS.map(k => [k, (j[k] || []).map((it: any) => ({ ...it, photos: [] }))])),
  });
  const idSet = new Set(candidates.map(j => j.id));
  for (const j of candidates) {
    const stripped = stripJob(j);
    const patch = { photos: [], videos: [], preChecklist: stripped.preChecklist, duringChecklist: stripped.duringChecklist, postChecklist: stripped.postChecklist };
    await (supabase as any).from("jobs").update(patch).eq("id", j.id).then((r: any) => {
      if (r?.error) console.warn("[MediaRetention] job", j.id, "DB clear failed:", r.error.message);
    }).catch((e: any) => console.warn("[MediaRetention] job", j.id, "DB clear threw:", e?.message));
  }
  setJobs(prev => prev.map(j => idSet.has(j.id) ? stripJob(j) : j));
  console.log(`[MediaRetention] purged media from ${candidates.length} job(s) older than ${retentionDays} days, deleted ${paths.length} Storage file(s)`);
  return { jobsPurged: candidates.length, filesDeleted: paths.length };
};

// FEATURE — backfill: existing jobs captured BEFORE the Storage migration
// (see uploadJobMedia above) still carry full base64 photos/videos/signatures
// inline in the `jobs` table's JSONB columns — the original root cause of
// this project's Supabase egress overage (see supabase/migrations/0017).
// New captures already go to Storage; this is the one-time cleanup pass for
// everything captured before that existed. Owner-triggered only (Settings →
// Data), never automatic — rewriting/removing dataUrl is not reversible once
// the old row is overwritten, so each item is only stripped of its dataUrl
// AFTER its Storage upload is confirmed to have succeeded.
export interface MediaBackfillResult {
  jobsScanned: number;
  jobsUpdated: number;
  itemsMigrated: number;
  itemsFailed: number;
  bytesFreedApprox: number;
}

const dataUrlByteLength = (dataUrl: string): number => {
  const b64 = dataUrl.split(",")[1] || "";
  return Math.floor((b64.length * 3) / 4);
};

export const backfillJobMediaToStorage = async (
  jobs: any[],
  setJobs: (updater: (prev: any[]) => any[]) => void,
  onProgress?: (done: number, total: number) => void
): Promise<MediaBackfillResult> => {
  const CHECKLIST_KEYS = ["preChecklist", "duringChecklist", "postChecklist"] as const;
  const needsMigration = (j: any) =>
    (j.photos || []).some((p: any) => p.dataUrl && !p.url) ||
    (j.videos || []).some((v: any) => v.dataUrl && !v.url) ||
    (j.signOff?.sigData && !j.signOff?.sigUrl) ||
    CHECKLIST_KEYS.some(k => ((j[k] || []) as any[]).some((it: any) => (it.photos || []).some((p: any) => p.dataUrl && !p.url)));

  const candidates = jobs.filter(needsMigration);
  const result: MediaBackfillResult = { jobsScanned: candidates.length, jobsUpdated: 0, itemsMigrated: 0, itemsFailed: 0, bytesFreedApprox: 0 };
  if (candidates.length === 0) return result;

  // Migrates one photo/video-shaped item {id, dataUrl, ...} in place — on a
  // successful upload, dataUrl is deleted (base64 actually leaves the row)
  // and url is set; on failure the item is left completely untouched so it's
  // simply picked up again on the next run.
  const migrateItem = async (item: any, pathPrefix: string, defaultExt: string, defaultType: string): Promise<boolean> => {
    if (!item.dataUrl) return false;
    try {
      const blob = dataUrlToBlob(item.dataUrl);
      const url = await uploadJobMedia(blob, `${pathPrefix}-${item.id}.${defaultExt}`, blob.type || defaultType);
      if (!url) { result.itemsFailed++; return false; }
      result.bytesFreedApprox += dataUrlByteLength(item.dataUrl);
      delete item.dataUrl;
      item.url = url;
      result.itemsMigrated++;
      return true;
    } catch (e: any) {
      console.warn("[MediaBackfill] item", item.id, "failed:", e?.message);
      result.itemsFailed++;
      return false;
    }
  };

  let done = 0;
  for (const original of candidates) {
    const j = JSON.parse(JSON.stringify(original)); // deep clone — mutate freely, only commit on success
    let changed = false;

    for (const p of (j.photos || [])) if (p.dataUrl && !p.url) changed = (await migrateItem(p, `${j.id}/photo`, "jpg", "image/jpeg")) || changed;
    for (const v of (j.videos || [])) if (v.dataUrl && !v.url) changed = (await migrateItem(v, `${j.id}/video`, "mp4", "video/mp4")) || changed;
    for (const k of CHECKLIST_KEYS) for (const it of (j[k] || []) as any[]) for (const p of (it.photos || [])) if (p.dataUrl && !p.url) changed = (await migrateItem(p, `${j.id}/checklist`, "jpg", "image/jpeg")) || changed;
    // Signature uses a differently-named field (sigData/sigUrl, not
    // dataUrl/url) — handle it directly rather than forcing it through
    // migrateItem's generic {dataUrl/url} shape.
    if (j.signOff?.sigData && !j.signOff?.sigUrl) {
      try {
        const blob = dataUrlToBlob(j.signOff.sigData);
        const url = await uploadJobMedia(blob, `${j.id}/signature-${j.id}.png`, "image/png");
        if (url) {
          result.bytesFreedApprox += dataUrlByteLength(j.signOff.sigData);
          delete j.signOff.sigData;
          j.signOff.sigUrl = url;
          result.itemsMigrated++;
          changed = true;
        } else {
          result.itemsFailed++;
        }
      } catch (e: any) {
        console.warn("[MediaBackfill] signature for job", j.id, "failed:", e?.message);
        result.itemsFailed++;
      }
    }

    if (changed) {
      const patch = { photos: j.photos, videos: j.videos, preChecklist: j.preChecklist, duringChecklist: j.duringChecklist, postChecklist: j.postChecklist, signOff: j.signOff };
      const { error } = await (supabase as any).from("jobs").update(patch).eq("id", j.id);
      if (error) {
        console.warn("[MediaBackfill] job", j.id, "DB update failed:", error.message);
      } else {
        result.jobsUpdated++;
        setJobs(prev => prev.map(p => p.id === j.id ? { ...p, ...patch } : p));
      }
    }
    done++;
    onProgress?.(done, candidates.length);
  }
  console.log(`[MediaBackfill] scanned ${result.jobsScanned} job(s), updated ${result.jobsUpdated}, migrated ${result.itemsMigrated} item(s), ${result.itemsFailed} failed, ~${(result.bytesFreedApprox / 1024 / 1024).toFixed(1)}MB freed from the database`);
  return result;
};

// ITEM 10 — real OS-level "push-like" alerts for the owner (e.g. an employee's
// Report Problem) using the browser's built-in Notification API. This fires
// as long as the browser is running, even if the CRM tab isn't focused —
// there is NO server component here, so unlike true mobile push it can't
// reach the owner once the browser itself is fully closed; that would need a
// service worker + VAPID keys + a server endpoint to send from, which this
// single-page app (no backend server — see CLAUDE.md) doesn't have yet.
// Callers must never depend on this actually showing anything (permission
// may be denied/unsupported) — it's additive to the existing toast/bell and
// email, never a replacement for either.
export const desktopNotifsSupported = (): boolean => typeof window !== "undefined" && "Notification" in window;

export const desktopNotifPermission = (): NotificationPermission | "unsupported" =>
  desktopNotifsSupported() ? Notification.permission : "unsupported";

export const requestDesktopNotifPermission = async (): Promise<boolean> => {
  if (!desktopNotifsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try { const result = await Notification.requestPermission(); return result === "granted"; }
  catch { return false; }
};

export const notifyDesktop = (title: string, body?: string, onClick?: () => void): void => {
  if (!desktopNotifsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.ico" });
    // BUG FIX — clock-out/report-problem notifications previously had no
    // click behavior at all; clicking one should bring the owner straight
    // to the relevant screen instead of just dismissing it.
    if (onClick) n.onclick = () => { window.focus(); onClick(); n.close(); };
  } catch { /* best-effort only */ }
};

// BLOCKER 6 (mobile round 9) — Alfred's multi-step tool chains (create
// customer → schedule job → assign employees) each write to Supabase with no
// retry, so one transient network blip on the FIRST step ("create_customer")
// failed the entire chain with no second attempt, even though the operation
// itself is safely re-runnable (a fresh uid() each time means a retry can
// never create a duplicate row from the first attempt half-succeeding).
// `fn` is a factory (not a bare promise) since a promise can only be awaited
// once — retrying means calling it again to get a fresh in-flight request.
export const withTimeoutRetry = async <T,>(fn: () => Promise<T>, ms: number, label: string, retries = 1): Promise<T> => {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(fn(), ms, label);
    } catch (e: any) {
      lastErr = e;
      if (attempt < retries) console.warn(`[${label}] attempt ${attempt + 1} failed — retrying:`, e?.message || e);
    }
  }
  throw lastErr;
};

// ─── OAuth intent flag ─────────────────────────────────────────────────────────
// Google sign-in is shared infrastructure between the owner's login page and
// the employee portal's login page — the auth callback alone can't tell which
// one initiated it. Set right before calling signInWithOAuth from the
// EMPLOYEE login screen (consumed once in App.tsx's resolveUserRole) so a
// Google sign-in with no matching employees row falls through to "employee"
// (shows "Account Not Linked") instead of defaulting to "owner".
const OAUTH_INTENT_KEY = "smocks.oauthIntent";
export function setOAuthIntent(intent: "employee"): void {
  try { sessionStorage.setItem(OAUTH_INTENT_KEY, intent); } catch { /* ignore */ }
}
export function consumeOAuthIntent(): "employee" | null {
  try {
    const v = sessionStorage.getItem(OAUTH_INTENT_KEY);
    if (v === "employee") { sessionStorage.removeItem(OAUTH_INTENT_KEY); return "employee"; }
  } catch { /* ignore */ }
  return null;
}

// ─── Last-owner-session flag ──────────────────────────────────────────────────
// Lets App.tsx seed hasCrmSession's initial state optimistically so a
// returning owner with a still-valid Supabase session renders straight into
// the dashboard instead of flashing the login form while the real session
// check resolves. Must be cleared (see App.tsx) the instant a session check
// comes back negative, or an expired/cleared session would leave the CRM
// shell rendered with nothing real backing it.
const LAST_OWNER_SESSION_KEY = "smocks.lastOwnerSession";
export function getLastOwnerSessionFlag(): boolean {
  try { return localStorage.getItem(LAST_OWNER_SESSION_KEY) === "1"; } catch { return false; }
}
export function setLastOwnerSessionFlag(active: boolean): void {
  try {
    if (active) localStorage.setItem(LAST_OWNER_SESSION_KEY, "1");
    else localStorage.removeItem(LAST_OWNER_SESSION_KEY);
  } catch { /* ignore */ }
}

// FIX 3 — same seeding trick as hasCrmSession above, applied to crmUserId.
// hasCrmSession being seeded true (so a returning owner renders straight into
// the CRM) used to leave a real window where the CRM — including JobsPage's
// crew-assign/request actions — was fully interactive before crmUserId had
// actually resolved from the async session bootstrap (a real network round
// trip). Anything gated on ownerId during that window failed with "still
// finishing sign-in" even though, from the owner's side, they were already
// looking at a fully-rendered Jobs page. Caching the last-known owner id
// (cleared the instant a session check comes back negative/different, same
// as the session flag) lets crmUserId be populated INSTANTLY for a returning
// owner, closing the window entirely for the common case.
const LAST_OWNER_ID_KEY = "smocks.lastOwnerId";
export function getLastOwnerId(): string {
  try { return localStorage.getItem(LAST_OWNER_ID_KEY) || ""; } catch { return ""; }
}
export function setLastOwnerId(id: string): void {
  try {
    if (id) localStorage.setItem(LAST_OWNER_ID_KEY, id);
    else localStorage.removeItem(LAST_OWNER_ID_KEY);
  } catch { /* ignore */ }
}

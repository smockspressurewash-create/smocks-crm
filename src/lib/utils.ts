import { supabase } from "./supabase";

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
export const MAX_JOB_VIDEO_SECONDS = 30;
export const MAX_JOB_VIDEO_MB = 50;

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

export const notifyDesktop = (title: string, body?: string): void => {
  if (!desktopNotifsSupported() || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/favicon.ico" }); } catch { /* best-effort only */ }
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

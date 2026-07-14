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

export const personalities: Personality[] = [
  {
    id: "drillsergeant",
    name: "Drill Sergeant",
    emoji: "🪖",
    desc: "No excuses. Get to work.",
    systemPrompt: "You are Alfred, Will Crew Boss AI chief-of-staff for Crew Boss in York PA. Personality: drill sergeant crossed with a mentor. Blunt, direct, no fluff. Call out laziness. Celebrate wins hard. Keep responses SHORT unless asked otherwise. End with 'Alfred out.'",
  },
  {
    id: "butler",
    name: "Butler",
    emoji: "🎩",
    desc: "Refined, efficient, loyal.",
    systemPrompt: "You are Alfred, a distinguished AI chief-of-staff for Crew Boss. Personality: composed, professional butler. Polished language, anticipate needs, always helpful. End responses with 'Your servant, Alfred.'",
  },
  {
    id: "quietpro",
    name: "Quiet Pro",
    emoji: "🧠",
    desc: "Facts only. No filler.",
    systemPrompt: "You are Alfred, a no-nonsense AI assistant for Crew Boss. Personality: silent professional. Facts only, zero filler, bullet points preferred. Never waste words.",
  },
  {
    id: "savage",
    name: "Savage Mode",
    emoji: "🔥",
    desc: "Roasts you into productivity.",
    systemPrompt: "You are Alfred in Savage Mode for Crew Boss. Personality: roast comedian + business coach. Brutally honest, funny, slightly mean — but always pushing Will to improve. Never actually harmful. End with 'Stay dangerous. — Alfred'",
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

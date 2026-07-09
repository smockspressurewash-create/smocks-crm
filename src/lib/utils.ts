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

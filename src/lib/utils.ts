// ─── Formatting ───────────────────────────────────────────────────────────────

export const fmt = (n: number | undefined | null): string => {
  if (n == null || isNaN(Number(n))) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const uid = (): string => Math.random().toString(36).slice(2, 10);

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
    systemPrompt: "You are Alfred, Will Smock's AI chief-of-staff for Smock's Pressure Washing in York PA. Personality: drill sergeant crossed with a mentor. Blunt, direct, no fluff. Call out laziness. Celebrate wins hard. Keep responses SHORT unless asked otherwise. End with 'Alfred out.'",
  },
  {
    id: "butler",
    name: "Butler",
    emoji: "🎩",
    desc: "Refined, efficient, loyal.",
    systemPrompt: "You are Alfred, a distinguished AI chief-of-staff for Smock's Pressure Washing. Personality: composed, professional butler. Polished language, anticipate needs, always helpful. End responses with 'Your servant, Alfred.'",
  },
  {
    id: "quietpro",
    name: "Quiet Pro",
    emoji: "🧠",
    desc: "Facts only. No filler.",
    systemPrompt: "You are Alfred, a no-nonsense AI assistant for Smock's Pressure Washing. Personality: silent professional. Facts only, zero filler, bullet points preferred. Never waste words.",
  },
  {
    id: "savage",
    name: "Savage Mode",
    emoji: "🔥",
    desc: "Roasts you into productivity.",
    systemPrompt: "You are Alfred in Savage Mode for Smock's Pressure Washing. Personality: roast comedian + business coach. Brutally honest, funny, slightly mean — but always pushing Will to improve. Never actually harmful. End with 'Stay dangerous. — Alfred'",
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

// ─── IRS Rate (mileage deduction) ────────────────────────────────────────────

export const IRS_RATE = 0.67; // 2024 rate per mile

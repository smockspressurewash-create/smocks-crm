// ===== UTILITY FUNCTIONS =====
import { seedWeather } from './seed';

export const fmt = (n: any) => "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const uid = () => Math.random().toString(36).slice(2, 10);
export const today = () => new Date().toISOString().slice(0, 10);
export const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const daysSince = (d: any) => { if (!d) return 0; return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24)); };

// Normalize any automation to ensure it has a steps array — needed early for migration
export const normalizeAutomation = (a: any) => {
  if (a.steps && a.steps.length > 0) return a;
  const ch = (a.action || "").toLowerCase().includes("text") || (a.action || "").toLowerCase().includes("sms") ? "sms" : "email";
  return {
    ...a,
    steps: [
      { id: a.id + "_t", type: "trigger", label: a.trigger || "Manual trigger" },
      { id: a.id + "_a", type: "action", label: a.action || "Send notification", channel: ch }
    ]
  };
};

// Get forecast data for a scheduled date (0-6 days out from today)
export const forecastFor = (dateStr: string, weatherOverride?: any) => {
  if (!dateStr) return null;
  const diff = Math.round((new Date(dateStr).getTime() - new Date(today()).getTime()) / 86400000);
  if (diff < 0 || diff > 6) return null;
  if (diff === 0) return null;
  const src = weatherOverride || seedWeather;
  return (src.forecast || [])[diff - 1] || null;
};

export const weatherRisk = (dateStr: string) => {
  const f = forecastFor(dateStr);
  if (!f) return null;
  if (f.rainChance >= 70) return { level: "high", reason: f.rainChance + "% rain", icon: "🌧️" };
  if (f.rainChance >= 40) return { level: "med", reason: f.rainChance + "% rain", icon: "🌦️" };
  if (f.wind >= 15) return { level: "med", reason: f.wind + "mph wind", icon: "💨" };
  if (f.temp >= 88) return { level: "med", reason: f.temp + "°F", icon: "🥵" };
  if ((f.lowTemp || f.temp) < 35) return { level: "high", reason: "Freezing risk", icon: "🥶" };
  return null;
};

export const TIMEFRAMES = [
  { key: "7d",  label: "7D",  days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "6m",  label: "6M",  days: 182 },
  { key: "1y",  label: "1Y",  days: 365 },
  { key: "3y",  label: "3Y",  days: 1095 },
  { key: "5y",  label: "5Y",  days: 1825 },
  { key: "all", label: "All", days: 99999 }
];

export const filterByTimeframe = (items: any[], dateField: string, tfKey: string) => {
  if (tfKey === "all") return items;
  const days = TIMEFRAMES.find(t => t.key === tfKey)?.days || 30;
  const cutoff = Date.now() - days * 86400000;
  return items.filter(item => {
    const d = item[dateField];
    if (!d) return false;
    return new Date(d).getTime() >= cutoff;
  });
};

export const pipelineStages = [
  { key: "lead", label: "Lead", color: "bg-gray-600", border: "border-gray-600/40", text: "text-gray-300" },
  { key: "contacted", label: "Contacted", color: "bg-blue-600", border: "border-blue-600/40", text: "text-blue-300" },
  { key: "estimate_sent", label: "Est Sent", color: "bg-purple-600", border: "border-purple-600/40", text: "text-purple-300" },
  { key: "approved", label: "Approved", color: "bg-yellow-500", border: "border-yellow-500/40", text: "text-yellow-300" },
  { key: "scheduled", label: "Scheduled", color: "bg-orange-500", border: "border-orange-500/40", text: "text-orange-300" },
  { key: "completed", label: "Completed", color: "bg-green-600", border: "border-green-600/40", text: "text-green-300" },
  { key: "paid", label: "Paid", color: "bg-emerald-500", border: "border-emerald-500/40", text: "text-emerald-300" },
  { key: "lost", label: "Lost", color: "bg-red-800", border: "border-red-800/40", text: "text-red-400" }
];

export const cancelReasons = ["Weather", "Customer request", "No show", "Equipment failure", "Other"];
export const expenseCats = ["Fuel", "Chemicals", "Equipment", "Maintenance", "Insurance", "Marketing", "Other"];
export const equipmentList = ["Pressure Washer", "Soft Wash", "Surface Cleaner", "Gutter Wand", "Ladder", "X-Jet", "Ball Valve"];
export const recurringFreqs = ["weekly", "bi-weekly", "monthly", "quarterly", "annually"];

export const priorityLevels = [
  { key: "low", label: "Low", color: "bg-gray-600", tone: "gray" },
  { key: "normal", label: "Normal", color: "bg-blue-600", tone: "blue" },
  { key: "high", label: "High", color: "bg-yellow-600", tone: "yellow" },
  { key: "urgent", label: "Urgent", color: "bg-red-600", tone: "red" }
];

export const jobTagOptions = ["Emergency", "Warranty", "Follow-up", "HOA", "Commercial", "VIP"];

export const personalities: Record<string, any> = {
  drill: { name: "Drill Sergeant", color: "from-red-600 to-red-900", greeting: "LISTEN UP. What's the situation? Alfred out." },
  butler: { name: "Butler", color: "from-red-500 to-red-800", greeting: "Good day, sir. How may I help?" },
  quiet: { name: "Quiet Pro", color: "from-red-700 to-black", greeting: "Operations online. State your request." },
  savage: { name: "Savage", color: "from-red-600 to-pink-900", greeting: "Oh look, you're back. Fire away." }
};

// ===== UTILITY FUNCTIONS =====
import { TIMEFRAMES } from './constants';

export * from './constants'; // Re-export for compatibility

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

// TrashCanPage.tsx — owner CRM section for Trash Can Cleaning (round 13,
// items 16-24). Trash-can jobs are ordinary Job rows (serviceCategory:
// "trash_can") so they already appear on the Jobs list/Calendar and get
// checklists/photos/clock-in/Running Late/Complete for free via the existing
// Job infrastructure — this page adds the trash-can-specific pieces: owner
// pricing/timing settings, the filtered job list, a same-day route builder
// (see lib/utils.ts's buildOptimizedRoute), and the public signup link.
import React, { useState } from "react";
import { Trash2, Copy, DollarSign, Clock, Route as RouteIcon, Users, Calendar } from "lucide-react";
import { fmt, uid, today, buildOptimizedRoute } from "../../lib/utils";
import type { Job, Customer, AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GSel } from "../ui/GSel";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";

export function TrashCanPage({ jobs = [], customers = [], settings = {} as AppSettings, setSettings, toast }: { jobs?: Job[]; customers?: Customer[]; settings?: AppSettings; setSettings?: any; toast?: any }) {
  const trashJobs = jobs.filter((j: any) => j.serviceCategory === "trash_can");
  const upcoming = trashJobs.filter(j => j.status !== "cancelled" && j.status !== "completed").sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
  const [routeDate, setRouteDate] = useState(today());
  const [route, setRoute] = useState<any[] | null>(null);

  const costPerCan = Number((settings as any)?.trashCanCostPerCan) || 5;
  const minutesPerCan = Number((settings as any)?.trashCanMinutesPerCan) || 5;
  // Non-secret settings baked into the link at copy time — see
  // TrashCanSignupPage.tsx's comment on why it never fetches app_settings
  // directly (that table holds live secrets behind permissive RLS).
  const signupParams = new URLSearchParams({
    co: (settings as any)?.companyName || "Crew Boss",
    ph: (settings as any)?.companyPhone || "",
    cost: String(costPerCan),
    min: String(minutesPerCan),
    freq: (settings as any)?.trashCanDefaultFrequency || "weekly",
    pk: (settings as any)?.stripePublishableKey || "",
  });
  const signupLink = `${window.location.origin}${window.location.pathname}#/trash-cans?${signupParams.toString()}`;

  const cf = (id?: string) => customers.find((c: any) => c.id === id);

  const buildRoute = () => {
    const dayJobs = trashJobs.filter(j => j.scheduledDate === routeDate && j.status !== "cancelled" && j.status !== "completed");
    if (dayJobs.length === 0) { toast?.("No trash-can jobs scheduled that day", "yellow"); return; }
    const entries = buildOptimizedRoute(
      dayJobs.map(j => ({ id: j.id, lat: (j as any).lat, lng: (j as any).lng, scheduledTime: j.scheduledTime, estMinutes: ((j as any).cansCount || 1) * minutesPerCan })),
      { lunchMinutes: Number((settings as any)?.routeLunchMinutes) || 0, lunchEarliestMinutes: 240 }
    );
    setRoute(entries);
    toast?.(`Route built — ${dayJobs.length} stop${dayJobs.length !== 1 ? "s" : ""}`, "green");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Trash2} label="Active Routes" value={String(upcoming.length)} />
        <Stat icon={DollarSign} label="Cost / Can" value={fmt(costPerCan)} />
        <Stat icon={Clock} label="Est. Min / Can" value={String(minutesPerCan)} />
        <Stat icon={Users} label="Customers" value={String(new Set(trashJobs.map(j => j.customerId)).size)} />
      </div>

      <Glass className="p-4 space-y-3">
        <div className="font-semibold text-sm flex items-center gap-2"><Trash2 size={14} className="text-red-400" />Pricing & Scheduling</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block">Cost per can</label><GInput type="number" step="0.5" value={(settings as any)?.trashCanCostPerCan ?? 5} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanCostPerCan: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Estimated minutes per can</label><GInput type="number" value={(settings as any)?.trashCanMinutesPerCan ?? 5} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanMinutesPerCan: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Default frequency</label>
            <GSel value={(settings as any)?.trashCanDefaultFrequency || "weekly"} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanDefaultFrequency: e.target.value }))} className="!text-xs">
              <option value="weekly" className="bg-black">Weekly</option>
              <option value="monthly" className="bg-black">Monthly</option>
              <option value="quarterly" className="bg-black">Quarterly</option>
            </GSel>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Inconvenience fee name</label><GInput value={(settings as any)?.trashCanInconvenienceFeeName || "Cans Not Out Fee"} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanInconvenienceFeeName: e.target.value }))} className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Inconvenience fee amount</label><GInput type="number" step="0.5" value={(settings as any)?.trashCanInconvenienceFeeAmount ?? 15} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanInconvenienceFeeAmount: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Route lunch break (minutes) <span className="text-white/30">(0 = none)</span></label><GInput type="number" value={(settings as any)?.routeLunchMinutes ?? 30} onChange={(e: any) => setSettings((s: any) => ({ ...s, routeLunchMinutes: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
        </div>
        <div className="pt-2 border-t border-white/10">
          <label className="text-xs text-white/60 mb-1 block">Public signup link — customers enter can count, see price, choose schedule, put a card on file</label>
          <div className="flex gap-2">
            <GInput readOnly value={signupLink} className="!text-xs flex-1" />
            <GBtn variant="ghost" onClick={() => { navigator.clipboard?.writeText(signupLink); toast?.("Link copied ✓"); }} className="!text-xs"><Copy size={12} className="inline mr-1" />Copy</GBtn>
          </div>
        </div>
      </Glass>

      <Glass className="p-4 space-y-3">
        <div className="font-semibold text-sm flex items-center gap-2"><RouteIcon size={14} className="text-blue-400" />Build a Route</div>
        <div className="flex gap-2 items-end flex-wrap">
          <div><label className="text-xs text-white/60 mb-1 block">Date</label><GInput type="date" value={routeDate} onChange={(e: any) => { setRoute(null); setRouteDate(e.target.value); }} className="!text-xs" /></div>
          <GBtn onClick={buildRoute} className="!text-xs">Build Optimized Route</GBtn>
        </div>
        <div className="text-[10px] text-white/40">Nearest-neighbor ordering by property location (jobs without a geocoded address are appended in scheduled-time order). Includes a lunch break if configured above.</div>
        {route && (
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            {route.map((entry: any, i: number) => entry.kind === "lunch" ? (
              <div key={"lunch" + i} className="p-2 rounded-lg bg-yellow-950/20 border border-yellow-700/30 text-xs text-yellow-300 flex items-center gap-2"><Clock size={11} />Lunch break — {entry.durationMinutes} min</div>
            ) : (() => {
              const j = trashJobs.find(x => x.id === entry.jobId);
              const c = j ? cf(j.customerId) : null;
              return <div key={entry.jobId} className="p-2 rounded-lg bg-black/40 border border-white/10 text-xs flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><span className="text-white/40 w-5">{i + 1}.</span>{c ? `${c.firstName} ${c.lastName}` : "Customer"} — {j?.address}</span>
                <span className="text-white/40">{(j as any)?.cansCount || 1} cans · ~{entry.estMinutes}m</span>
              </div>;
            })())}
          </div>
        )}
      </Glass>

      <Glass className="overflow-hidden">
        <div className="px-4 py-3 border-b border-red-900/20 font-semibold text-sm">Upcoming Trash Can Jobs ({upcoming.length})</div>
        {upcoming.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">No trash-can jobs yet — share the signup link above to get customers enrolled.</div>
        ) : (
          <div className="divide-y divide-red-900/10">
            {upcoming.map(j => {
              const c = cf(j.customerId);
              return (
                <div key={j.id} className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-xl bg-black/40 border border-red-900/30 flex items-center justify-center flex-shrink-0">🗑️</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c ? `${c.firstName} ${c.lastName}` : "Customer"}</div>
                    <div className="text-xs text-white/40 truncate">{j.address} · {(j as any).cansCount || 1} can{((j as any).cansCount || 1) !== 1 ? "s" : ""} · {j.isRecurring ? (j.recurringFreq || "recurring") : "one-time"}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-white/50">{j.scheduledDate}</div>
                    <Badge tone={j.status === "scheduled" ? "blue" : j.status === "in_progress" ? "yellow" : "gray"}>{j.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Glass>
    </div>
  );
}

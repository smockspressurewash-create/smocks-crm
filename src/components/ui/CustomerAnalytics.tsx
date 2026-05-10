import React, { useState } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Star } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { Glass } from './Glass';
import { Stat } from './Stat';
import { fmt, daysSince } from '../../lib/utils';

export function CustomerAnalytics({ customers = [], jobs = [], estimates = [] }: any) {
  const [sortBy, setSortBy] = useState("ltv");
  const [churnFilter, setChurnFilter] = useState("all");

  const enriched = customers.map((c: any) => {
    const cJobs = jobs.filter((j: any) => j.customerId === c.id && j.status === "completed");
    const cEsts = estimates.filter((e: any) => e.customerId === c.id);
    const revenue = cJobs.reduce((s: number, j: any) => s + (j.amount || 0), 0);
    const jobCount = cJobs.length;
    const lastJobDate = cJobs.map((j: any) => j.scheduledDate).sort().pop() || null;
    const avgJobVal = jobCount ? revenue / jobCount : 0;
    const daysSinceLast = lastJobDate ? daysSince(lastJobDate) : 999;
    const firstJobDate = cJobs.map((j: any) => j.scheduledDate).sort()[0] || null;
    const tenure = firstJobDate ? daysSince(firstJobDate) : 0;
    const freq = jobCount > 1 && tenure > 0 ? tenure / (jobCount - 1) : 0;
    const churnRisk = daysSinceLast > 180 ? "high" : daysSinceLast > 90 ? "medium" : "low";
    const churnDiscount = churnRisk === "high" ? 0.3 : churnRisk === "medium" ? 0.7 : 1.0;
    const projectedJobs = Math.min(5, Math.round(365 / Math.max(freq, 30)));
    const projectedLTV = revenue + projectedJobs * avgJobVal * churnDiscount;
    const estAccepted = cEsts.filter((e: any) => e.status === "approved").length;
    const closeRate = cEsts.length ? Math.round((estAccepted / cEsts.length) * 100) : null;
    
    const hasRoof = cJobs.some((j: any) => (j.internalNotes || "").toLowerCase().includes("roof") || (j.tags || []).some((t: string) => t.toLowerCase().includes("roof")));
    const hasDriveway = cJobs.some((j: any) => (j.internalNotes || "").toLowerCase().includes("driveway") || (j.tags || []).some((t: string) => t.toLowerCase().includes("driveway")));
    const upsells = [];
    if (!hasRoof && revenue > 500) upsells.push("Roof soft wash");
    if (!hasDriveway && revenue > 300) upsells.push("Driveway");
    if (jobCount >= 3 && !c.notes?.includes("contract")) upsells.push("Annual contract");
    if (daysSinceLast > 150 && daysSinceLast < 300) upsells.push("Re-engagement offer");
    
    return { ...c, revenue, jobCount, lastJobDate, avgJobVal, daysSinceLast, churnRisk, projectedLTV, closeRate, upsells, tenure, freq };
  }).filter((c: any) => c.jobCount > 0 || c.totalSpent > 0);

  const sorted = [...enriched]
    .filter((c: any) => churnFilter === "all" || c.churnRisk === churnFilter)
    .sort((a, b) => {
      if (sortBy === "ltv") return b.projectedLTV - a.projectedLTV;
      if (sortBy === "revenue") return b.revenue - a.revenue;
      if (sortBy === "jobs") return b.jobCount - a.jobCount;
      if (sortBy === "churn") return b.daysSinceLast - a.daysSinceLast;
      return 0;
    });

  const totalLTV = enriched.reduce((s, c) => s + c.projectedLTV, 0);
  const avgLTV = enriched.length ? totalLTV / enriched.length : 0;
  const highChurn = enriched.filter((c: any) => c.churnRisk === "high").length;
  const topCustomer = enriched.sort((a, b) => b.projectedLTV - a.projectedLTV)[0];

  const churnColor = (r: string) => r === "high" ? "text-red-400 bg-red-950/30 border-red-700/40" : r === "medium" ? "text-yellow-400 bg-yellow-950/30 border-yellow-700/40" : "text-green-400 bg-green-950/30 border-green-700/40";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Total LTV" value={fmt(totalLTV)} />
        <Stat icon={TrendingUp} label="Avg LTV" value={fmt(avgLTV)} />
        <Stat icon={AlertTriangle} label="Churn Risk" value={highChurn + " high"} />
        <Stat icon={Star} label="Top Customer" value={topCustomer ? topCustomer.firstName + " " + topCustomer.lastName[0] + "." : "—"} />
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {[["all", "All"], ["low", "✅ Low risk"], ["medium", "⚠️ Medium"], ["high", "🔴 High risk"]].map(([k, l]) => (
            <button key={k} onClick={() => setChurnFilter(k)} className={"px-2.5 py-1 rounded-lg text-[11px] border transition " + (churnFilter === k ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          Sort by:
          {[["ltv", "LTV"], ["revenue", "Revenue"], ["jobs", "Jobs"], ["churn", "Last seen"]].map(([k, l]) => (
            <button key={k} onClick={() => setSortBy(k)} className={"px-2 py-1 rounded border " + (sortBy === k ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60")}>{l}</button>
          ))}
        </div>
      </div>

      {enriched.length > 0 && <Glass className="p-4">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp size={13} className="text-green-400" />Top Customer Revenue & Projected LTV</h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={[...enriched].sort((a, b) => b.projectedLTV - a.projectedLTV).slice(0, 8).map((c: any) => ({ name: c.firstName + " " + c.lastName[0] + ".", revenue: Math.round(c.revenue), ltv: Math.round(c.projectedLTV) }))} margin={{ top: 4, right: 4, left: 4, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#7f1d1d18" />
            <XAxis dataKey="name" stroke="#ffffff40" fontSize={9} angle={-30} textAnchor="end" interval={0} />
            <YAxis stroke="#ffffff40" fontSize={9} tickFormatter={v => "$" + (v >= 1000 ? Math.round(v/1000) + "k" : v)} width={40} />
            <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #7f1d1d60", borderRadius: 8, fontSize: 11 }} formatter={(v: any) => fmt(v)} />
            <Bar dataKey="revenue" fill="#e11d48" radius={[3, 3, 0, 0]} name="Revenue" />
            <Bar dataKey="ltv" fill="#16a34a" radius={[3, 3, 0, 0]} name="Projected LTV" opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 justify-center mt-2 text-[10px] text-white/50">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-600 inline-block" />Actual revenue</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-600 inline-block" />Projected LTV</span>
        </div>
      </Glass>}

      <Glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-red-900/30 bg-black/40">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/60">Customer</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Revenue</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60 hidden md:table-cell">Projected LTV</th>
              <th className="text-center px-4 py-3 text-xs uppercase tracking-wider text-white/60 hidden lg:table-cell">Churn Risk</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/60 hidden xl:table-cell">Upsell Ops</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60 hidden md:table-cell">Last Service</th>
            </tr></thead>
            <tbody>
              {sorted.map((c: any) => (
                <tr key={c.id} className="border-b border-red-900/10 hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.firstName} {c.lastName}</div>
                    <div className="text-[10px] text-white/50 flex items-center gap-2 mt-0.5">
                      <span>{c.jobCount} job{c.jobCount !== 1 ? "s" : ""}</span>
                      {c.closeRate !== null && <span>· {c.closeRate}% close</span>}
                      {c.freq > 0 && <span>· every {Math.round(c.freq)}d</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-400">{fmt(c.revenue)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-400 hidden md:table-cell">{fmt(c.projectedLTV)}</td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <span className={"text-[10px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider " + churnColor(c.churnRisk)}>{c.churnRisk}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {c.upsells.slice(0, 2).map((u: string) => <span key={u} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/30 border border-purple-700/40 text-purple-300">{u}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {c.lastJobDate ? <div>
                      <div className="text-xs">{c.lastJobDate}</div>
                      <div className={"text-[10px] " + (c.daysSinceLast > 180 ? "text-red-400" : c.daysSinceLast > 90 ? "text-yellow-400" : "text-white/50")}>{c.daysSinceLast}d ago</div>
                    </div> : <span className="text-white/30 text-xs">—</span>}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-white/40">No customers match this filter</td></tr>}
            </tbody>
          </table>
        </div>
      </Glass>
    </div>
  );
}

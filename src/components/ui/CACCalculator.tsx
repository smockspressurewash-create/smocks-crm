import React, { useState } from 'react';
import { TIMEFRAMES, fmt } from '../../lib/utils';

export function CACCalculator({ tfExpenses = [], customers = [], timeframe }: any) {
  const [manualAdSpend, setManualAdSpend] = useState<any>(0);
  const expenseAdSpend = (tfExpenses || []).filter((e: any) => (e.category || "").toLowerCase().includes("advert") || (e.category || "").toLowerCase().includes("marketing")).reduce((s: number, e: any) => s + Number(e.amount), 0);
  const adSpend = expenseAdSpend + Number(manualAdSpend);
  const newCustomers = (customers || []).filter((c: any) => c.createdAt && new Date(c.createdAt).getTime() >= Date.now() - ((TIMEFRAMES.find(t => t.key === timeframe)?.days || 365) * 86400000)).length;
  const cac = newCustomers > 0 ? adSpend / newCustomers : 0;
  const ltv = customers.length > 0 ? customers.reduce((s: number, c: any) => s + (c.totalSpent || 0), 0) / customers.length : 0;
  const ltvCacRatio = cac > 0 ? (ltv / cac).toFixed(1) : null;
  const tfLabel = TIMEFRAMES.find(t => t.key === timeframe)?.label || "All time";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-black/40 border border-red-900/20 rounded-xl">
        <div className="flex-1">
          <div className="text-[10px] text-white/50 mb-1">Additional Ad Spend ({tfLabel})</div>
          <div className="text-[10px] text-white/30">From expenses: {fmt(expenseAdSpend)} · Add any not tracked below</div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white/40 text-sm">$</span>
          <input type="number" min="0" value={manualAdSpend} onChange={e => setManualAdSpend(e.target.value)} placeholder="0" className="w-24 bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white text-right focus:outline-none focus:border-red-500/50" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 bg-black/40 border border-red-900/20 rounded-xl">
          <div className="text-[10px] text-white/50 mb-1">Total Ad Spend</div>
          <div className="text-xl font-bold text-red-400">{fmt(adSpend)}</div>
        </div>
        <div className="p-3 bg-black/40 border border-red-900/20 rounded-xl">
          <div className="text-[10px] text-white/50 mb-1">New Customers</div>
          <div className="text-xl font-bold">{newCustomers}</div>
        </div>
        <div className={"p-3 border rounded-xl " + (cac < 50 ? "bg-green-950/20 border-green-700/30" : cac < 150 ? "bg-yellow-950/20 border-yellow-700/30" : "bg-red-950/20 border-red-700/30")}>
          <div className="text-[10px] text-white/50 mb-1">Cost per Customer</div>
          <div className="text-xl font-bold">{cac > 0 ? fmt(cac) : "—"}</div>
          {cac > 0 && <div className="text-[9px] text-white/30 mt-1">{cac < 50 ? "✅ Excellent" : cac < 150 ? "👍 Good" : "⚠️ High"}</div>}
        </div>
        <div className={"p-3 border rounded-xl " + (ltvCacRatio && Number(ltvCacRatio) >= 3 ? "bg-green-950/20 border-green-700/30" : "bg-black/40 border-red-900/20")}>
          <div className="text-[10px] text-white/50 mb-1">LTV:CAC Ratio</div>
          <div className="text-xl font-bold">{ltvCacRatio ? ltvCacRatio + "x" : "—"}</div>
        </div>
      </div>
      <div className="text-[10px] text-white/40 text-center">{ltvCacRatio && Number(ltvCacRatio) >= 3 ? "✅ Healthy LTV:CAC (3x+ is ideal)" : ltvCacRatio ? "⚠️ Aim for 3x+ LTV:CAC ratio" : "Add ad spend above to calculate CAC"}</div>
    </div>
  );
}

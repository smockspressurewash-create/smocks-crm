import React, { useState } from 'react';
import { Glass } from './Glass';
import { fmt } from '../../lib/utils';

export function ChemicalCostCalc({ items = [], settings = {} }: any) {
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const services = items.filter((i: any) => i.description).map((i: any) => i.description).join(", ");

  const calculate = async () => {
    if (!services) return;
    setLoading(true);
    try {
      // Note: In a real app, this should go through a proxy to keep keys safe
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [{ role: "user", content: `For a pressure washing job with these services: "${services}", estimate the chemical costs. Respond ONLY with a JSON object: {"sqsh": dollar amount for SH (sodium hypochlorite), "surf": dollar amount for surfactant, "degreaser": dollar amount for degreaser (0 if not needed), "total": total chemical cost, "notes": one short sentence about main chemicals used}. Use typical pressure washing industry costs. No other text.` }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text?.replace(/```json|```/g, "").trim() || "{}";
      const parsed = JSON.parse(text);
      setEstimate(parsed);
    } catch {
      // Fallback heuristic
      const hasRoof = services.toLowerCase().includes("roof");
      const hasHouse = services.toLowerCase().includes("house");
      const hasDriveway = services.toLowerCase().includes("driveway");
      let total = 0;
      if (hasRoof) total += 45;
      if (hasHouse) total += 25;
      if (hasDriveway) total += 15;
      setEstimate({ sqsh: total * 0.7, surf: total * 0.15, degreaser: hasDriveway ? 10 : 0, total: total + (hasDriveway ? 10 : 0), notes: "Estimated based on service types." });
    }
    setLoading(false);
  };

  if (!services) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/60">Estimated Chemical Costs</label>
        {!estimate && <button onClick={calculate} disabled={loading} className="text-[10px] text-blue-400 hover:text-blue-300">{loading ? "Calculating..." : "Calculate (AI)"}</button>}
      </div>
      {estimate && (
        <Glass className="p-3 !bg-blue-950/20 !border-blue-700/30">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div><div className="text-[9px] text-white/40 uppercase">SH</div><div className="text-xs font-bold">{fmt(estimate.sqsh)}</div></div>
            <div><div className="text-[9px] text-white/40 uppercase">Surf.</div><div className="text-xs font-bold">{fmt(estimate.surf)}</div></div>
            <div><div className="text-[9px] text-white/40 uppercase">Total</div><div className="text-xs font-bold text-blue-400">{fmt(estimate.total)}</div></div>
          </div>
          <div className="text-[9px] text-white/50 italic">{estimate.notes}</div>
          <button onClick={() => setEstimate(null)} className="text-[8px] text-white/30 hover:text-white/60 mt-1 uppercase tracking-widest">Recalculate</button>
        </Glass>
      )}
    </div>
  );
}

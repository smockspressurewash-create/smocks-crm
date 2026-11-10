// SalesTaxControl.tsx — "Add sales tax" switch + rate, with the totals.
//
// FEATURE (owner request) — "it doesn't let me add sales tax to work orders,
// quotes, jobs, etc. It shows the calculation but not the sales tax." Quotes
// always used the Settings rate with no way to turn it on or change it, and
// work orders, jobs and new invoices had no tax at all. One control for all
// of them: tick it, set the percent (starts at the Settings rate, or 6%),
// and the subtotal / sales tax / total lines update.
import React from "react";
import { fmt } from "../../lib/utils";
import { taxOf } from "../../lib/jobWrite";

export const defaultTaxRate = (settings: any) => { const r = Number(settings?.taxRate); return r > 0 ? r : 6; };

export function SalesTaxControl({ on, rate, onChange, subtotal, showTotals = true }: {
  on: boolean; rate: number | string; onChange: (v: { on: boolean; rate: number | string }) => void; subtotal: number; showTotals?: boolean;
}) {
  const tax = on ? taxOf(subtotal, Number(rate)) : 0;
  return (
    <div data-sales-tax className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" data-tax-toggle checked={on} onChange={e => onChange({ on: e.target.checked, rate })} className="accent-red-600 w-4 h-4" />
          <span className="text-xs text-white/80 font-semibold">Add sales tax</span>
        </label>
        {on && (
          <span className="flex items-center gap-1 ml-auto">
            <input data-tax-rate type="number" inputMode="decimal" step="0.01" min="0" value={rate} onChange={e => onChange({ on, rate: e.target.value })}
              style={{ width: 80, minWidth: 0, flex: "0 0 80px" }} className="h-8 bg-white/5 border border-white/10 rounded-lg px-2 text-[16px] md:text-sm text-white text-right focus:outline-none focus:border-white/30" />
            <span className="text-xs text-white/60">%</span>
          </span>
        )}
      </div>
      {showTotals && (
        <div className="text-xs space-y-0.5 pt-1 border-t border-white/5">
          <div className="flex justify-between text-white/60"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {on && <div className="flex justify-between text-white/60" data-tax-amount><span>Sales tax ({Number(rate) || 0}%)</span><span>{fmt(tax)}</span></div>}
          <div className="flex justify-between text-white font-bold text-sm"><span>Total</span><span data-tax-total>{fmt(subtotal + tax)}</span></div>
        </div>
      )}
    </div>
  );
}

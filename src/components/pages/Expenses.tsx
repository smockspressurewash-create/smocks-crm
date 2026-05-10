import React, { useState } from 'react';
import { Download, Plus, DollarSign, Receipt, TrendingUp, Percent, Edit, Trash2, Route, Clock, BarChart2, Award } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { GBtn } from '../ui/GBtn';
import { Modal } from '../ui/Modal';
import { GInput } from '../ui/GInput';
import { GSel } from '../ui/GSel';
import { GTxt } from '../ui/GTxt';
import { Badge } from '../ui/Badge';
import { Stat } from '../ui/Stat';
import { TimeframeSelector } from '../ui/TimeframeSelector';
import { usePersistent } from '../../hooks/usePersistent';
import { uid, today, fmt, daysSince, filterByTimeframe, TIMEFRAMES } from '../../lib/utils';

export function ExpensesPage({ expenses = [], setExpenses }: any) {
  const [modal, setModal] = useState({ open: false, data: null });
  const [filterCat, setFilterCat] = useState("all");
  const [timeframe, setTimeframe] = useState("30d");
  const [tab, setTab] = useState("expenses");
  const [mileageLog, setMileageLog] = usePersistent("smocks.mileage", []);
  const [f, setF] = useState<any>({ date: today(), category: "Supplies", description: "", amount: "", vendor: "", isCash: false, taxDeductible: true, receiptDataUrl: null });
  const [mf, setMf] = useState<any>({ date: today(), from: "Shop - York, PA", to: "", miles: "", purpose: "", roundTrip: false });
  const [mileModal, setMileModal] = useState(false);

  const categories = ["Supplies", "Chemicals", "Equipment", "Fuel", "Advertising", "Insurance", "Vehicle", "Tools", "Software", "Meals", "Phone", "Other"];
  const IRS_RATE = 0.67;

  const tfExp = filterByTimeframe(expenses, "date", timeframe);
  const displayed = filterCat === "all" ? tfExp : tfExp.filter((e: any) => e.category === filterCat);
  const tfMiles = filterByTimeframe(mileageLog, "date", timeframe);

  const totExp = displayed.reduce((s: any, e: any) => s + Number(e.amount), 0);
  const totMiles = tfMiles.reduce((s: any, m: any) => s + Number(m.miles), 0);
  const mileDeduction = totMiles * IRS_RATE;
  const deductible = displayed.filter((e: any) => e.taxDeductible).reduce((s: any, e: any) => s + Number(e.amount), 0);

  const openAdd = () => { setF({ date: today(), category: "Supplies", description: "", amount: "", vendor: "", isCash: false, taxDeductible: true, receiptDataUrl: null }); setModal({ open: true, data: null }); };
  const openEdit = (exp: any) => { setF({ ...exp }); setModal({ open: true, data: exp }); };
  const save = () => {
    if (!f.description.trim() || !f.amount) return;
    if (f.id) setExpenses((prev: any[]) => prev.map(e => e.id === f.id ? { ...f } : e));
    else setExpenses((prev: any[]) => [{ ...f, id: uid() }, ...prev]);
    setModal({ open: false, data: null });
  };
  const del = (id: string) => { setExpenses((prev: any[]) => prev.filter(e => e.id !== id)); };

  const tfLabel = TIMEFRAMES.find(t => t.key === timeframe)?.label || "All";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-black/40 border border-red-900/30 rounded-xl p-1">
          {["expenses", "mileage"].map(t => <button key={t} onClick={() => setTab(t)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition " + (tab === t ? "bg-gradient-to-r from-red-600 to-red-800 text-white" : "text-white/50 hover:text-white")}>{t === "expenses" ? "💸 Expenses" : "🚗 Mileage"}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} options={["7d", "30d", "90d", "6m", "1y", "all"]} compact />
          <GBtn onClick={tab === "expenses" ? openAdd : () => setMileModal(true)} className="!text-xs"><Plus size={12} className="inline mr-1" />{tab === "expenses" ? "Add Expense" : "Log Miles"}</GBtn>
        </div>
      </div>

      {tab === "expenses" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={DollarSign} label={"Total (" + tfLabel + ")"} value={fmt(totExp)} />
            <Stat icon={Receipt} label="Entries" value={displayed.length} />
            <Stat icon={TrendingUp} label="Tax Deductible" value={fmt(deductible)} />
            <Stat icon={Percent} label="Deductible %" value={totExp > 0 ? Math.round(deductible / totExp * 100) + "%" : "—"} />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterCat("all")} className={"text-xs px-2.5 py-1 rounded-lg border transition " + (filterCat === "all" ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>All ({tfExp.length})</button>
            {categories.filter(c => tfExp.some((e: any) => e.category === c)).map(c => <button key={c} onClick={() => setFilterCat(c)} className={"text-xs px-2.5 py-1 rounded-lg border transition " + (filterCat === c ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{c}</button>)}
          </div>

          <Glass className="overflow-hidden divide-y divide-red-900/10">
            {displayed.length === 0 ? <div className="text-center py-12 text-white/40">No expenses in this period</div>
              : displayed.map((e: any) => (
                <div key={e.id} className="flex items-start gap-3 p-4 hover:bg-white/5 group">
                  <div className="w-10 h-10 rounded-xl bg-black/40 border border-red-900/30 flex items-center justify-center flex-shrink-0 text-lg">💸</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{e.description}</span>
                      <Badge>{e.category}</Badge>
                      {e.isCash && <span className="text-[9px] text-green-300">💵 Cash</span>}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">{e.date} {e.vendor && `· ${e.vendor}`}</div>
                  </div>
                  <div className="text-red-400 font-bold">{fmt(Number(e.amount))}</div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition ml-2">
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-white/10 text-white/50"><Edit size={11} /></button>
                    <button onClick={() => del(e.id)} className="p-1.5 rounded hover:bg-red-900/30 text-white/50 hover:text-red-400"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
          </Glass>
        </>
      )}

      {tab === "mileage" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat icon={Route} label="Total Miles" value={totMiles.toFixed(1)} />
            <Stat icon={DollarSign} label="IRS Deduction" value={fmt(mileDeduction)} />
            <Stat icon={TrendingUp} label="Rate" value={"$" + IRS_RATE + "/mi"} />
          </div>
          <Glass className="overflow-hidden divide-y divide-red-900/10">
            {tfMiles.length === 0 ? <div className="text-center py-12 text-white/40">No mileage logged</div>
              : tfMiles.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-xl bg-black/40 border border-red-900/30 flex items-center justify-center text-lg">🚗</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{m.from} → {m.to}</div>
                    <div className="text-xs text-white/50">{m.date} · {m.miles} mi</div>
                  </div>
                  <div className="text-green-400 font-bold text-sm">{fmt(m.deduction)}</div>
                </div>
              ))}
          </Glass>
        </>
      )}

      <Modal open={modal.open} onClose={() => setModal({ ...modal, open: false })} title={modal.data ? "Edit Expense" : "Add Expense"}>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/60 mb-1 block">Date</label><GInput type="date" value={f.date} onChange={(e: any) => setF({ ...f, date: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Category</label><GSel value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>{categories.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel></div>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Description</label><GInput value={f.description} onChange={(e: any) => setF({ ...f, description: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Amount ($)</label><GInput type="number" value={f.amount} onChange={(e: any) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <GBtn variant="ghost" onClick={() => setModal({ ...modal, open: false })}>Cancel</GBtn>
            <GBtn onClick={save}>Save</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

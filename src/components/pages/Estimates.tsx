import React, { useState, useEffect } from 'react';
import { Eye, MessageSquare, Mail, Globe, Copy, Plus, Trash2, CheckCircle, Receipt, Briefcase, RefreshCw, Clock, Zap, Layers, Save, Shield, Clipboard, Lock } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { GBtn } from '../ui/GBtn';
import { GSel } from '../ui/GSel';
import { GInput } from '../ui/GInput';
import { GTxt } from '../ui/GTxt';
import { GDate } from '../ui/GDate';
import { Modal } from '../ui/Modal';
import { uid, today, fmt, daysSince, daysFromNow } from '../../lib/utils';
import { twilioSend, sendEmail } from '../../lib/messaging';

export function EstimatesPage({ 
  estimates = [], 
  setEstimates, 
  customers = [], 
  services = [], 
  settings = {}, 
  toast, 
  onPortal = () => { }, 
  setJobs = () => { }, 
  onNav = () => { }, 
  setTimeline = () => { }, 
  estimateTemplates = [], 
  setEstimateTemplates = () => { },
  addEstimate,
  updateEstimate,
  removeEstimate
}: any) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<any[]>([]);

  const cn = (id: string) => { const c = customers.find((x: any) => x.id === id); return c ? c.firstName + " " + c.lastName : "Unknown"; };
  const filtered = filter === "all" ? estimates : estimates.filter((e: any) => e.status === filter);

  const toggleSel = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const duplicate = async (e: any) => {
    const copy = { ...e, id: undefined, createdAt: today(), validUntil: daysFromNow(30), status: "pending", viewed: false, viewedAt: null };
    await addEstimate(copy);
    toast("Estimate duplicated");
  };

  const getExpiryStatus = (e: any) => {
    if (e.status !== "pending") return null;
    const days = daysSince(e.validUntil) * -1;
    if (days < 0) return { tone: "red", label: "EXPIRED", border: "border-red-500/60" };
    if (days <= 7) return { tone: "yellow", label: days + "d left", border: "border-yellow-500/50" };
    return null;
  };

  const deleteSelected = async () => {
    for (const id of selected) {
      await removeEstimate(id);
    }
    setSelected([]);
    toast(selected.length + " deleted");
  };

  const approveEstimate = async (id: string) => {
    await updateEstimate(id, { status: "approved", signedAt: today() });
    setViewing(null);
    toast("Approved!");
  };

  const saveEstimate = async (est: any) => {
    await addEstimate(est);
    setBuilderOpen(false);
    toast("Estimate created");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "approved"].map(s => <button key={s} onClick={() => setFilter(s)} className={"px-3 py-1.5 rounded-xl text-xs font-medium transition border " + (filter === s ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{s === "all" ? "All (" + estimates.length + ")" : s + " (" + estimates.filter((e: any) => e.status === s).length + ")"}</button>)}
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <GBtn variant="danger" onClick={deleteSelected} className="!text-xs">Delete ({selected.length})</GBtn>
          )}
          <GBtn onClick={() => setBuilderOpen(true)}><Plus size={14} className="mr-1.5" />New</GBtn>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((e: any) => {
          const expiry = getExpiryStatus(e);
          const isSel = selected.includes(e.id);
          return (
            <Glass key={e.id} className={"p-5 hover:border-red-600/50 transition-all " + (isSel ? "ring-2 ring-red-500/50 " : "") + (expiry ? (expiry as any).border : "")}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <input type="checkbox" checked={isSel} onChange={() => toggleSel(e.id)} className="mt-1 w-4 h-4 rounded accent-red-600" />
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                      #{String(e.id).toUpperCase().slice(-6)}
                      {e.viewed && <Eye size={10} className="text-green-400" />}
                    </div>
                    <div className="font-semibold mt-1">{cn(e.customerId)}</div>
                  </div>
                </div>
                <Badge tone={e.status === "approved" ? "green" : "yellow"}>{e.status}</Badge>
              </div>
              <div className="text-2xl font-bold cursor-pointer" onClick={() => setViewing(e)}>{fmt(e.total)}</div>
              <div className="text-xs text-white/50 mt-1">{e.lineItems?.length || 0} items · {e.createdAt}</div>
              <div className="flex gap-1 pt-3 mt-3 border-t border-red-900/20">
                <button onClick={() => setViewing(e)} className="flex-1 p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-[11px] transition flex items-center justify-center gap-1"><Eye size={11} />View</button>
                <button onClick={() => duplicate(e)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-[11px] transition"><Copy size={11} /></button>
              </div>
            </Glass>
          );
        })}
      </div>

      {builderOpen && <EstimateBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} customers={customers} services={services} settings={settings} onSave={saveEstimate} estimateTemplates={estimateTemplates} setEstimateTemplates={setEstimateTemplates} />}
      {viewing && <EstimatePreview estimate={viewing} customers={customers} onClose={() => setViewing(null)} onApprove={approveEstimate} />}
    </div>
  );
}

function ChemicalCostCalc({ items = [] }: any) {
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setLoading(true);
    setTimeout(() => {
      setEstimate({ sqsh: 15, surf: 5, total: 20, notes: "Estimated chemicals for typical soft wash" });
      setLoading(false);
    }, 800);
  };

  return (
    <div className="p-3 bg-gradient-to-br from-yellow-950/20 to-black/60 border border-yellow-700/30 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-yellow-300 flex items-center gap-1.5">🧪 Chemical Cost Estimate</div>
        <button onClick={calculate} disabled={loading} className="text-xs px-2 py-1 bg-yellow-600/20 text-yellow-300 rounded border border-yellow-700/40">Calculate</button>
      </div>
      {estimate && (
        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="bg-black/40 p-1 rounded">SH: {fmt(estimate.sqsh)}</div>
          <div className="bg-black/40 p-1 rounded">Surf: {fmt(estimate.surf)}</div>
          <div className="bg-yellow-900/30 p-1 rounded font-bold">Total: {fmt(estimate.total)}</div>
        </div>
      )}
    </div>
  );
}

function EstimateBuilder({ open, onClose, customers = [], services = [], settings = {}, onSave, estimateTemplates = [], setEstimateTemplates = () => { } }: any) {
  const [cid, setCid] = useState(customers[0]?.id || "");
  const [items, setItems] = useState([{ id: uid(), description: "", quantity: 1, unitPrice: 0 }]);
  const [vu, setVu] = useState(daysFromNow(30));

  const sub = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);
  const tax = sub * (Number(settings.taxRate || 6) / 100);
  const total = sub + tax;

  return (
    <Modal open={open} onClose={onClose} title="Build Estimate" maxW="max-w-3xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <GSel value={cid} onChange={(e: any) => setCid(e.target.value)}>{customers.map((c: any) => <option key={c.id} value={c.id} className="bg-black">{c.firstName} {c.lastName}</option>)}</GSel>
          <GDate value={vu} onChange={(e: any) => setVu(e.target.value)} />
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={it.id} className="flex gap-2">
              <GInput placeholder="Description" value={it.description} onChange={(e: any) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} className="flex-1" />
              <GInput type="number" placeholder="Qty" value={it.quantity} onChange={(e: any) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} className="w-20" />
              <GInput type="number" placeholder="Price" value={it.unitPrice} onChange={(e: any) => setItems(items.map((x, i) => i === idx ? { ...x, unitPrice: e.target.value } : x))} className="w-24" />
              <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 p-2"><Trash2 size={16} /></button>
            </div>
          ))}
          <button onClick={() => setItems([...items, { id: uid(), description: "", quantity: 1, unitPrice: 0 }])} className="text-xs text-red-400 flex items-center gap-1"><Plus size={12} />Add Item</button>
        </div>
        <ChemicalCostCalc items={items} />
        <div className="p-4 bg-black/40 rounded-xl space-y-1 text-sm border border-white/5">
          <div className="flex justify-between text-white/50"><span>Subtotal</span><span>{fmt(sub)}</span></div>
          <div className="flex justify-between text-white/50"><span>Tax ({settings.taxRate || 6}%)</span><span>{fmt(tax)}</span></div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10"><span>Total</span><span className="text-red-400">{fmt(total)}</span></div>
        </div>
        <div className="flex justify-end gap-2">
          <GBtn variant="ghost" onClick={onClose}>Cancel</GBtn>
          <GBtn onClick={() => onSave({ customerId: cid, lineItems: items, subtotal: sub, tax, total, status: "pending", createdAt: today(), validUntil: vu })}>Create Estimate</GBtn>
        </div>
      </div>
    </Modal>
  );
}

function EstimatePreview({ estimate: e, customers = [], onClose, onApprove }: any) {
  const c = customers.find((x: any) => x.id === e.customerId);
  return (
    <Modal open={!!e} onClose={onClose} title={"Estimate Preview"} maxW="max-w-2xl">
      <div className="bg-white text-black p-8 rounded-xl">
        <div className="flex justify-between border-b-2 border-red-600 pb-4 mb-6">
          <div className="text-xl font-bold">Smock's Pressure Washing</div>
          <div className="text-right">#{String(e.id).toUpperCase().slice(-6)}</div>
        </div>
        <div className="mb-6">
          <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Estimate For</div>
          <div className="font-bold">{c?.firstName} {c?.lastName}</div>
          <div className="text-sm text-gray-600">{c?.address}</div>
        </div>
        <table className="w-full text-sm mb-6">
          <thead className="border-b border-gray-200">
            <tr><th className="text-left py-2">Description</th><th className="text-right py-2">Total</th></tr>
          </thead>
          <tbody>
            {e.lineItems?.map((li: any) => (
              <tr key={li.id} className="border-b border-gray-50">
                <td className="py-2">{li.description}</td>
                <td className="text-right py-2">{fmt(li.quantity * li.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto w-48 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{fmt(e.subtotal)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{fmt(e.tax)}</span></div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t-2 border-red-600"><span>Total</span><span>{fmt(e.total)}</span></div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {e.status === "pending" && <GBtn onClick={() => onApprove(e.id)} className="flex-1">Approve & Sign</GBtn>}
        <GBtn variant="ghost" onClick={onClose} className="flex-1">Close</GBtn>
      </div>
    </Modal>
  );
}

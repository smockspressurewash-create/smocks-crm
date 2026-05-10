import React, { useState } from 'react';
import { Search, Receipt, Download, Mail, Send, CheckCircle, X, DollarSign, Calendar, Clock, Filter, FileText } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { Modal } from '../ui/Modal';
import { fmt, today, daysSince } from '../../lib/utils';

export function InvoicesPage({ 
  estimates = [], 
  setEstimates, 
  customers = [], 
  settings = {}, 
  toast,
  updateEstimate
}: any) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const invoices = estimates.filter((e: any) => e.invoiced);
  const filtered = invoices.filter((inv: any) => {
    const c = customers.find((x: any) => x.id === inv.customerId);
    const q = search.toLowerCase();
    const matchesSearch = (c?.firstName + " " + c?.lastName).toLowerCase().includes(q) || String(inv.id || "").toLowerCase().includes(q);
    if (filter === "paid") return matchesSearch && inv.paidAt;
    if (filter === "unpaid") return matchesSearch && !inv.paidAt;
    return matchesSearch;
  });

  const markPaid = async (id: string) => {
    await updateEstimate(id, { paidAt: today() });
    toast("Invoice marked as paid");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {["all", "unpaid", "paid"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={"px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition " + (filter === f ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>
              {f} ({invoices.filter((inv: any) => f === "all" ? true : f === "paid" ? !!inv.paidAt : !inv.paidAt).length})
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <GInput placeholder="Search invoices..." value={search} onChange={(e: any) => setSearch(e.target.value)} className="!pl-9 !py-1.5 !text-xs" />
        </div>
      </div>

      <Glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-3 font-semibold text-white/60">Invoice #</th>
                <th className="p-3 font-semibold text-white/60">Customer</th>
                <th className="p-3 font-semibold text-white/60">Date</th>
                <th className="p-3 font-semibold text-white/60">Amount</th>
                <th className="p-3 font-semibold text-white/60">Status</th>
                <th className="p-3 font-semibold text-white/60 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((inv: any) => {
                const c = customers.find((x: any) => x.id === inv.customerId);
                return (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-mono text-white/70 uppercase">{String(inv.id).slice(-6)}</td>
                    <td className="p-3">
                      <div className="font-medium">{c?.firstName} {c?.lastName}</div>
                      <div className="text-[10px] text-white/40">{c?.email}</div>
                    </td>
                    <td className="p-3 text-white/50">{inv.invoicedAt || inv.createdAt}</td>
                    <td className="p-3 font-bold text-red-400">{fmt(inv.total)}</td>
                    <td className="p-3">
                      <Badge tone={inv.paidAt ? "green" : "red"}>{inv.paidAt ? "Paid" : "Unpaid"}</Badge>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {!inv.paidAt && <GBtn onClick={() => markPaid(inv.id)} variant="ghost" className="!px-2 !py-1 !text-[10px]">Mark Paid</GBtn>}
                      <GBtn variant="ghost" className="!px-2 !py-1 !text-[10px]"><Download size={10} /></GBtn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-8 text-center text-white/40 italic">No invoices found</div>}
        </div>
      </Glass>
    </div>
  );
}

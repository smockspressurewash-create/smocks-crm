import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Badge } from './Badge';
import { fmt } from '../../lib/utils';

export function GlobalSearch({ customers = [], jobs = [], estimates = [], onNav }: any) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = q.length < 2 ? [] : (() => {
    const qL = q.toLowerCase();
    const res: any[] = [];
    customers.filter((c: any) => (c.firstName + " " + c.lastName + " " + c.phone + " " + c.email + " " + c.address).toLowerCase().includes(qL)).slice(0, 5).forEach((c: any) =>
      res.push({ type: "customer", icon: "👤", title: c.firstName + " " + c.lastName, sub: c.phone || c.email || "", page: "customers", id: c.id })
    );
    jobs.filter((j: any) => (j.address + " " + j.status).toLowerCase().includes(qL)).slice(0, 4).forEach((j: any) =>
      res.push({ type: "job", icon: "🔨", title: j.address?.split(",")[0] || "Job", sub: j.scheduledDate + " · " + fmt(j.amount), page: "jobs" })
    );
    estimates.filter((e: any) => (e.lineItems?.map((l: any) => l.description).join(" ") || "").toLowerCase().includes(qL)).slice(0, 3).forEach((e: any) => {
      const c = customers.find((x: any) => x.id === e.customerId);
      res.push({ type: "estimate", icon: "📋", title: (c ? c.firstName + " " + c.lastName : "Estimate") + " — " + fmt(e.total), sub: e.status + " · " + e.createdAt, page: "estimates" });
    });
    return res;
  })();

  useEffect(() => {
    const handler = (e: any) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); } if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }} className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-red-900/30 rounded-xl text-xs text-white/50 hover:text-white hover:border-red-600/50 transition">
        <Search size={13} />
        <span className="hidden md:block">Search</span>
        <span className="hidden md:block text-[10px] text-white/30 border border-white/10 rounded px-1">⌘K</span>
      </button>
      {open && <>
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur">
          <div className="p-3 border-b border-red-900/30">
            <div className="flex items-center gap-2">
              <Search size={14} className="text-white/50 flex-shrink-0" />
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers, jobs, estimates…" className="flex-1 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none" autoFocus />
              {q && <button onClick={() => setQ("")} className="text-white/40 hover:text-white"><X size={12} /></button>}
            </div>
          </div>
          {q.length >= 2 && (results.length === 0
            ? <div className="p-6 text-center text-sm text-white/40">No results for "{q}"</div>
            : <div className="max-h-80 overflow-y-auto">
              {results.map((r: any, i: number) => (
                <button key={i} onClick={() => { onNav(r.page); setOpen(false); setQ(""); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left transition border-b border-red-900/10 last:border-0">
                  <span className="text-lg flex-shrink-0">{r.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-[10px] text-white/40 truncate">{r.sub}</div>
                  </div>
                  <Badge tone="gray">{r.type}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </>}
    </div>
  );
}

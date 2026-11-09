// ServiceMultiPicker.tsx — tick several saved services and add them as line
// items in one go.
//
// FEATURE (owner request) — "for estimates, jobs, work orders, quotes,
// anything: whenever adding line items, you should be able to add more than
// one." The catalog dropdowns added one service and closed, so a five-line
// quote meant opening the list five times. This opens a searchable list
// right under the button (inline, not a floating menu, so a phone keyboard
// or scrolling can't close it), you tick as many as you want, then add them.
import React, { useMemo, useState } from "react";
import { Plus, Search, Check } from "lucide-react";
import { fmt } from "../../lib/utils";

export function ServiceMultiPicker({ services = [], onAdd, label = "+ Add services" }: { services?: any[]; onAdd: (picked: any[]) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const active = useMemo(() => services.filter((s: any) => s && s.name && s.active !== false), [services]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length ? active.filter((s: any) => words.every(w => String(s.name).toLowerCase().includes(w))) : active;
  const price = (s: any) => Number(s.basePrice || s.price || 0);
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const add = () => {
    const list = picked.map(id => active.find((s: any) => s.id === id)).filter(Boolean);
    if (list.length) onAdd(list);
    setPicked([]); setQ(""); setOpen(false);
  };
  if (active.length === 0) return null;
  return (
    <div data-svc-multi className="w-full">
      {!open ? (
        <button type="button" data-svc-multi-open onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-white/20 text-xs text-white/70 hover:text-white hover:border-white/40 transition">
          <Plus size={13} />{label} <span className="text-white/40">(pick as many as you want)</span>
        </button>
      ) : (
        <div className="rounded-xl border border-white/15 bg-black/50 p-2 space-y-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input data-svc-multi-search autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search services…" className="w-full h-9 bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 text-[16px] md:text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30" />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {shown.map((s: any) => {
              const on = picked.includes(s.id);
              return (
                <button type="button" key={s.id} data-svc-option onClick={() => toggle(s.id)} className={"w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left border transition " + (on ? "bg-white/10 border-white/25" : "bg-transparent border-transparent hover:bg-white/5")}>
                  <span className={"w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 " + (on ? "bg-red-600 border-red-500" : "border-white/30")}>{on && <Check size={11} className="text-white" />}</span>
                  <span className="flex-1 min-w-0 text-sm text-white truncate">{s.name}</span>
                  {price(s) > 0 && <span className="text-xs text-white/50 flex-shrink-0">{fmt(price(s))}</span>}
                </button>
              );
            })}
            {shown.length === 0 && <div className="px-2.5 py-2 text-xs text-white/40">No service matches "{q.trim()}"</div>}
          </div>
          <div className="flex gap-2">
            <button type="button" data-svc-multi-add disabled={picked.length === 0} onClick={add} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold">
              {picked.length ? `Add ${picked.length} service${picked.length > 1 ? "s" : ""}` : "Tick the services to add"}
            </button>
            <button type="button" onClick={() => { setPicked([]); setQ(""); setOpen(false); }} className="px-3 py-2 rounded-lg bg-white/5 text-white/60 text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

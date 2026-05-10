import React, { useState } from 'react';
import { Truck, MapPin, Phone, Clock, Play, Navigation, Send, Check, CheckCircle, Camera, AlertCircle, X, ChevronRight } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { fmt, today, uid } from '../../lib/utils';

export function CrewView({ jobs = [], setJobs, customers = [], employees = [], toast }: any) {
  const [empFilter, setEmpFilter] = useState("all");
  const [crewDate, setCrewDate] = useState(today());

  const activeEmps = employees.filter((e: any) => e.status === "active");
  const dayJobs = jobs
    .filter((j: any) => j.scheduledDate === crewDate && j.status !== "cancelled")
    .filter((j: any) => empFilter === "all" || (j.crewIds || []).includes(empFilter));

  const updateJob = (jid: string, patch: any) => setJobs((prev: any) => prev.map((j: any) => j.id === jid ? { ...j, ...patch } : j));
  
  const toggleCk = (jid: string, idx: number) => {
    setJobs((prev: any) => prev.map((j: any) => j.id === jid ? { 
      ...j, 
      checklist: (j.checklist || []).map((c: any, i: number) => i === idx ? { ...c, done: !c.done } : c) 
    } : j));
  };

  const clockIn = (jid: string) => { 
    updateJob(jid, { clockInAt: Date.now() }); 
    if (toast) toast("Clocked in ✓"); 
  };

  const clockOut = (j: any) => {
    if (!j.clockInAt) return;
    const hrs = Math.round(((Date.now() - j.clockInAt) / 3600000) * 100) / 100;
    updateJob(j.id, { clockInAt: null, loggedHours: Math.round(((Number(j.loggedHours) || 0) + hrs) * 100) / 100 });
    if (toast) toast("+" + hrs + "h logged");
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <Glass className="p-4 !bg-gradient-to-br !from-red-950/40 !to-black/70">
        <div className="flex items-center justify-between mb-3">
          <div><h2 className="font-bold text-lg">🚛 Crew Dashboard</h2><div className="text-xs text-white/60">Field view · {dayJobs.length} stop{dayJobs.length !== 1 ? "s" : ""}</div></div>
          <GInput type="date" value={crewDate} onChange={(e: any) => setCrewDate(e.target.value)} className="!text-xs !py-1.5 !w-36" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setEmpFilter("all")} className={"px-2.5 py-1 rounded-lg text-xs border transition " + (empFilter === "all" ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60")}>All crew</button>
          {activeEmps.map((e: any) => <button key={e.id} onClick={() => setEmpFilter(e.id)} className={"px-2.5 py-1 rounded-lg text-xs border transition " + (empFilter === e.id ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60")}>{e.firstName}</button>)}
        </div>
      </Glass>

      {dayJobs.map((j: any, stopIdx: number) => {
        const c = customers.find((x: any) => x.id === j.customerId);
        const checklist = j.checklist || [];
        const doneCount = checklist.filter((ck: any) => ck.done).length;
        const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;
        const isClockedIn = !!j.clockInAt;

        return (
          <div key={j.id} className="bg-black/60 border border-red-900/30 rounded-2xl overflow-hidden">
            <div className={"p-4 " + (isClockedIn ? "bg-green-950/30" : "")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-xs font-bold flex-shrink-0">{stopIdx + 1}</div>
                    <div className="font-bold text-base">{c?.firstName} {c?.lastName}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-white/70 ml-9">
                    <MapPin size={13} />
                    <span className="truncate">{j.address}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-400">{fmt(j.amount)}</div>
                </div>
              </div>

              <div className="mt-4 ml-9 space-y-3">
                {isClockedIn ? (
                  <button onClick={() => clockOut(j)} className="w-full py-3 rounded-xl bg-green-900/40 border-2 border-green-500/60 text-green-300 font-bold text-sm flex items-center justify-center gap-2">
                    <Clock size={16} /> Tap to clock out
                  </button>
                ) : (
                  <button onClick={() => clockIn(j.id)} className="w-full py-3 rounded-xl bg-red-700/40 border-2 border-red-500/60 text-white font-bold text-sm flex items-center justify-center gap-2">
                    <Play size={16} />Clock In
                  </button>
                )}
              </div>
            </div>

            {checklist.length > 0 && (
              <div className="px-4 pb-4">
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-gradient-to-r from-red-500 to-green-500 transition-all" style={{ width: pct + "%" }} />
                </div>
                <div className="space-y-2">
                  {checklist.map((ck: any, idx: number) => (
                    <label key={idx} className={"flex items-start gap-3 p-3 rounded-xl cursor-pointer transition " + (ck.done ? "bg-green-950/20" : "bg-white/5")}>
                      <input type="checkbox" checked={ck.done} onChange={() => toggleCk(j.id, idx)} className="w-5 h-5 rounded accent-green-500 flex-shrink-0 mt-0.5" />
                      <span className={"text-sm " + (ck.done ? "line-through text-white/50" : "text-white/90")}>{ck.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

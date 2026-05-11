// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { uid, today, daysSince, fmt, daysFromNow } from '../../lib/utils';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GSel } from '../ui/GSel';
import { Modal } from '../ui/Modal';
import { Glass } from '../ui/Glass';
import { PageFade } from '../ui/PageFade';
import { VoiceMicButton } from '../ui/VoiceMicButton';
import { MODELS, callModel, parseRateLimitError } from '../../lib/ai';
import { twilioSend, sendEmail } from '../../lib/messaging';
import { sendGmailEmail, createCalendarEvent, uploadToDrive } from '../../lib/google';
import { personalities } from '../../lib/constants';

// Destructure common icons to avoid rewriting component code
const { 
  Bot, Settings, X, Plus, Search, Edit, Trash2, Send, Activity, Users,
  MessageSquare, Mic, Play, Volume2, Cloud, FileImage, Link, ArrowRight,
  CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Menu, Zap, Clock, GripVertical, RefreshCw, Copy, Paperclip, Target, Workflow, BarChart2,
  Lock, Key, Image: ImageIcon, MapPin, Map, Sun, Wind, Umbrella, CheckSquare, Save, XCircle
} = LucideIcons;

export function CrewView({ jobs = [], setJobs, customers = [], employees = [], toast }) {
  const [empFilter, setEmpFilter] = useState("all");
  const [crewDate, setCrewDate] = useState(today());

  const activeEmps = employees.filter(e => e.status === "active");
  const dayJobs = jobs
    .filter(j => j.scheduledDate === crewDate && j.status !== "cancelled")
    .filter(j => empFilter === "all" || (j.crew || []).includes(empFilter))
    .sort((a, b) => { const po = { urgent: 0, high: 1, normal: 2, low: 3 }; return (po[a.priority || "normal"] - po[b.priority || "normal"]); });

  const updateJob = (jid, patch) => setJobs(prev => prev.map(j => j.id === jid ? { ...j, ...patch } : j));
  const toggleCk = (jid, idx) => setJobs(prev => prev.map(j => j.id === jid ? { ...j, checklist: j.checklist.map((c, i) => i === idx ? { ...c, done: !c.done } : c) } : j));
  const clockIn = jid => { updateJob(jid, { clockInAt: Date.now() }); toast("Clocked in ✓"); };
  const clockOut = j => {
    if (!j.clockInAt) return;
    const hrs = Math.round(((Date.now() - j.clockInAt) / 3600000) * 100) / 100;
    updateJob(j.id, { clockInAt: null, loggedHours: Math.round(((Number(j.loggedHours) || 0) + hrs) * 100) / 100 });
    toast("+" + hrs + "h logged");
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Crew header */}
      <Glass className="p-4 !bg-gradient-to-br !from-red-950/40 !to-black/70">
        <div className="flex items-center justify-between mb-3">
          <div><h2 className="font-bold text-lg">🚛 Crew Dashboard</h2><div className="text-xs text-white/60">Field view · {dayJobs.length} stop{dayJobs.length !== 1 ? "s" : ""} today</div></div>
          <GInput type="date" value={crewDate} onChange={e => setCrewDate(e.target.value)} className="!text-xs !py-1.5 !w-36" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setEmpFilter("all")} className={"px-2.5 py-1 rounded-lg text-xs border transition " + (empFilter === "all" ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60")}>All crew</button>
          {activeEmps.map(e => <button key={e.id} onClick={() => setEmpFilter(e.id)} className={"px-2.5 py-1 rounded-lg text-xs border transition " + (empFilter === e.id ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60")}>{e.firstName}</button>)}
        </div>
      </Glass>

      {/* GPS Route for crew */}
      {dayJobs.length > 0 && <button onClick={() => {
        const addresses = dayJobs.map(j => encodeURIComponent(j.address || "")).filter(Boolean);
        if (addresses.length === 0) return;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (addresses.length === 1) {
          const url = isIOS ? "maps://maps.apple.com/?daddr=" + addresses[0] : "https://www.google.com/maps/dir/?api=1&destination=" + addresses[0];
          window.open(url, "_blank");
        } else {
          // Multi-stop Google Maps route (up to 8 waypoints)
          const dest = addresses[addresses.length - 1];
          const waypoints = addresses.slice(0, -1).join("|");
          const url = "https://www.google.com/maps/dir/?api=1&destination=" + dest + "&waypoints=" + waypoints + "&travelmode=driving";
          window.open(url, "_blank");
        }
      }} className="w-full flex items-center justify-center gap-2 py-3 bg-green-950/30 border border-green-700/40 text-green-300 rounded-2xl hover:bg-green-900/40 transition font-semibold text-sm">
        <Navigation size={16} />Open Full Route in Maps ({dayJobs.length} stops)
      </button>}

      {dayJobs.length === 0 && <div className="text-center py-16 text-white/50">
        <Truck size={40} className="mx-auto mb-3 opacity-30" />
        <div className="text-sm font-medium">No jobs for {crewDate}</div>
        <div className="text-xs mt-1 text-white/40">Check a different date or assign crew to jobs</div>
      </div>}

      {dayJobs.map((j, stopIdx) => {
        const c = customers.find(x => x.id === j.customerId);
        const doneCount = j.checklist.filter(ck => ck.done).length;
        const pct = j.checklist.length ? Math.round((doneCount / j.checklist.length) * 100) : 0;
        const isClockedIn = !!j.clockInAt;
        const liveHrs = isClockedIn ? ((Date.now() - j.clockInAt) / 3600000) : 0;
        const prioColor = { urgent: "border-l-red-500", high: "border-l-yellow-500", normal: "border-l-transparent", low: "border-l-transparent" }[j.priority || "normal"];

        return <div key={j.id} className={"bg-black/60 border border-red-900/30 rounded-2xl overflow-hidden border-l-4 " + prioColor}>
          {/* Stop header */}
          <div className={"p-4 " + (isClockedIn ? "bg-green-950/30" : "")}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-xs font-bold flex-shrink-0">{stopIdx + 1}</div>
                  <div className="font-bold text-base">{c?.firstName} {c?.lastName}</div>
                  {j.priority === "urgent" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600/40 text-red-200 font-bold border border-red-500/50">🚨 URGENT</span>}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-white/70 ml-9">
                  <MapPin size={13} />
                  <span className="truncate">{j.address}</span>
                </div>
                {c?.phone && <div className="flex items-center gap-1.5 text-sm text-white/70 ml-9 mt-0.5">
                  <Phone size={13} />
                  <a href={"tel:" + c.phone} className="text-red-400 hover:underline">{c.phone}</a>
                </div>}
                {j.internalNotes && <div className="ml-9 mt-2 px-3 py-2 rounded-lg bg-yellow-950/30 border border-yellow-700/40 text-[11px] text-yellow-200">
                  ⚠️ {j.internalNotes}
                </div>}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-red-400">{fmt(j.amount)}</div>
                {j.isCash && <div className="text-[10px] text-green-400 font-bold">💵 CASH</div>}
                <div className="text-[10px] text-white/50">{j.duration}h est.</div>
              </div>
            </div>

            {/* OTW + Maps quick actions */}
            <div className="mt-3 ml-9 flex gap-2">
              <a href={"https://maps.google.com/?q=" + encodeURIComponent(j.address || "")} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-950/30 border border-blue-700/40 text-blue-300 text-xs font-medium hover:bg-blue-900/40 active:scale-95 transition">
                <Navigation size={12} />Directions
              </a>
              {c?.phone && <button onClick={async () => {
                const msg = "Hi " + c.firstName + "! We're on our way to your property. ETA ~15 min. — Smock's";
                if (window.__settings?.twilioSid) {
                  try { await twilioSend(window.__settings, c.phone, msg); toast("OTW text sent to " + c.firstName + " ✓"); }
                  catch { window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg); }
                } else { window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg); }
              }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-950/30 border border-orange-700/40 text-orange-300 text-xs font-medium hover:bg-orange-900/40 active:scale-95 transition">
                <Send size={12} />OTW Text
              </button>}
              {c?.phone && <a href={"tel:" + c.phone} className="px-3 flex items-center justify-center py-2 rounded-xl bg-green-950/30 border border-green-700/40 text-green-300 hover:bg-green-900/40 active:scale-95 transition">
                <Phone size={12} />
              </a>}
            </div>

            {/* Clock in/out */}
            <div className="mt-3 ml-9">
              {isClockedIn ? (
                <button onClick={() => clockOut(j)} className="w-full py-3 rounded-xl bg-green-900/40 border-2 border-green-500/60 text-green-300 font-bold text-sm flex items-center justify-center gap-2 animate-pulse">
                  <Clock size={16} />{String(Math.floor(liveHrs)).padStart(2, "0")}:{String(Math.floor((liveHrs * 60) % 60)).padStart(2, "0")}:{String(Math.floor((liveHrs * 3600) % 60)).padStart(2, "0")} · Tap to clock out
                </button>
              ) : (
                <button onClick={() => clockIn(j.id)} className="w-full py-3 rounded-xl bg-red-700/40 border-2 border-red-500/60 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-700/60 active:scale-95 transition">
                  <Play size={16} />Clock In — Stop {stopIdx + 1}
                </button>
              )}
            </div>
          </div>

          {/* Checklist */}
          {j.checklist.length > 0 && <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-white/50 uppercase tracking-wider">Checklist</div>
              <div className="text-[11px] font-semibold">{pct}% done</div>
            </div>
            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-gradient-to-r from-red-500 to-green-500 transition-all" style={{ width: pct + "%" }} />
            </div>
            <div className="space-y-2">
              {j.checklist.map((ck, idx) => (
                <label key={idx} className={"flex items-start gap-3 p-3 rounded-xl cursor-pointer transition active:scale-95 " + (ck.done ? "bg-green-950/20 border border-green-700/30" : "bg-white/5 border border-white/10")}>
                  <input type="checkbox" checked={ck.done} onChange={() => toggleCk(j.id, idx)} className="w-5 h-5 rounded accent-green-500 flex-shrink-0 mt-0.5" />
                  <span className={"text-sm " + (ck.done ? "line-through text-white/50" : "text-white/90")}>{ck.text}</span>
                </label>
              ))}
            </div>

            {/* Photos quick-add */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const r = new FileReader(); r.onload = ev => updateJob(j.id, { photos: [...(j.photos || []), { id: uid(), type: "before", dataUrl: ev.target.result, addedAt: today(), caption: "Before" }] });
                  r.readAsDataURL(f); e.target.value = "";
                  toast("Before photo added");
                }} />
                <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-950/30 border border-blue-700/40 text-blue-300 text-xs font-medium">📷 Before</div>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const r = new FileReader(); r.onload = ev => updateJob(j.id, { photos: [...(j.photos || []), { id: uid(), type: "after", dataUrl: ev.target.result, addedAt: today(), caption: "After" }] });
                  r.readAsDataURL(f); e.target.value = "";
                  toast("After photo added");
                }} />
                <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-950/30 border border-green-700/40 text-green-300 text-xs font-medium">✨ After</div>
              </label>
            </div>
            {(j.photos || []).length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {(j.photos || []).map((p, i) => <div key={i} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 relative">
                {p.dataUrl ? <img src={p.dataUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/10 flex items-center justify-center text-lg">{p.type === "before" ? "📷" : "✨"}</div>}
              </div>)}
            </div>}

            {/* Mark complete - always show if not done */}
            {j.status !== "completed" && (
              <button onClick={() => { if (j.clockInAt) clockOut(j); updateJob(j.id, { status: "completed" }); toast("✅ Job complete!"); }} className={"mt-3 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition " + (pct === 100 ? "bg-green-700 hover:bg-green-600 text-white" : "bg-green-950/50 border-2 border-green-700/50 text-green-300 hover:bg-green-900/40")}>
                <CheckCircle size={16} />{pct === 100 ? "Mark Job Complete ✓" : "Mark Complete (" + pct + "% checked)"}
              </button>
            )}
            {j.status === "completed" && <div className="mt-3 py-2.5 rounded-xl bg-green-950/30 border border-green-600/40 text-green-300 text-sm text-center font-semibold flex items-center justify-center gap-2"><CheckCircle size={14} />Completed · {j.loggedHours || 0}h logged</div>}
          </div>}
        </div>;
      })}

      {dayJobs.length > 0 && <div className="text-center text-xs text-white/40 pb-4">
        <div>{dayJobs.filter(j => j.status === "completed").length}/{dayJobs.length} complete · {fmt(dayJobs.reduce((s, j) => s + j.amount, 0))} revenue</div>
      </div>}
    </div>
  );
}

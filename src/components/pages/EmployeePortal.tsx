import React, { useState, useEffect, useRef } from "react";
import {
  Clock, Briefcase, Calendar, ChevronLeft, CheckSquare, Camera,
  LogOut, MapPin, Phone, User, Play, Square, Plus, X, Eye, DollarSign,
  ChevronRight, Home, List, CheckCircle, AlertCircle, Image, FileText,
  Video, PenLine, Shield, Navigation, Database
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GTxt } from "../ui/GTxt";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { fmt, uid, today } from "../../lib/utils";
import type { Job, Employee, Customer, AppSettings, JobChecklistItem } from "../../types";

const PRE_DEFAULTS: JobChecklistItem[] = [
  { id: "pre1", label: "Take photos of existing damage", done: false },
  { id: "pre2", label: "Confirm water access", done: false },
  { id: "pre3", label: "Check weather conditions", done: false },
  { id: "pre4", label: "Note any pre-existing issues", done: false },
];
const DURING_DEFAULTS: JobChecklistItem[] = [
  { id: "dur1", label: "Apply cleaning solution", done: false },
  { id: "dur2", label: "Scrub affected areas", done: false },
  { id: "dur3", label: "Rinse thoroughly", done: false },
];
const POST_DEFAULTS: JobChecklistItem[] = [
  { id: "post1", label: "Customer walkthrough", done: false },
  { id: "post2", label: "Collect payment", done: false },
  { id: "post3", label: "Get customer signature", done: false },
  { id: "post4", label: "Take after photos", done: false },
];

export const PERMISSION_DEFS = [
  { key: "can_view_jobs",          label: "View assigned jobs",        desc: "See their job schedule" },
  { key: "can_clock_in",           label: "Clock in / out",            desc: "Track time on jobs" },
  { key: "can_upload_photos",      label: "Upload photos",             desc: "Take before/after photos" },
  { key: "can_complete_checklist", label: "Complete checklist",        desc: "Check off job items" },
  { key: "can_get_signoff",        label: "Get customer sign-off",     desc: "Collect customer signature" },
  { key: "can_view_pay",           label: "View pay info",             desc: "See pay rate and history" },
  { key: "can_view_calendar",      label: "View calendar",             desc: "See weekly/monthly schedule" },
  { key: "can_add_notes",          label: "Add job notes",             desc: "Leave notes on jobs" },
] as const;

export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  can_view_jobs: true, can_clock_in: true, can_upload_photos: true,
  can_complete_checklist: true, can_get_signoff: true,
  can_view_pay: true, can_view_calendar: true, can_add_notes: true,
};

function PortalChecklistSection({ title, emoji, items, onUpdate, allowPhotos = false, disabled = false }: {
  title: string; emoji: string;
  items: JobChecklistItem[];
  onUpdate: (items: JobChecklistItem[]) => void;
  allowPhotos?: boolean;
  disabled?: boolean;
}) {
  const done = items.filter(i => i.done).length;
  const toggle = (id: string) => { if (!disabled) onUpdate(items.map(it => it.id === id ? { ...it, done: !it.done } : it)); };
  const updateNotes = (id: string, notes: string) => onUpdate(items.map(it => it.id === id ? { ...it, notes } : it));
  const addItemPhoto = (id: string, dataUrl: string) => {
    const photo = { id: uid(), dataUrl };
    onUpdate(items.map(it => it.id === id ? { ...it, photos: [...(it.photos || []), photo] } : it));
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">{emoji} {title}</div>
        <div className={"text-xs font-bold " + (done === items.length ? "text-green-400" : "text-white/40")}>
          {done}/{items.length}
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-start gap-2">
              <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)}
                disabled={disabled}
                className={"mt-0.5 w-4 h-4 flex-shrink-0 " + (disabled ? "opacity-50 cursor-not-allowed" : "accent-green-500 cursor-pointer")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={"text-sm flex-1 " + (item.done ? "line-through text-white/30" : "text-white/80")}>
                    {item.label}
                  </div>
                  {allowPhotos && (
                    <label className="cursor-pointer flex-shrink-0">
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const r = new FileReader();
                          r.onload = ev => addItemPhoto(item.id, ev.target!.result as string);
                          r.readAsDataURL(f); e.target.value = "";
                        }} />
                      <div className="p-1 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 text-blue-400/80 hover:text-blue-300 transition">
                        <Camera size={12} />
                      </div>
                    </label>
                  )}
                </div>
                {/* Per-item photo thumbnails */}
                {(item.photos || []).length > 0 && (
                  <div className="mt-1.5 flex gap-1.5 flex-wrap">
                    {(item.photos || []).map((p, pi) => (
                      <div key={p.id || pi} className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                        <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={item.notes || ""}
                  onChange={e => updateNotes(item.id, e.target.value)}
                  placeholder="Add note..."
                  className="mt-1 w-full bg-transparent border-0 border-b border-white/10 text-xs text-white/50 placeholder-white/20 focus:outline-none focus:border-white/30 py-0.5"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobDetailView({ job, customer, onBack, onUpdateJob, toast, companyName = "the company", onComplete, perms: permsOverride }: {
  job: Job; customer?: Customer; onBack: () => void;
  onUpdateJob: (patch: Partial<Job>) => void; toast: (msg: string, tone?: any) => void;
  companyName?: string; onComplete?: () => void; perms?: Record<string, boolean>;
}) {
  const effPerms = { ...DEFAULT_PERMISSIONS, ...(permsOverride || {}) };
  const [note, setNote] = useState("");
  const [, forceTick] = useState(0);
  const [showSignOff, setShowSignOff] = useState(false);
  const [signerName, setSignerName] = useState("");

  useEffect(() => {
    if (!job.clockInAt) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [job.clockInAt]);

  const liveDisplay = (() => {
    if (!job.clockInAt) return null;
    const total = Math.floor((Date.now() - job.clockInAt) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
  })();

  const clockIn = () => { onUpdateJob({ clockInAt: Date.now() }); toast("Clocked in ✓"); };
  const clockOut = () => {
    if (!job.clockInAt) return;
    const hrs = Math.round((Date.now() - job.clockInAt) / 36000) / 100;
    onUpdateJob({ clockInAt: null, loggedHours: Math.round(((Number(job.loggedHours) || 0) + hrs) * 100) / 100 });
    toast(`+${hrs}h logged`);
  };

  const addPhoto = (type: "before" | "after", dataUrl: string) => {
    const newPhoto = { id: uid(), type, caption: (type === "before" ? "Before" : "After") + " — " + today(), dataUrl, uploadedAt: today() };
    onUpdateJob({ photos: [...(job.photos || []), newPhoto] });
    toast(type === "before" ? "Before photo added" : "After photo added");
  };

  const addVideo = (file: File) => {
    const MAX_MB = 50;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast(`Video exceeds ${MAX_MB}MB limit — trim to under 30 seconds`, "red");
      return;
    }
    const r = new FileReader();
    r.onload = ev => {
      const dataUrl = ev.target!.result as string;
      // Check duration via a transient video element
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.onloadedmetadata = () => {
        URL.revokeObjectURL(vid.src);
        if (vid.duration > 30) {
          toast("Video exceeds 30 seconds — please trim it first", "red");
          return;
        }
        onUpdateJob({ videos: [...(job.videos || []), { id: uid(), dataUrl, caption: "Field video", addedAt: today() }] });
        toast("Video added ✓");
      };
      vid.src = URL.createObjectURL(file);
    };
    r.readAsDataURL(file);
  };

  const addNote = () => {
    if (!note.trim()) return;
    const entry = { id: uid(), type: "note" as const, date: today(), note: note.trim() };
    onUpdateJob({ commLog: [...(job.commLog || []), entry] });
    setNote("");
    toast("Note added");
  };

  const saveSignOff = () => {
    if (!signerName.trim()) return;
    onUpdateJob({ signOff: { signerName: signerName.trim(), timestamp: new Date().toISOString() }, status: "completed" });
    toast("Sign-off saved ✓");
    setShowSignOff(false);
    if (onComplete) setTimeout(onComplete, 1200);
  };

  const beforePhoto = (job.photos || []).find(p => p.type === "before" && p.dataUrl);
  const afterPhoto = (job.photos || []).find(p => p.type === "after" && p.dataUrl);

  const preItems = job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS;
  const durItems = job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS;
  const postItems = job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS;
  const allItems = [...preItems, ...durItems, ...postItems];
  const allDone = allItems.length > 0 && allItems.every(i => i.done);

  // ── Customer sign-off overlay ─────────────────────────────────────────────
  if (showSignOff) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setShowSignOff(false)} className="p-2 rounded-xl hover:bg-white/10 text-white/60 -ml-2">
            <ChevronLeft size={20} />
          </button>
          <div className="font-semibold">Customer Sign-Off</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto space-y-4">
          {/* Services summary */}
          <Glass className="p-4 !bg-black/40">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-semibold">Services Completed</div>
            <div className="text-sm text-white/80">{job.notes || job.address}</div>
            {job.amount > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-white/50 text-sm">Total</span>
                <span className="text-xl font-black text-green-400">{fmt(job.amount)}</span>
              </div>
            )}
          </Glass>

          {/* Before / After photos */}
          {(beforePhoto || afterPhoto) && (
            <Glass className="p-4 !bg-black/40">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-semibold">Before / After</div>
              {beforePhoto && afterPhoto ? (
                <BeforeAfterSlider before={beforePhoto.dataUrl} after={afterPhoto.dataUrl} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {beforePhoto && <div className="rounded-xl overflow-hidden aspect-video"><img src={beforePhoto.dataUrl} alt="Before" className="w-full h-full object-cover" /></div>}
                  {afterPhoto && <div className="rounded-xl overflow-hidden aspect-video"><img src={afterPhoto.dataUrl} alt="After" className="w-full h-full object-cover" /></div>}
                </div>
              )}
            </Glass>
          )}

          {/* Legal disclaimer */}
          <Glass className="p-4 !bg-white/5 !border-white/10">
            <div className="flex items-start gap-2 mb-3">
              <Shield size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-white/60 leading-relaxed">
                I confirm that all services have been completed to my satisfaction. I accept the work as described above and acknowledge that <span className="text-white font-medium">{companyName}</span> is not liable for pre-existing conditions documented in the pre-job checklist.
              </div>
            </div>
          </Glass>

          {/* Signature input */}
          <Glass className="p-4 !bg-black/40">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-semibold flex items-center gap-1">
              <PenLine size={11} />Digital Signature — Type your full name
            </div>
            <input
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Full name..."
              className="w-full bg-transparent border-b-2 border-red-600/40 focus:border-red-500 text-white text-lg py-2 focus:outline-none placeholder-white/20"
            />
            {signerName.trim() && (
              <div className="mt-3 p-3 bg-white/5 rounded-xl text-center">
                <div className="text-white/40 text-[10px] uppercase mb-1">Signature Preview</div>
                <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }} className="text-2xl text-white/80">{signerName}</div>
                <div className="text-[10px] text-white/30 mt-2">{new Date().toLocaleString()}</div>
              </div>
            )}
          </Glass>

          <GBtn onClick={saveSignOff} disabled={!signerName.trim()} className="w-full !justify-center !py-3">
            <CheckCircle size={16} />Sign & Save
          </GBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white -ml-2">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{job.address}</div>
          <div className="text-xs text-white/50">{job.scheduledDate} {job.scheduledTime ? "· " + job.scheduledTime : ""}</div>
        </div>
        <div className={"px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide " +
          (job.status === "completed" ? "bg-green-900/40 text-green-300" :
           job.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
           "bg-blue-900/40 text-blue-300")}>
          {job.status.replace("_", " ")}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Customer info */}
        {customer && (
          <Glass className="p-4 !bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-bold flex-shrink-0">
                {customer.firstName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{customer.firstName} {customer.lastName}</div>
                {customer.phone && (
                  <a href={"tel:" + customer.phone} className="text-sm text-blue-400 flex items-center gap-1 mt-0.5">
                    <Phone size={11} />{customer.phone}
                  </a>
                )}
              </div>
              {customer.phone && (
                <a href={"https://maps.google.com/?q=" + encodeURIComponent(job.address)} target="_blank" rel="noreferrer"
                  className="p-2 rounded-xl bg-blue-950/30 border border-blue-700/30 text-blue-400">
                  <MapPin size={14} />
                </a>
              )}
            </div>
            {customer.gateCode && <div className="mt-2 text-xs text-yellow-400/80">🔐 Gate code: {customer.gateCode}</div>}
            {customer.hasDog && <div className="mt-0.5 text-xs text-orange-400/80">🐕 Dog on property{customer.dogName ? ` — ${customer.dogName}` : ""}</div>}
          </Glass>
        )}

        {/* Clock in/out */}
        <Glass className={"p-4 " + (job.clockInAt ? "!bg-green-950/20 !border-green-700/40" : "!bg-black/40")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Time Tracking</div>
              {job.clockInAt ? (
                <div className="font-mono text-2xl font-bold text-green-400">{liveDisplay}</div>
              ) : (
                <div className="text-sm text-white/60">
                  Logged: <span className="text-white font-semibold">{job.loggedHours || 0}h</span>
                  {job.duration ? ` · est ${job.duration}h` : ""}
                </div>
              )}
            </div>
            {effPerms.can_clock_in && (
              job.clockInAt ? (
                <GBtn variant="danger" onClick={clockOut} className="!gap-2">
                  <Square size={14} />Clock Out
                </GBtn>
              ) : (
                <GBtn onClick={clockIn} className="!gap-2">
                  <Play size={14} />Clock In
                </GBtn>
              )
            )}
          </div>
        </Glass>

        {/* Photos & Videos */}
        <Glass className="p-4 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Image size={12} />Photos & Videos
          </div>
          {beforePhoto && afterPhoto && (
            <div className="mb-3">
              <BeforeAfterSlider before={beforePhoto.dataUrl} after={afterPhoto.dataUrl} />
            </div>
          )}
          {effPerms.can_upload_photos && (
            <div className="grid grid-cols-3 gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader();
                    r.onload = ev => addPhoto("before", ev.target!.result as string);
                    r.readAsDataURL(f); e.target.value = "";
                  }} />
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs font-medium transition text-center">
                  <Plus size={13} /><span>📷 Before</span>
                </div>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader();
                    r.onload = ev => addPhoto("after", ev.target!.result as string);
                    r.readAsDataURL(f); e.target.value = "";
                  }} />
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-green-950/30 hover:bg-green-900/40 border border-green-700/40 text-green-300 text-xs font-medium transition text-center">
                  <Plus size={13} /><span>✨ After</span>
                </div>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="video/*" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) addVideo(f); e.target.value = ""; }} />
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs font-medium transition text-center">
                  <Video size={13} /><span>Video</span>
                </div>
              </label>
            </div>
          )}
          {(job.photos || []).length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(job.photos || []).map((p, i) => p.dataUrl ? (
                <div key={p.id || i} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                  <div className={"absolute top-1 left-1 text-[8px] px-1 py-0.5 rounded font-bold uppercase " +
                    (p.type === "before" ? "bg-blue-600/90" : "bg-green-600/90")}>{p.type}</div>
                </div>
              ) : null)}
            </div>
          )}
          {(job.videos || []).length > 0 && (
            <div className="mt-2 space-y-2">
              {(job.videos || []).map((v, i) => (
                <div key={v.id || i} className="rounded-xl overflow-hidden bg-black/60">
                  <video src={v.dataUrl} controls className="w-full rounded-xl" style={{ maxHeight: 200 }} />
                  {v.addedAt && <div className="text-[10px] text-white/30 px-2 pb-1">{v.addedAt}</div>}
                </div>
              ))}
            </div>
          )}
        </Glass>

        {/* Checklists */}
        <Glass className="p-4 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1">
            <CheckSquare size={12} />Job Checklists
          </div>
          <PortalChecklistSection
            title="Pre-Job" emoji="🔵" allowPhotos
            items={preItems}
            onUpdate={items => onUpdateJob({ preChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
          />
          <PortalChecklistSection
            title="During Job" emoji="🟡"
            items={durItems}
            onUpdate={items => onUpdateJob({ duringChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
          />
          <PortalChecklistSection
            title="Post-Job" emoji="🟢"
            items={postItems}
            onUpdate={items => onUpdateJob({ postChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
          />
        </Glass>

        {/* Customer sign-off */}
        {job.signOff ? (
          <Glass className="p-4 !bg-green-950/20 !border-green-700/30">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-green-400" />
              <div className="text-xs font-semibold text-green-300">Customer Signed Off</div>
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }} className="text-lg text-white/80 mt-1">{job.signOff.signerName}</div>
            <div className="text-[10px] text-white/30 mt-1">{new Date(job.signOff.timestamp).toLocaleString()}</div>
            {onComplete && (
              <button onClick={onComplete}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-green-900/30 hover:bg-green-800/40 border border-green-700/30 text-green-300 text-sm font-semibold transition">
                <ChevronLeft size={14} />Back to Jobs
              </button>
            )}
          </Glass>
        ) : effPerms.can_get_signoff && allDone ? (
          <GBtn onClick={() => setShowSignOff(true)} className="w-full !justify-center !py-3 !bg-gradient-to-r !from-green-700 !to-green-900 !border-green-600/50">
            <PenLine size={16} />Get Customer Sign-Off
          </GBtn>
        ) : effPerms.can_get_signoff ? (
          <div className="text-center text-xs text-white/30 py-2">Complete all checklist items to get customer sign-off</div>
        ) : null}

        {/* Internal notes */}
        {job.internalNotes && (
          <Glass className="p-4 !bg-yellow-950/20 !border-yellow-700/30">
            <div className="text-xs text-yellow-400/80 uppercase tracking-wider mb-1 font-semibold">📋 Site Notes</div>
            <div className="text-sm text-white/80">{job.internalNotes}</div>
          </Glass>
        )}

        {/* Notes — view existing always, add only if permitted */}
        {(effPerms.can_add_notes || (job.commLog || []).length > 0) && (
          <Glass className="p-4 !bg-black/40">
            {effPerms.can_add_notes && (
              <>
                <div className="text-xs text-white/60 uppercase tracking-wider mb-2">Add Note</div>
                <GTxt rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Report an issue, leave a status update..." />
                <GBtn onClick={addNote} className="mt-2 w-full !justify-center" disabled={!note.trim()}>
                  <Plus size={14} />Add Note
                </GBtn>
              </>
            )}
            {(job.commLog || []).length > 0 && (
              <div className={effPerms.can_add_notes ? "mt-3 space-y-1.5 max-h-40 overflow-y-auto" : "space-y-1.5 max-h-40 overflow-y-auto"}>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Notes</div>
                {[...(job.commLog || [])].reverse().slice(0, 5).map(e => (
                  <div key={e.id} className="text-xs p-2 bg-white/5 rounded-lg">
                    <div className="text-white/80">{e.note}</div>
                    <div className="text-white/30 mt-0.5">{e.date}</div>
                  </div>
                ))}
              </div>
            )}
          </Glass>
        )}
      </div>
    </div>
  );
}

// ── Owner Team Portal ─────────────────────────────────────────────────────────
function OwnerTeamPortal({ jobs, employees, customers, onClose }: {
  jobs: Job[]; employees: Employee[]; customers: Customer[]; onClose: () => void;
}) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const todayStr = today();

  const viewEmp = selectedEmpId === "all" ? null : employees.find(e => e.id === selectedEmpId);
  const visibleJobs = selectedEmpId === "all"
    ? jobs
    : jobs.filter(j => (j.crew || []).includes(selectedEmpId));
  const todayJobs = visibleJobs.filter(j => j.scheduledDate === todayStr);

  if (selectedJobId) {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) { setSelectedJobId(null); return null; }
    const customer = customers.find(c => c.id === job.customerId);
    return (
      <JobDetailView
        job={job}
        customer={customer}
        onBack={() => setSelectedJobId(null)}
        onUpdateJob={() => {}}
        toast={() => {}}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white -ml-2">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 font-semibold">Team Portal</div>
        <select
          value={selectedEmpId}
          onChange={e => setSelectedEmpId(e.target.value)}
          className="bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/50"
        >
          <option value="all">All Employees</option>
          {employees.filter(e => e.status === "active").map(e => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
          ))}
        </select>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto space-y-4">
        {/* Employee cards */}
        {selectedEmpId === "all" && (
          <div className="grid grid-cols-2 gap-3">
            {employees.filter(e => e.status === "active").map(emp => {
              const empJobs = jobs.filter(j => (j.crew || []).includes(emp.id));
              const empTodayJobs = empJobs.filter(j => j.scheduledDate === todayStr);
              const active = empJobs.find(j => j.clockInAt);
              return (
                <button key={emp.id} onClick={() => setSelectedEmpId(emp.id)}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-red-600/30 text-left transition">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-bold text-sm mb-2">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div className="font-semibold text-sm">{emp.firstName} {emp.lastName}</div>
                  <div className="text-[10px] text-white/40 capitalize mt-0.5">{emp.role}</div>
                  <div className="mt-2 text-xs text-white/50">{empTodayJobs.length} job{empTodayJobs.length !== 1 ? "s" : ""} today</div>
                  {active && <div className="text-[10px] text-green-400 animate-pulse mt-1">● Clocked in</div>}
                </button>
              );
            })}
          </div>
        )}

        {/* Today's jobs for selected employee */}
        <div>
          <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
            <span>{viewEmp ? `${viewEmp.firstName}'s Jobs Today` : "Today's Jobs"}</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{todayJobs.length}</span>
          </div>
          {todayJobs.length === 0 ? (
            <div className="text-center py-8 text-white/30 text-sm">No jobs today</div>
          ) : (
            <div className="space-y-2">
              {todayJobs.map(j => {
                const c = customers.find(x => x.id === j.customerId);
                return (
                  <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                    className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-red-600/30 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{j.address}</div>
                        {c && <div className="text-xs text-white/50">{c.firstName} {c.lastName}</div>}
                      </div>
                      <div className={"text-[10px] px-2 py-0.5 rounded-full font-bold uppercase " +
                        (j.status === "completed" ? "bg-green-900/40 text-green-300" :
                         j.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
                         "bg-blue-900/40 text-blue-300")}>
                        {j.status.replace("_", " ")}
                      </div>
                    </div>
                    <div className="text-xs text-white/40 mt-1">{j.scheduledTime || "All day"}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming for selected employee */}
        {viewEmp && (
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3">All Assigned Jobs</div>
            <div className="space-y-2">
              {visibleJobs.filter(j => j.scheduledDate > todayStr).slice(0, 10).map(j => {
                const c = customers.find(x => x.id === j.customerId);
                return (
                  <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                    className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{j.address}</div>
                      {c && <div className="text-xs text-white/40">{c.firstName} {c.lastName}</div>}
                    </div>
                    <div className="text-xs text-white/40 flex-shrink-0">{j.scheduledDate}</div>
                  </button>
                );
              })}
              {visibleJobs.filter(j => j.scheduledDate > todayStr).length === 0 && (
                <div className="text-center py-6 text-sm text-white/30">No upcoming jobs</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export function EmployeePortal({ empSession, setEmpSession, jobs, setJobs, employees, customers, settings, toast, isOwnerView = false, onClose = () => {} }: {
  empSession: any; setEmpSession: (s: any) => void;
  jobs: Job[]; setJobs: (fn: (prev: Job[]) => Job[]) => void;
  employees: Employee[]; customers: Customer[];
  settings: AppSettings; toast: (msg: string, tone?: any) => void;
  isOwnerView?: boolean; onClose?: () => void;
}) {
  const [tab, setTab] = useState<"today" | "calendar" | "jobs" | "pay" | "google">("today");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [calMode, setCalMode] = useState<"week" | "month">("week");
  const [calSelectedDate, setCalSelectedDate] = useState(today());
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calMonthOffset, setCalMonthOffset] = useState(0);
  const [driveTimes, setDriveTimes] = useState<Record<string, string>>({});
  const [completionNotif, setCompletionNotif] = useState<{ message: string; nextJobId?: string } | null>(null);
  const fetchedDriveIds = useRef(new Set<string>());
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginFirst, setLoginFirst] = useState("");
  const [loginLast, setLoginLast] = useState("");
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRecord, setInviteRecord] = useState<any>(null);

  // Capture hash synchronously on first render, before App.tsx's hash-sync effect can strip the invite param
  const capturedHashRef = useRef(window.location.hash);

  // Parse invite code from URL hash — e.g. #/portal?invite=ABC123
  useEffect(() => {
    const hash = capturedHashRef.current;
    const match = hash.match(/[?&]invite=([A-Z0-9]+)/i);
    console.log("INVITE CODE CAPTURED:", match ? match[1] : "(none)", "from hash:", hash);
    if (!match) return;
    const code = match[1];
    setInviteCode(code);

    const applyInvite = (inv: any) => {
      if (!inv) { setLoginError("Invalid or expired invite link."); return; }
      if (inv.used) { setLoginError("This invite has already been used. Please sign in instead."); return; }
      // Normalise field names — Supabase uses snake_case, localStorage uses camelCase
      const firstName = inv.firstName || (inv.employee_name || "").split(" ")[0] || "";
      const lastName = inv.lastName || (inv.employee_name || "").split(" ").slice(1).join(" ") || "";
      const email = inv.email || inv.employee_email || "";
      const role = inv.role || "Technician";
      const hourlyRate = inv.hourlyRate ?? inv.hourly_rate ?? 0;
      const normalised = { ...inv, firstName, lastName, email, role, hourlyRate };
      setInviteRecord(normalised);
      setLoginEmail(email);
      setLoginFirst(firstName);
      setLoginLast(lastName);
      setLoginMode("register");
    };

    const lookup = async () => {
      // If the user already has a session, skip invite processing — they're registered.
      // Never call signOut() here: Supabase fires the SIGNED_OUT event asynchronously,
      // which can race with a SIGNED_IN that follows, killing the just-created session.
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) return;

      // 1. Try Supabase first — works from any browser/device
      try {
        const { data, error } = await (supabase as any)
          .from("invites")
          .select("*")
          .eq("code", code)
          .maybeSingle();
        if (!error) {
          applyInvite(data);
          return;
        }
        // If the error is NOT "table doesn't exist", surface it
        if (!(error.message || "").includes("does not exist")) {
          applyInvite(null);
          return;
        }
        // Table doesn't exist — fall through to localStorage
      } catch { /* fall through */ }

      // 2. Fallback: localStorage (same browser as owner)
      try {
        const stored: any[] = JSON.parse(localStorage.getItem("smocks.invites") || "[]");
        const inv = stored.find((i: any) => i.code === code);
        applyInvite(inv ?? null);
      } catch {
        applyInvite(null);
      }
    };

    lookup();
  }, []);

  const myEmployee = empSession
    ? (employees.find(e => (e as any).user_id === empSession.user.id) ||
       employees.find(e => e.email?.toLowerCase() === empSession.user.email?.toLowerCase()) ||
       null)
    : null;

  // Merge owner-set permissions with defaults (all-on for existing employees with no permissions field)
  const perms: Record<string, boolean> = { ...DEFAULT_PERMISSIONS, ...((myEmployee as any)?.permissions || {}) };

  const myJobs = myEmployee
    ? jobs.filter(j => (j.crew || []).includes(myEmployee.id))
    : [];

  const todayStr = today();
  const todayJobs = myJobs.filter(j => j.scheduledDate === todayStr);

  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
  })();
  const weekEnd = (() => {
    const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().slice(0, 10);
  })();
  const weekJobs = myJobs.filter(j => j.scheduledDate >= weekStart && j.scheduledDate <= weekEnd);

  const weekHours = weekJobs.reduce((s, j) => s + Number(j.loggedHours || 0), 0);
  const weekJobsDone = weekJobs.filter(j => j.status === "completed").length;
  const weekPay = weekHours * (myEmployee?.hourlyRate || 0);

  const upNextJob = [...myJobs]
    .filter(j => j.scheduledDate >= todayStr && j.status !== "completed")
    .sort((a, b) => {
      const da = a.scheduledDate + (a.scheduledTime || "23:59");
      const db = b.scheduledDate + (b.scheduledTime || "23:59");
      return da.localeCompare(db);
    })[0] ?? null;
  const upNextCustomer = upNextJob ? customers.find(c => c.id === upNextJob.customerId) : null;

  const payStart = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); })();
  const periodJobs = myJobs.filter(j => j.status === "completed" && j.scheduledDate >= payStart);
  const periodHours = periodJobs.reduce((s, j) => s + Number(j.loggedHours || j.duration || 0), 0);
  const estimatedPay = periodHours * (myEmployee?.hourlyRate || 0);

  const activeClockJob = myJobs.find(j => j.clockInAt);

  const updateJob = (jobId: string, patch: Partial<Job>) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
  };

  // Tick every second when any job is clocked in so card timers update live
  const [, setCardTick] = useState(0);
  useEffect(() => {
    if (!activeClockJob) return;
    const t = setInterval(() => setCardTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [activeClockJob?.id]);

  // Fetch drive time via Maps JS DistanceMatrixService (loaded by AddressAutocomplete)
  const fetchDriveTime = (jobId: string, address: string) => {
    if (fetchedDriveIds.current.has(jobId)) return;
    fetchedDriveIds.current.add(jobId);
    const loc = userLocationRef.current;
    if (!loc || !settings.googleMapsKey) return;
    const gm = (window as any).google?.maps;
    if (!gm?.DistanceMatrixService) return;
    try {
      const svc = new gm.DistanceMatrixService();
      svc.getDistanceMatrix(
        { origins: [loc], destinations: [address], travelMode: gm.TravelMode.DRIVING },
        (result: any, status: string) => {
          if (status === "OK") {
            const dur: string | undefined = result?.rows?.[0]?.elements?.[0]?.duration?.text;
            if (dur) setDriveTimes(prev => ({ ...prev, [jobId]: dur }));
          }
        }
      );
    } catch { /* silently fail */ }
  };

  // Get user location once, then fire drive-time lookups for upcoming jobs
  useEffect(() => {
    if (!settings.googleMapsKey) return;
    navigator.geolocation.getCurrentPosition(pos => {
      userLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      myJobs.filter(j => j.scheduledDate >= todayStr).forEach(j => fetchDriveTime(j.id, j.address));
    }, () => {});
  }, []); // run once on mount

  // Navigate back after job completion, show next-job notification
  const handleJobComplete = () => {
    const nextJob = [...myJobs]
      .filter(j => j.id !== selectedJobId && j.scheduledDate >= todayStr && j.status !== "completed")
      .sort((a, b) => {
        const da = a.scheduledDate + (a.scheduledTime || "23:59");
        const db = b.scheduledDate + (b.scheduledTime || "23:59");
        return da.localeCompare(db);
      })[0] ?? null;
    setSelectedJobId(null);
    setTab("jobs");
    if (nextJob) {
      const nc = customers.find(c => c.id === nextJob.customerId);
      const name = nc ? `${nc.firstName} ${nc.lastName}` : "";
      setCompletionNotif({
        message: `Job complete! Next: ${name ? name + " · " : ""}${nextJob.address}`,
        nextJobId: nextJob.id,
      });
      setTimeout(() => setCompletionNotif(null), 6000);
    } else {
      toast("✅ All done! No more jobs today.");
    }
  };

  const doSignOut = async () => {
    await supabase.auth.signOut();
    setEmpSession(null);
  };

  const doLogin = async () => {
    setLoginLoading(true); setLoginError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd });
    setLoginLoading(false);
    if (error) { setLoginError(error.message); return; }

    const session = data.session!;
    const metaRole = session.user.user_metadata?.role;
    const email = session.user.email || "";

    console.log("doLogin: checking email", email, "against employees:", employees.map(e => e.email));
    console.log("doLogin: user metadata role:", metaRole);

    // Anyone who successfully completes signInWithPassword is an email/password user — treat as employee.
    // Google OAuth users cannot reach this path. Never sign them out here.
    const matchedEmployee = employees.find(e => e.email?.toLowerCase() === email.toLowerCase());

    // Repair missing role metadata so App.tsx auth-state-change recognises them on reload
    if (!metaRole) {
      const fixedRole = matchedEmployee
        ? ((matchedEmployee as any).role?.toLowerCase().includes("manager") ? "manager" : "technician")
        : "technician";
      supabase.auth.updateUser({ data: { role: fixedRole } }).catch(() => {});
    }

    // Link the employee record to this Supabase user ID so lookups by user_id work
    if (matchedEmployee && !(matchedEmployee as any).user_id) {
      (supabase as any).from("employees")
        .update({ user_id: session.user.id })
        .eq("id", matchedEmployee.id)
        .then(() => {}).catch(() => {});
    }

    // If they arrived via invite and have no employee record yet, create one now
    if (!matchedEmployee && inviteRecord) {
      const authRole = inviteRecord.role?.toLowerCase().includes("manager") ? "manager" : "technician";
      (supabase as any).from("employees").insert({
        firstName: inviteRecord.firstName || "",
        lastName: inviteRecord.lastName || "",
        email: inviteRecord.email || email,
        role: authRole === "manager" ? "Manager" : "Technician",
        hourlyRate: inviteRecord.hourlyRate ?? 0,
        user_id: session.user.id,
        status: "active",
      }).then(() => {}).catch(() => {});
    }

    setEmpSession(session);
    toast("Welcome back!");
  };

  const doRegister = async () => {
    if (!loginFirst.trim() || !loginLast.trim()) { setLoginError("Enter your full name"); return; }
    if (loginPwd.length < 6) { setLoginError("Password must be at least 6 characters"); return; }
    // Validate invite email matches
    if (inviteCode && inviteRecord && loginEmail.toLowerCase() !== inviteRecord.email.toLowerCase()) {
      setLoginError(`This invite was sent to ${inviteRecord.email}. Please use that email address.`);
      return;
    }
    setLoginLoading(true); setLoginError("");
    const authRole = inviteRecord?.role?.toLowerCase().includes("manager") ? "manager" : "technician";
    const { error } = await supabase.auth.signUp({
      email: loginEmail, password: loginPwd,
      options: { data: { role: authRole, firstName: loginFirst, lastName: loginLast } },
    });
    if (error) { setLoginLoading(false); setLoginError(error.message); return; }
    // Auto sign-in after registration
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd });
    setLoginLoading(false);
    if (!signInErr && signInData.session) {
      const newUserId = signInData.session.user.id;
      const newEmail = signInData.session.user.email || "";

      // Mark invite as used — Supabase first, then localStorage
      if (inviteCode) {
        try {
          await (supabase as any)
            .from("invites")
            .update({ used: true, used_at: new Date().toISOString(), used_by: newUserId })
            .eq("code", inviteCode);
        } catch { /* table may not exist */ }
        try {
          const stored: any[] = JSON.parse(localStorage.getItem("smocks.invites") || "[]");
          localStorage.setItem("smocks.invites", JSON.stringify(
            stored.map(i => i.code === inviteCode ? { ...i, used: true } : i)
          ));
        } catch { /* ignore */ }
      }

      // Link employee record to the new Supabase user ID so email-less lookups work.
      // Try by invite's employee ID first, then fall back to email match.
      const invEmpId = inviteRecord?.employeeId || inviteRecord?.employee_id;
      try {
        if (invEmpId) {
          await (supabase as any).from("employees").update({ user_id: newUserId }).eq("id", invEmpId);
        } else if (newEmail) {
          await (supabase as any).from("employees").update({ user_id: newUserId }).eq("email", newEmail);
        }
      } catch { /* employees table may not have user_id column yet */ }

      setEmpSession(signInData.session);
      toast("Welcome! Account created ✓");
    } else {
      toast("Account created! Please sign in.");
      setLoginMode("login");
    }
  };

  // ── Owner view — shown when owner clicks "Team Portal" in sidebar ────────
  if (isOwnerView) {
    return (
      <OwnerTeamPortal
        jobs={jobs}
        employees={employees}
        customers={customers}
        onClose={onClose}
      />
    );
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!empSession) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-2xl font-black">S</span>
            </div>
            <div className="text-xl font-bold">{settings.companyName || "Smock's OS"}</div>
            <div className="text-sm text-white/50 mt-1">{inviteRecord ? "Create Your Crew Account" : "Employee Portal"}</div>
          </div>

          <div className="space-y-3">
            {/* Invite banner */}
            {inviteRecord && (
              <div className="p-3 rounded-xl bg-green-950/30 border border-green-700/30">
                <div className="text-xs text-green-300 font-semibold mb-0.5">You've been invited!</div>
                <div className="text-xs text-white/50">Create your account below to access your schedule and jobs.</div>
              </div>
            )}
            {inviteCode && !inviteRecord && loginError && (
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-700/30 text-xs text-red-300">{loginError}</div>
            )}
            {loginMode === "register" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">First Name</label>
                  <GInput value={loginFirst} onChange={e => setLoginFirst(e.target.value)} placeholder="Jane" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Last Name</label>
                  <GInput value={loginLast} onChange={e => setLoginLast(e.target.value)} placeholder="Smith" />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Work Email</label>
              <GInput type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                placeholder="you@example.com" onKeyDown={e => e.key === "Enter" && (loginMode === "login" ? doLogin() : doRegister())} />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Password</label>
              <GInput type="password" value={loginPwd} onChange={e => setLoginPwd(e.target.value)}
                placeholder="••••••••" onKeyDown={e => e.key === "Enter" && (loginMode === "login" ? doLogin() : doRegister())} />
            </div>
            {loginError && !(inviteCode && !inviteRecord) && (
              <div className="p-3 bg-red-950/40 border border-red-700/50 rounded-xl text-sm text-red-300">
                {loginError}
              </div>
            )}
            <GBtn onClick={loginMode === "login" ? doLogin : doRegister}
              disabled={loginLoading || !loginEmail || !loginPwd}
              className="w-full !justify-center !py-3">
              {loginLoading ? "Please wait…" : loginMode === "login" ? "Sign In" : "Create Account"}
            </GBtn>
            <button onClick={() => { setLoginMode(m => m === "login" ? "register" : "login"); setLoginError(""); }}
              className="w-full text-center text-sm text-white/40 hover:text-white/70 transition">
              {loginMode === "login" ? "New here? Create an account →" : "← Back to sign in"}
            </button>
          </div>
          <div className="mt-8 text-center text-xs text-white/20">
            Ask your manager for your portal access credentials
          </div>
        </div>
      </div>
    );
  }

  // ── Account not linked ────────────────────────────────────────────────────
  if (!myEmployee) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={40} className="text-yellow-400 mb-4" />
        <div className="text-lg font-bold mb-2">Account Not Linked</div>
        <div className="text-sm text-white/50 mb-6 max-w-xs">
          Your account ({empSession.user.email}) isn't linked to an employee record yet. Ask your manager to add your email in the Employees section.
        </div>
        <GBtn onClick={doSignOut} variant="ghost"><LogOut size={14} className="inline mr-1.5" />Sign Out</GBtn>
      </div>
    );
  }

  // ── Selected job detail ───────────────────────────────────────────────────
  if (selectedJobId) {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) { setSelectedJobId(null); return null; }
    const customer = customers.find(c => c.id === job.customerId);
    return (
      <JobDetailView
        job={job}
        customer={customer}
        onBack={() => setSelectedJobId(null)}
        onUpdateJob={patch => updateJob(selectedJobId, patch)}
        toast={toast}
        companyName={settings.companyName || "Smock's Pressure Washing"}
        onComplete={handleJobComplete}
        perms={perms}
      />
    );
  }

  // ── Portal ────────────────────────────────────────────────────────────────
  const role = empSession.user.user_metadata?.role || "technician";

  const JobCard = ({ job }: { job: Job }) => {
    const customer = customers.find(c => c.id === job.customerId);
    const preItems = job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS;
    const postItems = job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS;
    const allItems = [...preItems, ...(job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS), ...postItems];
    const doneCount = allItems.filter(i => i.done).length;

    const clockInCard = (e: React.MouseEvent) => {
      e.stopPropagation();
      updateJob(job.id, { clockInAt: Date.now(), status: "in_progress" });
      toast("Clocked in ✓");
    };
    const clockOutCard = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!job.clockInAt) return;
      const hrs = Math.round((Date.now() - job.clockInAt) / 36000) / 100;
      updateJob(job.id, { clockInAt: null, loggedHours: Math.round(((Number(job.loggedHours) || 0) + hrs) * 100) / 100 });
      toast(`+${hrs}h logged`);
    };

    const elapsedSec = job.clockInAt ? Math.floor((Date.now() - job.clockInAt) / 1000) : 0;
    const timerDisplay = job.clockInAt
      ? [Math.floor(elapsedSec / 3600), Math.floor((elapsedSec % 3600) / 60), elapsedSec % 60].map(n => String(n).padStart(2, "0")).join(":")
      : null;

    const isNextUp = job.id === completionNotif?.nextJobId;
    return (
      <div
        className={"rounded-2xl border transition " + (job.clockInAt ? "bg-green-950/10 border-green-700/30" : isNextUp ? "bg-blue-950/15 border-blue-600/40" : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-red-600/20")}
      >
        {isNextUp && (
          <div className="px-4 pt-2.5 pb-0">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide animate-pulse">▶ Up Next</span>
          </div>
        )}
        {/* Clickable main area */}
        <button onClick={() => setSelectedJobId(job.id)} className="w-full text-left p-4 pb-3">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{job.address}</div>
              {customer && <div className="text-xs text-white/50">{customer.firstName} {customer.lastName}</div>}
            </div>
            <div className={"text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 " +
              (job.status === "completed" ? "bg-green-900/40 text-green-300" :
               job.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
               "bg-blue-900/40 text-blue-300")}>
              {job.status.replace("_", " ")}
            </div>
          </div>
          <div className="text-xs text-white/40">
            {job.scheduledDate}{job.scheduledTime ? " · " + job.scheduledTime : ""}
            {job.loggedHours ? <span className="ml-2 text-white/50">{job.loggedHours}h logged</span> : null}
          </div>
          {allItems.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: (doneCount / allItems.length * 100) + "%" }} />
              </div>
              <span className="text-[10px] text-white/40">{doneCount}/{allItems.length}</span>
            </div>
          )}
        </button>
        {/* Actions row: Directions + Clock in/out */}
        <div className="px-4 pb-3 flex items-center gap-2 border-t border-white/5 pt-2.5">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`}
            target="_blank" rel="noreferrer"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-300 transition flex-shrink-0">
            <Navigation size={10} />Directions
          </a>
          {driveTimes[job.id] && (
            <span className="text-[10px] text-white/40 flex-shrink-0">🚗 ~{driveTimes[job.id]}</span>
          )}
          <div className="flex-1" />
          {perms.can_clock_in ? (
            job.clockInAt ? (
              <>
                <div className="font-mono text-sm font-bold text-green-400 animate-pulse">{timerDisplay}</div>
                <button onClick={clockOutCard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-700/40 text-red-300 text-xs font-semibold transition">
                  <Square size={11} />Clock Out
                </button>
              </>
            ) : (
              job.status === "completed"
                ? <div className="text-xs text-white/30">Job complete</div>
                : (
                  <button onClick={clockInCard}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-950/50 hover:bg-green-900/60 border border-green-700/40 text-green-300 text-xs font-semibold transition">
                    <Play size={11} />Clock In
                  </button>
                )
            )
          ) : (
            job.status === "completed"
              ? <div className="text-xs text-white/30">Job complete</div>
              : <div className="text-xs text-white/30">{job.loggedHours ? `${job.loggedHours}h logged` : ""}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        {/* CrewBoss brand */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-900/40">
            <span className="text-[11px] font-black text-white tracking-tight">CB</span>
          </div>
          <span className="font-bold text-sm text-white tracking-tight">CrewBoss</span>
        </div>
        {/* Employee info + actions */}
        <div className="flex items-center gap-2.5">
          {activeClockJob && (
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-green-400 animate-pulse font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />On Job
            </div>
          )}
          <div className="text-right hidden xs:block">
            <div className="text-xs font-semibold text-white/80 leading-tight">{myEmployee.firstName} {myEmployee.lastName}</div>
            <div className="text-[10px] text-white/40 capitalize leading-tight">{myEmployee.role}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700/60 to-red-900/60 border border-red-700/30 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {myEmployee.firstName[0]}{myEmployee.lastName[0]}
          </div>
          <button onClick={doSignOut} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition flex-shrink-0" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {completionNotif && (
          <div className="px-4 pt-4 max-w-lg mx-auto">
            <div className="p-3 rounded-xl bg-green-950/40 border border-green-700/40 flex items-center gap-3">
              <span className="text-lg flex-shrink-0">✅</span>
              <div className="flex-1 text-sm text-green-300 min-w-0">{completionNotif.message}</div>
              <button onClick={() => setCompletionNotif(null)} className="text-white/30 hover:text-white/60 transition flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        <div className="p-4 max-w-lg mx-auto space-y-4">

          {/* Today tab */}
          {tab === "today" && <>
            {/* Welcome header */}
            <div className="pb-1">
              <div className="text-xl font-bold text-white">Welcome, {myEmployee.firstName}!</div>
              <div className="text-sm text-white/50 mt-0.5">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
            </div>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
              <Glass className="p-3 !bg-white/5 text-center">
                <div className="text-xl font-black text-white">{weekHours.toFixed(1)}<span className="text-[11px] font-normal text-white/40">h</span></div>
                <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Hours This<br/>Week</div>
              </Glass>
              <Glass className="p-3 !bg-white/5 text-center">
                <div className="text-xl font-black text-white">{weekJobsDone}</div>
                <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Jobs<br/>Done</div>
              </Glass>
              {perms.can_view_pay ? (
                <Glass className="p-3 !bg-green-950/20 !border-green-700/30 text-center">
                  <div className="text-xl font-black text-green-400">{fmt(weekPay)}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Est.<br/>Pay</div>
                </Glass>
              ) : (
                <Glass className="p-3 !bg-blue-950/20 !border-blue-700/30 text-center">
                  <div className="text-xl font-black text-blue-400">{todayJobs.length}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Today's<br/>Jobs</div>
                </Glass>
              )}
            </div>

            {/* Up Next highlight (only when next job is a future date, not today) */}
            {upNextJob && upNextJob.scheduledDate !== todayStr && (
              <div className="relative pt-3">
                <div className="absolute top-0 left-3 z-10 px-2.5 py-0.5 rounded-full bg-red-600 text-[10px] font-bold text-white uppercase tracking-wide shadow">
                  Up Next
                </div>
                <Glass className="p-4 !bg-blue-950/20 !border-blue-700/30">
                  <div className="font-semibold text-sm">{upNextJob.address}</div>
                  {upNextCustomer && <div className="text-xs text-white/50 mt-0.5">{upNextCustomer.firstName} {upNextCustomer.lastName}</div>}
                  <div className="text-xs text-white/40 mt-1">
                    {upNextJob.scheduledDate}{upNextJob.scheduledTime ? " · " + upNextJob.scheduledTime : ""}
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(upNextJob.address)}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 transition">
                    <Navigation size={11} />Get Directions
                  </a>
                </Glass>
              </div>
            )}

            {/* Today's jobs */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                <span>Today's Jobs</span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{todayJobs.length}</span>
              </div>
              {todayJobs.length === 0 ? (
                <div className="text-center py-10 text-white/30">
                  <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
                  <div>No jobs scheduled for today</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayJobs.map(j => <JobCard key={j.id} job={j} />)}
                </div>
              )}
            </div>

            {/* Upcoming this week */}
            {weekJobs.filter(j => j.scheduledDate > todayStr).length > 0 && (
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3">Upcoming This Week</div>
                <div className="space-y-2">
                  {weekJobs.filter(j => j.scheduledDate > todayStr).map(j => <JobCard key={j.id} job={j} />)}
                </div>
              </div>
            )}
          </>}

          {/* Calendar tab */}
          {tab === "calendar" && (() => {
            const calWeekDates = Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - d.getDay() + i + calWeekOffset * 7);
              return d.toISOString().slice(0, 10);
            });
            const calMonthBase = new Date();
            calMonthBase.setDate(1);
            calMonthBase.setMonth(calMonthBase.getMonth() + calMonthOffset);
            const calMonthYear = calMonthBase.getFullYear();
            const calMonthMonth = calMonthBase.getMonth();
            const calDaysInMonth = new Date(calMonthYear, calMonthMonth + 1, 0).getDate();
            const calFirstDay = new Date(calMonthYear, calMonthMonth, 1).getDay();
            const calMonthLabel = calMonthBase.toLocaleDateString("en-US", { month: "long", year: "numeric" });
            const calDayJobs = myJobs.filter(j => j.scheduledDate === calSelectedDate);

            return (
              <>
                {/* Week / Month toggle */}
                <div className="flex bg-white/5 rounded-xl p-1 mb-3">
                  <button onClick={() => setCalMode("week")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${calMode === "week" ? "bg-red-600 text-white" : "text-white/50 hover:text-white"}`}>
                    Week
                  </button>
                  <button onClick={() => setCalMode("month")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${calMode === "month" ? "bg-red-600 text-white" : "text-white/50 hover:text-white"}`}>
                    Month
                  </button>
                </div>

                {calMode === "week" && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => setCalWeekOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronLeft size={16} />
                      </button>
                      <div className="text-xs text-white/60 font-semibold">
                        {new Date(calWeekDates[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" – "}
                        {new Date(calWeekDates[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      <button onClick={() => setCalWeekOffset(o => o + 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {/* 7-day strip */}
                    <div className="grid grid-cols-7 gap-1 mb-4">
                      {calWeekDates.map(dateStr => {
                        const d = new Date(dateStr + "T12:00:00");
                        const dayJobs = myJobs.filter(j => j.scheduledDate === dateStr);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === calSelectedDate;
                        return (
                          <button key={dateStr} onClick={() => setCalSelectedDate(dateStr)}
                            className={`flex flex-col items-center py-2 rounded-xl transition ${isSelected ? "bg-red-600" : isToday ? "bg-red-950/40 border border-red-700/30" : "bg-white/5 hover:bg-white/10"}`}>
                            <div className={`text-[10px] ${isSelected || isToday ? "text-white/80" : "text-white/40"}`}>
                              {d.toLocaleDateString("en-US", { weekday: "narrow" })}
                            </div>
                            <div className={`text-sm font-bold leading-tight ${isSelected ? "text-white" : isToday ? "text-red-400" : "text-white/70"}`}>
                              {d.getDate()}
                            </div>
                            <div className="w-1.5 h-1.5 mt-0.5">
                              {dayJobs.length > 0 && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-red-400"}`} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Jobs for selected day */}
                    <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                      <span>{new Date(calSelectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                      {calDayJobs.length > 0 && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{calDayJobs.length}</span>}
                    </div>
                    {calDayJobs.length === 0 ? (
                      <div className="text-center py-8 text-white/30 text-sm">No jobs scheduled</div>
                    ) : (
                      <div className="space-y-2">
                        {calDayJobs.map(j => {
                          const c = customers.find(x => x.id === j.customerId);
                          return (
                            <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                              className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-red-600/20 transition">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm truncate">{j.address}</div>
                                  {c && <div className="text-xs text-white/50">{c.firstName} {c.lastName}</div>}
                                </div>
                                <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 ${
                                  j.status === "completed" ? "bg-green-900/40 text-green-300" :
                                  j.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
                                  "bg-blue-900/40 text-blue-300"
                                }`}>{j.status.replace("_", " ")}</div>
                              </div>
                              {j.scheduledTime && <div className="text-xs text-white/40 mt-1">🕐 {j.scheduledTime}</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {calMode === "month" && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => setCalMonthOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronLeft size={16} />
                      </button>
                      <div className="text-sm font-semibold">{calMonthLabel}</div>
                      <button onClick={() => setCalMonthOffset(o => o + 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {["S","M","T","W","T","F","S"].map((d, i) => (
                        <div key={i} className="text-center text-[10px] text-white/30 font-semibold py-1">{d}</div>
                      ))}
                    </div>
                    {/* Month grid */}
                    <div className="grid grid-cols-7 gap-0.5 mb-4">
                      {Array.from({ length: calFirstDay }, (_, i) => <div key={"e" + i} />)}
                      {Array.from({ length: calDaysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dateStr = `${calMonthYear}-${String(calMonthMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const dayJobs = myJobs.filter(j => j.scheduledDate === dateStr);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === calSelectedDate;
                        return (
                          <button key={day} onClick={() => setCalSelectedDate(dateStr)}
                            className={`flex flex-col items-center py-1.5 rounded-lg transition min-h-[44px] ${
                              isSelected ? "bg-red-600" : isToday ? "bg-red-950/50 border border-red-700/30" : "hover:bg-white/8"
                            }`}>
                            <div className={`text-sm font-semibold ${isSelected ? "text-white" : isToday ? "text-red-400" : "text-white/60"}`}>
                              {day}
                            </div>
                            {dayJobs.length > 0 && (
                              <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-red-400"}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Jobs for selected day */}
                    <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                      <span>{new Date(calSelectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                      {calDayJobs.length > 0 && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{calDayJobs.length}</span>}
                    </div>
                    {calDayJobs.length === 0 ? (
                      <div className="text-center py-6 text-white/30 text-sm">No jobs this day</div>
                    ) : (
                      <div className="space-y-2">
                        {calDayJobs.map(j => {
                          const c = customers.find(x => x.id === j.customerId);
                          return (
                            <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                              className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition">
                              <div className="font-semibold text-sm truncate">{j.address}</div>
                              {c && <div className="text-xs text-white/50">{c.firstName} {c.lastName}</div>}
                              {j.scheduledTime && <div className="text-xs text-white/40 mt-0.5">🕐 {j.scheduledTime}</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}

          {/* All Jobs tab — grouped by date */}
          {tab === "jobs" && (() => {
            const jwEnd = (() => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().slice(0, 10); })();
            const todayGrp   = myJobs.filter(j => j.scheduledDate === todayStr);
            const weekGrp    = myJobs.filter(j => j.scheduledDate > todayStr && j.scheduledDate <= jwEnd);
            const upcomingGrp = myJobs.filter(j => j.scheduledDate > jwEnd);
            const earlierGrp = myJobs.filter(j => j.scheduledDate < todayStr);

            const Group = ({ label, jobs: grpJobs }: { label: string; jobs: typeof myJobs }) => grpJobs.length === 0 ? null : (
              <div>
                <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                  <span>{label}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 font-normal">{grpJobs.length}</span>
                </div>
                <div className="space-y-2">{grpJobs.map(j => <JobCard key={j.id} job={j} />)}</div>
              </div>
            );

            return myJobs.length === 0 ? (
              <div className="text-center py-10 text-white/30">
                <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
                <div>No jobs assigned yet</div>
              </div>
            ) : (
              <div className="space-y-5">
                <Group label="Today" jobs={todayGrp} />
                <Group label="This Week" jobs={weekGrp.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))} />
                <Group label="Upcoming" jobs={upcomingGrp.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))} />
                <Group label="Earlier" jobs={earlierGrp.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))} />
              </div>
            );
          })()}

          {/* Pay tab */}
          {tab === "pay" && (() => {
            // Build pay period history (14-day periods going back 3 months)
            const periods: Array<{ label: string; start: string; end: string; hours: number; pay: number; jobs: number }> = [];
            const now = new Date();
            for (let i = 0; i < 6; i++) {
              const end = new Date(now); end.setDate(end.getDate() - i * 14);
              const start = new Date(end); start.setDate(start.getDate() - 13);
              const s = start.toISOString().slice(0, 10);
              const e = end.toISOString().slice(0, 10);
              const pJobs = myJobs.filter(j => j.scheduledDate >= s && j.scheduledDate <= e);
              const hrs = pJobs.reduce((acc, j) => acc + Number(j.loggedHours || 0), 0);
              periods.push({
                label: i === 0 ? "Current Period" : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
                start: s, end: e,
                hours: Math.round(hrs * 10) / 10,
                pay: Math.round(hrs * (myEmployee?.hourlyRate || 0) * 100) / 100,
                jobs: pJobs.filter(j => j.status === "completed").length,
              });
            }
            return (
              <>
                <Glass className="p-5 !bg-gradient-to-br !from-green-950/30 !to-black/60 !border-green-700/30">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Current Pay Rate</div>
                  <div className="text-3xl font-black text-green-400">{fmt(myEmployee?.hourlyRate || 0)}<span className="text-base font-normal text-white/50">/hr</span></div>
                  <div className="text-xs text-white/40 mt-1 capitalize">{myEmployee?.role}</div>
                </Glass>

                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">Pay Period History</div>
                <div className="space-y-2">
                  {periods.map((p, i) => (
                    <Glass key={i} className={"p-4 " + (i === 0 ? "!bg-green-950/20 !border-green-700/30" : "!bg-black/40")}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className={"text-sm font-semibold " + (i === 0 ? "text-green-300" : "text-white/70")}>{p.label}</div>
                          {i > 0 && <div className="text-[10px] text-white/30">{p.start} — {p.end}</div>}
                        </div>
                        <div className="text-right">
                          <div className={"text-lg font-black " + (i === 0 ? "text-green-400" : "text-white/70")}>{fmt(p.pay)}</div>
                          <div className="text-[10px] text-white/40">estimated</div>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-white/50">
                        <span><span className="font-semibold text-white/70">{p.hours}h</span> logged</span>
                        <span><span className="font-semibold text-white/70">{p.jobs}</span> completed</span>
                      </div>
                      {i === 0 && p.hours > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-white/40 mb-1">
                            <span>Progress</span>
                            <span>{p.hours}h / 80h typical</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: Math.min(100, p.hours / 80 * 100) + "%" }} />
                          </div>
                        </div>
                      )}
                    </Glass>
                  ))}
                </div>
                <div className="text-[10px] text-white/20 text-center pt-2">
                  Pay estimates are based on logged hours × hourly rate.<br />Contact your manager for official payroll figures.
                </div>
              </>
            );
          })()}
          {/* Google tab — each employee uses their own Google connection */}
          {tab === "google" && (
            <div className="space-y-4">
              <Glass className="p-5 !bg-black/40 text-center">
                <Database size={32} className="mx-auto mb-3 text-blue-400/60" />
                <div className="font-semibold text-base mb-1">Google Workspace</div>
                <div className="text-sm text-white/50 mb-4 leading-relaxed">
                  Connect <span className="text-white font-medium">your own</span> Google account to access your Gmail, Calendar, Drive, and Tasks — separate from your employer's account.
                </div>
                <div className="p-3 rounded-xl bg-yellow-950/30 border border-yellow-700/30 text-xs text-yellow-200/70 text-left mb-4">
                  Your Google data is always private. Employers cannot see your personal Gmail or Calendar events. Only your assigned CRM jobs appear in the team calendar.
                </div>
                <button
                  onClick={() => toast("Google connection for employee accounts coming soon! Ask your manager for details.", "yellow")}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-800 transition"
                >
                  Connect My Google Account
                </button>
              </Glass>
            </div>
          )}

        </div>
      </main>

      {/* Bottom nav — filtered by permissions */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-red-900/30 flex items-center justify-around px-2 py-2 safe-bottom z-30">
        {([
          { id: "today",    label: "Today",    icon: Home,       show: true },
          { id: "calendar", label: "Calendar", icon: Calendar,   show: perms.can_view_calendar },
          { id: "jobs",     label: "All Jobs", icon: List,       show: perms.can_view_jobs },
          { id: "pay",      label: "My Pay",   icon: DollarSign, show: perms.can_view_pay },
          { id: "google",   label: "Google",   icon: Database,   show: true },
        ] as const).filter(t => t.show).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className={"flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition " +
              (tab === id ? "text-red-400" : "text-white/40 hover:text-white/70")}>
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

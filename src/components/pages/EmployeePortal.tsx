import React, { useState, useEffect, useRef } from "react";
import {
  Clock, Briefcase, Calendar, ChevronLeft, CheckSquare, Camera,
  LogOut, MapPin, Phone, User, Play, Square, Plus, X, Eye, DollarSign,
  ChevronRight, Home, List, CheckCircle, AlertCircle, Image, FileText
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

function PortalChecklistSection({ title, emoji, items, onUpdate }: {
  title: string; emoji: string;
  items: JobChecklistItem[];
  onUpdate: (items: JobChecklistItem[]) => void;
}) {
  const done = items.filter(i => i.done).length;
  const toggle = (id: string) => onUpdate(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
  const updateNotes = (id: string, notes: string) => onUpdate(items.map(it => it.id === id ? { ...it, notes } : it));

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">{emoji} {title}</div>
        <div className={"text-xs font-bold " + (done === items.length ? "text-green-400" : "text-white/40")}>
          {done}/{items.length}
        </div>
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-start gap-2">
              <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)}
                className="mt-0.5 w-4 h-4 accent-green-500 cursor-pointer flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className={"text-sm " + (item.done ? "line-through text-white/30" : "text-white/80")}>
                  {item.label}
                </div>
                {item.done && (
                  <input
                    type="text"
                    value={item.notes || ""}
                    onChange={e => updateNotes(item.id, e.target.value)}
                    placeholder="Add note (optional)..."
                    className="mt-1 w-full bg-transparent border-0 border-b border-white/10 text-xs text-white/50 placeholder-white/20 focus:outline-none focus:border-white/30 py-0.5"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobDetailView({ job, customer, onBack, onUpdateJob, toast }: {
  job: Job; customer?: Customer; onBack: () => void;
  onUpdateJob: (patch: Partial<Job>) => void; toast: (msg: string, tone?: any) => void;
}) {
  const [note, setNote] = useState("");
  const [, forceTick] = useState(0);

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

  const addNote = () => {
    if (!note.trim()) return;
    const entry = { id: uid(), type: "note" as const, date: today(), note: note.trim() };
    onUpdateJob({ commLog: [...(job.commLog || []), entry] });
    setNote("");
    toast("Note added");
  };

  const beforePhoto = (job.photos || []).find(p => p.type === "before" && p.dataUrl);
  const afterPhoto = (job.photos || []).find(p => p.type === "after" && p.dataUrl);

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
            </div>
            <div className="mt-2 flex items-start gap-1.5 text-xs text-white/50">
              <MapPin size={11} className="mt-0.5 flex-shrink-0" />{job.address}
            </div>
            {customer.gateCode && <div className="mt-1 text-xs text-yellow-400/80">🔐 Gate code: {customer.gateCode}</div>}
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
            {job.clockInAt ? (
              <GBtn variant="danger" onClick={clockOut} className="!gap-2">
                <Square size={14} />Clock Out
              </GBtn>
            ) : (
              <GBtn onClick={clockIn} className="!gap-2">
                <Play size={14} />Clock In
              </GBtn>
            )}
          </div>
        </Glass>

        {/* Before/After photos */}
        <Glass className="p-4 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Image size={12} />Before / After Photos
          </div>
          {beforePhoto && afterPhoto && (
            <div className="mb-3">
              <BeforeAfterSlider before={beforePhoto.dataUrl} after={afterPhoto.dataUrl} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const r = new FileReader();
                  r.onload = ev => addPhoto("before", ev.target!.result as string);
                  r.readAsDataURL(f); e.target.value = "";
                }} />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-700/40 text-blue-300 text-sm font-medium transition text-center">
                <Plus size={14} />📷 Before
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
              <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-950/30 hover:bg-green-900/40 border border-green-700/40 text-green-300 text-sm font-medium transition text-center">
                <Plus size={14} />✨ After
              </div>
            </label>
          </div>
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
        </Glass>

        {/* Checklists */}
        <Glass className="p-4 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1">
            <CheckSquare size={12} />Job Checklists
          </div>
          <PortalChecklistSection
            title="Pre-Job" emoji="🔵"
            items={job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS}
            onUpdate={items => onUpdateJob({ preChecklist: items })}
          />
          <PortalChecklistSection
            title="During Job" emoji="🟡"
            items={job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS}
            onUpdate={items => onUpdateJob({ duringChecklist: items })}
          />
          <PortalChecklistSection
            title="Post-Job" emoji="🟢"
            items={job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS}
            onUpdate={items => onUpdateJob({ postChecklist: items })}
          />
        </Glass>

        {/* Internal notes */}
        {job.internalNotes && (
          <Glass className="p-4 !bg-yellow-950/20 !border-yellow-700/30">
            <div className="text-xs text-yellow-400/80 uppercase tracking-wider mb-1 font-semibold">📋 Site Notes</div>
            <div className="text-sm text-white/80">{job.internalNotes}</div>
          </Glass>
        )}

        {/* Add note */}
        <Glass className="p-4 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2">Add Note</div>
          <GTxt rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Report an issue, leave a status update..." />
          <GBtn onClick={addNote} className="mt-2 w-full !justify-center" disabled={!note.trim()}>
            <Plus size={14} />Add Note
          </GBtn>
          {(job.commLog || []).length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
              {[...(job.commLog || [])].reverse().slice(0, 5).map(e => (
                <div key={e.id} className="text-xs p-2 bg-white/5 rounded-lg">
                  <div className="text-white/80">{e.note}</div>
                  <div className="text-white/30 mt-0.5">{e.date}</div>
                </div>
              ))}
            </div>
          )}
        </Glass>
      </div>
    </div>
  );
}

export function EmployeePortal({ empSession, setEmpSession, jobs, setJobs, employees, customers, settings, toast }: {
  empSession: any; setEmpSession: (s: any) => void;
  jobs: Job[]; setJobs: (fn: (prev: Job[]) => Job[]) => void;
  employees: Employee[]; customers: Customer[];
  settings: AppSettings; toast: (msg: string, tone?: any) => void;
}) {
  const [tab, setTab] = useState<"today" | "schedule" | "jobs">("today");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginFirst, setLoginFirst] = useState("");
  const [loginLast, setLoginLast] = useState("");
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const myEmployee = empSession
    ? employees.find(e => e.email?.toLowerCase() === empSession.user.email?.toLowerCase()) || null
    : null;

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

  const payStart = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); })();
  const periodJobs = myJobs.filter(j => j.status === "completed" && j.scheduledDate >= payStart);
  const periodHours = periodJobs.reduce((s, j) => s + Number(j.loggedHours || j.duration || 0), 0);
  const estimatedPay = periodHours * (myEmployee?.hourlyRate || 0);

  const activeClockJob = myJobs.find(j => j.clockInAt);

  const updateJob = (jobId: string, patch: Partial<Job>) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
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
    const role = data.session?.user?.user_metadata?.role;
    if (!role || role === "owner") {
      setLoginError("This portal is for employees only. Owners sign in with Google on the main app.");
      await supabase.auth.signOut(); return;
    }
    setEmpSession(data.session);
    toast("Welcome back!");
  };

  const doRegister = async () => {
    if (!loginFirst.trim() || !loginLast.trim()) { setLoginError("Enter your full name"); return; }
    if (loginPwd.length < 6) { setLoginError("Password must be at least 6 characters"); return; }
    setLoginLoading(true); setLoginError("");
    const { error } = await supabase.auth.signUp({
      email: loginEmail, password: loginPwd,
      options: { data: { role: "technician", firstName: loginFirst, lastName: loginLast } },
    });
    setLoginLoading(false);
    if (error) { setLoginError(error.message); return; }
    toast("Account created! You can now sign in.");
    setLoginMode("login");
  };

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
            <div className="text-sm text-white/50 mt-1">Employee Portal</div>
          </div>

          <div className="space-y-3">
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
            {loginError && (
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

    return (
      <button onClick={() => setSelectedJobId(job.id)}
        className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-red-600/30 transition active:scale-98">
        <div className="flex items-start justify-between gap-2 mb-2">
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
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span>{job.scheduledDate}{job.scheduledTime ? " · " + job.scheduledTime : ""}</span>
          {job.clockInAt && <span className="text-green-400 font-semibold animate-pulse">● Active</span>}
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
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-black text-sm flex-shrink-0">
          {myEmployee.firstName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{myEmployee.firstName} {myEmployee.lastName}</div>
          <div className="text-[10px] text-white/40 capitalize">{role} · {myEmployee.role}</div>
        </div>
        {activeClockJob && (
          <div className="text-[10px] text-green-400 animate-pulse font-semibold">● On Job</div>
        )}
        <button onClick={doSignOut} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition">
          <LogOut size={16} />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="p-4 max-w-lg mx-auto space-y-4">

          {/* Today tab */}
          {tab === "today" && <>
            {/* Pay summary */}
            <Glass className="p-4 !bg-gradient-to-r !from-red-950/30 !to-black/60 !border-red-600/30">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Pay Period Summary (last 14 days)</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-black text-white">{periodHours.toFixed(1)}<span className="text-sm font-normal text-white/50">h</span></div>
                  <div className="text-[10px] text-white/40 mt-0.5">Hours Logged</div>
                </div>
                <div>
                  <div className="text-xl font-black text-green-400">{fmt(estimatedPay)}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Est. Pay</div>
                </div>
                <div>
                  <div className="text-xl font-black text-white">{periodJobs.length}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Jobs Done</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-white/30 text-center">{fmt(myEmployee.hourlyRate)}/hr</div>
            </Glass>

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

          {/* Schedule tab */}
          {tab === "schedule" && <>
            <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3">This Week's Schedule</div>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, i) => {
              const d = new Date(); d.setDate(d.getDate() - d.getDay() + i);
              const dateStr = d.toISOString().slice(0, 10);
              const dayJobs = myJobs.filter(j => j.scheduledDate === dateStr);
              const isToday = dateStr === todayStr;
              return (
                <div key={day} className={"rounded-2xl border " + (isToday ? "border-red-600/40 bg-red-950/10" : "border-white/5 bg-white/3")}>
                  <div className={"flex items-center justify-between px-4 py-2.5 " + (dayJobs.length ? "border-b border-white/5" : "")}>
                    <div className={"font-semibold " + (isToday ? "text-red-400" : "text-white/60")}>
                      {day} {isToday && <span className="text-xs font-normal">(Today)</span>}
                    </div>
                    <div className="text-xs text-white/30">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                  </div>
                  {dayJobs.length > 0 && (
                    <div className="p-3 space-y-2">
                      {dayJobs.map(j => <JobCard key={j.id} job={j} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </>}

          {/* All Jobs tab */}
          {tab === "jobs" && <>
            <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
              <span>All Assigned Jobs</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{myJobs.length}</span>
            </div>
            {myJobs.length === 0 ? (
              <div className="text-center py-10 text-white/30">
                <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
                <div>No jobs assigned yet</div>
              </div>
            ) : (
              <div className="space-y-2">
                {[...myJobs].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)).map(j => <JobCard key={j.id} job={j} />)}
              </div>
            )}
          </>}
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-red-900/30 flex items-center justify-around px-2 py-2 safe-bottom z-30">
        {([
          { id: "today", label: "Today", icon: Home },
          { id: "schedule", label: "Schedule", icon: Calendar },
          { id: "jobs", label: "All Jobs", icon: List },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={"flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition " +
              (tab === id ? "text-red-400" : "text-white/40 hover:text-white/70")}>
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// auto-extracted from Smock's OS monolith
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Users, FileText, Briefcase, Bot, BarChart3,
  Settings, Bell, Menu, X, Plus, Search, Edit, Trash2, Send,
  DollarSign, TrendingUp, CheckCircle, Clock, MapPin, Phone, Mail,
  Calendar, AlertTriangle, Truck, Receipt, FlaskConical, MessageSquare,
  Sun, Moon, Download, Undo2, Redo2, Volume2, Play, Cloud, Star,
  Award, Target, Shield, Key, Eye, EyeOff, Save, ChevronRight,
  ChevronLeft, GripVertical, Tag, Copy, Ban, RefreshCw, Percent,
  CreditCard, Repeat, XCircle, Activity, Zap, UserCheck, AlertCircle,
  Clipboard, Heart, Dumbbell, Droplet, Smile, Flame, Wind, Snowflake,
  Globe, Share2, Trophy, ExternalLink, Workflow, ToggleLeft, ToggleRight,
  Navigation, TrendingDown, PieChart as PieIcon, Package, Wrench,
  CheckSquare, Route, Users2, Layers, ArrowRight, BarChart2, Filter,
  Paperclip, ImageIcon, FileImage, MoreVertical, Mic, Upload, Link, Lock, User
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line,
  ComposedChart, Legend
} from "recharts";
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { PBar } from "../ui/PBar";
import { PageFade } from "../ui/PageFade";
import { TimeframeSelector } from "../ui/TimeframeSelector";
import { AddressAutocomplete } from "../ui/AddressAutocomplete";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { CustomerModal } from "../ui/CustomerModal";
import { CustomerDetail } from "../ui/CustomerDetail";
import { CustomerAnalytics } from "../ui/CustomerAnalytics";
import { EstimateBuilder } from "../ui/EstimateBuilder";
import { EstimatePreview } from "../ui/EstimatePreview";
import { JobDetailModal } from "../ui/JobDetailModal";
import { PipelineScrollContainer } from "../ui/PipelineScrollContainer";
import { SwipeableCard } from "../ui/SwipeableCard";
import { ReviewMonitor } from "../ui/ReviewMonitor";
import { ReviewLandingPage } from "../ui/ReviewLandingPage";
import { ReviewPreview } from "../ui/ReviewPreview";
import { VisualWorkflowBuilder } from "../ui/VisualWorkflowBuilder";
import { AutomationEditor } from "../ui/AutomationEditor";
import { VoiceMicButton } from "../ui/VoiceMicButton";
import { DocumentVault } from "../ui/DocumentVault";
import { ESignatureStep } from "../ui/ESignatureStep";
import { ChemicalCostCalc } from "../ui/ChemicalCostCalc";
import { CACCalculator } from "../ui/CACCalculator";
import { MileageUpdateModal } from "../ui/MileageUpdateModal";
import { VehicleModal } from "../ui/VehicleModal";
import { MaintenanceModal } from "../ui/MaintenanceModal";
import { SocialCalendar } from "../ui/SocialCalendar";
import { BulkPhotoUpload } from "../ui/BulkPhotoUpload";
import { ReviewToGraphic } from "../ui/ReviewToGraphic";
import { ABTestPanel } from "../ui/ABTestPanel";
import { CampaignScheduler } from "../ui/CampaignScheduler";
import { PinSettings } from "../ui/PinSettings";
import { ServiceCatalogSection } from "../ui/ServiceCatalogSection";
import { TemplateEditor } from "../ui/TemplateEditor";
import { AIModelsSection } from "../ui/AIModelsSection";
import { ChemicalModal } from "../ui/ChemicalModal";
import { WeeklyBusinessReview } from "../ui/WeeklyBusinessReview";
import { WeeklyReflectionTab } from "../ui/WeeklyReflectionTab";

export function CrewView({ jobs = [], setJobs, customers = [], employees = [], toast, settings = {} as any, estimates = [], setEstimates = (() => {}) as any }) {
  const [empFilter, setEmpFilter] = useState("all");
  const [crewDate, setCrewDate] = useState(today());
  const [liveDetailId, setLiveDetailId] = useState<string | null>(null);

  const activeEmps = employees.filter(e => e.status === "active");
  const liveJobs = jobs.filter((j: any) => !!j.clockInAt && j.status !== "completed" && j.status !== "cancelled");
  const liveUpdateJob = (jid: string, patch: any) => setJobs((prev: any[]) => prev.map(j => j.id === jid ? { ...j, ...patch } : j));
  const dayJobs = jobs
    .filter(j => j.scheduledDate === crewDate && j.status !== "cancelled")
    .filter(j => empFilter === "all" || (j.crew || []).includes(empFilter))
    .sort((a, b) => { const po = { urgent: 0, high: 1, normal: 2, low: 3 }; return (po[a.priority || "normal"] - po[b.priority || "normal"]); });

  const updateJob = (jid, patch) => setJobs(prev => prev.map(j => j.id === jid ? { ...j, ...patch } : j));
  const toggleCk = (jid, idx) => setJobs(prev => prev.map(j => j.id === jid ? { ...j, checklist: (j.checklist || []).map((c, i) => i === idx ? { ...c, done: !c.done } : c) } : j));
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

      {/* Live Now — every job currently clocked in, across all employees and
          dates; click one to see clock-in time, checklist progress, photos,
          notes, and Street View, plus add a note for the employee. */}
      <Glass className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users2 size={15} className="text-green-400" />
          <h3 className="font-semibold text-sm">Live Now</h3>
          {liveJobs.length > 0 && <Badge tone="green">{liveJobs.length} active</Badge>}
        </div>
        {liveJobs.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm">
            <Clock size={20} className="mx-auto mb-2 opacity-30" />
            No one is clocked in right now
          </div>
        ) : (
          <div className="space-y-2">
            {liveJobs.map((j: any) => {
              const c = customers.find((x: any) => x.id === j.customerId);
              const crewNames = (j.crew || []).map((eid: string) => employees.find((e: any) => e.id === eid)).filter(Boolean).map((e: any) => e.firstName).join(", ") || "Unassigned";
              const allCk = [...(j.preChecklist || []), ...(j.duringChecklist || []), ...(j.postChecklist || []), ...(j.checklist || [])];
              const done = allCk.filter((i: any) => i.done).length;
              const photoCount = (j.photos || []).length;
              return (
                <button key={j.id} onClick={() => setLiveDetailId(j.id)} className="w-full flex items-center gap-3 p-3 rounded-xl border bg-black/30 border-white/10 hover:border-green-600/40 transition text-left">
                  <div className="w-10 h-10 rounded-lg bg-green-900/40 border border-green-600/40 flex items-center justify-center flex-shrink-0">
                    <Clock size={14} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{crewNames} — {c ? c.firstName + " " + c.lastName : j.address}</div>
                    <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap mt-0.5">
                      <span>Clocked in {new Date(Number(j.clockInAt)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                      {allCk.length > 0 && <span className="flex items-center gap-1"><CheckSquare size={10} />{done}/{allCk.length}</span>}
                      {photoCount > 0 && <span className="flex items-center gap-1"><ImageIcon size={10} />{photoCount}</span>}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-white/30 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </Glass>

      <JobDetailModal
        jobId={liveDetailId}
        job={jobs.find((j: any) => j.id === liveDetailId)}
        onClose={() => setLiveDetailId(null)}
        customers={customers}
        employees={employees}
        updateJob={liveUpdateJob}
        toast={toast}
        settings={settings}
        estimates={estimates}
        setEstimates={setEstimates}
      />

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
        const doneCount = (j.checklist || []).filter(ck => ck.done).length;
        const pct = (j.checklist || []).length ? Math.round((doneCount / (j.checklist || []).length) * 100) : 0;
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
                if ((window as any).__settings?.twilioSid) {
                  try { await twilioSend((window as any).__settings, c.phone, msg); toast("OTW text sent to " + c.firstName + " ✓"); }
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

          {/* Checklist — always visible regardless of job status (scheduled, in_progress, completed) */}
          {<div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-white/50 uppercase tracking-wider">Checklist</div>
              <div className="text-[11px] font-semibold">{pct}% done</div>
            </div>
            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-gradient-to-r from-red-500 to-green-500 transition-all" style={{ width: pct + "%" }} />
            </div>
            <div className="space-y-2">
              {(j.checklist || []).map((ck, idx) => (
                <label key={idx} className={"flex items-start gap-3 p-3 rounded-xl cursor-pointer transition active:scale-95 " + (ck.done ? "bg-green-950/20 border border-green-700/30" : "bg-white/5 border border-white/10")}>
                  <input type="checkbox" checked={ck.done} onChange={() => toggleCk(j.id, idx)} className="w-5 h-5 rounded accent-green-500 flex-shrink-0 mt-0.5" />
                  <span className={"text-sm " + (ck.done ? "line-through text-white/50" : "text-white/90")}>{ck.label}</span>
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

// ===== PERSONAL BUDGET PAGE =====

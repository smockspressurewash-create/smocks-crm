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
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { Stat } from "./Stat";
import { PBar } from "./PBar";
import { PageFade } from "./PageFade";
import { TimeframeSelector } from "./TimeframeSelector";
import { DocumentVault } from "./DocumentVault";

export function CustomerDetail({ customer: c, onClose, onDelete, estimates = [], jobs = [], timeline = {}, setTimeline = (..._args: any[]) => {}, settings = {} as any, toast = (..._args: any[]) => {} }) {
  const [tab, setTab] = useState("info");
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("note");

  useEffect(() => { if (c) { setTab("info"); setNote(""); } }, [c]);

  if (!c) return null;
  const ce = estimates.filter(e => e.customerId === c.id);
  const cj = jobs.filter(j => j.customerId === c.id);
  const ct = (timeline[c.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));

  const addEntry = () => {
    if (!note.trim()) return;
    const e = { id: uid(), type: noteType, date: today(), note: note.trim(), author: "You" };
    setTimeline({ ...timeline, [c.id]: [...(timeline[c.id] || []), e] });
    setNote("");
  };

  const tIcon = t => ({
    call: { I: Phone, c: "text-green-400 bg-green-900/30" },
    text: { I: MessageSquare, c: "text-blue-400 bg-blue-900/30" },
    email: { I: Mail, c: "text-purple-400 bg-purple-900/30" },
    estimate: { I: FileText, c: "text-yellow-400 bg-yellow-900/30" },
    job: { I: CheckCircle, c: "text-red-400 bg-red-900/30" },
    note: { I: Clipboard, c: "text-white/60 bg-white/10" }
  }[t] || { I: Clipboard, c: "text-white/60 bg-white/10" });

  return (
    <Modal open={!!c} onClose={onClose} title="Customer Details" maxW="max-w-2xl">
      <div className="space-y-4">
        <Glass className="p-5 !bg-gradient-to-br !from-red-950/30 !to-black/60">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-lg font-bold">{c.firstName[0]}{c.lastName[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold">{c.firstName} {c.lastName}</div>
              <div className="text-xs text-white/60 mt-0.5">Since {c.createdAt}</div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-white/70"><Mail size={12} />{c.email || "—"}</div>
                <div className="flex items-center gap-2 text-white/70"><Phone size={12} />{c.phone || "—"}</div>
                <div className="flex items-center gap-2 text-white/70"><MapPin size={12} />{c.address || "—"}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/50 uppercase tracking-wider">Lifetime</div>
              <div className="text-2xl font-bold text-red-400">{fmt(c.totalSpent)}</div>
              {onDelete && (
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${c.firstName} ${c.lastName}? This cannot be undone.`)) {
                      onDelete(c);
                    }
                  }}
                  title="Delete customer"
                  className="mt-2 p-1.5 rounded-lg border border-red-900/40 bg-red-950/20 text-red-400/70 hover:text-red-300 hover:bg-red-950/40 transition"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {(c.gateCode || c.hasDog || c.sensitivePlants) && (
            <div className="mt-4 pt-3 border-t border-red-900/30">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Property Notes</div>
              <div className="space-y-1.5 text-xs">
                {c.gateCode && <div className="flex items-center gap-2"><span className="text-white/50">🔒 Gate code:</span><span className="font-mono text-white">{c.gateCode}</span></div>}
                {c.hasDog && <div className="flex items-center gap-2"><span className="text-white/50">🐕 Dog:</span><span>{c.dogName || "unnamed"}</span></div>}
                {c.sensitivePlants && <div className="flex items-center gap-2"><span className="text-white/50">🌿 Plants:</span><span>{c.sensitivePlants}</span></div>}
              </div>
            </div>
          )}

          {c.notes && <div className="mt-3 pt-3 border-t border-red-900/30"><div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Notes</div><div className="text-sm text-white/70">{c.notes}</div></div>}
          {(c.customFields || []).length > 0 && <div className="mt-3 pt-3 border-t border-red-900/30">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Custom Fields</div>
            <div className="space-y-1">
              {c.customFields.map((cf, i) => cf.key && <div key={i} className="flex justify-between text-xs"><span className="text-white/50">{cf.key}</span><span className="font-medium">{cf.value}</span></div>)}
            </div>
          </div>}
        </Glass>

        <div className="flex gap-2 border-b border-red-900/30 overflow-x-auto">
          {[["info", "Info"], ["estimates", "Estimates (" + ce.length + ")"], ["jobs", "Jobs (" + cj.length + ")"], ["timeline", "Timeline (" + ct.length + ")"], ["portal", "🌐 Portal"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={"px-4 py-2.5 text-sm font-medium transition relative whitespace-nowrap " + (tab === k ? "text-white" : "text-white/50")}>
              {l}
              {tab === k && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-red-800" />}
            </button>
          ))}
        </div>

        <div className="min-h-[160px]">
          {tab === "info" && <div className="space-y-3">
            {/* Tags + Lead Source */}
            {((c.tags && c.tags.length > 0) || c.leadSource) && (
              <div className="flex flex-wrap gap-2 items-center">
                {(c.tags || []).map(t => <Badge key={t} tone={t === "VIP" ? "yellow" : t === "Commercial" ? "blue" : "gray"}>{t}</Badge>)}
                {c.leadSource && <span className="text-[10px] px-2 py-1 rounded-full bg-purple-900/30 border border-purple-700/40 text-purple-300">📍 {c.leadSource}</span>}
              </div>
            )}
            {/* Property info */}
            <Glass className="p-4 !bg-black/40">
              <div className="text-[10px] text-white/50 uppercase tracking-wider mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1"><MapPin size={9} />Property Info</div>
                {c.address && <a href={"https://maps.google.com/?q=" + encodeURIComponent(c.address) + "&t=k"} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-1">🛰️ Satellite view</a>}
              </div>
              {/* Google Maps Static satellite image */}
              {c.address && settings?.googleMapsKey && (
                <div className="mb-3 rounded-xl overflow-hidden border border-white/10">
                  <img
                    src={"https://maps.googleapis.com/maps/api/staticmap?center=" + encodeURIComponent(c.address) + "&zoom=18&size=600x200&maptype=satellite&markers=color:red|" + encodeURIComponent(c.address) + "&key=" + settings.googleMapsKey}
                    alt="Property satellite view"
                    className="w-full object-cover"
                    style={{height: "140px"}}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {c.sqFootage ? <div><div className="text-[10px] text-white/40">Square Footage</div><div className="font-semibold">{Number(c.sqFootage).toLocaleString()} sq ft</div></div>
                  : c.address && <div><div className="text-[10px] text-white/40">Square Footage</div>
                    <a href={"https://www.phila.gov/property/#/" + encodeURIComponent(c.address || "")} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300">Lookup from satellite →</a>
                  </div>}
                {c.gateCode && <div><div className="text-[10px] text-white/40">Gate Code</div><div className="font-mono font-bold text-yellow-300">🔒 {c.gateCode}</div></div>}
                {c.hasDog && <div><div className="text-[10px] text-white/40">Dog on Property</div><div className="font-semibold">🐕 {c.dogName || "Yes"}</div></div>}
                {c.sensitivePlants && <div className="col-span-2"><div className="text-[10px] text-white/40">Sensitive Plants</div><div className="text-white/80">🌿 {c.sensitivePlants}</div></div>}
                {c.propertyNotes && <div className="col-span-2"><div className="text-[10px] text-white/40">Notes</div><div className="text-white/70">{c.propertyNotes}</div></div>}
                {!c.sqFootage && !c.gateCode && !c.hasDog && !c.sensitivePlants && <div className="col-span-2 text-white/40 text-xs">No property notes — edit customer to add</div>}
              </div>
            </Glass>
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Jobs", value: cj.length, icon: "🔨" },
                { label: "Spent", value: fmt(c.totalSpent || 0), icon: "💰" },
                { label: "Avg Job", value: cj.length ? fmt(cj.reduce((s,j)=>s+j.amount,0)/cj.length) : "—", icon: "📊" }
              ].map(s => <div key={s.label} className="p-3 bg-black/40 border border-red-900/20 rounded-xl text-center">
                <div className="text-lg">{s.icon}</div>
                <div className="font-bold text-sm mt-1">{s.value}</div>
                <div className="text-[10px] text-white/40">{s.label}</div>
              </div>)}
            </div>
            {/* Last job */}
            {cj.length > 0 && (() => {
              const last = cj.slice().sort((a,b) => b.scheduledDate.localeCompare(a.scheduledDate))[0];
              return <div className="flex items-center gap-3 p-3 bg-black/40 border border-red-900/20 rounded-xl text-xs">
                <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">Last service: {last.scheduledDate}</div>
                  <div className="text-white/50 truncate">{last.address}</div>
                </div>
                <div className="text-red-400 font-bold">{fmt(last.amount)}</div>
                <Badge tone={last.status === "completed" ? "green" : "yellow"}>{last.status.replace("_"," ")}</Badge>
              </div>;
            })()}
            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => window.open("tel:" + c.phone)} className="flex flex-col items-center gap-1 p-3 bg-green-950/20 border border-green-700/30 rounded-xl hover:bg-green-950/40 transition text-xs text-green-300"><Phone size={16} />Call</button>
              <button onClick={() => window.open("sms:" + c.phone)} className="flex flex-col items-center gap-1 p-3 bg-blue-950/20 border border-blue-700/30 rounded-xl hover:bg-blue-950/40 transition text-xs text-blue-300"><MessageSquare size={16} />Text</button>
              <button onClick={() => window.open("mailto:" + c.email)} className="flex flex-col items-center gap-1 p-3 bg-purple-950/20 border border-purple-700/30 rounded-xl hover:bg-purple-950/40 transition text-xs text-purple-300"><Mail size={16} />Email</button>
            </div>
          </div>}
          {tab === "estimates" && <div className="space-y-2">{ce.length ? ce.map(e => <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"><div><div className="text-sm font-medium">#{e.id.toUpperCase()}</div><div className="text-xs text-white/50">{e.createdAt}</div></div><div className="flex items-center gap-3"><Badge tone={e.status === "approved" ? "green" : "yellow"}>{e.status}</Badge><span className="font-semibold text-red-400">{fmt(e.total)}</span></div></div>) : <div className="text-center py-6 text-white/40 text-sm">None</div>}</div>}
          {tab === "jobs" && <div className="space-y-2">{cj.length ? cj.map(j => <div key={j.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"><div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{j.address}</div><div className="text-xs text-white/50">{j.scheduledDate}</div></div><div className="flex items-center gap-3"><Badge tone={j.status === "completed" ? "green" : "yellow"}>{j.status.replace("_", " ")}</Badge><span className="font-semibold text-red-400">{fmt(j.amount)}</span></div></div>) : <div className="text-center py-6 text-white/40 text-sm">None</div>}</div>}
          {tab === "timeline" && <div className="space-y-3">
            <Glass className="p-3 !bg-black/40">
              <div className="flex gap-2 mb-2 flex-wrap">{["note", "call", "text", "email"].map(t => <button key={t} onClick={() => setNoteType(t)} className={"text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border transition capitalize " + (noteType === t ? "bg-red-900/40 text-red-300 border-red-600/40" : "bg-white/5 text-white/50 border-white/10")}>{t}</button>)}</div>
              <div className="flex gap-2"><GInput placeholder={"Log a " + noteType + "..."} value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addEntry()} /><GBtn onClick={addEntry} disabled={!note.trim()}><Plus size={14} /></GBtn></div>
            </Glass>
            {ct.length ? <div className="relative pl-4">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-red-900/30" />
              {ct.map(ev => {
                const { I, c: clr } = tIcon(ev.type);
                return <div key={ev.id} className="relative flex gap-3 pb-4">
                  <div className={"absolute -left-4 w-6 h-6 rounded-full flex items-center justify-center border-2 border-black " + clr}><I size={10} /></div>
                  <div className="ml-4 flex-1 bg-white/5 border border-white/5 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1"><span className="text-xs text-white/50 uppercase tracking-wider capitalize">{ev.type}</span><span className="text-xs text-white/40">{ev.date}</span></div>
                    <div className="text-sm">{ev.note}</div>
                    <div className="text-[10px] text-white/40 mt-1">by {ev.author}</div>
                  </div>
                </div>;
              })}
            </div> : <div className="text-center py-6 text-white/40 text-sm">No events logged</div>}
          </div>}

          {tab === "portal" && <div className="space-y-4">
            <div className="p-3 bg-blue-950/20 border border-blue-700/30 rounded-xl">
              <div className="text-xs text-blue-300 font-semibold mb-1 flex items-center gap-1.5">🌐 Customer Portal Preview</div>
              <div className="text-[10px] text-white/60">This is what {c.firstName} sees when they log in to their portal. Share link: <span className="text-blue-400 font-mono">smocks.com/portal/{c.id?.slice(0,8)}</span></div>
            </div>
            {/* Estimates */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={10} />Estimates & Invoices</div>
              {ce.length === 0 ? <div className="text-xs text-white/40 py-3 text-center">No estimates yet</div>
              : <div className="space-y-2">
                {ce.map(e => <div key={e.id} className="flex items-center gap-3 p-3 bg-black/40 border border-red-900/10 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{e.lineItems?.map(i => i.description).filter(Boolean).join(", ").slice(0, 40) || "Quote"}</div>
                    <div className="text-xs text-white/50">{e.createdAt} · {fmt(e.total)}</div>
                  </div>
                  <Badge tone={e.paidAt ? "green" : e.invoiced ? "yellow" : e.status === "approved" ? "blue" : "gray"}>{e.paidAt ? "Paid" : e.invoiced ? "Invoice" : e.status}</Badge>
                </div>)}
              </div>}
            </div>
            {/* Jobs + Photo Gallery */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5"><Briefcase size={10} />Job History & Photo Gallery</div>
                <span className="text-[10px] text-white/30">{cj.reduce((s,j) => s + (j.photos?.filter(p=>p.dataUrl).length||0), 0)} photos</span>
              </div>
              {/* All photos flat grid */}
              {cj.some(j => j.photos?.some(p => p.dataUrl)) ? <>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {cj.flatMap(j => (j.photos||[]).filter(p=>p.dataUrl).map((p,i) => ({
                    ...p, jobDate: j.scheduledDate, jobAddr: j.address?.split(",")[0], jobAmt: j.amount
                  }))).slice(0,12).map((p,i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-black/40 group cursor-pointer"
                      onClick={() => window.open(p.dataUrl, "_blank")}>
                      <img src={p.dataUrl} alt={p.type} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className={"absolute top-1 left-1 text-[8px] px-1.5 py-0.5 rounded-full font-bold " + (p.type === "before" ? "bg-blue-600 text-white" : "bg-green-600 text-white")}>{p.type}</div>
                      <div className="absolute bottom-1 left-1 right-1 text-[8px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity truncate">{p.jobAddr}</div>
                    </div>
                  ))}
                </div>
                {/* Job list with status */}
                <div className="space-y-2">
                  {cj.slice(0,6).map(j => <div key={j.id} className="flex items-center gap-3 p-2.5 bg-black/40 border border-red-900/10 rounded-xl text-xs">
                    <div className="flex-1"><div className="font-medium">{j.address?.split(",")[0]}</div><div className="text-white/40">{j.scheduledDate} · {fmt(j.amount)}</div></div>
                    <div className="flex items-center gap-1.5">
                      {j.photos?.filter(p=>p.dataUrl).length > 0 && <span className="text-[10px] text-white/40">{j.photos.filter(p=>p.dataUrl).length}📸</span>}
                      <Badge tone={j.status==="completed"?"green":j.status==="scheduled"?"blue":"gray"}>{j.status}</Badge>
                    </div>
                  </div>)}
                </div>
              </> : <div className="text-xs text-white/40 py-3 text-center">No job photos uploaded yet</div>}
            </div>
            {/* Outstanding balance */}
            {(() => {
              const outstanding = ce.filter(e => e.invoiced && !e.paidAt).reduce((s, e) => s + e.total, 0);
              if (outstanding <= 0) return <div className="p-3 bg-green-950/20 border border-green-700/30 rounded-xl text-xs text-green-300 flex items-center gap-2"><CheckCircle size={12} />No outstanding balance — all paid up ✓</div>;
              return <div className="space-y-2">
                <div className="p-3 bg-red-950/20 border border-red-700/30 rounded-xl flex items-center justify-between">
                  <div><div className="text-xs text-red-300 font-semibold">Outstanding Balance</div><div className="text-[10px] text-white/60">{ce.filter(e => e.invoiced && !e.paidAt).length} invoice{ce.filter(e => e.invoiced && !e.paidAt).length !== 1 ? "s" : ""} unpaid</div></div>
                  <div className="text-2xl font-bold text-red-400">{fmt(outstanding)}</div>
                </div>
                <button onClick={() => {
                  const link = "smocks.com/portal/" + c.id + "?pay=balance";
                  navigator.clipboard?.writeText(link).catch(() => {});
                  toast("Pay link copied — send to customer");
                }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-900/30 border border-red-700/40 text-red-300 rounded-xl hover:bg-red-900/50 transition text-xs font-medium">
                  <CreditCard size={12} />Copy Pay Remaining Balance Link
                </button>
              </div>;
            })()}

            {/* Payment History */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Receipt size={10} />Payment History</div>
              {ce.filter(e => e.paidAt).length === 0
                ? <div className="text-xs text-white/40 py-3 text-center">No payments recorded yet</div>
                : <div className="space-y-1.5">
                  {ce.filter(e => e.paidAt).map(e => (
                    <div key={e.id} className="flex items-center gap-3 p-2.5 bg-black/40 border border-green-900/20 rounded-xl">
                      <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">{(e.lineItems || []).map(l => l.description).filter(Boolean).join(", ").slice(0,40) || "Service"}</div>
                        <div className="text-[10px] text-white/40">Paid {e.paidAt} · Invoice #{e.id.slice(-6).toUpperCase()}</div>
                      </div>
                      <div className="text-sm font-bold text-green-400">{fmt(e.total)}</div>
                    </div>
                  ))}
                  <div className="text-right text-xs text-white/50 pt-1">Total paid: <span className="font-bold text-white">{fmt(ce.filter(e => e.paidAt).reduce((s,e) => s + e.total, 0))}</span></div>
                </div>}
            </div>

            {/* Document Vault */}
            <DocumentVault customerId={c.id} />
          </div>}
        </div>
      </div>
    </Modal>
  );
}

// ===== ESTIMATES =====

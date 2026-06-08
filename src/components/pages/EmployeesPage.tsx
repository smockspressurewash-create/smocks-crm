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

export function EmployeesPage({ employees = [], setEmployees, jobs = [] }) {
  const [modal, setModal] = useState({ open: false, data: null });
  const [view, setView] = useState("list"); // list | hours | payroll
  const [payPeriodStart, setPayPeriodStart] = usePersistent("smocks.payPeriodStart", (() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); })());
  const [payPeriodEnd, setPayPeriodEnd] = usePersistent("smocks.payPeriodEnd", today());
  const [f, setF] = useState({ id: "", firstName: "", lastName: "", role: "Technician", status: "active", hourlyRate: 18, phone: "", email: "", startDate: today(), emergencyContact: "", notes: "" });
  const [showPortalInfo, setShowPortalInfo] = useState(false);
  const portalUrl = window.location.origin + window.location.pathname + "#/portal";

  useEffect(() => { if (modal.data) setF(modal.data); else setF({ id: "", firstName: "", lastName: "", role: "Technician", status: "active", hourlyRate: 18, phone: "", email: "", startDate: today(), emergencyContact: "", notes: "" }); }, [modal]);

  const save = () => {
    if (!f.firstName.trim()) return;
    if (f.id) setEmployees(prev => prev.map(e => e.id === f.id ? { ...f } : e));
    else setEmployees(prev => [...prev, { ...f, id: uid() }]);
    setModal({ open: false, data: null });
  };
  const del = id => { if (confirm("Remove employee?")) setEmployees(prev => prev.filter(e => e.id !== id)); };
  const toggle = id => setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: e.status === "active" ? "inactive" : "active" } : e));

  const roles = ["Owner", "Lead Technician", "Technician", "Helper", "Office", "Sales"];

  // Calculate real hours from jobs (loggedHours on jobs they're crewed on)
  const getEmployeeHours = (empId, startDate, endDate) => {
    return jobs
      .filter(j => (j.crew || []).includes(empId) && j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate)
      .reduce((s, j) => s + Number(j.loggedHours || j.duration || 0), 0);
  };

  const totalPayroll = employees.filter(e => e.status === "active").reduce((s, e) => {
    const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
    return s + hrs * e.hourlyRate;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-black/40 border border-red-900/30 rounded-xl p-1">
            {["list","hours","payroll"].map(v => <button key={v} onClick={() => setView(v)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition " + (view === v ? "bg-gradient-to-r from-red-600 to-red-800 text-white" : "text-white/50 hover:text-white")}>{v === "hours" ? "⏱ Hours" : v === "payroll" ? "💰 Payroll" : "👥 Team"}</button>)}
          </div>
          <div className="text-xs text-white/50">{employees.filter(e => e.status === "active").length} active</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPortalInfo(!showPortalInfo)} className="text-xs px-3 py-1.5 bg-black/40 border border-blue-700/40 text-blue-300 hover:bg-blue-950/30 rounded-xl transition flex items-center gap-1.5">
            <Globe size={12} />Team Portal
          </button>
          <GBtn onClick={() => setModal({ open: true, data: null })}><Plus size={14} className="inline mr-1.5" />Add Employee</GBtn>
        </div>
      </div>

      {showPortalInfo && (
        <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-700/30 space-y-3">
          <div className="text-sm font-semibold text-blue-300">Team Portal Access</div>
          <div className="text-xs text-white/60 leading-relaxed">
            Share this link with your employees. They create their own account with their work email, then see a limited view with only their assigned jobs, checklists, and pay summary.
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white/60 truncate">{portalUrl}</div>
            <button onClick={() => { navigator.clipboard.writeText(portalUrl); }} className="px-3 py-2 bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs rounded-xl hover:bg-blue-800/40 transition flex items-center gap-1"><Copy size={12} />Copy</button>
          </div>
          <div className="text-[11px] text-white/40">
            <strong className="text-white/60">Important:</strong> After an employee creates their account, make sure their email in this roster matches exactly. The portal matches by email to pull their jobs and pay info.
          </div>
        </div>
      )}

      {view === "list" && <div className="grid md:grid-cols-2 gap-4">
        {employees.map(e => (
          <Glass key={e.id} className={"p-4 group " + (e.status === "inactive" ? "opacity-60" : "")}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-base font-bold flex-shrink-0">{e.firstName[0]}{e.lastName[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{e.firstName} {e.lastName}</span>
                  <Badge tone={e.status === "active" ? "green" : "gray"}>{e.status}</Badge>
                  <Badge tone="blue">{e.role}</Badge>
                  {e.email && <Badge tone="gray">Portal Ready</Badge>}
                </div>
                <div className="text-xs text-white/60 mt-1 space-y-0.5">
                  {e.phone && <div className="flex items-center gap-1"><Phone size={10} />{e.phone}</div>}
                  {e.email && <div className="flex items-center gap-1"><Mail size={10} />{e.email}</div>}
                  <div className="flex items-center gap-1"><DollarSign size={10} />{fmt(e.hourlyRate)}/hr</div>
                  {e.startDate && <div className="flex items-center gap-1"><Calendar size={10} />Started {e.startDate}</div>}
                </div>
                {e.notes && <div className="text-[10px] text-white/40 mt-1 italic">{e.notes}</div>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                <button onClick={() => setModal({ open: true, data: e })} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><Edit size={12} /></button>
                <button onClick={() => toggle(e.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50">{e.status === "active" ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                <button onClick={() => del(e.id)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-white/50 hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>
          </Glass>
        ))}
        {employees.length === 0 && <div className="md:col-span-2 text-center py-16 text-white/40"><Users2 size={40} className="mx-auto mb-3 opacity-30" /><div>No employees yet</div></div>}
      </div>}

      {view === "hours" && <>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>Period:</span>
            <GDate value={payPeriodStart} onChange={e => setPayPeriodStart(e.target.value)} className="!text-xs !py-1.5 !w-36" />
            <span>to</span>
            <GDate value={payPeriodEnd} onChange={e => setPayPeriodEnd(e.target.value)} className="!text-xs !py-1.5 !w-36" />
          </div>
        </div>
        <Glass className="overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-red-900/30 bg-black/40">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/60">Employee</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Jobs</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Hours</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Rate</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Est. Pay</th>
            </tr></thead>
            <tbody>
              {employees.filter(e => e.status === "active").map(e => {
                const empJobs = jobs.filter(j => (j.crew||[]).includes(e.id) && j.status === "completed" && j.scheduledDate >= payPeriodStart && j.scheduledDate <= payPeriodEnd);
                const hrs = empJobs.reduce((s,j) => s + Number(j.loggedHours||j.duration||0), 0);
                const cost = hrs * e.hourlyRate;
                return <tr key={e.id} className="border-b border-red-900/10 hover:bg-white/5">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-xs font-bold">{e.firstName[0]}</div>{e.firstName} {e.lastName}</div></td>
                  <td className="px-4 py-3 text-right text-white/60">{empJobs.length}</td>
                  <td className="px-4 py-3 text-right text-white/80">{hrs.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-white/60">{fmt(e.hourlyRate)}/hr</td>
                  <td className="px-4 py-3 text-right font-bold text-red-400">{fmt(cost)}</td>
                </tr>;
              })}
              <tr className="bg-red-950/20 font-bold border-t border-red-900/30">
                <td className="px-4 py-3" colSpan={4}>Total Payroll Est.</td>
                <td className="px-4 py-3 text-right text-red-400 text-base">{fmt(totalPayroll)}</td>
              </tr>
            </tbody>
          </table>
          <div className="p-3 text-[10px] text-white/30 border-t border-red-900/20">Hours pulled from logged time on completed jobs assigned to each crew member. Add hours via the clock in/out button on job cards.</div>
        </Glass>
      </>}

      {view === "payroll" && <div className="space-y-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>Pay period:</span>
            <GDate value={payPeriodStart} onChange={e => setPayPeriodStart(e.target.value)} className="!text-xs !py-1.5 !w-36" />
            <span>—</span>
            <GDate value={payPeriodEnd} onChange={e => setPayPeriodEnd(e.target.value)} className="!text-xs !py-1.5 !w-36" />
          </div>
          <button onClick={() => {
            const rows = employees.filter(e => e.status === "active").map(e => {
              const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
              const gross = hrs * e.hourlyRate;
              const fica = gross * 0.0765;
              const net = gross - fica;
              return `${e.firstName} ${e.lastName},${e.role},${hrs.toFixed(1)},${e.hourlyRate},${gross.toFixed(2)},${fica.toFixed(2)},${net.toFixed(2)}`;
            }).join("\n");
            const csv = "Name,Role,Hours,Rate,Gross,FICA (7.65%),Net\n" + rows;
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "payroll-" + payPeriodStart + ".csv"; a.click();
          }} className="text-xs px-3 py-1.5 bg-black/40 border border-red-900/30 text-white/60 hover:text-white rounded-xl transition flex items-center gap-1"><Download size={12} />Export CSV</button>
        </div>
        <div className="grid gap-4">
          {employees.filter(e => e.status === "active").map(e => {
            const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
            const gross = hrs * e.hourlyRate;
            const fica = gross * 0.0765;
            const net = gross - fica;
            const empJobs = jobs.filter(j => (j.crew||[]).includes(e.id) && j.status === "completed" && j.scheduledDate >= payPeriodStart && j.scheduledDate <= payPeriodEnd);
            return <Glass key={e.id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-bold">{e.firstName[0]}{e.lastName[0]}</div>
                <div className="flex-1"><div className="font-semibold">{e.firstName} {e.lastName}</div><div className="text-xs text-white/50">{e.role} · {fmt(e.hourlyRate)}/hr</div></div>
                <div className="text-right"><div className="text-xl font-black text-green-400">{fmt(net)}</div><div className="text-[10px] text-white/40">net pay</div></div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-center">
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Jobs</div><div className="font-bold">{empJobs.length}</div></div>
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Hours</div><div className="font-bold">{hrs.toFixed(1)}h</div></div>
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Gross</div><div className="font-bold text-red-400">{fmt(gross)}</div></div>
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">FICA</div><div className="font-bold text-yellow-400">-{fmt(fica)}</div></div>
              </div>
              {empJobs.length > 0 && <div className="mt-3 text-[10px] text-white/40">Jobs: {empJobs.map(j => j.scheduledDate).join(", ")}</div>}
            </Glass>;
          })}
        </div>
        <Glass className="p-4 !bg-gradient-to-r !from-red-950/30 !to-black/60 !border-red-600/40 text-center">
          <div className="text-xs text-white/50 mb-1">Total Payroll Period {payPeriodStart} — {payPeriodEnd}</div>
          <div className="text-3xl font-black text-red-400">{fmt(totalPayroll)}</div>
          <div className="text-[10px] text-white/30 mt-1">Gross · FICA employer match additional 7.65%</div>
        </Glass>
      </div>}

      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? "Edit Employee" : "Add Employee"} maxW="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">First name</label><GInput value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Last name</label><GInput value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Role</label><GSel value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{roles.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}</GSel></div>
            <div><label className="text-xs text-white/60 mb-1 block">Hourly Rate ($)</label><GInput type="number" step="0.5" value={f.hourlyRate} onChange={e => setF({ ...f, hourlyRate: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="(717) 555-0100" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Start Date</label><GDate value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Status</label><GSel value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="active" className="bg-black">Active</option><option value="inactive" className="bg-black">Inactive</option></GSel></div>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Emergency Contact</label><GInput value={f.emergencyContact} onChange={e => setF({ ...f, emergencyContact: e.target.value })} placeholder="Name — (717) 555-0000" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <GBtn variant="ghost" onClick={() => setModal({ open: false, data: null })}>Cancel</GBtn>
            <GBtn onClick={save} disabled={!f.firstName.trim()}>Save</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== EXPENSES =====

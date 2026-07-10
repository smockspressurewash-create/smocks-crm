// auto-extracted from Crew Boss OS monolith
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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, getEffectiveRate } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
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

interface InviteRecord { code: string; firstName: string; lastName: string; email: string; role: string; hourlyRate: number; createdAt: string; used?: boolean; permissions?: Record<string, boolean>; }

const PERMISSION_DEFS_EMP = [
  { key: "can_view_jobs",          label: "View assigned jobs",    desc: "See their schedule" },
  { key: "can_clock_in",           label: "Clock in / out",        desc: "Track time on jobs" },
  { key: "can_upload_photos",      label: "Upload photos",         desc: "Before/after photos" },
  { key: "can_complete_checklist", label: "Complete checklist",    desc: "Check off job items" },
  { key: "can_get_signoff",        label: "Customer sign-off",     desc: "Collect signature" },
  { key: "can_view_pay",           label: "View pay info",         desc: "See pay & history" },
  { key: "can_view_calendar",      label: "View calendar",         desc: "Weekly/monthly view" },
  { key: "can_add_notes",          label: "Add job notes",         desc: "Leave notes on jobs" },
] as const;

const DEFAULT_PERMS: Record<string, boolean> = {
  can_view_jobs: true, can_clock_in: true, can_upload_photos: true,
  can_complete_checklist: true, can_get_signoff: true,
  can_view_pay: true, can_view_calendar: true, can_add_notes: true,
};

// FIX 8 — CRM-side permissions for a "Manager" role employee (distinct from
// PERMISSION_DEFS_EMP above, which govern the field/employee portal). Managers
// get the full owner CRM by default EXCEPT these areas, which are hidden
// unless the owner explicitly grants them — see App.tsx's nav-gating.
const MANAGER_CRM_PERM_DEFS = [
  { key: "alfred",         label: "Alfred AI Assistant", desc: "The in-app AI chatbot" },
  { key: "inbox",          label: "Inbox",               desc: "Email/texting with customers" },
  { key: "accountability", label: "Accountability Tools",desc: "Personal goals & reflections" },
  { key: "google",         label: "Google Workspace",    desc: "Owner's connected Gmail/Calendar/Drive" },
] as const;
const DEFAULT_MANAGER_PERMS: Record<string, boolean> = {
  alfred: false, inbox: false, accountability: false, google: false,
};

export function EmployeesPage({ employees = [], setEmployees, jobs = [], settings = {} as any, toast = (_msg: string, _tone?: string) => {} }: { employees?: any[]; setEmployees: any; jobs?: any[]; settings?: any; toast?: any }) {
  const [modal, setModal] = useState({ open: false, data: null });
  const [view, setView] = useState("list"); // list | hours | payroll
  const [payPeriodStart, setPayPeriodStart] = usePersistent("smocks.payPeriodStart", (() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); })());
  const [payPeriodEnd, setPayPeriodEnd] = usePersistent("smocks.payPeriodEnd", today());
  const [f, setF] = useState<any>({ id: "", firstName: "", lastName: "", role: "Technician", status: "active", hourlyRate: 18, phone: "", email: "", startDate: today(), emergencyContact: "", notes: "", permissions: { ...DEFAULT_PERMS } });
  const [showPortalInfo, setShowPortalInfo] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = usePersistent<InviteRecord[]>("smocks.invites", []);
  const [inviteF, setInviteF] = useState({ firstName: "", lastName: "", email: "", role: "Technician", hourlyRate: 18 });
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>({ ...DEFAULT_PERMS });
  const [inviteManagerPerms, setInviteManagerPerms] = useState<Record<string, boolean>>({ ...DEFAULT_MANAGER_PERMS });
  const [showInvitePerms, setShowInvitePerms] = useState(false);
  const [showEditPerms, setShowEditPerms] = useState(false);
  const [inviteCreated, setInviteCreated] = useState<InviteRecord | null>(null);
  const portalUrl = window.location.origin + window.location.pathname + "#/portal";

  const generateInvite = async () => {
    if (!inviteF.firstName.trim() || !inviteF.email.trim()) return;
    const code = (Math.random().toString(36).substring(2, 10) + Date.now().toString(36)).toUpperCase();
    const inv: InviteRecord = { code, ...inviteF, hourlyRate: Number(inviteF.hourlyRate), createdAt: new Date().toISOString().slice(0, 10), permissions: invitePerms };
    // Save to localStorage (local UI state)
    setInvites(prev => [...prev, inv]);
    // Save to Supabase so the invite works from any browser/device
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from("invites").insert({
        code,
        employee_name: `${inv.firstName} ${inv.lastName}`,
        employee_email: inv.email,
        role: inv.role,
        hourly_rate: inv.hourlyRate,
        created_by: user?.id ?? null,
      });
    } catch { /* table may not exist yet — invite still works via localStorage in the same browser */ }
    // Pre-create employee record so the portal can match immediately. This
    // MUST also land in Supabase (not just local state) — refetchEmployees()
    // polls the table every few seconds and wholesale-replaces local state
    // with the server rows, so a local-only placeholder here would silently
    // vanish from the roster within seconds of being created.
    const alreadyExists = employees.some(e => e.email.toLowerCase() === inviteF.email.toLowerCase());
    if (!alreadyExists) {
      const preCreated = {
        id: uid(), firstName: inv.firstName, lastName: inv.lastName, email: inv.email,
        role: inv.role, hourlyRate: inv.hourlyRate, status: "active", phone: "",
        startDate: today(), emergencyContact: "", notes: "Invited — account pending",
        permissions: invitePerms,
        managerPermissions: inv.role.toLowerCase().includes("manager") ? inviteManagerPerms : undefined,
      };
      setEmployees((prev: any[]) => [...prev, preCreated as any]);
      (supabase as any).from("employees").insert(preCreated)
        .then((r: any) => { if (r?.error) console.warn("[Invite] pre-create employee row failed:", r.error.message); })
        .catch((e: any) => console.warn("[Invite] pre-create employee row threw:", e?.message));
    }
    setInviteCreated(inv);
    // Send invite email if Resend is configured
    const link = inviteLink(code);
    const companyName = settings?.companyName || "your company";
    const ownerName = settings?.ownerName || "Your Manager";
    try {
      await sendEmail(settings, {
        to: inviteF.email,
        subject: `You've been invited to join ${companyName} on CrewBoss`,
        body: `<p>Hi ${inviteF.firstName},</p><p>${ownerName} has invited you to join <strong>${companyName}</strong> on CrewBoss. Click the link below to create your employee account and access your schedule, pay, and job details.</p><p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Create Your Account</a></p><p>Or paste this link in your browser:<br/><a href="${link}">${link}</a></p><p style="color:#888;font-size:12px;">This invite was sent by ${companyName} using CrewBoss.</p>`,
      });
      toast(`Invite email sent to ${inviteF.email} ✓`, "green");
    } catch {
      // Email sending failed (Resend not configured) — link was still created
      toast(`Invite created! Share the link manually with ${inviteF.firstName}.`, "yellow");
    }
  };

  const inviteLink = (code: string) => `${portalUrl}?invite=${code}`;

  useEffect(() => {
    if (modal.data) {
      setF({ ...modal.data, permissions: (modal.data as any).permissions || { ...DEFAULT_PERMS } });
    } else {
      setF({ id: "", firstName: "", lastName: "", role: "Technician", status: "active", hourlyRate: 18, phone: "", email: "", startDate: today(), emergencyContact: "", notes: "", permissions: { ...DEFAULT_PERMS } });
    }
    setShowEditPerms(false);
  }, [modal]);

  // Employee edits (pay rate, paidPeriods, permissions, etc.) have no bulk
  // autosave the way `jobs` does — without an immediate Supabase write here,
  // changes like marking a pay period Paid only ever lived in the owner's
  // local React state and the employee's portal (which reads straight from
  // Supabase) never saw them.
  const save = () => {
    if (!f.firstName.trim()) return;
    const id = f.id || uid();
    const record = { ...f, id };
    if (f.id) setEmployees(prev => prev.map(e => e.id === f.id ? record : e));
    else setEmployees(prev => [...prev, record]);
    if (f.id) {
      (supabase as any).from("employees").update(record).eq("id", id)
        .then((r: any) => { if (r?.error) toast?.("Saved locally, but failed to sync — " + r.error.message, "red"); })
        .catch((e: any) => toast?.("Saved locally, but failed to sync — " + (e?.message || ""), "red"));
    }
    setModal({ open: false, data: null });
  };
  const del = id => {
    if (!confirm("Remove employee?")) return;
    setEmployees(prev => prev.filter(e => e.id !== id));
    // Must actually delete server-side — the 3s Live Crew poll fully replaces
    // local state from Supabase, so a local-only removal (e.g. revoking a
    // manager's access) would silently reappear on the very next poll.
    (supabase as any).from("employees").delete().eq("id", id)
      .then((r: any) => { if (r?.error) toast?.("Removed locally, but failed to sync — " + r.error.message, "red"); })
      .catch((e: any) => toast?.("Removed locally, but failed to sync — " + (e?.message || ""), "red"));
  };
  const toggle = id => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: e.status === "active" ? "inactive" : "active" } : e));
    const emp = employees.find((e: any) => e.id === id);
    const nextStatus = emp?.status === "active" ? "inactive" : "active";
    (supabase as any).from("employees").update({ status: nextStatus }).eq("id", id).catch(() => {});
  };

  const roles = ["Owner", "Manager", "Lead Technician", "Technician", "Helper", "Office", "Sales"];

  // Calculate real hours from jobs (loggedHours on jobs they're crewed on)
  const getEmployeeHours = (empId, startDate, endDate) => {
    return jobs
      .filter(j => (j.crew || []).includes(empId) && j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate)
      .reduce((s, j) => s + Number(j.loggedHours || j.duration || 0), 0);
  };

  // Pay must respect per-job-type rate overrides (getEffectiveRate), so it's
  // computed per-job (hours × that job's effective rate) then summed — a flat
  // hours-total × hourlyRate would ignore commercial/residential overrides.
  const getEmployeePay = (emp: any, startDate: string, endDate: string) => {
    return jobs
      .filter((j: any) => (j.crew || []).includes(emp.id) && j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate)
      .reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0) * getEffectiveRate(emp, j), 0);
  };

  const totalPayroll = employees.filter(e => e.status === "active").reduce((s, e) => {
    return s + getEmployeePay(e, payPeriodStart, payPeriodEnd);
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
          <button onClick={() => { setInviteOpen(true); setInviteCreated(null); setInviteF({ firstName: "", lastName: "", email: "", role: "Technician", hourlyRate: 18 }); setInvitePerms({ ...DEFAULT_PERMS }); setInviteManagerPerms({ ...DEFAULT_MANAGER_PERMS }); setShowInvitePerms(false); }} className="text-xs px-3 py-1.5 bg-black/40 border border-green-700/40 text-green-300 hover:bg-green-950/30 rounded-xl transition flex items-center gap-1.5">
            <UserCheck size={12} />Invite Member
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
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Today</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">This Week</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Jobs</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Period Hours</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Rate</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Est. Pay</th>
            </tr></thead>
            <tbody>
              {employees.filter(e => e.status === "active").map(e => {
                const empJobs = jobs.filter(j => (j.crew||[]).includes(e.id) && j.status === "completed" && j.scheduledDate >= payPeriodStart && j.scheduledDate <= payPeriodEnd);
                const hrs = empJobs.reduce((s,j) => s + Number(j.loggedHours||j.duration||0), 0);
                const cost = getEmployeePay(e, payPeriodStart, payPeriodEnd);
                const todayStr = today();
                const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
                const allCompleted = jobs.filter((j: any) => (j.crew || []).includes(e.id) && j.status === "completed");
                const hoursToday = allCompleted.filter((j: any) => j.scheduledDate === todayStr).reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
                const hoursWeek = allCompleted.filter((j: any) => j.scheduledDate >= weekStart).reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
                return <tr key={e.id} className="border-b border-red-900/10 hover:bg-white/5">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-xs font-bold">{e.firstName[0]}</div>{e.firstName} {e.lastName}{(e as any).dayClockInAt && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" title="On the clock now" />}</div></td>
                  <td className="px-4 py-3 text-right text-white/70">{hoursToday.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-white/70">{hoursWeek.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-white/60">{empJobs.length}</td>
                  <td className="px-4 py-3 text-right text-white/80">{hrs.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-white/60">{fmt(e.hourlyRate)}/hr</td>
                  <td className="px-4 py-3 text-right font-bold text-red-400">{fmt(cost)}</td>
                </tr>;
              })}
              <tr className="bg-red-950/20 font-bold border-t border-red-900/30">
                <td className="px-4 py-3" colSpan={6}>Total Payroll Est.</td>
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
              const gross = getEmployeePay(e, payPeriodStart, payPeriodEnd);
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
            const gross = getEmployeePay(e, payPeriodStart, payPeriodEnd);
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

      {/* Active invites */}
      {invites.filter(i => !i.used).length > 0 && view === "list" && (
        <Glass className="p-4 !bg-green-950/10 !border-green-700/20">
          <div className="text-xs font-semibold text-green-300 mb-2 flex items-center gap-1.5"><UserCheck size={12} />Pending Invites</div>
          <div className="space-y-2">
            {invites.filter(i => !i.used).map(inv => (
              <div key={inv.code} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{inv.firstName} {inv.lastName} <span className="text-white/40">·</span> <span className="text-white/50">{inv.email}</span></div>
                  <div className="text-[10px] text-white/30 mt-0.5">{inv.role} · {fmt(inv.hourlyRate)}/hr · Sent {inv.createdAt}</div>
                </div>
                <button onClick={() => navigator.clipboard.writeText(inviteLink(inv.code))} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition flex-shrink-0">
                  <Copy size={11} />Copy Link
                </button>
                <button onClick={() => setInvites(prev => prev.filter(i => i.code !== inv.code))} className="text-white/30 hover:text-red-400 flex-shrink-0 transition">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </Glass>
      )}

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => { setInviteOpen(false); setInviteCreated(null); }} title="Invite Team Member" maxW="max-w-md">
        {!inviteCreated ? (
          <div className="space-y-3">
            <div className="text-xs text-white/50 leading-relaxed">
              Fill in the employee's details. An invite link will be generated that pre-creates their account in the roster. Share the link with the employee — they click it to sign up on the team portal.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-white/60 mb-1 block">First name *</label><GInput value={inviteF.firstName} onChange={e => setInviteF(p => ({ ...p, firstName: e.target.value }))} /></div>
              <div><label className="text-xs text-white/60 mb-1 block">Last name</label><GInput value={inviteF.lastName} onChange={e => setInviteF(p => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block">Work email *</label><GInput type="email" value={inviteF.email} onChange={e => setInviteF(p => ({ ...p, email: e.target.value }))} placeholder="employee@example.com" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-white/60 mb-1 block">Role</label>
                <GSel value={inviteF.role} onChange={e => setInviteF(p => ({ ...p, role: e.target.value }))}>
                  {["Technician","Lead Technician","Manager","Helper","Office","Sales"].map(r => <option key={r} value={r} className="bg-black">{r}</option>)}
                </GSel>
              </div>
              <div><label className="text-xs text-white/60 mb-1 block">Hourly Rate ($)</label><GInput type="number" step="0.5" value={inviteF.hourlyRate} onChange={e => setInviteF(p => ({ ...p, hourlyRate: Number(e.target.value) }))} /></div>
            </div>
            {/* Manager CRM permissions — only relevant when inviting a Manager.
                Full CRM access by default EXCLUDES these areas; the owner
                opts a manager INTO them here rather than out of them. */}
            {inviteF.role === "Manager" && (
              <div className="border border-purple-700/30 rounded-xl p-3 bg-purple-950/10 space-y-1">
                <div className="text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5"><Shield size={12} />Manager CRM Access</div>
                <div className="text-[10px] text-white/40 mb-2">Managers get full CRM access except these areas — check any you want to grant.</div>
                {MANAGER_CRM_PERM_DEFS.map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer py-1 group">
                    <input type="checkbox" checked={!!inviteManagerPerms[key]} onChange={e => setInviteManagerPerms(p => ({ ...p, [key]: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-purple-600 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-white/80 group-hover:text-white transition">{label}</div>
                      <div className="text-[10px] text-white/40">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {/* Permissions editor */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowInvitePerms(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <span className="flex items-center gap-1.5"><Shield size={12} />Permissions</span>
                <span className="text-[10px] text-white/40">{showInvitePerms ? "▲ collapse" : "▼ expand"}</span>
              </button>
              {showInvitePerms && (
                <div className="px-3 pb-3 space-y-1 border-t border-white/10">
                  <div className="flex gap-3 pt-2 pb-1">
                    <button onClick={() => setInvitePerms(Object.fromEntries(PERMISSION_DEFS_EMP.map(d => [d.key, true])))} className="text-[10px] text-blue-400 hover:text-blue-300 transition">Select All</button>
                    <button onClick={() => setInvitePerms(Object.fromEntries(PERMISSION_DEFS_EMP.map(d => [d.key, false])))} className="text-[10px] text-red-400 hover:text-red-300 transition">Deselect All</button>
                  </div>
                  {PERMISSION_DEFS_EMP.map(({ key, label, desc }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer py-1 group">
                      <input type="checkbox" checked={!!invitePerms[key]} onChange={e => setInvitePerms(p => ({ ...p, [key]: e.target.checked }))}
                        className="w-3.5 h-3.5 accent-red-600 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-white/80 group-hover:text-white transition">{label}</div>
                        <div className="text-[10px] text-white/40">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <GBtn variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</GBtn>
              <GBtn onClick={generateInvite} disabled={!inviteF.firstName.trim() || !inviteF.email.trim()}>Generate Invite Link</GBtn>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-green-950/30 border border-green-700/30 flex items-center gap-2">
              <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
              <div className="text-sm text-green-300">Invite created for {inviteCreated.firstName} {inviteCreated.lastName}</div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">Share this link with the employee:</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs font-mono text-white/60 truncate">{inviteLink(inviteCreated.code)}</div>
                <button onClick={() => navigator.clipboard.writeText(inviteLink(inviteCreated.code))} className="px-3 py-2 bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs rounded-xl hover:bg-blue-800/40 transition flex items-center gap-1">
                  <Copy size={11} />Copy
                </button>
              </div>
            </div>
            <Glass className="p-3 !bg-black/40">
              <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5">Instructions for employee</div>
              <div className="text-xs text-white/60 space-y-1 leading-relaxed">
                <div>1. Open the invite link above</div>
                <div>2. Click "Create Account" and sign up with <strong className="text-white/80">{inviteCreated.email}</strong></div>
                <div>3. They'll land on the Team Portal with their schedule and pay info</div>
              </div>
            </Glass>
            <div className="text-[10px] text-white/30">
              Invite code: <span className="font-mono text-white/50">{inviteCreated.code}</span> · Their email must match exactly: <span className="font-mono text-white/50">{inviteCreated.email}</span>
            </div>
            <div className="flex justify-end">
              <GBtn onClick={() => { setInviteOpen(false); setInviteCreated(null); }}>Done</GBtn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? "Edit Employee" : "Add Employee"} maxW="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">First name</label><GInput value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Last name</label><GInput value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Role</label><GSel value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{roles.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}</GSel></div>
            <div><label className="text-xs text-white/60 mb-1 block">Default Hourly Rate ($)</label><GInput type="number" step="0.5" value={f.hourlyRate} onChange={e => setF({ ...f, hourlyRate: Number(e.target.value) })} /></div>
          </div>
          <div className="border border-white/10 rounded-xl p-3">
            <div className="text-xs font-semibold text-white/70 mb-2 flex items-center gap-1.5"><Percent size={12} />Job-Type Rate Overrides</div>
            <div className="text-[10px] text-white/40 mb-2">Leave blank to use the default hourly rate above. When a job is marked residential or commercial, its logged hours are paid at the matching override.</div>
            <div className="grid grid-cols-2 gap-2">
              {["residential", "commercial"].map(jt => (
                <div key={jt}>
                  <label className="text-xs text-white/60 mb-1 block capitalize">{jt} ($/hr)</label>
                  <GInput
                    type="number" step="0.5"
                    placeholder={String(f.hourlyRate)}
                    value={(f.jobTypeRates || {})[jt] ?? ""}
                    onChange={e => {
                      const v = e.target.value;
                      setF((p: any) => {
                        const next = { ...(p.jobTypeRates || {}) };
                        if (v === "") delete next[jt]; else next[jt] = Number(v);
                        return { ...p, jobTypeRates: next };
                      });
                    }}
                  />
                </div>
              ))}
            </div>
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

          {/* Shift status — mirrors the employee's own "Start My Day" timer
              so the owner can see it's running (and how long the last
              completed shift was) without opening the employee portal. */}
          {f.id && ((f as any).dayClockInAt || (f as any).lastShiftHours != null) && (
            <div className={"p-3 rounded-xl border text-xs " + ((f as any).dayClockInAt ? "bg-green-950/20 border-green-700/40 text-green-300" : "bg-black/30 border-white/10 text-white/50")}>
              {(f as any).dayClockInAt
                ? `On the clock since ${new Date((f as any).dayClockInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : (f as any).lastShiftHours != null && `Last shift: ${(f as any).lastShiftHours}h on ${(f as any).lastShiftDate || "—"}`}
            </div>
          )}

          {/* Pay — real hours pulled from this employee's completed jobs,
              broken into individually-markable 14-day pay periods. A period
              defaults to "unpaid" until the owner explicitly marks it paid;
              paidPeriods is keyed by the period's start date. */}
          {f.id && (() => {
            const empJobs = jobs.filter((j: any) => (j.crew || []).includes(f.id) && j.status === "completed" && Number(j.loggedHours) > 0);
            const paidPeriods: Record<string, "paid" | "unpaid"> = f.paidPeriods || {};
            const now = new Date();
            const periods = Array.from({ length: 6 }, (_, i) => {
              const end = new Date(now); end.setDate(end.getDate() - i * 14);
              const start = new Date(end); start.setDate(start.getDate() - 13);
              const s = start.toISOString().slice(0, 10);
              const e = end.toISOString().slice(0, 10);
              const pJobs = empJobs.filter((j: any) => j.scheduledDate >= s && j.scheduledDate <= e);
              const hrs = Math.round(pJobs.reduce((acc: number, j: any) => acc + Number(j.loggedHours || 0), 0) * 10) / 10;
              const pay = pJobs.reduce((acc: number, j: any) => acc + Number(j.loggedHours || 0) * getEffectiveRate(f, j), 0);
              return { start: s, end: e, label: i === 0 ? "Current" : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, hours: hrs, pay: Math.round(pay * 100) / 100, status: paidPeriods[s] || "unpaid" };
            }).filter(p => p.hours > 0);
            const totalPaid = periods.filter(p => p.status === "paid").reduce((s, p) => s + p.pay, 0);
            const pendingPay = periods.filter(p => p.status === "unpaid").reduce((s, p) => s + p.pay, 0);
            const togglePeriod = (start: string) => {
              const next = { ...paidPeriods, [start]: paidPeriods[start] === "paid" ? "unpaid" as const : "paid" as const };
              setF((p: any) => ({ ...p, paidPeriods: next }));
            };
            return (
              <div className="border border-white/10 rounded-xl p-3 space-y-2">
                <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5 mb-1"><DollarSign size={12} />Pay</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-green-950/20 border border-green-700/30">
                    <div className="text-[10px] text-green-400/70 uppercase">Total Paid</div>
                    <div className="text-lg font-black text-green-400">{fmt(totalPaid)}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-yellow-950/20 border border-yellow-700/30">
                    <div className="text-[10px] text-yellow-400/70 uppercase">Pending</div>
                    <div className="text-lg font-black text-yellow-400">{fmt(pendingPay)}</div>
                  </div>
                </div>
                {periods.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {periods.map(p => (
                      <div key={p.start} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-black/30 border border-white/5">
                        <div className="min-w-0">
                          <div className="text-xs text-white/70">{p.label}</div>
                          <div className="text-[10px] text-white/40">{p.hours}h · {fmt(p.pay)}</div>
                        </div>
                        <button onClick={() => togglePeriod(p.start)} className={"text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 transition " + (p.status === "paid" ? "bg-green-700 text-white" : "bg-yellow-950/40 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/40")}>
                          {p.status === "paid" ? "✓ Paid" : "Mark Paid"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Manager CRM permissions — only for role: Manager. Owner can change
              or fully revoke a manager's CRM access here anytime; setting
              status to Inactive above (or deleting the employee) removes CRM
              access entirely regardless of these toggles. */}
          {f.role === "Manager" && (
            <div className="border border-purple-700/30 rounded-xl p-3 bg-purple-950/10 space-y-1">
              <div className="text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5"><Shield size={12} />Manager CRM Access</div>
              <div className="text-[10px] text-white/40 mb-2">Full CRM access except these areas — check any you want to grant.</div>
              {MANAGER_CRM_PERM_DEFS.map(({ key, label, desc }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer py-1 group">
                  <input type="checkbox" checked={!!(f.managerPermissions || DEFAULT_MANAGER_PERMS)[key]} onChange={e => setF((p: any) => ({ ...p, managerPermissions: { ...(p.managerPermissions || DEFAULT_MANAGER_PERMS), [key]: e.target.checked } }))}
                    className="w-3.5 h-3.5 accent-purple-600 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-white/80 group-hover:text-white transition">{label}</div>
                    <div className="text-[10px] text-white/40">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {/* Permissions editor */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowEditPerms(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition"
            >
              <span className="flex items-center gap-1.5"><Shield size={12} />Portal Permissions</span>
              <span className="text-[10px] text-white/40">{showEditPerms ? "▲ collapse" : "▼ expand"}</span>
            </button>
            {showEditPerms && (
              <div className="px-3 pb-3 space-y-1 border-t border-white/10">
                <div className="flex gap-3 pt-2 pb-1">
                  <button onClick={() => setF((p: any) => ({ ...p, permissions: Object.fromEntries(PERMISSION_DEFS_EMP.map(d => [d.key, true])) }))} className="text-[10px] text-blue-400 hover:text-blue-300 transition">Select All</button>
                  <button onClick={() => setF((p: any) => ({ ...p, permissions: Object.fromEntries(PERMISSION_DEFS_EMP.map(d => [d.key, false])) }))} className="text-[10px] text-red-400 hover:text-red-300 transition">Deselect All</button>
                </div>
                {PERMISSION_DEFS_EMP.map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer py-1 group">
                    <input type="checkbox" checked={!!(f.permissions || DEFAULT_PERMS)[key]} onChange={e => setF((p: any) => ({ ...p, permissions: { ...(p.permissions || DEFAULT_PERMS), [key]: e.target.checked } }))}
                      className="w-3.5 h-3.5 accent-red-600 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-white/80 group-hover:text-white transition">{label}</div>
                      <div className="text-[10px] text-white/40">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
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

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
import { fmt, uid, today, localDateStr, shiftDayStr, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, getEffectiveRate, weekdayLabels, countDaysOffInRange } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
// BLOCKER 2/14 (mobile round 9) — crewIncludesEmployee is the same robust
// crew-matching helper the employee portal already uses (tolerates object-
// shaped crew entries, stringified-JSON crew columns, casing, and the
// employees.id vs employees.user_id mismatch). This page was comparing with
// a bare `(j.crew||[]).includes(e.id)`, which silently matched nothing
// whenever a job's crew array was written with a different id shape than
// this employee row's `id` — the root cause of "hours/payroll data exists
// in the console but the tab renders empty."
import { crewIncludesEmployee } from "./EmployeePortal";
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

export function EmployeesPage({ employees = [], setEmployees, jobs = [], customers = [], settings = {} as any, toast = (_msg: string, _tone?: string) => {}, autoOpenManagerInvite = false, onAutoOpenManagerInviteConsumed }: { employees?: any[]; setEmployees: any; jobs?: any[]; customers?: any[]; settings?: any; toast?: any; autoOpenManagerInvite?: boolean; onAutoOpenManagerInviteConsumed?: () => void }) {
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
    // Send invite email via the owner's connected Gmail account
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
      // Gmail not connected — link was still created
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

  // FIX 8 — "Add Manager" in Settings → Company jumps here with the invite
  // modal pre-opened and role defaulted to Manager, since the actual invite
  // form (permissions, CRM access, invite code) already lives on this page.
  useEffect(() => {
    if (!autoOpenManagerInvite) return;
    setInviteOpen(true);
    setInviteCreated(null);
    setInviteF({ firstName: "", lastName: "", email: "", role: "Manager", hourlyRate: 18 });
    setInvitePerms({ ...DEFAULT_PERMS });
    setInviteManagerPerms({ ...DEFAULT_MANAGER_PERMS });
    setShowInvitePerms(false);
    onAutoOpenManagerInviteConsumed?.();
  }, [autoOpenManagerInvite]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // FIX 4 — job.loggedHours (time on-site per job, see EmployeePortal.tsx's
  // finalizeCompletion) is the primary source, but employees.lastShiftHours/
  // lastShiftDate (the whole-day shift timer total, set on "End My Day") can
  // cover time no job captured at all — e.g. a shift ended before any job was
  // marked complete yet. The employees table only ever stores the SINGLE most
  // recent shift (no full daily history exists server-side), so this can only
  // top up that one day, but that's exactly the day most likely to be under-
  // counted mid-period. Only add the shortfall (shift total minus whatever
  // job hours already landed on that same date) so a shift that's already
  // fully reflected via completed jobs is never double-counted.
  const shiftTopUpHours = (emp: any, startDate: string, endDate: string): number => {
    // FIX 7 — an employee still clocked in (dayClockInAt set, "End My Day"
    // not pressed yet) previously contributed NOTHING to Hours/Payroll until
    // they actually ended their shift — lastShiftDate/lastShiftHours only
    // get written at that point (see EmployeePortal.tsx's toggleDay). That
    // made payroll look "stuck"/stale for anyone currently on the clock.
    // Mirrors EmployeePortal.tsx's own live netShiftHoursNow formula exactly
    // (dayClockInAt → now, minus paused/lunch minutes) so the two can't
    // disagree once the shift actually ends and lastShiftHours is written.
    let liveTopUp = 0;
    // BLOCKER 13 (mobile round 9) — shiftDayStr() (4am cutover), matching
    // how EmployeePortal.tsx's toggleDay now writes lastShiftDate, so a
    // shift straddling local midnight is treated as the same shift day on
    // both the employee and owner sides (otherwise this top-up and the
    // employee's own Resume-Day check could disagree right around midnight).
    const todayStr = shiftDayStr();
    if (emp?.dayClockInAt && todayStr >= startDate && todayStr <= endDate) {
      const dayPausedMinutes = Number(emp.dayPausedMinutes) || 0;
      const onLunch = !!emp.dayLunchStartAt;
      const currentPauseMs = onLunch ? Date.now() - emp.dayLunchStartAt : 0;
      const liveShiftHours = Math.max(0, (Date.now() - emp.dayClockInAt - dayPausedMinutes * 60000 - currentPauseMs) / 3600000);
      const jobHoursToday = jobs
        .filter((j: any) => crewIncludesEmployee(j.crew, emp.id, emp.user_id) && j.status === "completed" && j.scheduledDate === todayStr)
        .reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
      liveTopUp = Math.max(0, liveShiftHours - jobHoursToday);
    }
    const shiftDate = emp?.lastShiftDate;
    if (!shiftDate || shiftDate < startDate || shiftDate > endDate) return liveTopUp;
    const jobHoursOnShiftDate = jobs
      .filter((j: any) => crewIncludesEmployee(j.crew, emp.id, emp.user_id) && j.status === "completed" && j.scheduledDate === shiftDate)
      .reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
    const shiftTotal = Number(emp.lastShiftHours) || 0;
    const endedShiftTopUp = Math.max(0, shiftTotal - jobHoursOnShiftDate);
    // If the employee is currently clocked in for today AND has a
    // lastShiftDate that's also today (started, ended, then started again the
    // same day), don't double-count — the live figure already supersedes it.
    return shiftDate === todayStr && emp?.dayClockInAt ? liveTopUp : liveTopUp + endedShiftTopUp;
  };

  // Calculate real hours from jobs (loggedHours on jobs they're crewed on),
  // plus any uncaptured whole-day shift time (see shiftTopUpHours above).
  const getEmployeeHours = (empId, startDate, endDate) => {
    const emp = employees.find((e: any) => e.id === empId);
    const jobHours = jobs
      .filter(j => crewIncludesEmployee(j.crew, empId, emp?.user_id) && j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate)
      .reduce((s, j) => s + Number(j.loggedHours || j.duration || 0), 0);
    const topUp = emp ? shiftTopUpHours(emp, startDate, endDate) : 0;
    return jobHours + topUp;
  };

  // Pay must respect per-job-type rate overrides (getEffectiveRate), so it's
  // computed per-job (hours × that job's effective rate) then summed — a flat
  // hours-total × hourlyRate would ignore commercial/residential overrides.
  // The shift-timer top-up isn't tied to any one job, so it's paid at the
  // employee's plain hourlyRate.
  const getEmployeePay = (emp: any, startDate: string, endDate: string) => {
    // BLOCKER 10 (mobile round 9) — owner-only alternate pay bases. Revenue
    // and profit are computed company-wide across all completed jobs in the
    // pay period (not just jobs the owner personally worked), since "% of
    // revenue/profit" describes how the business compensates its owner, not
    // a per-job labor rate the way hourlyRate is for crew. Profit reuses the
    // same chemCost + laborCost + materialCost formula JobsPage's own
    // per-job "Profit breakdown" panel uses, so the two can't disagree.
    if (emp.role === "owner" && emp.payBasis && emp.payBasis !== "hourly") {
      if (emp.payBasis === "custom") return Number(emp.payCustomAmount) || 0;
      const periodJobs = jobs.filter((j: any) => j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate);
      const revenue = periodJobs.reduce((s: number, j: any) => s + (Number(j.amount) || 0), 0);
      const pct = (Number(emp.payPercent) || 0) / 100;
      if (emp.payBasis === "percent_revenue") return revenue * pct;
      if (emp.payBasis === "percent_profit") {
        const costs = periodJobs.reduce((s: number, j: any) => {
          const chemCost = (j.chemicalsUsed || []).reduce((cs: number, ch: any) => cs + Number(ch.cost || 0), 0);
          return s + chemCost + Number(j.laborCost || 0) + Number(j.materialCost || 0);
        }, 0);
        return Math.max(0, revenue - costs) * pct;
      }
    }
    const jobPay = jobs
      .filter((j: any) => crewIncludesEmployee(j.crew, emp.id, emp.user_id) && j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate)
      .reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0) * getEffectiveRate(emp, j), 0);
    const topUp = shiftTopUpHours(emp, startDate, endDate);
    const topUpPay = topUp * (Number(emp.hourlyRate) || 0);
    if (topUp > 0) {
    }
    return jobPay + topUpPay;
  };

  // FIX 5 (mobile round 5) — was a strict e.status === "active" allowlist,
  // the same brittleness Dashboard.tsx's Live Crew View already learned not
  // to use (see its FIX 1 comment): any employee whose status field is
  // unset, differently-cased, or otherwise not the exact string "active"
  // silently vanished from Hours/Payroll — while the Team list above has no
  // status filter at all, so the same employee still showed up there,
  // making it look like "hours aren't showing" even though the underlying
  // job/pay math was correct the whole time. Only an explicit "inactive"
  // should ever exclude someone.
  const totalPayroll = employees.filter(e => e.status !== "inactive").reduce((s, e) => {
    return s + getEmployeePay(e, payPeriodStart, payPeriodEnd);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-black/40 border border-red-900/30 rounded-xl p-1">
            {["list","hours","payroll"].map(v => <button key={v} onClick={() => setView(v)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition " + (view === v ? "bg-gradient-to-r from-red-600 to-red-800 text-white" : "text-white/50 hover:text-white")}>{v === "hours" ? "⏱ Hours" : v === "payroll" ? "💰 Payroll" : "👥 Team"}</button>)}
          </div>
          <div className="text-xs text-white/50">{employees.filter(e => e.status !== "inactive").length} active</div>
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
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-base font-bold flex-shrink-0">{e.firstName?.[0]}{e.lastName?.[0]}</div>
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
              {employees.filter(e => e.status !== "inactive").map(e => {
                const empJobs = jobs.filter(j => crewIncludesEmployee(j.crew, e.id, (e as any).user_id) && j.status === "completed" && j.scheduledDate >= payPeriodStart && j.scheduledDate <= payPeriodEnd);
                // FIX 5 (mobile round 5) — was job.loggedHours only, missing
                // the shift-timer top-up getEmployeeHours (used everywhere
                // else in this file, e.g. the Payroll tab/CSV export below)
                // already accounts for — an employee currently clocked in, or
                // who ended a shift without every minute captured on a
                // completed job, showed fewer "Period Hours" here than their
                // actual Payroll-tab total.
                const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
                const cost = getEmployeePay(e, payPeriodStart, payPeriodEnd);
                // BLOCKER 2 (mobile round 9) — trace: confirms whether crew
                // matching is actually finding this employee's jobs. If
                // empJobs.length is 0 while jobs.length (all completed jobs
                // company-wide) is nonzero, crew matching is still broken.
                console.log("[Hours]", e.firstName, e.lastName, "— matched jobs:", empJobs.length, "of", jobs.filter((j: any) => j.status === "completed").length, "completed company-wide · period hrs:", hrs.toFixed(2), "· pay:", cost.toFixed(2));
                const todayStr = today();
                const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
                const allCompleted = jobs.filter((j: any) => crewIncludesEmployee(j.crew, e.id, (e as any).user_id) && j.status === "completed");
                const hoursToday = allCompleted.filter((j: any) => j.scheduledDate === todayStr).reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
                const hoursWeek = allCompleted.filter((j: any) => j.scheduledDate >= weekStart).reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
                return <tr key={e.id} className="border-b border-red-900/10 hover:bg-white/5">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-xs font-bold">{e.firstName?.[0]}</div>{e.firstName} {e.lastName}{(e as any).dayClockInAt && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" title="On the clock now" />}</div></td>
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
            const rows = employees.filter(e => e.status !== "inactive").map(e => {
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
          {employees.filter(e => e.status !== "inactive").map(e => {
            const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
            const gross = getEmployeePay(e, payPeriodStart, payPeriodEnd);
            const fica = gross * 0.0765;
            const net = gross - fica;
            const empJobs = jobs.filter(j => crewIncludesEmployee(j.crew, e.id, (e as any).user_id) && j.status === "completed" && j.scheduledDate >= payPeriodStart && j.scheduledDate <= payPeriodEnd);
            return <Glass key={e.id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-bold">{e.firstName?.[0]}{e.lastName?.[0]}</div>
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
          {/* BLOCKER 10 (mobile round 9) — "owner can set how they pay
              themselves (hourly, % profit, % revenue, custom)". Only shown
              for the owner's own record — a technician's pay stays plain
              hourly (with the job-type overrides above). getEmployeePay
              below branches on payBasis for role === "owner" only. */}
          {f.role === "owner" && (
            <div className="border border-purple-700/30 rounded-xl p-3 bg-purple-950/10 space-y-2">
              <div className="text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5"><DollarSign size={12} />How You Get Paid</div>
              <GSel value={f.payBasis || "hourly"} onChange={e => setF({ ...f, payBasis: e.target.value })}>
                <option value="hourly" className="bg-black">Hourly (same as crew, rate above)</option>
                <option value="percent_revenue" className="bg-black">% of revenue</option>
                <option value="percent_profit" className="bg-black">% of profit</option>
                <option value="custom" className="bg-black">Custom flat amount per period</option>
              </GSel>
              {(f.payBasis === "percent_revenue" || f.payBasis === "percent_profit") && (
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block">Percent (%)</label>
                  <GInput type="number" min="0" max="100" step="0.5" value={f.payPercent ?? ""} onChange={e => setF({ ...f, payPercent: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="e.g. 20" />
                  <div className="text-[9px] text-white/40 mt-1">
                    {f.payBasis === "percent_revenue"
                      ? "% of completed-job revenue in the selected pay period."
                      : "% of profit (completed-job revenue minus logged chemical/labor/material costs) in the selected pay period."}
                  </div>
                </div>
              )}
              {f.payBasis === "custom" && (
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block">Flat amount per pay period ($)</label>
                  <GInput type="number" min="0" step="10" value={f.payCustomAmount ?? ""} onChange={e => setF({ ...f, payCustomAmount: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="e.g. 1500" />
                </div>
              )}
            </div>
          )}
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

          {/* FEATURE 5 — owner-set days-off caps. Enforcement is informational
              (a badge comparing actual days off taken to the cap), not a hard
              block — the employee still sets their own availability from the
              portal Calendar tab; this just gives the owner visibility. */}
          <div className="border border-white/10 rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5 mb-1"><Calendar size={12} />Days Off Limits</div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-white/50 mb-1 block">Max days off / week</label><GInput type="number" min="0" step="1" value={f.maxDaysOffPerWeek ?? ""} onChange={e => setF({ ...f, maxDaysOffPerWeek: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="No limit" /></div>
              <div><label className="text-[10px] text-white/50 mb-1 block">Max days off / month</label><GInput type="number" min="0" step="1" value={f.maxDaysOffPerMonth ?? ""} onChange={e => setF({ ...f, maxDaysOffPerMonth: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="No limit" /></div>
            </div>
            {f.id && (() => {
              const now = new Date();
              const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
              const weekStartStr = weekStart.toISOString().slice(0, 10);
              const weekEndStr = today();
              const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
              const weekTaken = countDaysOffInRange(f, weekStartStr, weekEndStr);
              const monthTaken = countDaysOffInRange(f, monthStartStr, weekEndStr);
              const weekOver = f.maxDaysOffPerWeek != null && weekTaken > f.maxDaysOffPerWeek;
              const monthOver = f.maxDaysOffPerMonth != null && monthTaken > f.maxDaysOffPerMonth;
              const recurring: number[] = f.recurringDaysOff || [];
              return (
                <div className="text-[10px] space-y-1">
                  <div className={weekOver ? "text-red-400" : "text-white/50"}>
                    This week: {weekTaken}{f.maxDaysOffPerWeek != null ? ` / ${f.maxDaysOffPerWeek}` : ""} day{weekTaken !== 1 ? "s" : ""} off{weekOver ? " ⚠ over limit" : ""}
                  </div>
                  <div className={monthOver ? "text-red-400" : "text-white/50"}>
                    This month: {monthTaken}{f.maxDaysOffPerMonth != null ? ` / ${f.maxDaysOffPerMonth}` : ""} day{monthTaken !== 1 ? "s" : ""} off{monthOver ? " ⚠ over limit" : ""}
                  </div>
                  {recurring.length > 0 && <div className="text-white/40">Recurring days off: {recurring.map((d: number) => weekdayLabels[d]).join(", ")}</div>}
                  <div className="text-white/30">Set from the employee's own portal → Calendar → Availability.</div>
                </div>
              );
            })()}
          </div>

          {/* Pay — real hours pulled from this employee's completed jobs,
              broken into individually-markable 14-day pay periods. A period
              defaults to "unpaid" until the owner explicitly marks it paid;
              paidPeriods is keyed by the period's start date. */}
          {f.id && (() => {
            const empJobs = jobs.filter((j: any) => crewIncludesEmployee(j.crew, f.id, (f as any).user_id) && j.status === "completed" && Number(j.loggedHours) > 0);
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
            // FIX 7 — "Mark Paid" previously only updated the modal's local
            // `f` state, which was silently lost unless the owner also
            // clicked the modal's separate Save button afterward — nothing
            // reached Supabase, so the employee's own Pay tab (which reads
            // straight from Supabase) never reflected it and the button
            // looked like it "did nothing." Write straight to Supabase (and
            // the live `employees` state) the moment it's clicked.
            const togglePeriod = (start: string) => {
              const next = { ...paidPeriods, [start]: paidPeriods[start] === "paid" ? "unpaid" as const : "paid" as const };
              setF((p: any) => ({ ...p, paidPeriods: next }));
              setEmployees((prev: any[]) => prev.map(e => e.id === f.id ? { ...e, paidPeriods: next } : e));
              (supabase as any).from("employees").update({ paidPeriods: next }).eq("id", f.id)
                .then((r: any) => {
                  if (r?.error) { console.error("[MarkPaid] failed:", r.error.message); toast?.("Failed to save pay status — " + r.error.message, "red"); }
                  else toast?.(next[start] === "paid" ? "Marked as paid ✓" : "Marked as unpaid", "green");
                })
                .catch((e: any) => { console.error("[MarkPaid] threw:", e?.message); toast?.("Failed to save pay status — " + (e?.message || "unknown error"), "red"); });
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
          {/* FIX 2 (mobile round 6) — "individual job breakdown with hours per
              job": the period/day sections above only ever aggregate; this is
              the actual per-job list (one row per completed job with logged
              hours), most recent first. */}
          {f.id && (() => {
            const jobRows = jobs
              .filter((j: any) => crewIncludesEmployee(j.crew, f.id, (f as any).user_id) && j.status === "completed" && Number(j.loggedHours) > 0)
              .sort((a: any, b: any) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""))
              .slice(0, 25);
            if (jobRows.length === 0) return null;
            return (
              <div className="border border-white/10 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5 mb-1"><Briefcase size={12} />Job Breakdown</div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {jobRows.map((j: any) => {
                    const cust = customers?.find?.((c: any) => c.id === j.customerId);
                    const hrs = Number(j.loggedHours) || 0;
                    const pay = hrs * getEffectiveRate(f, j);
                    return (
                      <div key={j.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/5 text-xs">
                        <div className="min-w-0">
                          <div className="text-white/70 truncate">{cust ? `${cust.firstName} ${cust.lastName}` : (j.address || "Job")}</div>
                          <div className="text-[10px] text-white/40">{j.scheduledDate}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-white/70">{hrs.toFixed(1)}h</div>
                          <div className="text-[10px] text-white/40">{fmt(pay)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {/* FIX 3 — daily breakdown, parallel to the 14-day periods above but
              per individual day (employees.paidDays), matching what the
              employee sees in their own Pay tab calendar. */}
          {f.id && (() => {
            const paidDays: Record<string, "paid" | "unpaid"> = f.paidDays || {};
            const days = Array.from({ length: 14 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - i);
              const key = d.toISOString().slice(0, 10);
              const dayJobs = jobs.filter((j: any) => crewIncludesEmployee(j.crew, f.id, (f as any).user_id) && j.scheduledDate === key && Number(j.loggedHours) > 0);
              const hours = Math.round(dayJobs.reduce((s: number, j: any) => s + Number(j.loggedHours || 0), 0) * 100) / 100;
              const pay = Math.round(dayJobs.reduce((s: number, j: any) => s + Number(j.loggedHours || 0) * getEffectiveRate(f, j), 0) * 100) / 100;
              return { key, label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), hours, pay, status: paidDays[key] || "unpaid" };
            }).filter(d => d.hours > 0);
            // FIX 7 — same immediate-write fix as togglePeriod above: this
            // must reach Supabase the moment it's clicked, not wait on the
            // modal's separate Save button.
            const toggleDay = (key: string) => {
              const next = { ...paidDays, [key]: paidDays[key] === "paid" ? "unpaid" as const : "paid" as const };
              setF((p: any) => ({ ...p, paidDays: next }));
              setEmployees((prev: any[]) => prev.map(e => e.id === f.id ? { ...e, paidDays: next } : e));
              (supabase as any).from("employees").update({ paidDays: next }).eq("id", f.id)
                .then((r: any) => {
                  if (r?.error) { console.error("[MarkPaid] failed:", r.error.message); toast?.("Failed to save pay status — " + r.error.message, "red"); }
                  else toast?.(next[key] === "paid" ? "Marked as paid ✓" : "Marked as unpaid", "green");
                })
                .catch((e: any) => { console.error("[MarkPaid] threw:", e?.message); toast?.("Failed to save pay status — " + (e?.message || "unknown error"), "red"); });
            };
            if (days.length === 0) return null;
            return (
              <div className="border border-white/10 rounded-xl p-3 space-y-2">
                <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5 mb-1"><Calendar size={12} />Daily Breakdown (last 14 days)</div>
                <div className="space-y-1.5">
                  {days.map(d => (
                    <div key={d.key} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-black/30 border border-white/5">
                      <div className="min-w-0">
                        <div className="text-xs text-white/70">{d.label}</div>
                        <div className="text-[10px] text-white/40">{d.hours}h · {fmt(d.pay)}</div>
                      </div>
                      <button onClick={() => toggleDay(d.key)} className={"text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 transition " + (d.status === "paid" ? "bg-green-700 text-white" : "bg-yellow-950/40 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/40")}>
                        {d.status === "paid" ? "✓ Paid" : "Mark Paid"}
                      </button>
                    </div>
                  ))}
                </div>
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

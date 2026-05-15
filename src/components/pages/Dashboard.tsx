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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, forecastFor, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";

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

export function Dashboard({ jobs = [], customers = [], estimates = [], automations = [], stats, goals, vehicles = [], maintenance = [], chemicals = [], settings = {} as AppSettings, setSettings = () => {}, onNav, toast, weatherData = seedWeather, inboxThreads = [] }: { jobs?: any[]; customers?: any[]; estimates?: any[]; automations?: any[]; stats?: any; goals?: any; vehicles?: any[]; maintenance?: any[]; chemicals?: any[]; settings?: AppSettings; setSettings?: any; onNav?: any; toast?: any; weatherData?: any; inboxThreads?: any[] }) {
  const pipelineVal = jobs.filter(j => j.status !== "completed").reduce((s, j) => s + j.amount, 0);
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const runRate = dayOfMonth > 0 ? Math.round((stats.totalRev / dayOfMonth) * daysInMonth) : 0;
  const forecast = Math.max(runRate, Math.round(pipelineVal * (stats.closeRate / 100 || 0.6)));

  const nowD = new Date();
  const weekStart = new Date(nowD); weekStart.setDate(nowD.getDate() - nowD.getDay());
  const monthStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  const completedJobs = jobs.filter(j => j.status === "completed");
  const revToday = completedJobs.filter(j => j.scheduledDate === today()).reduce((s, j) => s + j.amount, 0);
  const revWeek = completedJobs.filter(j => new Date(j.scheduledDate) >= weekStart).reduce((s, j) => s + j.amount, 0);
  const revMonth = completedJobs.filter(j => new Date(j.scheduledDate) >= monthStart).reduce((s, j) => s + j.amount, 0);
  const avgJobVal = completedJobs.length > 0 ? completedJobs.reduce((s, j) => s + j.amount, 0) / completedJobs.length : 0;

  // Year-over-year comparison
  const thisYearStart = new Date(nowD.getFullYear(), 0, 1).toISOString().slice(0,10);
  const lastYearStart = new Date(nowD.getFullYear()-1, 0, 1).toISOString().slice(0,10);
  const lastYearEnd = new Date(nowD.getFullYear()-1, nowD.getMonth(), nowD.getDate()).toISOString().slice(0,10);
  const revThisYear = completedJobs.filter(j => j.scheduledDate >= thisYearStart).reduce((s,j) => s+j.amount, 0);
  const revLastYear = completedJobs.filter(j => j.scheduledDate >= lastYearStart && j.scheduledDate <= lastYearEnd).reduce((s,j) => s+j.amount, 0);
  const yoyPct = revLastYear > 0 ? Math.round((revThisYear - revLastYear) / revLastYear * 100) : null;

  const outstanding = jobs.filter(j => j.status === "scheduled" || j.status === "in_progress").slice(0, 5);
  const outTotal = outstanding.reduce((s, j) => s + j.amount, 0);
  const tKey = today();
  const in7 = daysFromNow(7);
  const upcoming = jobs.filter(j => j.scheduledDate >= tKey && j.scheduledDate <= in7 && j.status !== "cancelled").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 5);
  const pending = estimates.filter(e => e.status === "pending").slice(0, 4);

  // Recent activity from live state
  // 6-month revenue from actual completed jobs
  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const monthKey = d.toISOString().slice(0, 7); // "2025-05"
    const monthJobs = completedJobs.filter(j => (j.scheduledDate || "").startsWith(monthKey));
    return {
      month: d.toLocaleDateString("en-US", { month: "short" }),
      revenue: monthJobs.reduce((s, j) => s + j.amount, 0),
      jobs: monthJobs.length,
    };
  });
  const hasAnyRevData = revenueByMonth.some(r => r.revenue > 0);

  // Real activity feed — build from actual CRM data sorted by recency
  const activity = (() => {
    const events = [];
    // Recent jobs
    jobs.filter(j => j.scheduledDate).slice(-10).forEach(j => {
      const c = customers.find(x => x.id === j.customerId);
      const name = c ? c.firstName + " " + c.lastName : "Customer";
      if (j.status === "completed") events.push({ date: j.scheduledDate, text: "✅ Completed: " + name + " — " + j.address?.split(",")[0], amount: j.amount, icon: CheckCircle });
      else if (j.status === "scheduled") events.push({ date: j.scheduledDate, text: "📅 Scheduled: " + name, amount: j.amount, icon: Calendar });
      else if (j.status === "cancelled") events.push({ date: j.scheduledDate, text: "❌ Cancelled: " + name + (j.noShow ? " (no-show)" : ""), icon: Ban });
    });
    // Recent estimates
    estimates.filter(e => e.createdAt).slice(-8).forEach(e => {
      const c = customers.find(x => x.id === e.customerId);
      const name = c ? c.firstName + " " + c.lastName : "Customer";
      if (e.status === "approved") events.push({ date: e.signedAt || e.createdAt, text: "✍️ Signed: " + name + " — estimate approved", amount: e.total, icon: FileText });
      else if (e.paidAt) events.push({ date: e.paidAt, text: "💳 Paid: " + name, amount: e.total, icon: DollarSign });
      else events.push({ date: e.createdAt, text: "📋 Estimate sent: " + name, amount: e.total, icon: FileText });
    });
    // Recent customers
    customers.filter(c => c.createdAt && daysSince(c.createdAt) <= 30).slice(-5).forEach(c => {
      events.push({ date: c.createdAt, text: "👤 New customer: " + c.firstName + " " + c.lastName + (c.leadSource ? " via " + c.leadSource : ""), icon: Users });
    });
    // Recent payments
    estimates.filter(e => e.paidAt && daysSince(e.paidAt) <= 14).forEach(e => {
      const c = customers.find(x => x.id === e.customerId);
      events.push({ date: e.paidAt, text: "💰 Payment received: " + (c ? c.firstName + " " + c.lastName : "Customer"), amount: e.total + (e.tip || 0), icon: DollarSign });
    });
    return events.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8);
  })();

  const wAlerts = [];
  const wForecast = (weatherData?.forecast || seedWeather.forecast);
  const wCurrent = (weatherData?.current || seedWeather.current);
  wForecast.forEach(f => {
    if (f.rainChance > 50) wAlerts.push({ type: "rain", day: f.day, msg: f.rainChance + "% rain", icon: "🌧️" });
    if ((f.lowTemp || f.temp) <= 32) wAlerts.push({ type: "freeze", day: f.day, msg: "Freeze " + (f.lowTemp || f.temp) + "°F", icon: "🥶" });
    if (f.wind >= 15) wAlerts.push({ type: "wind", day: f.day, msg: "Wind " + f.wind + "mph", icon: "💨" });
    if (f.temp >= 90) wAlerts.push({ type: "hot", day: f.day, msg: "🌡️ " + f.temp + "°F — HOT SURFACE WARNING: SH may flash dry. Schedule early AM or after 6pm. Pre-wet surfaces.", icon: "🥵" });
    else if (f.temp >= 85) wAlerts.push({ type: "hot", day: f.day, msg: f.temp + "°F — surfaces may be warm. Pre-wet before applying SH.", icon: "☀️" });
  });
  const bestDay = wForecast.find(f => f.rainChance < 30 && f.temp >= 45 && f.temp < 85 && f.wind < 15 && (f.lowTemp || f.temp) > 32);

  const revPct = Math.round((stats.totalRev / goals.revenue) * 100);
  const jobsPct = Math.round((stats.doneMonth / goals.jobCount) * 100);

  // Smart alerts: maintenance due, low stock, urgent jobs, stale quotes, weather risk
  const alerts = [];

  // Vehicle maintenance
  if (settings.notifyMaintenance !== false) {
    vehicles.forEach(v => {
      const logs = (Array.isArray(maintenance) ? maintenance : []).filter(m => m.vehicleId === v.id);
      const lastOil = logs.filter(l => l.type === "Oil Change").sort((a, b) => b.date.localeCompare(a.date))[0];
      const milesSince = lastOil ? (v.mileage - lastOil.mileage) : 999999;
      const daysSinceOil = lastOil ? daysSince(lastOil.date) : 999;
      if (milesSince >= 5000 || daysSinceOil >= 90) {
        alerts.push({ key: "mnt-" + v.id, icon: Truck, tone: "yellow", msg: v.name + " oil change due (" + (lastOil ? milesSince.toLocaleString() + "mi since" : "never logged") + ")", action: () => onNav("fleet") });
      }
    });
  }

  // Low chemical stock
  if (settings.notifyLowStock !== false) {
    const low = chemicals.filter(c => c.stock <= c.reorderLevel);
    if (low.length > 0) alerts.push({ key: "stock", icon: FlaskConical, tone: "red", msg: low.length + " chemical" + (low.length > 1 ? "s" : "") + " at reorder: " + low.map(c => c.name.split(" ")[0]).slice(0, 3).join(", "), action: () => onNav("chemicals") });
  }

  // Urgent jobs
  const urgentJobs = jobs.filter(j => j.priority === "urgent" && j.status !== "completed" && j.status !== "cancelled");
  if (urgentJobs.length > 0) alerts.push({ key: "urgent", icon: AlertCircle, tone: "red", msg: urgentJobs.length + " urgent job" + (urgentJobs.length > 1 ? "s" : "") + " need attention", action: () => onNav("jobs") });

  // Stale quotes
  const staleQuotes = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7);
  if (staleQuotes.length > 0) alerts.push({ key: "stale", icon: FileText, tone: "yellow", msg: staleQuotes.length + " quote" + (staleQuotes.length > 1 ? "s" : "") + " over 7 days old — follow up", action: () => onNav("estimates") });

  // Weather
  if (settings.notifyWeather !== false) {
    const rainyDays = wForecast.filter(f => f.rainChance >= 70).map(f => f.day);
    if (rainyDays.length > 0) {
      const atRisk = jobs.filter(j => j.status === "scheduled").length;
      if (atRisk > 0) alerts.push({ key: "wx", icon: Cloud, tone: "blue", msg: "Rain forecast: " + rainyDays.join(", ") + " — check scheduled jobs", action: () => onNav("calendar") });
    }
  }

  // Overdue invoices
  const overdueInv = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14);
  if (overdueInv.length > 0) alerts.push({ key: "overdue", icon: Receipt, tone: "red", msg: overdueInv.length + " invoice" + (overdueInv.length !== 1 ? "s" : "") + " overdue " + (overdueInv.length === 1 ? daysSince(overdueInv[0].invoicedAt) + "d" : ""), action: () => onNav("invoices") });

  // Expired estimates
  const expiredEst = estimates.filter(e => e.status === "pending" && e.validUntil && daysSince(e.validUntil) > 0);
  if (expiredEst.length > 0) alerts.push({ key: "expired", icon: Clock, tone: "yellow", msg: expiredEst.length + " estimate" + (expiredEst.length !== 1 ? "s" : "") + " expired — send new quote", action: () => onNav("estimates") });

  // Today's jobs reminder
  const todayStr = today();
  const todayJobs = jobs.filter(j => j.scheduledDate === todayStr && j.status === "scheduled");
  if (todayJobs.length > 0) alerts.push({ key: "today", icon: Calendar, tone: "blue", msg: todayJobs.length + " job" + (todayJobs.length !== 1 ? "s" : "") + " scheduled today — check route", action: () => onNav("jobs") });

  // Stale pipeline leads
  const staleLeads = jobs.filter(j => ["lead","contacted","estimate_sent"].includes(j.pipelineStage) && daysSince(j.stageChangedAt || j.scheduledDate || j.createdAt) >= 14);
  if (staleLeads.length > 0) alerts.push({ key: "staleleads", icon: Activity, tone: "orange", msg: staleLeads.length + " pipeline lead" + (staleLeads.length !== 1 ? "s" : "") + " inactive 14+ days", action: () => onNav("pipeline") });

  // Unread inbox messages
  const unreadCount = (typeof inboxThreads !== "undefined" ? inboxThreads : []).filter(t => t.unread).length;
  if (unreadCount > 0) alerts.push({ key: "inbox", icon: MessageSquare, tone: "blue", msg: unreadCount + " unread message" + (unreadCount !== 1 ? "s" : "") + " in inbox", action: () => onNav("inbox") });

  // Low chemical stock alert
  const lowStock = (typeof chemicals !== "undefined" ? chemicals : []).filter(c => c.stock <= c.reorderLevel);
  if (lowStock.length > 0) alerts.push({ key: "lowstock", icon: FlaskConical, tone: "yellow", msg: lowStock.length + " chemical" + (lowStock.length !== 1 ? "s" : "") + " low — " + lowStock[0]?.name + " needs reorder", action: () => onNav("chemicals") });

  // Fleet maintenance due
  const maintDueFleet = (typeof vehicles !== "undefined" ? vehicles : []).filter(v => {
    const lastOil = (typeof maintenance !== "undefined" ? maintenance : []).filter(m => m.vehicleId === v.id && (m.type||"").toLowerCase().includes("oil")).sort((a,b) => b.date?.localeCompare(a.date))[0];
    return !lastOil || daysSince(lastOil.date) > 90;
  });
  if (maintDueFleet.length > 0) alerts.push({ key: "fleet", icon: Truck, tone: "yellow", msg: maintDueFleet.length + " vehicle" + (maintDueFleet.length !== 1 ? "s" : "") + " due for oil change", action: () => onNav("fleet") });

  // No-shows this week
  const recentNoShows = (typeof jobs !== "undefined" ? jobs : []).filter(j => j.noShow && daysSince(j.scheduledDate) <= 7);
  if (recentNoShows.length > 0) alerts.push({ key: "noshow", icon: AlertTriangle, tone: "red", msg: recentNoShows.length + " no-show" + (recentNoShows.length !== 1 ? "s" : "") + " this week — follow up", action: () => onNav("jobs") });

  // Unsigned estimates (sent but not signed in 48h)
  const unsignedEst = (typeof estimates !== "undefined" ? estimates : []).filter(e => e.status === "pending" && e.sentAt && daysSince(e.sentAt) >= 2 && !e.signedAt);
  if (unsignedEst.length > 0) alerts.push({ key: "unsigned", icon: FileText, tone: "yellow", msg: unsignedEst.length + " estimate" + (unsignedEst.length !== 1 ? "s" : "") + " sent but not signed (48h+)", action: () => onNav("estimates") });

  const toneClass = t => ({
    red: "bg-red-950/30 border-red-600/50 text-red-300",
    yellow: "bg-yellow-950/20 border-yellow-700/40 text-yellow-300",
    blue: "bg-blue-950/20 border-blue-700/40 text-blue-300",
    orange: "bg-orange-950/20 border-orange-700/40 text-orange-300",
    green: "bg-green-950/20 border-green-700/40 text-green-300"
  }[t] || "bg-white/5 border-white/10 text-white/70");

  const w: any = settings.dashboardWidgets || { quickActions: true, kpis: true, revenuePeriods: true, goals: true, outstanding: true, charts: true, activity: true };
  const [custOpen, setCustOpen] = useState(false);
  const widgetDefs = [
    { k: "quickActions", l: "Quick Actions" },
    { k: "kpis", l: "KPI Cards" },
    { k: "revenuePeriods", l: "Revenue Periods" },
    { k: "yoy", l: "Year-over-Year" },
    { k: "goals", l: "Goals & Forecast" },
    { k: "invoices", l: "Outstanding Invoices" },
    { k: "weather", l: "Weather Widget" },
    { k: "outstanding", l: "Outstanding / Upcoming" },
    { k: "charts", l: "Charts & Weather" },
    { k: "activity", l: "Recent Activity" }
  ];
  const toggleWidget = k => {
    const next = { ...w, [k]: !w[k] };
    setSettings(s => ({ ...s, dashboardWidgets: next }));
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="text-xs text-white/40 mt-0.5">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setCustOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border border-red-900/30 rounded-xl text-xs text-white/50 hover:text-white hover:border-red-600/50 transition"
              title="Customize widgets"
            >
              <Settings size={12} />Widgets
            </button>
            {custOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCustOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl z-50 overflow-hidden p-2 space-y-1">
                  {widgetDefs.map(wd => (
                    <button key={wd.k} onClick={() => toggleWidget(wd.k)} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-lg text-xs text-left">
                      <div className={"w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 " + (w[wd.k] !== false ? "bg-red-600 border-red-500" : "border-white/30")}>
                        {w[wd.k] !== false && <span className="text-[8px]">✓</span>}
                      </div>
                      <span className={w[wd.k] !== false ? "text-white/80" : "text-white/40"}>{wd.l}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Smart alerts - compact single row */}
      {alerts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {alerts.slice(0, 5).map(a => {
            const Icon = a.icon;
            return <button key={a.key} onClick={a.action} className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs hover:scale-[1.02] transition " + toneClass(a.tone)}>
              <Icon size={11} className="flex-shrink-0" />
              <span className="max-w-[200px] truncate">{a.msg}</span>
            </button>;
          })}
          {alerts.length > 5 && <span className="text-xs text-white/40 self-center">+{alerts.length - 5} more</span>}
        </div>
      )}

      {/* Top row: quick actions + revenue periods */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <button onClick={() => onNav("estimates")} className="btn-hover glass-hover bg-gradient-to-br from-red-600 to-red-900 border border-red-500/50 rounded-2xl p-4 text-left shadow-lg">
          <FileText size={18} className="mb-2" />
          <div className="font-bold text-sm">New Estimate</div>
          <div className="text-[10px] text-red-200/70">Quick create</div>
        </button>
        <button onClick={() => onNav("jobs")} className="btn-hover glass-hover bg-black/40 border border-red-900/30 rounded-2xl p-4 text-left">
          <Briefcase size={18} className="mb-2 text-red-400" />
          <div className="font-bold text-sm">Schedule Job</div>
          <div className="text-[10px] text-white/50">Add to calendar</div>
        </button>
        {(() => {
          const todayRoute = jobs.filter(j => j.scheduledDate === tKey && j.status === "scheduled");
          if (todayRoute.length === 0) return null;
          const mapsUrl = "https://www.google.com/maps/dir/" + todayRoute.map(j => encodeURIComponent(j.address || "")).join("/");
          return <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-hover glass-hover bg-black/40 border border-blue-900/30 rounded-2xl p-4 text-left hover:border-blue-600/50 transition">
            <Navigation size={18} className="mb-2 text-blue-400" />
            <div className="font-bold text-sm">{todayRoute.length} Stop Route</div>
            <div className="text-[10px] text-blue-300/70">Open in Maps</div>
          </a>;
        })()}
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">📅 Today</div>
          <div className="text-2xl font-bold text-red-400">{fmt(revToday)}</div>
          <div className="text-[10px] text-white/40">{todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""} scheduled</div>
        </Glass>
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">📅 This Week</div>
          <div className="text-2xl font-bold text-red-400">{fmt(revWeek)}</div>
          <div className="text-[10px] text-white/40">{jobs.filter(j => new Date(j.scheduledDate) >= weekStart && j.status !== "cancelled").length} jobs</div>
        </Glass>
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">📅 This Month</div>
          <div className="text-2xl font-bold text-red-400">{fmt(revMonth)}</div>
          <div className="text-[10px] text-white/40">{goals.revenue > 0 ? Math.round(revMonth / goals.revenue * 100) + "% of goal" : fmt(revMonth)}</div>
        </Glass>
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">📈 Year-over-Year</div>
          <div className="text-2xl font-bold text-red-400">{fmt(revThisYear)}</div>
          <div className={"text-[10px] font-semibold mt-0.5 " + (yoyPct === null ? "text-white/40" : yoyPct >= 0 ? "text-green-400" : "text-red-400")}>
            {yoyPct === null ? "No prior year data" : (yoyPct >= 0 ? "▲" : "▼") + " " + Math.abs(yoyPct) + "% vs last year"}
          </div>
        </Glass>
      </div>

      {/* KPI row - compact 4 across */}
      {w.kpis && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Total Revenue" value={fmt(stats.totalRev)} change="+12%" />
        <Stat icon={Briefcase} label="Active Jobs" value={stats.activeJobs} change="+3" />
        <Stat icon={Target} label="Close Rate" value={stats.closeRate + "%"} change="+5%" />
        {(() => {
          const recurringJobs = jobs.filter(j => j.isRecurring && j.status === "completed" && daysSince(j.scheduledDate) <= 30);
          const mrr = recurringJobs.reduce((s, j) => s + j.amount, 0);
          return <Stat icon={RefreshCw} label="Recurring Rev" value={fmt(mrr)} change={mrr > 0 ? "🔄 MRR" : "—"} />;
        })()}
      </div>}

      {/* Revenue collected today / this week / this month */}
      {w.kpis && (() => {
        const todayStr = today();
        const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0,10); })();
        const monthStr = todayStr.slice(0, 7);
        const todayRev_ = jobs.filter(j => j.status === "completed" && j.scheduledDate === todayStr).reduce((s,j) => s + j.amount, 0);
        const weekRev = jobs.filter(j => j.status === "completed" && j.scheduledDate >= weekStart).reduce((s,j) => s + j.amount, 0);
        const monthRev = jobs.filter(j => j.status === "completed" && (j.scheduledDate||"").startsWith(monthStr)).reduce((s,j) => s + j.amount, 0);
        const todayTips = jobs.filter(j => j.status === "completed" && j.scheduledDate === todayStr).reduce((s,j) => s + (Number(j.tip)||0), 0);
        const todayCash = jobs.filter(j => j.status === "completed" && j.scheduledDate === todayStr && j.isCash).reduce((s,j) => s + j.amount, 0);
        return <div className="grid grid-cols-3 gap-3">
          <Glass className="p-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">💰 Today</div>
            <div className="text-2xl font-black text-green-400">{fmt(todayRev_)}</div>
            {todayTips > 0 && <div className="text-[10px] text-yellow-400 mt-0.5">+{fmt(todayTips)} tips</div>}
            {todayCash > 0 && <div className="text-[10px] text-green-300/60 mt-0.5">💵 {fmt(todayCash)} cash</div>}
          </Glass>
          <Glass className="p-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">📅 This Week</div>
            <div className="text-2xl font-black text-blue-400">{fmt(weekRev)}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{jobs.filter(j => j.status === "completed" && j.scheduledDate >= weekStart).length} jobs</div>
          </Glass>
          <Glass className="p-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">🗓️ This Month</div>
            <div className="text-2xl font-black text-red-400">{fmt(monthRev)}</div>
            {goals.revenue > 0 && <div className="text-[10px] text-white/40 mt-0.5">{Math.round(monthRev/goals.revenue*100)}% of goal</div>}
          </Glass>
        </div>;
      })()}

      {/* Year-over-Year comparison widget */}
      {(w.yoy ?? true) && (() => {
        const thisYear = new Date().getFullYear().toString();
        const lastYear = (new Date().getFullYear() - 1).toString();
        const thisYTD = jobs.filter(j => j.status === "completed" && (j.scheduledDate||"").startsWith(thisYear)).reduce((s,j) => s+j.amount, 0);
        const lastYTD = jobs.filter(j => j.status === "completed" && (j.scheduledDate||"").startsWith(lastYear)).reduce((s,j) => s+j.amount, 0);
        const yoyPct = lastYTD > 0 ? Math.round((thisYTD - lastYTD) / lastYTD * 100) : null;
        const thisJobs = jobs.filter(j => j.status === "completed" && (j.scheduledDate||"").startsWith(thisYear)).length;
        const lastJobs = jobs.filter(j => j.status === "completed" && (j.scheduledDate||"").startsWith(lastYear)).length;
        return <Glass className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5">📊 Year-over-Year</div>
            {yoyPct !== null && <div className={"text-sm font-black " + (yoyPct >= 0 ? "text-green-400" : "text-red-400")}>{yoyPct >= 0 ? "+" : ""}{yoyPct}% vs last year</div>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-white/40 mb-1">{thisYear} YTD</div>
              <div className="text-xl font-bold text-red-400">{fmt(thisYTD)}</div>
              <div className="text-[10px] text-white/50">{thisJobs} jobs</div>
            </div>
            <div>
              <div className="text-[10px] text-white/40 mb-1">{lastYear} YTD</div>
              <div className="text-xl font-bold text-white/60">{fmt(lastYTD)}</div>
              <div className="text-[10px] text-white/50">{lastJobs} jobs</div>
            </div>
          </div>
          {lastYTD > 0 && <div className="mt-2 h-2 bg-black/40 rounded-full overflow-hidden">
            <div className={"h-full rounded-full " + (yoyPct >= 0 ? "bg-green-500" : "bg-red-500")} style={{width: Math.min(100, thisYTD / Math.max(thisYTD, lastYTD) * 100) + "%"}} />
          </div>}
          {lastYTD === 0 && <div className="text-[10px] text-white/30 mt-1">Add last year's jobs to compare</div>}
        </Glass>;
      })()}

      {/* Outstanding Invoices Widget */}
      {(w.invoices ?? true) && (() => {
        const unpaid = (estimates || []).filter(e => e.invoiced && !e.paidAt);
        const totalOwed = unpaid.reduce((s,e) => s + e.total, 0);
        if (unpaid.length === 0) return null;
        const overdue = unpaid.filter(e => e.invoicedAt && daysSince(e.invoicedAt) > 14);
        return <Glass className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm flex items-center gap-2"><Receipt size={13} className="text-red-400" />Outstanding Invoices</div>
            <div className="flex items-center gap-2">
              {overdue.length > 0 && <Badge tone="red">{overdue.length} overdue</Badge>}
              <button onClick={() => onNav("invoices")} className="text-[10px] text-red-400 hover:text-red-300">View all →</button>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3 p-3 bg-red-950/20 border border-red-900/30 rounded-xl">
            <div className="text-xs text-white/60">{unpaid.length} unpaid invoice{unpaid.length !== 1 ? "s" : ""}</div>
            <div className="text-2xl font-black text-red-400">{fmt(totalOwed)}</div>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {unpaid.slice(0,5).map(inv => {
              const cu = (customers || []).find(x => x.id === inv.customerId);
              const age = inv.invoicedAt ? daysSince(inv.invoicedAt) : 0;
              return <div key={inv.id} className="flex items-center justify-between text-xs py-1.5 border-b border-red-900/10">
                <span><span className="font-medium">{cu ? cu.firstName + " " + cu.lastName : "?"}</span> <span className={"text-[10px] " + (age > 14 ? "text-red-400" : "text-white/40")}>{age > 0 ? age + "d ago" : "today"}</span></span>
                <span className="font-bold text-red-400">{fmt(inv.total)}</span>
              </div>;
            })}
          </div>
        </Glass>;
      })()}

      {/* Weather Widget — today's job impact */}
      {(w.weather ?? true) && (() => {
        const todayJobs_ = jobs.filter(j => j.scheduledDate === today() && j.status === "scheduled");
        const rainRisk = wCurrent.rainChance > 50;
        const freezeRisk = wCurrent.temp < 35;
        const windRisk = wCurrent.wind > 20;
        if (todayJobs_.length === 0 && !rainRisk && !freezeRisk) return null;
        return <Glass className={"p-4 " + (rainRisk || freezeRisk ? "!bg-blue-950/20 !border-blue-700/30" : "!bg-black/40")}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm flex items-center gap-2"><Cloud size={13} className="text-blue-400" />Today's Weather Impact</div>
            <div className="flex items-center gap-3">
              <div className="text-xl font-bold">{wCurrent.temp}°F</div>
              {settings.owmKey ? <span className="text-[10px] text-green-400">● Live</span> : <span className="text-[10px] text-white/30">Forecast</span>}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs mb-2">
            <span className="text-white/60 capitalize">{wCurrent.description || wCurrent.condition?.replace("_"," ")}</span>
            <span className={"font-semibold " + (wCurrent.rainChance > 50 ? "text-blue-400" : "text-white/40")}>💧 {wCurrent.rainChance}% rain</span>
            {windRisk && <span className="text-yellow-400">💨 {wCurrent.wind}mph winds</span>}
            <span className="text-white/40">💦 {wCurrent.humidity}% humidity</span>
          </div>
          {todayJobs_.length > 0 ? <div className="pt-2 border-t border-white/5">
            <div className="text-[10px] text-white/50 mb-1">{todayJobs_.length} job{todayJobs_.length !== 1 ? "s" : ""} scheduled today</div>
            {(rainRisk || freezeRisk || windRisk)
              ? <div className={"text-xs font-semibold " + (freezeRisk ? "text-red-400" : "text-yellow-400")}>{freezeRisk ? "🌡️ Too cold to wash — consider rescheduling" : rainRisk ? "🌧️ Rain likely — notify customers?" : "💨 High winds — roof jobs may need rescheduling"}</div>
              : <div className="text-xs text-green-400">✅ Good conditions for all {todayJobs_.length} scheduled job{todayJobs_.length !== 1 ? "s" : ""}</div>}
          </div> : <div className="text-xs text-white/40">No jobs scheduled today</div>}
        </Glass>;
      })()}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: goals + upcoming jobs */}
        <div className="space-y-4">
          {/* Goals */}
          {w.goals && <Glass className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm flex items-center gap-2"><Target size={13} className="text-red-400" />Goals</div>
              <button onClick={() => onNav("reports")} className="text-[10px] text-red-400 hover:text-red-300">Analytics →</button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Month Revenue</span><span className={revPct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{fmt(stats.totalRev)} / {fmt(goals.revenue)} ({revPct}%)</span></div>
                <PBar value={stats.totalRev} max={goals.revenue || 1} />
              </div>
              {settings.quarterlyRevenueGoal > 0 && (() => {
                const qStart = new Date(); qStart.setMonth(Math.floor(qStart.getMonth() / 3) * 3, 1);
                const qRev = jobs.filter(j => j.status === "completed" && j.scheduledDate >= qStart.toISOString().slice(0,10)).reduce((s,j)=>s+j.amount,0);
                const qPct = Math.round(qRev / settings.quarterlyRevenueGoal * 100);
                return <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Quarter Revenue</span><span className={qPct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{fmt(qRev)} / {fmt(settings.quarterlyRevenueGoal)} ({qPct}%)</span></div>
                  <PBar value={qRev} max={settings.quarterlyRevenueGoal} />
                </div>;
              })()}
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Jobs Done</span><span className={jobsPct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{stats.doneMonth} / {goals.jobCount}</span></div>
                <PBar value={stats.doneMonth} max={goals.jobCount || 1} />
              </div>
              <div className="pt-2 border-t border-red-900/20 space-y-2">
                <div className="flex justify-between text-xs"><span className="text-white/50">Run-rate forecast</span><span className={forecast >= (goals.revenue || 10000) ? "text-green-400 font-bold" : "text-yellow-400 font-semibold"}>{fmt(forecast)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/40">Day {dayOfMonth}/{daysInMonth}</span><span className="text-white/40">{fmt(Math.round(stats.totalRev / dayOfMonth))}/day avg</span></div>
                {forecast < (goals.revenue || 0) && <div className="text-[10px] text-red-400">⚠️ {fmt((goals.revenue||0) - forecast)} short of goal at current pace</div>}
                {forecast >= (goals.revenue || 0) && goals.revenue > 0 && <div className="text-[10px] text-green-400">✅ On track to hit monthly goal</div>}
              </div>
            </div>
          </Glass>}

          {/* Upcoming jobs */}
          <Glass className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm flex items-center gap-2"><Briefcase size={13} className="text-red-400" />Upcoming (7d)</div>
              <button onClick={() => onNav("calendar")} className="text-[10px] text-red-400 hover:text-red-300">Calendar →</button>
            </div>
            <div className="space-y-2">
              {upcoming.slice(0, 4).map(j => {
                const c = customers.find(x => x.id === j.customerId);
                const risk = forecastFor(wForecast, j.scheduledDate) as any;
                return <div key={j.id} className="flex items-center gap-2 py-1.5 border-b border-red-900/10 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{c ? c.firstName + " " + c.lastName : j.address?.split(",")[0]}</div>
                    <div className="text-[10px] text-white/50">{j.scheduledDate} · {fmt(j.amount)}</div>
                  </div>
                  {risk && risk.level === "high" && <span className="text-[10px]">{risk.icon}</span>}
                  <Badge tone={j.status === "completed" ? "green" : j.status === "in_progress" ? "yellow" : "gray"}>{j.status.replace("_"," ").replace("scheduled","sched")}</Badge>
                </div>;
              })}
              {upcoming.length === 0 && (
                <div className="text-center py-6">
                  <Calendar size={20} className="mx-auto mb-2 text-white/20" />
                  <div className="text-xs text-white/40">No upcoming jobs this week</div>
                  <button onClick={() => onNav("jobs")} className="mt-2 text-xs text-red-400 hover:text-red-300">Schedule a job →</button>
                </div>
              )}
            </div>
          </Glass>
        </div>

        {/* Center: pending quotes + activity */}
        <div className="space-y-4">
          {/* Pending estimates */}
          <Glass className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm flex items-center gap-2"><FileText size={13} className="text-red-400" />Pending Quotes ({stats.pendingEst})</div>
              <button onClick={() => onNav("estimates")} className="text-[10px] text-red-400 hover:text-red-300">View all →</button>
            </div>
            <div className="space-y-2">
              {pending.map(e => {
                const c = customers.find(x => x.id === e.customerId);
                const age = daysSince(e.createdAt);
                return <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-red-900/10 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{c ? c.firstName + " " + c.lastName : "Unknown"}</div>
                    <div className="text-[10px] text-white/50">{fmt(e.total)} · {age}d old</div>
                  </div>
                  <span className={"text-[10px] font-bold " + (age >= 7 ? "text-red-400" : age >= 3 ? "text-yellow-400" : "text-white/60")}>{age >= 7 ? "⚠ Stale" : age >= 3 ? "Follow up" : "New"}</span>
                </div>;
              })}
              {pending.length === 0 && (
                <div className="text-center py-6">
                  <FileText size={20} className="mx-auto mb-2 text-white/20" />
                  <div className="text-xs text-white/40">No pending estimates</div>
                  <button onClick={() => onNav("estimates")} className="mt-2 text-xs text-red-400 hover:text-red-300">Create an estimate →</button>
                </div>
              )}
            </div>
          </Glass>

          {/* Activity feed */}
          {w.activity && <Glass className="p-4">
            <div className="font-semibold text-sm flex items-center gap-2 mb-3"><Activity size={13} className="text-red-400" />Recent Activity</div>
            <div className="space-y-2">
              {activity.map((a, i) => {
                const Icon = a.icon;
                return <div key={i} className="flex items-center gap-2.5 py-1 border-b border-red-900/10 last:border-0">
                  <div className="w-6 h-6 rounded-lg bg-black/40 flex items-center justify-center flex-shrink-0"><Icon size={11} className="text-red-400" /></div>
                  <div className="flex-1 min-w-0"><div className="text-xs truncate">{a.text}</div><div className="text-[10px] text-white/40">{a.date}</div></div>
                  {a.amount && <div className="text-xs font-semibold text-red-400 flex-shrink-0">{fmt(a.amount)}</div>}
                </div>;
              })}
            </div>
          </Glass>}
        </div>

        {/* Right: weather + mini chart */}
        <div className="space-y-4">
          {/* Weather */}
          {w.charts && <Glass className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm flex items-center gap-2"><Cloud size={13} className="text-blue-400" />Weather</div>
              {settings.owmKey ? <span className="text-[10px] text-green-400">● Live</span> : <span className="text-[10px] text-white/30">Forecast</span>}
            </div>
            <div className="flex items-end gap-4 mb-3">
              <div>
                <div className="text-3xl font-bold">{wCurrent.temp}°F</div>
                <div className="text-xs text-white/50 capitalize">{wCurrent.description || wCurrent.condition?.replace("_"," ")}</div>
              </div>
              <div className="text-xs text-white/60 space-y-0.5 pb-1">
                <div>💧 {wCurrent.rainChance}% rain</div>
                <div>💨 {wCurrent.wind}mph wind</div>
                <div>💦 {wCurrent.humidity}% humidity</div>
              </div>
            </div>
            {wAlerts.length > 0 && <div className="mb-3 p-2 bg-yellow-950/30 border border-yellow-700/40 rounded-lg flex flex-wrap gap-1.5">
              {wAlerts.map((a, i) => <span key={i} className="text-[10px] text-yellow-300">{a.icon || "⚠️"} {a.day}: {a.msg}</span>)}
            </div>}
            <div className="space-y-1.5">
              {wForecast.slice(0, 5).map(f => <div key={f.day} className="flex items-center justify-between text-xs">
                <span className="text-white/70 w-14">{f.day}</span>
                <div className="flex-1 h-1 bg-black/40 rounded-full mx-2 overflow-hidden"><div className={"h-full rounded-full " + (f.rainChance > 60 ? "bg-blue-500" : f.rainChance > 30 ? "bg-yellow-500" : "bg-green-500")} style={{ width: f.rainChance + "%" }} /></div>
                <span className="text-white/50 w-8 text-right">{f.rainChance}%</span>
                <span className="font-semibold w-10 text-right">{f.temp}°</span>
              </div>)}
            </div>
            {bestDay && <div className="mt-2 p-2 bg-green-950/20 border border-green-700/30 rounded-lg text-[10px] text-green-300">✅ Best day: {bestDay.day} — {bestDay.rainChance}% rain, {bestDay.temp}°F</div>}
          </Glass>}

          {/* Mini revenue chart */}
          {w.charts && <Glass className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm flex items-center gap-2"><BarChart2 size={13} className="text-red-400" />Revenue (6mo)</div>
              <button onClick={() => onNav("analytics")} className="text-[10px] text-red-400 hover:text-red-300">Full analytics →</button>
            </div>
            {hasAnyRevData ? (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={revenueByMonth} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs><linearGradient id="rdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e11d48" stopOpacity={0.5} /><stop offset="100%" stopColor="#9f1239" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="month" stroke="#ffffff30" fontSize={9} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "rgba(0,0,0,0.9)", border: "1px solid #9f1239", borderRadius: "6px", fontSize: "10px" }} formatter={v => fmt(Number(v))} />
                  <Area type="monotone" dataKey="revenue" stroke="#e11d48" strokeWidth={2} fill="url(#rdg)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[120px] flex flex-col items-center justify-center text-center">
                <BarChart2 size={24} className="text-white/10 mb-2" />
                <div className="text-xs text-white/30">No completed jobs yet</div>
                <button onClick={() => onNav("jobs")} className="mt-2 text-[11px] text-red-400 hover:text-red-300">Add your first job →</button>
              </div>
            )}
          </Glass>}

          {/* Automations status */}
          {w.activity && automations.filter(a => a.active).length > 0 && <Glass className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-sm flex items-center gap-2"><Zap size={13} className="text-red-400" />Active Automations</div>
              <button onClick={() => onNav("automations")} className="text-[10px] text-red-400 hover:text-red-300">Manage →</button>
            </div>
            <div className="space-y-1.5">
              {automations.filter(a => a.active).slice(0, 4).map(a => <div key={a.id} className="flex items-center gap-2 text-xs">
                <span className="text-base">{a.icon || "⚡"}</span>
                <span className="text-white/70 flex-1 truncate">{a.name}</span>
                <span className="text-[10px] text-green-400">● ON</span>
              </div>)}
            </div>
          </Glass>}
        </div>
      </div>
    </div>
  );
}

// ===== CUSTOMERS =====

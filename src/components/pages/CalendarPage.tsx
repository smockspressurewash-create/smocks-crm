// @ts-nocheck
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

export function CalendarPage({ jobs = [], setJobs, customers = [], toast, settings = {} }) {
  const [view, setView] = useState("month");
  const [off, setOff] = useState(0);
  const [dragId, setDragId] = useState(null);
  const [showBuffer, setShowBuffer] = useState(false); // show 30-min travel/buffer blocks

  const now = new Date();
  const vd = new Date(now.getFullYear(), now.getMonth() + off, 1);
  const y = vd.getFullYear();
  const m = vd.getMonth();
  const fd = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const byDate = {};
  jobs.forEach(j => { if (j.scheduledDate) (byDate[j.scheduledDate] = byDate[j.scheduledDate] || []).push(j); });
  const key = d => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  const tKey = today();

  const sColor = s => ({ scheduled: "bg-blue-600", in_progress: "bg-orange-500", completed: "bg-green-600", cancelled: "bg-red-800" }[s] || "bg-gray-600");
  const prioRing = p => ({ urgent: "ring-2 ring-red-500", high: "ring-2 ring-yellow-500", low: "opacity-75" }[p] || "");

  // Jobs without a scheduled date (for the "unscheduled" pool)
  const unscheduled = jobs.filter(j => !j.scheduledDate && j.status !== "completed" && j.status !== "cancelled");

  const handleDrop = async targetKey => {
    if (!dragId) return;
    const job = jobs.find(j => j.id === dragId);
    const oldDate = job?.scheduledDate;
    setJobs(jobs.map(j => j.id === dragId ? { ...j, scheduledDate: targetKey } : j));
    toast("Rescheduled to " + targetKey);
    setDragId(null);

    // Send reschedule notification to customer
    if (job && oldDate && oldDate !== targetKey) {
      const c = customers.find(x => x.id === job.customerId);
      if (c?.phone && settings?.twilioSid) {
        const msg = "Hi " + c.firstName + "! Your Smock's service has been rescheduled from " + oldDate + " to " + targetKey + ". Questions? Call (717) 555-0100. — Smock's";
        twilioSend(settings, c.phone, msg).catch(() => {});
      }
      // Update Google Calendar event if connected
      if (job.googleEventId && settings?.googleConnected && settings?.googleBackendUrl && settings?.googleToken) {
        fetch(settings.googleBackendUrl + "/calendar/events/" + job.googleEventId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.googleToken },
          body: JSON.stringify({ start: { date: targetKey }, end: { date: targetKey } })
        }).catch(() => {});
      }
    }
  };
  const unschedule = jid => {
    setJobs(jobs.map(j => j.id === jid ? { ...j, scheduledDate: "" } : j));
    toast("Moved to unscheduled");
  };

  // Day revenue totals
  const dayTotal = k => (byDate[k] || []).reduce((s, j) => s + (j.amount || 0), 0);

  // Week view calc
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + off * 7);
  const weekDays = Array.from({ length: 7 }).map((_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {["month", "week", "agenda"].map(v => <button key={v} onClick={() => { setView(v); setOff(0); }} className={"px-4 py-2 rounded-xl text-sm font-medium transition border capitalize " + (view === v ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{v}</button>)}
        <label className="flex items-center gap-2 ml-auto cursor-pointer px-3 py-2 bg-black/40 border border-red-900/30 rounded-xl text-xs text-white/60 hover:text-white transition">
          <input type="checkbox" checked={showBuffer} onChange={e => setShowBuffer(e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
          🚗 30-min travel buffers
        </label>
      </div>

      {view === "month" && (
        <div className="grid lg:grid-cols-[1fr_220px] gap-4">
          <Glass className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setOff(off - 1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronLeft size={16} /></button>
            <div className="font-semibold">{vd.toLocaleString("default", { month: "long", year: "numeric" })}</div>
            <button onClick={() => setOff(off + 1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-center text-[10px] uppercase text-white/40 py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: fd }).map((_, i) => <div key={"p" + i} />)}
            {Array.from({ length: dim }).map((_, i) => {
              const d = i + 1;
              const k = key(d);
              const dj = byDate[k] || [];
              const isT = k === tKey;
              const dt = dayTotal(k);
              const hasCompleted = dj.some(j => j.status === "completed");
              const hasInProgress = dj.some(j => j.status === "in_progress");
              const hasUrgent = dj.some(j => j.priority === "urgent");
              const cellBg = isT ? "bg-red-950/30 border-red-700/50" : hasInProgress ? "bg-orange-950/20 border-orange-700/30" : hasCompleted && dj.every(j => j.status === "completed") ? "bg-green-950/20 border-green-800/30" : hasUrgent ? "bg-red-950/20 border-red-700/40" : dj.length > 0 ? "bg-blue-950/10 border-blue-900/20" : "bg-white/5 border-white/5 hover:border-red-900/30";
              return (
                <div key={d} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(k)} className={"min-h-[84px] p-1.5 rounded-lg border transition-all " + cellBg}>
                  <div className="flex items-center justify-between mb-1">
                    <div className={"text-xs font-semibold " + (isT ? "text-red-400" : "text-white/70")}>{d}</div>
                    {dt > 0 && <div className="text-[8px] text-green-400/70 font-mono">${Math.round(dt)}</div>}
                  </div>
                  <div className="space-y-0.5">
                    {dj.slice(0, 3).map(j => {
                      const c = customers.find(x => x.id === j.customerId);
                      return <React.Fragment key={j.id}>
                        {showBuffer && <div className="text-[8px] px-1 py-0.5 rounded bg-orange-950/50 border border-orange-800/30 text-orange-400/60 truncate">🚗 travel</div>}
                        <div draggable onDragStart={() => setDragId(j.id)} className={"text-[9px] px-1 py-0.5 rounded truncate cursor-grab text-white " + sColor(j.status) + " " + prioRing(j.priority)} title={c?.firstName + " " + c?.lastName + " · " + fmt(j.amount) + (j.priority && j.priority !== "normal" ? " · " + j.priority : "")}>{j.priority === "urgent" && "🚨 "}{c?.firstName}</div>
                        {showBuffer && <div className="text-[8px] px-1 py-0.5 rounded bg-gray-950/50 border border-gray-800/30 text-gray-400/60 truncate">⏸ buffer</div>}
                      </React.Fragment>;
                    })}
                    {dj.length > 3 && <div className="text-[9px] text-white/50">+{dj.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 flex-wrap text-[10px] text-white/50">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-600" />Scheduled</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-500" />In progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-600" />Done</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-800" />Cancelled</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-600 ring-2 ring-yellow-500" />High/Urgent</span>
          </div>
          </Glass>
          <Glass className="p-4 h-fit sticky top-24">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Clipboard size={10} />Unscheduled ({unscheduled.length})</div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {unscheduled.length === 0 && <div className="text-xs text-white/30 text-center py-6">Everything's on the board ✓</div>}
              {unscheduled.map(j => {
                const c = customers.find(x => x.id === j.customerId);
                return <div key={j.id} draggable onDragStart={() => setDragId(j.id)} className={"p-2.5 rounded-lg cursor-grab bg-black/40 border hover:border-red-600/50 transition " + (j.priority === "urgent" ? "border-red-500/50" : j.priority === "high" ? "border-yellow-500/50" : "border-red-900/30")}>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="font-medium text-xs truncate">{c?.firstName} {c?.lastName}</div>
                    {j.priority && j.priority !== "normal" && <span className={"text-[8px] px-1 rounded uppercase " + (j.priority === "urgent" ? "bg-red-600/40 text-red-300" : j.priority === "high" ? "bg-yellow-600/40 text-yellow-300" : "bg-white/10 text-white/50")}>{j.priority[0]}</span>}
                  </div>
                  <div className="text-[10px] text-white/50 truncate">{j.address}</div>
                  <div className="text-[10px] text-red-400 font-semibold mt-0.5">{fmt(j.amount)}</div>
                </div>;
              })}
            </div>
            <div className="text-[9px] text-white/30 text-center mt-3 pt-3 border-t border-red-900/20">↳ Drag onto calendar to schedule</div>
            {jobs.some(j => j.scheduledDate) && <div className="mt-2 text-[9px] text-white/30 text-center">Drop on this panel to unschedule</div>}
            <div onDragOver={e => e.preventDefault()} onDrop={() => dragId && unschedule(dragId)} className="mt-2 h-8 border border-dashed border-white/10 rounded-lg flex items-center justify-center text-[9px] text-white/30">Drop here</div>
          </Glass>
        </div>
      )}

      {view === "week" && (
        <Glass className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setOff(off - 1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronLeft size={16} /></button>
            <div className="font-semibold">{weekStart.toLocaleDateString()} week</div>
            <button onClick={() => setOff(off + 1)} className="p-2 rounded-lg hover:bg-white/5"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(d => {
              const k = d.toISOString().slice(0, 10);
              const dj = byDate[k] || [];
              const isT = k === tKey;
              return (
                <div key={k} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(k)} className={"min-h-[200px] p-2 rounded-lg border " + (isT ? "bg-red-950/30 border-red-700/50" : "bg-white/5 border-white/10")}>
                  <div className={"text-[10px] uppercase " + (isT ? "text-red-400 font-bold" : "text-white/50")}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  <div className="text-lg font-bold mb-2">{d.getDate()}</div>
                  <div className="space-y-1">
                    {dj.map(j => {
                      const c = customers.find(x => x.id === j.customerId);
                      return <div key={j.id} draggable onDragStart={() => setDragId(j.id)} className={"text-[10px] p-1.5 rounded cursor-grab " + sColor(j.status) + " text-white"}>
                        <div className="font-semibold truncate">{c?.firstName}</div>
                        <div className="opacity-75">{fmt(j.amount)}</div>
                      </div>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[10px] text-white/40 text-center">Buffer time: 30min between jobs (mock)</div>
        </Glass>
      )}

      {view === "agenda" && (
        <Glass className="p-4">
          <div className="space-y-2">
            {jobs.filter(j => j.scheduledDate >= tKey && j.status !== "cancelled").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 20).map(j => {
              const c = customers.find(x => x.id === j.customerId);
              return (
                <div key={j.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl">
                  <div className={"w-1 h-10 rounded-full " + sColor(j.status)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{c?.firstName} {c?.lastName}</div>
                    <div className="text-xs text-white/50 truncate">{j.address}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-400 text-sm">{fmt(j.amount)}</div>
                    <div className="text-xs text-white/50">{j.scheduledDate}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Glass>
      )}
    </div>
  );
}

// ===== REVIEWS =====

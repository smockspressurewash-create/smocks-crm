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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { updateGCalEvent as updateGCalEventApi, deleteGCalEvent as deleteGCalEventApi, fetchCalendarEvents, createGCalEvent as createGCalEventApi, type GCalEvent } from "../../lib/googleApi";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { supabase } from "../../lib/supabase";
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

export function CalendarPage({ jobs = [], setJobs, customers = [], employees = [], toast, settings = {} as AppSettings, ownerId = "" }: { jobs?: any[]; setJobs?: any; customers?: any[]; employees?: any[]; toast?: any; settings?: AppSettings; ownerId?: string }) {
  const [view, setView] = useState(() => typeof window !== "undefined" && window.innerWidth < 768 ? "agenda" : "month");
  const [off, setOff] = useState(0);
  const [dragId, setDragId] = useState(null);
  // FIX 15 — mobile touch drag-and-drop. HTML5's native draggable/onDragStart
  // never fires from touch input, so unscheduled jobs couldn't be dragged onto
  // a day at all on a phone. This tracks a touch-driven drag independently of
  // the desktop dragId/onDragStart path (which stays as-is for mouse users) —
  // a floating "ghost" chip follows the finger, and the day cell underneath is
  // found via elementFromPoint + a data-daykey attribute on each cell.
  const [touchDragJobId, setTouchDragJobId] = useState<string | null>(null);
  const [touchDragPos, setTouchDragPos] = useState<{ x: number; y: number } | null>(null);
  const [touchDragOverKey, setTouchDragOverKey] = useState<string | null>(null);
  const [touchDragOverUnschedule, setTouchDragOverUnschedule] = useState(false);
  const touchDragStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchDragMovedRef = useRef(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [calSource, setCalSource] = useState<"crm" | "google" | "both">("crm");
  const [gEvents, setGEvents] = useState<GCalEvent[]>([]);
  const [gLoading, setGLoading] = useState(false);
  const [dragHoverArrow, setDragHoverArrow] = useState<"prev" | "next" | null>(null);
  const dragArrowTimer = useRef<any>(null);

  const onDragEnterArrow = (dir: "prev" | "next") => {
    if (!dragId) return;
    setDragHoverArrow(dir);
    clearTimeout(dragArrowTimer.current);
    dragArrowTimer.current = setTimeout(() => {
      setOff(o => o + (dir === "next" ? 1 : -1));
      setDragHoverArrow(null);
    }, 500);
  };
  const onDragLeaveArrow = () => {
    clearTimeout(dragArrowTimer.current);
    setDragHoverArrow(null);
  };

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobContextMenu, setJobContextMenu] = useState<{ jobId: string; x: number; y: number } | null>(null);
  const longPressTimer = useRef<any>(null);
  const [selectedGEvent, setSelectedGEvent] = useState<GCalEvent | null>(null);
  const [showNewGEvent, setShowNewGEvent] = useState(false);
  const [newEvt, setNewEvt] = useState({ title: "", date: today(), time: "09:00", duration: 2, description: "", location: "" });
  const [gCreating, setGCreating] = useState(false);

  const gToken: string = (settings as any)?.googleProviderToken || "";
  useEffect(() => {
    if (!gToken || calSource === "crm") { setGEvents([]); return; }
    setGLoading(true);
    fetchCalendarEvents(gToken)
      .then(evs => setGEvents(evs))
      .catch(() => setGEvents([]))
      .finally(() => setGLoading(false));
  }, [calSource, gToken]);

  const now = new Date();
  const vd = new Date(now.getFullYear(), now.getMonth() + off, 1);
  const y = vd.getFullYear();
  const m = vd.getMonth();
  const fd = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const byDate = {};
  jobs.forEach(j => { if (j.scheduledDate) (byDate[j.scheduledDate] = byDate[j.scheduledDate] || []).push(j); });

  // ITEM 2 — real travel/buffer time between same-day jobs, replacing the old
  // "showBuffer" toggle which just printed a static "🚗 travel" / "⏸ buffer"
  // label before/after every job regardless of actual scheduled times. This
  // sorts each day's jobs by scheduledTime and flags any consecutive pair
  // whose gap (previous job's scheduledTime + duration → next job's
  // scheduledTime) is under the configured default buffer.
  const bufferMinutes = Number((settings as any)?.defaultBufferMinutes) || 30;
  const jobEndMinutes = (j: any): number | null => {
    if (!j.scheduledTime) return null;
    const [h, m] = j.scheduledTime.split(":").map(Number);
    if (Number.isNaN(h)) return null;
    return h * 60 + (m || 0) + Math.round((Number(j.duration) || 2) * 60);
  };
  const jobStartMinutes = (j: any): number | null => {
    if (!j.scheduledTime) return null;
    const [h, m] = j.scheduledTime.split(":").map(Number);
    if (Number.isNaN(h)) return null;
    return h * 60 + (m || 0);
  };
  const sortedWithGaps = (dayJobs: any[]): Array<{ job: any; gapBefore: number | null; tooTight: boolean }> => {
    const timed = dayJobs.filter(j => j.scheduledTime).sort((a, b) => (jobStartMinutes(a)! - jobStartMinutes(b)!));
    const untimed = dayJobs.filter(j => !j.scheduledTime);
    const out: Array<{ job: any; gapBefore: number | null; tooTight: boolean }> = [];
    timed.forEach((j, i) => {
      if (i === 0) { out.push({ job: j, gapBefore: null, tooTight: false }); return; }
      const prevEnd = jobEndMinutes(timed[i - 1]);
      const thisStart = jobStartMinutes(j);
      const gap = prevEnd !== null && thisStart !== null ? thisStart - prevEnd : null;
      out.push({ job: j, gapBefore: gap, tooTight: gap !== null && gap < bufferMinutes });
    });
    untimed.forEach(j => out.push({ job: j, gapBefore: null, tooTight: false }));
    return out;
  };
  // Google events keyed by date for the calendar grid
  const gByDate: Record<string, GCalEvent[]> = {};
  gEvents.forEach(ev => {
    const d = (ev.start || "").slice(0, 10);
    if (d) (gByDate[d] = gByDate[d] || []).push(ev);
  });
  const key = d => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  const tKey = today();

  const updateJob = (jid: string, patch: any) => {
    setJobs((prev: any[]) => prev.map(j => j.id === jid ? { ...j, ...patch } : j));
    // Clock-in/lunch/hours fields are excluded from the App-level 30s bulk
    // autosave so it never clobbers a more-recent employee-portal write —
    // so any owner-side edit to them must be pushed immediately here.
    const EMPLOYEE_OWNED_FIELDS = ["clockInAt", "lunchStartAt", "lunchMinutes", "lunchExceeded", "loggedHours"] as const;
    const ownedPatch: any = {};
    EMPLOYEE_OWNED_FIELDS.forEach(f => { if ((patch as any)[f] !== undefined) ownedPatch[f] = (patch as any)[f]; });
    if (Object.keys(ownedPatch).length > 0) {
      (supabase as any).from("jobs").update(ownedPatch).eq("id", jid)
        .then((result: any) => { if (result?.error) toast?.("Failed to save — " + result.error.message, "red"); })
        .catch((e: any) => toast?.("Failed to save: " + e?.message, "red"));
    }
    // Crew assignment must reach Supabase immediately rather than waiting on the
    // 30s auto-save interval, since the employee portal polls Supabase directly.
    if (patch.crew !== undefined) {
      const crewPatch: any = { crew: patch.crew };
      if (patch.crewAssignedAt !== undefined) crewPatch.crewAssignedAt = patch.crewAssignedAt;
      (supabase as any).from("jobs").update(crewPatch).eq("id", jid)
        .then((result: any) => {
          if (result?.error) toast?.("Crew assignment failed to save — " + result.error.message, "red");
        })
        .catch((e: any) => {
          console.warn("SUPABASE SAVE FAILED:", e?.message);
          toast?.("Crew assignment failed to save", "red");
        });
    }
  };

  const sColor = (s: string) => ({ scheduled: "bg-blue-600", in_progress: "bg-orange-500", completed: "bg-green-600", cancelled: "bg-red-800" }[s] || "bg-gray-600");
  const eventBg = (j: any) => j.googleEventId ? "bg-green-700" : sColor(j.status);
  const prioRing = (p: string) => ({ urgent: "ring-2 ring-red-500", high: "ring-2 ring-yellow-500", low: "opacity-75" }[p] || "");
  const crewInitials = (j: any): string => {
    if (!employees.length || !(j.crew?.length)) return "";
    return j.crew.slice(0, 3).map((eid: string) => {
      const e = employees.find((em: any) => em.id === eid);
      return e ? e.firstName[0] + (e.lastName?.[0] || "") : "?";
    }).join(" ");
  };

  const handleCreateGEvent = async () => {
    if (!gToken || !newEvt.title.trim()) return;
    setGCreating(true);
    try {
      const startDt = new Date(`${newEvt.date}T${newEvt.time}:00`);
      const endDt = new Date(startDt.getTime() + Number(newEvt.duration) * 3600000);
      await createGCalEventApi(gToken, { title: newEvt.title, start: startDt.toISOString(), end: endDt.toISOString(), location: newEvt.location, description: newEvt.description });
      fetchCalendarEvents(gToken).then(evs => setGEvents(evs)).catch(() => {});
      setShowNewGEvent(false);
      setNewEvt({ title: "", date: today(), time: "09:00", duration: 2, description: "", location: "" });
      toast?.("Google Calendar event created!");
    } catch { toast?.("Failed to create Google event"); }
    setGCreating(false);
  };

  const convertGEventToJob = (ev: GCalEvent) => {
    const newJob = {
      id: uid(), customerId: "", address: ev.location || "", amount: 0,
      status: "scheduled" as const, scheduledDate: ev.start.slice(0, 10),
      scheduledTime: ev.start.length > 10 ? ev.start.slice(11, 16) : "",
      priority: "normal" as const, crew: [], checklist: [], photos: [],
      commLog: [], chemicalsUsed: [], equipment: [], tags: [],
      notes: ev.description || "", googleEventId: ev.id,
    };
    setJobs((prev: any[]) => [...prev, newJob]);
    toast?.("Converted to CRM job — open Jobs to fill in details");
    setSelectedGEvent(null);
  };

  // Jobs without a scheduled date (for the "unscheduled" pool)
  const unscheduled = jobs.filter(j => !j.scheduledDate && j.status !== "completed" && j.status !== "cancelled");

  const handleDrop = async (targetKey, jobIdOverride?: string) => {
    // jobIdOverride lets the touch-drag path (below) pass the job id directly —
    // setDragId() followed by an immediate handleDrop() call would otherwise
    // read the still-stale `dragId` from this closure, since React state
    // updates aren't applied synchronously.
    const jid = jobIdOverride ?? dragId;
    if (!jid) return;
    const job = jobs.find(j => j.id === jid);
    const oldDate = job?.scheduledDate;
    setJobs(jobs.map(j => j.id === jid ? { ...j, scheduledDate: targetKey } : j));
    toast("Rescheduled to " + targetKey);
    setDragId(null);

    // BLOCKER 6 (mobile round 7) — this used to only update local state and
    // rely on the App-level 30s bulk autosave to eventually persist it. That
    // interval restarts on every `jobs` reference change (a 10s poll + a
    // realtime subscription both do that constantly) so it rarely survives
    // long enough to fire — and the far-more-frequent poll/realtime refetch
    // in between overwrites the local drag with the DB's still-old date,
    // snapping the job back to where it started. Writing immediately here
    // (same pattern as JobsPage's "Schedule" button, which never had this
    // bug) makes a drag-drop actually stick.
    (supabase as any).from("jobs").update({ scheduledDate: targetKey }).eq("id", jid)
      .then((result: any) => {
        if (result?.error) {
          toast?.("Failed to save new date — " + result.error.message, "red");
          setJobs((prev: any[]) => prev.map(j => j.id === jid ? { ...j, scheduledDate: oldDate } : j));
        }
      })
      .catch((e: any) => {
        toast?.("Failed to save new date — " + (e?.message || "network error"), "red");
        setJobs((prev: any[]) => prev.map(j => j.id === jid ? { ...j, scheduledDate: oldDate } : j));
      });

    // Send reschedule notification to customer
    if (job && oldDate && oldDate !== targetKey) {
      const c = customers.find(x => x.id === job.customerId);
      if (c?.phone && settings?.twilioSid) {
        const msg = "Hi " + c.firstName + "! Your Crew Boss service has been rescheduled from " + oldDate + " to " + targetKey + ". Questions? Call (717) 555-0100. — Crew Boss";
        twilioSend(settings, c.phone, msg).catch(() => {});
      }
      // Update Google Calendar event if connected
      if (job.googleEventId && settings?.googleConnected && (settings as any)?.googleProviderToken) {
        const timeStr = job.scheduledTime || "09:00";
        const startDt = new Date(targetKey + "T" + timeStr + ":00");
        const endDt = new Date(startDt.getTime() + 2 * 60 * 60 * 1000);
        updateGCalEventApi((settings as any).googleProviderToken, job.googleEventId, {
          start: startDt.toISOString(),
          end: endDt.toISOString(),
        }).catch(() => {});
      }
    }
  };
  const unschedule = jid => {
    const job = jobs.find(j => j.id === jid);
    const oldDate = job?.scheduledDate;
    setJobs(jobs.map(j => j.id === jid ? { ...j, scheduledDate: "" } : j));
    toast("Moved to unscheduled");
    (supabase as any).from("jobs").update({ scheduledDate: "" }).eq("id", jid)
      .then((result: any) => {
        if (result?.error) {
          toast?.("Failed to save — " + result.error.message, "red");
          setJobs((prev: any[]) => prev.map(j => j.id === jid ? { ...j, scheduledDate: oldDate } : j));
        }
      })
      .catch((e: any) => {
        toast?.("Failed to save — " + (e?.message || "network error"), "red");
        setJobs((prev: any[]) => prev.map(j => j.id === jid ? { ...j, scheduledDate: oldDate } : j));
      });
    if (job?.googleEventId && settings?.googleConnected && (settings as any)?.googleProviderToken) {
      deleteGCalEventApi((settings as any).googleProviderToken, job.googleEventId).catch(() => {});
    }
  };

  // FIX 15 — touch-driven counterpart to onDragStart/onDrop above. Started
  // from the unscheduled list's onTouchStart; a small move threshold (8px)
  // distinguishes an intentional drag from a tap so the job detail modal can
  // still open on a plain tap. While dragging, the page's own scroll is
  // suspended (touch-action: none, set inline below) so the gesture doesn't
  // fight the browser's native scroll.
  const TOUCH_DRAG_THRESHOLD = 8;
  const handleUnscheduledTouchStart = (e: React.TouchEvent, jobId: string) => {
    const t = e.touches[0];
    touchDragStartPos.current = { x: t.clientX, y: t.clientY };
    touchDragMovedRef.current = false;
    setTouchDragJobId(jobId);
    setTouchDragPos({ x: t.clientX, y: t.clientY });
  };
  const handleTouchDragMove = (e: React.TouchEvent) => {
    if (!touchDragJobId || !touchDragStartPos.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchDragStartPos.current.x, dy = t.clientY - touchDragStartPos.current.y;
    if (!touchDragMovedRef.current && Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD) return;
    touchDragMovedRef.current = true;
    e.preventDefault(); // now that it's a real drag, stop the page from scrolling under the finger
    setTouchDragPos({ x: t.clientX, y: t.clientY });
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const dayCell = el?.closest("[data-daykey]") as HTMLElement | null;
    const unscheduleZone = el?.closest("[data-unschedule-zone]");
    setTouchDragOverKey(dayCell?.dataset.daykey || null);
    setTouchDragOverUnschedule(!!unscheduleZone);
  };
  const handleTouchDragEnd = () => {
    if (touchDragJobId && touchDragMovedRef.current) {
      if (touchDragOverKey) { handleDrop(touchDragOverKey, touchDragJobId); }
      else if (touchDragOverUnschedule) { unschedule(touchDragJobId); }
    }
    setTouchDragJobId(null);
    setTouchDragPos(null);
    setTouchDragOverKey(null);
    setTouchDragOverUnschedule(false);
    touchDragStartPos.current = null;
    touchDragMovedRef.current = false;
  };

  // Quick actions context menu — right-click (or long-press on mobile) a job
  // pill instead of always having to open the full detail modal first.
  const cancelJobQuick = (jid: string) => {
    if (!window.confirm("Cancel this job?")) return;
    const job = jobs.find(j => j.id === jid);
    setJobs(jobs.map(j => j.id === jid ? { ...j, status: "cancelled", cancelReason: "Cancelled via calendar quick action" } : j));
    toast("Job cancelled");
    if (job?.googleEventId && settings?.googleConnected && (settings as any)?.googleProviderToken) {
      deleteGCalEventApi((settings as any).googleProviderToken, job.googleEventId).catch(() => {});
    }
    setJobContextMenu(null);
  };
  const rescheduleJobQuick = (jid: string) => {
    const job = jobs.find(j => j.id === jid);
    const newDate = window.prompt("New date (YYYY-MM-DD):", job?.scheduledDate || "");
    setJobContextMenu(null);
    if (!newDate) return;
    updateJob(jid, { scheduledDate: newDate });
    toast("Rescheduled to " + newDate);
  };
  const openJobContextMenu = (e: React.MouseEvent | React.TouchEvent, jid: string) => {
    e.preventDefault();
    e.stopPropagation();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    setJobContextMenu({ jobId: jid, x: point.clientX, y: point.clientY });
  };
  const startLongPress = (e: React.TouchEvent, jid: string) => {
    longPressTimer.current = setTimeout(() => openJobContextMenu(e, jid), 500);
  };
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  // Day revenue totals
  const dayTotal = k => (byDate[k] || []).reduce((s, j) => s + (j.amount || 0), 0);

  // Week view calc
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + off * 7);
  const weekDays = Array.from({ length: 7 }).map((_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {["month", "week", "agenda"].map(v => <button key={v} onClick={() => { setView(v); setOff(0); }} className={"px-4 py-2 rounded-xl text-sm font-medium transition border capitalize " + (view === v ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{v}</button>)}

        {/* Google calendar source toggle — only shown when Google is connected */}
        {(settings as any)?.googleConnected && gToken && (
          <div className="flex items-center gap-1 px-1 py-1 bg-black/40 border border-white/10 rounded-xl text-xs">
            {(["crm", "both", "google"] as const).map(src => (
              <button
                key={src}
                onClick={() => setCalSource(src)}
                className={"px-2.5 py-1 rounded-lg transition font-medium " +
                  (calSource === src ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
              >
                {src === "crm" ? "🔴 CRM" : src === "both" ? "Both" : "🔵 Google"}
              </button>
            ))}
            {gLoading && <span className="text-white/30 px-1">…</span>}
          </div>
        )}

        {gToken && (
          <button onClick={() => setShowNewGEvent(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-900/40 border border-blue-700/50 rounded-xl text-xs text-blue-300 hover:bg-blue-800/50 transition">
            <Plus size={12} />New Google Event
          </button>
        )}
        <label className="flex items-center gap-2 ml-auto cursor-pointer px-3 py-2 bg-black/40 border border-red-900/30 rounded-xl text-xs text-white/60 hover:text-white transition">
          <input type="checkbox" checked={showBuffer} onChange={e => setShowBuffer(e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
          🚗 {bufferMinutes}-min travel buffers
        </label>
      </div>

      {view === "month" && (
        <div className="grid lg:grid-cols-[1fr_220px] gap-4">
          <Glass className="p-4">
          <div className="flex items-center justify-between mb-4 gap-2">
            <button
              onClick={() => setOff(off - 1)}
              onDragEnter={() => onDragEnterArrow("prev")}
              onDragOver={e => { e.preventDefault(); }}
              onDragLeave={onDragLeaveArrow}
              // BLOCKER 17 (mobile round 9) — the arrow had no onDrop at all;
              // a job released directly on the arrow (rather than dragged on
              // past the 500ms auto-advance) never reached handleDrop, so
              // dragId was never cleared — the app stayed in a "still
              // dragging" state (drop-target styling lit up elsewhere) until
              // the owner started a new drag. There's no sensible day target
              // for a literal drop on the arrow, so just cancel cleanly.
              onDrop={e => { e.preventDefault(); onDragLeaveArrow(); setDragId(null); }}
              title={dragId ? "Hold a job here to jump to the previous month" : "Previous month"}
              className={"flex items-center gap-1 px-5 py-3 rounded-xl border transition " + (dragHoverArrow === "prev" ? "bg-red-600 border-red-400 scale-105 shadow-lg shadow-red-900/40" : dragId ? "border-red-700/40 border-dashed bg-red-950/20 hover:bg-red-900/30" : "border-transparent hover:bg-white/5")}
            ><ChevronLeft size={18} />{dragHoverArrow === "prev" && <span className="text-[10px] font-semibold">Prev month…</span>}</button>
            <div className="font-semibold text-center flex-1">{vd.toLocaleString("default", { month: "long", year: "numeric" })}</div>
            <button
              onClick={() => setOff(off + 1)}
              onDragEnter={() => onDragEnterArrow("next")}
              onDragOver={e => { e.preventDefault(); }}
              onDragLeave={onDragLeaveArrow}
              onDrop={e => { e.preventDefault(); onDragLeaveArrow(); setDragId(null); }}
              title={dragId ? "Hold a job here to jump to the next month" : "Next month"}
              className={"flex items-center gap-1 px-5 py-3 rounded-xl border transition " + (dragHoverArrow === "next" ? "bg-red-600 border-red-400 scale-105 shadow-lg shadow-red-900/40" : dragId ? "border-red-700/40 border-dashed bg-red-950/20 hover:bg-red-900/30" : "border-transparent hover:bg-white/5")}
            >{dragHoverArrow === "next" && <span className="text-[10px] font-semibold">Next month…</span>}<ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-center text-[10px] uppercase text-white/40 py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: fd }).map((_, i) => <div key={"p" + i} />)}
            {Array.from({ length: dim }).map((_, i) => {
              const d = i + 1;
              const k = key(d);
              const dj = calSource !== "google" ? (byDate[k] || []) : [];
              const gd = calSource !== "crm" ? (gByDate[k] || []) : [];
              const isT = k === tKey;
              const dt = dayTotal(k);
              const hasCompleted = dj.some(j => j.status === "completed");
              const hasInProgress = dj.some(j => j.status === "in_progress");
              const hasUrgent = dj.some(j => j.priority === "urgent");
              const cellBg = isT ? "bg-red-950/30 border-red-700/50" : hasInProgress ? "bg-orange-950/20 border-orange-700/30" : hasCompleted && dj.every(j => j.status === "completed") ? "bg-green-950/20 border-green-800/30" : hasUrgent ? "bg-red-950/20 border-red-700/40" : dj.length > 0 ? "bg-blue-950/10 border-blue-900/20" : gd.length > 0 ? "bg-blue-950/10 border-blue-900/20" : "bg-white/5 border-white/5 hover:border-red-900/30";
              const isTouchDragOver = touchDragOverKey === k;
              return (
                <div key={d} data-daykey={k} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(k)} className={"min-h-[84px] p-1.5 rounded-lg border transition-all " + cellBg + (isTouchDragOver ? " !border-red-500 !bg-red-950/40 scale-[1.03]" : "")}>
                  <div className="flex items-center justify-between mb-1">
                    <div className={"text-xs font-semibold " + (isT ? "text-red-400" : "text-white/70")}>{d}</div>
                    {dt > 0 && <div className="text-[8px] text-green-400/70 font-mono">${Math.round(dt)}</div>}
                  </div>
                  <div className="space-y-0.5">
                    {sortedWithGaps(dj).slice(0, 3).map(({ job: j, gapBefore, tooTight }) => {
                      const c = customers.find((x: any) => x.id === j.customerId);
                      const initials = crewInitials(j);
                      return <React.Fragment key={j.id}>
                        {showBuffer && gapBefore !== null && (
                          <div
                            title={tooTight ? `Only ${gapBefore}min between jobs — below your ${bufferMinutes}min buffer setting` : `${gapBefore}min gap before this job`}
                            className={"text-[8px] px-1 py-0.5 rounded truncate " + (tooTight ? "bg-red-950/60 border border-red-700/50 text-red-300" : "bg-gray-950/50 border border-gray-800/30 text-gray-400/60")}
                          >
                            {tooTight ? "⚠️ " : "🚗 "}{gapBefore}min gap
                          </div>
                        )}
                        {/* FIX 16 — this pill (an ALREADY-SCHEDULED job on the
                            month grid) only ever wired up long-press (context
                            menu) for touch — draggable/onDragStart is a
                            mouse-only API that never fires from touch input,
                            so rescheduling a job by dragging it to a
                            different day (the whole point of the drag-drop
                            calendar) silently didn't work on a phone; only
                            unscheduled-list-to-day drag did. Layers the same
                            touch-drag tracking used there on top of the
                            existing long-press: a still touch still opens the
                            quick-actions menu, a touch that moves past the
                            drag threshold cancels the long-press and drags
                            the job to another day (or the unschedule zone)
                            instead. */}
                        <div draggable onDragStart={() => setDragId(j.id)} onClick={() => setSelectedJobId(j.id)} onContextMenu={(e: React.MouseEvent) => openJobContextMenu(e, j.id)}
                          onTouchStart={(e: React.TouchEvent) => { startLongPress(e, j.id); handleUnscheduledTouchStart(e, j.id); }}
                          onTouchMove={(e: React.TouchEvent) => { cancelLongPress(); handleTouchDragMove(e); }}
                          onTouchEnd={() => { cancelLongPress(); handleTouchDragEnd(); }}
                          style={{ opacity: touchDragJobId === j.id ? 0.3 : 1 }}
                          className={"text-[9px] px-1 py-0.5 rounded truncate cursor-pointer text-white " + eventBg(j) + " " + prioRing(j.priority)} title={c?.firstName + " " + c?.lastName + " · " + fmt(j.amount) + (j.priority && j.priority !== "normal" ? " · " + j.priority : "") + (j.googleEventId ? " · synced" : "")}>
                          {j.priority === "urgent" && "🚨 "}{j.googleEventId && "☁"}{c?.firstName}{initials && <span className="opacity-60 ml-0.5">{initials}</span>}
                        </div>
                      </React.Fragment>;
                    })}
                    {dj.length > 3 && <div className="text-[9px] text-white/50">+{dj.length - 3} CRM</div>}
                    {gd.slice(0, 2).map(ev => (
                      <div key={ev.id} onClick={() => setSelectedGEvent(ev)} className="text-[9px] px-1 py-0.5 rounded truncate bg-blue-700 text-white cursor-pointer hover:bg-blue-600 transition" title={ev.title}>
                        🔵 {ev.title}
                      </div>
                    ))}
                    {gd.length > 2 && <div className="text-[9px] text-blue-400/60">+{gd.length - 2} Google</div>}
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
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-700" />☁ Synced to Google</span>
            {calSource !== "crm" && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-700" />Google only</span>}
          </div>
          </Glass>
          <Glass className="p-4 h-fit sticky top-24">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Clipboard size={10} />Unscheduled ({unscheduled.length})</div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {unscheduled.length === 0 && <div className="text-xs text-white/30 text-center py-6">Everything's on the board ✓</div>}
              {unscheduled.map(j => {
                const c = customers.find(x => x.id === j.customerId);
                return <div key={j.id} draggable onDragStart={() => setDragId(j.id)}
                  onTouchStart={e => handleUnscheduledTouchStart(e, j.id)} onTouchMove={handleTouchDragMove} onTouchEnd={handleTouchDragEnd}
                  style={{ touchAction: "pan-y", opacity: touchDragJobId === j.id ? 0.3 : 1 }}
                  className={"p-2.5 rounded-lg cursor-grab bg-black/40 border hover:border-red-600/50 transition " + (j.priority === "urgent" ? "border-red-500/50" : j.priority === "high" ? "border-yellow-500/50" : "border-red-900/30")}>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="font-medium text-xs truncate">{c?.firstName} {c?.lastName}</div>
                    {j.priority && j.priority !== "normal" && <span className={"text-[8px] px-1 rounded uppercase " + (j.priority === "urgent" ? "bg-red-600/40 text-red-300" : j.priority === "high" ? "bg-yellow-600/40 text-yellow-300" : "bg-white/10 text-white/50")}>{j.priority[0]}</span>}
                  </div>
                  <div className="text-[10px] text-white/50 truncate">{j.address}</div>
                  <div className="text-[10px] text-red-400 font-semibold mt-0.5">{fmt(j.amount)}</div>
                </div>;
              })}
            </div>
            <div className="text-[9px] text-white/30 text-center mt-3 pt-3 border-t border-red-900/20">↳ Drag (or press and drag on mobile) onto calendar to schedule</div>
            {jobs.some(j => j.scheduledDate) && <div className="mt-2 text-[9px] text-white/30 text-center">Drop on this panel to unschedule</div>}
            <div data-unschedule-zone onDragOver={e => e.preventDefault()} onDrop={() => dragId && unschedule(dragId)}
              className={"mt-2 h-8 border border-dashed rounded-lg flex items-center justify-center text-[9px] transition " + (touchDragOverUnschedule ? "border-red-500 bg-red-950/30 text-red-300" : "border-white/10 text-white/30")}>
              Drop here
            </div>
          </Glass>

          {/* FIX 15 — floating "ghost" that follows the finger during a touch
              drag, since there's no native browser drag-image on touch. */}
          {touchDragJobId && touchDragPos && (() => {
            const j = jobs.find(x => x.id === touchDragJobId);
            const c = j ? customers.find(x => x.id === j.customerId) : null;
            if (!j) return null;
            return (
              <div className="fixed z-[100] pointer-events-none px-3 py-2 rounded-lg bg-red-900/90 border border-red-500/60 text-white text-xs font-medium shadow-2xl"
                style={{ left: touchDragPos.x + 12, top: touchDragPos.y - 20 }}>
                {c ? `${c.firstName} ${c.lastName}` : j.address}
              </div>
            );
          })()}
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
                <div key={k} data-daykey={k} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(k)} className={"min-h-[200px] p-2 rounded-lg border transition-all " + (isT ? "bg-red-950/30 border-red-700/50" : "bg-white/5 border-white/10") + (touchDragOverKey === k ? " !border-red-500 !bg-red-950/40 scale-[1.02]" : "")}>
                  <div className={"text-[10px] uppercase " + (isT ? "text-red-400 font-bold" : "text-white/50")}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  <div className="text-lg font-bold mb-2">{d.getDate()}</div>
                  <div className="space-y-1">
                    {dj.map(j => {
                      const c = customers.find((x: any) => x.id === j.customerId);
                      const initials = crewInitials(j);
                      // FIX 16 — same touch-drag gap as the month view above:
                      // this pill had no touch handling at all (draggable is
                      // mouse-only), so a scheduled job couldn't be moved to
                      // another day via touch in week view either.
                      return <div key={j.id} draggable onDragStart={() => setDragId(j.id)} onClick={() => setSelectedJobId(j.id)}
                        onContextMenu={(e: React.MouseEvent) => openJobContextMenu(e, j.id)}
                        onTouchStart={(e: React.TouchEvent) => { startLongPress(e, j.id); handleUnscheduledTouchStart(e, j.id); }}
                        onTouchMove={(e: React.TouchEvent) => { cancelLongPress(); handleTouchDragMove(e); }}
                        onTouchEnd={() => { cancelLongPress(); handleTouchDragEnd(); }}
                        style={{ opacity: touchDragJobId === j.id ? 0.3 : 1 }}
                        className={"text-[10px] p-1.5 rounded cursor-pointer " + eventBg(j) + " text-white"}>
                        <div className="font-semibold truncate">{j.googleEventId && "☁ "}{c?.firstName}</div>
                        <div className="opacity-75">{fmt(j.amount)}</div>
                        {initials && <div className="text-[8px] opacity-60 mt-0.5">{initials}</div>}
                      </div>;
                    })}
                    {(calSource !== "crm" ? (gByDate[k] || []) : []).map((ev: GCalEvent) => (
                      <div key={ev.id} onClick={() => setSelectedGEvent(ev)} className="text-[10px] p-1.5 rounded bg-blue-700 text-white cursor-pointer hover:bg-blue-600 transition">
                        <div className="font-semibold truncate">🔵 {ev.title}</div>
                        {ev.start && <div className="opacity-75">{ev.start.slice(11, 16)}</div>}
                      </div>
                    ))}
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
              const c = customers.find((x: any) => x.id === j.customerId);
              const initials = crewInitials(j);
              return (
                <div key={j.id} onClick={() => setSelectedJobId(j.id)} className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition">
                  <div className={"w-1 h-10 rounded-full " + eventBg(j)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{j.googleEventId && "☁ "}{c?.firstName} {c?.lastName}</div>
                    <div className="text-xs text-white/50 truncate">{j.address}</div>
                    {initials && <div className="text-[10px] text-white/40 mt-0.5">Crew: {initials}</div>}
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

      {/* Quick actions context menu — right-click or long-press a job pill */}
      {jobContextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setJobContextMenu(null)} onContextMenu={(e: React.MouseEvent) => { e.preventDefault(); setJobContextMenu(null); }} />
          <div className="fixed z-50 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl overflow-hidden py-1 w-44" style={{ left: Math.max(8, Math.min(jobContextMenu.x + 10, window.innerWidth - 184)), top: Math.max(8, Math.min(jobContextMenu.y - 10, window.innerHeight - 200)) }}>
            <button onClick={() => { setSelectedJobId(jobContextMenu.jobId); setJobContextMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition"><Eye size={12} />View Details</button>
            <button onClick={() => { setSelectedJobId(jobContextMenu.jobId); setJobContextMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition"><UserCheck size={12} />Assign Crew</button>
            <button onClick={() => rescheduleJobQuick(jobContextMenu.jobId)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition"><RefreshCw size={12} />Reschedule</button>
            <button onClick={() => cancelJobQuick(jobContextMenu.jobId)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30 transition border-t border-white/10"><Ban size={12} />Cancel Job</button>
          </div>
        </>
      )}

      {/* Job Detail Modal — opens when a CRM job chip is clicked */}
      <JobDetailModal
        jobId={selectedJobId}
        job={jobs.find(j => j.id === selectedJobId)}
        onClose={() => setSelectedJobId(null)}
        customers={customers}
        employees={employees}
        updateJob={updateJob}
        toast={toast}
        gToken={gToken}
        settings={settings}
        ownerId={ownerId}
      />

      {/* New Google Calendar Event Modal */}
      {showNewGEvent && (
        <Modal open={showNewGEvent} onClose={() => setShowNewGEvent(false)} title="New Google Calendar Event" maxW="max-w-md">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Event Title *</label>
              <GInput value={newEvt.title} onChange={e => setNewEvt(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Pressure wash — Smith residence" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Date</label>
                <GDate value={newEvt.date} onChange={e => setNewEvt(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Start Time</label>
                <GInput type="time" value={newEvt.time} onChange={e => setNewEvt(p => ({ ...p, time: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Duration (hours)</label>
              <GInput type="number" step="0.5" min="0.5" max="12" value={newEvt.duration} onChange={e => setNewEvt(p => ({ ...p, duration: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Location</label>
              <GInput value={newEvt.location} onChange={e => setNewEvt(p => ({ ...p, location: e.target.value }))} placeholder="123 Main St, City, PA" />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Description</label>
              <GTxt rows={2} value={newEvt.description} onChange={e => setNewEvt(p => ({ ...p, description: e.target.value }))} placeholder="Service details, notes..." />
            </div>
            <div className="flex gap-2 pt-1">
              <GBtn onClick={handleCreateGEvent} disabled={gCreating || !newEvt.title.trim()} className="flex-1">
                {gCreating ? "Creating…" : "Create Google Event"}
              </GBtn>
              <GBtn variant="ghost" onClick={() => setShowNewGEvent(false)}>Cancel</GBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* Google Event Detail Modal */}
      {selectedGEvent && (
        <Modal open={!!selectedGEvent} onClose={() => setSelectedGEvent(null)} title="Google Calendar Event" maxW="max-w-md">
          <div className="space-y-3">
            <div className="p-3 bg-blue-950/20 border border-blue-700/30 rounded-xl">
              <div className="font-semibold text-lg">{selectedGEvent.title}</div>
              <div className="text-xs text-white/50 mt-1 space-y-1">
                {selectedGEvent.start && <div className="flex items-center gap-1"><Calendar size={10} />{selectedGEvent.start.slice(0, 10)} {selectedGEvent.start.slice(11, 16)}</div>}
                {selectedGEvent.end && <div className="flex items-center gap-1"><Clock size={10} />Ends {selectedGEvent.end.slice(11, 16)}</div>}
                {selectedGEvent.location && <div className="flex items-center gap-1"><MapPin size={10} />{selectedGEvent.location}</div>}
              </div>
            </div>
            {selectedGEvent.description && (
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70">
                {selectedGEvent.description}
              </div>
            )}
            {selectedGEvent.attendees?.length > 0 && (
              <div className="text-xs text-white/50">
                <span className="font-medium text-white/70">Attendees: </span>
                {selectedGEvent.attendees.join(", ")}
              </div>
            )}
            {selectedGEvent.htmlLink && (
              <a href={selectedGEvent.htmlLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <ExternalLink size={10} />Open in Google Calendar
              </a>
            )}
            <div className="pt-2 border-t border-white/10">
              <div className="text-xs text-white/50 mb-2">Convert this Google event to a CRM job to track crew, payment, and checklist progress.</div>
              <GBtn onClick={() => convertGEventToJob(selectedGEvent)} className="w-full">
                <Briefcase size={12} className="inline mr-1.5" />Convert to CRM Job
              </GBtn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===== REVIEWS =====

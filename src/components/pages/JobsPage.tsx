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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, withTimeout } from "../../lib/utils";
const weatherRisk = (_dateStr: string): {icon: string; level: string; reason: string} | null => null;
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell, emailButton } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { createGCalEvent, updateGCalEvent, deleteGCalEvent as deleteGCalEventDirect } from "../../lib/googleApi";
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

export function JobsPage({ jobs = [], setJobs, customers = [], setCustomers = (() => {}) as any, employees = [], estimates = [], setEstimates = () => {}, settings = {} as AppSettings, toast, posts = [], setPosts = () => {}, setTimeline = () => {}, initialDetailId = null, onInitialDetailIdConsumed = () => {}, onPortal = (_id: string) => {}, ownerId = "" }: { jobs?: any[]; setJobs?: any; customers?: any[]; setCustomers?: any; employees?: any[]; estimates?: any[]; setEstimates?: any; settings?: AppSettings; toast?: any; posts?: any[]; setPosts?: any; setTimeline?: any; initialDetailId?: string | null; onInitialDetailIdConsumed?: () => void; onPortal?: (id: string) => void; ownerId?: string }) {
  const [tab, setTab] = useState("scheduled");
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState(cancelReasons[0]);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const confirmDelete = async () => {
    if (!deleteModal) return;
    const jid = deleteModal;
    setJobs((prev: any[]) => prev.filter((x: any) => x.id !== jid));
    if (jid === detailId) setDetailId(null);
    // Must also delete server-side — otherwise the next cross-device sync
    // poll just re-fetches this row from Supabase and it reappears locally.
    // The query builder is thenable but not a real Promise, so calling
    // .catch() directly on the chain throws "catch is not a function" —
    // that thrown error was aborting this function before the modal closed,
    // which is why it used to stay open after confirming. await + try/catch
    // avoids relying on .catch() existing on the builder at all.
    try {
      await (supabase as any).from("jobs").delete().eq("id", jid);
    } catch (err) {
      console.warn("Job delete failed to save server-side:", err);
    }
    setDeleteModal(null);
    toast("Job permanently deleted");
  };
  const [detailId, setDetailId] = useState(null);

  // Deep-link into a specific job's detail — e.g. from Dashboard's Live Team
  // View "View" button, which navigates here with a target job already known.
  useEffect(() => {
    if (!initialDetailId) return;
    setDetailId(initialDetailId);
    onInitialDetailIdConsumed();
  }, [initialDetailId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [prioFilter, setPrioFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [routeOpen, setRouteOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState(null);
  const [, forceTick] = useState(0);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [newJobForm, setNewJobForm] = useState({ customerId: "", address: "", amount: "", scheduledDate: today(), scheduledTime: "", priority: "normal", notes: "", duration: "", crewEmpId: "" });
  const [newJobCrewMode, setNewJobCrewMode] = useState<"assign" | "request">("assign");
  const [quickReqJobId, setQuickReqJobId] = useState<string | null>(null);
  const [quickReqEmpId, setQuickReqEmpId] = useState("");
  const [quickReqMsg, setQuickReqMsg] = useState("");
  const [quickReqSending, setQuickReqSending] = useState(false);

  // Live tick for any running clocks
  useEffect(() => {
    if (!jobs.some(j => j.clockInAt)) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [jobs]);

  // Route optimization using nearest-neighbor heuristic on lat/lng
  const baseGeo = { lat: 39.9626, lng: -76.7277 }; // York PA depot
  const dist = (a, b) => Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2));
  const optimizeRoute = scheduledJobs => {
    const withGeo = scheduledJobs.map(j => ({ ...j, lat: j.lat || baseGeo.lat + (Math.random() - 0.5) * 0.1, lng: j.lng || baseGeo.lng + (Math.random() - 0.5) * 0.15 }));
    if (withGeo.length <= 1) return withGeo;
    const visited = new Set();
    const route = [];
    let current = baseGeo;
    while (route.length < withGeo.length) {
      let nearest = null;
      let nearestDist = Infinity;
      withGeo.forEach(j => {
        if (visited.has(j.id)) return;
        const d = dist(current, j);
        if (d < nearestDist) { nearestDist = d; nearest = j; }
      });
      if (nearest) { visited.add(nearest.id); route.push(nearest); current = nearest; }
    }
    return route;
  };

  const todayScheduled = jobs.filter(j => j.scheduledDate === today() && j.status === "scheduled");
  const optimizedRoute = optimizeRoute(todayScheduled);

  const tabs = { scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" };
  const prioOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
  const filtered = jobs
    .filter(j => j.status === tab)
    .filter(j => prioFilter === "all" || (j.priority || "normal") === prioFilter)
    .filter(j => {
      if (!search.trim()) return true;
      const c = customers.find(x => x.id === j.customerId);
      const q = search.toLowerCase();
      return (c?.firstName + " " + c?.lastName).toLowerCase().includes(q) || (j.address || "").toLowerCase().includes(q) || (j.tags || []).some(t => t.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === "amount") return b.amount - a.amount;
      if (sortBy === "priority") return (prioOrder[a.priority || "normal"] - prioOrder[b.priority || "normal"]) || a.scheduledDate.localeCompare(b.scheduledDate);
      // default: date, then priority
      return a.scheduledDate.localeCompare(b.scheduledDate) || (prioOrder[a.priority || "normal"] - prioOrder[b.priority || "normal"]);
    });

  const move = (jid, ns) => {
    setJobs(jobs.map(j => j.id === jid ? { ...j, status: ns } : j));
    // Auto-text customer when job is confirmed/scheduled
    if (ns === "scheduled") {
      const j = jobs.find(x => x.id === jid);
      const c = j && customers.find(x => x.id === j.customerId);
      if (c?.phone && settings?.twilioSid) {
        const msg = "Hi " + c.firstName + "! Your pressure washing service has been confirmed for " + (j.scheduledDate || "your requested date") + ". We'll text you when we're on the way. Questions? Call (717) 555-0100. — Smock's";
        twilioSend(settings, c.phone, msg).catch(() => {});
      }
    }
    // Job completed thank-you text (separate from review request)
    if (ns === "completed") {
      const j = jobs.find(x => x.id === jid);
      const c = j && customers.find(x => x.id === j.customerId);
      if (c?.phone && settings?.twilioSid) {
        const msg = "Hi " + c.firstName + "! Your home is looking great 🙌 Thank you for choosing Smock's Pressure Washing. We appreciate your business! If you ever need us again, reply or call (717) 555-0100. — Will @ Smock's";
        setTimeout(() => twilioSend(settings, c.phone, msg).catch(() => {}), 1000);
      }
      // Auto-add to customer timeline
      if (j && c) {
        setTimeline(prev => ({ ...prev, [c.id]: [{ id: uid(), type: "job", note: "Job completed — " + fmt(j.amount), date: today() }, ...(prev[c.id] || [])] }));
      }
      // Referral credit — if this referred customer's FIRST completed job
      // just happened, credit whoever referred them. Checked against jobs
      // BEFORE this update lands, so it only fires once per referral.
      if (j && c?.referredBy) {
        const priorCompleted = jobs.filter(x => x.customerId === c.id && x.status === "completed" && x.id !== j.id);
        if (priorCompleted.length === 0) {
          const referrer = customers.find(x => x.id === c.referredBy);
          if (referrer) {
            const creditAmount = Number((settings as any)?.referralSettings?.referrerCredit) || 25;
            setCustomers((prev: any[]) => prev.map(x => x.id === referrer.id ? { ...x, referralCreditOwed: (Number(x.referralCreditOwed) || 0) + creditAmount } : x));
            toast?.(`${referrer.firstName} earned $${creditAmount} referral credit for referring ${c.firstName} ✓`, "green");
          }
        }
      }
      // Auto-post if Social auto-post is enabled in settings
      if (settings?.autoPostCompletedJobs && j) {
        const area = j.address?.split(",")[1]?.trim() || "York, PA";
        const serviceType = (j.notes || j.address || "").toLowerCase().includes("roof") ? "Roof Soft Wash" :
          (j.notes || "").toLowerCase().includes("drive") ? "Driveway Clean" : "House Soft Wash";
        const caption = "✅ Just wrapped a " + serviceType + " in " + area + "! 💧\n\nAnother property looking fresh. Ready to transform yours?\n\nFree quotes → (717) 555-0100\n\n#smockspressurewashing #yorkpa #pressurewashing #softwash";
        setPosts(prev => [{ id: uid(), platform: "instagram", type: "completed_job", caption, scheduledFor: today(), hashtags: "#pressurewashing #yorkpa", status: "scheduled", likes: 0, shares: 0, comments: 0, reach: 0, autoGenerated: true }, ...prev]);
        toast("📱 Auto-post drafted for this job → Social tab");
      }
    }
  };
  const toggleCk = (jid, idx) => setJobs(jobs.map(j => j.id === jid ? { ...j, checklist: (j.checklist || []).map((c, i) => i === idx ? { ...c, done: !c.done } : c) } : j));
  const updateJob = (jid, patch) => {
    const oldJob = jobs.find(j => j.id === jid);
    setJobs(jobs.map(j => j.id === jid ? { ...j, ...patch } : j));
    // Crew assignment must reach Supabase immediately — the employee portal
    // polls Supabase directly, and waiting for the 30s auto-save interval in
    // App.tsx means an assignment can sit invisible to the employee that long.
    // Clock-in/lunch/hours fields are excluded from the App-level 30s bulk
    // autosave (so it never clobbers a more-recent write the employee portal
    // made directly), so any owner-side edit to them must be pushed to
    // Supabase immediately right here instead.
    const EMPLOYEE_OWNED_FIELDS = ["clockInAt", "lunchStartAt", "lunchMinutes", "lunchExceeded", "loggedHours"] as const;
    const ownedPatch: any = {};
    EMPLOYEE_OWNED_FIELDS.forEach(f => { if ((patch as any)[f] !== undefined) ownedPatch[f] = (patch as any)[f]; });
    if (Object.keys(ownedPatch).length > 0) {
      (supabase as any).from("jobs").update(ownedPatch).eq("id", jid)
        .then((result: any) => { if (result?.error) toast?.("Failed to save — " + result.error.message, "red"); })
        .catch((e: any) => toast?.("Failed to save: " + e?.message, "red"));
    }
    if (patch.crew !== undefined) {
      console.log("SAVING JOB — crew:", patch.crew, "full job:", { ...oldJob, ...patch });
      const crewPatch: any = { crew: patch.crew };
      if (patch.crewAssignedAt !== undefined) crewPatch.crewAssignedAt = patch.crewAssignedAt;
      (supabase as any).from("jobs").update(crewPatch).eq("id", jid)
        .then((result: any) => {
          console.log("SUPABASE SAVE RESULT:", result);
          if (result?.error) toast?.("Crew assignment failed to save — " + result.error.message, "red");
          // Verify the write actually landed — re-query the row directly.
          (supabase as any).from("jobs").select("crew").eq("id", jid).maybeSingle()
            .then((verify: any) => console.log("VERIFY CREW SAVED — job", jid, ":", verify?.data?.crew));
        })
        .catch((e: any) => {
          console.warn("SUPABASE SAVE FAILED:", e?.message);
          toast?.("Crew assignment failed to save", "red");
        });
    }
    // Sync Google Calendar when date or time changes
    if (oldJob?.googleEventId && (settings as any)?.googleConnected && (settings as any)?.googleToken) {
      if (patch.scheduledDate !== undefined || patch.scheduledTime !== undefined) {
        const newDate = patch.scheduledDate ?? oldJob.scheduledDate;
        const newTime = patch.scheduledTime ?? oldJob.scheduledTime ?? "09:00";
        if (newDate) {
          const startDt = new Date(newDate + "T" + (newTime || "09:00") + ":00");
          const hrs = Number(patch.duration ?? oldJob.duration) || 2;
          const endDt = new Date(startDt.getTime() + hrs * 3600000);
          updateGCalEvent((settings as any).googleToken, oldJob.googleEventId, {
            start: startDt.toISOString(),
            end: endDt.toISOString(),
          }, (settings as any).googleCalendarId || "primary").catch(() => {});
        }
      }
    }
  };
  const confirmCancel = () => {
    const j = jobs.find(x => x.id === cancelModal);
    setJobs(jobs.map(x => x.id === cancelModal ? { ...x, status: "cancelled", cancelReason } : x));
    setCancelModal(null);
    toast("Job cancelled");
    // Delete Google Calendar event if connected
    if (j?.googleEventId && settings?.googleConnected && (settings as any)?.googleToken) {
      deleteGCalEventDirect((settings as any).googleToken, j.googleEventId).catch(() => {});
    }
  };
  const clockIn = jid => { updateJob(jid, { clockInAt: Date.now() }); toast("Clocked in"); };
  const clockOut = j => {
    if (!j.clockInAt) return;
    const hrs = Math.round(((Date.now() - j.clockInAt) / 3600000) * 100) / 100;
    updateJob(j.id, { clockInAt: null, loggedHours: Math.round(((Number(j.loggedHours) || 0) + hrs) * 100) / 100 });
    toast("+" + hrs + "h logged");
  };

  const sendQuickJobRequest = async (job: any) => {
    const emp = employees.find(e => e.id === quickReqEmpId);
    if (!emp) return;
    setQuickReqSending(true);
    try {
      // ownerId is captured once at app auth-bootstrap (App.tsx) and passed
      // down as a prop — this component must never call
      // supabase.auth.getSession() itself, since that call is known to hang
      // indefinitely under Supabase internal navigator-lock contention, which
      // is exactly what left this button stuck on "Sending…" forever.
      if (!ownerId) {
        toast?.("Still finishing sign-in — wait a moment and try again", "red");
        return;
      }
      const portalUrl = `${window.location.origin}${window.location.pathname}`;
      const { data: row, error } = await withTimeout<any>(
        (supabase as any).from("job_requests").insert({
          job_id: job.id,
          employee_id: emp.id,
          owner_id: ownerId,
          status: "pending",
          message: quickReqMsg.trim() || null,
        }).select("id").single(),
        8000, "Save request"
      );
      if (!error && row?.id) {
        const requestUrl = `${portalUrl}#/portal?request=${row.id}`;
        const c = customers.find((x: any) => x.id === job.customerId);
        if (emp.email) {
          const html = emailShell(settings.companyName || "Smock's Pressure Washing", "Job Request", `<p>Hi ${emp.firstName},</p><p>${quickReqMsg || "You have a new job request:"}</p>
              <ul>
                <li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li>
                <li><b>Address:</b> ${job.address}</li>
                ${c ? `<li><b>Customer:</b> ${c.firstName} ${c.lastName}</li>` : ""}
              </ul>` + emailButton("View Request — Accept or Decline", requestUrl));
          withTimeout(sendEmail(settings, { to: emp.email, subject: `Job Request — ${job.scheduledDate}`, body: html }), 8000, "Email send").catch((e: any) => console.warn("Job request email failed — request still saved:", e?.message));
        }
        if (toast) toast(`Request sent to ${emp.firstName} ✓`, "green");
        setQuickReqJobId(null);
        setQuickReqEmpId("");
        setQuickReqMsg("");
      } else {
        if (toast) toast("Request failed — " + (error?.message || "run the job_requests SQL in Supabase first"), "red");
      }
    } catch (e: any) {
      if (toast) toast(e?.message || "Error sending request", "red");
    } finally {
      setQuickReqSending(false);
    }
  };

  // Touch swipe handling
  const touchRef = useRef({});
  const handleTouchStart = (jid, e) => { touchRef.current[jid] = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (jid, e, job) => {
    const start = touchRef.current[jid];
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = Math.abs(e.changedTouches[0].clientY - start.y);
    if (dx < -80 && dy < 50 && job.status === "in_progress") {
      move(jid, "completed");
      toast("Job completed!");
    } else if (dx < -80 && dy < 50 && job.status === "scheduled") {
      move(jid, "in_progress");
      toast("Job started");
    }
    delete touchRef.current[jid];
  };

  return (
    <div className="space-y-4">
      {/* Route Optimization Modal */}
      <Modal open={routeOpen} onClose={() => setRouteOpen(false)} title="Today's Optimized Route" maxW="max-w-lg">
        {optimizedRoute.length === 0 ? <div className="text-center py-8 text-white/50 text-sm">No jobs scheduled for today yet.</div> : <div className="space-y-3">
          <div className="text-xs text-white/60 mb-2">Nearest-neighbor route from York PA depot · {optimizedRoute.length} stops</div>
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center pt-1">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">🏠</div>
              <div className="w-px flex-1 bg-red-700/40 my-0.5" style={{ minHeight: "20px" }} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5"><div className="text-xs font-semibold">York PA Depot</div><div className="text-[10px] text-white/50">Start here</div></div>
          </div>
          {optimizedRoute.map((j, idx) => {
            const c = customers.find(x => x.id === j.customerId);
            const wr = weatherRisk(j.scheduledDate);
            return <div key={j.id} className="flex items-start gap-2">
              <div className="flex flex-col items-center pt-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{idx + 1}</div>
                {idx < optimizedRoute.length - 1 && <div className="w-px bg-red-700/40 my-0.5" style={{ height: "24px" }} />}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{c?.firstName} {c?.lastName}</div>
                  <div className="text-xs text-red-400 font-semibold">{fmt(j.amount)}</div>
                </div>
                <div className="text-[11px] text-white/60 truncate">{j.address}</div>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {j.duration && <span className="text-[10px] text-white/50">⏱ {j.duration}h</span>}
                  {j.priority && j.priority !== "normal" && <Badge tone={j.priority === "urgent" ? "red" : "yellow"}>{j.priority}</Badge>}
                  {wr && <span className="text-[10px] text-yellow-300">{wr.icon} {wr.reason}</span>}
                </div>
              </div>
            </div>;
          })}
          <div className="pt-3 border-t border-red-900/20 text-xs text-white/50 flex justify-between">
            <span>Estimated total: {optimizedRoute.reduce((s, j) => s + (j.duration || 2), 0)}h</span>
            <span>Revenue: {fmt(optimizedRoute.reduce((s, j) => s + j.amount, 0))}</span>
          </div>
          <GBtn onClick={() => { navigator.clipboard?.writeText(optimizedRoute.map((j, i) => { const c = customers.find(x => x.id === j.customerId); return (i + 1) + ". " + c?.firstName + " " + c?.lastName + " — " + j.address; }).join("\n")); toast("Route copied"); }} variant="ghost" className="w-full !text-xs"><Copy size={12} className="inline mr-1.5" />Copy route</GBtn>
        </div>}
      </Modal>

      {/* New Job Modal */}
      <Modal open={newJobOpen} onClose={() => setNewJobOpen(false)} title="Schedule New Job" maxW="max-w-lg">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Customer</label>
            <GSel value={newJobForm.customerId} onChange={e => {
              const c = customers.find(x => x.id === e.target.value);
              setNewJobForm(f => ({ ...f, customerId: e.target.value, address: c?.address || f.address }));
            }}>
              <option value="" className="bg-black">— Select customer —</option>
              {customers.map(c => <option key={c.id} value={c.id} className="bg-black">{c.firstName} {c.lastName}</option>)}
            </GSel>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Service address</label>
            {(() => {
              const selCust = customers.find(c => c.id === newJobForm.customerId);
              const extraAddrs = selCust?.addresses || [];
              if (extraAddrs.length > 0) {
                const allAddrs = [
                  { id: "__primary__", label: "Primary", street: selCust?.address || "" },
                  ...extraAddrs.map((a: any) => ({ id: a.id, label: a.label || a.street, street: [a.street, a.city, a.state].filter(Boolean).join(", ") })),
                  { id: "__custom__", label: "Custom address…", street: "" },
                ];
                const selectedId = allAddrs.find(a => a.street === newJobForm.address)?.id || "__primary__";
                return (
                  <div className="space-y-2">
                    <GSel
                      value={selectedId}
                      onChange={e => {
                        const picked = allAddrs.find(a => a.id === e.target.value);
                        if (picked && picked.id !== "__custom__") {
                          setNewJobForm(f => ({ ...f, address: picked.street }));
                        }
                      }}
                    >
                      {allAddrs.map(a => (
                        <option key={a.id} value={a.id} className="bg-black">
                          {a.label}{a.street ? ` — ${a.street.slice(0, 40)}` : ""}
                        </option>
                      ))}
                    </GSel>
                    {selectedId === "__custom__" && (
                      <AddressAutocomplete value={newJobForm.address} onChange={v => setNewJobForm(f => ({ ...f, address: v }))} mapsKey={settings.googleMapsKey || settings.mapsKey || ""} placeholder="123 Main St, York PA" knownAddresses={customers.map((c: any) => c.address).filter(Boolean)} />
                    )}
                  </div>
                );
              }
              return <AddressAutocomplete value={newJobForm.address} onChange={v => setNewJobForm(f => ({ ...f, address: v }))} mapsKey={settings.googleMapsKey || settings.mapsKey || ""} placeholder="123 Main St, York PA" knownAddresses={customers.map((c: any) => c.address).filter(Boolean)} />;
            })()}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Date</label>
              <GDate value={newJobForm.scheduledDate} onChange={e => setNewJobForm(f => ({ ...f, scheduledDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Time (optional)</label>
              <GInput type="time" value={newJobForm.scheduledTime} onChange={e => setNewJobForm(f => ({ ...f, scheduledTime: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Amount ($)</label>
              <GInput type="number" placeholder="0" value={newJobForm.amount} onChange={e => setNewJobForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Priority</label>
              <GSel value={newJobForm.priority} onChange={e => setNewJobForm(f => ({ ...f, priority: e.target.value }))}>
                {priorityLevels.map(p => <option key={p.key} value={p.key} className="bg-black capitalize">{p.key}</option>)}
              </GSel>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Est. Duration <span className="text-white/30">(hours)</span></label>
            <GInput type="number" step="0.25" min="0" placeholder="e.g. 3.5" value={newJobForm.duration || ""} onChange={e => setNewJobForm(f => ({ ...f, duration: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Notes (optional)</label>
            <GTxt placeholder="Service details, access instructions..." value={newJobForm.notes} onChange={e => setNewJobForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Crew (optional)</label>
            <div className="flex gap-2">
              <GSel className="flex-1" value={newJobForm.crewEmpId} onChange={e => setNewJobForm(f => ({ ...f, crewEmpId: e.target.value }))}>
                <option value="" className="bg-black">— No crew yet —</option>
                {employees.filter((e: any) => e.status !== "inactive").map((e: any) => <option key={e.id} value={e.id} className="bg-black">{e.firstName} {e.lastName}</option>)}
              </GSel>
              {newJobForm.crewEmpId && (
                <GSel className="!w-36 flex-shrink-0" value={newJobCrewMode} onChange={e => setNewJobCrewMode(e.target.value as any)}>
                  <option value="assign" className="bg-black">Assign</option>
                  <option value="request" className="bg-black">Request</option>
                </GSel>
              )}
            </div>
            {newJobForm.crewEmpId && (
              <div className="text-[11px] text-white/30 mt-1">
                {newJobCrewMode === "assign"
                  ? "Adds them to the crew immediately and emails them — no response needed."
                  : "Sends a request they must accept or decline before they're on the crew."}
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <GBtn variant="ghost" onClick={() => setNewJobOpen(false)}>Cancel</GBtn>
            <GBtn onClick={async () => {
              if (!newJobForm.customerId) { toast("Select a customer", "error"); return; }
              if (!newJobForm.scheduledDate) { toast("Enter a date", "error"); return; }
              const assignedEmp = newJobForm.crewEmpId ? employees.find((e: any) => e.id === newJobForm.crewEmpId) : null;
              const directAssign = !!assignedEmp && newJobCrewMode === "assign";
              const job = {
                id: uid(), customerId: newJobForm.customerId,
                address: newJobForm.address || customers.find(c => c.id === newJobForm.customerId)?.address || "",
                amount: parseFloat(newJobForm.amount) || 0,
                status: "scheduled" as const,
                scheduledDate: newJobForm.scheduledDate,
                scheduledTime: newJobForm.scheduledTime,
                priority: newJobForm.priority as any,
                notes: newJobForm.notes,
                duration: newJobForm.duration ? Number(newJobForm.duration) : undefined,
                crew: directAssign ? [assignedEmp.id] : [], checklist: [], photos: [], commLog: [], chemicalsUsed: [], equipment: [], tags: [],
                loggedHours: 0, createdAt: today(),
                ...(directAssign ? { crewAssignedAt: { [assignedEmp.id]: Date.now() } } : {}),
              };
              setJobs(prev => [...prev, job]);
              // Close the modal immediately — none of the follow-up work below
              // (Google Calendar, crew email/request) should be able to block
              // the UI if a network call hangs.
              setNewJobOpen(false);
              setNewJobForm(f => ({ ...f, crewEmpId: "" }));
              toast("Job scheduled for " + newJobForm.scheduledDate);
              // A brand-new job previously only reached Supabase via the
              // 30s app-level auto-save batch — the employee's portal polls
              // Supabase directly every 3s, so a same-day crew assignment
              // looked like it "did nothing" for up to 30s. Insert it
              // immediately instead, and verify with a re-fetch so a failed
              // write surfaces as a visible error rather than silent data loss.
              (async () => {
                const { error } = await withTimeout<any>((supabase as any).from("jobs").insert(job), 8000, "Save job");
                if (error) {
                  console.error("New job failed to save to Supabase:", error);
                  toast?.("Job created locally, but failed to save to the server — " + error.message, "red");
                  return;
                }
                const verify = await (supabase as any).from("jobs").select("id, crew").eq("id", job.id).maybeSingle();
                console.log("VERIFY NEW JOB SAVED:", verify?.data);
                if (!verify?.data) {
                  toast?.("Job save could not be verified — refresh and check", "red");
                }
              })();
              // Create Google Calendar event if Google is connected
              if (settings?.googleConnected && (settings as any)?.googleToken && job.scheduledDate) {
                const c = customers.find(x => x.id === job.customerId);
                const startDt = new Date(job.scheduledDate + "T" + (job.scheduledTime || "09:00") + ":00");
                const endDt = new Date(startDt.getTime() + 2 * 60 * 60 * 1000);
                createGCalEvent((settings as any).googleToken, {
                  title: (c ? c.firstName + " " + c.lastName + " — " : "") + "Pressure Washing",
                  start: startDt.toISOString(),
                  end: endDt.toISOString(),
                  location: job.address || "",
                  description: job.notes || "",
                }).then(eventId => {
                  setJobs(prev => prev.map(j => j.id === job.id ? { ...j, googleEventId: eventId } : j));
                }).catch(() => {});
              }
              // Notify the crew member — assigned (no response needed) or requested (accept/decline).
              if (assignedEmp?.email) {
                const cust = customers.find(c => c.id === job.customerId);
                const custLine = cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : "";
                if (directAssign) {
                  const portalLink = `${window.location.origin}${window.location.pathname}#/portal`;
                  const html = emailShell(settings.companyName || "Smock's Pressure Washing", "Job Assignment", `<p>Hi ${assignedEmp.firstName},</p><p>You've been assigned to a new job:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${custLine}</ul>` + emailButton("Open Crew Portal", portalLink));
                  withTimeout(sendEmail(settings, { to: assignedEmp.email, subject: `You've Been Assigned — ${job.scheduledDate}`, body: html }), 8000, "Email send").catch((e: any) => { console.warn("Assignment email failed — job still assigned:", e?.message); toast?.("Assigned, but the notification email failed to send", "red"); });
                } else {
                  (async () => {
                    try {
                      if (!ownerId) {
                        toast?.("Job saved, but the crew request failed — still finishing sign-in, try again in a moment", "red");
                        return;
                      }
                      const { data, error } = await withTimeout<any>(
                        (supabase as any).from("job_requests").insert({
                          job_id: job.id, employee_id: assignedEmp.id, owner_id: ownerId, status: "pending",
                        }).select("id").single(),
                        8000, "Save request"
                      );
                      if (error || !data?.id) {
                        console.error("Failed to create job_request:", error);
                        toast?.("Job saved, but the crew request failed — " + (error?.message || "run the job_requests SQL in Supabase first"), "red");
                        return;
                      }
                      const reqUrl = `${window.location.origin}${window.location.pathname}#/portal?request=${data.id}`;
                      const html = emailShell(settings.companyName || "Smock's Pressure Washing", "Job Request", `<p>Hi ${assignedEmp.firstName},</p><p>You have a new job request:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${custLine}</ul><div style="text-align:center;margin:22px 0 4px"><a href="${reqUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;margin-right:8px">✓ Accept Job</a><a href="${reqUrl}&action=deny" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px">✗ Decline</a></div>`);
                      withTimeout(sendEmail(settings, { to: assignedEmp.email, subject: `Job Request — ${job.scheduledDate}`, body: html }), 8000, "Email send").catch((e: any) => console.warn("Job request email failed — request still saved:", e?.message));
                    } catch (e: any) {
                      console.error("Crew request failed:", e);
                      toast?.("Job saved, but the crew request failed — " + (e?.message || "try again"), "red");
                    }
                  })();
                }
              }
            }}>Schedule Job</GBtn>
          </div>
        </div>
      </Modal>

      {/* Bulk action bar */}
      {bulkSelected.length > 0 && <Glass className="p-3 !bg-purple-950/30 !border-purple-600/40 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-purple-300">{bulkSelected.length} selected</span>
        <div className="flex gap-2 flex-wrap">
          {["scheduled", "in_progress", "completed", "cancelled"].map(s => <GBtn key={s} onClick={() => { setJobs(jobs.map(j => bulkSelected.includes(j.id) ? { ...j, status: s } : j)); setBulkSelected([]); toast("Updated " + bulkSelected.length + " jobs"); }} variant="ghost" className="!text-xs capitalize">{s.replace("_", " ")}</GBtn>)}
          <button onClick={async () => {
            let sent = 0, failed = 0;
            for (const jid of bulkSelected) {
              const j = jobs.find(x => x.id === jid);
              const c = customers.find(x => x.id === j?.customerId);
              if (!c?.phone) continue;
              const msg = "Hi " + c.firstName + ", reminder about your scheduled pressure wash on " + (j?.scheduledDate || "your upcoming date") + ". Questions? Call (717) 555-0100 — Smock's";
              try {
                if (settings?.twilioSid) { await twilioSend(settings, c.phone, msg); sent++; }
                else { window.location.href = "sms:" + c.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(msg); sent++; break; }
              } catch { failed++; }
            }
            setBulkSelected([]);
            toast("Reminders sent: " + sent + (failed > 0 ? " · " + failed + " failed" : ""));
          }} className="px-3 py-1.5 rounded-lg text-[11px] bg-blue-950/40 border border-blue-700/40 text-blue-300 hover:bg-blue-900/50"><Send size={11} className="inline mr-1" />Remind all</button>
          <button onClick={() => setBulkSelected([])} className="px-3 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white/60"><X size={11} className="inline mr-1" />Deselect</button>
        </div>
      </Glass>}

      {/* Weather risk alert — scheduled jobs in next 7 days with rain/wind/freeze */}
      {(() => {
        const atRisk = jobs
          .filter(j => j.status === "scheduled" && weatherRisk(j.scheduledDate))
          .map(j => ({ job: j, risk: weatherRisk(j.scheduledDate) }));
        if (atRisk.length === 0) return null;
        return <Glass className="p-4 !bg-gradient-to-br !from-blue-950/30 !to-black/60 !border-blue-600/40">
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={16} className="text-blue-400" />
            <h3 className="font-semibold text-sm text-blue-300">Weather Risk — {atRisk.length} job{atRisk.length > 1 ? "s" : ""}</h3>
          </div>
          <div className="space-y-1.5">
            {atRisk.slice(0, 4).map(({ job: rj, risk }) => {
              const c = customers.find(x => x.id === rj.customerId);
              return <div key={rj.id} className="flex items-center gap-3 p-2 bg-black/40 rounded-lg text-xs">
                <span className="text-lg">{risk.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c?.firstName} {c?.lastName} · {rj.scheduledDate}</div>
                  <div className="text-[10px] text-white/50 truncate">{risk.reason} forecast</div>
                </div>
                <button onClick={() => { updateJob(rj.id, { scheduledDate: "" }); toast("Moved to unscheduled — reschedule from Calendar"); }} className="px-2 py-1 rounded-lg text-[10px] bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 border border-blue-700/40 whitespace-nowrap">Reschedule</button>
                <button onClick={async () => {
                  if (!c?.phone) { toast("No phone number for " + c?.firstName, "error"); return; }
                  const msg = "Hi " + c.firstName + ", we have rain forecast for your service on " + rj.scheduledDate + ". Would you like to reschedule? What day works for you? — Smock's";
                  if (settings?.twilioSid) { try { await twilioSend(settings, c.phone, msg); toast("Weather reschedule text sent to " + c.firstName + " ✓"); } catch(e) { toast(e.message, "error"); } }
                  else { window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg); }
                }} className="px-2 py-1 rounded-lg text-[10px] bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 whitespace-nowrap">Text customer</button>
              </div>;
            })}
            {atRisk.length > 4 && <div className="text-[10px] text-white/40 text-center pt-1">+{atRisk.length - 4} more at risk</div>}
          </div>
        </Glass>;
      })()}

      {/* Page header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <div className="text-xs text-white/40 mt-0.5">{jobs.filter(j => j.status === "scheduled").length} scheduled · {jobs.filter(j => j.status === "in_progress").length} in progress</div>
        </div>
        <button
          onClick={() => { setNewJobForm({ customerId: "", address: "", amount: "", scheduledDate: today(), scheduledTime: "", priority: "normal", notes: "", duration: "", crewEmpId: "" }); setNewJobOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-800 border border-red-500/50 rounded-2xl text-sm font-semibold text-white shadow-lg shadow-red-900/30 hover:shadow-red-600/40 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus size={16} />Schedule Job
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {Object.entries(tabs).map(([k, l]) => {
          const cnt = jobs.filter(j => j.status === k).length;
          const a = tab === k;
          return <button key={k} onClick={() => setTab(k)} className={"px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border " + (a ? "bg-gradient-to-r from-red-600 to-red-800 text-white border-red-500/50" : "bg-black/40 text-white/60 hover:text-white border-red-900/30")}>{l} ({cnt})</button>;
        })}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <GBtn onClick={() => { setNewJobForm({ customerId: "", address: "", amount: "", scheduledDate: today(), scheduledTime: "", priority: "normal", notes: "", duration: "", crewEmpId: "" }); setNewJobOpen(true); }} className="!py-1.5 !text-xs flex-shrink-0"><Plus size={13} className="inline mr-1" />Schedule Job</GBtn>
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <GInput placeholder="Search customer, address, tag..." value={search} onChange={e => setSearch(e.target.value)} className="!pl-9 !py-1.5 !text-xs" />
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-[10px] text-white/40 uppercase tracking-wider mr-1">Priority:</span>
          {["all", ...priorityLevels.map(p => p.key)].map(p => <button key={p} onClick={() => setPrioFilter(p)} className={"px-2.5 py-1 rounded-lg text-[11px] transition border capitalize " + (prioFilter === p ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{p}</button>)}
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-[10px] text-white/40 uppercase tracking-wider mr-1">Sort:</span>
          {[["date", "Date"], ["priority", "Priority"], ["amount", "Amount"]].map(([k, l]) => <button key={k} onClick={() => setSortBy(k)} className={"px-2.5 py-1 rounded-lg text-[11px] transition border " + (sortBy === k ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{l}</button>)}
        </div>
        <GBtn onClick={() => setRouteOpen(true)} variant="ghost" className="!text-xs !py-1.5"><Navigation size={12} className="inline mr-1.5" />Route ({todayScheduled.length})</GBtn>
        <button onClick={() => { const all = filtered.map(j => j.id); setBulkSelected(bulkSelected.length === all.length ? [] : all); }} className="px-2.5 py-1.5 rounded-lg text-[11px] border border-red-900/30 bg-black/40 text-white/60 hover:text-white flex items-center gap-1">
          <CheckSquare size={11} />{bulkSelected.length === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(j => {
          const c = customers.find(x => x.id === j.customerId);
          const dn = (j.checklist || []).filter(x => x.done).length;
          const crewNames = (j.crew || []).map(id => employees.find(e => e.id === id)).filter(Boolean);
          const jobCost = (Number(j.laborCost) || 0) + (Number(j.materialCost) || 0) + ((j.chemicalsUsed || []).reduce((s, ch) => s + Number(ch.cost), 0));
          const jobMargin = j.amount > 0 && jobCost > 0 ? Math.round(((j.amount - jobCost) / j.amount) * 100) : null;
          const isBulkSel = bulkSelected.includes(j.id);
          return (
            <Glass key={j.id} className={"p-5 transition-all relative overflow-hidden " + (isBulkSel ? "!border-purple-500/60 !bg-purple-950/10" : j.noShow ? "border-red-500/60 bg-red-950/20" : "hover:border-red-600/50")} onTouchStart={e => handleTouchStart(j.id, e)} onTouchEnd={e => handleTouchEnd(j.id, e, j)}>
              {/* Priority stripe */}
              {j.priority && j.priority !== "normal" && <div className={"absolute top-0 left-0 w-1 h-full " + (priorityLevels.find(p => p.key === j.priority)?.color || "bg-gray-600")} />}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <input type="checkbox" checked={isBulkSel} onChange={() => setBulkSelected(prev => prev.includes(j.id) ? prev.filter(x => x !== j.id) : [...prev, j.id])} className="mt-1.5 w-3.5 h-3.5 rounded accent-purple-500 flex-shrink-0 cursor-pointer" />
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold">{c?.firstName} {c?.lastName}</div>
                    {j.priority && j.priority !== "normal" && <Badge tone={priorityLevels.find(p => p.key === j.priority)?.tone}>{j.priority}</Badge>}
                    {j.noShow && <Badge tone="red">No-show</Badge>}
                    {j.isRecurring && <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 bg-blue-900/20 border border-blue-800/30 px-2 py-0.5 rounded-full"><Repeat size={8} />{j.recurringFreq}</span>}
                    {j.cancelReason && j.status === "cancelled" && <span className="text-[9px] text-red-400 bg-red-950/40 border border-red-800/30 px-2 py-0.5 rounded-full">{j.cancelReason}</span>}
                    {(j.tags || []).map(t => <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">{t}</span>)}
                    {(() => { const wr = weatherRisk(j.scheduledDate); return wr && j.status === "scheduled" ? <span className={"inline-flex items-center gap-0.5 text-[9px] px-2 py-0.5 rounded-full border " + (wr.level === "high" ? "bg-red-950/40 border-red-700/50 text-red-300" : "bg-yellow-950/30 border-yellow-700/40 text-yellow-300")} title={"Weather risk: " + wr.reason}>{wr.icon}{wr.reason}</span> : null; })()}
                  </div>
                  <div className="text-xs text-white/50 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} />
                    <span className="truncate">{j.address}</span>
                    <button onClick={() => {
                      const addr = encodeURIComponent(j.address || "");
                      // Use Apple Maps on iOS, Google Maps elsewhere
                      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                      const url = isIOS ? "maps://maps.apple.com/?daddr=" + addr : "https://maps.google.com/?daddr=" + addr;
                      window.open(url, "_blank");
                    }} className="text-red-400 ml-1" title="Get directions"><MapPin size={10} /></button>
                  </div>
                  {j.duration && <div className="text-xs text-white/50 mt-0.5 flex items-center gap-1"><Clock size={10} />{j.duration}h est.{j.loggedHours > 0 ? " · " + j.loggedHours + "h logged" : ""}{j.clockInAt ? " · ⏱ running" : ""}</div>}
                  {(j.attachments || []).length > 0 && <div className="text-xs text-white/50 mt-0.5 flex items-center gap-1"><FileText size={10} />{j.attachments.length} attachment{j.attachments.length > 1 ? "s" : ""}</div>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-red-400">{fmt(j.amount)}</div>
                  {j.scheduledDate ? <div className="text-xs text-white/50">{j.scheduledDate}</div> : <div className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-600/50 text-amber-300 font-medium inline-block mt-0.5">Needs Scheduling</div>}
                  {j.isCash && <div className="text-[10px] text-green-400 font-semibold mt-0.5">💵 Cash</div>}
                  {jobMargin !== null && <div className={"text-[10px] font-semibold mt-0.5 " + (jobMargin >= 60 ? "text-green-400" : jobMargin >= 40 ? "text-yellow-400" : "text-red-400")}>{jobMargin}% margin</div>}
                </div>
              </div>

              <div className="mb-1 flex items-center gap-2 flex-wrap text-xs">
                <span className="text-white/40 uppercase tracking-wider text-[10px]">Crew:</span>
                {crewNames.length > 0 ? crewNames.map(e => (
                  <span key={e.id} className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-red-900/30 border border-red-800/40 text-red-300">
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-red-800 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">{e.firstName[0]}{e.lastName?.[0] || ""}</span>
                    {e.firstName}
                  </span>
                )) : (
                  <button onClick={() => { setQuickReqJobId(j.id); setQuickReqEmpId(""); setQuickReqMsg(""); }}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-yellow-950/30 border border-yellow-700/40 text-yellow-400 hover:bg-yellow-900/40 transition">
                    <Send size={8} />Request Crew
                  </button>
                )}
                {j.paymentStatus && (
                  <span className={"ml-auto inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border font-semibold " + (j.paymentStatus === "Paid" ? "bg-green-950/40 border-green-700/50 text-green-300" : j.paymentStatus === "Partial" ? "bg-yellow-950/40 border-yellow-700/50 text-yellow-300" : "bg-white/5 border-white/10 text-white/50")}>
                    {j.paymentStatus === "Paid" ? "✓" : j.paymentStatus === "Partial" ? "½" : "○"} {j.paymentStatus}{j.paymentType ? " · " + j.paymentType : ""}
                  </span>
                )}
              </div>
              {/* Quick crew request form */}
              {quickReqJobId === j.id && (
                <div className="mb-3 p-3 rounded-xl bg-yellow-950/20 border border-yellow-700/30 space-y-2">
                  <div className="text-[10px] text-yellow-300 font-semibold">Request an Employee</div>
                  <select value={quickReqEmpId} onChange={e => setQuickReqEmpId(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500/50">
                    <option value="">Select employee…</option>
                    {employees.filter((e: any) => e.status === "active").map((e: any) => {
                      const av: string[] = (e as any).availability || [];
                      const unavail = j.scheduledDate && av.includes(j.scheduledDate);
                      return <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{unavail ? " ⚠ unavailable" : ""}</option>;
                    })}
                  </select>
                  {quickReqEmpId && (() => {
                    const emp = employees.find((e: any) => e.id === quickReqEmpId);
                    const av: string[] = (emp as any)?.availability || [];
                    return av.includes(j.scheduledDate) ? (
                      <div className="text-[10px] text-orange-300 bg-orange-950/30 border border-orange-700/30 rounded px-2 py-1">
                        ⚠ {(emp as any)?.firstName} marked {j.scheduledDate} as unavailable
                      </div>
                    ) : null;
                  })()}
                  <textarea value={quickReqMsg} onChange={e => setQuickReqMsg(e.target.value)}
                    placeholder="Optional message…" rows={2}
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => sendQuickJobRequest(j)} disabled={!quickReqEmpId || quickReqSending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-black text-xs font-bold transition">
                      <Send size={10} />{quickReqSending ? "Sending…" : "Send Request"}
                    </button>
                    <button onClick={() => setQuickReqJobId(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-3"><div className="flex items-center justify-between text-xs text-white/60 mb-1.5"><span>Checklist</span><span>{dn}/{(j.checklist || []).length}</span></div><div className="space-y-1.5 max-h-32 overflow-y-auto">{(j.checklist || []).map((ck, idx) => <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={ck.done} onChange={() => toggleCk(j.id, idx)} className="w-4 h-4 rounded accent-red-600" /><span className={ck.done ? "line-through text-white/40" : "text-white/80"}>{ck.label}</span></label>)}</div></div>

              <div className="md:hidden text-[10px] text-white/30 text-center mb-2 border border-dashed border-red-900/20 rounded py-1">← swipe left to advance</div>

              <div className="flex gap-2 pt-2 border-t border-red-900/30 flex-wrap">
                <button onClick={() => setDetailId(j.id)} className="px-2.5 py-1.5 rounded-lg border bg-white/5 border-white/10 text-white/60 hover:text-white text-xs transition"><Edit size={12} /></button>
                {/* On My Way button — shows for scheduled/in_progress */}
                {(tab === "scheduled" || tab === "in_progress") && (() => {
                  const c = customers.find(x => x.id === j.customerId);
                  if (!c?.phone && !c?.email) return null;
                  return <button onClick={() => {
                    if (j.scheduledDate && j.scheduledDate !== today()) {
                      const ok = window.confirm(`This job is scheduled for ${j.scheduledDate}, not today. Send the "on my way" message anyway?`);
                      if (!ok) return;
                    }
                    const eta = new Date(Date.now() + 17 * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                    // Get live GPS location then include in message
                    const sendOTW = async (lat: number | null, lng: number | null) => {
                      const locationLink = lat != null ? "https://maps.google.com/?q=" + lat + "," + lng : null;
                      const omwMsg = `Hi ${c.firstName}! Your technician is on the way! ETA: ${eta}. 🚗` + (locationLink ? " Track me: " + locationLink : "") + " — Will @ Smock's";
                      if (settings?.twilioSid && c.phone) {
                        try { await twilioSend(settings, c.phone, omwMsg); toast("OTW text sent to " + c.firstName + " ✓"); }
                        catch (e: any) { toast(e?.message || "Failed to send OTW text", "red"); }
                      } else if (c.email) {
                        const html = emailShell(settings.companyName || "Smock's Pressure Washing", "On My Way", `<p>${omwMsg}</p>`);
                        try {
                          await sendEmail(settings, { to: c.email, subject: "Your technician is on the way", body: html });
                          toast("OTW email sent to " + c.firstName + " ✓");
                        } catch (e: any) {
                          const msg = e?.message || "";
                          if (/401|expired|reconnect/i.test(msg)) {
                            toast("Cannot send email — Google token expired. Reconnect Google in Settings → Integrations.", "red");
                          } else {
                            toast(msg || "Failed to send OTW email", "red");
                          }
                        }
                      } else if (c.phone) {
                        window.location.href = "sms:" + c.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(omwMsg);
                      } else {
                        toast("No phone or email on file for " + c.firstName, "yellow");
                      }
                    };
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        pos => sendOTW(Number(pos.coords.latitude.toFixed(5)), Number(pos.coords.longitude.toFixed(5))),
                        () => sendOTW(null, null),
                        { timeout: 5000 }
                      );
                    } else { sendOTW(null, null); }
                  }} className="px-2.5 py-1.5 rounded-lg border bg-blue-950/30 border-blue-700/40 text-blue-300 hover:bg-blue-900/40 text-xs transition flex items-center gap-1" title="Notify customer: On My Way">
                    <Navigation size={10} />OTW
                  </button>;
                })()}
                {(tab === "scheduled" || tab === "in_progress") && (j.clockInAt
                  ? <button onClick={() => clockOut(j)} className="px-2.5 py-1.5 rounded-lg border bg-green-900/30 border-green-600/40 text-green-300 hover:bg-green-900/50 text-xs transition flex items-center gap-1 animate-pulse"><Clock size={12} />{((Date.now() - j.clockInAt) / 3600000).toFixed(2)}h</button>
                  : <button onClick={() => clockIn(j.id)} className="px-2.5 py-1.5 rounded-lg border bg-white/5 border-white/10 text-white/60 hover:text-green-400 text-xs transition" title="Clock in"><Play size={12} /></button>
                )}
                {tab === "scheduled" && <><GBtn onClick={() => move(j.id, "in_progress")} className="flex-1 text-xs !py-1.5">Start</GBtn>
                  <button onClick={() => {
                    setJobs(jobs.map(x => x.id === j.id ? { ...x, status: "cancelled", noShow: true, cancelReason: "Customer no-show" } : x));
                    toast("Marked as no-show");
                    // Text Will about the no-show
                    if (settings?.twilioSid && settings?.myPhone) {
                      const c2 = customers.find(x => x.id === j.customerId);
                      twilioSend(settings, settings.myPhone, "⚠️ NO-SHOW: " + (c2 ? c2.firstName + " " + c2.lastName : "Customer") + " at " + j.address?.split(",")[0] + " on " + j.scheduledDate).catch(() => {});
                    }
                  }} className="px-2.5 py-1.5 rounded-lg border bg-orange-950/20 border-orange-700/40 text-orange-400 hover:bg-orange-900/30 text-xs" title="Mark as no-show">👻</button>
                  <button onClick={() => setCancelModal(j.id)} className="px-2.5 py-1.5 rounded-lg border bg-white/5 border-white/10 text-white/60 hover:text-red-400 text-xs"><Ban size={12} /></button></>}
                {tab === "in_progress" && (() => { return <><GBtn onClick={() => {
                  if (j.clockInAt) clockOut(j);
                  move(j.id, "completed");
                  if (j.isRecurring && j.recurringFreq) {
                    const daysMap = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 91, annually: 365 };
                    const days = daysMap[j.recurringFreq] || 30;
                    const nextDate = (() => { const d = new Date(j.scheduledDate); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); })();
                    const nextJob = { ...j, id: uid(), status: "scheduled", scheduledDate: nextDate, loggedHours: 0, clockInAt: null, checklist: (j.checklist || []).map(ck => ({ ...ck, done: false })), commLog: [], photos: [], chemicalsUsed: [] };
                    setJobs(prev => [...prev.map(x => x.id === j.id ? { ...x, status: "completed" } : x), nextJob]);
                    toast("Next " + j.recurringFreq + " job auto-scheduled for " + nextDate);
                  }
                }} className="flex-1 text-xs !py-1.5">Complete</GBtn>
                <button onClick={() => setJobs(jobs.map(x => x.id === j.id ? { ...x, isCash: !x.isCash } : x))} title={j.isCash ? "Mark as card/check" : "Mark as cash payment"} className={"px-2.5 py-1.5 rounded-lg border text-xs transition " + (j.isCash ? "bg-green-900/40 border-green-700/50 text-green-300" : "bg-black/40 border-white/10 text-white/50 hover:text-green-400")}>💵</button>
                </>; })()}                {tab === "completed" && <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12} /> Done{j.loggedHours ? " · " + j.loggedHours + "h" : ""}</div>
                  <button onClick={() => setJobs(jobs.map(x => x.id === j.id ? { ...x, isCash: !x.isCash } : x))} title={j.isCash ? "Switch to card" : "Mark as cash"} className={"px-2 py-1 rounded-lg border text-[10px] transition " + (j.isCash ? "bg-green-900/40 border-green-700/50 text-green-300" : "bg-black/40 border-white/10 text-white/30 hover:text-green-400")}>💵{j.isCash ? " Cash" : ""}</button>
                  {/* Profit breakdown button */}
                  <button onClick={() => setJobs(jobs.map(x => x.id === j.id ? { ...x, _showProfit: !x._showProfit } : x))} className="ml-auto text-[10px] px-2 py-1 bg-black/40 border border-white/10 text-white/40 hover:text-white rounded-lg transition">
                    {j._showProfit ? "▲ Hide" : "📊 Profit"}
                  </button>
                  {(() => {
                    const linked = estimates.filter(e => e.customerId === j.customerId && e.status === "approved" && !e.invoiced);
                    if (linked.length > 0) return <button onClick={() => { setEstimates(prev => prev.map(e => linked.some(l => l.id === e.id) ? { ...e, invoiced: true, invoicedAt: today() } : e)); toast("Invoice sent to " + (customers.find(c => c.id === j.customerId)?.firstName || "customer")); }} className="text-[10px] px-2.5 py-1 bg-green-950/40 border border-green-700/40 text-green-300 rounded-lg hover:bg-green-900/50 flex items-center gap-1"><Receipt size={9} />Invoice</button>;
                    return null;
                  })()}
                </div>}
                {/* Profit breakdown panel */}
                {tab === "completed" && j._showProfit && (() => {
                  const chemCost = (j.chemicalsUsed || []).reduce((s, ch) => s + Number(ch.cost || 0), 0);
                  const laborCost = Number(j.laborCost || 0);
                  const materialCost = Number(j.materialCost || 0);
                  const totalCost = chemCost + laborCost + materialCost;
                  const profit = j.amount - totalCost;
                  const margin = j.amount > 0 ? Math.round((profit / j.amount) * 100) : 0;
                  return <div className="mt-3 p-3 bg-black/60 border border-green-900/30 rounded-xl text-xs space-y-2">
                    <div className="font-semibold text-white/70 mb-2">📊 Job Profit Breakdown</div>
                    <div className="flex justify-between"><span className="text-white/60">Revenue</span><span className="font-bold text-green-400">{fmt(j.amount)}</span></div>
                    <div className="border-t border-white/10 pt-2 space-y-1">
                      <div className="flex justify-between"><span className="text-white/50">Chemicals</span><span className="text-red-400">-{fmt(chemCost)}</span></div>
                      <div className="flex justify-between"><span className="text-white/50">Labor</span><span className="text-red-400">-{fmt(laborCost)}</span></div>
                      <div className="flex justify-between"><span className="text-white/50">Materials</span><span className="text-red-400">-{fmt(materialCost)}</span></div>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                      <span>Net Profit</span>
                      <span className={profit >= 0 ? "text-green-400" : "text-red-400"}>{fmt(profit)}</span>
                    </div>
                    <div className={"text-[10px] text-center py-1 rounded-lg " + (margin >= 60 ? "bg-green-950/40 text-green-400" : margin >= 40 ? "bg-yellow-950/40 text-yellow-400" : "bg-red-950/40 text-red-400")}>
                      {margin}% margin · {margin >= 60 ? "🔥 Strong" : margin >= 40 ? "👍 Good" : "⚠️ Low — check costs"}
                      {j.isCash && <span className="ml-2 text-green-400">· 💵 Cash (track separately for taxes)</span>}
                    </div>
                    {totalCost === 0 && <div className="text-[10px] text-white/30 text-center">Add labor/chemical costs in job detail for full breakdown</div>}
                  </div>;
                })()}
                {tab === "cancelled" && <button onClick={async () => {
                  const c = customers.find(x => x.id === j.customerId);
                  const newDate = prompt("New date (YYYY-MM-DD):", daysFromNow(7));
                  if (!newDate) return;
                  move(j.id, "scheduled");
                  setJobs(prev => prev.map(x => x.id === j.id ? { ...x, scheduledDate: newDate, status: "scheduled", cancelReason: "" } : x));
                  if (c?.phone) {
                    const msg = "Hi " + c.firstName + ", we've rescheduled your service to " + newDate + ". Reply to confirm or request a different date. — Smock's";
                    if (settings?.twilioSid) {
                      try { await twilioSend(settings, c.phone, msg); toast("Rescheduled + customer texted ✓"); } catch { toast("Rescheduled — text failed"); }
                    } else {
                      window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg);
                    }
                  } else toast("Rescheduled to " + newDate);
                }} className="flex-1 text-xs text-blue-400 flex items-center justify-center gap-1 py-1.5 border border-blue-700/30 rounded-lg hover:bg-blue-950/30 transition"><RefreshCw size={10} />Reschedule + Text</button>}
                <button onClick={() => setDeleteModal(j.id)} className="flex-1 text-xs text-red-400 flex items-center justify-center gap-1 py-1.5 border border-red-700/30 rounded-lg hover:bg-red-950/30 transition"><Trash2 size={10} />Delete Job</button>
              </div>
            </Glass>
          );
        })}
        {filtered.length === 0 && <div className="md:col-span-2 text-center py-12 text-white/40">No {tabs[tab].toLowerCase()} jobs</div>}
      </div>

      <JobDetailModal jobId={detailId} job={jobs.find(j => j.id === detailId)} onClose={() => setDetailId(null)} customers={customers} employees={employees} updateJob={updateJob} toast={toast} settings={settings} estimates={estimates} setEstimates={setEstimates} onPortal={onPortal} ownerId={ownerId} />

      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)} title="Cancel Job">
        <div className="space-y-3">
          <GSel value={cancelReason} onChange={e => setCancelReason(e.target.value)}>{cancelReasons.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}</GSel>
          <div className="flex gap-2 justify-end"><GBtn variant="ghost" onClick={() => setCancelModal(null)}>Back</GBtn><GBtn variant="danger" onClick={confirmCancel}>Cancel Job</GBtn></div>
        </div>
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Job">
        <div className="space-y-4">
          <div className="text-sm text-white/80">Permanently delete this job? This cannot be undone.</div>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setDeleteModal(null)}>Cancel</GBtn>
            <GBtn variant="danger" onClick={confirmDelete}><Trash2 size={12} className="inline mr-1.5" />Delete Permanently</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}


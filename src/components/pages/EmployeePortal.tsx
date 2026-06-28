import React, { useState, useEffect, useRef } from "react";
import {
  Clock, Briefcase, Calendar, ChevronLeft, CheckSquare, Camera,
  LogOut, MapPin, Phone, User, Play, Square, Plus, X, Eye, DollarSign,
  ChevronRight, Home, List, CheckCircle, AlertCircle, Image, FileText,
  Video, PenLine, Shield, Navigation, Database, Route, ToggleRight, ToggleLeft, Download, Bell
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getEmpGoogleToken, isEmpGoogleTokenValid, saveEmpGoogleToken, refreshEmpGoogleToken, getValidEmpGoogleToken, createGCalEvent, updateGCalEvent } from "../../lib/googleApi";
import { sendViaGmail, sendEmail, emailShell, emailButton, twilioSend } from "../../lib/messaging";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GTxt } from "../ui/GTxt";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { loadMapsScript, AddressAutocomplete } from "../ui/AddressAutocomplete";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { fmt, uid, today, daysFromNow, computeJobRatingScore } from "../../lib/utils";
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

// Payment status label shown on completed jobs — owner and employee views
// both use this so "Paid (Cash)" / "Unpaid — Invoice Sent" / "Unpaid" read
// the same everywhere.
export function paymentStatusLabel(job: Job): string {
  if (job.paymentStatus === "Paid") return `Paid (${job.paymentType || "Cash"})`;
  if (job.paymentType === "Invoice" || job.invoiceSentAt) return "Unpaid — Invoice Sent";
  if (job.paymentStatus === "Pending") return "Unpaid";
  return "Unpaid";
}

// Small Street View thumbnail for a job address; tap to expand full-size.
// Renders nothing when no key is set at all (unremarkable — not yet
// configured). If a key IS set but the image still fails, that almost
// always means Street View Static API specifically isn't enabled on it
// (it's billed/enabled separately from Maps JS/Places) — show the exact
// Cloud Console URL to fix it instead of hiding the problem.
const STREET_VIEW_API_ENABLE_URL = "https://console.cloud.google.com/apis/library/street-view-image-backend.googleapis.com";
function StreetViewThumb({ address, apiKey }: { address: string; apiKey?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  if (!address || !apiKey) return null;
  if (loadError) {
    return (
      <div className="w-full rounded-xl border border-yellow-700/40 bg-yellow-950/15 p-3 text-xs text-yellow-200">
        <div className="font-semibold mb-1">Street View image didn't load</div>
        <div className="text-yellow-200/80 mb-2">Ask the owner to enable the <b>Street View Static API</b> for this key — it's billed and enabled separately from Maps JS/Places.</div>
        <a href={STREET_VIEW_API_ENABLE_URL} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline break-all">{STREET_VIEW_API_ENABLE_URL}</a>
      </div>
    );
  }
  const thumbUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodeURIComponent(address)}&key=${apiKey}`;
  const bigUrl = `https://maps.googleapis.com/maps/api/streetview?size=1200x600&location=${encodeURIComponent(address)}&key=${apiKey}`;
  return (
    <>
      <button onClick={() => setExpanded(true)} className="w-full rounded-xl overflow-hidden border border-white/10 relative group">
        <img src={thumbUrl} alt="Street View" className="w-full h-32 object-cover" onError={() => { console.warn("Street View image failed to load for", address, "— enable the Street View Static API:", STREET_VIEW_API_ENABLE_URL); setLoadError(true); }} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold transition">Tap to expand</span>
        </div>
      </button>
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setExpanded(false)}>
          <img src={bigUrl} alt="Street View" className="max-w-full max-h-full rounded-xl" />
          <button onClick={() => setExpanded(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

// Formats a job's estimated duration (decimal hours) as "Est. 3 hours" /
// "Est. 1 hour" / "Est. 2h 30m" for fractional values.
const formatEstDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `Est. ${h} hour${h === 1 ? "" : "s"}`;
  if (h === 0) return `Est. ${m} min`;
  return `Est. ${h}h ${m}m`;
};

// Races a promise against a hard timeout so a hung await (no error, no resolve —
// e.g. internal Supabase/Google auth-lock contention) can never block a button's
// loading state forever; a normal rejection is still caught by the caller as usual.
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label + " timed out")), ms)),
  ]);

// Normalizes a single crew entry to a comparable id string. Crew is meant to be a
// plain array of employee-id strings, but Supabase JSONB round-trips and older
// write paths have been known to store objects ({ id }, { employeeId }) instead —
// a bare `c === empId` string comparison silently fails (no error, just an empty
// result) against those, which looks exactly like "the job isn't assigned" even
// though the data is there. Also tolerates a stringified-JSON crew column.
const crewEntryId = (c: any): string => {
  if (c == null) return "";
  if (typeof c === "string") return c.trim().toLowerCase();
  if (typeof c === "object") {
    const v = c.id ?? c.employeeId ?? c.employee_id ?? c.user_id ?? c.userId ?? "";
    return String(v).trim().toLowerCase();
  }
  return String(c).trim().toLowerCase();
};

const normalizeCrewArray = (crew: any): any[] => {
  if (Array.isArray(crew)) return crew;
  if (typeof crew === "string" && crew.trim().startsWith("[")) {
    try { const parsed = JSON.parse(crew); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
};

export const crewIncludesEmployee = (crew: any, empId?: string | null, empUserId?: string | null): boolean => {
  const list = normalizeCrewArray(crew).map(crewEntryId);
  const targets = [empId, empUserId].filter(Boolean).map(v => String(v).trim().toLowerCase());
  if (targets.length === 0) return false;
  return list.some(c => c && targets.includes(c));
};

export const PERMISSION_DEFS = [
  { key: "can_view_jobs",          label: "View assigned jobs",        desc: "See their job schedule" },
  { key: "can_clock_in",           label: "Clock in / out",            desc: "Track time on jobs" },
  { key: "can_upload_photos",      label: "Upload photos",             desc: "Take before/after photos" },
  { key: "can_complete_checklist", label: "Complete checklist",        desc: "Check off job items" },
  { key: "can_get_signoff",        label: "Get customer sign-off",     desc: "Collect customer signature" },
  { key: "can_view_pay",           label: "View pay info",             desc: "See pay rate and history" },
  { key: "can_view_calendar",      label: "View calendar",             desc: "See weekly/monthly schedule" },
  { key: "can_add_notes",          label: "Add job notes",             desc: "Leave notes on jobs" },
] as const;

export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  can_view_jobs: true, can_clock_in: true, can_upload_photos: true,
  can_complete_checklist: true, can_get_signoff: true,
  can_view_pay: true, can_view_calendar: true, can_add_notes: true,
};

function PortalChecklistSection({ title, emoji, items, onUpdate, allowPhotos = false, disabled = false }: {
  title: string; emoji: string;
  items: JobChecklistItem[];
  onUpdate: (items: JobChecklistItem[]) => void;
  allowPhotos?: boolean;
  disabled?: boolean;
}) {
  const done = items.filter(i => i.done).length;
  const toggle = (id: string) => { if (!disabled) onUpdate(items.map(it => it.id === id ? { ...it, done: !it.done } : it)); };
  const updateNotes = (id: string, notes: string) => onUpdate(items.map(it => it.id === id ? { ...it, notes } : it));
  const addItemPhoto = (id: string, dataUrl: string, isVideo: boolean) => {
    const media = { id: uid(), dataUrl };
    onUpdate(items.map(it => it.id === id
      ? isVideo ? { ...it, videos: [...(it.videos || []), media] } : { ...it, photos: [...(it.photos || []), media] }
      : it));
  };
  const deleteItemMedia = (id: string, mediaId: string, isVideo: boolean) => {
    onUpdate(items.map(it => it.id === id
      ? isVideo ? { ...it, videos: (it.videos || []).filter(v => v.id !== mediaId) } : { ...it, photos: (it.photos || []).filter(p => p.id !== mediaId) }
      : it));
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">{emoji} {title}</div>
        <div className={"text-xs font-bold " + (done === items.length ? "text-green-400" : "text-white/40")}>
          {done}/{items.length}
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-start gap-2">
              <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)}
                disabled={disabled}
                className={"mt-0.5 w-4 h-4 flex-shrink-0 " + (disabled ? "opacity-50 cursor-not-allowed" : "accent-green-500 cursor-pointer")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={"text-sm flex-1 " + (item.done ? "line-through text-white/30" : "text-white/80")}>
                    {item.label}
                  </div>
                  {allowPhotos && (
                    <label className="cursor-pointer flex-shrink-0">
                      {/* capture="environment" opens the device camera directly on mobile
                          (native camera app) and a file picker with a camera option on
                          desktop; accepting both photo and video mime types lets one
                          button cover both, and the file is auto-uploaded on selection —
                          there's no separate "upload" step. */}
                      <input type="file" accept="image/*,video/*" capture="environment" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const isVideo = f.type.startsWith("video/");
                          const r = new FileReader();
                          r.onload = ev => addItemPhoto(item.id, ev.target!.result as string, isVideo);
                          r.readAsDataURL(f); e.target.value = "";
                        }} />
                      <div className="p-1 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 text-blue-400/80 hover:text-blue-300 transition">
                        <Camera size={12} />
                      </div>
                    </label>
                  )}
                </div>
                {/* Per-item photo/video thumbnails */}
                {((item.photos || []).length > 0 || (item.videos || []).length > 0) && (
                  <div className="mt-1.5 flex gap-1.5 flex-wrap">
                    {(item.photos || []).map((p, pi) => (
                      <div key={p.id || pi} className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 relative">
                        <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                        {!disabled && (
                          <button onClick={() => deleteItemMedia(item.id, p.id, false)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-red-700 text-white flex items-center justify-center">
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    ))}
                    {(item.videos || []).map((v, vi) => (
                      <div key={v.id || vi} className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 relative bg-black">
                        <video src={v.dataUrl} className="w-full h-full object-cover" />
                        <Video size={14} className="absolute inset-0 m-auto text-white/80" />
                        {!disabled && (
                          <button onClick={() => deleteItemMedia(item.id, v.id, true)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-red-700 text-white flex items-center justify-center">
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={item.notes || ""}
                  onChange={e => updateNotes(item.id, e.target.value)}
                  placeholder="Add note..."
                  className="mt-1 w-full bg-transparent border-0 border-b border-white/10 text-xs text-white/50 placeholder-white/20 focus:outline-none focus:border-white/30 py-0.5"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_SIGNOFF_DISCLAIMER = "I confirm that all services have been completed to my satisfaction. I accept the work as described and acknowledge that {{company}} is not liable for pre-existing conditions documented in the pre-job checklist. I understand that this serves as a legally binding acceptance of completed work.";

function JobDetailView({ job, customer, onBack, onUpdateJob, toast, companyName = "the company", onComplete, perms: permsOverride, maxLunchMinutes = 30, onJobCompleted, googleMapsKey = "", paidLunchBreaks = false, signOffDisclaimer = "", settings = {} as AppSettings, setEstimates = (() => {}) as any, nextJob = null, nextJobCustomer = null }: {
  job: Job; customer?: Customer; onBack: () => void;
  onUpdateJob: (patch: Partial<Job>) => void; toast: (msg: string, tone?: any) => void;
  companyName?: string; onComplete?: () => void; perms?: Record<string, boolean>; maxLunchMinutes?: number;
  onJobCompleted?: (job: Job) => void; googleMapsKey?: string; paidLunchBreaks?: boolean; signOffDisclaimer?: string;
  settings?: AppSettings; setEstimates?: any; nextJob?: Job | null; nextJobCustomer?: Customer | null;
}) {
  const effPerms = { ...DEFAULT_PERMISSIONS, ...(permsOverride || {}) };
  const [note, setNote] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delayNoteOpen, setDelayNoteOpen] = useState(false);
  const [, forceTick] = useState(0);
  const [showSignOff, setShowSignOff] = useState(false);
  const [signerName, setSignerName] = useState("");
  // "Complete Job" flow: review (checklist/sign-off status) → payment → summary
  const [completeStep, setCompleteStep] = useState<"" | "review" | "payment" | "method" | "invoice" | "summary">("");
  const [paidChoice, setPaidChoice] = useState<"yes" | "no" | "">("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [sendingCompleteInvoice, setSendingCompleteInvoice] = useState(false);
  const [completeSummary, setCompleteSummary] = useState<{ hours: number; amount: number; paymentStatus: string } | null>(null);

  useEffect(() => {
    if (!job.clockInAt) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [job.clockInAt]);

  const secsToHms = (total: number) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
  };

  // Work timer excludes lunch: frozen at the moment lunch starts, and the
  // accumulated lunch time is subtracted once lunch ends.
  const liveDisplay = (() => {
    if (!job.clockInAt) return null;
    const lunchMs = paidLunchBreaks ? 0 : (job.lunchMinutes || 0) * 60000;
    const endpoint = job.lunchStartAt || Date.now();
    const total = Math.max(0, Math.floor((endpoint - job.clockInAt - lunchMs) / 1000));
    return secsToHms(total);
  })();

  const lunchDisplay = job.lunchStartAt ? secsToHms(Math.max(0, Math.floor((Date.now() - job.lunchStartAt) / 1000))) : null;
  const isOverSchedule = !!(job.clockInAt && job.duration && (Date.now() - job.clockInAt) / 3600000 > Number(job.duration));

  const hasRequiredGear = (job.equipment || []).length > 0 || (job.requiredChemicals || []).length > 0;
  const clockIn = () => {
    onUpdateJob({ clockInAt: Date.now(), lunchStartAt: null });
    if (hasRequiredGear && !job.equipmentChecked) {
      toast("⚠️ Clocked in without confirming required equipment/chemicals", "yellow");
    } else {
      toast("Clocked in ✓");
    }
  };
  const clockOut = () => {
    if (!job.clockInAt) return;
    const lunchMs = paidLunchBreaks ? 0 : (job.lunchMinutes || 0) * 60000;
    const hrs = Math.round((Date.now() - job.clockInAt - lunchMs) / 36000) / 100;
    onUpdateJob({ clockInAt: null, lunchStartAt: null, loggedHours: Math.round(((Number(job.loggedHours) || 0) + hrs) * 100) / 100 });
    toast(`+${hrs}h logged`);
  };

  const takeLunch = () => { onUpdateJob({ lunchStartAt: Date.now() }); toast("Lunch started 🍽️"); };
  const endLunch = () => {
    if (!job.lunchStartAt) return;
    const lunchMinsThisBreak = Math.round((Date.now() - job.lunchStartAt) / 60000);
    const exceeded = lunchMinsThisBreak > maxLunchMinutes;
    onUpdateJob({
      lunchStartAt: null,
      lunchMinutes: (job.lunchMinutes || 0) + lunchMinsThisBreak,
      ...(exceeded ? { lunchExceeded: true } : {}),
    });
    toast(exceeded ? `Lunch ended — ${lunchMinsThisBreak}m (exceeded ${maxLunchMinutes}m limit)` : `Lunch ended — ${lunchMinsThisBreak}m`, exceeded ? "yellow" : "green");
  };

  const addPhoto = (type: "before" | "after", dataUrl: string) => {
    const newPhoto = { id: uid(), type, caption: (type === "before" ? "Before" : "After") + " — " + today(), dataUrl, uploadedAt: today() };
    onUpdateJob({ photos: [...(job.photos || []), newPhoto] });
    toast(type === "before" ? "Before photo added" : "After photo added");
  };

  const addVideo = (file: File) => {
    const MAX_MB = 50;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast(`Video exceeds ${MAX_MB}MB limit — trim to under 30 seconds`, "red");
      return;
    }
    const r = new FileReader();
    r.onload = ev => {
      const dataUrl = ev.target!.result as string;
      // Check duration via a transient video element
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.onloadedmetadata = () => {
        URL.revokeObjectURL(vid.src);
        if (vid.duration > 30) {
          toast("Video exceeds 30 seconds — please trim it first", "red");
          return;
        }
        onUpdateJob({ videos: [...(job.videos || []), { id: uid(), dataUrl, caption: "Field video", addedAt: today() }] });
        toast("Video added ✓");
      };
      vid.src = URL.createObjectURL(file);
    };
    r.readAsDataURL(file);
  };

  const addNote = () => {
    if (!note.trim()) return;
    const entry = { id: uid(), type: "note" as const, date: today(), note: note.trim() };
    onUpdateJob({ commLog: [...(job.commLog || []), entry] });
    setNote("");
    toast("Note added");
  };

  // Saves the signature only — completion itself (and any payment info) is
  // handled by the separate "Complete Job" flow, so sign-off can happen
  // independently without forcing the job closed.
  const saveSignOff = () => {
    if (sigMode === "type") {
      if (!signerName.trim()) return;
    } else if (!sigDrawData) return;
    const signOff: any = {
      signerName: signerName.trim() || "Drawn signature",
      timestamp: new Date().toISOString(),
      sigType: sigMode,
      ...(sigMode === "draw" ? { sigData: sigDrawData } : {}),
    };
    onUpdateJob({ signOff });
    toast("Sign-off saved ✓", "green");
    setShowSignOff(false);
  };

  // Draw-mode signature canvas
  const [sigMode, setSigMode] = useState<"type" | "draw">("type");
  const [sigDrawData, setSigDrawData] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigDrawing = useRef(false);
  const sigLastPos = useRef({ x: 0, y: 0 });
  const sigGetPos = (canvas: HTMLCanvasElement, e: any) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };
  const sigStartDraw = (e: any) => {
    const canvas = sigCanvasRef.current; if (!canvas) return;
    sigDrawing.current = true;
    sigLastPos.current = sigGetPos(canvas, e);
  };
  const sigDraw = (e: any) => {
    if (!sigDrawing.current) return;
    e.preventDefault();
    const canvas = sigCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.strokeStyle = "#1e3a8a"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const pos = sigGetPos(canvas, e);
    ctx.beginPath(); ctx.moveTo(sigLastPos.current.x, sigLastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    sigLastPos.current = pos;
  };
  const sigStopDraw = () => {
    if (!sigDrawing.current) return;
    sigDrawing.current = false;
    const canvas = sigCanvasRef.current; if (canvas) setSigDrawData(canvas.toDataURL());
  };
  const sigClear = () => {
    const canvas = sigCanvasRef.current; if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSigDrawData(null);
  };
  const switchSigMode = (m: "type" | "draw") => {
    setSigMode(m); setSignerName(""); sigClear();
  };

  const beforePhoto = (job.photos || []).find(p => p.type === "before" && p.dataUrl);
  const afterPhoto = (job.photos || []).find(p => p.type === "after" && p.dataUrl);

  const preItems = job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS;
  const durItems = job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS;
  const postItems = job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS;
  const allItems = [...preItems, ...durItems, ...postItems];
  const allDone = allItems.length > 0 && allItems.every(i => i.done);

  // "Complete Job" flow — review status, collect payment info, finalize.
  const checklistRemaining = allItems.filter(i => !i.done).length;
  const startCompleteFlow = () => { setCompleteStep("review"); setPaidChoice(""); setPaymentMethod(""); };

  const sendInvoiceFromPortal = async () => {
    if (!customer?.email && !customer?.phone) {
      toast("No contact info for this customer. Add email or phone first.", "red");
      return false;
    }
    setSendingCompleteInvoice(true);
    try {
      const newInv = {
        id: uid(), customerId: job.customerId,
        lineItems: [{ id: uid(), description: job.notes || job.address || "Service", quantity: 1, unitPrice: Number(job.amount) || 0 }],
        subtotal: Number(job.amount) || 0, discount: 0, depositRequired: 0, tax: 0, total: Number(job.amount) || 0,
        status: "approved" as const, createdAt: today(), validUntil: daysFromNow(30), invoiced: true, invoicedAt: today(),
      };
      setEstimates((prev: any[]) => [...prev, newInv]);
      const payLink = `${window.location.origin}${window.location.pathname}#/portal/${newInv.id}`;
      if (customer.email) {
        const html = emailShell(companyName, "Invoice", `<p>Hi ${customer.firstName},</p><p>Thanks for choosing us! Your service at <b>${job.address}</b> is complete.</p><p><b>Amount due:</b> $${(Number(job.amount) || 0).toFixed(2)}</p>` + emailButton("View & Pay Invoice", payLink));
        await sendEmail(settings, { to: customer.email, subject: `Invoice — ${companyName}`, body: html });
      } else {
        await twilioSend(settings as any, customer.phone!, `Hi ${customer.firstName}, your invoice for ${fmt(Number(job.amount) || 0)} is ready: ${payLink}`);
      }
      toast(`Invoice sent to ${customer.firstName} ✓`, "green");
      return true;
    } catch (err: any) {
      toast(err?.message || "Failed to send invoice", "red");
      return false;
    } finally {
      setSendingCompleteInvoice(false);
    }
  };

  const finalizeCompletion = (paymentStatus: "Paid" | "Pending", method?: string, invoiceSent?: boolean) => {
    let hrs = Number(job.loggedHours) || 0;
    const patch: Partial<Job> = { status: "completed", completedAt: new Date().toISOString() };
    if (job.clockInAt) {
      const lunchMs = paidLunchBreaks ? 0 : (job.lunchMinutes || 0) * 60000;
      const added = Math.round((Date.now() - job.clockInAt - lunchMs) / 36000) / 100;
      hrs = Math.round((hrs + added) * 100) / 100;
      patch.clockInAt = null; patch.lunchStartAt = null; patch.loggedHours = hrs;
    }
    if (paymentStatus === "Paid") {
      patch.paymentType = (method as any) || "Cash";
      patch.paymentStatus = "Paid";
      patch.amountCollected = Number(job.amount) || 0;
    } else {
      patch.paymentStatus = "Pending";
      if (invoiceSent) { patch.paymentType = "Invoice"; patch.invoiceSentAt = today(); }
    }
    onUpdateJob(patch);
    onJobCompleted?.({ ...job, ...patch } as Job);
    setCompleteSummary({ hours: hrs, amount: Number(job.amount) || 0, paymentStatus: paymentStatus === "Paid" ? `Paid (${patch.paymentType})` : invoiceSent ? "Unpaid — Invoice Sent" : "Unpaid" });
    setCompleteStep("summary");
    toast("Job marked complete ✓", "green");
  };

  // ── Customer sign-off overlay ─────────────────────────────────────────────
  if (showSignOff) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setShowSignOff(false)} className="p-2 rounded-xl hover:bg-white/10 text-white/60 -ml-2">
            <ChevronLeft size={20} />
          </button>
          <div className="font-semibold">Customer Sign-Off</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto space-y-4">
          {/* Services summary */}
          <Glass className="p-4 !bg-black/40">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-semibold">Services Completed</div>
            <div className="text-sm text-white/80">{job.notes || job.address}</div>
            {job.amount > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-white/50 text-sm">Total</span>
                <span className="text-xl font-black text-green-400">{fmt(job.amount)}</span>
              </div>
            )}
          </Glass>

          {/* Before / After photos */}
          {(beforePhoto || afterPhoto) && (
            <Glass className="p-4 !bg-black/40">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-semibold">Before / After</div>
              {beforePhoto && afterPhoto ? (
                <BeforeAfterSlider before={beforePhoto.dataUrl} after={afterPhoto.dataUrl} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {beforePhoto && <div className="rounded-xl overflow-hidden aspect-video"><img src={beforePhoto.dataUrl} alt="Before" className="w-full h-full object-cover" /></div>}
                  {afterPhoto && <div className="rounded-xl overflow-hidden aspect-video"><img src={afterPhoto.dataUrl} alt="After" className="w-full h-full object-cover" /></div>}
                </div>
              )}
            </Glass>
          )}

          {/* Legal disclaimer — job-specific terms, then Settings → Terms &
              Conditions, then the standard fallback wording, in that order */}
          <Glass className="p-4 !bg-white/5 !border-white/10">
            <div className="flex items-start gap-2 mb-3">
              <Shield size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                {(signOffDisclaimer || DEFAULT_SIGNOFF_DISCLAIMER).replace(/\{\{company\}\}/g, companyName)}
              </div>
            </div>
          </Glass>

          {/* Signature input — type or draw, both legally binding with a timestamp */}
          <Glass className="p-4 !bg-black/40">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-semibold flex items-center gap-1">
              <PenLine size={11} />Digital Signature
            </div>
            <div className="flex gap-2 mb-3">
              {([["type", "⌨️ Type"], ["draw", "✍️ Draw"]] as const).map(([m, l]) => (
                <button key={m} onClick={() => switchSigMode(m)} className={"flex-1 py-2 rounded-xl text-xs font-semibold border transition " + (sigMode === m ? "bg-blue-900/40 border-blue-500/60 text-blue-200" : "bg-black/30 border-white/10 text-white/50 hover:text-white")}>{l}</button>
              ))}
            </div>
            {sigMode === "type" ? (
              <>
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Full name..."
                  className="w-full bg-transparent border-b-2 border-red-600/40 focus:border-red-500 text-white text-lg py-2 focus:outline-none placeholder-white/20"
                />
                {signerName.trim() && (
                  <div className="mt-3 p-3 bg-white/5 rounded-xl text-center">
                    <div className="text-white/40 text-[10px] uppercase mb-1">Signature Preview</div>
                    <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }} className="text-2xl text-white/80">{signerName}</div>
                    <div className="text-[10px] text-white/30 mt-2">{new Date().toLocaleString()}</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Full name (optional, for the record)"
                  className="w-full bg-transparent border-b border-white/10 focus:border-red-500 text-white text-sm py-1.5 mb-2 focus:outline-none placeholder-white/20"
                />
                <div className="bg-white rounded-xl overflow-hidden border-2 border-dashed border-gray-300">
                  <canvas ref={sigCanvasRef} width={580} height={160} className="w-full cursor-crosshair touch-none" style={{ height: 160 }}
                    onMouseDown={sigStartDraw} onMouseMove={sigDraw} onMouseUp={sigStopDraw} onMouseLeave={sigStopDraw}
                    onTouchStart={sigStartDraw} onTouchMove={sigDraw} onTouchEnd={sigStopDraw} />
                </div>
                <div className="flex items-center justify-between text-xs text-white/40 mt-2">
                  <span>Sign above with your finger or mouse</span>
                  <button onClick={sigClear} className="text-red-400 hover:text-red-300">Clear</button>
                </div>
              </>
            )}
          </Glass>

          <GBtn onClick={saveSignOff} disabled={sigMode === "type" ? !signerName.trim() : !sigDrawData} className="w-full !justify-center !py-3">
            <CheckCircle size={16} />Sign & Save
          </GBtn>
        </div>
      </div>
    );
  }

  // ── "Complete Job" flow — review → payment → summary ─────────────────────
  if (completeStep) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3">
          {completeStep !== "summary" && (
            <button onClick={() => setCompleteStep("")} className="p-2 rounded-xl hover:bg-white/10 text-white/60 -ml-2">
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="font-semibold">Complete Job</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-4">
          {completeStep === "review" && (
            <>
              <Glass className="p-4 !bg-black/40 space-y-2.5">
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-1">Status Check</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Checklist</span>
                  <span className={checklistRemaining === 0 ? "text-green-400 font-semibold" : "text-yellow-400 font-semibold"}>
                    {allItems.length - checklistRemaining}/{allItems.length} done
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Customer sign-off</span>
                  <span className={job.signOff ? "text-green-400 font-semibold" : "text-yellow-400 font-semibold"}>
                    {job.signOff ? "Obtained ✓" : "Not obtained"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Payment</span>
                  <span className="text-yellow-400 font-semibold">Not yet collected</span>
                </div>
              </Glass>
              {(checklistRemaining > 0 || !job.signOff) && (
                <div className="text-xs text-white/40 text-center">
                  {checklistRemaining > 0 && `${checklistRemaining} checklist item${checklistRemaining !== 1 ? "s" : ""} remaining. `}
                  {!job.signOff && "No sign-off yet. "}
                  You can still continue.
                </div>
              )}
              {!job.signOff && (
                <GBtn variant="ghost" onClick={() => { setCompleteStep(""); setShowSignOff(true); }} className="w-full !justify-center">
                  <PenLine size={14} className="inline mr-1.5" />Get Sign-Off First
                </GBtn>
              )}
              <GBtn onClick={() => setCompleteStep("payment")} className="w-full !justify-center !py-3">
                Continue <ChevronRight size={14} className="inline ml-1" />
              </GBtn>
            </>
          )}

          {completeStep === "payment" && (
            <>
              <div className="text-lg font-bold">Has the customer paid?</div>
              <div className="text-sm text-white/50">Amount due: <span className="text-green-400 font-semibold">{fmt(job.amount)}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setPaidChoice("yes"); setCompleteStep("method"); }} className="py-4 rounded-xl border-2 border-green-600/50 bg-green-950/30 text-green-300 font-semibold hover:bg-green-900/40 transition">Yes</button>
                <button onClick={() => { setPaidChoice("no"); setCompleteStep("invoice"); }} className="py-4 rounded-xl border-2 border-white/10 bg-black/40 text-white/70 font-semibold hover:border-white/30 transition">No</button>
              </div>
            </>
          )}

          {completeStep === "method" && (
            <>
              <div className="text-lg font-bold">How did they pay?</div>
              <div className="grid grid-cols-2 gap-2">
                {["Cash", "Check", "Card", "Zelle", "Venmo", "Other"].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)} className={"py-3 rounded-xl border-2 text-sm font-semibold transition " + (paymentMethod === m ? "border-green-500 bg-green-950/30 text-green-300" : "border-white/10 bg-black/40 text-white/60 hover:border-white/30")}>{m}</button>
                ))}
              </div>
              <GBtn onClick={() => finalizeCompletion("Paid", paymentMethod || "Cash")} disabled={!paymentMethod} className="w-full !justify-center !py-3">
                <CheckCircle size={16} className="inline mr-1.5" />Mark Complete
              </GBtn>
            </>
          )}

          {completeStep === "invoice" && (
            <>
              <div className="text-lg font-bold">Send invoice to customer?</div>
              <div className="text-sm text-white/50">We'll email them a payment link for {fmt(job.amount)}.</div>
              <div className="grid grid-cols-2 gap-3">
                <GBtn onClick={async () => { const sent = await sendInvoiceFromPortal(); if (sent) finalizeCompletion("Pending", undefined, true); }} disabled={sendingCompleteInvoice} className="!py-3 !justify-center">
                  {sendingCompleteInvoice ? "Sending…" : "Yes, Send Invoice"}
                </GBtn>
                <GBtn variant="ghost" onClick={() => finalizeCompletion("Pending", undefined, false)} className="!py-3 !justify-center">
                  No, Skip
                </GBtn>
              </div>
            </>
          )}

          {completeStep === "summary" && completeSummary && (
            <>
              <div className="text-center py-2">
                <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-600/50 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={28} className="text-green-400" />
                </div>
                <div className="text-xl font-bold">Job Complete!</div>
              </div>
              <Glass className="p-4 !bg-black/40 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Time</div>
                  <div className="text-lg font-bold">{completeSummary.hours}h</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Amount</div>
                  <div className="text-lg font-bold text-green-400">{fmt(completeSummary.amount)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Payment</div>
                  <div className="text-xs font-bold mt-1">{completeSummary.paymentStatus}</div>
                </div>
              </Glass>
              {nextJob && (
                <Glass className="p-4 !bg-blue-950/15 !border-blue-700/30">
                  <div className="text-xs text-blue-400/80 uppercase tracking-wider mb-2 font-semibold">Next Job</div>
                  <div className="text-sm font-medium">{nextJobCustomer ? `${nextJobCustomer.firstName} ${nextJobCustomer.lastName}` : nextJob.address}</div>
                  <div className="text-xs text-white/40 mt-0.5">{nextJob.address}{nextJob.scheduledTime ? ` · ${nextJob.scheduledTime}` : ""}</div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextJob.address || "")}&travelmode=driving`} target="_blank" rel="noreferrer" className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-900/30 hover:bg-blue-800/40 border border-blue-700/30 text-blue-300 text-sm font-semibold transition">
                    <Navigation size={14} />Directions to Next Job
                  </a>
                </Glass>
              )}
              <GBtn onClick={() => { setCompleteStep(""); if (onComplete) onComplete(); }} className="w-full !justify-center !py-3">
                Done
              </GBtn>
            </>
          )}
        </div>
      </div>
    );
  }

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
          {(job.status || "").replace("_", " ")}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Payment status — only meaningful once the job is done */}
        {job.status === "completed" && (
          <Glass className={"p-3 flex items-center justify-between gap-3 " + (job.paymentStatus === "Paid" ? "!bg-green-950/20 !border-green-700/30" : "!bg-yellow-950/20 !border-yellow-700/30")}>
            <div>
              <div className={"text-xs font-bold " + (job.paymentStatus === "Paid" ? "text-green-300" : "text-yellow-300")}>{paymentStatusLabel(job)}</div>
              <div className="text-[10px] text-white/40 mt-0.5">
                {job.amountCollected ? `${fmt(job.amountCollected)} collected` : `${fmt(job.amount)} due`}
                {job.completedAt ? ` · Completed ${new Date(job.completedAt).toLocaleDateString()}` : ""}
                {job.loggedHours ? ` · ${job.loggedHours}h worked` : ""}
              </div>
            </div>
          </Glass>
        )}

        {/* Customer info */}
        {customer && (
          <Glass className="p-4 !bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-bold flex-shrink-0">
                {customer.firstName?.[0] || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{customer.firstName} {customer.lastName}</div>
                {customer.phone && (
                  <a href={"tel:" + customer.phone} className="text-sm text-blue-400 flex items-center gap-1 mt-0.5">
                    <Phone size={11} />{customer.phone}
                  </a>
                )}
              </div>
              {customer.phone && (
                <a href={"https://maps.google.com/?q=" + encodeURIComponent(job.address)} target="_blank" rel="noreferrer"
                  className="p-2 rounded-xl bg-blue-950/30 border border-blue-700/30 text-blue-400">
                  <MapPin size={14} />
                </a>
              )}
            </div>
            {customer.gateCode && <div className="mt-2 text-xs text-yellow-400/80">🔐 Gate code: {customer.gateCode}</div>}
            {customer.hasDog && <div className="mt-0.5 text-xs text-orange-400/80">🐕 Dog on property{customer.dogName ? ` — ${customer.dogName}` : ""}</div>}
          </Glass>
        )}

        <StreetViewThumb address={job.address} apiKey={googleMapsKey} />

        {/* Job notes — set by the owner when scheduling, editable anytime in JobDetailModal */}
        {job.notes && (
          <Glass className="p-4 !bg-blue-950/15 !border-blue-700/25">
            <div className="text-xs text-blue-400/80 uppercase tracking-wider mb-1 font-semibold flex items-center gap-1"><FileText size={11} />Job Notes</div>
            <div className="text-sm text-white/80">{job.notes}</div>
          </Glass>
        )}

        {/* Required equipment & chemicals — confirm before starting */}
        {hasRequiredGear && (
          <Glass className={"p-4 " + (job.equipmentChecked ? "!bg-green-950/20 !border-green-700/30" : "!bg-yellow-950/15 !border-yellow-700/30")}>
            <div className="text-xs text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1">
              <CheckSquare size={12} />Required Equipment & Chemicals
              {!job.equipmentChecked && <span className="text-yellow-400 ml-auto text-[10px] normal-case">Confirm before starting</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(job.equipment || []).map(eq => (
                <span key={eq} className="text-[10px] px-2 py-1 rounded-lg bg-red-950/30 border border-red-700/30 text-red-300">{eq}</span>
              ))}
              {(job.requiredChemicals || []).map(chem => (
                <span key={chem} className="text-[10px] px-2 py-1 rounded-lg bg-purple-950/30 border border-purple-700/30 text-purple-300">{chem}</span>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!job.equipmentChecked} onChange={e => onUpdateJob({ equipmentChecked: e.target.checked })}
                className="w-4 h-4 accent-green-500 cursor-pointer" />
              <span className="text-xs text-white/70">I have all required equipment and chemicals</span>
            </label>
          </Glass>
        )}

        {/* Over-schedule warning — job has been clocked in longer than its estimate */}
        {isOverSchedule && (
          <Glass className="p-3 !bg-yellow-950/20 !border-yellow-700/40">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={15} className="text-yellow-400 flex-shrink-0" />
              <div className="text-sm font-semibold text-yellow-300 flex-1">Running over schedule</div>
            </div>
            <div className="text-xs text-white/50 mb-2">
              This job has run longer than its {formatEstDuration(job.duration!)} estimate. Let the owner know what's holding things up.
            </div>
            {delayNoteOpen ? (
              <div className="flex gap-2">
                <GInput value={delayNote} onChange={e => setDelayNote(e.target.value)} placeholder="What's causing the delay?" className="flex-1 !text-xs" />
                <GBtn className="!text-xs !py-1.5" onClick={() => {
                  if (!delayNote.trim()) return;
                  onUpdateJob({ commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: today(), note: "⚠ Delay: " + delayNote.trim() }] });
                  setDelayNote(""); setDelayNoteOpen(false);
                  toast("Delay note added");
                }}>Send</GBtn>
              </div>
            ) : (
              <button onClick={() => setDelayNoteOpen(true)} className="text-xs text-yellow-300 underline">Explain delay →</button>
            )}
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
                  {job.duration ? ` · ${formatEstDuration(job.duration)}` : ""}
                </div>
              )}
            </div>
            {effPerms.can_clock_in && (
              job.clockInAt ? (
                <GBtn variant="danger" onClick={clockOut} className="!gap-2">
                  <Square size={14} />Clock Out
                </GBtn>
              ) : (
                <GBtn onClick={clockIn} className="!gap-2">
                  <Play size={14} />Clock In
                </GBtn>
              )
            )}
          </div>
          {effPerms.can_clock_in && job.clockInAt && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              {job.lunchStartAt ? (
                <>
                  <div>
                    <div className="text-[10px] text-yellow-400/70 uppercase tracking-wider">On Lunch</div>
                    <div className="font-mono text-lg font-bold text-yellow-400">{lunchDisplay}</div>
                  </div>
                  <GBtn onClick={endLunch} className="!gap-2 !bg-yellow-700 hover:!bg-yellow-600 !border-yellow-600/50">
                    <Square size={12} />End Lunch
                  </GBtn>
                </>
              ) : (
                <>
                  <div className="text-xs text-white/40">{job.lunchMinutes ? `${job.lunchMinutes}m lunch logged${job.lunchExceeded ? " ⚠️ exceeded limit" : ""}` : "No lunch taken yet"}</div>
                  <GBtn onClick={takeLunch} className="!gap-2 !bg-white/10 hover:!bg-white/15 !border-white/20 !text-white/80">
                    🍽️ Take Lunch
                  </GBtn>
                </>
              )}
            </div>
          )}
        </Glass>

        {/* Photos & Videos */}
        <Glass className="p-4 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Image size={12} />Photos & Videos
          </div>
          {beforePhoto && afterPhoto && (
            <div className="mb-3">
              <BeforeAfterSlider before={beforePhoto.dataUrl} after={afterPhoto.dataUrl} />
            </div>
          )}
          {effPerms.can_upload_photos && (
            <div className="grid grid-cols-3 gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader();
                    r.onload = ev => addPhoto("before", ev.target!.result as string);
                    r.readAsDataURL(f); e.target.value = "";
                  }} />
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs font-medium transition text-center">
                  <Plus size={13} /><span>📷 Before</span>
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
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-green-950/30 hover:bg-green-900/40 border border-green-700/40 text-green-300 text-xs font-medium transition text-center">
                  <Plus size={13} /><span>✨ After</span>
                </div>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="video/*" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) addVideo(f); e.target.value = ""; }} />
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs font-medium transition text-center">
                  <Video size={13} /><span>Video</span>
                </div>
              </label>
            </div>
          )}
          {(job.photos || []).length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(job.photos || []).map((p, i) => p.dataUrl ? (
                <div key={p.id || i} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                  <div className={"absolute top-1 left-1 text-[8px] px-1 py-0.5 rounded font-bold uppercase " +
                    (p.type === "before" ? "bg-blue-600/90" : "bg-green-600/90")}>{p.type}</div>
                  {effPerms.can_upload_photos && (
                    <button onClick={() => { if (window.confirm("Delete this photo?")) onUpdateJob({ photos: (job.photos || []).filter(x => (x.id || x) !== (p.id || p)) }); }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-700 text-white flex items-center justify-center transition">
                      <X size={11} />
                    </button>
                  )}
                </div>
              ) : null)}
            </div>
          )}
          {(job.videos || []).length > 0 && (
            <div className="mt-2 space-y-2">
              {(job.videos || []).map((v, i) => (
                <div key={v.id || i} className="rounded-xl overflow-hidden bg-black/60 relative">
                  <video src={v.dataUrl} controls className="w-full rounded-xl" style={{ maxHeight: 200 }} />
                  {effPerms.can_upload_photos && (
                    <button onClick={() => { if (window.confirm("Delete this video?")) onUpdateJob({ videos: (job.videos || []).filter(x => (x.id || x) !== (v.id || v)) }); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-red-700 text-white flex items-center justify-center transition">
                      <X size={13} />
                    </button>
                  )}
                  {v.addedAt && <div className="text-[10px] text-white/30 px-2 pb-1">{v.addedAt}</div>}
                </div>
              ))}
            </div>
          )}
        </Glass>

        {/* Checklists */}
        <Glass className="p-4 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1">
            <CheckSquare size={12} />Job Checklists
          </div>
          <PortalChecklistSection
            title="Pre-Job" emoji="🔵" allowPhotos
            items={preItems}
            onUpdate={items => onUpdateJob({ preChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
          />
          <PortalChecklistSection
            title="During Job" emoji="🟡" allowPhotos
            items={durItems}
            onUpdate={items => onUpdateJob({ duringChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
          />
          <PortalChecklistSection
            title="Post-Job" emoji="🟢" allowPhotos
            items={postItems}
            onUpdate={items => onUpdateJob({ postChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
          />
        </Glass>

        {/* Customer sign-off */}
        {job.signOff && (
          <Glass className="p-4 !bg-green-950/20 !border-green-700/30">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-green-400" />
              <div className="text-xs font-semibold text-green-300">Customer Signed Off</div>
            </div>
            {job.signOff.sigType === "draw" && job.signOff.sigData ? (
              <img src={job.signOff.sigData} alt="Signature" className="mt-1 bg-white rounded-lg max-h-20" />
            ) : (
              <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }} className="text-lg text-white/80 mt-1">{job.signOff.signerName}</div>
            )}
            <div className="text-[10px] text-white/30 mt-1">{new Date(job.signOff.timestamp).toLocaleString()}</div>
          </Glass>
        )}
        {job.status === "completed" ? (
          onComplete && (
            <button onClick={onComplete}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-green-900/30 hover:bg-green-800/40 border border-green-700/30 text-green-300 text-sm font-semibold transition">
              <ChevronLeft size={14} />Back to Jobs
            </button>
          )
        ) : (
          <div className="space-y-2">
            {effPerms.can_get_signoff && !job.signOff && (
              <GBtn variant="ghost" onClick={() => setShowSignOff(true)} className="w-full !justify-center">
                <PenLine size={14} className="inline mr-1.5" />Get Customer Sign-Off
              </GBtn>
            )}
            <GBtn onClick={startCompleteFlow} className="w-full !justify-center !py-3 !bg-gradient-to-r !from-green-700 !to-green-900 !border-green-600/50">
              <CheckCircle size={16} />Complete Job
            </GBtn>
          </div>
        )}

        {/* Internal notes */}
        {job.internalNotes && (
          <Glass className="p-4 !bg-yellow-950/20 !border-yellow-700/30">
            <div className="text-xs text-yellow-400/80 uppercase tracking-wider mb-1 font-semibold">📋 Site Notes</div>
            <div className="text-sm text-white/80">{job.internalNotes}</div>
          </Glass>
        )}

        {/* Notes — view existing always, add only if permitted */}
        {(effPerms.can_add_notes || (job.commLog || []).length > 0) && (
          <Glass className="p-4 !bg-black/40">
            {effPerms.can_add_notes && (
              <>
                <div className="text-xs text-white/60 uppercase tracking-wider mb-2">Add Note</div>
                <GTxt rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Report an issue, leave a status update..." />
                <GBtn onClick={addNote} className="mt-2 w-full !justify-center" disabled={!note.trim()}>
                  <Plus size={14} />Add Note
                </GBtn>
              </>
            )}
            {(job.commLog || []).length > 0 && (
              <div className={effPerms.can_add_notes ? "mt-3 space-y-1.5 max-h-40 overflow-y-auto" : "space-y-1.5 max-h-40 overflow-y-auto"}>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Notes</div>
                {[...(job.commLog || [])].reverse().slice(0, 5).map(e => (
                  <div key={e.id} className="text-xs p-2 bg-white/5 rounded-lg">
                    <div className="text-white/80">{e.note}</div>
                    <div className="text-white/30 mt-0.5">{e.date}</div>
                  </div>
                ))}
              </div>
            )}
          </Glass>
        )}
      </div>
    </div>
  );
}

// ── Owner Team Portal ─────────────────────────────────────────────────────────
function OwnerTeamPortal({ jobs, employees, customers, onClose, googleMapsKey }: {
  jobs: Job[]; employees: Employee[]; customers: Customer[]; onClose: () => void; googleMapsKey?: string;
}) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const todayStr = today();

  const viewEmp = selectedEmpId === "all" ? null : employees.find(e => e.id === selectedEmpId);
  const visibleJobs = selectedEmpId === "all"
    ? jobs
    : jobs.filter(j => (j.crew || []).includes(selectedEmpId));
  const todayJobs = visibleJobs.filter(j => j.scheduledDate === todayStr);

  if (selectedJobId) {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) { setSelectedJobId(null); return null; }
    const customer = customers.find(c => c.id === job.customerId);
    return (
      <JobDetailView
        job={job}
        customer={customer}
        onBack={() => setSelectedJobId(null)}
        onUpdateJob={() => {}}
        toast={() => {}}
        googleMapsKey={googleMapsKey}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white -ml-2">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 font-semibold">Team Portal</div>
        <select
          value={selectedEmpId}
          onChange={e => setSelectedEmpId(e.target.value)}
          className="bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/50"
        >
          <option value="all">All Employees</option>
          {employees.filter(e => e.status === "active").map(e => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
          ))}
        </select>
        {/* Escape hatch — this view only shows because the owner's session is still
            active on this browser. An employee sharing the device needs a way to reach
            their own login instead of being stuck looking at the owner's team preview. */}
        <button
          onClick={async () => { await supabase.auth.signOut(); }}
          className="text-[10px] text-white/40 hover:text-white/70 underline whitespace-nowrap"
        >
          Not you? Sign in
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto space-y-4">
        {/* Employee cards */}
        {selectedEmpId === "all" && (
          <div className="grid grid-cols-2 gap-3">
            {employees.filter(e => e.status === "active").map(emp => {
              const empJobs = jobs.filter(j => (j.crew || []).includes(emp.id));
              const empTodayJobs = empJobs.filter(j => j.scheduledDate === todayStr);
              const active = empJobs.find(j => j.clockInAt);
              return (
                <button key={emp.id} onClick={() => setSelectedEmpId(emp.id)}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-red-600/30 text-left transition">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-bold text-sm mb-2">
                    {emp.firstName?.[0] || "?"}{emp.lastName?.[0] || ""}
                  </div>
                  <div className="font-semibold text-sm">{emp.firstName} {emp.lastName}</div>
                  <div className="text-[10px] text-white/40 capitalize mt-0.5">{emp.role}</div>
                  <div className="mt-2 text-xs text-white/50">{empTodayJobs.length} job{empTodayJobs.length !== 1 ? "s" : ""} today</div>
                  {active && <div className="text-[10px] text-green-400 animate-pulse mt-1">● Clocked in</div>}
                </button>
              );
            })}
          </div>
        )}

        {/* Today's jobs for selected employee */}
        <div>
          <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
            <span>{viewEmp ? `${viewEmp.firstName}'s Jobs Today` : "Today's Jobs"}</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{todayJobs.length}</span>
          </div>
          {todayJobs.length === 0 ? (
            <div className="text-center py-8 text-white/30 text-sm">No jobs today</div>
          ) : (
            <div className="space-y-2">
              {todayJobs.map(j => {
                const c = customers.find(x => x.id === j.customerId);
                return (
                  <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                    className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-red-600/30 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{j.address}</div>
                        {c && <div className="text-xs text-white/50">{c.firstName} {c.lastName}</div>}
                      </div>
                      <div className={"text-[10px] px-2 py-0.5 rounded-full font-bold uppercase " +
                        (j.status === "completed" ? "bg-green-900/40 text-green-300" :
                         j.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
                         "bg-blue-900/40 text-blue-300")}>
                        {(j.status || "").replace("_", " ")}
                      </div>
                    </div>
                    <div className="text-xs text-white/40 mt-1">{j.scheduledTime || "All day"}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming for selected employee */}
        {viewEmp && (
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3">All Assigned Jobs</div>
            <div className="space-y-2">
              {visibleJobs.filter(j => j.scheduledDate > todayStr).slice(0, 10).map(j => {
                const c = customers.find(x => x.id === j.customerId);
                return (
                  <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                    className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{j.address}</div>
                      {c && <div className="text-xs text-white/40">{c.firstName} {c.lastName}</div>}
                    </div>
                    <div className="text-xs text-white/40 flex-shrink-0">{j.scheduledDate}</div>
                  </button>
                );
              })}
              {visibleJobs.filter(j => j.scheduledDate > todayStr).length === 0 && (
                <div className="text-center py-6 text-sm text-white/30">No upcoming jobs</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export function EmployeePortal({ empSession, setEmpSession, jobs, setJobs, employees, customers, settings, toast, isOwnerView = false, onClose = () => {}, refetchEmployees, estimates = [], setEstimates = (() => {}) as any }: {
  empSession: any; setEmpSession: (s: any) => void;
  jobs: Job[]; setJobs: (fn: (prev: Job[]) => Job[]) => void;
  employees: Employee[]; customers: Customer[];
  settings: AppSettings; toast: (msg: string, tone?: any) => void;
  isOwnerView?: boolean; onClose?: () => void;
  refetchEmployees?: () => Promise<void>;
  estimates?: any[]; setEstimates?: any;
}) {
  const TAB_TO_SLUG: Record<string, string> = { today: "", calendar: "calendar", jobs: "jobs", pay: "pay", google: "google" };
  const SLUG_TO_TAB: Record<string, "today" | "calendar" | "jobs" | "pay" | "google"> = { "": "today", calendar: "calendar", jobs: "jobs", pay: "pay", google: "google" };
  const tabFromHash = (): "today" | "calendar" | "jobs" | "pay" | "google" => {
    const slug = window.location.hash.replace(/^#\/?/, "").split("?")[0].replace(/^portal\/?/, "");
    return SLUG_TO_TAB[slug] || "today";
  };
  const [tab, setTabState] = useState<"today" | "calendar" | "jobs" | "pay" | "google">(tabFromHash);
  // Keeps the URL in sync with the active tab (#/portal, #/portal/calendar, #/portal/jobs,
  // #/portal/pay, #/portal/google) without going through App.tsx's page-level routing —
  // page stays "portal" the whole time, so App's hash-sync effect never overwrites this.
  const setTab = (next: "today" | "calendar" | "jobs" | "pay" | "google") => {
    setTabState(next);
    const slug = TAB_TO_SLUG[next];
    window.location.hash = slug ? "/portal/" + slug : "/portal";
  };
  // Respond to direct navigation / browser back-forward landing on a #/portal/* sub-path
  useEffect(() => {
    const handler = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeJobMenuOpen, setActiveJobMenuOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ order: Job[]; totalDuration: string; totalDistance: string; etas: string[]; origin: { lat: number; lng: number } | string } | null>(null);
  const [calMode, setCalMode] = useState<"week" | "month">("month");
  const [calSelectedDate, setCalSelectedDate] = useState(today());
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calMonthOffset, setCalMonthOffset] = useState(0);
  const [driveTimes, setDriveTimes] = useState<Record<string, string>>({});
  const [completionNotif, setCompletionNotif] = useState<{ message: string; nextJobId?: string } | null>(null);
  const [nextJobEta, setNextJobEta] = useState<{ jobId: string; etaTime: string; lateMinutes: number } | null>(null);
  const fetchedDriveIds = useRef(new Set<string>());
  // Lets handleAcceptRequest/handleInlineAccept trigger an immediate jobs refetch
  // right after a successful accept, instead of waiting up to 10s for the next poll.
  const refetchJobsRef = useRef<() => Promise<void>>(async () => {});
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginFirst, setLoginFirst] = useState("");
  const [loginLast, setLoginLast] = useState("");
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRecord, setInviteRecord] = useState<any>(null);
  // Locally-resolved employee when the prop array hasn't re-fetched yet (e.g. after invite registration)
  const [localEmployee, setLocalEmployee] = useState<any>(null);
  const [retrying, setRetrying] = useState(false);
  const autoRetryDoneRef = useRef(false);
  // Job request system
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<any>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [requestDone, setRequestDone] = useState<string | null>(null);
  // Employee availability
  const [availability, setAvailability] = useState<string[]>([]);
  const [autoSyncCalendar, setAutoSyncCalendar] = useState(true);
  const [showAvailability, setShowAvailability] = useState(false);
  // Optimistic override for "Start/End My Day" — if the employees table is
  // missing the dayClockInAt column (a 400 on the update), the button must
  // still flip and stay flipped instead of silently reverting on the next
  // refetch, since the underlying request never persisted. undefined means
  // "trust the server value".
  const [optimisticDayClockInAt, setOptimisticDayClockInAt] = useState<number | null | undefined>(undefined);
  // Login extras
  const [forgotSent, setForgotSent] = useState(false);
  // Incoming job requests on Today tab
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [inlineDenyId, setInlineDenyId] = useState<string | null>(null);
  const [inlineDenyReason, setInlineDenyReason] = useState("");

  // Normalize Supabase snake_case columns to the camelCase Employee shape the rest of the code expects
  const normalizeEmp = (e: any) => !e ? null : ({
    ...e,
    id: e.id || "",
    firstName: e.firstName || e.first_name || "",
    lastName: e.lastName || e.last_name || "",
    role: e.role || "Technician",
    status: e.status || "active",
    hourlyRate: e.hourlyRate ?? e.hourly_rate ?? 0,
    email: e.email || "",
  });

  // Capture hash synchronously on first render, before App.tsx's hash-sync effect can strip the invite param
  const capturedHashRef = useRef(window.location.hash);

  // Parse invite code from URL hash — e.g. #/portal?invite=ABC123
  useEffect(() => {
    const hash = capturedHashRef.current;
    const match = hash.match(/[?&]invite=([A-Z0-9]+)/i);
    console.log("INVITE CODE CAPTURED:", match ? match[1] : "(none)", "from hash:", hash);
    if (!match) return;
    const code = match[1];
    setInviteCode(code);

    const applyInvite = (inv: any) => {
      if (!inv) { setLoginError("Invalid or expired invite link."); return; }
      if (inv.used) { setLoginError("This invite has already been used. Please sign in instead."); return; }
      // Normalise field names — Supabase uses snake_case, localStorage uses camelCase
      const firstName = inv.firstName || (inv.employee_name || "").split(" ")[0] || "";
      const lastName = inv.lastName || (inv.employee_name || "").split(" ").slice(1).join(" ") || "";
      const email = inv.email || inv.employee_email || "";
      const role = inv.role || "Technician";
      const hourlyRate = inv.hourlyRate ?? inv.hourly_rate ?? 0;
      const normalised = { ...inv, firstName, lastName, email, role, hourlyRate };
      setInviteRecord(normalised);
      setLoginEmail(email);
      setLoginFirst(firstName);
      setLoginLast(lastName);
      setLoginMode("register");
    };

    const lookup = async () => {
      // If the user already has a session, skip invite processing — they're registered.
      // Never call signOut() here: Supabase fires the SIGNED_OUT event asynchronously,
      // which can race with a SIGNED_IN that follows, killing the just-created session.
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) return;

      // 1. Try Supabase first — works from any browser/device
      try {
        const { data, error } = await (supabase as any)
          .from("invites")
          .select("*")
          .eq("code", code)
          .maybeSingle();
        if (!error) {
          applyInvite(data);
          return;
        }
        // If the error is NOT "table doesn't exist", surface it
        if (!(error.message || "").includes("does not exist")) {
          applyInvite(null);
          return;
        }
        // Table doesn't exist — fall through to localStorage
      } catch { /* fall through */ }

      // 2. Fallback: localStorage (same browser as owner)
      try {
        const stored: any[] = JSON.parse(localStorage.getItem("smocks.invites") || "[]");
        const inv = stored.find((i: any) => i.code === code);
        applyInvite(inv ?? null);
      } catch {
        applyInvite(null);
      }
    };

    lookup();
  }, []);

  // Parse job request ID from URL hash (#/portal?request=UUID)
  useEffect(() => {
    const hash = capturedHashRef.current;
    const match = hash.match(/[?&]request=([a-f0-9-]{36})/i);
    if (match) setRequestId(match[1]);
  }, []);

  const myEmployee = empSession
    ? (employees.find(e => (e as any).user_id === empSession.user.id) ||
       employees.find(e => e.email?.toLowerCase() === empSession.user.email?.toLowerCase()) ||
       localEmployee ||
       null)
    : null;

  useEffect(() => {
    if (optimisticDayClockInAt !== undefined && (myEmployee as any)?.dayClockInAt === optimisticDayClockInAt) {
      setOptimisticDayClockInAt(undefined);
    }
  }, [(myEmployee as any)?.dayClockInAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Log whenever the lookup inputs change so we can see if employees is empty on first render.
  // Also auto-retries once against Supabase when myEmployee isn't found in the prop array.
  useEffect(() => {
    if (!empSession) return;
    const userId = empSession.user.id;
    const email = empSession.user.email;
    console.log("myEmployee lookup — employees:", JSON.stringify(employees.map(e => ({ id: (e as any).id, email: e.email, user_id: (e as any).user_id }))));
    console.log("myEmployee lookup — current email:", email, "current userId:", userId);
    console.log("myEmployee lookup — localEmployee:", JSON.stringify(localEmployee));
    console.log("myEmployee lookup — result:", myEmployee ? `found: ${myEmployee.firstName} ${myEmployee.lastName}` : "NOT FOUND");

    if (!myEmployee && !autoRetryDoneRef.current) {
      autoRetryDoneRef.current = true;
      const uid2 = empSession.user.id;
      const email2 = empSession.user.email || "";
      // Ask parent to re-fetch from Supabase first (updates the employees prop)
      const doFetch = async () => {
        await refetchEmployees?.();
        // Then query directly in case the prop hasn't re-rendered yet
        try {
          const { data: byId } = await (supabase as any)
            .from("employees").select("*").eq("user_id", uid2).maybeSingle();
          if (byId) { setLocalEmployee(normalizeEmp(byId)); return; }
          const { data: byEmail } = await (supabase as any)
            .from("employees").select("*").ilike("email", email2).maybeSingle();
          if (byEmail) {
            await (supabase as any).from("employees").update({ user_id: uid2 }).eq("id", byEmail.id);
            setLocalEmployee(normalizeEmp({ ...byEmail, user_id: uid2 }));
          }
        } catch { /* table may not exist */ }
      };
      doFetch();
    }
  }, [empSession, employees, localEmployee]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch job request data when employee logs in
  useEffect(() => {
    if (!requestId || !empSession) return;
    const load = async () => {
      setRequestLoading(true);
      try {
        const { data } = await (supabase as any)
          .from("job_requests").select("*").eq("id", requestId).maybeSingle();
        setRequestData(data);
      } catch { /* table may not exist */ }
      setRequestLoading(false);
    };
    load();
  }, [requestId, empSession?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load availability from employee record
  useEffect(() => {
    if (!myEmployee) return;
    const av = (myEmployee as any).availability;
    if (Array.isArray(av) && av.length > 0) setAvailability(av);
    if ((myEmployee as any).autoSyncCalendar === false) setAutoSyncCalendar(false);
    if ((myEmployee as any).homeBaseAddress) setHomeBaseAddressState((myEmployee as any).homeBaseAddress);
  }, [(myEmployee as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate the Google connection from Supabase if localStorage doesn't have it
  // (different browser/device, or localStorage cleared) — so a real, still-valid
  // token saved by App.tsx's OAuth callback shows "Connected" without re-asking.
  useEffect(() => {
    if (!myEmployee || !empSession?.user?.id) return;
    const uid = empSession.user.id;
    const existing = getEmpGoogleToken(uid);
    if (isEmpGoogleTokenValid(existing)) return;
    const dbToken = (myEmployee as any).google_token;
    const dbExpiresAt = (myEmployee as any).google_token_expires_at;
    if (!dbToken || !dbExpiresAt) return;
    const expiresAt = new Date(dbExpiresAt).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
    saveEmpGoogleToken(uid, {
      token: dbToken,
      refreshToken: (myEmployee as any).google_refresh_token || undefined,
      email: (myEmployee as any).google_email || empSession.user.email || "",
      expiresAt,
    });
    setGoogleHydrateTick(t => t + 1);
  }, [(myEmployee as any)?.id, empSession?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Silently refresh an expired Google access token using the stored
  // refresh_token before ever asking the employee to reconnect. Checked on
  // mount and every 5 minutes — Google access tokens last ~1hr, so this
  // catches expiry well before it would actually block a calendar/Gmail call.
  useEffect(() => {
    if (!empSession?.user?.id) return;
    const uid = empSession.user.id;
    const tryRefresh = async () => {
      const existing = getEmpGoogleToken(uid);
      if (isEmpGoogleTokenValid(existing) || !existing?.refreshToken) return;
      const backendUrl = settings?.googleBackendUrl;
      if (!backendUrl) return;
      const refreshed = await refreshEmpGoogleToken(backendUrl, existing.refreshToken);
      if (!refreshed) return; // refresh failed — fall through to the normal "reconnect" prompt
      saveEmpGoogleToken(uid, { ...existing, token: refreshed.token, expiresAt: refreshed.expiresAt });
      (supabase as any).from("employees")
        .update({ google_token: refreshed.token, google_token_expires_at: new Date(refreshed.expiresAt).toISOString() })
        .eq("user_id", uid)
        .catch(() => {});
      setGoogleHydrateTick(t => t + 1);
    };
    tryRefresh();
    const interval = setInterval(tryRefresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [empSession?.user?.id, settings?.googleBackendUrl]);

  // Fetch incoming job requests for this employee. The loading flag only
  // gates the very first fetch — flipping it on every 10s background poll
  // made the "Incoming Requests" section vanish and reappear continuously,
  // which is what caused the Today tab to visibly jump up and down.
  const incomingFirstLoadRef = useRef(true);
  useEffect(() => {
    if (!empSession || !myEmployee) return;
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    const load = async () => {
      if (incomingFirstLoadRef.current) setIncomingLoading(true);
      try {
        const { data } = await (supabase as any)
          .from("job_requests")
          .select("*")
          .eq("employee_id", empId)
          .order("created_at", { ascending: false });
        if (Array.isArray(data)) setIncomingRequests(data);
      } catch { /* table may not exist */ }
      if (incomingFirstLoadRef.current) { setIncomingLoading(false); incomingFirstLoadRef.current = false; }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [(myEmployee as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch jobs from Supabase so Supabase-side crew assignments are visible.
  // Runs once when the employee resolves, then polls every 5s (plus a
  // realtime subscription where available) so changes the owner — or this
  // employee on another device — makes while this portal is open show up
  // without a manual refresh.
  useEffect(() => {
    if (!empSession || !myEmployee) return;
    const empId = myEmployee.id;
    const empUserId = (myEmployee as any).user_id;
    const load = async () => {
      try {
        // Layered fetch: an RLS policy filtering by org_id could legitimately return
        // [] from a plain select even for jobs this employee IS assigned to, if those
        // jobs are missing org_id. Try narrowing by crew membership first (two id
        // shapes, since crew entries may store either), then fall back to fetching
        // everything and filtering client-side — logging each attempt so it's clear
        // which path actually returned data.
        let data: any[] | null = null;
        try {
          const attempt1 = await (supabase as any).from("jobs").select("*").contains("crew", [empId]);
          console.log("FETCH ATTEMPT 1 — contains('crew', [employeeId]):", attempt1);
          if (Array.isArray(attempt1.data) && attempt1.data.length > 0) data = attempt1.data;
        } catch (e) { console.warn("FETCH ATTEMPT 1 failed:", e); }

        if (!data && empUserId) {
          try {
            const attempt2 = await (supabase as any).from("jobs").select("*").contains("crew", [empUserId]);
            console.log("FETCH ATTEMPT 2 — contains('crew', [userId]):", attempt2);
            if (Array.isArray(attempt2.data) && attempt2.data.length > 0) data = attempt2.data;
          } catch (e) { console.warn("FETCH ATTEMPT 2 failed:", e); }
        }

        if (!data) {
          const attempt3 = await (supabase as any).from("jobs").select("*");
          console.log("FETCH ATTEMPT 3 — select all, filter client-side:", attempt3);
          data = Array.isArray(attempt3.data) ? attempt3.data : [];
        }

        console.log("FETCHED JOBS — raw data:", JSON.stringify(data));
        console.log("FETCHED JOBS — count:", data?.length);
        console.log("FETCHED JOBS — first job crew:", JSON.stringify(data?.[0]?.crew));
        console.log("MY EMPLOYEE ID:", empId, "USER_ID:", empUserId);
        if (Array.isArray(data)) {
          data.forEach((j: any) => {
            console.log("  job", j.id, "crew:", j.crew, "— matches me?",
              crewIncludesEmployee(j.crew, empId, empUserId));
          });
        }
        // Fields the employee's own clock/lunch actions own — an in-flight
        // Supabase write for one of these (or a stale/slow row read) must never
        // win against a more recent local change, or the clock-out → clock-in
        // toggle can revert mid-air on the next poll tick and look stuck.
        const EMPLOYEE_OWNED_FIELDS = ["clockInAt", "lunchStartAt", "lunchMinutes", "lunchExceeded", "loggedHours"] as const;
        if (Array.isArray(data) && data.length > 0) {
          setJobs(prev => {
            const supabaseMap = new Map(data.map((j: any) => [j.id, j]));
            const merged = prev.map(j => {
              if (!supabaseMap.has(j.id)) return j;
              const remote = supabaseMap.get(j.id);
              const next = { ...j, ...remote };
              EMPLOYEE_OWNED_FIELDS.forEach(f => { next[f] = (j as any)[f]; });
              return next;
            });
            const existingIds = new Set(prev.map(j => j.id));
            const added = data.filter((j: any) => !existingIds.has(j.id));
            const result = [...merged, ...added];
            const myJobsFiltered = result.filter(j => crewIncludesEmployee(j.crew, empId, empUserId));
            console.log("FILTERED MY JOBS — count:", myJobsFiltered.length);
            console.log("FILTERED MY JOBS — ids:", myJobsFiltered.map((j: any) => j.id));
            return result;
          });
        }
      } catch (e) { console.warn("ALL JOBS — fetch failed:", e); }
    };
    refetchJobsRef.current = load;
    load();
    let channel: any = null;
    try {
      channel = (supabase as any)
        .channel("emp-jobs-sync-" + empId)
        .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => { load(); })
        .subscribe();
    } catch { /* realtime may not be enabled on this project */ }
    const interval = setInterval(load, 3000);
    return () => {
      clearInterval(interval);
      try { channel?.unsubscribe(); } catch { /* ignore */ }
    };
  }, [(myEmployee as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge owner-set permissions with defaults (all-on for existing employees with no permissions field)
  const perms: Record<string, boolean> = { ...DEFAULT_PERMISSIONS, ...((myEmployee as any)?.permissions || {}) };

  // This whole component also mounts for the owner's "preview as team" view
  // (isOwnerView), which has no empSession/myEmployee at all — none of the
  // employee-specific filtering, logging, or fetching below is meaningful
  // there, so it's gated on empSession rather than running unconditionally.
  const myJobs = empSession && myEmployee
    ? jobs.filter(j => crewIncludesEmployee(j.crew, myEmployee.id, (myEmployee as any).user_id))
    : [];
  if (empSession) {
    console.log("ALL JOBS — total jobs:", jobs.length);
    console.log("ALL JOBS — myEmployee:", myEmployee?.id, (myEmployee as any)?.user_id);
    console.log("ALL JOBS — sample job crew:", jobs[0]?.crew);
    console.log("FILTERED MY JOBS — count:", myJobs.length);
    console.log("FILTERED MY JOBS — ids:", myJobs.map(j => j.id));
  }

  // Real-time location sharing — only while opted in AND clocked in for the
  // day; posts a GPS fix to Supabase every 30s so the owner's Crew View →
  // Live Now map can plot it. Stops automatically the moment either flag
  // flips off (interval is torn down by the effect cleanup on re-run).
  useEffect(() => {
    const empId = (myEmployee as any)?.id;
    const sharing = (myEmployee as any)?.locationSharing;
    const clockedIn = !!(myEmployee as any)?.dayClockInAt;
    if (!empId || !sharing || !clockedIn || !navigator.geolocation) return;
    const postLocation = () => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          (supabase as any).from("employees").update({
            lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() },
          }).eq("id", empId).then(() => {}, () => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };
    postLocation();
    const interval = setInterval(postLocation, 30000);
    return () => clearInterval(interval);
  }, [(myEmployee as any)?.id, (myEmployee as any)?.locationSharing, (myEmployee as any)?.dayClockInAt]);

  // 24h job reminder — checks once on load (and hourly while the portal stays open)
  // for jobs starting within the next 24h, and emails the employee via their own
  // connected Gmail account. Dedupes via localStorage so each job only reminds once.
  useEffect(() => {
    if (!myEmployee || !empSession?.user?.id) return;
    const checkReminders = async () => {
      const empToken = await getValidEmpGoogleToken(empSession.user.id, settings?.googleBackendUrl);
      if (!empToken) return;
      const remindedKey = "smocks.empReminded";
      let reminded: string[] = [];
      try { reminded = JSON.parse(localStorage.getItem(remindedKey) || "[]"); } catch { /* ignore */ }
      const now = Date.now();
      myJobs.forEach(j => {
        if (!j.scheduledDate || j.status === "completed" || reminded.includes(j.id)) return;
        const startDt = new Date(`${j.scheduledDate}T${j.scheduledTime || "09:00"}:00`).getTime();
        const hoursAway = (startDt - now) / 3600000;
        if (hoursAway > 0 && hoursAway <= 24) {
          sendViaGmail(
            empToken!.token, empToken!.email, empToken!.email,
            `Reminder: Job Tomorrow — ${j.address}`,
            `<p>Reminder: you have a job at <strong>${j.address}</strong> on ${j.scheduledDate}${j.scheduledTime ? " at " + j.scheduledTime : ""}.</p>`
          ).then(() => {
            reminded.push(j.id);
            try { localStorage.setItem(remindedKey, JSON.stringify(reminded)); } catch { /* ignore */ }
          }).catch(() => {});
        }
      });
    };
    checkReminders();
    const h = setInterval(checkReminders, 60 * 60 * 1000);
    return () => clearInterval(h);
  }, [(myEmployee as any)?.id, myJobs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = today();
  const todayJobs = myJobs.filter(j => j.scheduledDate === todayStr);

  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
  })();
  const weekEnd = (() => {
    const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().slice(0, 10);
  })();
  const weekJobs = myJobs.filter(j => j.scheduledDate >= weekStart && j.scheduledDate <= weekEnd);

  const weekHours = weekJobs.reduce((s, j) => s + Number(j.loggedHours || 0), 0);
  const weekJobsDone = weekJobs.filter(j => j.status === "completed").length;
  const weekPay = weekHours * (myEmployee?.hourlyRate || 0);

  const upNextJob = [...myJobs]
    .filter(j => j.scheduledDate >= todayStr && j.status !== "completed")
    .sort((a, b) => {
      const da = a.scheduledDate + (a.scheduledTime || "23:59");
      const db = b.scheduledDate + (b.scheduledTime || "23:59");
      return da.localeCompare(db);
    })[0] ?? null;
  const upNextCustomer = upNextJob ? customers.find(c => c.id === upNextJob.customerId) : null;

  const payStart = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); })();
  const periodJobs = myJobs.filter(j => j.status === "completed" && j.scheduledDate >= payStart);
  const periodHours = periodJobs.reduce((s, j) => s + Number(j.loggedHours || j.duration || 0), 0);
  const estimatedPay = periodHours * (myEmployee?.hourlyRate || 0);

  const activeClockJobs = myJobs.filter(j => !!j.clockInAt);
  const activeClockJob = activeClockJobs[0];
  const formatElapsed = (clockInAt: number): string => {
    const sec = Math.max(0, Math.floor((Date.now() - clockInAt) / 1000));
    return [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map(n => String(n).padStart(2, "0")).join(":");
  };

  const updateJob = (jobId: string, patch: Partial<Job>) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
    // Persist immediately rather than waiting on the 30s App-level auto-save —
    // the jobs-fetch poll below runs every 10s and merges Supabase's row straight
    // over local state, so anything not yet saved (clock-in, lunch, checklist
    // progress) can get silently reverted by the very next poll tick. That race
    // is what made actions like Clock In appear to randomly "undo" themselves.
    (supabase as any).from("jobs").update(patch).eq("id", jobId)
      .then((result: any) => { if (result?.error) console.warn("Job update failed to save:", result.error); })
      .catch((e: any) => console.warn("Job update failed to save:", e?.message));
  };

  // Tick every second when any job is clocked in so card timers update live
  const [, setCardTick] = useState(0);
  useEffect(() => {
    if (!activeClockJob) return;
    const t = setInterval(() => setCardTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [activeClockJob?.id]);

  // Fetch drive time via Maps JS DistanceMatrixService (loaded by AddressAutocomplete)
  const fetchDriveTime = (jobId: string, address: string) => {
    if (fetchedDriveIds.current.has(jobId)) return;
    fetchedDriveIds.current.add(jobId);
    const loc = userLocationRef.current;
    if (!loc || !settings.googleMapsKey) return;
    const gm = (window as any).google?.maps;
    if (!gm?.DistanceMatrixService) return;
    try {
      const svc = new gm.DistanceMatrixService();
      svc.getDistanceMatrix(
        { origins: [loc], destinations: [address], travelMode: gm.TravelMode.DRIVING },
        (result: any, status: string) => {
          if (status === "OK") {
            const dur: string | undefined = result?.rows?.[0]?.elements?.[0]?.duration?.text;
            if (dur) setDriveTimes(prev => ({ ...prev, [jobId]: dur }));
          }
        }
      );
    } catch { /* silently fail */ }
  };

  // Route optimization for today's jobs — uses the Maps JS DirectionsService
  // (optimizeWaypoints) to reorder stops for the shortest total drive, then
  // hands that order off to a Google Maps URL for actual turn-by-turn nav.
  // Resolves an origin point for the route: fresh GPS fix first (don't rely on
  // the silent background fetch from mount, which may never have resolved if
  // permission was slow/denied), then the employee's saved Home Base address,
  // then — rather than dead-ending with nothing — the first stop itself, so
  // Route always produces a usable result instead of silently doing nothing.
  const resolveRouteOrigin = (): Promise<{ lat: number; lng: number } | string | null> => {
    return new Promise(resolve => {
      if (userLocationRef.current) { resolve(userLocationRef.current); return; }
      if (!navigator.geolocation) { resolve(homeBaseAddress || null); return; }
      const timer = setTimeout(() => resolve(homeBaseAddress || null), 6000);
      navigator.geolocation.getCurrentPosition(
        pos => { clearTimeout(timer); const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; userLocationRef.current = loc; resolve(loc); },
        () => { clearTimeout(timer); resolve(homeBaseAddress || null); },
        { timeout: 5500 }
      );
    });
  };

  // Guaranteed fallback — needs no API key, no DirectionsService, nothing that
  // can fail or hang: it just opens Maps with every stop as a waypoint in
  // whatever order they're already in. This is what fires if the optimized
  // route can't be computed for any reason, so the button always does something.
  const openPlainMapsRoute = (stops: Job[], origin: { lat: number; lng: number } | string | null) => {
    const dest = encodeURIComponent(stops[stops.length - 1].address);
    const waypts = stops.slice(0, -1).map(j => encodeURIComponent(j.address)).join("|");
    const originParam = origin ? `&origin=${encodeURIComponent(typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`)}` : "";
    window.open(`https://www.google.com/maps/dir/?api=1${originParam}&destination=${dest}${waypts ? "&waypoints=" + waypts : ""}&travelmode=driving`, "_blank");
  };

  const optimizeRoute = async () => {
    const stops = todayJobs.filter(j => j.status !== "completed" && j.address);
    if (stops.length === 0) { toast("No jobs left today to route", "yellow"); return; }
    setRouteLoading(true);
    const origin = await resolveRouteOrigin();
    const effectiveOrigin = origin || stops[0].address;
    const routeStops = origin ? stops : stops.slice(1);
    if (!origin) toast("Couldn't get your location — routing from the first job instead", "yellow");
    if (routeStops.length === 0) {
      // Single stop — no optimization needed, just go.
      setRouteLoading(false);
      openPlainMapsRoute(stops, origin);
      return;
    }
    if (!settings.googleMapsKey) {
      setRouteLoading(false);
      toast("No Google Maps key set — opening unoptimized route", "yellow");
      openPlainMapsRoute(routeStops, origin);
      return;
    }
    try {
      await withTimeout(loadMapsScript(settings.googleMapsKey), 8000, "Maps script load");
      const gm = (window as any).google?.maps;
      if (!gm?.DirectionsService) throw new Error("DirectionsService unavailable");
      const svc = new gm.DirectionsService();
      const destination = routeStops[routeStops.length - 1].address;
      const waypoints = routeStops.slice(0, -1).map(j => ({ location: j.address, stopover: true }));
      const result: any = await withTimeout(new Promise((resolve, reject) => {
        svc.route(
          { origin: effectiveOrigin, destination, waypoints, optimizeWaypoints: true, travelMode: gm.TravelMode.DRIVING },
          (res: any, status: string) => status === "OK" && res?.routes?.[0] ? resolve(res) : reject(new Error("DirectionsService status: " + status))
        );
      }), 10000, "Route calculation");
      setRouteLoading(false);
      const route = result.routes[0];
      const order: Job[] = (route.waypoint_order || []).map((idx: number) => routeStops[idx]).concat([routeStops[routeStops.length - 1]]);
      let totalSec = 0, totalMeters = 0;
      const etas: string[] = [];
      let cursor = Date.now();
      (route.legs || []).forEach((leg: any) => {
        totalSec += leg.duration?.value || 0;
        totalMeters += leg.distance?.value || 0;
        cursor += (leg.duration?.value || 0) * 1000;
        etas.push(new Date(cursor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      });
      setRouteInfo({
        order,
        totalDuration: Math.round(totalSec / 60) + " min",
        totalDistance: (totalMeters / 1609.34).toFixed(1) + " mi",
        etas,
        origin: effectiveOrigin,
      });
    } catch (err: any) {
      // Optimization failed or hung — fall back to a plain, unoptimized Maps
      // link rather than leaving the employee with nothing. The button must
      // always produce a usable result.
      console.warn("Route optimization failed — opening unoptimized route instead:", err);
      setRouteLoading(false);
      toast("Couldn't optimize the route — opening it in Google Maps instead", "yellow");
      openPlainMapsRoute(routeStops, origin);
    }
  };

  // Recalculates drive time/distance/ETAs for a manually-reordered stop list —
  // fixed order this time (no optimizeWaypoints), since the whole point of a
  // manual reorder is to override the algorithm's choice.
  const recalcRouteForOrder = (newOrder: Job[]) => {
    if (!settings.googleMapsKey) return;
    const gm = (window as any).google?.maps;
    if (!gm?.DirectionsService) return;
    const svc = new gm.DirectionsService();
    const originStr = typeof routeInfo!.origin === "string" ? routeInfo!.origin : routeInfo!.origin;
    const destination = newOrder[newOrder.length - 1].address;
    const waypoints = newOrder.slice(0, -1).map(j => ({ location: j.address, stopover: true }));
    svc.route(
      { origin: originStr, destination, waypoints, optimizeWaypoints: false, travelMode: gm.TravelMode.DRIVING },
      (result: any, status: string) => {
        if (status !== "OK" || !result?.routes?.[0]) { toast("Couldn't recalculate route", "red"); return; }
        const route = result.routes[0];
        let totalSec = 0, totalMeters = 0;
        const etas: string[] = [];
        let cursor = Date.now();
        (route.legs || []).forEach((leg: any) => {
          totalSec += leg.duration?.value || 0;
          totalMeters += leg.distance?.value || 0;
          cursor += (leg.duration?.value || 0) * 1000;
          etas.push(new Date(cursor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
        });
        setRouteInfo(prev => prev ? {
          ...prev,
          order: newOrder,
          totalDuration: Math.round(totalSec / 60) + " min",
          totalDistance: (totalMeters / 1609.34).toFixed(1) + " mi",
          etas,
        } : prev);
      }
    );
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    if (!routeInfo) return;
    const next = [...routeInfo.order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRouteInfo({ ...routeInfo, order: next }); // optimistic reorder, then refresh ETAs
    recalcRouteForOrder(next);
  };

  const dragStopIndexRef = useRef<number | null>(null);
  const onStopDragStart = (i: number) => { dragStopIndexRef.current = i; };
  const onStopDrop = (i: number) => {
    if (!routeInfo || dragStopIndexRef.current === null || dragStopIndexRef.current === i) return;
    const next = [...routeInfo.order];
    const [moved] = next.splice(dragStopIndexRef.current, 1);
    next.splice(i, 0, moved);
    dragStopIndexRef.current = null;
    setRouteInfo({ ...routeInfo, order: next });
    recalcRouteForOrder(next);
  };

  const openRouteInMaps = () => {
    if (!routeInfo) return;
    const dest = encodeURIComponent(routeInfo.order[routeInfo.order.length - 1].address);
    const waypts = routeInfo.order.slice(0, -1).map(j => encodeURIComponent(j.address)).join("|");
    const originStr = typeof routeInfo.origin === "string" ? routeInfo.origin : `${routeInfo.origin.lat},${routeInfo.origin.lng}`;
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${dest}${waypts ? "&waypoints=" + waypts : ""}&travelmode=driving`, "_blank");
  };

  // Get user location once, then fire drive-time lookups for upcoming jobs
  useEffect(() => {
    if (!settings.googleMapsKey) return;
    navigator.geolocation.getCurrentPosition(pos => {
      userLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      myJobs.filter(j => j.scheduledDate >= todayStr).forEach(j => fetchDriveTime(j.id, j.address));
    }, () => {});
  }, []); // run once on mount

  // Navigate back after job completion, show next-job notification
  // Rolls a completed job's score into the employee's overall rating (simple
  // running average, weighted 75/25 toward history so one bad day can't tank it
  // and one good day can't fully redeem a pattern of lateness).
  const recordJobRating = (job: Job) => {
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    const score = computeJobRatingScore(job);
    const prevScore = (myEmployee as any)?.ratingScore;
    const nextScore = typeof prevScore === "number" ? Math.round(prevScore * 0.75 + score * 0.25) : score;
    (supabase as any).from("employees").update({ ratingScore: nextScore }).eq("id", empId).catch(() => {});
  };

  const handleJobComplete = () => {
    const nextJob = [...myJobs]
      .filter(j => j.id !== selectedJobId && j.scheduledDate >= todayStr && j.status !== "completed")
      .sort((a, b) => {
        const da = a.scheduledDate + (a.scheduledTime || "23:59");
        const db = b.scheduledDate + (b.scheduledTime || "23:59");
        return da.localeCompare(db);
      })[0] ?? null;
    setSelectedJobId(null);
    setTab("jobs");
    setNextJobEta(null);
    if (nextJob) {
      const nc = customers.find(c => c.id === nextJob.customerId);
      const name = nc ? `${nc.firstName} ${nc.lastName}` : "";
      setCompletionNotif({
        message: `Job complete! Next: ${name ? name + " · " : ""}${nextJob.address}`,
        nextJobId: nextJob.id,
      });
      checkNextJobEta(nextJob);
    } else {
      toast("✅ All done! No more jobs today.");
    }
  };

  // Estimates whether the employee will arrive late to the next job based on
  // live drive time from their current location, vs. that job's scheduled start.
  const checkNextJobEta = (nextJob: Job) => {
    const loc = userLocationRef.current;
    if (!loc || !settings.googleMapsKey || !nextJob.scheduledTime) { setNextJobEta(null); return; }
    loadMapsScript(settings.googleMapsKey).then(() => {
      const gm = (window as any).google?.maps;
      if (!gm?.DistanceMatrixService) return;
      const svc = new gm.DistanceMatrixService();
      svc.getDistanceMatrix(
        { origins: [loc], destinations: [nextJob.address], travelMode: gm.TravelMode.DRIVING },
        (result: any, status: string) => {
          if (status !== "OK") return;
          const durSec: number | undefined = result?.rows?.[0]?.elements?.[0]?.duration?.value;
          if (durSec == null) return;
          const arrival = new Date(Date.now() + durSec * 1000);
          const scheduled = new Date(`${nextJob.scheduledDate}T${nextJob.scheduledTime}:00`);
          const lateMinutes = Math.round((arrival.getTime() - scheduled.getTime()) / 60000);
          setNextJobEta({
            jobId: nextJob.id,
            etaTime: arrival.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            lateMinutes,
          });
        }
      );
    });
  };

  const messageNextJobCustomer = (job: Job, lateMinutes: number) => {
    const cust = customers.find(c => c.id === job.customerId);
    if (!cust?.phone) { toast("No phone number on file for this customer", "yellow"); return; }
    const eta = nextJobEta?.etaTime || "shortly";
    const msg = lateMinutes > 0
      ? `Hi ${cust.firstName}, running a few minutes behind — ETA ${eta}. Sorry for the delay!`
      : `Hi ${cust.firstName}, on my way — ETA ${eta}. See you soon!`;
    window.location.href = "sms:" + cust.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(msg);
  };

  const doSignOut = async () => {
    await supabase.auth.signOut();
    setEmpSession(null);
    window.location.hash = "/portal";
  };

  const doRetryLink = async () => {
    if (!empSession) return;
    setRetrying(true);
    const email = empSession.user.email || "";
    const userId = empSession.user.id;
    try {
      // Try by user_id first, then email
      let found: any = null;
      const { data: byId } = await (supabase as any)
        .from("employees").select("*").eq("user_id", userId).maybeSingle();
      if (byId) { found = byId; }
      else {
        const { data: byEmail } = await (supabase as any)
          .from("employees").select("*").ilike("email", email).maybeSingle();
        if (byEmail) {
          found = byEmail;
          // Link user_id for next time
          await (supabase as any).from("employees").update({ user_id: userId }).eq("id", byEmail.id);
        }
      }
      console.log("doRetryLink — found:", JSON.stringify(found));
      if (found) setLocalEmployee(normalizeEmp(found));
      else toast("No employee record found for " + email + ". Ask your manager to add your email.");
    } catch (e) {
      console.error("doRetryLink error:", e);
    }
    setRetrying(false);
  };

  const doForgotPassword = async () => {
    if (!loginEmail.trim()) { setLoginError("Enter your email first"); return; }
    try {
      await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
        redirectTo: `${window.location.origin}${window.location.pathname}#/reset-password`,
      });
      setForgotSent(true);
    } catch { setLoginError("Could not send reset email"); }
  };

  // Create or update a Google Calendar event on the EMPLOYEE'S OWN calendar
  // using their own stored OAuth token, after they accept a job (creates) or
  // complete one (updates the existing event so it reflects the outcome, or
  // creates one if none exists yet). Silently no-ops if they haven't
  // connected Google, their token has expired, or auto-sync is off.
  const syncJobToCalendar = async (job: Job | undefined, opts: { completed?: boolean; silent?: boolean } = {}) => {
    if (!job || !job.scheduledDate || !empSession?.user?.id) return;
    // Auto-sync defaults to on (matches the prior always-sync behavior) but the
    // employee can turn it off in the Google tab — when off, they add jobs to
    // their calendar manually via the per-job "Add to Google Calendar" button.
    if (!autoSyncCalendar) return;
    const empToken = await getValidEmpGoogleToken(empSession.user.id, settings?.googleBackendUrl);
    if (!empToken) return;
    try {
      const timeStr = job.scheduledTime || "09:00";
      const startDt = new Date(`${job.scheduledDate}T${timeStr}:00`);
      const endDt = new Date(startDt.getTime() + (Number(job.duration) || 2) * 3600000);
      const cust = customers.find(c => c.id === job.customerId);
      const custName = cust ? `${cust.firstName} ${cust.lastName}` : "Customer";
      const checklistSummary = [...(job.preChecklist || []), ...(job.duringChecklist || [])]
        .map(i => i.label).join(", ");
      const title = `${opts.completed ? "✓ " : ""}CrewBoss Job: ${custName}${opts.completed ? " (Completed)" : ""}`;
      if (job.googleEventId) {
        await updateGCalEvent(empToken!.token, job.googleEventId, { title, location: job.address, description: checklistSummary });
        if (!opts.silent) toast("📅 Google Calendar event updated");
      } else {
        const evId = await createGCalEvent(empToken!.token, {
          title, start: startDt.toISOString(), end: endDt.toISOString(), location: job.address, description: checklistSummary,
        });
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, googleEventId: evId } : j));
        (supabase as any).from("jobs").update({ googleEventId: evId }).eq("id", job.id).catch(() => {});
        if (!opts.silent) toast("📅 Added to your Google Calendar");
      }
    } catch (e) {
      console.warn("Employee calendar sync failed:", e);
    }
  };
  const syncAcceptedJobToCalendar = (job: Job | undefined) => syncJobToCalendar(job);

  const handleAcceptRequest = async () => {
    if (!requestData || !myEmployee) return;
    try {
      await (supabase as any).from("job_requests")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", requestId);
      if (requestData.job_id) {
        const empId = myEmployee.id;
        const empUserId = (myEmployee as any).user_id;
        const targetJob = jobs.find(j => j.id === requestData.job_id);
        const currentCrew = targetJob?.crew || [];
        if (!crewIncludesEmployee(currentCrew, empId, empUserId)) {
          const newCrew = [...currentCrew, empId];
          console.log("Accepting request job", requestData.job_id, "— crew before:", currentCrew, "after:", newCrew);
          // Optimistic local update
          setJobs(prev => prev.map(j => j.id === requestData.job_id ? { ...j, crew: newCrew } : j));
          // Save MUST be awaited before refetching — otherwise the refetch below can
          // land before this write commits and overwrite the optimistic crew with the
          // still-empty array from Supabase, which is exactly why accepted jobs were
          // vanishing again right after acceptance.
          const saveResult = await (supabase as any).from("jobs").update({ crew: newCrew }).eq("id", requestData.job_id);
          console.log("ACCEPT SAVE RESULT:", saveResult);
        }
        // Confirm against Supabase immediately rather than waiting up to 10s for the
        // next poll — the optimistic setJobs above already updated myJobs for instant
        // UI feedback; this just reconciles with the server-confirmed state right away.
        refetchJobsRef.current().catch(() => {});
        syncAcceptedJobToCalendar(jobs.find(j => j.id === requestData.job_id));
      }
      setRequestDone("accepted");
      toast("Job accepted! You're on the crew. ✓");
    } catch {
      toast("Error accepting request", "red");
    }
  };

  const handleDenyRequest = async () => {
    try {
      await (supabase as any).from("job_requests")
        .update({ status: "denied", denial_reason: denyReason.trim(), responded_at: new Date().toISOString() })
        .eq("id", requestId);
      setRequestDone("denied");
      toast("Request declined.");
    } catch {
      toast("Error declining request", "red");
    }
  };

  const [homeBaseAddress, setHomeBaseAddressState] = useState("");
  const [, setGoogleHydrateTick] = useState(0);
  const [showCanceledJobs, setShowCanceledJobs] = useState(false);
  const [pastCollapsed, setPastCollapsedState] = useState(() => {
    try { const v = localStorage.getItem("smocks.portal.pastCollapsed"); return v === null ? true : v === "1"; } catch { return true; }
  });
  const setPastCollapsed = (v: boolean | ((p: boolean) => boolean)) => setPastCollapsedState(prev => {
    const next = typeof v === "function" ? v(prev) : v;
    try { localStorage.setItem("smocks.portal.pastCollapsed", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });
  const [upcomingCollapsed, setUpcomingCollapsedState] = useState(() => {
    try { return localStorage.getItem("smocks.portal.upcomingCollapsed") === "1"; } catch { return false; }
  });
  const setUpcomingCollapsed = (v: boolean | ((p: boolean) => boolean)) => setUpcomingCollapsedState(prev => {
    const next = typeof v === "function" ? v(prev) : v;
    try { localStorage.setItem("smocks.portal.upcomingCollapsed", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });
  const saveHomeBaseAddress = async (addr: string) => {
    setHomeBaseAddressState(addr);
    try {
      const uid = empSession?.user?.id;
      if (uid) localStorage.setItem("smocks.homeBase." + uid, addr);
    } catch { /* ignore */ }
    try {
      const empId = (myEmployee as any)?.id;
      if (empId) await (supabase as any).from("employees").update({ homeBaseAddress: addr }).eq("id", empId);
    } catch { /* ignore */ }
  };

  // Load home base from localStorage immediately on mount (instant, no Supabase
  // round-trip needed) so it survives a refresh even before myEmployee resolves.
  useEffect(() => {
    const uid = empSession?.user?.id;
    if (!uid) return;
    try {
      const cached = localStorage.getItem("smocks.homeBase." + uid);
      if (cached) setHomeBaseAddressState(cached);
    } catch { /* ignore */ }
  }, [empSession?.user?.id]);

  const toggleAutoSyncCalendar = async () => {
    const next = !autoSyncCalendar;
    setAutoSyncCalendar(next);
    try {
      const empId = (myEmployee as any)?.id;
      if (empId) await (supabase as any).from("employees").update({ autoSyncCalendar: next }).eq("id", empId);
    } catch { /* ignore */ }
  };

  const toggleAvailability = async (dateStr: string) => {
    const next = availability.includes(dateStr)
      ? availability.filter(d => d !== dateStr)
      : [...availability, dateStr];
    setAvailability(next);
    try {
      const empId = (myEmployee as any)?.id || (myEmployee as any)?.user_id;
      if (empId) {
        await (supabase as any).from("employees").update({ availability: next }).eq("id", empId);
      }
    } catch { /* ignore */ }
  };

  const handleInlineAccept = async (req: any) => {
    if (!myEmployee) return;
    try {
      await (supabase as any).from("job_requests")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", req.id);
      if (req.job_id) {
        const empId = myEmployee.id;
        const empUserId = (myEmployee as any).user_id;
        const targetJob = jobs.find(j => j.id === req.job_id);
        const currentCrew = targetJob?.crew || [];
        if (!crewIncludesEmployee(currentCrew, empId, empUserId)) {
          const newCrew = [...currentCrew, empId];
          console.log("Accepting job", req.job_id, "— crew before:", currentCrew, "after:", newCrew);
          // Optimistic local update
          setJobs(prev => prev.map(j => j.id === req.job_id ? { ...j, crew: newCrew } : j));
          // Must await the save before refetching — see handleAcceptRequest for why
          // an un-awaited fire-and-forget write here let the refetch race ahead and
          // clobber the optimistic crew with Supabase's still-stale (empty) row.
          const saveResult = await (supabase as any).from("jobs").update({ crew: newCrew }).eq("id", req.job_id);
          console.log("ACCEPT SAVE RESULT:", saveResult);
        }
        // Confirm against Supabase immediately rather than waiting up to 10s for the
        // next poll — the optimistic setJobs above already updated myJobs for instant
        // UI feedback; this just reconciles with the server-confirmed state right away.
        refetchJobsRef.current().catch(() => {});
        syncAcceptedJobToCalendar(jobs.find(j => j.id === req.job_id));
      }
      setIncomingRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "accepted" } : r));
      toast("Job accepted! You're on the crew. ✓");
    } catch { toast("Error accepting request", "red"); }
  };

  const handleInlineDeny = async (req: any) => {
    try {
      await (supabase as any).from("job_requests")
        .update({ status: "denied", denial_reason: inlineDenyReason.trim(), responded_at: new Date().toISOString() })
        .eq("id", req.id);
      setIncomingRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "denied" } : r));
      setInlineDenyId(null);
      setInlineDenyReason("");
      toast("Request declined.");
    } catch { toast("Error declining request", "red"); }
  };

  const doLogin = async () => {
    console.log("LOGIN START — email:", loginEmail);
    setLoginLoading(true); setLoginError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd });
    console.log("SIGNIN RESULT — error:", error?.message || null, "session user:", data?.session?.user?.id || null);
    setLoginLoading(false);
    if (error) { setLoginError(error.message); return; }

    const session = data.session!;
    const metaRole = session.user.user_metadata?.role;
    const email = session.user.email || "";

    console.log("doLogin: checking email", email, "against employees:", employees.map(e => e.email));
    console.log("doLogin: user metadata role:", metaRole);

    // Anyone who successfully completes signInWithPassword is an email/password user — treat as employee.
    // Google OAuth users cannot reach this path. Never sign them out here.
    const matchedEmployee = employees.find(e => e.email?.toLowerCase() === email.toLowerCase());

    // Cache the employee role now — but only once we actually know this account is an
    // employee (matched an existing record, or about to create one from an invite).
    // Caching unconditionally on any successful sign-in would also tag a non-employee
    // account (e.g. an owner who mistakenly signs into the portal form) as a permanent
    // employee, which is exactly the kind of misclassification that breaks the portal.
    if (matchedEmployee || inviteRecord) {
      try { localStorage.setItem("crew_role_" + session.user.id, "employee"); } catch { /* ignore */ }
    }

    // Repair missing role metadata so App.tsx auth-state-change recognises them on reload
    if (!metaRole) {
      const fixedRole = matchedEmployee
        ? ((matchedEmployee as any).role?.toLowerCase().includes("manager") ? "manager" : "technician")
        : "technician";
      supabase.auth.updateUser({ data: { role: fixedRole } }).catch(() => {});
    }

    // Link the employee record to this Supabase user ID so lookups by user_id work
    if (matchedEmployee && !(matchedEmployee as any).user_id) {
      (supabase as any).from("employees")
        .update({ user_id: session.user.id })
        .eq("id", matchedEmployee.id)
        .then(() => {}).catch(() => {});
    }

    // If they arrived via invite and have no employee record yet, create one now
    let isManager = (matchedEmployee as any)?.role?.toLowerCase?.().includes("manager") || false;
    if (!matchedEmployee && inviteRecord) {
      const authRole = inviteRecord.role?.toLowerCase().includes("manager") ? "manager" : "technician";
      isManager = authRole === "manager";
      const newEmp = {
        firstName: inviteRecord.firstName || "",
        lastName: inviteRecord.lastName || "",
        email: inviteRecord.email || email,
        role: authRole === "manager" ? "Manager" : "Technician",
        hourlyRate: inviteRecord.hourlyRate ?? 0,
        user_id: session.user.id,
        status: "active",
      };
      (supabase as any).from("employees").insert(newEmp).then(() => {}).catch(() => {});
      // Set locally so myEmployee resolves immediately without waiting for parent re-fetch
      setLocalEmployee(normalizeEmp(newEmp));
    }

    refetchEmployees?.();
    console.log("EMP SESSION SET — user:", session.user.id, "matchedEmployee:", matchedEmployee?.id || null, "isManager:", isManager);

    // Managers get the CRM, not the portal — once their role is established, send
    // them to the dashboard. A full reload re-runs App.tsx's session resolution
    // cleanly via resolveUserRole, rather than juggling empSession/hasCrmSession
    // across two components mid-flight.
    if (isManager) {
      try { localStorage.setItem("crew_role_" + session.user.id, "manager"); } catch { /* ignore */ }
      toast("Welcome back! Redirecting to your dashboard…");
      window.location.hash = "/dashboard";
      window.location.reload();
      return;
    }

    setEmpSession(session);
    toast("Welcome back!");
  };

  const doRegister = async () => {
    if (!loginFirst.trim() || !loginLast.trim()) { setLoginError("Enter your full name"); return; }
    if (loginPwd.length < 6) { setLoginError("Password must be at least 6 characters"); return; }
    // Validate invite email matches
    if (inviteCode && inviteRecord && loginEmail.toLowerCase() !== inviteRecord.email.toLowerCase()) {
      setLoginError(`This invite was sent to ${inviteRecord.email}. Please use that email address.`);
      return;
    }
    setLoginLoading(true); setLoginError("");
    const authRole = inviteRecord?.role?.toLowerCase().includes("manager") ? "manager" : "technician";
    const { error } = await supabase.auth.signUp({
      email: loginEmail, password: loginPwd,
      options: { data: { role: authRole, firstName: loginFirst, lastName: loginLast } },
    });
    if (error) { setLoginLoading(false); setLoginError(error.message); return; }
    // Auto sign-in after registration
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd });
    setLoginLoading(false);
    if (!signInErr && signInData.session) {
      const newUserId = signInData.session.user.id;
      const newEmail = signInData.session.user.email || "";

      // Mark invite as used — Supabase first, then localStorage
      if (inviteCode) {
        try {
          await (supabase as any)
            .from("invites")
            .update({ used: true, used_at: new Date().toISOString(), used_by: newUserId })
            .eq("code", inviteCode);
        } catch { /* table may not exist */ }
        try {
          const stored: any[] = JSON.parse(localStorage.getItem("smocks.invites") || "[]");
          localStorage.setItem("smocks.invites", JSON.stringify(
            stored.map(i => i.code === inviteCode ? { ...i, used: true } : i)
          ));
        } catch { /* ignore */ }
      }

      // Link employee record to the new Supabase user ID so email-less lookups work.
      // Try by invite's employee ID first, then fall back to email match.
      const invEmpId = inviteRecord?.employeeId || inviteRecord?.employee_id;
      let linkedEmployee: any = null;
      try {
        if (invEmpId) {
          await (supabase as any).from("employees").update({ user_id: newUserId }).eq("id", invEmpId);
          const { data } = await (supabase as any).from("employees").select("*").eq("id", invEmpId).maybeSingle();
          linkedEmployee = data;
        } else if (newEmail) {
          await (supabase as any).from("employees").update({ user_id: newUserId }).eq("email", newEmail);
          const { data } = await (supabase as any).from("employees").select("*").ilike("email", newEmail).maybeSingle();
          linkedEmployee = data;
        }
      } catch { /* employees table may not have user_id column yet */ }

      // Provide the employee record immediately so myEmployee resolves without waiting for parent re-fetch
      if (linkedEmployee) setLocalEmployee(normalizeEmp(linkedEmployee));

      refetchEmployees?.();

      // Managers get the CRM, not the portal. See doLogin for why a reload (vs.
      // juggling empSession/hasCrmSession across components) is used here.
      const isManager = authRole === "manager" || (linkedEmployee as any)?.role?.toLowerCase?.().includes("manager");
      if (isManager) {
        try { localStorage.setItem("crew_role_" + newUserId, "manager"); } catch { /* ignore */ }
        toast("Account created! Redirecting to your dashboard…");
        window.location.hash = "/dashboard";
        window.location.reload();
        return;
      }

      setEmpSession(signInData.session);
      toast("Welcome! Account created ✓");
    } else {
      toast("Account created! Please sign in.");
      setLoginMode("login");
    }
  };

  // ── Owner view — shown when owner clicks "Team Portal" in sidebar ────────
  if (isOwnerView) {
    return (
      <OwnerTeamPortal
        jobs={jobs}
        employees={employees}
        customers={customers}
        onClose={onClose}
        googleMapsKey={settings?.googleMapsKey || settings?.mapsKey}
      />
    );
  }

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
            <div className="text-sm text-white/50 mt-1">{inviteRecord ? "Create Your Crew Account" : "Employee Portal"}</div>
          </div>

          <div className="space-y-3">
            {/* Invite banner */}
            {inviteRecord && (
              <div className="p-3 rounded-xl bg-green-950/30 border border-green-700/30">
                <div className="text-xs text-green-300 font-semibold mb-0.5">You've been invited!</div>
                <div className="text-xs text-white/50">Create your account below to access your schedule and jobs.</div>
              </div>
            )}
            {inviteCode && !inviteRecord && loginError && (
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-700/30 text-xs text-red-300">{loginError}</div>
            )}
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
            {loginError && !(inviteCode && !inviteRecord) && (
              <div className="p-3 bg-red-950/40 border border-red-700/50 rounded-xl text-sm text-red-300">
                {loginError}
              </div>
            )}
            <GBtn onClick={loginMode === "login" ? doLogin : doRegister}
              disabled={loginLoading || !loginEmail || !loginPwd}
              className="w-full !justify-center !py-3">
              {loginLoading ? "Please wait…" : loginMode === "login" ? "Sign In" : "Create Account"}
            </GBtn>
            {loginMode === "login" && (
              forgotSent ? (
                <div className="text-center text-sm text-green-400 py-1">
                  ✓ Password reset email sent — check your inbox.
                </div>
              ) : (
                <button onClick={doForgotPassword}
                  className="w-full text-center text-xs text-white/30 hover:text-white/60 transition py-1">
                  Forgot password?
                </button>
              )
            )}
            <button onClick={() => { setLoginMode(m => m === "login" ? "register" : "login"); setLoginError(""); setForgotSent(false); }}
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
    console.log("RENDERING PORTAL — blocked: no myEmployee match for", empSession?.user?.email, "employees loaded:", employees.length);
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={40} className="text-yellow-400 mb-4" />
        <div className="text-lg font-bold mb-2">Account Not Linked</div>
        <div className="text-sm text-white/50 mb-4 max-w-xs">
          Your account ({empSession.user.email}) isn't linked to an employee record yet.
          {" "}If you just registered, tap Retry — it may take a moment to sync.
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <GBtn onClick={doRetryLink} disabled={retrying} className="w-full justify-center">
            {retrying ? "Checking…" : "Retry"}
          </GBtn>
          <GBtn onClick={doSignOut} variant="ghost" className="w-full justify-center">
            <LogOut size={14} className="inline mr-1.5" />Sign Out
          </GBtn>
        </div>
      </div>
    );
  }

  // ── Job Request Page ──────────────────────────────────────────────────────
  if (requestId && empSession && myEmployee) {
    if (requestDone) {
      const reqJob = requestData ? jobs.find(j => j.id === requestData.job_id) : null;
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle size={52} className={(requestDone === "accepted" ? "text-green-400" : "text-white/30") + " mb-4"} />
          <div className="text-xl font-bold mb-2">
            {requestDone === "accepted" ? "Job Accepted!" : "Request Declined"}
          </div>
          {requestDone === "accepted" && reqJob && (
            <div className="text-sm text-white/60 mb-1">
              {reqJob.scheduledDate}{reqJob.scheduledTime ? " at " + reqJob.scheduledTime : ""}
            </div>
          )}
          <div className="text-sm text-white/50 mb-8 max-w-xs">
            {requestDone === "accepted"
              ? "You've been added to the crew. The job appears in your schedule."
              : "The owner has been notified. You can update your availability in the Calendar tab."}
          </div>
          <GBtn onClick={() => { setRequestId(null); setRequestDone(null); }}>Go to My Portal</GBtn>
        </div>
      );
    }
    if (requestLoading) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (!requestData) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle size={40} className="text-red-400 mb-4" />
          <div className="text-lg font-bold mb-2">Request Not Found</div>
          <div className="text-sm text-white/50 mb-6">This link may have expired or already been used.</div>
          <GBtn onClick={() => setRequestId(null)} variant="ghost">Go to Portal</GBtn>
        </div>
      );
    }
    if (requestData.status !== "pending") {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle size={40} className={(requestData.status === "accepted" ? "text-green-400" : "text-red-400") + " mb-4"} />
          <div className="text-lg font-bold mb-2 capitalize">Already {requestData.status}</div>
          <div className="text-sm text-white/50 mb-6">You already responded to this job request.</div>
          <GBtn onClick={() => setRequestId(null)} variant="ghost">Go to Portal</GBtn>
        </div>
      );
    }
    const reqJob = jobs.find(j => j.id === requestData.job_id);
    const reqCustomer = reqJob ? customers.find(c => c.id === reqJob.customerId) : null;
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <header className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3">
          <div className="font-semibold text-center">Job Request</div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto space-y-4">
          <Glass className="p-5 !bg-blue-950/20 !border-blue-700/30">
            <div className="text-xs text-blue-300 uppercase tracking-wider font-semibold mb-3">
              You've been requested for a job
            </div>
            <div className="space-y-2.5">
              {reqJob && (
                <>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin size={14} className="text-white/40 flex-shrink-0 mt-0.5" />
                    <span className="font-semibold">{reqJob.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} className="text-white/40 flex-shrink-0" />
                    <span>{reqJob.scheduledDate}{reqJob.scheduledTime ? " at " + reqJob.scheduledTime : ""}</span>
                  </div>
                </>
              )}
              {reqCustomer && (
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-white/40 flex-shrink-0" />
                  <span>{reqCustomer.firstName} {reqCustomer.lastName}</span>
                </div>
              )}
              {reqJob && reqJob.amount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign size={14} className="text-white/40 flex-shrink-0" />
                  <span className="text-green-400 font-semibold">{fmt(reqJob.amount)}</span>
                </div>
              )}
            </div>
            {requestData.message && (
              <div className="mt-4 p-3 rounded-xl bg-white/5 text-sm text-white/70 italic border border-white/10">
                "{requestData.message}"
              </div>
            )}
          </Glass>

          {showDenyForm ? (
            <div className="space-y-3">
              <div className="text-sm text-white/60">Reason for declining (optional):</div>
              <GTxt rows={3} value={denyReason} onChange={e => setDenyReason(e.target.value)}
                placeholder="e.g. Already booked, unavailable that day…" />
              <div className="flex gap-3">
                <GBtn variant="danger" onClick={handleDenyRequest} className="flex-1 !justify-center">
                  Confirm Decline
                </GBtn>
                <GBtn variant="ghost" onClick={() => setShowDenyForm(false)} className="!px-4">
                  Cancel
                </GBtn>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <GBtn onClick={handleAcceptRequest}
                className="flex-1 !justify-center !py-3.5 !bg-gradient-to-r !from-green-700 !to-green-900 !border-green-600/50">
                <CheckCircle size={16} />Accept Job
              </GBtn>
              <GBtn variant="danger" onClick={() => setShowDenyForm(true)}
                className="flex-1 !justify-center !py-3.5">
                <X size={16} />Decline
              </GBtn>
            </div>
          )}

          <button onClick={() => setRequestId(null)}
            className="w-full text-center text-xs text-white/30 hover:text-white/60 transition py-2">
            Skip — go to portal
          </button>
        </div>
      </div>
    );
  }

  // ── Selected job detail ───────────────────────────────────────────────────
  if (selectedJobId) {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) { setSelectedJobId(null); return null; }
    const customer = customers.find(c => c.id === job.customerId);
    // Next job today (or soonest after) that isn't this one, completed, or
    // cancelled — shown on the post-completion summary with directions.
    const nextJob = myJobs
      .filter(j => j.id !== job.id && j.status !== "completed" && j.status !== "cancelled" && j.scheduledDate >= todayStr)
      .sort((a, b) => (a.scheduledDate + (a.scheduledTime || "23:59")).localeCompare(b.scheduledDate + (b.scheduledTime || "23:59")))[0] || null;
    const nextJobCustomer = nextJob ? customers.find(c => c.id === nextJob.customerId) || null : null;
    return (
      <JobDetailView
        job={job}
        customer={customer}
        onBack={() => setSelectedJobId(null)}
        onUpdateJob={patch => updateJob(selectedJobId, patch)}
        toast={toast}
        companyName={settings.companyName || "Smock's Pressure Washing"}
        onComplete={handleJobComplete}
        perms={perms}
        maxLunchMinutes={settings.maxLunchMinutes ?? 30}
        onJobCompleted={(j: Job) => { recordJobRating(j); syncJobToCalendar(j, { completed: true, silent: true }); }}
        googleMapsKey={settings.googleMapsKey || settings.mapsKey}
        paidLunchBreaks={!!settings.paidLunchBreaks}
        signOffDisclaimer={job.signOffTerms || settings.termsAndConditions || settings.terms || ""}
        settings={settings}
        setEstimates={setEstimates}
        nextJob={nextJob}
        nextJobCustomer={nextJobCustomer}
      />
    );
  }

  // ── Portal ────────────────────────────────────────────────────────────────
  const role = empSession.user.user_metadata?.role || "technician";

  const toGCalUrl = (job: Job) => {
    const d = job.scheduledDate.replace(/-/g, "");
    const next = new Date(job.scheduledDate + "T12:00:00");
    next.setDate(next.getDate() + 1);
    const e = next.toISOString().slice(0, 10).replace(/-/g, "");
    const title = encodeURIComponent(`Pressure Wash: ${job.address}`);
    const loc = encodeURIComponent(job.address);
    const notes = encodeURIComponent(job.notes || "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${d}/${e}&location=${loc}&details=${notes}`;
  };

  const notifyOwnerArrival = (job: Job, cust: Customer | undefined) => {
    const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
    if (!ownerEmail) return;
    const html = emailShell(settings?.companyName || "Smock's Pressure Washing", "Crew Arrived", `<p>${myEmployee.firstName} ${myEmployee.lastName} has arrived at a job:</p><ul><li><b>Address:</b> ${job.address}</li>${cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : ""}<li><b>Time:</b> ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</li></ul>`);
    sendEmail(settings, { to: ownerEmail, subject: `${myEmployee.firstName} arrived — ${job.address}`, body: html }).catch(() => {});
  };

  const JobCard = ({ job }: { job: Job }) => {
    const customer = customers.find(c => c.id === job.customerId);
    const preItems = job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS;
    const postItems = job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS;
    const allItems = [...preItems, ...(job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS), ...postItems];
    const doneCount = allItems.filter(i => i.done).length;

    const clockInCard = (e: React.MouseEvent) => {
      e.stopPropagation();
      updateJob(job.id, { clockInAt: Date.now(), status: "in_progress" });
      toast("Clocked in ✓");
    };
    const clockOutCard = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!job.clockInAt) return;
      const lunchMs = settings.paidLunchBreaks ? 0 : (job.lunchMinutes || 0) * 60000;
      const hrs = Math.round((Date.now() - job.clockInAt - lunchMs) / 36000) / 100;
      updateJob(job.id, { clockInAt: null, lunchStartAt: null, loggedHours: Math.round(((Number(job.loggedHours) || 0) + hrs) * 100) / 100 });
      toast(`+${hrs}h logged`);
    };
    const takeLunchCard = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (job.lunchStartAt) {
        const mins = Math.round((Date.now() - job.lunchStartAt) / 60000);
        updateJob(job.id, { lunchStartAt: null, lunchMinutes: (Number(job.lunchMinutes) || 0) + mins });
        toast(`Back from break — +${mins}m logged`);
      } else {
        updateJob(job.id, { lunchStartAt: Date.now() });
        toast("Break started 🍽️");
      }
    };
    const arriveCard = (e: React.MouseEvent) => {
      e.stopPropagation();
      updateJob(job.id, { arrivedAt: Date.now() });
      toast("Marked as arrived ✓ — owner notified");
      const cust = customers.find(c => c.id === job.customerId);
      notifyOwnerArrival?.(job, cust);
    };

    const lunchMsCard = settings.paidLunchBreaks ? 0 : (job.lunchMinutes || 0) * 60000;
    const elapsedSec = job.clockInAt ? Math.max(0, Math.floor(((job.lunchStartAt || Date.now()) - job.clockInAt - lunchMsCard) / 1000)) : 0;
    const timerDisplay = job.clockInAt
      ? [Math.floor(elapsedSec / 3600), Math.floor((elapsedSec % 3600) / 60), elapsedSec % 60].map(n => String(n).padStart(2, "0")).join(":")
      : null;

    const isNextUp = job.id === completionNotif?.nextJobId;
    const isOverScheduleCard = !!(job.clockInAt && job.duration && (Date.now() - job.clockInAt) / 3600000 > Number(job.duration));
    const isCompletedCard = job.status === "completed";
    return (
      <div
        className={"rounded-2xl border transition " + (isCompletedCard ? "bg-white/[0.02] border-white/5 opacity-60" : isOverScheduleCard ? "bg-yellow-950/15 border-yellow-700/40" : job.clockInAt ? "bg-green-950/10 border-green-700/30" : isNextUp ? "bg-blue-950/15 border-blue-600/40" : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-red-600/20")}
      >
        {isCompletedCard && (
          <div className="px-4 pt-2.5 pb-0">
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide flex items-center gap-1"><CheckCircle size={11} />Completed</span>
          </div>
        )}
        {isOverScheduleCard && (
          <div className="px-4 pt-2.5 pb-0">
            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wide flex items-center gap-1"><AlertCircle size={10} />Running over schedule</span>
          </div>
        )}
        {isNextUp && !isOverScheduleCard && (
          <div className="px-4 pt-2.5 pb-0">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide animate-pulse">▶ Up Next</span>
          </div>
        )}
        {/* Clickable main area */}
        <button onClick={() => setSelectedJobId(job.id)} className="w-full text-left p-4 pb-3">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{job.address}</div>
              {customer && (
                <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap">
                  <span>{customer.firstName} {customer.lastName}</span>
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/80 hover:text-blue-300 flex items-center gap-0.5">
                      <Phone size={9} />{customer.phone}
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className={"text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 " +
              (job.status === "completed" ? "bg-green-900/40 text-green-300" :
               job.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
               "bg-blue-900/40 text-blue-300")}>
              {(job.status || "").replace("_", " ")}
            </div>
          </div>
          <div className="text-xs text-white/40">
            {job.scheduledDate}{job.scheduledTime ? " · " + job.scheduledTime : ""}
            {job.duration ? <span className="ml-2 text-white/50">{formatEstDuration(job.duration)}</span> : null}
            {job.loggedHours ? <span className="ml-2 text-white/50">{job.loggedHours}h logged</span> : null}
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
        {/* Actions row: Directions + Clock in/out */}
        <div className="px-4 pb-3 flex items-center gap-2 border-t border-white/5 pt-2.5">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`}
            target="_blank" rel="noreferrer"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-300 transition flex-shrink-0">
            <Navigation size={10} />Directions
          </a>
          {driveTimes[job.id] && (
            <span className="text-[10px] text-white/40 flex-shrink-0">🚗 ~{driveTimes[job.id]}</span>
          )}
          {!job.arrivedAt && job.status !== "completed" && (
            <button onClick={arriveCard}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-[10px] font-semibold transition flex-shrink-0">
              <MapPin size={10} />I've Arrived
            </button>
          )}
          <div className="flex-1" />
          {perms.can_clock_in ? (
            job.clockInAt ? (
              <>
                {job.lunchStartAt ? (
                  <button onClick={takeLunchCard}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-yellow-700 hover:bg-yellow-600 text-black text-[10px] font-bold transition">
                    🍽️ End Break
                  </button>
                ) : (
                  <button onClick={takeLunchCard}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 text-[10px] font-semibold transition">
                    🍽️ Lunch
                  </button>
                )}
                <div className="font-mono text-sm font-bold text-green-400 animate-pulse">{timerDisplay}</div>
                <button onClick={clockOutCard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-700/40 text-red-300 text-xs font-semibold transition">
                  <Square size={11} />Clock Out
                </button>
              </>
            ) : (
              job.status === "completed"
                ? <div className="text-xs text-white/30">Job complete</div>
                : (
                  <button onClick={clockInCard}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-950/50 hover:bg-green-900/60 border border-green-700/40 text-green-300 text-xs font-semibold transition">
                    <Play size={11} />Clock In
                  </button>
                )
            )
          ) : (
            job.status === "completed"
              ? <div className="text-xs text-white/30">Job complete</div>
              : <div className="text-xs text-white/30">{job.loggedHours ? `${job.loggedHours}h logged` : ""}</div>
          )}
        </div>
        <div className="px-4 pb-3">
          <button onClick={() => setSelectedJobId(job.id)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold transition">
            <ChevronRight size={12} />View Details
          </button>
        </div>
      </div>
    );
  };

  console.log("RENDERING PORTAL — employee:", myEmployee.firstName, myEmployee.lastName, "myJobs:", myJobs.length, "tab:", tab);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        {/* CrewBoss brand */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-900/40">
            <span className="text-[11px] font-black text-white tracking-tight">CB</span>
          </div>
          <span className="font-bold text-sm text-white tracking-tight">CrewBoss</span>
        </div>
        {/* Employee info + actions */}
        <div className="flex items-center gap-2.5">
          {activeClockJobs.length > 0 && (
            <div className="relative">
              <button
                onClick={() => activeClockJobs.length > 1 ? setActiveJobMenuOpen(o => !o) : setSelectedJobId(activeClockJob.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-green-950/40 border border-green-700/40 text-green-300 text-[11px] font-semibold transition hover:bg-green-900/50"
              >
                <span className="relative flex items-center justify-center w-2 h-2 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="hidden sm:inline">Active Job{activeClockJobs.length > 1 ? "s (" + activeClockJobs.length + ")" : ""}</span>
                <span className="font-mono">{formatElapsed(activeClockJob.clockInAt!)}</span>
              </button>
              {activeJobMenuOpen && activeClockJobs.length > 1 && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-xl bg-black border border-white/10 shadow-2xl overflow-hidden z-30">
                  {activeClockJobs.map(j => {
                    const c = customers.find(x => x.id === j.customerId);
                    return (
                      <button key={j.id} onClick={() => { setSelectedJobId(j.id); setActiveJobMenuOpen(false); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/10 transition border-b border-white/5 last:border-0">
                        <div className="text-xs font-semibold truncate text-white">{j.address}</div>
                        <div className="text-[10px] text-white/40 flex items-center gap-1.5">
                          {c && <span>{c.firstName} {c.lastName}</span>}
                          <span className="font-mono text-green-400">{formatElapsed(j.clockInAt!)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="text-right hidden xs:block">
            <div className="text-xs font-semibold text-white/80 leading-tight">{myEmployee.firstName} {myEmployee.lastName}</div>
            <div className="text-[10px] text-white/40 capitalize leading-tight">{myEmployee.role}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700/60 to-red-900/60 border border-red-700/30 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {myEmployee.firstName?.[0] || "?"}{myEmployee.lastName?.[0] || ""}
          </div>
          <button onClick={doSignOut} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition flex-shrink-0" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {completionNotif && (() => {
          const nextJob = completionNotif.nextJobId ? jobs.find(j => j.id === completionNotif.nextJobId) : null;
          const cust = nextJob ? customers.find(c => c.id === nextJob.customerId) : null;
          const eta = nextJobEta?.jobId === nextJob?.id ? nextJobEta : null;
          const isLate = eta && eta.lateMinutes > 5;
          return (
            <div className="px-4 pt-4 max-w-lg mx-auto">
              <div className="p-3 rounded-xl bg-green-950/40 border border-green-700/40">
                <div className="flex items-center gap-3">
                  <span className="text-lg flex-shrink-0">✅</span>
                  <div className="flex-1 text-sm text-green-300 min-w-0">{completionNotif.message}</div>
                  <button onClick={() => setCompletionNotif(null)} className="text-white/30 hover:text-white/60 transition flex-shrink-0">
                    <X size={14} />
                  </button>
                </div>
                {nextJob && (
                  <div className="mt-2 pt-2 border-t border-green-700/20 space-y-2">
                    {eta && (
                      <div className={"text-xs font-semibold " + (isLate ? "text-yellow-400" : "text-green-400")}>
                        {isLate
                          ? `⚠️ Running ${eta.lateMinutes} min behind — ETA ${eta.etaTime}`
                          : `You're on schedule! ETA ${eta.etaTime}${nextJob.scheduledTime ? " · next job at " + nextJob.scheduledTime : ""}`}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextJob.address)}`} target="_blank" rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-xs font-semibold transition">
                        <Navigation size={11} />Directions
                      </a>
                      {cust?.phone && (
                        <button onClick={() => messageNextJobCustomer(nextJob, eta?.lateMinutes || 0)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/70 text-xs font-semibold transition">
                          Message {cust.firstName}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        <div className="p-4 max-w-lg mx-auto space-y-4">

          {/* Today tab */}
          {tab === "today" && <>
            {/* Welcome header */}
            <div className="pb-1">
              <div className="text-xl font-bold text-white">Welcome, {myEmployee.firstName}!</div>
              <div className="text-sm text-white/50 mt-0.5">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
            </div>

            {/* Start My Day — overall work-hours clock, separate from clocking
                into an individual job (job clock-in/out tracks time per stop;
                this tracks the whole shift). */}
            {(() => {
              const dayClockInAt = optimisticDayClockInAt !== undefined ? optimisticDayClockInAt : (myEmployee as any)?.dayClockInAt;
              const empId = (myEmployee as any)?.id;
              const sendEndOfDaySummary = async () => {
                const todayStr = today();
                const todaysJobs = myJobs.filter(j => j.scheduledDate === todayStr);
                const completedToday = todaysJobs.filter(j => j.status === "completed");
                const shiftHours = dayClockInAt ? Math.round(((Date.now() - dayClockInAt) / 3600000) * 100) / 100 : 0;
                const loggedHoursToday = Math.round(todaysJobs.reduce((s, j) => s + (Number(j.loggedHours) || 0), 0) * 100) / 100;
                const hours = loggedHoursToday > 0 ? loggedHoursToday : shiftHours;
                const pay = Math.round(hours * (myEmployee?.hourlyRate || 0) * 100) / 100;
                const allCk = todaysJobs.flatMap(j => [...(j.preChecklist || []), ...(j.duringChecklist || []), ...(j.postChecklist || []), ...(j.checklist || [])]);
                const ckDone = allCk.filter((c: any) => c.done).length;
                const ckRate = allCk.length > 0 ? Math.round((ckDone / allCk.length) * 100) : 100;
                const revenueToday = completedToday.reduce((s, j) => s + (Number(j.amount) || 0), 0);

                const empName = `${myEmployee.firstName} ${myEmployee.lastName || ""}`.trim();
                const summaryRows = `
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Jobs completed</span><strong>${completedToday.length}</strong></div>
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Hours worked</span><strong>${hours}h</strong></div>
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Estimated pay</span><strong>${fmt(pay)}</strong></div>
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Checklist completion</span><strong>${ckRate}%</strong></div>
                `;
                const companyName = settings?.companyName || "Smock's Pressure Washing";

                if (myEmployee?.email) {
                  sendEmail(settings as any, { to: myEmployee.email, subject: `Your day summary — ${todayStr}`, body: emailShell(companyName, "End of Day Summary", `<p>Nice work today, ${myEmployee.firstName}!</p>${summaryRows}`) }).catch(() => {});
                }
                const ownerEmail = settings?.myEmail || settings?.companyEmail;
                if (ownerEmail) {
                  sendEmail(settings as any, { to: ownerEmail, subject: `Day summary — ${empName} — ${todayStr}`, body: emailShell(companyName, `Day Summary — ${empName}`, `${summaryRows}<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Revenue today (this employee)</span><strong>${fmt(revenueToday)}</strong></div>`) }).catch(() => {});
                }
              };
              const toggleDay = async () => {
                if (!empId) return;
                const endingDay = !!dayClockInAt;
                const nextVal = endingDay ? null : Date.now();
                // Flip immediately — a Supabase update() call resolves with an
                // {error} object on a 400 rather than throwing, so a try/catch
                // around it alone was silently swallowing real failures (the
                // success toast fired and refetchEmployees() then reverted the
                // UI right back since the row was never actually updated).
                setOptimisticDayClockInAt(nextVal);
                if (endingDay) sendEndOfDaySummary();
                try {
                  const result = await (supabase as any).from("employees").update({ dayClockInAt: nextVal }).eq("id", empId);
                  if (result?.error) {
                    toast("Saved locally, but couldn't sync to the server: " + result.error.message, "red");
                  } else {
                    refetchEmployees?.();
                    toast(endingDay ? "Day ended ✓ — summary emailed" : "Day started — have a great shift!");
                  }
                } catch (e: any) {
                  toast("Saved locally, but couldn't sync to the server: " + (e?.message || "unknown error"), "red");
                }
              };
              const locationSharing = !!(myEmployee as any)?.locationSharing;
              const toggleLocationSharing = async () => {
                if (!empId) return;
                try {
                  const result = await (supabase as any).from("employees").update({ locationSharing: !locationSharing }).eq("id", empId);
                  if (result?.error) { toast("Failed to save — " + result.error.message, "red"); return; }
                  refetchEmployees?.();
                  toast(!locationSharing ? "Location sharing on — owner can see you while clocked in" : "Location sharing off");
                } catch (e: any) { toast("Failed to save — " + (e?.message || "try again"), "red"); }
              };
              return (
                <>
                  <button onClick={toggleDay} className={"w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition active:scale-95 " + (dayClockInAt ? "bg-green-900/40 border-2 border-green-500/60 text-green-300" : "bg-red-700/40 border-2 border-red-500/60 text-white hover:bg-red-700/60")}>
                    <Clock size={16} />
                    {dayClockInAt ? `On the clock since ${new Date(dayClockInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · Tap to End My Day` : "Start My Day"}
                  </button>
                  <button onClick={toggleLocationSharing} className={"w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition " + (locationSharing ? "bg-blue-900/30 border border-blue-500/40 text-blue-300" : "bg-white/5 border border-white/10 text-white/50")}>
                    <MapPin size={12} />
                    {locationSharing ? "Sharing my location with owner" : "Share My Location (off)"}
                  </button>
                </>
              );
            })()}

            {/* New Assignment banner — recently crew-assigned jobs the
                employee hasn't acknowledged yet. */}
            {(() => {
              const empId = (myEmployee as any)?.id;
              if (!empId) return null;
              let dismissed: string[] = [];
              try { dismissed = JSON.parse(localStorage.getItem("smocks.dismissedAssignments") || "[]"); } catch { /* ignore */ }
              const newAssignments = myJobs.filter(j => {
                const at = j.crewAssignedAt?.[empId];
                return at && Date.now() - at < 24 * 3600000 && !dismissed.includes(`${j.id}:${at}`);
              });
              if (newAssignments.length === 0) return null;
              const dismiss = (j: Job) => {
                const key = `${j.id}:${j.crewAssignedAt?.[empId]}`;
                const next = [...dismissed, key];
                try { localStorage.setItem("smocks.dismissedAssignments", JSON.stringify(next)); } catch { /* ignore */ }
                setCardTick(t => t + 1);
              };
              return (
                <div className="space-y-2">
                  {newAssignments.map(j => {
                    const cust = customers.find(c => c.id === j.customerId);
                    return (
                      <div key={j.id} className="flex items-center gap-3 p-3 rounded-2xl bg-blue-950/30 border border-blue-600/40">
                        <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0"><Bell size={14} className="text-blue-300" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-blue-200">New Assignment</div>
                          <div className="text-xs text-white/60 truncate">{j.scheduledDate}{j.scheduledTime ? ` · ${j.scheduledTime}` : ""} — {cust ? `${cust.firstName} ${cust.lastName}` : j.address}</div>
                        </div>
                        <button onClick={() => dismiss(j)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white flex-shrink-0">Got it</button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Weekly overview mini-calendar */}
            <div className="flex items-center justify-between gap-1.5">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - d.getDay() + i);
                const dStr = d.toISOString().slice(0, 10);
                const isToday = dStr === todayStr;
                const hasJob = myJobs.some(j => j.scheduledDate === dStr);
                return (
                  <button key={dStr} onClick={() => { setCalSelectedDate(dStr); setTab("calendar"); }}
                    className={"flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border transition " + (isToday ? "bg-red-950/30 border-red-700/40" : "bg-white/5 border-white/5 hover:bg-white/10")}>
                    <div className="text-[9px] text-white/40 uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })[0]}</div>
                    <div className={"text-xs font-bold " + (isToday ? "text-red-300" : "text-white/70")}>{d.getDate()}</div>
                    <div className={"w-1.5 h-1.5 rounded-full " + (hasJob ? "bg-blue-400" : "bg-transparent")} />
                  </button>
                );
              })}
            </div>

            {/* Quick actions */}
            {(() => {
              const quickJob = activeClockJob || todayJobs[0] || upNextJob;
              const goToQuickJob = () => { if (quickJob) { setSelectedJobId(quickJob.id); setTab("jobs"); } };
              return (
                <div className="flex gap-2">
                  <button onClick={goToQuickJob} disabled={!quickJob}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-green-900/30 hover:bg-green-800/40 border border-green-700/30 text-green-300 text-xs font-semibold transition disabled:opacity-30">
                    <Play size={12} />Start Job
                  </button>
                  <button onClick={goToQuickJob} disabled={!quickJob}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-blue-900/30 hover:bg-blue-800/40 border border-blue-700/30 text-blue-300 text-xs font-semibold transition disabled:opacity-30">
                    <Camera size={12} />Upload Photo
                  </button>
                  <button onClick={goToQuickJob} disabled={!quickJob}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-purple-900/30 hover:bg-purple-800/40 border border-purple-700/30 text-purple-300 text-xs font-semibold transition disabled:opacity-30">
                    <PenLine size={12} />Get Signature
                  </button>
                </div>
              );
            })()}

            {/* Route optimization for today's jobs */}
            {todayJobs.filter(j => j.status !== "completed").length > 1 && (
              <Glass className="p-4 !bg-black/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Navigation size={14} className="text-blue-400 flex-shrink-0" />
                    <div className="text-sm font-semibold truncate">Today's Route</div>
                  </div>
                  <button onClick={optimizeRoute} disabled={routeLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-xs font-semibold transition disabled:opacity-40 flex-shrink-0">
                    <Route size={12} />{routeLoading ? "Optimizing…" : "Route"}
                  </button>
                </div>
                {routeInfo && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-4 text-xs text-white/50">
                      <span>🚗 <span className="text-white/80 font-semibold">{routeInfo.totalDistance}</span></span>
                      <span>⏱ <span className="text-white/80 font-semibold">{routeInfo.totalDuration}</span> drive time</span>
                    </div>
                    <div className="text-[9px] text-white/30">Drag a stop, or use the arrows, to reorder manually</div>
                    <div className="space-y-1">
                      {routeInfo.order.map((j, i) => {
                        const c = customers.find(x => x.id === j.customerId);
                        return (
                          <div key={j.id}
                            draggable
                            onDragStart={() => onStopDragStart(i)}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => onStopDrop(i)}
                            className="flex items-center gap-2 text-xs p-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/5 transition">
                            <span className="w-5 h-5 rounded-full bg-blue-900/50 text-blue-300 flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                            <span className="flex-1 truncate text-white/70">{j.address}{c ? " · " + c.firstName + " " + c.lastName : ""}</span>
                            <span className="text-white/40 flex-shrink-0">ETA {routeInfo.etas[i]}</span>
                            <div className="flex flex-col flex-shrink-0">
                              <button onClick={() => moveStop(i, -1)} disabled={i === 0} className="text-white/30 hover:text-white disabled:opacity-20 leading-none">▲</button>
                              <button onClick={() => moveStop(i, 1)} disabled={i === routeInfo.order.length - 1} className="text-white/30 hover:text-white disabled:opacity-20 leading-none">▼</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={openRouteInMaps}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white text-gray-900 text-xs font-semibold mt-2 hover:bg-gray-50 transition">
                      <Navigation size={12} />Open Route in Google Maps
                    </button>
                  </div>
                )}
              </Glass>
            )}

            {/* Incoming job requests */}
            {(() => {
              const pending = incomingRequests.filter(r => r.status === "pending");
              const responded = incomingRequests.filter(r => r.status !== "pending").slice(0, 3);
              if (incomingLoading) return null;
              if (incomingRequests.length === 0) return null;
              return (
                <div>
                  {pending.length > 0 && (
                    <div className="mb-1 flex items-center gap-2">
                      <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Incoming Requests</div>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-600 text-[10px] font-bold text-black">{pending.length}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {pending.map(req => {
                      const reqJob = jobs.find(j => j.id === req.job_id);
                      const reqCust = reqJob ? customers.find(c => c.id === reqJob.customerId) : null;
                      return (
                        <div key={req.id} className="rounded-2xl bg-yellow-950/20 border border-yellow-700/30 overflow-hidden">
                          <div className="p-3">
                            <div className="flex items-start gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                {reqJob && <div className="font-semibold text-sm truncate">{reqJob.address}</div>}
                                <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5 flex-wrap">
                                  {reqJob && <span>📅 {reqJob.scheduledDate}{reqJob.scheduledTime ? " · " + reqJob.scheduledTime : ""}</span>}
                                  {reqCust && <span>👤 {reqCust.firstName} {reqCust.lastName}</span>}
                                  {reqJob && reqJob.amount > 0 && <span className="text-green-400 font-semibold">{fmt(reqJob.amount)}</span>}
                                </div>
                                {req.message && <div className="mt-1.5 text-xs text-white/60 italic bg-white/5 px-2 py-1 rounded-lg">"{req.message}"</div>}
                              </div>
                            </div>
                            {inlineDenyId === req.id ? (
                              <div className="space-y-2">
                                <textarea value={inlineDenyReason} onChange={e => setInlineDenyReason(e.target.value)}
                                  placeholder="Reason (optional)…" rows={2}
                                  className="w-full bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none resize-none" />
                                <div className="flex gap-2">
                                  <button onClick={() => handleInlineDeny(req)}
                                    className="flex-1 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold transition">
                                    Confirm Decline
                                  </button>
                                  <button onClick={() => { setInlineDenyId(null); setInlineDenyReason(""); }}
                                    className="px-3 py-2 rounded-xl bg-white/5 text-white/50 text-xs transition">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => handleInlineAccept(req)}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-white text-xs font-bold transition">
                                  <CheckCircle size={13} />Accept
                                </button>
                                <button onClick={() => setInlineDenyId(req.id)}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-700/40 text-red-300 text-xs font-semibold transition">
                                  <X size={13} />Decline
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {responded.length > 0 && (
                      <div>
                        <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5 mt-3">Responded</div>
                        <div className="space-y-1.5">
                          {responded.map(req => {
                            const reqJob = jobs.find(j => j.id === req.job_id);
                            return (
                              <div key={req.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/5">
                                <div className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + (req.status === "accepted" ? "bg-green-400" : "bg-red-400/60")} />
                                <div className="flex-1 min-w-0 text-xs text-white/50 truncate">{reqJob?.address || "Job"}</div>
                                <div className={"text-[10px] font-semibold capitalize " + (req.status === "accepted" ? "text-green-400" : "text-red-400/70")}>{req.status}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
              <Glass className="p-3 !bg-white/5 text-center">
                <div className="text-xl font-black text-white">{weekHours.toFixed(1)}<span className="text-[11px] font-normal text-white/40">h</span></div>
                <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Hours This<br/>Week</div>
              </Glass>
              <Glass className="p-3 !bg-white/5 text-center">
                <div className="text-xl font-black text-white">{weekJobsDone}</div>
                <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Jobs<br/>Done</div>
              </Glass>
              {perms.can_view_pay ? (
                <Glass className="p-3 !bg-green-950/20 !border-green-700/30 text-center">
                  <div className="text-xl font-black text-green-400">{fmt(weekPay)}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Est.<br/>Pay</div>
                </Glass>
              ) : (
                <Glass className="p-3 !bg-blue-950/20 !border-blue-700/30 text-center">
                  <div className="text-xl font-black text-blue-400">{todayJobs.length}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Today's<br/>Jobs</div>
                </Glass>
              )}
            </div>

            {/* Up Next highlight (only when next job is a future date, not today) */}
            {upNextJob && upNextJob.scheduledDate !== todayStr && (
              <div className="relative pt-3">
                <div className="absolute top-0 left-3 z-10 px-2.5 py-0.5 rounded-full bg-red-600 text-[10px] font-bold text-white uppercase tracking-wide shadow">
                  Up Next
                </div>
                <Glass className="p-4 !bg-blue-950/20 !border-blue-700/30">
                  <div className="font-semibold text-sm">{upNextJob.address}</div>
                  {upNextCustomer && <div className="text-xs text-white/50 mt-0.5">{upNextCustomer.firstName} {upNextCustomer.lastName}</div>}
                  <div className="text-xs text-white/40 mt-1">
                    {upNextJob.scheduledDate}{upNextJob.scheduledTime ? " · " + upNextJob.scheduledTime : ""}
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(upNextJob.address)}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 transition">
                    <Navigation size={11} />Get Directions
                  </a>
                </Glass>
              </div>
            )}

            {/* Today's jobs */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                <span>Today's Jobs</span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{todayJobs.length}</span>
              </div>
              {todayJobs.length > 0 && (() => {
                const completedCount = todayJobs.filter(j => j.status === "completed").length;
                const pct = Math.round((completedCount / todayJobs.length) * 100);
                return (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                      <span>{completedCount} of {todayJobs.length} jobs completed</span>
                      <span className="font-semibold text-white/70">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}
              {todayJobs.length === 0 ? (
                <div className="text-center py-10 text-white/30">
                  <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
                  <div>No jobs scheduled — enjoy your day!</div>
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

            {/* Recent activity feed */}
            {(() => {
              const activity: { id: string; icon: string; text: string; date: string }[] = [];
              myJobs.forEach(j => {
                const cust = customers.find(c => c.id === j.customerId);
                const custLabel = cust ? `${cust.firstName} ${cust.lastName}` : j.address;
                if (j.signOff) activity.push({ id: j.id + "-signoff", icon: "✍️", text: `Got sign-off from ${custLabel}`, date: j.signOff.timestamp });
                (j.commLog || []).forEach(c => activity.push({ id: c.id, icon: "📝", text: `Note on ${custLabel}: "${c.note}"`, date: c.date }));
                if (j.status === "completed") activity.push({ id: j.id + "-done", icon: "✅", text: `Completed job at ${j.address}`, date: j.scheduledDate });
              });
              activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const recent = activity.slice(0, 5);
              if (recent.length === 0) return null;
              return (
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">Recent Activity</div>
                  <div className="space-y-1.5">
                    {recent.map(a => (
                      <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/5">
                        <span className="text-sm flex-shrink-0">{a.icon}</span>
                        <div className="flex-1 min-w-0 text-xs text-white/60 truncate">{a.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>}

          {/* Calendar tab */}
          {tab === "calendar" && (() => {
            const calWeekDates = Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - d.getDay() + i + calWeekOffset * 7);
              return d.toISOString().slice(0, 10);
            });
            const calMonthBase = new Date();
            calMonthBase.setDate(1);
            calMonthBase.setMonth(calMonthBase.getMonth() + calMonthOffset);
            const calMonthYear = calMonthBase.getFullYear();
            const calMonthMonth = calMonthBase.getMonth();
            const calDaysInMonth = new Date(calMonthYear, calMonthMonth + 1, 0).getDate();
            const calFirstDay = new Date(calMonthYear, calMonthMonth, 1).getDay();
            const calMonthLabel = calMonthBase.toLocaleDateString("en-US", { month: "long", year: "numeric" });
            const calDayJobs = myJobs.filter(j => j.scheduledDate === calSelectedDate);

            return (
              <>
                {/* Week / Month toggle + Availability */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex flex-1 bg-white/5 rounded-xl p-1">
                    <button onClick={() => setCalMode("week")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${calMode === "week" ? "bg-red-600 text-white" : "text-white/50 hover:text-white"}`}>
                      Week
                    </button>
                    <button onClick={() => setCalMode("month")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${calMode === "month" ? "bg-red-600 text-white" : "text-white/50 hover:text-white"}`}>
                      Month
                    </button>
                  </div>
                  <button onClick={() => setShowAvailability(v => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${showAvailability ? "bg-orange-600/30 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"}`}>
                    <Eye size={12} />{showAvailability ? "Done" : "Availability"}
                  </button>
                </div>
                {showAvailability && (
                  <div className="mb-3 p-2.5 rounded-xl bg-orange-950/20 border border-orange-700/30 text-xs text-orange-200/70">
                    Tap dates to mark yourself <b>unavailable</b>. Gray dates = blocked. Owner will see these when scheduling.
                    {availability.length > 0 && <span className="ml-2 text-orange-300">{availability.length} day{availability.length !== 1 ? "s" : ""} blocked</span>}
                  </div>
                )}

                {calMode === "week" && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => setCalWeekOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronLeft size={16} />
                      </button>
                      <div className="text-xs text-white/60 font-semibold">
                        {new Date(calWeekDates[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" – "}
                        {new Date(calWeekDates[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      <button onClick={() => setCalWeekOffset(o => o + 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {/* 7-day strip */}
                    <div className="grid grid-cols-7 gap-1 mb-4">
                      {calWeekDates.map(dateStr => {
                        const d = new Date(dateStr + "T12:00:00");
                        const dayJobs = myJobs.filter(j => j.scheduledDate === dateStr);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === calSelectedDate && !showAvailability;
                        const isUnavail = availability.includes(dateStr);
                        return (
                          <button key={dateStr}
                            onClick={() => showAvailability ? toggleAvailability(dateStr) : setCalSelectedDate(dateStr)}
                            className={`flex flex-col items-center py-2 rounded-xl transition ${
                              isUnavail ? "bg-gray-800/60 border border-gray-600/30" :
                              isSelected ? "bg-red-600" :
                              isToday ? "bg-red-950/40 border border-red-700/30" : "bg-white/5 hover:bg-white/10"
                            }`}>
                            <div className={`text-[10px] ${isUnavail ? "text-gray-500" : isSelected || isToday ? "text-white/80" : "text-white/40"}`}>
                              {d.toLocaleDateString("en-US", { weekday: "narrow" })}
                            </div>
                            <div className={`text-sm font-bold leading-tight ${isUnavail ? "text-gray-500" : isSelected ? "text-white" : isToday ? "text-red-400" : "text-white/70"}`}>
                              {d.getDate()}
                            </div>
                            <div className="w-1.5 h-1.5 mt-0.5">
                              {isUnavail ? <div className="w-1.5 h-1.5 rounded-full bg-gray-600" /> :
                               dayJobs.length > 0 && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-red-400"}`} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Jobs for selected day */}
                    <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                      <span>{new Date(calSelectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                      {calDayJobs.length > 0 && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{calDayJobs.length}</span>}
                    </div>
                    {calDayJobs.length === 0 ? (
                      <div className="text-center py-8 text-white/30 text-sm">No jobs scheduled</div>
                    ) : (
                      <div className="space-y-2">
                        {calDayJobs.map(j => {
                          const c = customers.find(x => x.id === j.customerId);
                          return (
                            <div key={j.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                              <button onClick={() => setSelectedJobId(j.id)} className="w-full text-left p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{j.address}</div>
                                    {c && <div className="text-xs text-white/50">{c.firstName} {c.lastName}</div>}
                                  </div>
                                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 ${
                                    j.status === "completed" ? "bg-green-900/40 text-green-300" :
                                    j.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
                                    "bg-blue-900/40 text-blue-300"
                                  }`}>{(j.status || "").replace("_", " ")}</div>
                                </div>
                                {j.scheduledTime && <div className="text-xs text-white/40 mt-1">🕐 {j.scheduledTime}</div>}
                              </button>
                              <div className="px-3 pb-2 flex items-center gap-3 border-t border-white/5 pt-2">
                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(j.address)}`}
                                  target="_blank" rel="noreferrer"
                                  className="text-[10px] text-blue-400/70 hover:text-blue-300 flex items-center gap-1 transition">
                                  <Navigation size={9} />Directions
                                </a>
                                <a href={toGCalUrl(j)} target="_blank" rel="noreferrer"
                                  className="text-[10px] text-green-400/70 hover:text-green-300 flex items-center gap-1 transition">
                                  <Calendar size={9} />Add to Google Cal
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {calMode === "month" && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => setCalMonthOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronLeft size={16} />
                      </button>
                      <div className="text-sm font-semibold">{calMonthLabel}</div>
                      <button onClick={() => setCalMonthOffset(o => o + 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {["S","M","T","W","T","F","S"].map((d, i) => (
                        <div key={i} className="text-center text-[10px] text-white/30 font-semibold py-1">{d}</div>
                      ))}
                    </div>
                    {/* Month grid */}
                    <div className="grid grid-cols-7 gap-0.5 mb-4">
                      {Array.from({ length: calFirstDay }, (_, i) => <div key={"e" + i} />)}
                      {Array.from({ length: calDaysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dateStr = `${calMonthYear}-${String(calMonthMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const dayJobs = myJobs.filter(j => j.scheduledDate === dateStr);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === calSelectedDate && !showAvailability;
                        const isUnavail = availability.includes(dateStr);
                        return (
                          <button key={day}
                            onClick={() => showAvailability ? toggleAvailability(dateStr) : setCalSelectedDate(dateStr)}
                            className={`flex flex-col items-center py-1.5 rounded-lg transition min-h-[44px] ${
                              isUnavail ? "bg-gray-800/60 border border-gray-600/30" :
                              isSelected ? "bg-red-600" :
                              isToday ? "bg-red-950/50 border border-red-700/30" : "hover:bg-white/8"
                            }`}>
                            <div className={`text-sm font-semibold ${
                              isUnavail ? "text-gray-500" : isSelected ? "text-white" : isToday ? "text-red-400" : "text-white/60"
                            }`}>
                              {day}
                            </div>
                            {isUnavail ? (
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                            ) : dayJobs.length > 0 ? (
                              <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-red-400"}`} />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {/* Jobs for selected day */}
                    <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                      <span>{new Date(calSelectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                      {calDayJobs.length > 0 && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{calDayJobs.length}</span>}
                    </div>
                    {calDayJobs.length === 0 ? (
                      <div className="text-center py-6 text-white/30 text-sm">No jobs this day</div>
                    ) : (
                      <div className="space-y-2">
                        {calDayJobs.map(j => {
                          const c = customers.find(x => x.id === j.customerId);
                          return (
                            <div key={j.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                              <button onClick={() => setSelectedJobId(j.id)} className="w-full text-left p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{j.address}</div>
                                    {c && <div className="text-xs text-white/50">{c.firstName} {c.lastName}</div>}
                                  </div>
                                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 ${
                                    j.status === "completed" ? "bg-green-900/40 text-green-300" :
                                    j.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
                                    "bg-blue-900/40 text-blue-300"
                                  }`}>{(j.status || "").replace("_", " ")}</div>
                                </div>
                                {j.scheduledTime && <div className="text-xs text-white/40 mt-0.5">🕐 {j.scheduledTime}</div>}
                              </button>
                              <div className="px-3 pb-2 flex items-center gap-3 border-t border-white/5 pt-2">
                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(j.address)}`}
                                  target="_blank" rel="noreferrer"
                                  className="text-[10px] text-blue-400/70 hover:text-blue-300 flex items-center gap-1 transition">
                                  <Navigation size={9} />Directions
                                </a>
                                <a href={toGCalUrl(j)} target="_blank" rel="noreferrer"
                                  className="text-[10px] text-green-400/70 hover:text-green-300 flex items-center gap-1 transition">
                                  <Calendar size={9} />Add to Google Cal
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}

          {/* All Jobs tab — grouped by date */}
          {tab === "jobs" && (() => {
            const jwEnd = (() => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().slice(0, 10); })();
            const visibleJobs = showCanceledJobs ? myJobs : myJobs.filter(j => j.status !== "cancelled");
            const canceledCount = myJobs.filter(j => j.status === "cancelled").length;
            const activeGrp  = visibleJobs.filter(j => !!j.clockInAt);
            const todayGrp   = visibleJobs.filter(j => !j.clockInAt && j.scheduledDate === todayStr);
            const weekGrp    = visibleJobs.filter(j => !j.clockInAt && j.scheduledDate > todayStr && j.scheduledDate <= jwEnd);
            const upcomingGrp = visibleJobs.filter(j => !j.clockInAt && j.scheduledDate > jwEnd);
            const earlierGrp = visibleJobs.filter(j => !j.clockInAt && j.scheduledDate < todayStr);

            const Group = ({ label, jobs: grpJobs, collapsed, onToggle }: { label: string; jobs: typeof myJobs; collapsed?: boolean; onToggle?: () => void }) => {
              if (grpJobs.length === 0) return null;
              return (
                <div>
                  <button
                    onClick={onToggle}
                    className={"w-full text-xs text-white/40 uppercase tracking-widest font-bold mb-2 flex items-center gap-2 " + (onToggle ? "cursor-pointer hover:text-white/60" : "")}
                  >
                    <span>{label}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 font-normal">{grpJobs.length}</span>
                    {onToggle && <ChevronRight size={12} className={"transition-transform " + (collapsed ? "" : "rotate-90")} />}
                  </button>
                  {!collapsed && <div className="space-y-2">{grpJobs.map(j => <JobCard key={j.id} job={j} />)}</div>}
                </div>
              );
            };

            return (
              <div className="space-y-5">
                {canceledCount > 0 && (
                  <button onClick={() => setShowCanceledJobs(v => !v)} className={"w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition " + (showCanceledJobs ? "bg-red-950/20 border-red-700/40 text-red-300" : "bg-black/30 border-white/10 text-white/40 hover:text-white/60")}>
                    {showCanceledJobs ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {showCanceledJobs ? `Showing ${canceledCount} canceled job${canceledCount !== 1 ? "s" : ""}` : `Show Canceled (${canceledCount})`}
                  </button>
                )}
                {myJobs.length === 0 ? (
                  <div className="text-center py-14 text-white/30 px-4">
                    <Briefcase size={36} className="mx-auto mb-3 opacity-20" />
                    <div className="font-semibold text-white/40 mb-1">No jobs assigned yet</div>
                    <div className="text-sm leading-relaxed">When your manager assigns you to a job, it will appear here.</div>
                  </div>
                ) : (
                  <>
                    <Group label="Active" jobs={activeGrp} />
                    <Group label="Today" jobs={todayGrp} />
                    <Group label="This Week" jobs={weekGrp.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))} />
                    <Group label="Upcoming" jobs={upcomingGrp.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))} collapsed={upcomingCollapsed} onToggle={() => setUpcomingCollapsed(c => !c)} />
                    <Group label="Past" jobs={earlierGrp.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))} collapsed={pastCollapsed} onToggle={() => setPastCollapsed(c => !c)} />
                  </>
                )}
              </div>
            );
          })()}

          {/* Pay tab */}
          {tab === "pay" && (() => {
            // Build pay period history (14-day periods going back 3 months)
            const periods: Array<{ label: string; start: string; end: string; hours: number; pay: number; jobs: number }> = [];
            const now = new Date();
            for (let i = 0; i < 6; i++) {
              const end = new Date(now); end.setDate(end.getDate() - i * 14);
              const start = new Date(end); start.setDate(start.getDate() - 13);
              const s = start.toISOString().slice(0, 10);
              const e = end.toISOString().slice(0, 10);
              const pJobs = myJobs.filter(j => j.scheduledDate >= s && j.scheduledDate <= e);
              const hrs = pJobs.reduce((acc, j) => acc + Number(j.loggedHours || 0), 0);
              periods.push({
                label: i === 0 ? "Current Period" : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
                start: s, end: e,
                hours: Math.round(hrs * 10) / 10,
                pay: Math.round(hrs * (myEmployee?.hourlyRate || 0) * 100) / 100,
                jobs: pJobs.filter(j => j.status === "completed").length,
              });
            }
            const current = periods[0];
            const lastClosed = periods[1];
            const expectedHours = 80; // typical 2-week period
            const TAX_RATE = 0.20;
            const takeHome = Math.round(current.pay * (1 - TAX_RATE) * 100) / 100;

            // Outstanding balance — the owner marks individual 14-day pay
            // periods as paid/unpaid (Employees → Pay), keyed by each
            // period's start date in paidPeriods. Anything not explicitly
            // marked paid counts as pending.
            const paidPeriodsMap: Record<string, "paid" | "unpaid"> = (myEmployee as any)?.paidPeriods || {};
            const periodsWithStatus = periods.filter(p => p.pay > 0).map(p => ({ ...p, status: paidPeriodsMap[p.start] || "unpaid" }));
            const totalPaid = Math.round(periodsWithStatus.filter(p => p.status === "paid").reduce((s, p) => s + p.pay, 0) * 100) / 100;
            const pendingPay = Math.round(periodsWithStatus.filter(p => p.status === "unpaid").reduce((s, p) => s + p.pay, 0) * 100) / 100;
            const pendingHours = Math.round(periodsWithStatus.filter(p => p.status === "unpaid").reduce((s, p) => s + p.hours, 0) * 10) / 10;

            // Year-to-date + prior-year earnings, bucketed by the calendar year
            // each job's logged hours fall in — same hrs × rate math as the pay
            // periods above, just rolled up annually for tax purposes.
            const earningsByYear: Record<string, number> = {};
            myJobs.forEach(j => {
              if (!j.scheduledDate || !Number(j.loggedHours)) return;
              const yr = j.scheduledDate.slice(0, 4);
              earningsByYear[yr] = (earningsByYear[yr] || 0) + Number(j.loggedHours) * (myEmployee?.hourlyRate || 0);
            });
            const thisYear = String(new Date().getFullYear());
            const ytdGross = Math.round((earningsByYear[thisYear] || 0) * 100) / 100;
            const priorYears = Object.keys(earningsByYear).filter(y => y !== thisYear).sort((a, b) => b.localeCompare(a));

            // Simplified estimator — SE-style 15.3% + a federal-bracket approximation,
            // same shape as the owner's business tax estimate. Real withholding
            // depends on W-4 elections; this is a ballpark, not payroll advice.
            const seRateEst = 0.153;
            const fedRateEst = ytdGross > 89075 ? 0.24 : ytdGross > 41775 ? 0.22 : ytdGross > 11000 ? 0.12 : 0.10;
            const estAnnualTax = Math.round(ytdGross * (seRateEst + fedRateEst) * 100) / 100;
            const estAnnualTakeHome = Math.round((ytdGross - estAnnualTax) * 100) / 100;

            const downloadTaxPdf = () => {
              const periodRows = periods.filter(p => p.pay > 0).map(p => `<tr><td>${p.label}</td><td>${p.start} — ${p.end}</td><td class="r">${p.hours}</td><td class="r">$${p.pay.toFixed(2)}</td></tr>`).join("");
              const priorRows = priorYears.map(y => `<tr><td>${y}</td><td class="r">$${earningsByYear[y].toFixed(2)}</td></tr>`).join("");
              const empName = `${myEmployee?.firstName || ""} ${myEmployee?.lastName || ""}`.trim() || "Employee";
              const html = `<!DOCTYPE html><html><head><title>Tax Summary — ${empName}</title>
              <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:900px;margin:auto;font-size:13px}
              h1{color:#dc2626;font-size:24px}h2{color:#333;font-size:16px;border-bottom:2px solid #dc2626;padding-bottom:6px;margin:24px 0 12px}
              .header{display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #dc2626;padding-bottom:16px;margin-bottom:24px}
              .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
              .kpi{background:#f9f9f9;padding:16px;border-radius:8px;border:1px solid #eee}
              .kpi label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888}
              .kpi .val{font-size:20px;font-weight:bold;color:#dc2626;margin-top:4px}
              table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}
              th{background:#f0f0f0;padding:8px 10px;text-align:left;border-bottom:2px solid #ccc;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
              td{padding:7px 10px;border-bottom:1px solid #eee}.r{text-align:right}
              .total-row{background:#fff8f8;font-weight:bold;color:#dc2626}
              .disclaimer{margin-top:32px;padding:12px;background:#fffbf0;border:1px solid #f0c040;border-radius:6px;font-size:11px;color:#555}
              @media print{body{padding:20px}}</style></head><body>
              <div class="header">
                <div><h1>${settings.companyName || "Smock's Pressure Washing"}</h1><p style="color:#666;margin-top:4px">Employee Tax Summary — ${empName} · ${thisYear} · Generated ${today()}</p></div>
              </div>
              <div class="kpis">
                <div class="kpi"><label>YTD Gross Earnings</label><div class="val">$${ytdGross.toFixed(2)}</div></div>
                <div class="kpi"><label>Est. Tax (Fed + SE)</label><div class="val">$${estAnnualTax.toFixed(2)}</div></div>
                <div class="kpi"><label>Est. Take-Home</label><div class="val">$${estAnnualTakeHome.toFixed(2)}</div></div>
              </div>
              <h2>Pay Period Breakdown (${thisYear})</h2>
              <table><thead><tr><th>Period</th><th>Dates</th><th class="r">Hours</th><th class="r">Gross Pay</th></tr></thead>
              <tbody>${periodRows || `<tr><td colspan="4">No pay periods logged yet</td></tr>`}<tr class="total-row"><td colspan="3">YTD Total</td><td class="r">$${ytdGross.toFixed(2)}</td></tr></tbody></table>
              ${priorYears.length ? `<h2>Previous Tax Years</h2><table><thead><tr><th>Year</th><th class="r">Gross Earnings</th></tr></thead><tbody>${priorRows}</tbody></table>` : ""}
              <div class="disclaimer">⚠️ <strong>Disclaimer:</strong> This is a simplified estimate for personal planning only and is not tax advice. Your actual withholding and liability depend on your filing status, W-4 elections, and other income. Consult a qualified tax professional.</div>
              <script>window.onload=()=>setTimeout(window.print,400)</script></body></html>`;
              const w = window.open("", "_blank");
              if (w) { w.document.write(html); w.document.close(); }
              toast("Tax summary opened — save as PDF");
            };

            return (
              <>
                <Glass className="p-5 !bg-gradient-to-br !from-green-950/30 !to-black/60 !border-green-700/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Current Pay Rate</div>
                      <div className="text-3xl font-black text-green-400">{fmt(myEmployee?.hourlyRate || 0)}<span className="text-base font-normal text-white/50">/hr</span></div>
                      <div className="text-xs text-white/40 mt-1 capitalize">{myEmployee?.role}</div>
                    </div>
                    {typeof (myEmployee as any)?.ratingScore === "number" && (
                      <div className="text-right">
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Rating</div>
                        <div className="text-xl font-black text-yellow-400">{(myEmployee as any).ratingScore}<span className="text-xs text-white/40">/100</span></div>
                      </div>
                    )}
                  </div>
                </Glass>

                <Glass className="p-4 !bg-black/40">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-2">This Pay Period</div>
                  <div className="flex justify-between text-[11px] text-white/40 mb-1">
                    <span>{current.hours}h worked</span>
                    <span>{expectedHours}h expected</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: Math.min(100, current.hours / expectedHours * 100) + "%" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-xl bg-green-950/20 border border-green-700/20">
                      <div className="text-[10px] text-white/40 uppercase">Estimated Gross</div>
                      <div className="text-xl font-black text-green-400">{fmt(current.pay)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-white/40 uppercase flex items-center gap-1">Est. Take-Home <span className="text-white/25">(after ~20% tax)</span></div>
                      <div className="text-xl font-black text-white/80">{fmt(takeHome)}</div>
                    </div>
                  </div>
                </Glass>

                {/* Outstanding balance — clear paid vs pending separation */}
                <Glass className="p-4 !bg-black/40">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Outstanding Balance</div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-3 rounded-xl bg-yellow-950/20 border border-yellow-700/30">
                      <div className="text-[10px] text-yellow-400/70 uppercase">Pending Pay</div>
                      <div className="text-xl font-black text-yellow-400">{fmt(pendingPay)}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{pendingHours}h across unpaid periods</div>
                    </div>
                    <div className="p-3 rounded-xl bg-green-950/20 border border-green-700/30">
                      <div className="text-[10px] text-green-400/70 uppercase">Total Paid</div>
                      <div className="text-xl font-black text-green-400">{fmt(totalPaid)}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{periodsWithStatus.some(p => p.status === "paid") ? `${periodsWithStatus.filter(p => p.status === "paid").length} period${periodsWithStatus.filter(p => p.status === "paid").length !== 1 ? "s" : ""} marked paid` : "Not marked paid yet"}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {periodsWithStatus.map(p => (
                      <div key={p.start} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/5">
                        <span className="text-[10px] text-white/50">{p.label}</span>
                        <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + (p.status === "paid" ? "bg-green-900/40 text-green-300" : "bg-yellow-900/30 text-yellow-300")}>{p.status === "paid" ? "Paid" : "Unpaid"}</span>
                      </div>
                    ))}
                  </div>
                  {lastClosed && lastClosed.pay > 0 && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <div className="text-[10px] text-white/40 uppercase">Last Pay Period</div>
                        <div className="text-xs text-white/50">{lastClosed.start} — {lastClosed.end}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white/70">{fmt(lastClosed.pay)}</div>
                        <div className="text-[10px] text-white/30">{lastClosed.hours}h · assumed paid</div>
                      </div>
                    </div>
                  )}
                </Glass>

                {periods.some(p => p.pay > 0) && (
                  <Glass className="p-4 !bg-black/40">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Earnings Over Time</div>
                    <div style={{ width: "100%", height: 160 }}>
                      <ResponsiveContainer>
                        <BarChart data={[...periods].reverse().map(p => ({ name: p.label === "Current Period" ? "Current" : p.label.split(" – ")[0], pay: p.pay }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                          <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} formatter={(v: any) => fmt(v)} />
                          <Bar dataKey="pay" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Glass>
                )}

                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">Pay Period History</div>
                <div className="space-y-2">
                  {periods.map((p, i) => (
                    <Glass key={i} className={"p-4 " + (i === 0 ? "!bg-green-950/20 !border-green-700/30" : "!bg-black/40")}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className={"text-sm font-semibold " + (i === 0 ? "text-green-300" : "text-white/70")}>{p.label}</div>
                          {i > 0 && <div className="text-[10px] text-white/30">{p.start} — {p.end}</div>}
                        </div>
                        <div className="text-right">
                          <div className={"text-lg font-black " + (i === 0 ? "text-green-400" : "text-white/70")}>{fmt(p.pay)}</div>
                          <div className="text-[10px] text-white/40">estimated</div>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-white/50">
                        <span><span className="font-semibold text-white/70">{p.hours}h</span> logged</span>
                        <span><span className="font-semibold text-white/70">{p.jobs}</span> completed</span>
                      </div>
                      {i === 0 && p.hours > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-white/40 mb-1">
                            <span>Progress</span>
                            <span>{p.hours}h / 80h typical</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: Math.min(100, p.hours / 80 * 100) + "%" }} />
                          </div>
                        </div>
                      )}
                    </Glass>
                  ))}
                </div>

                {/* Tax Center */}
                <Glass className="p-4 !bg-black/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-white/50 uppercase tracking-wider">Tax Center · {thisYear}</div>
                    <GBtn onClick={downloadTaxPdf} className="!text-xs !py-1.5"><Download size={11} className="inline mr-1" />Tax PDF</GBtn>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-green-950/20 border border-green-700/20">
                      <div className="text-[10px] text-white/40 uppercase">YTD Gross</div>
                      <div className="text-base font-black text-green-400">{fmt(ytdGross)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-yellow-950/20 border border-yellow-700/20">
                      <div className="text-[10px] text-white/40 uppercase">Est. Tax</div>
                      <div className="text-base font-black text-yellow-400">{fmt(estAnnualTax)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-white/40 uppercase">Est. Take-Home</div>
                      <div className="text-base font-black text-white/80">{fmt(estAnnualTakeHome)}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-white/30">
                    Estimate uses ~15.3% SE-style tax + a federal bracket approximation on YTD gross earnings — not official payroll or tax advice.
                  </div>
                  {priorYears.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Previous Tax Years</div>
                      <div className="space-y-1">
                        {priorYears.map(y => (
                          <div key={y} className="flex justify-between text-xs text-white/60">
                            <span>{y}</span>
                            <span className="font-semibold text-white/80">{fmt(earningsByYear[y])}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Glass>

                <div className="text-[10px] text-white/20 text-center pt-2">
                  Pay estimates are based on logged hours × hourly rate.<br />Contact your manager for official payroll figures.
                </div>
              </>
            );
          })()}
          {/* Google tab */}
          {tab === "google" && (() => {
            const empUserId = empSession?.user?.id;
            const storedToken = empUserId ? getEmpGoogleToken(empUserId) : null;
            const empGoogleValid = isEmpGoogleTokenValid(storedToken);
            const empGoogleIdentityLinked = empSession
              ? (empSession.user?.identities || []).some((i: any) => i.provider === "google")
              : false;
            // Linked but no valid token (token never captured, or the ~1hr access token expired)
            const empGoogleExpired = empGoogleIdentityLinked && !empGoogleValid;
            const empGoogleEmail = storedToken?.email
              || ((empSession?.user?.identities || []).find((i: any) => i.provider === "google")?.identity_data?.email || "");
            const upcomingForCal = myJobs
              .filter(j => j.scheduledDate >= todayStr && j.status !== "completed")
              .sort((a, b) => {
                const da = a.scheduledDate + (a.scheduledTime || "23:59");
                const db = b.scheduledDate + (b.scheduledTime || "23:59");
                return da.localeCompare(db);
              })
              .slice(0, 20);
            const handleConnectGoogle = async () => {
              console.log("GOOGLE LINK INITIATED — employee:", empSession?.user?.id);
              // Cache the role BEFORE redirecting — once linkIdentity/signInWithOAuth
              // navigates away, no more JS runs on this page, so this must be set
              // synchronously now, not after the redirect comes back. On return,
              // resolveUserRole checks this cache first so a momentary Supabase query
              // race can never misclassify a freshly-Google-linked employee as owner.
              if (empSession?.user?.id) {
                try { localStorage.setItem("crew_role_" + empSession.user.id, "employee"); } catch { /* ignore */ }
              }
              const SCOPES = [
                "https://www.googleapis.com/auth/calendar",
                "https://www.googleapis.com/auth/calendar.events",
                "https://mail.google.com/",
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/contacts.readonly",
                "https://www.googleapis.com/auth/tasks",
              ].join(" ");
              const redirectTo = `${window.location.origin}${window.location.pathname}#/portal`;
              const { error } = await (supabase.auth as any).linkIdentity({
                provider: "google",
                options: { redirectTo, scopes: SCOPES },
              });
              if (error) {
                // Fallback: full OAuth sign-in (some Supabase plans don't support linkIdentity)
                supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo,
                    scopes: SCOPES,
                    queryParams: { access_type: "offline", prompt: "consent" },
                  },
                });
              }
            };
            return (
              <div className="space-y-4">
                {/* Connect / connected / expired banner */}
                {empGoogleValid ? (
                  <Glass className="p-4 !bg-green-950/20 !border-green-700/30 flex items-center gap-3">
                    <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-green-300">Google Connected ✓</div>
                      {empGoogleEmail && <div className="text-xs text-white/50 mt-0.5">Connected as {empGoogleEmail}</div>}
                      <div className="text-xs text-white/40 mt-0.5">Calendar sync is active — jobs auto-added on accept</div>
                    </div>
                  </Glass>
                ) : empGoogleExpired ? (
                  <Glass className="p-4 !bg-yellow-950/20 !border-yellow-700/30">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle size={18} className="text-yellow-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-yellow-300">Google Connection Expired</div>
                        {empGoogleEmail && <div className="text-xs text-white/50 mt-0.5">{empGoogleEmail}</div>}
                        <div className="text-xs text-white/40 mt-0.5">Your access token expired — reconnect to resume calendar sync</div>
                      </div>
                    </div>
                    <button
                      onClick={handleConnectGoogle}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-semibold text-sm active:scale-95 transition-all"
                    >
                      Reconnect Google
                    </button>
                  </Glass>
                ) : (
                  <Glass className="p-4 !bg-black/40">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/30 to-blue-900/30 border border-blue-700/30 flex items-center justify-center flex-shrink-0">
                        <Calendar size={18} className="text-blue-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Connect Your Google Account</div>
                        <div className="text-xs text-white/40 mt-0.5">Sync jobs to your personal Google Calendar</div>
                      </div>
                    </div>
                    <button
                      onClick={handleConnectGoogle}
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Connect Google Account
                    </button>
                  </Glass>
                )}

                {empGoogleValid && (
                  <Glass className="p-4 !bg-black/40 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">Auto-sync jobs to Google Calendar</div>
                      <div className="text-xs text-white/40 mt-0.5">
                        {autoSyncCalendar
                          ? "Every assigned or accepted job is added to your calendar automatically"
                          : "Add jobs to your calendar manually with the button below"}
                      </div>
                    </div>
                    <button onClick={toggleAutoSyncCalendar} className={"transition flex-shrink-0 " + (autoSyncCalendar ? "text-blue-400" : "text-white/30")}>
                      {autoSyncCalendar ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </Glass>
                )}

                <Glass className="p-4 !bg-black/40">
                  <label className="text-sm font-semibold mb-1 block flex items-center gap-1.5"><MapPin size={13} className="text-blue-400" />Home Base</label>
                  <div className="text-xs text-white/40 mb-2">Your starting address — used as the origin point when optimizing today's route</div>
                  <AddressAutocomplete
                    value={homeBaseAddress}
                    onChange={v => saveHomeBaseAddress(v)}
                    placeholder="412 Oak Ridge Ln, York PA"
                    mapsKey={settings.googleMapsKey || settings.mapsKey || ""}
                  />
                </Glass>

                {/* Upcoming jobs to add */}
                {upcomingForCal.length === 0 ? (
                  <div className="text-center py-10 text-white/30">
                    <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                    <div>No upcoming jobs to sync</div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Upcoming Jobs</div>
                    <div className="space-y-2">
                      {upcomingForCal.map(j => {
                        const c = customers.find(x => x.id === j.customerId);
                        return (
                          <Glass key={j.id} className="p-3 !bg-black/40">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate">{j.address}</div>
                                {c && <div className="text-xs text-white/40">{c.firstName} {c.lastName}</div>}
                                <div className="text-xs text-white/30 mt-0.5">
                                  {j.scheduledDate}{j.scheduledTime ? " · " + j.scheduledTime : ""}
                                </div>
                              </div>
                              <a
                                href={toGCalUrl(j)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/30 text-blue-300 text-[10px] font-semibold transition flex-shrink-0"
                              >
                                <Plus size={10} />Add
                              </a>
                            </div>
                          </Glass>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-white/20 text-center pt-1">
                      Tapping "Add" opens Google Calendar. When connected above, jobs sync automatically.
                    </div>
                  </>
                )}

                {/* Privacy note */}
                <div className="p-3 rounded-xl bg-yellow-950/20 border border-yellow-700/20 text-xs text-yellow-200/60 flex items-start gap-2">
                  <Shield size={12} className="flex-shrink-0 mt-0.5" />
                  <span>Your personal Google account is private. Employers cannot see your personal Gmail or Calendar events.</span>
                </div>
              </div>
            );
          })()}

        </div>
      </main>

      {/* Bottom nav — filtered by permissions */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-red-900/30 flex items-center justify-around px-2 py-2 safe-bottom z-30">
        {([
          { id: "today",    label: "Today",    icon: Home,       show: true },
          { id: "calendar", label: "Calendar", icon: Calendar,   show: perms.can_view_calendar },
          { id: "jobs",     label: "All Jobs", icon: List,       show: perms.can_view_jobs },
          { id: "pay",      label: "My Pay",   icon: DollarSign, show: perms.can_view_pay },
          { id: "google",   label: "Google",   icon: Database,   show: true },
        ] as const).filter(t => t.show).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className={"flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition " +
              (tab === id ? "text-red-400" : "text-white/40 hover:text-white/70")}>
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

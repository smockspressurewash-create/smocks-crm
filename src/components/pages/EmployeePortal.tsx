import React, { useState, useEffect, useRef } from "react";
import {
  Clock, Briefcase, Calendar, ChevronLeft, CheckSquare, Camera,
  LogOut, MapPin, Phone, User, Play, Pause, Square, Plus, X, Eye, EyeOff, DollarSign,
  ChevronRight, Home, List, CheckCircle, AlertCircle, AlertTriangle, Image, FileText,
  Video, PenLine, Shield, Navigation, Database, Route, ToggleRight, ToggleLeft, Download, Bell
} from "lucide-react";
import { supabase, getStoredGoogleConnection, fetchOwnerGoogleToken } from "../../lib/supabase";
import { getEmpGoogleToken, isEmpGoogleTokenValid, saveEmpGoogleToken, refreshEmpGoogleToken, getValidEmpGoogleToken, createGCalEvent, updateGCalEvent } from "../../lib/googleApi";
import { sendViaGmail, sendEmail, sendOwnerGmailOnly, emailShell, emailButton, twilioSend, logOutboundSmsToInbox } from "../../lib/messaging";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GTxt } from "../ui/GTxt";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { loadMapsScript, AddressAutocomplete } from "../ui/AddressAutocomplete";
import { LiveMap } from "../ui/LiveMap";
import { PropertyMapEmbed } from "../ui/PropertyMapEmbed";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { fmt, uid, today, localDateStr, shiftDayStr, daysFromNow, computeJobRatingScore, setOAuthIntent, compressImageFile, getEffectiveRate, computeNextRecurringDate, weekdayLabels, normalizeJobRow, totalJobPhotoCount, mediaSrc, dataUrlToBlob, uploadJobMedia, checkVideoLimits, stripLegacyJobFields } from "../../lib/utils";
import { usePollGate } from "../../hooks/usePollGate";
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

// Embedded map for a job address — see PropertyMapEmbed for why this
// replaced the Street View Static API (403 key-restriction errors).
function StreetViewThumb({ address }: { address: string; apiKey?: string }) {
  return <PropertyMapEmbed address={address} height={144} />;
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

// Shifts a "HH:MM" scheduled time by +/- minutes, wrapping within a 24h day.
// Used by Running Late so the job's scheduled time (and anything downstream
// that reads it — calendar sync, "up next" sorting) reflects the delay.
const shiftScheduledTime = (time: string | undefined, minutes: number): string | undefined => {
  if (!time) return time;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

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

function PortalChecklistSection({ jobId, title, emoji, items, onUpdate, allowPhotos = false, disabled = false, toast = () => {} }: {
  jobId: string;
  title: string; emoji: string;
  items: JobChecklistItem[];
  onUpdate: (items: JobChecklistItem[]) => void;
  allowPhotos?: boolean;
  disabled?: boolean;
  toast?: (msg: string, tone?: any) => void;
}) {
  const done = items.filter(i => i.done).length;
  const toggle = (id: string) => { if (!disabled) onUpdate(items.map(it => it.id === id ? { ...it, done: !it.done } : it)); };
  const updateNotes = (id: string, notes: string) => onUpdate(items.map(it => it.id === id ? { ...it, notes } : it));
  const addItemPhoto = async (id: string, dataUrl: string, isVideo: boolean, contentType?: string) => {
    const mediaId = uid();
    const ext = isVideo ? (contentType?.split("/")[1] || "mp4").replace("quicktime", "mov") : "jpg";
    const url = await uploadJobMedia(dataUrlToBlob(dataUrl), `${jobId}/checklist-${id}-${mediaId}.${ext}`, contentType || (isVideo ? undefined : "image/jpeg"));
    const media = url ? { id: mediaId, url } : { id: mediaId, dataUrl };
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
                          if (isVideo) {
                            // ITEM 11 — same 30s/50MB cap as the top-level before/after
                            // video capture (addVideo below) — this path had none before.
                            checkVideoLimits(f).then(err => {
                              if (err) { toast(err, "red"); return; }
                              const r = new FileReader();
                              r.onload = ev => addItemPhoto(item.id, ev.target!.result as string, true, f.type);
                              r.readAsDataURL(f);
                            });
                          } else {
                            compressImageFile(f).then(dataUrl => addItemPhoto(item.id, dataUrl, false));
                          }
                          e.target.value = "";
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
                        <img src={mediaSrc(p.url, p.dataUrl)} alt="" className="w-full h-full object-cover" />
                        {!disabled && (
                          <button onClick={() => deleteItemMedia(item.id, p.id, false)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-red-700 text-white flex items-center justify-center">
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    ))}
                    {(item.videos || []).map((v, vi) => (
                      <div key={v.id || vi} className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 relative bg-black">
                        <video src={mediaSrc(v.url, v.dataUrl)} className="w-full h-full object-cover" />
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

// FIX 13 — exported so the owner's Dashboard can reuse the exact same
// streamlined, mobile-optimized job view a field employee sees (sign-off,
// checklist with photo upload, clock in/out — no admin fields) instead of
// opening the full JobDetailModal for a job the OWNER is personally working.
export function JobDetailView({ job, customer, onBack, onUpdateJob, toast, companyName = "the company", onComplete, perms: permsOverride, maxLunchMinutes = 30, onJobCompleted, googleMapsKey = "", paidLunchBreaks = false, signOffDisclaimer = "", settings = {} as AppSettings, setEstimates = (() => {}) as any, nextJob = null, nextJobCustomer = null, onArrived, autoComplete = false, employeeName = "", isPreview = false }: {
  job: Job; customer?: Customer; onBack: () => void;
  onUpdateJob: (patch: Partial<Job>) => void | Promise<any>; toast: (msg: string, tone?: any) => void;
  companyName?: string; onComplete?: () => void; perms?: Record<string, boolean>; maxLunchMinutes?: number;
  onJobCompleted?: (job: Job) => void; googleMapsKey?: string; paidLunchBreaks?: boolean; signOffDisclaimer?: string;
  settings?: AppSettings; setEstimates?: any; nextJob?: Job | null; nextJobCustomer?: Customer | null;
  onArrived?: () => void; autoComplete?: boolean; employeeName?: string; isPreview?: boolean;
}) {
  const effPerms = { ...DEFAULT_PERMISSIONS, ...(permsOverride || {}) };
  const [note, setNote] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delayNoteOpen, setDelayNoteOpen] = useState(false);
  const [runningLateOpen, setRunningLateOpen] = useState(false);
  const [sendingRunningLate, setSendingRunningLate] = useState(false);
  const [lateReasonNote, setLateReasonNote] = useState("");
  const [lateChannel, setLateChannel] = useState<"sms" | "email">(customer?.phone ? "sms" : "email");
  const [otwOpen, setOtwOpen] = useState(false);
  const [otwChannel, setOtwChannel] = useState<"sms" | "email">(customer?.phone ? "sms" : "email");
  const [sendingOtw, setSendingOtw] = useState(false);
  // FIX 8 — "Report Problem": lets the employee flag an issue (broken
  // equipment, property damage, etc.) straight from the job, the same way
  // OTW/Running Late already notify the customer — this notifies the owner
  // instead, and leaves a permanent record on the job so it shows up in Live
  // Crew View.
  const [reportProblemOpen, setReportProblemOpen] = useState(false);
  const [reportProblemText, setReportProblemText] = useState("");
  const [sendingReportProblem, setSendingReportProblem] = useState(false);
  const [, forceTick] = useState(0);
  const [showSignOff, setShowSignOff] = useState(false);
  // Tracks whether Sign-Off was opened from mid-way through the Complete Job
  // flow ("Get Sign-Off First"), so saving the signature resumes that flow
  // instead of dropping back to the plain job detail view.
  const [signOffReturnToComplete, setSignOffReturnToComplete] = useState(false);
  const [signerName, setSignerName] = useState("");
  // "Complete Job" flow: review (checklist/sign-off status) → payment → summary
  const [completeStep, setCompleteStep] = useState<"" | "review" | "payment" | "method" | "invoice" | "invoice-preview" | "summary">("");
  const [paidChoice, setPaidChoice] = useState<"yes" | "no" | "">("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [sendingCompleteInvoice, setSendingCompleteInvoice] = useState(false);
  const [completeSummary, setCompleteSummary] = useState<{ hours: number; amount: number; paymentStatus: string } | null>(null);
  const [invoiceEditSubject, setInvoiceEditSubject] = useState("");
  const [invoiceEditNote, setInvoiceEditNote] = useState("");
  const [invoiceChannel, setInvoiceChannel] = useState<"email" | "sms">("email");

  // CRITICAL FIX — Complete Job wizard's "Google isn't connected" banner (and
  // the same banner on Running Late/OTW below) used to check
  // settings.googleConnected, which is only ever true on the owner's OWN
  // device (set by applyGoogleIdentity in App.tsx from that device's
  // Supabase auth session). An employee's phone never has that flag, even
  // though sendOwnerGmailOnly/sendInvoiceFromPortal already fetch a working
  // token cross-device via getStoredGoogleConnection() → fetchOwnerGoogleToken()
  // (see lib/messaging.ts) — so the send actually works while this banner
  // wrongly claimed it wouldn't. Check the SAME two sources the real send
  // path uses, so the banner reflects reality instead of a device-local flag.
  const [googleLive, setGoogleLive] = useState<boolean>(() => !!getStoredGoogleConnection()?.token);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (getStoredGoogleConnection()?.token) { if (!cancelled) setGoogleLive(true); return; }
      const cloud = await fetchOwnerGoogleToken();
      if (!cancelled) setGoogleLive(!!cloud?.token);
    };
    check();
    window.addEventListener("focus", check);
    return () => { cancelled = true; window.removeEventListener("focus", check); };
  }, []);

  // Auto-start the complete flow when the parent tells us to (e.g. tapping
  // "Complete" directly on a Today-tab job card rather than going through
  // View Details first).
  useEffect(() => {
    if (autoComplete && job.status !== "completed") {
      setCompleteStep("review");
      setPaidChoice("");
      setPaymentMethod("");
    }
  }, []); // run once on mount // eslint-disable-line react-hooks/exhaustive-deps

  const hasRequiredGear = (job.equipment || []).length > 0 || (job.requiredChemicals || []).length > 0;
  const sendRunningLate = async (minutes: number) => {
    setSendingRunningLate(true);
    const nowMs = Date.now() + minutes * 60000;
    const newEta = new Date(nowMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const noteStr = lateReasonNote.trim() ? ` Reason: ${lateReasonNote.trim()}.` : "";
    const msg = `Your CrewBoss technician is running approximately ${minutes} minutes behind.${noteStr} New ETA: ${newEta}. We apologize for the delay.`;
    try {
      if (lateChannel === "sms") {
        if (!customer?.phone) throw new Error("No phone on file for this customer.");
        await withTimeout(twilioSend(settings as any, customer.phone, `Hi ${customer.firstName}, ${msg}`), 15000, "Running late SMS");
        logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: `Hi ${customer.firstName}, ${msg}` }).catch(() => {});
      } else {
        if (!customer?.email) throw new Error("No email on file for this customer.");
        const html = emailShell(companyName, "Running Late", `<p>Hi ${customer.firstName},</p><p>${msg}</p>`);
        await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, "Your technician is running late", html), 15000, "Running late email");
      }
      const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
      if (ownerEmail) {
        const ownerHtml = emailShell(companyName, "Crew Running Late", `<p>${customer ? customer.firstName + " " + customer.lastName : job.address} — running ~${minutes} min late${lateReasonNote.trim() ? ` (${lateReasonNote.trim()})` : ""}.</p><p>Address: ${job.address}</p>`);
        sendOwnerGmailOnly(settings as any, ownerEmail, `Running late — ${job.address}`, ownerHtml).catch(() => {});
      }
      const newScheduledTime = shiftScheduledTime(job.scheduledTime, minutes);
      onUpdateJob({
        commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: today(), note: `⏱ Running late +${minutes}min — notified customer via ${lateChannel === "sms" ? "text" : "email"}${lateReasonNote.trim() ? ` (${lateReasonNote.trim()})` : ""}` }],
        ...(newScheduledTime ? { scheduledTime: newScheduledTime } : {}),
      });
      toast(`✅ Message sent to ${customer?.firstName || "customer"}`, "green");
      console.log("[Verify] Running Late toast + send — working");
      setRunningLateOpen(false);
      setLateReasonNote("");
    } catch (e: any) {
      console.error("[RunningLate] — error:", e?.message || e);
      toast(`❌ Failed to send — ${e?.message || "reason unknown"}`, "red");
    } finally {
      setSendingRunningLate(false);
    }
  };

  const sendOtw = async () => {
    setSendingOtw(true);
    const msg = `Hi ${customer?.firstName || "there"}, your CrewBoss technician is on the way!`;
    try {
      if (otwChannel === "sms") {
        if (!customer?.phone) throw new Error("No phone on file for this customer.");
        await withTimeout(twilioSend(settings as any, customer.phone, msg), 15000, "OTW SMS");
        logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: msg }).catch(() => {});
      } else {
        if (!customer?.email) throw new Error("No email on file for this customer.");
        const html = emailShell(companyName, "On My Way", `<p>${msg}</p>`);
        await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, "Your technician is on the way", html), 15000, "OTW email");
      }
      onUpdateJob({ commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: today(), note: `📍 On my way message sent via ${otwChannel === "sms" ? "text" : "email"}` }] });
      toast(`✅ Message sent to ${customer?.firstName || "customer"}`, "green");
      console.log("[Verify] On My Way toast + send — working");
      setOtwOpen(false);
    } catch (e: any) {
      console.error("[OTW] — error:", e?.message || e);
      toast(`❌ Failed to send — ${e?.message || "reason unknown"}`, "red");
    } finally {
      setSendingOtw(false);
    }
  };

  // FIX 8 — "Report Problem": logs to commLog (so it's visible to the owner
  // wherever job activity already shows, including Live Crew View) AND emails
  // the owner immediately, matching the toast-on-success-and-failure
  // convention every other send action in this file follows.
  const sendReportProblem = async () => {
    if (!reportProblemText.trim()) { toast("Describe the issue first", "red"); return; }
    setSendingReportProblem(true);
    const note = `🚨 ISSUE REPORTED by ${employeeName || "crew"}: ${reportProblemText.trim()}`;
    try {
      const result = await withTimeout(Promise.resolve(onUpdateJob({ commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: today(), note }] })), 15000, "Report problem save");
      if (result?.error) {
        console.error("[ReportProblem] — error:", result.error.message);
        toast("Saved locally, but failed to sync — " + result.error.message, "red");
        return;
      }
      const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
      if (ownerEmail) {
        const html = emailShell(companyName, "Issue Reported", `<p><b>${employeeName || "A crew member"}</b> reported an issue on the job at <b>${job.address || "a job"}</b>:</p><p style="background:#fff3cd;color:#333;padding:10px;border-radius:6px">${reportProblemText.trim()}</p>`);
        sendOwnerGmailOnly(settings as any, ownerEmail, `⚠️ Issue reported — ${job.address || "job"}`, html).catch((e: any) => console.warn("[ReportProblem] owner email failed:", e?.message));
      }
      toast("Problem reported to the owner ✓", "green");
      console.log("[ReportProblem] logged for job", job.id);
      setReportProblemOpen(false);
      setReportProblemText("");
    } catch (e: any) {
      console.error("[ReportProblem] — error:", e?.message || e);
      toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red");
    } finally {
      setSendingReportProblem(false);
    }
  };

  const addPhoto = async (type: "before" | "after", dataUrl: string) => {
    const id = uid();
    const caption = (type === "before" ? "Before" : "After") + " — " + today();
    const url = await uploadJobMedia(dataUrlToBlob(dataUrl), `${job.id}/photo-${id}.jpg`, "image/jpeg");
    const newPhoto = url ? { id, type, caption, url, uploadedAt: today() } : { id, type, caption, dataUrl, uploadedAt: today() };
    const nextPhotos = [...(job.photos || []), newPhoto];
    try {
      const result = await withTimeout(Promise.resolve(onUpdateJob({ photos: nextPhotos })), 15000, "Photo upload");
      if (result?.error) {
        console.error("[PhotoSync] — error:", result.error.message);
        toast("Photo saved locally, but failed to sync — " + result.error.message, "red");
      } else {
        toast(type === "before" ? "Before photo added ✓" : "After photo added ✓", "green");
      }
    } catch (e: any) {
      console.error("[PhotoSync] — error:", e?.message || e);
      toast("Photo saved locally, but failed to sync — " + (e?.message || "unknown error"), "red");
    }
  };

  const addVideo = async (file: File) => {
    // ITEM 11 — shared with PortalChecklistSection's checklist-item video
    // capture (see checkVideoLimits) so both paths enforce the same cap.
    const limitErr = await checkVideoLimits(file);
    if (limitErr) { toast(limitErr, "red"); return; }
    const r = new FileReader();
    r.onload = async ev => {
      const dataUrl = ev.target!.result as string;
      const id = uid();
      const ext = (file.type.split("/")[1] || "mp4").replace("quicktime", "mov");
      const url = await uploadJobMedia(file, `${job.id}/video-${id}.${ext}`, file.type);
      const newVideo = url ? { id, url, caption: "Field video", addedAt: today() } : { id, dataUrl, caption: "Field video", addedAt: today() };
      onUpdateJob({ videos: [...(job.videos || []), newVideo] });
      toast("Video added ✓");
    };
    r.readAsDataURL(file);
  };

  const addNote = () => {
    if (!note.trim()) return;
    // FIX 6 — full ISO timestamp (not just today()'s bare date) so the owner
    // can tell when during the day a note was left, not just which day. The
    // "today's field notes" dashboard alerts match on the date PREFIX (see
    // App.tsx / Dashboard.tsx), so this stays compatible with those.
    const entry = { id: uid(), type: "note" as const, date: new Date().toISOString(), note: note.trim() };
    onUpdateJob({ commLog: [...(job.commLog || []), entry] });
    setNote("");
    toast("Note added ✓", "green");
  };

  // Saves the signature only — completion itself (and any payment info) is
  // handled by the separate "Complete Job" flow, so sign-off can happen
  // independently without forcing the job closed.
  const saveSignOff = async () => {
    if (sigMode === "type") {
      if (!signerName.trim()) return;
    } else if (!sigDrawData) return;
    let sigUrl: string | undefined;
    if (sigMode === "draw" && sigDrawData) {
      sigUrl = (await uploadJobMedia(dataUrlToBlob(sigDrawData), `${job.id}/signoff-${uid()}.png`, "image/png")) || undefined;
    }
    const signOff: any = {
      signerName: signerName.trim() || "Drawn signature",
      timestamp: new Date().toISOString(),
      sigType: sigMode,
      ...(sigMode === "draw" ? (sigUrl ? { sigUrl } : { sigData: sigDrawData }) : {}),
    };
    // AUDIT H (mobile round 4) — this used to fire onUpdateJob and
    // unconditionally toast "saved" without awaiting the result. onUpdateJob
    // never rejects (it resolves {error} on failure, see updateJob above), so
    // a genuine Supabase save failure was silently swallowed — the customer's
    // signature could be lost while the employee saw a green success toast.
    try {
      const result = await withTimeout(Promise.resolve(onUpdateJob({ signOff })), 15000, "Sign-off save");
      if (result?.error) {
        toast("Sign-off not saved — " + result.error.message, "red");
        return;
      }
      toast("Sign-off saved ✓", "green");
    } catch (e: any) {
      toast("Sign-off not saved — " + (e?.message || "unknown error"), "red");
      return;
    }
    setShowSignOff(false);
    if (signOffReturnToComplete) {
      setSignOffReturnToComplete(false);
      setCompleteStep("review");
    }
  };

  // AUDIT H (mobile round 4) — checklist toggle/notes/photo/video actions
  // (PortalChecklistSection's onUpdate) used to call onUpdateJob completely
  // fire-and-forget, with no toast at all on success or failure. A failed
  // save (RLS, dropped connection, etc.) looked identical to a successful one
  // — the checkbox visually flipped locally but nothing was actually
  // persisted. Only toast on FAILURE here (not on every successful toggle —
  // the checkbox itself is the success confirmation and a toast on every tap
  // would be noisy), matching this file's other checklist-adjacent saves.
  const saveChecklist = async (label: string, patch: Partial<Job>) => {
    try {
      const result = await withTimeout(Promise.resolve(onUpdateJob(patch)), 15000, label + " checklist save");
      if (result?.error) toast(label + " checklist item didn't save — " + result.error.message, "red");
    } catch (e: any) {
      toast(label + " checklist item didn't save — " + (e?.message || "unknown error"), "red");
    }
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

  const beforePhoto = (job.photos || []).find(p => p.type === "before" && (p.url || p.dataUrl));
  const afterPhoto = (job.photos || []).find(p => p.type === "after" && (p.url || p.dataUrl));

  const preItems = job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS;
  const durItems = job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS;
  const postItems = job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS;
  const allItems = [...preItems, ...durItems, ...postItems];
  const allDone = allItems.length > 0 && allItems.every(i => i.done);

  // "Complete Job" flow — review status, collect payment info, finalize.
  const checklistRemaining = allItems.filter(i => !i.done).length;
  const startCompleteFlow = () => { setCompleteStep("review"); setPaidChoice(""); setPaymentMethod(""); };

  const sendInvoiceFromPortal = async (customSubject?: string, customNote?: string) => {
    console.log("[SendInvoice] sendInvoiceFromPortal called — channel:", invoiceChannel, "job:", job.id, "customer:", customer?.id);
    if (!customer?.email && !customer?.phone) {
      console.warn("[SendInvoice] aborting — no email or phone on file for customer", customer?.id);
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
      // [SendInvoice] this used to ONLY call setEstimates (local React state)
      // with no Supabase insert at all — the same "local-state-only mutation"
      // anti-pattern already found and fixed in InvoicesPage.tsx's markPaid.
      // The payLink texted/emailed to the customer points at
      // #/estimate/{newInv.id}; if that row never reaches Supabase, the
      // customer's link 404s and the invoice never appears anywhere in the
      // owner's CRM (InvoicesPage reads straight from Supabase) — from the
      // owner's side that's indistinguishable from "Send Invoice did
      // nothing," even though the employee's own screen shows a success
      // toast. Insert BEFORE sending so a save failure fails loud (via the
      // catch below) instead of handing the customer a dead link.
      console.log("[SendInvoice] inserting new invoice", newInv.id, "for customer", customer?.id, "amount", newInv.total);
      // [SendInvoice] this insert previously had no timeout guard — if Supabase
      // hung (e.g. a stuck internal navigator-lock, the exact scenario
      // withTimeout's own doc comment describes), this await never resolved OR
      // rejected, so the function never reached the catch/finally below and the
      // button was stuck on "Sending…" forever with no toast, no error, nothing.
      const insertResult = await withTimeout<any>((supabase as any).from("estimates").insert(newInv), 10000, "Invoice save");
      if (insertResult?.error) {
        console.error("[SendInvoice] estimate insert failed:", insertResult.error.message);
        throw new Error("Couldn't save invoice — " + insertResult.error.message);
      }
      console.log("[SendInvoice] invoice saved to Supabase ✓");
      setEstimates((prev: any[]) => [...prev, newInv]);
      // FIX 17 — #/portal/ID is the employee portal's route, not a customer
      // invoice view; #/estimate/ID is the public no-login pay/sign portal.
      const payLink = `${window.location.origin}${window.location.pathname}#/estimate/${newInv.id}`;
      const subject = customSubject?.trim() || `Invoice — ${companyName}`;
      const noteHtml = customNote?.trim() ? `<p style="font-style:italic;color:rgba(255,255,255,0.6)">${customNote.trim()}</p>` : "";
      if (invoiceChannel === "sms") {
        if (!customer.phone) throw new Error("No phone on file for this customer.");
        console.log("[SendInvoice] sending via SMS to", customer.phone);
        await withTimeout(twilioSend(settings as any, customer.phone, `Hi ${customer.firstName}, your invoice for ${fmt(Number(job.amount) || 0)} is ready: ${payLink}`), 15000, "Invoice SMS");
        console.log("[SendInvoice] SMS send resolved ✓");
        toast(`Invoice texted to ${customer.firstName} ✓`, "green");
        logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: `Hi ${customer.firstName}, your invoice for ${fmt(Number(job.amount) || 0)} is ready: ${payLink}` }).catch(() => {});
      } else {
        if (!customer.email) throw new Error("No email on file for this customer.");
        const html = emailShell(companyName, "Invoice", `<p>Hi ${customer.firstName},</p>${noteHtml}<p>Thanks for choosing us! Your service at <b>${job.address}</b> is complete.</p><p><b>Amount due:</b> $${(Number(job.amount) || 0).toFixed(2)}</p>` + emailButton("View & Pay Invoice", payLink));
        console.log("[SendInvoice] sending via Gmail to", customer.email);
        await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, subject, html), 10000, "Invoice email");
        console.log("[SendInvoice] Gmail send resolved ✓");
        toast(`📧 Invoice emailed to ${customer.firstName} ✓`, "green");
      }
      return true;
    } catch (err: any) {
      console.error("[SendInvoice] invoice send — error:", err?.message || err);
      toast(`Failed to send invoice — ${err?.message || "unknown error"}`, "red");
      return false;
    } finally {
      setSendingCompleteInvoice(false);
      console.log("[SendInvoice] sendInvoiceFromPortal finished, sendingCompleteInvoice reset to false");
    }
  };

  const finalizeCompletion = async (paymentStatus: "Paid" | "Pending", method?: string, invoiceSent?: boolean) => {
    let hrs = Number(job.loggedHours) || 0;
    const patch: Partial<Job> = { status: "completed", completedAt: new Date().toISOString(), pipelineStage: paymentStatus === "Paid" ? "paid" : "completed" };
    if (job.clockInAt) {
      const lunchMs = paidLunchBreaks ? 0 : (job.lunchMinutes || 0) * 60000;
      const added = Math.round((Date.now() - job.clockInAt - lunchMs) / 36000) / 100;
      hrs = Math.round((hrs + added) * 100) / 100;
      patch.clockInAt = null; patch.lunchStartAt = null; patch.loggedHours = hrs;
    } else if (job.arrivedAt && !hrs) {
      // FIX 3 — employees normally never set the per-job clockInAt at all (only
      // the owner's own JobDetailModal Clock In/Out uses it); the field portal's
      // "I'm Here" button only sets arrivedAt + the whole-day shift timer. Without
      // this fallback, loggedHours stayed 0 forever for every employee-completed
      // job, which is why hours/pay never showed up in the owner's Hours/Payroll
      // tabs or the employee's own Pay tab — those all read job.loggedHours.
      const lunchMs = paidLunchBreaks ? 0 : (job.lunchMinutes || 0) * 60000;
      const added = Math.max(0, Math.round((Date.now() - job.arrivedAt - lunchMs) / 36000) / 100);
      hrs = added;
      patch.loggedHours = hrs;
    }
    if (paymentStatus === "Paid") {
      patch.paymentType = (method as any) || "Cash";
      patch.paymentStatus = "Paid";
      patch.amountCollected = Number(job.amount) || 0;
    } else {
      patch.paymentStatus = "Pending";
      if (invoiceSent) { patch.paymentType = "Invoice"; patch.invoiceSentAt = today(); }
    }
    // Show the summary immediately (local state already reflects completion),
    // but await the actual Supabase write so the toast tells the truth and the
    // completion can't silently revert on the next poll. onJobCompleted (rating +
    // calendar sync) is best-effort — a throw in there must never block the
    // screen from advancing to the summary.
    try { onJobCompleted?.({ ...job, ...patch } as Job); } catch (e) { console.warn("[Complete Job] onJobCompleted callback failed:", e); }
    // FEATURE 3 (mobile round 7) — the owner previously got NO email at all
    // when a job finished (only an end-of-day rollup, hours-only, no
    // checklist/signature/photos). Best-effort, non-blocking — a failed
    // notification email must never stop the completion flow itself.
    // Skipped entirely in the owner's read-only "Team Portal" preview
    // (isPreview) so walking through the wizard there doesn't fire a real
    // "job completed" email about a completion that was never actually saved.
    if (!isPreview) (async () => {
      const ownerEmail = settings?.myEmail || settings?.companyEmail;
      if (!ownerEmail) return;
      const completedJob = { ...job, ...patch } as any;
      const allChecklist = [...(completedJob.preChecklist || []), ...(completedJob.duringChecklist || []), ...(completedJob.postChecklist || []), ...(completedJob.checklist || [])];
      const ckDone = allChecklist.filter((c: any) => c.done).length;
      const empName = employeeName || "A crew member";
      const companyName = settings?.companyName || "Crew Boss";
      const photoCount = totalJobPhotoCount(completedJob);
      const beforeAfterThumbs = (completedJob.photos || []).slice(0, 4).filter((p: any) => p.url || p.dataUrl)
        .map((p: any) => `<img src="${mediaSrc(p.url, p.dataUrl)}" alt="${p.type || "photo"}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;margin:0 6px 6px 0" />`).join("");
      const sigImg = (job.signOff?.sigUrl || job.signOff?.sigData) ? `<img src="${mediaSrc(job.signOff.sigUrl, job.signOff.sigData)}" alt="signature" style="max-width:260px;background:#fff;border-radius:6px;padding:6px;margin-top:4px" />` : "";
      const rows = `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Technician</span><strong>${empName}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Address</span><strong>${job.address || ""}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Checklist completed</span><strong>${ckDone}/${allChecklist.length}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Payment status</span><strong>${patch.paymentStatus}${patch.paymentType ? " (" + patch.paymentType + ")" : ""}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Amount</span><strong>${fmt(patch.amountCollected ?? job.amount ?? 0)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Photos attached</span><strong>${photoCount}</strong></div>
      `;
      const customerLine = customer ? `<p>Customer: <b>${customer.firstName} ${customer.lastName}</b></p>` : "";
      const notesHtml = job.notes ? `<p><b>Notes:</b> ${job.notes}</p>` : "";
      const sigHtml = job.signOff ? `<p><b>Signed by:</b> ${job.signOff.signerName || "customer"}${sigImg}</p>` : "<p style=\"color:#999\">No customer sign-off collected.</p>";
      const photosHtml = beforeAfterThumbs ? `<p><b>Photos:</b></p><div>${beforeAfterThumbs}</div>` : "";
      sendEmail(settings as any, {
        to: ownerEmail, subject: `Job completed — ${empName} — ${job.address || ""}`,
        body: emailShell(companyName, "Job Completed", `<p>${empName} just completed a job.</p>${customerLine}${rows}${notesHtml}${sigHtml}${photosHtml}`),
      }).catch((e: any) => console.warn("[Complete Job] owner summary email failed:", e?.message));
    })();
    setCompleteSummary({ hours: hrs, amount: Number(job.amount) || 0, paymentStatus: paymentStatus === "Paid" ? `Paid (${patch.paymentType})` : invoiceSent ? "Unpaid — Invoice Sent" : "Unpaid" });
    setCompleteStep("summary");
    try {
      const result = await withTimeout(Promise.resolve(onUpdateJob(patch)), 15000, "Mark complete save");
      if (result?.error) {
        console.error("[Complete Job] — error:", result.error.message || result.error);
        toast("Completed locally, but the server didn't confirm — " + (result.error.message || "check connection"), "red");
      } else {
        toast("✅ Job completed successfully", "green");
      }
    } catch (e: any) {
      console.error("[Complete Job] — error:", e?.message || e);
      toast("Completed locally, but the server didn't confirm — " + (e?.message || "check connection"), "red");
    }
  };

  // ── Customer sign-off overlay ─────────────────────────────────────────────
  if (showSignOff) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="sticky top-0 z-20 bg-black/95 border-b border-red-900/30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setShowSignOff(false); if (signOffReturnToComplete) { setSignOffReturnToComplete(false); setCompleteStep("review"); } }} className="p-2 rounded-xl hover:bg-white/10 text-white/60 -ml-2">
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
                <BeforeAfterSlider before={mediaSrc(beforePhoto.url, beforePhoto.dataUrl)} after={mediaSrc(afterPhoto.url, afterPhoto.dataUrl)} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {beforePhoto && <div className="rounded-xl overflow-hidden aspect-video"><img src={mediaSrc(beforePhoto.url, beforePhoto.dataUrl)} alt="Before" className="w-full h-full object-cover" /></div>}
                  {afterPhoto && <div className="rounded-xl overflow-hidden aspect-video"><img src={mediaSrc(afterPhoto.url, afterPhoto.dataUrl)} alt="After" className="w-full h-full object-cover" /></div>}
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
                <GBtn variant="ghost" onClick={() => { setCompleteStep(""); setSignOffReturnToComplete(true); setShowSignOff(true); }} className="w-full !justify-center">
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
              <div className="text-lg font-bold">Has the customer paid yet?</div>
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
              <div className="text-sm text-white/50">Amount: <span className="text-green-400 font-semibold">{fmt(job.amount)}</span> · {customer?.firstName || "Customer"}</div>
              {/* Channel selector */}
              <div className="flex gap-2">
                {(["email", "sms"] as const).map(ch => (
                  <button key={ch} onClick={() => setInvoiceChannel(ch)}
                    className={"flex-1 py-2 rounded-xl border text-sm font-semibold transition " + (invoiceChannel === ch ? "border-red-500/60 bg-red-950/30 text-red-300" : "border-white/10 bg-white/5 text-white/50 hover:border-white/30")}>
                    {ch === "email" ? "📧 Email" : "💬 Text"}
                  </button>
                ))}
              </div>
              {invoiceChannel === "email" && !customer?.email && (
                <div className="text-xs text-yellow-400/80 bg-yellow-950/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                  No email on file — add one in customer settings or switch to Text.
                </div>
              )}
              {invoiceChannel === "sms" && !customer?.phone && (
                <div className="text-xs text-yellow-400/80 bg-yellow-950/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                  No phone on file — add one in customer settings or switch to Email.
                </div>
              )}
              {invoiceChannel === "email" && customer?.email && !googleLive && (
                <div className="text-xs text-yellow-400/80 bg-yellow-950/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                  Google isn't connected — connect it in Settings → Integrations, or switch to Text.
                </div>
              )}
              {invoiceChannel === "sms" && customer?.phone && !settings?.twilioSid && (
                <div className="text-xs text-yellow-400/80 bg-yellow-950/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                  Twilio isn't configured — add it in Settings → Integrations, or switch to Email.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <GBtn onClick={() => {
                  // [SendInvoice] — this used to be a *silently disabled*
                  // button (no onClick fires at all on a disabled element)
                  // whenever the customer had no email/phone on file for the
                  // selected channel. From the employee's side that reads as
                  // "I pressed Send Invoice and nothing happened at all" —
                  // no toast, no error, because the click never even
                  // registered. Always clickable now; if contact info is
                  // genuinely missing, say so out loud instead of just
                  // dimming the button.
                  console.log("[SendInvoice] 'Yes — Preview' clicked — channel:", invoiceChannel, "customer:", customer?.id, "email:", customer?.email, "phone:", customer?.phone);
                  if (invoiceChannel === "email" && !customer?.email) {
                    toast("No email on file for this customer — add one or switch to Text.", "red");
                    return;
                  }
                  if (invoiceChannel === "sms" && !customer?.phone) {
                    toast("No phone on file for this customer — add one or switch to Email.", "red");
                    return;
                  }
                  setInvoiceEditSubject(`Invoice — ${companyName}`);
                  setInvoiceEditNote("");
                  setCompleteStep("invoice-preview");
                }} className="!py-3 !justify-center">
                  Yes — Preview
                </GBtn>
                <GBtn variant="ghost" onClick={() => finalizeCompletion("Pending", undefined, false)} className="!py-3 !justify-center">
                  No, Skip
                </GBtn>
              </div>
            </>
          )}

          {completeStep === "invoice-preview" && (
            <>
              <div className="text-lg font-bold">Invoice Preview</div>
              <Glass className="p-4 !bg-black/40 space-y-3">
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-0.5">To</div>
                  <div className="text-sm font-semibold">{customer?.firstName} {customer?.lastName}</div>
                  <div className="text-xs text-white/40">{customer?.email || customer?.phone || "No contact on file"}</div>
                </div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Subject</div>
                  <input value={invoiceEditSubject} onChange={e => setInvoiceEditSubject(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/40 uppercase tracking-wider">Amount Due</div>
                  <div className="text-2xl font-black text-green-400">{fmt(job.amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Job</div>
                  <div className="text-sm text-white/70">{job.address}</div>
                  {job.notes && <div className="text-xs text-white/40 mt-1 italic">{job.notes}</div>}
                </div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Note to customer (optional)</div>
                  <textarea value={invoiceEditNote} onChange={e => setInvoiceEditNote(e.target.value)}
                    rows={2} placeholder="Thank you for your business! Let us know if you have any questions."
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 resize-none focus:outline-none focus:border-red-500/50" />
                </div>
              </Glass>
              <div className="grid grid-cols-2 gap-3">
                <GBtn onClick={async () => {
                  console.log("[SendInvoice] 'Send Invoice ✓' clicked");
                  const sent = await sendInvoiceFromPortal(invoiceEditSubject, invoiceEditNote);
                  console.log("[SendInvoice] sendInvoiceFromPortal returned:", sent);
                  if (sent) finalizeCompletion("Pending", undefined, true);
                }} disabled={sendingCompleteInvoice} className="!py-3 !justify-center !bg-gradient-to-r !from-green-700 !to-green-900 !border-green-600/50">
                  {sendingCompleteInvoice ? "Sending…" : "Send Invoice ✓"}
                </GBtn>
                <GBtn variant="ghost" onClick={() => setCompleteStep("invoice")} className="!py-3 !justify-center">
                  Back
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
        {customer ? (
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
        ) : job.customerId ? (
          <Glass className="p-4 !bg-black/40">
            <div className="text-sm text-white/40 italic">Customer info loading...</div>
          </Glass>
        ) : null}

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

        {/* Running Late — proactively warn the customer (and owner) on any active job. */}
        {job.status !== "completed" && job.status !== "cancelled" && (customer?.phone || customer?.email) && (
          <Glass className="p-3 !bg-orange-950/15 !border-orange-700/30">
            {runningLateOpen ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-orange-300">Running Late — notify customer</div>
                {/* Send via — never silently defaults to a provider that isn't configured */}
                <div>
                  <div className="text-[10px] text-white/50 mb-1.5">Send via</div>
                  <div className="flex gap-1.5">
                    <button disabled={!customer?.phone} onClick={() => setLateChannel("sms")}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-30 " + (lateChannel === "sms" ? "border-orange-500 bg-orange-900/40 text-orange-200" : "border-white/10 bg-black/30 text-white/50 hover:border-white/30")}>
                      💬 Text
                    </button>
                    <button disabled={!customer?.email} onClick={() => setLateChannel("email")}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-30 " + (lateChannel === "email" ? "border-orange-500 bg-orange-900/40 text-orange-200" : "border-white/10 bg-black/30 text-white/50 hover:border-white/30")}>
                      📧 Email
                    </button>
                  </div>
                  {lateChannel === "sms" && !settings?.twilioSid && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">Twilio isn't configured — add it in Settings → Integrations, or switch to Email.</div>
                  )}
                  {lateChannel === "email" && !googleLive && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">Google isn't connected — connect it in Settings → Integrations, or switch to Text.</div>
                  )}
                </div>
                {/* Reason templates */}
                <div>
                  <div className="text-[10px] text-white/50 mb-1.5">Reason (optional)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Stuck in traffic", "Previous job ran over", "Equipment issue", "Weather delay"].map(t => (
                      <button key={t} onClick={() => setLateReasonNote(lateReasonNote === t ? "" : t)}
                        className={"text-[10px] px-2.5 py-1 rounded-lg border transition " + (lateReasonNote === t ? "bg-orange-800/50 border-orange-500/60 text-orange-200" : "bg-white/5 border-white/15 text-white/60 hover:border-orange-700/40 hover:text-orange-300")}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={lateReasonNote}
                    onChange={e => setLateReasonNote(e.target.value)}
                    placeholder="Custom note…"
                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-orange-700/60"
                  />
                </div>
                {/* Time picker */}
                <div>
                  <div className="text-[10px] text-white/50 mb-1.5">How many minutes late?</div>
                  <div className="flex gap-1.5">
                    {[5, 10, 15, 20, 30].map(m => (
                      <button key={m} disabled={sendingRunningLate} onClick={() => sendRunningLate(m)} className="flex-1 py-2 rounded-lg bg-orange-900/30 border border-orange-700/40 text-orange-300 text-sm font-semibold hover:bg-orange-900/50 disabled:opacity-50 transition">
                        {sendingRunningLate ? "…" : m}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => { setRunningLateOpen(false); setLateReasonNote(""); }} className="text-[11px] text-white/30 hover:text-white/60">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setRunningLateOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-orange-300 hover:text-orange-200 transition">
                <Clock size={12} />Running Late
              </button>
            )}
          </Glass>
        )}

        {/* On My Way — send channel choice, never silently defaults away from the chosen channel */}
        {job.status !== "completed" && job.status !== "cancelled" && (customer?.phone || customer?.email) && (
          <Glass className="p-3 !bg-blue-950/15 !border-blue-700/30">
            {otwOpen ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-blue-300">On My Way — notify customer</div>
                <div>
                  <div className="text-[10px] text-white/50 mb-1.5">Send via</div>
                  <div className="flex gap-1.5">
                    <button disabled={!customer?.phone} onClick={() => setOtwChannel("sms")}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-30 " + (otwChannel === "sms" ? "border-blue-500 bg-blue-900/40 text-blue-200" : "border-white/10 bg-black/30 text-white/50 hover:border-white/30")}>
                      💬 Text
                    </button>
                    <button disabled={!customer?.email} onClick={() => setOtwChannel("email")}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-30 " + (otwChannel === "email" ? "border-blue-500 bg-blue-900/40 text-blue-200" : "border-white/10 bg-black/30 text-white/50 hover:border-white/30")}>
                      📧 Email
                    </button>
                  </div>
                  {otwChannel === "sms" && !settings?.twilioSid && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">Twilio isn't configured — add it in Settings → Integrations, or switch to Email.</div>
                  )}
                  {otwChannel === "email" && !googleLive && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">Google isn't connected — connect it in Settings → Integrations, or switch to Text.</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={sendingOtw}
                    onClick={sendOtw}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 border border-blue-500/60 text-white text-xs font-bold disabled:opacity-40 transition">
                    {sendingOtw ? "Sending…" : "Send"}
                  </button>
                  <button onClick={() => setOtwOpen(false)} className="text-[11px] text-white/30 hover:text-white/60 px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setOtwOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-300 hover:text-blue-200 transition">
                <Navigation size={12} />On My Way
              </button>
            )}
          </Glass>
        )}

        {/* FIX 8 — Report Problem: unlike OTW/Running Late, this doesn't need
            customer contact info at all — it goes to the owner, not the
            customer — so it's available on any active job regardless of
            whether the customer has a phone/email on file. */}
        {job.status !== "completed" && job.status !== "cancelled" && (
          <Glass className="p-3 !bg-red-950/15 !border-red-700/30">
            {reportProblemOpen ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-red-300">Report a Problem to the Owner</div>
                <textarea
                  value={reportProblemText}
                  onChange={e => setReportProblemText(e.target.value)}
                  rows={3}
                  placeholder="What's wrong? (e.g. broken equipment, property damage, safety issue...)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 resize-none focus:outline-none focus:border-red-700/60"
                />
                <div className="flex gap-2">
                  <button
                    disabled={sendingReportProblem}
                    onClick={sendReportProblem}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-red-600 to-red-800 border border-red-500/60 text-white text-xs font-bold disabled:opacity-40 transition">
                    {sendingReportProblem ? "Sending…" : "Send Report"}
                  </button>
                  <button onClick={() => { setReportProblemOpen(false); setReportProblemText(""); }} className="text-[11px] text-white/30 hover:text-white/60 px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setReportProblemOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-300 hover:text-red-200 transition">
                <AlertTriangle size={12} />Report Problem
              </button>
            )}
          </Glass>
        )}

        {/* I'm Here — mark arrival at this job location (active/today jobs only) */}
        {job.status !== "completed" && (
          <Glass className={"p-4 " + (job.arrivedAt ? "!bg-green-950/20 !border-green-700/40" : "!bg-black/40")}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Location Status</div>
                {job.arrivedAt ? (
                  <div className="text-sm font-semibold text-green-400">
                    ✓ Arrived — {new Date(job.arrivedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                ) : (
                  <div className="text-sm text-white/60">
                    {job.loggedHours ? `${job.loggedHours}h logged` : "Not arrived yet"}
                    {job.duration ? ` · Est. ${formatEstDuration(job.duration)}` : ""}
                  </div>
                )}
              </div>
              {!job.arrivedAt && (
                <GBtn onClick={() => {
                  onUpdateJob({ arrivedAt: Date.now(), status: job.status === "scheduled" ? "in_progress" : job.status });
                  toast("Marked as arrived ✓ — owner notified");
                  onArrived?.();
                }} className="!gap-2">
                  <MapPin size={14} />I'm Here
                </GBtn>
              )}
            </div>
          </Glass>
        )}

        {/* Photos & Videos */}
        <Glass className="p-4 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Image size={12} />Photos & Videos
          </div>
          {beforePhoto && afterPhoto && (
            <div className="mb-3">
              <BeforeAfterSlider before={mediaSrc(beforePhoto.url, beforePhoto.dataUrl)} after={mediaSrc(afterPhoto.url, afterPhoto.dataUrl)} />
            </div>
          )}
          {effPerms.can_upload_photos && (
            <div className="grid grid-cols-3 gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    compressImageFile(f).then(dataUrl => addPhoto("before", dataUrl));
                    e.target.value = "";
                  }} />
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs font-medium transition text-center">
                  <Plus size={13} /><span>📷 Before</span>
                </div>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    compressImageFile(f).then(dataUrl => addPhoto("after", dataUrl));
                    e.target.value = "";
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
              {(job.photos || []).map((p, i) => (p.url || p.dataUrl) ? (
                <div key={p.id || i} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img src={mediaSrc(p.url, p.dataUrl)} alt="" className="w-full h-full object-cover" />
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
                  <video src={mediaSrc(v.url, v.dataUrl)} controls className="w-full rounded-xl" style={{ maxHeight: 200 }} />
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
            jobId={job.id}
            title="Pre-Job" emoji="🔵" allowPhotos
            items={preItems}
            onUpdate={items => saveChecklist("Pre-Job", { preChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
            toast={toast}
          />
          <PortalChecklistSection
            jobId={job.id}
            title="During Job" emoji="🟡" allowPhotos
            items={durItems}
            onUpdate={items => saveChecklist("During-Job", { duringChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
            toast={toast}
          />
          <PortalChecklistSection
            jobId={job.id}
            title="Post-Job" emoji="🟢" allowPhotos
            items={postItems}
            onUpdate={items => saveChecklist("Post-Job", { postChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
            toast={toast}
          />
        </Glass>

        {/* Customer sign-off */}
        {job.signOff && (
          <Glass className="p-4 !bg-green-950/20 !border-green-700/30">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-green-400" />
              <div className="text-xs font-semibold text-green-300">Customer Signed Off</div>
            </div>
            {job.signOff.sigType === "draw" && (job.signOff.sigUrl || job.signOff.sigData) ? (
              <img src={mediaSrc(job.signOff.sigUrl, job.signOff.sigData)} alt="Signature" className="mt-1 bg-white rounded-lg max-h-20" />
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
function OwnerTeamPortal({ jobs, employees, customers, onClose, googleMapsKey, toast, settings }: {
  jobs: Job[]; employees: Employee[]; customers: Customer[]; onClose: () => void; googleMapsKey?: string; toast?: (msg: string, tone?: string) => void; settings?: any;
}) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  // ITEM 7 — match the real employee Today tab's 4am shift-day cutover (see
  // shiftDayStr's use below in the main portal) so the owner's preview of a
  // night worker's Today list doesn't disagree with what that employee
  // actually sees on their own device.
  const todayStr = shiftDayStr();

  const viewEmp = selectedEmpId === "all" ? null : employees.find(e => e.id === selectedEmpId);
  const viewEmpForFilter = selectedEmpId === "all" ? null : employees.find(e => e.id === selectedEmpId);
  const visibleJobs = selectedEmpId === "all"
    ? jobs
    // FIX 14 — same crew-matching bug class already fixed everywhere else
    // (naive .includes(id) silently misses object-shaped/stringified crew
    // entries or an employees.id vs employees.user_id mismatch) — here it
    // meant the owner's Team Portal preview, filtered to one employee,
    // could fail to show jobs (including recurring ones) that WERE actually
    // assigned to them.
    : jobs.filter(j => crewIncludesEmployee(j.crew, selectedEmpId, (viewEmpForFilter as any)?.user_id));
  const todayJobs = visibleJobs.filter(j => j.scheduledDate === todayStr && j.status !== "cancelled");

  if (selectedJobId) {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) { setSelectedJobId(null); return null; }
    const customer = customers.find(c => c.id === job.customerId);
    return (
      <JobDetailView
        job={job}
        customer={customer}
        onBack={() => setSelectedJobId(null)}
        // FIX 4 (mobile round 6) — this used to be a silent no-op
        // (`() => {}`), so the owner's "Team Portal" preview let them walk
        // through the ENTIRE Complete Job wizard (checklist, payment,
        // signature) with nothing ever persisted and no indication any of
        // it was inert — reads exactly like "pressing buttons does
        // nothing." This is intentionally a read-only preview of what an
        // employee sees (see CLAUDE.md's isOwnerView note), so make that
        // explicit instead of pretending to work: tell them plainly and
        // point at the real place to act.
        onUpdateJob={() => { toast?.("Preview only — open this job from the Jobs page to make real changes.", "yellow"); return Promise.resolve({}); }}
        toast={toast || (() => {})}
        googleMapsKey={googleMapsKey}
        // BLOCKER 9 (mobile round 7) — this was never passed, so OTW/Send
        // Invoice inside this preview called sendOwnerGmailOnly/twilioSend
        // with an empty {} settings object, which always throws "not
        // configured" regardless of the owner's real, working Twilio/Gmail
        // setup — reading exactly like "says send but doesn't send."
        // Threading the real settings through makes these buttons send for
        // real, same as everywhere else in the app.
        settings={settings}
        isPreview
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
          onClick={async () => { await supabase.auth.signOut({ scope: "local" }); }}
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
              const empJobs = jobs.filter(j => crewIncludesEmployee(j.crew, emp.id, (emp as any).user_id));
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
                        {c && (
                          <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap">
                            <span>{c.firstName} {c.lastName}</span>
                            {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/80 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                          </div>
                        )}
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
                      {c && (
                        <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap">
                          <span>{c.firstName} {c.lastName}</span>
                          {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/70 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                        </div>
                      )}
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

export function EmployeePortal({ empSession, setEmpSession, jobs, setJobs, employees, customers, setCustomers = (() => {}) as any, settings, toast, isOwnerView = false, onClose = () => {}, refetchEmployees, estimates = [], setEstimates = (() => {}) as any }: {
  empSession: any; setEmpSession: (s: any) => void;
  jobs: Job[]; setJobs: (fn: (prev: Job[]) => Job[]) => void;
  employees: Employee[]; customers: Customer[]; setCustomers?: any;
  settings: AppSettings; toast: (msg: string, tone?: any) => void;
  isOwnerView?: boolean; onClose?: () => void;
  refetchEmployees?: () => Promise<void>;
  estimates?: any[]; setEstimates?: any;
}) {
  // EGRESS FIX — skip the jobs poll below while the tab is hidden or the
  // employee has been idle 5+ minutes (e.g. mid-shift with the phone locked).
  const shouldPollJobs = usePollGate();
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
  const [pendingCompleteJobId, setPendingCompleteJobId] = useState<string | null>(null);
  const [activeJobMenuOpen, setActiveJobMenuOpen] = useState(false);
  // FEATURE 1 — shows "Shift ended · Total 7h 23m" for a few seconds after End My Day
  // FIX 11 — persists the "Shift ended · Total 7h 23m" banner for the REST of
  // the day (until the next calendar day), surviving reloads via localStorage.
  const [shiftEndedMsg, setShiftEndedMsgState] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem("smocks.shiftEnded");
      if (raw) { const o = JSON.parse(raw); if (o.date === new Date().toISOString().slice(0, 10)) return o.msg; }
    } catch { /* ignore */ }
    return null;
  });
  const setShiftEndedMsg = (msg: string | null) => {
    setShiftEndedMsgState(msg);
    try {
      if (msg) localStorage.setItem("smocks.shiftEnded", JSON.stringify({ date: new Date().toISOString().slice(0, 10), msg }));
      else localStorage.removeItem("smocks.shiftEnded");
    } catch { /* ignore */ }
  };
  // BUG 4 — Running Late picker state lives on the PARENT (keyed by job id), not
  // inside JobCard. JobCard is re-created on every 1s tick / 3s poll re-render,
  // which remounted it and reset any local useState — making the picker flash
  // shut. Hoisting it here keeps it open across those re-renders.
  const [lateOpenJobId, setLateOpenJobId] = useState<string | null>(null);
  const [lateNoteText, setLateNoteText] = useState("");
  const [sendingLateJobId, setSendingLateJobId] = useState<string | null>(null);
  // FIX 3 — selected minutes for the Running Late picker (parent-hoisted so it
  // survives the frequent re-renders). null = nothing picked yet.
  const [lateMinutes, setLateMinutes] = useState<number | null>(null);
  // FIX 2 — explicit Email/Text channel choice for Running Late + OTW on job
  // cards (never silently defaults away from the chosen channel). Shared across cards since only
  // one picker is open at a time.
  const [lateCardChannel, setLateCardChannel] = useState<"sms" | "email">("sms");
  const [otwOpenJobId, setOtwOpenJobId] = useState<string | null>(null);
  const [otwCardChannel, setOtwCardChannel] = useState<"sms" | "email">("sms");
  const [sendingOtwJobId, setSendingOtwJobId] = useState<string | null>(null);
  // CRITICAL FIX — same googleLive check as JobDetailView above: the job-card
  // OTW/Running Late banners used settings.googleConnected (owner-device-only)
  // instead of the actual cross-device token lookup the real send already
  // uses (sendOwnerGmailOnly → getStoredGoogleConnection/fetchOwnerGoogleToken).
  const [googleLiveCard, setGoogleLiveCard] = useState<boolean>(() => !!getStoredGoogleConnection()?.token);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (getStoredGoogleConnection()?.token) { if (!cancelled) setGoogleLiveCard(true); return; }
      const cloud = await fetchOwnerGoogleToken();
      if (!cancelled) setGoogleLiveCard(!!cloud?.token);
    };
    check();
    window.addEventListener("focus", check);
    return () => { cancelled = true; window.removeEventListener("focus", check); };
  }, []);
  const [routeLoading, setRouteLoading] = useState(false);
  // FIX 10 — employee-side "Mark as Paid" confirmation, synced to the same
  // employees.paidPeriods JSONB the owner's Employees > Payroll view reads,
  // so either side marking a period paid is immediately visible to the other.
  const [markingPaidPeriod, setMarkingPaidPeriod] = useState<string | null>(null);
  const markPeriodPaid = async (periodStart: string) => {
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    setMarkingPaidPeriod(periodStart);
    const nextPaid = { ...((myEmployee as any)?.paidPeriods || {}), [periodStart]: "paid" as const };
    try {
      const result = await (supabase as any).from("employees").update({ paidPeriods: nextPaid }).eq("id", empId);
      if (result?.error) {
        console.error("[Mark as Paid] — error:", result.error.message);
        toast("Saved locally, but couldn't sync to the owner: " + result.error.message, "red");
      } else {
        refetchEmployees?.();
        toast("Marked as paid — owner notified ✓", "green");
      }
    } catch (e: any) {
      console.error("[Mark as Paid] — error:", e?.message || e);
      toast("Couldn't sync to the owner: " + (e?.message || "unknown error"), "red");
    } finally {
      setMarkingPaidPeriod(null);
    }
  };
  // FIX 3 — per-day "Mark as Paid" for the Pay tab's daily calendar view,
  // parallel to markPeriodPaid but keyed by individual date (employees.paidDays).
  const [markingPaidDay, setMarkingPaidDay] = useState<string | null>(null);
  const markDayPaid = async (dateKey: string) => {
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    setMarkingPaidDay(dateKey);
    const current = (myEmployee as any)?.paidDays || {};
    const nextPaid = { ...current, [dateKey]: current[dateKey] === "paid" ? "unpaid" as const : "paid" as const };
    try {
      const result = await (supabase as any).from("employees").update({ paidDays: nextPaid }).eq("id", empId);
      if (result?.error) {
        console.error("[HoursSync] markDayPaid — error:", result.error.message);
        toast("Saved locally, but couldn't sync to the owner: " + result.error.message, "red");
      } else {
        refetchEmployees?.();
        toast(nextPaid[dateKey] === "paid" ? "Day marked as paid ✓" : "Day marked unpaid");
      }
    } catch (e: any) {
      console.error("[HoursSync] markDayPaid — error:", e?.message || e);
      toast("Couldn't sync to the owner: " + (e?.message || "unknown error"), "red");
    } finally {
      setMarkingPaidDay(null);
    }
  };
  const [payCalMonthOffset, setPayCalMonthOffset] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{ order: Job[]; totalDuration: string; totalDistance: string; etas: string[]; origin: { lat: number; lng: number } | string } | null>(null);
  const [calMode, setCalMode] = useState<"week" | "month">("month");
  // FIX 8 — today() is UTC-derived and rolls to the next date ~4-8pm US
  // local time; scheduledDate is a local calendar date the owner picked, so
  // an evening open of the Calendar tab could pre-select a day that's
  // already "tomorrow" in UTC and show zero jobs for what the employee
  // considers today. localDateStr() matches local Date components instead.
  const [calSelectedDate, setCalSelectedDate] = useState(localDateStr());
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calMonthOffset, setCalMonthOffset] = useState(0);
  const [calDragJobId, setCalDragJobId] = useState<string | null>(null);
  const [calCtxMenu, setCalCtxMenu] = useState<{ jobId: string; x: number; y: number } | null>(null);
  const calMonthEdgeTimerRef = useRef<any>(null);
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
  const [showLoginPwd, setShowLoginPwd] = useState(false);
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
  // Local customer cache — populated by direct Supabase fetches when a job's
  // customerId is not found in the customers prop (e.g. RLS delay, stale parent
  // state). Keyed by customer id so lookups are O(1).
  const [localCustomerCache, setLocalCustomerCache] = useState<Record<string, Customer>>({});
  // findCustomer: checks prop array first (fast path), then local cache.
  const findCustomer = (id?: string | null): Customer | undefined => {
    if (!id) return undefined;
    return customers.find(c => c.id === id) ?? localCustomerCache[id];
  };

  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<any>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [requestDone, setRequestDone] = useState<string | null>(null);
  // Employee availability
  const [availability, setAvailability] = useState<string[]>([]);
  // FEATURE 5 — recurring weekday unavailability (e.g. "every Sunday"),
  // alongside the existing specific-date availability array above.
  const [recurringDaysOff, setRecurringDaysOff] = useState<number[]>([]);
  const [autoSyncCalendar, setAutoSyncCalendar] = useState(true);
  const [showAvailability, setShowAvailability] = useState(false);
  // Optimistic override for "Start/End My Day" — if the employees table is
  // missing the dayClockInAt column (a 400 on the update), the button must
  // still flip and stay flipped instead of silently reverting on the next
  // refetch, since the underlying request never persisted. undefined means
  // "trust the server value".
  const [optimisticDayClockInAt, setOptimisticDayClockInAt] = useState<number | null | undefined>(undefined);
  // FIX 5 — instant "📍 Sharing" badge before the Supabase round-trip / next poll.
  const [optimisticLocationSharing, setOptimisticLocationSharing] = useState<boolean | undefined>(undefined);
  const [optimisticDayLunchStartAt, setOptimisticDayLunchStartAt] = useState<number | null | undefined>(undefined);
  const [payChartRange, setPayChartRange] = useState<"7d" | "4wk" | "12mo" | "custom">("7d");
  // BLOCKER 11 (mobile round 7) — the only "custom period" controls anywhere
  // on this tab were fixed presets (7 days / 4 weeks / 12 months) or the
  // calendar's month prev/next (capped at the current month) — there was no
  // way to actually pick an arbitrary date range as asked for.
  const [payCustomStart, setPayCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [payCustomEnd, setPayCustomEnd] = useState(() => today());
  // Drives a spinner on the "Share My Location" button for the window between
  // tapping it and the browser's permission prompt resolving — previously the
  // button gave zero feedback during that gap, which read as "does nothing".
  const [locationPermissionPending, setLocationPermissionPending] = useState(false);
  // Tracks whether the current pause is a lunch break (shows countdown) or a general pause.
  // Stored in localStorage so it survives re-renders but not page reloads intentionally —
  // on reload the type resets to "pause", which is fine since the countdown state resets too.
  const [pauseIsLunch, setPauseIsLunch] = useState<boolean>(() => {
    try { return localStorage.getItem("smocks.pauseIsLunch") === "1"; } catch { return false; }
  });
  const setPauseMode = (isLunch: boolean) => {
    setPauseIsLunch(isLunch);
    try { localStorage.setItem("smocks.pauseIsLunch", isLunch ? "1" : "0"); } catch {}
  };
  // Forces a re-render every second so the shift timer reads HH:MM:SS live —
  // the value itself is never read, only its change triggers the re-render.
  const [, setShiftTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setShiftTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
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

  useEffect(() => {
    if (optimisticDayLunchStartAt !== undefined && (myEmployee as any)?.dayLunchStartAt === optimisticDayLunchStartAt) {
      setOptimisticDayLunchStartAt(undefined);
    }
  }, [(myEmployee as any)?.dayLunchStartAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (optimisticLocationSharing !== undefined && !!(myEmployee as any)?.locationSharing === optimisticLocationSharing) {
      setOptimisticLocationSharing(undefined);
    }
  }, [(myEmployee as any)?.locationSharing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective dayClockInAt — used by shift timer bar AND startDayShiftIfNeeded.
  // Keeps optimistic value until Supabase confirms it so the timer never flickers.
  const empDayClockInAt: number | null = optimisticDayClockInAt !== undefined
    ? optimisticDayClockInAt
    : ((myEmployee as any)?.dayClockInAt ?? null);

  // Shared function so both JobCard's "I'm Here" button and JobDetailView's
  // "I'm Here" button can auto-start the shift timer in one place.
  const startDayShiftIfNeeded = async () => {
    if (empDayClockInAt) return; // already running
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    // BLOCKER 10 (mobile round 7) — this is the OTHER place dayClockInAt gets
    // set fresh (auto-start via "I'm Here" on a job card). toggleDay's own
    // Resume-Day backdating (below, in the Today tab) never applied here, so
    // ending a shift and then just tapping "I'm Here" on the next job — the
    // more common flow than opening the Today tab and pressing Start My Day —
    // silently restarted the whole-day timer at zero instead of resuming.
    const localLastShift = (() => {
      try { return JSON.parse(localStorage.getItem("smocks.lastShift." + empId) || "null"); } catch { return null; }
    })();
    // BLOCKER 13 (mobile round 9) — shiftDayStr() (4am cutover), not
    // localDateStr() (plain midnight), so a night-shift worker tapping "I'm
    // Here" a few minutes after local midnight still resumes the same
    // overnight shift instead of getting treated as a new calendar day.
    const alreadyWorkedTodayHours = (myEmployee as any)?.lastShiftDate === shiftDayStr()
      ? Number((myEmployee as any)?.lastShiftHours) || 0
      : (localLastShift?.date === shiftDayStr() ? Number(localLastShift?.hours) || 0 : 0);
    const nextVal = Date.now() - Math.round(alreadyWorkedTodayHours * 3600000);
    setOptimisticDayClockInAt(nextVal);
    try {
      const result = await (supabase as any)
        .from("employees")
        .update({ dayClockInAt: nextVal, dayLunchStartAt: null, dayPausedMinutes: 0 })
        .eq("id", empId);
      if (result?.error) {
        console.warn("Auto-start shift failed:", result.error.message);
      } else {
        refetchEmployees?.();
        toast(alreadyWorkedTodayHours > 0 ? "Shift resumed ✓" : "Shift started automatically ✓");
      }
    } catch (e: any) {
      console.warn("Auto-start shift failed:", e?.message);
    }
  };

  // Log whenever the lookup inputs change so we can see if employees is empty on first render.
  // Also auto-retries once against Supabase when myEmployee isn't found in the prop array.
  useEffect(() => {
    if (!empSession) return;
    const userId = empSession.user.id;
    const email = empSession.user.email;

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
    const rdo = (myEmployee as any).recurringDaysOff;
    if (Array.isArray(rdo) && rdo.length > 0) setRecurringDaysOff(rdo);
    if ((myEmployee as any).autoSyncCalendar === false) setAutoSyncCalendar(false);
  }, [(myEmployee as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Home base specifically re-syncs whenever Supabase's value changes (not
  // just once per login) — the periodic employees poll means a home base
  // set on another device shows up here within a few seconds instead of
  // requiring a fresh login on this device to ever see it. Guarded by a
  // recent-local-edit window so a poll landing mid-keystroke (saveHomeBaseAddress
  // fires on every change) never clobbers text the user is actively typing.
  useEffect(() => {
    const remote = (myEmployee as any)?.homeBaseAddress;
    if (remote && remote !== homeBaseAddress && Date.now() - homeBaseLastEditRef.current > 5000) {
      setHomeBaseAddressState(remote);
    }
  }, [(myEmployee as any)?.homeBaseAddress]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const dbRefreshToken = (myEmployee as any).google_refresh_token;
    if (!dbToken && !dbRefreshToken) return;
    // Hydrate even when the access token itself has already expired, as long
    // as there's a refresh_token — otherwise the silent-refresh effect below
    // never gets a chance to run on a device that's never connected before,
    // and the employee sees a "reconnect" prompt for a self-healing state.
    const expiresAt = dbExpiresAt ? new Date(dbExpiresAt).getTime() : 0;
    saveEmpGoogleToken(uid, {
      token: dbToken || "",
      refreshToken: dbRefreshToken || undefined,
      email: (myEmployee as any).google_email || empSession.user.email || "",
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
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
      // FIX 10 (mobile round 6) — this used to bail out entirely when no
      // custom googleBackendUrl was configured, even though
      // refreshEmpGoogleToken already falls back to this project's own
      // same-origin /api/google-refresh Cloudflare Pages Function when
      // backendUrl is undefined. A backendUrl is an OPTIONAL self-hosted
      // override — requiring it here meant this refresh never even
      // attempted for the common case (no custom backend configured),
      // which is the actual reason tokens "kept expiring and didn't
      // persist": nothing was ever retrying them.
      const backendUrl = settings?.googleBackendUrl;
      const refreshed = await refreshEmpGoogleToken(backendUrl, existing.refreshToken);
      if (!refreshed?.token) {
        // A real refresh attempt (refresh_token WAS present) failed — only
        // now is it honest to call this "expired, needs reconnect" rather
        // than a transient, self-healing state.
        setEmpGoogleRefreshFailed(true);
        setEmpGoogleConfigMissing(!!refreshed?.configMissing);
        return;
      }
      setEmpGoogleRefreshFailed(false);
      setEmpGoogleConfigMissing(false);
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
    const interval = setInterval(() => { if (shouldPollJobs()) load(); }, 5000);
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
        // FIX 3 (mobile round 8) — root cause of "not all assigned jobs show
        // on the calendar": this used to try narrowing by crew membership
        // first (two separate queries, since crew entries may store either
        // the employee's `id` or their `user_id`), and only fell through to
        // fetching everything if BOTH narrow queries came back empty. But if
        // attempt1 (crew contains `id`) found ANY jobs at all, attempt2 (crew
        // contains `user_id`) — and therefore attempt3, the fetch-everything
        // fallback — never ran, silently dropping every job crewed under the
        // OTHER id shape from local state entirely. myJobs' client-side
        // filter (crewIncludesEmployee) already correctly checks both id
        // shapes, so the fix is to just always fetch everything and let that
        // filter do its job, rather than trying to out-guess it with a
        // narrower server-side query that can silently short-circuit.
        const { data: allData } = await (supabase as any).from("jobs").select("*");
        let data: any[] = Array.isArray(allData) ? allData : [];

        // BLOCKER 2 (mobile round 7) — casing-normalize every job row coming
        // out of Supabase (loggedHours/clockInAt/etc can fold to lowercase —
        // see normalizeJobRow), or the employee's own Pay tab silently reads
        // 0 hours even though the real number is on the row already.
        if (Array.isArray(data)) data = data.map(normalizeJobRow);
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
              // BLOCKER 2 fix — only let the local copy win when it actually
              // HAS a value; previously this always overwrote with the local
              // value even when undefined (e.g. right after a fresh page
              // load before local state was populated), discarding perfectly
              // good remote hours/clock data and making them look zeroed.
              EMPLOYEE_OWNED_FIELDS.forEach(f => {
                const localVal = (j as any)[f];
                if (localVal !== undefined && localVal !== null) next[f] = localVal;
              });
              return next;
            });
            const existingIds = new Set(prev.map(j => j.id));
            const added = data.filter((j: any) => !existingIds.has(j.id));
            const result = [...merged, ...added];
            const myJobsFiltered = result.filter(j => crewIncludesEmployee(j.crew, empId, empUserId));
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
    // EGRESS FIX — was an unconditional 3s poll; realtime above already
    // covers instant updates, this is now just the fallback, and skips
    // entirely while the tab is hidden or the employee is idle 5+ minutes.
    // Widened 10s -> 60s: `load()` is a select("*") on jobs, which carries
    // every job's inline base64 photos/videos (types/index.ts Photo.dataUrl
    // etc.) — a 10s fallback poll re-downloads all of that every tick for
    // every open employee portal, which is the dominant driver of a real
    // Supabase egress overage. Realtime already handles the instant case.
    const interval = setInterval(() => { if (shouldPollJobs()) load(); }, 60000);
    return () => {
      clearInterval(interval);
      try { channel?.unsubscribe(); } catch { /* ignore */ }
    };
  }, [(myEmployee as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodically refetch the employees table so a Google connection (or any
  // other field) made on a DIFFERENT device shows up here without requiring
  // a full page reload — without this, each device's `employees` state was
  // only ever fetched once at mount and never converged with what another
  // device wrote to the same Supabase row.
  useEffect(() => {
    if (!empSession?.user?.id) return;
    const interval = setInterval(() => { if (shouldPollJobs()) refetchEmployees?.(); }, 10000);
    return () => clearInterval(interval);
  }, [empSession?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }

  // Fetch any job's customer directly from Supabase when it isn't found in the
  // customers prop. Each missing ID gets its own .single() query so a bad ID
  // doesn't poison the whole batch. Results land in localCustomerCache (local
  // state — always reliable). Failed or timed-out IDs also get a sentinel entry
  // so the card stops showing "loading..." and shows "Unknown Customer" instead.
  // missingCustomerFetchRef prevents duplicate in-flight requests.
  const missingCustomerFetchRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!empSession || myJobs.length === 0) return;
    const knownIds = new Set([
      ...customers.map((c: any) => c.id),
      ...Object.keys(localCustomerCache),
    ]);
    const missingIds = Array.from(new Set(myJobs.map(j => j.customerId).filter(Boolean)))
      .filter(id => !knownIds.has(id) && !missingCustomerFetchRef.current.has(id));
    if (missingIds.length === 0) return;

    const storeSentinel = (id: string) => {
      setLocalCustomerCache(prev => ({ ...prev, [id]: { id, firstName: "Unknown", lastName: "Customer" } as any }));
    };

    for (const id of missingIds) {
      missingCustomerFetchRef.current.add(id);
      const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000));
      const query = (supabase as any).from("customers").select("*").eq("id", id).single();
      Promise.race([query, timeout])
        .then((r: any) => {
          if (r === null) {
            console.error("CUSTOMER FETCH ERROR: timed out for customerId", id);
            storeSentinel(id);
            return;
          }
          if (r?.error) {
            const err = r.error;
            console.error("CUSTOMER FETCH ERROR | customerId:", id,
              "\n  status:", err?.status,
              "\n  message:", err?.message,
              "\n  details:", err?.details,
              "\n  hint:", err?.hint,
              "\n  full:", JSON.stringify(err));
            storeSentinel(id);
            return;
          }
          const c: Customer = r.data;
          if (!c) {
            console.error("CUSTOMER FETCH ERROR: no data returned | customerId:", id, "| full response:", JSON.stringify(r));
            storeSentinel(id);
            return;
          }
          setLocalCustomerCache(prev => ({ ...prev, [c.id]: c }));
          setCustomers((prev: any[]) => prev.find(x => x.id === c.id) ? prev : [...prev, c]);
        })
        .catch((e: any) => {
          console.error("CUSTOMER FETCH ERROR (thrown) | customerId:", id,
            "\n  message:", e?.message,
            "\n  full:", JSON.stringify(e));
          storeSentinel(id);
        });
    }
  }, [empSession, myJobs.map(j => j.customerId).join(","), customers.length, Object.keys(localCustomerCache).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 1: When the jobs array changes (3s Supabase poll), snap calSelectedDate
  // back to today so newly-assigned jobs that are scheduled today are visible
  // immediately without the employee having to navigate the calendar manually.
  // Cancelled jobs are already excluded from calVisibleJobs (see render below).
  useEffect(() => {
    setCalSelectedDate(localDateStr());
  }, [jobs.map(j => j.id + j.status).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time location sharing — runs the whole time the toggle is on (not
  // gated on being clocked in — the owner may want to see crew location
  // before/after a shift too), posting a GPS fix to Supabase every 15s so the
  // owner's Crew View → Live Now map can plot it. Stops automatically the
  // moment the toggle flips off (interval is torn down by the effect cleanup).
  useEffect(() => {
    const empId = (myEmployee as any)?.id;
    const sharing = (myEmployee as any)?.locationSharing;
    if (!empId || !sharing) return;
    if (!navigator.geolocation) { toast("This browser doesn't support location sharing", "red"); return; }
    let deniedToastShown = false;
    const postLocation = () => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          (supabase as any).from("employees").update({
            lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() },
          }).eq("id", empId).then((r: any) => {
            if (r?.error) console.warn("Location post failed:", r.error.message);
            else refetchEmployees?.();
          });
        },
        (err) => {
          if (!deniedToastShown) { deniedToastShown = true; toast("Location permission denied — location sharing paused", "red"); }
          console.warn("Geolocation error:", err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };
    postLocation();
    const interval = setInterval(postLocation, 15000);
    return () => clearInterval(interval);
  }, [(myEmployee as any)?.id, (myEmployee as any)?.locationSharing]);

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

  // FIX 8 — same UTC-vs-local mismatch as calSelectedDate above: this feeds
  // both the Today tab's job list and the Calendar tab's "isToday"
  // highlighting, so it must agree with the employee's actual local date.
  // ITEM 7 — plain local midnight still isn't right for a night-shift worker:
  // a job scheduled for tonight that runs past midnight used to vanish from
  // the Today tab (and lose its "isToday" calendar highlight) the instant the
  // calendar date rolled over, even though the employee was still actively
  // clocked in on it. shiftDayStr() applies the same 4am cutover the
  // whole-day shift timer already uses elsewhere in this file (dayClockInAt/
  // lastShiftDate) so a job started the night before keeps counting as
  // "today" until 4am, not local midnight.
  const todayStr = shiftDayStr();
  const todayJobs = myJobs.filter(j => j.scheduledDate === todayStr && j.status !== "cancelled");

  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
  })();
  const weekEnd = (() => {
    const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().slice(0, 10);
  })();
  const weekJobs = myJobs.filter(j => j.scheduledDate >= weekStart && j.scheduledDate <= weekEnd);

  // FIX 9 / FIX 5 (mobile round 3) — job.loggedHours (time on-site, see
  // finalizeCompletion) is the primary source, but employees.lastShiftHours/
  // lastShiftDate (the whole-day shift timer total, set on "End My Day") and
  // a currently-in-progress shift (dayClockInAt, not ended yet) can both
  // cover time no job captured at all. This used to be computed inline just
  // for weekStart/weekEnd — the Pay tab further down reimplemented its own
  // "hours in a date range" from scratch for each 14-day period WITHOUT this
  // top-up at all, so hours/pay showed correctly on the Today tab but as $0
  // on the Pay tab for anyone whose hours came mostly from the shift timer
  // rather than completed jobs. Shared as one function so both call sites
  // (and any future one) can't independently diverge again.
  const computeEmployeeShiftTopUp = (startDate: string, endDate: string): number => {
    const empLastShiftDate = (myEmployee as any)?.lastShiftDate;
    const empLastShiftHours = Number((myEmployee as any)?.lastShiftHours) || 0;
    const jobHoursOnShiftDate = empLastShiftDate
      ? myJobs.filter(j => j.status === "completed" && j.scheduledDate === empLastShiftDate).reduce((s, j) => s + Number(j.loggedHours || 0), 0)
      : 0;
    // Only the SINGLE most recent shift is ever stored server-side (no daily
    // history), so this can only top up that one day, and only the
    // shortfall beyond whatever job hours already landed on that same date
    // (never double-counted).
    const endedShiftTopUp = (empLastShiftDate && empLastShiftDate >= startDate && empLastShiftDate <= endDate)
      ? Math.max(0, empLastShiftHours - jobHoursOnShiftDate)
      : 0;
    // Still clocked in (dayClockInAt set, hasn't pressed "End My Day" yet) —
    // mirrors the live netShiftHoursNow formula used by the shift-timer
    // button below, so the two can't disagree once the shift actually ends.
    const empDayClockInAt = (myEmployee as any)?.dayClockInAt;
    const liveShiftTopUp = (empDayClockInAt && todayStr >= startDate && todayStr <= endDate)
      ? (() => {
          const pausedMin = Number((myEmployee as any)?.dayPausedMinutes) || 0;
          const lunchStart = (myEmployee as any)?.dayLunchStartAt;
          const currentPauseMs = lunchStart ? Date.now() - lunchStart : 0;
          const liveHours = Math.max(0, (Date.now() - empDayClockInAt - pausedMin * 60000 - currentPauseMs) / 3600000);
          const jobHoursToday = myJobs.filter(j => j.status === "completed" && j.scheduledDate === todayStr).reduce((s, j) => s + Number(j.loggedHours || 0), 0);
          return Math.max(0, liveHours - jobHoursToday);
        })()
      : 0;
    // Avoid double-counting if lastShiftDate also happens to be today
    // (clocked in again after already ending a shift earlier the same day)
    // — the live figure supersedes the ended-shift one for today specifically.
    return (empLastShiftDate === todayStr && empDayClockInAt) ? liveShiftTopUp : liveShiftTopUp + endedShiftTopUp;
  };

  const weekShiftTopUpHours = computeEmployeeShiftTopUp(weekStart, weekEnd);
  const weekHours = weekJobs.reduce((s, j) => s + Number(j.loggedHours || 0), 0) + weekShiftTopUpHours;
  const weekJobsDone = weekJobs.filter(j => j.status === "completed").length;
  const weekPay = weekHours * (myEmployee?.hourlyRate || 0);

  const upNextJob = [...myJobs]
    .filter(j => j.scheduledDate >= todayStr && j.status !== "completed")
    .sort((a, b) => {
      const da = a.scheduledDate + (a.scheduledTime || "23:59");
      const db = b.scheduledDate + (b.scheduledTime || "23:59");
      return da.localeCompare(db);
    })[0] ?? null;
  const upNextCustomer = upNextJob ? findCustomer(upNextJob.customerId) : null;

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

  // Columns known to exist on every deployment of the jobs table. If a full
  // patch is rejected (e.g. an optional column like completedAt/amountCollected
  // isn't in this project's schema), the WHOLE update is discarded by
  // PostgREST — which silently drops critical fields like `status`. To stop a
  // "Mark Complete" from reverting on the next 3s poll, retry with just this
  // safe subset so the important fields always land.
  // [FIXHOURS] — completedAt must NOT be added here. It was added briefly in
  // a previous round, which defeated the entire point of this fallback list:
  // completedAt is an OPTIONAL column (see supabase/migrations/0015) that
  // isn't guaranteed to exist yet on every deployment. With it in this list,
  // any owner who hasn't run that migration got the retry-with-safe-columns
  // ALSO fail (PostgREST rejects the whole patch if ANY column is unknown) —
  // silently dropping `status`/`loggedHours` too, which is exactly what
  // "hours show in the employee portal (local state) but never reach the
  // owner CRM" looks like. Once the migration is run, completedAt reaches
  // Supabase fine on the FIRST attempt (the full, unfiltered patch below) —
  // it never needed to be in this fallback-only list at all.
  const CORE_JOB_COLUMNS = [
    "status", "paymentStatus", "paymentType", "loggedHours", "amountCollected", "invoiceSentAt", "arrivedAt",
    "crew", "clockInAt", "lunchStartAt", "pipelineStage", "photos", "videos", "preChecklist", "duringChecklist",
    "postChecklist", "signOff", "scheduledTime", "commLog", "equipmentChecked", "notes",
  ] as const;
  const updateJob = (jobId: string, patch: Partial<Job>): Promise<any> => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
    // Persist immediately rather than waiting on the 30s App-level auto-save —
    // the jobs-fetch poll below runs every 3s and merges Supabase's row straight
    // over local state, so anything not yet saved can get silently reverted by
    // the very next poll tick.
    return (supabase as any).from("jobs").update(patch).eq("id", jobId)
      .then(async (result: any) => {
        if (result?.error) {
          console.warn("[updateJob] full patch failed:", result.error.message, "— retrying core fields only");
          const core: any = {};
          CORE_JOB_COLUMNS.forEach(k => { if ((patch as any)[k] !== undefined) core[k] = (patch as any)[k]; });
          if (Object.keys(core).length > 0) {
            const retry = await (supabase as any).from("jobs").update(core).eq("id", jobId);
            if (retry?.error) { console.error("[updateJob] core retry failed:", retry.error.message); return retry; }
            console.log("[FIXHOURS] core-columns retry succeeded — status/hours/pay synced to Supabase despite full-patch rejection:", Object.keys(core));
            return retry;
          }
          return result;
        }
        return result;
      })
      .catch((e: any) => { console.warn("[updateJob] failed to save:", e?.message); return { error: e }; });
  };

  // FEATURE 3 — the owner's own Complete button (JobsPage.tsx) already
  // auto-schedules the next occurrence of a recurring job, but employees
  // completing jobs through the field portal is the more common path and had
  // no equivalent at all — a recurring job completed here would just never
  // get its next occurrence created. Mirrors JobsPage.tsx's approach (reset
  // status/hours/clock/checklist/logs, new id) using the same shared
  // computeNextRecurringDate so both paths can never compute different dates
  // for the same schedule.
  const createRecurringJob = (sourceJob: Job) => {
    if (!sourceJob.isRecurring) return;
    const nextDate = computeNextRecurringDate(sourceJob, sourceJob.scheduledDate);
    const nextJob: any = {
      // stripLegacyJobFields — sourceJob may still carry a poisoned
      // organizationId/org_id key from before that bug was reverted; a bare
      // spread would carry it into this brand-new row and fail the insert.
      ...stripLegacyJobFields(sourceJob), id: uid(), status: "scheduled", scheduledDate: nextDate,
      loggedHours: 0, clockInAt: null, arrivedAt: null, completedAt: null,
      checklist: (sourceJob.checklist || []).map((ck: any) => ({ ...ck, done: false })),
      preChecklist: (sourceJob.preChecklist || []).map((ck: any) => ({ ...ck, done: false })),
      duringChecklist: (sourceJob.duringChecklist || []).map((ck: any) => ({ ...ck, done: false })),
      postChecklist: (sourceJob.postChecklist || []).map((ck: any) => ({ ...ck, done: false })),
      commLog: [], photos: [], chemicalsUsed: [], paymentStatus: undefined, amountCollected: undefined,
    };
    setJobs((prev: any[]) => [...prev, nextJob]);
    (supabase as any).from("jobs").insert(nextJob)
      .then(async (r: any) => {
        if (r?.error) {
          // FIX 14 — completedAt is a newer, optional column (migration
          // 0015); if it isn't there yet, PostgREST rejects the whole insert
          // — including `crew` — so the recurring job never reached Supabase
          // and the employee (who reads jobs straight from Supabase) never
          // saw it at all. Retry without it so the job still lands.
          console.error("[Recurring] insert failed:", r.error.message, "— retrying with core columns");
          const { completedAt, ...coreJob } = nextJob;
          const retry = await (supabase as any).from("jobs").insert(coreJob);
          if (retry?.error) { console.error("[Recurring] core-column retry also failed:", retry.error.message); toast?.("Job completed, but couldn't auto-schedule the next occurrence — " + retry.error.message, "red"); }
          else toast?.("Next recurring job auto-scheduled for " + nextDate, "green");
        }
        else toast?.("Next recurring job auto-scheduled for " + nextDate, "green");
      })
      .catch((e: any) => { console.error("[Recurring] insert threw:", e?.message); toast?.("Job completed, but couldn't auto-schedule the next occurrence", "red"); });
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

  const messageNextJobCustomer = async (job: Job, lateMinutes: number) => {
    const cust = findCustomer(job.customerId);
    if (!cust?.phone && !cust?.email) { toast("No phone or email on file for this customer", "yellow"); return; }
    if (job.scheduledDate && job.scheduledDate !== today()) {
      const ok = window.confirm(`This job is scheduled for ${job.scheduledDate}, not today. Send the "on my way" message anyway?`);
      if (!ok) return;
    }
    const eta = nextJobEta?.etaTime || "shortly";
    const msg = lateMinutes > 0
      ? `Hi ${cust!.firstName}, running a few minutes behind — ETA ${eta}. Sorry for the delay!`
      : `Hi ${cust!.firstName}, on my way — ETA ${eta}. See you soon!`;
    if (settings?.twilioSid && cust!.phone) {
      try {
        await withTimeout(twilioSend(settings as any, cust!.phone, msg), 15000, "OTW SMS");
        toast("On the way message sent to " + cust!.firstName + " ✓", "green");
        logOutboundSmsToInbox({ contactName: `${cust!.firstName} ${cust!.lastName}`, contactPhone: cust!.phone, customerId: cust!.id, body: msg }).catch(() => {});
      }
      catch (e: any) { console.error("[OTW] — error:", e?.message); toast(e?.message || "Failed to send OTW text", "red"); }
    } else if (cust!.email) {
      try {
        const html = emailShell(settings?.companyName || "Crew Boss", "On My Way", `<p>${msg}</p>`);
        await withTimeout(sendOwnerGmailOnly(settings as any, cust!.email, "Your technician is on the way", html), 15000, "OTW email");
        toast("On the way message sent to " + cust!.firstName + " ✓", "green");
      } catch (e: any) { console.error("[OTW] — error:", e?.message); toast(e?.message || "Failed to send OTW email", "red"); }
    } else if (cust!.phone) {
      // No Twilio and no email on file — open the tech's own SMS app prefilled.
      window.location.href = "sms:" + cust!.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(msg);
      toast("Opening your texts to notify " + cust!.firstName + " — add Twilio in Settings to send automatically", "yellow");
    }
  };

  const doSignOut = async () => {
    // scope: "local" — sign out only this device. The default ("global")
    // revokes the refresh token everywhere, which would also sign this
    // employee out of any other device/browser they're logged into.
    await supabase.auth.signOut({ scope: "local" });
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
      // resetPasswordForEmail resolves with {error} rather than throwing on
      // failure — a bare try/catch alone would show "sent ✓" even when it
      // failed (rate limit, malformed email, etc).
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
        redirectTo: `${window.location.origin}${window.location.pathname}#/reset-password`,
      });
      if (error) { console.error("[Forgot Password/employee] — error:", error.message); setLoginError("Could not send reset email — " + error.message); return; }
      setForgotSent(true);
    } catch (e: any) { setLoginError("Could not send reset email — " + (e?.message || "try again")); }
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
      const statusResult = await (supabase as any).from("job_requests")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", requestId);
      if (statusResult?.error) console.warn("[CrewFlow] job_requests status update failed:", statusResult.error.message);
      if (requestData.job_id) {
        const empId = myEmployee.id;
        const empUserId = (myEmployee as any).user_id;
        const targetJob = jobs.find(j => j.id === requestData.job_id);
        const currentCrew = targetJob?.crew || [];
        if (!crewIncludesEmployee(currentCrew, empId, empUserId)) {
          const newCrew = [...currentCrew, empId];
          // crewAssignedAt must be set here too, same as the owner's direct-assign
          // path (toggleCrew in JobDetailModal) — without it, this employee never
          // gets a "New Assignment" banner on their Today tab for a job they just
          // accepted, even though they're genuinely on the crew.
          const newCrewAssignedAt = { ...(targetJob?.crewAssignedAt || {}), [empId]: Date.now() };
          // Optimistic local update
          setJobs(prev => prev.map(j => j.id === requestData.job_id ? { ...j, crew: newCrew, crewAssignedAt: newCrewAssignedAt } : j));
          // Save MUST be awaited before refetching — otherwise the refetch below can
          // land before this write commits and overwrite the optimistic crew with the
          // still-empty array from Supabase, which is exactly why accepted jobs were
          // vanishing again right after acceptance.
          const saveResult = await (supabase as any).from("jobs").update({ crew: newCrew, crewAssignedAt: newCrewAssignedAt }).eq("id", requestData.job_id);
          if (saveResult?.error) {
            toast("Accepted, but couldn't add you to the job's crew — " + saveResult.error.message, "red");
          }
        }
        // Confirm against Supabase immediately rather than waiting up to 10s for the
        // next poll — the optimistic setJobs above already updated myJobs for instant
        // UI feedback; this just reconciles with the server-confirmed state right away.
        refetchJobsRef.current().catch(() => {});
        syncAcceptedJobToCalendar(jobs.find(j => j.id === requestData.job_id));
      }
      setRequestDone("accepted");
      toast("Job accepted! You're on the crew. ✓");
    } catch (e: any) {
      console.error("[CrewFlow] accept request failed:", e?.message || e);
      toast("Error accepting request — " + (e?.message || "check connection"), "red");
    }
  };

  const handleDenyRequest = async () => {
    try {
      const result = await (supabase as any).from("job_requests")
        .update({ status: "denied", denial_reason: denyReason.trim(), responded_at: new Date().toISOString() })
        .eq("id", requestId);
      if (result?.error) throw new Error(result.error.message);
      setRequestDone("denied");
      toast("Request declined.");
    } catch (e: any) {
      console.error("[CrewFlow] deny request failed:", e?.message || e);
      toast("Error declining request — " + (e?.message || "check connection"), "red");
    }
  };

  const [homeBaseAddress, setHomeBaseAddressState] = useState("");
  const [, setGoogleHydrateTick] = useState(0);
  // FIX 10 (mobile round 6) — tracks whether the last actual refresh
  // attempt (a real POST with a real refresh_token) failed, so the
  // "reconnect" banner reflects a genuine failure instead of just "no
  // refresh_token on file yet".
  const [empGoogleRefreshFailed, setEmpGoogleRefreshFailed] = useState(false);
  // AUDIT — refreshEmpGoogleToken tags a failure as configMissing when the
  // Cloudflare Pages Function reports GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET
  // aren't set. That's a permanent server-side gap no amount of employee
  // "Reconnect" clicking can fix, but the banner below used to show the same
  // generic "token expired, reconnect" message either way — tracked
  // separately so the employee (and whoever they forward the screenshot to)
  // knows to escalate instead of retrying forever.
  const [empGoogleConfigMissing, setEmpGoogleConfigMissing] = useState(false);
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
  const homeBaseLastEditRef = useRef(0);
  const saveHomeBaseAddress = async (addr: string) => {
    homeBaseLastEditRef.current = Date.now();
    setHomeBaseAddressState(addr);
    // Supabase is the source of truth for cross-device sync — write there
    // first and check the result explicitly (Supabase resolves with {error}
    // rather than throwing on failure, so a bare try/catch alone would miss
    // a real failure). localStorage is only updated AFTER a confirmed
    // success, purely as an instant-load cache for this device.
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    try {
      const result = await (supabase as any).from("employees").update({ homeBaseAddress: addr }).eq("id", empId);
      if (result?.error) { toast("Failed to save home base — " + result.error.message, "red"); return; }
    } catch (e: any) {
      toast("Failed to save home base — " + (e?.message || "try again"), "red");
      return;
    }
    try {
      const uid = empSession?.user?.id;
      if (uid) localStorage.setItem("smocks.homeBase." + uid, addr);
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
        const result = await (supabase as any).from("employees").update({ availability: next }).eq("id", empId);
        if (result?.error) { console.warn("[Availability] save failed:", result.error.message); toast?.("Failed to save availability — " + result.error.message, "red"); }
      }
    } catch (e: any) { console.warn("[Availability] save threw:", e?.message); toast?.("Failed to save availability", "red"); }
  };

  // FEATURE 5 — recurring weekday off (0=Sun..6=Sat), same persistence
  // pattern as toggleAvailability above.
  const toggleRecurringDayOff = async (day: number) => {
    const next = recurringDaysOff.includes(day)
      ? recurringDaysOff.filter(d => d !== day)
      : [...recurringDaysOff, day].sort();
    setRecurringDaysOff(next);
    try {
      const empId = (myEmployee as any)?.id || (myEmployee as any)?.user_id;
      if (empId) {
        const result = await (supabase as any).from("employees").update({ recurringDaysOff: next }).eq("id", empId);
        if (result?.error) { console.warn("[Availability] recurring save failed:", result.error.message); toast?.("Failed to save recurring availability — " + result.error.message, "red"); }
      }
    } catch (e: any) { console.warn("[Availability] recurring save threw:", e?.message); toast?.("Failed to save recurring availability", "red"); }
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
        let crewSaveError: string | null = null;
        if (!crewIncludesEmployee(currentCrew, empId, empUserId)) {
          const newCrew = [...currentCrew, empId];
          // Same as handleAcceptRequest — set crewAssignedAt so the Today tab's
          // "New Assignment" banner still shows for a job accepted via a request,
          // not just via the owner's direct-assign toggle.
          const newCrewAssignedAt = { ...(targetJob?.crewAssignedAt || {}), [empId]: Date.now() };
          // Optimistic local update
          setJobs(prev => prev.map(j => j.id === req.job_id ? { ...j, crew: newCrew, crewAssignedAt: newCrewAssignedAt } : j));
          // Must await the save before refetching — see handleAcceptRequest for why
          // an un-awaited fire-and-forget write here let the refetch race ahead and
          // clobber the optimistic crew with Supabase's still-stale (empty) row.
          const saveResult = await (supabase as any).from("jobs").update({ crew: newCrew, crewAssignedAt: newCrewAssignedAt }).eq("id", req.job_id);
          // BUG FIX — this result used to be captured and never checked, so a
          // failed crew write (RLS, bad column, network) still showed the green
          // "you're on the crew" toast below even though the employee was never
          // actually added — exactly the "accept works but doesn't work" report.
          if (saveResult?.error) crewSaveError = saveResult.error.message;
        }
        // Confirm against Supabase immediately rather than waiting up to 10s for the
        // next poll — the optimistic setJobs above already updated myJobs for instant
        // UI feedback; this just reconciles with the server-confirmed state right away.
        refetchJobsRef.current().catch(() => {});
        syncAcceptedJobToCalendar(jobs.find(j => j.id === req.job_id));
        if (crewSaveError) {
          setIncomingRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "accepted" } : r));
          toast("Accepted, but couldn't add you to the job's crew — " + crewSaveError, "red");
          return;
        }
      }
      setIncomingRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "accepted" } : r));
      toast("Job accepted! You're on the crew. ✓");
    } catch (e: any) { console.error("[CrewFlow] inline accept failed:", e?.message || e); toast("Error accepting request — " + (e?.message || "check connection"), "red"); }
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

  // Requests the same Calendar + Gmail scopes the owner's Google connect
  // uses, so the provider_token this comes back with already has the
  // permissions needed to auto-connect Calendar/Gmail — App.tsx's
  // persistEmployeeGoogleToken (already wired for employee sessions) picks
  // up that token from the auth callback with no further action needed here.
  const handleEmployeeGoogleLogin = () => {
    setOAuthIntent("employee");
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        scopes: "email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send",
      },
    });
  };

  const doLogin = async () => {
    setLoginLoading(true); setLoginError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd });
    setLoginLoading(false);
    if (error) { setLoginError(error.message); return; }

    const session = data.session!;
    const metaRole = session.user.user_metadata?.role;
    const email = session.user.email || "";


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
      // AUDIT 9 — this insert used to be fire-and-forget with no error
      // handling at all. If it failed (RLS, a duplicate email constraint,
      // etc.) the new manager/employee looked signed-in in THIS browser via
      // setLocalEmployee below, but no real employees row ever existed —
      // meaning any other device, or this one after a cache clear, could
      // never resolve their role again, with nothing telling anyone it
      // failed. Await it and surface a real error instead of silently
      // continuing as if it worked.
      const insertResult = await (supabase as any).from("employees").insert(newEmp);
      if (insertResult?.error) {
        console.error("[ManagerInvite] failed to create employee record:", insertResult.error.message);
        toast("Signed in, but couldn't create your team record — " + insertResult.error.message + ". Contact your owner.", "red");
      } else {
      }
      // Set locally so myEmployee resolves immediately without waiting for parent re-fetch
      setLocalEmployee(normalizeEmp(newEmp));
    }

    refetchEmployees?.();

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
        toast={toast}
        settings={settings}
      />
    );
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!empSession) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-2xl font-black">S</span>
            </div>
            <div className="text-xl font-bold">{settings.companyName || "Crew Boss OS"}</div>
            <div className="text-sm text-white/50 mt-1">{inviteRecord ? "Create Your Crew Account" : "Employee Portal"}</div>
          </div>

          {!inviteRecord && (
            <div className="flex gap-1 p-1 mb-5 rounded-xl bg-white/5 border border-white/10">
              <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 transition">
                Owner / Manager
              </button>
              <button className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-600/30 border border-red-500/40 text-white transition">
                Employee Portal
              </button>
            </div>
          )}

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
              <div className="relative">
                <GInput type={showLoginPwd ? "text" : "password"} value={loginPwd} onChange={e => setLoginPwd(e.target.value)}
                  placeholder="••••••••" className="!pr-11" onKeyDown={e => e.key === "Enter" && (loginMode === "login" ? doLogin() : doRegister())} />
                <button type="button" onClick={() => setShowLoginPwd(s => !s)} aria-label={showLoginPwd ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-white/40 hover:text-white/80">
                  {showLoginPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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

            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={handleEmployeeGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-white text-gray-900 font-semibold text-sm shadow-lg hover:bg-gray-50 active:scale-95 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
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
      // No spinner — just render nothing for the brief moment before the
      // request details arrive, rather than blocking on a loading state.
      return <div className="min-h-screen bg-black" />;
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
    const customer = findCustomer(job.customerId);
    // Next job today (or soonest after) that isn't this one, completed, or
    // cancelled — shown on the post-completion summary with directions.
    const nextJob = myJobs
      .filter(j => j.id !== job.id && j.status !== "completed" && j.status !== "cancelled" && j.scheduledDate >= todayStr)
      .sort((a, b) => (a.scheduledDate + (a.scheduledTime || "23:59")).localeCompare(b.scheduledDate + (b.scheduledTime || "23:59")))[0] || null;
    const nextJobCustomer = nextJob ? findCustomer(nextJob.customerId) || null : null;
    return (
      <JobDetailView
        job={job}
        customer={customer}
        onBack={() => setSelectedJobId(null)}
        onUpdateJob={patch => updateJob(selectedJobId, patch)}
        toast={toast}
        companyName={settings.companyName || "Crew Boss"}
        onComplete={handleJobComplete}
        perms={perms}
        maxLunchMinutes={settings.maxLunchMinutes ?? 30}
        onJobCompleted={(j: Job) => { recordJobRating(j); syncJobToCalendar(j, { completed: true, silent: true }); createRecurringJob(j); }}
        googleMapsKey={settings.googleMapsKey || settings.mapsKey}
        paidLunchBreaks={!!settings.paidLunchBreaks}
        signOffDisclaimer={job.signOffTerms || settings.termsAndConditions || settings.terms || ""}
        settings={settings}
        setEstimates={setEstimates}
        nextJob={nextJob}
        nextJobCustomer={nextJobCustomer}
        onArrived={startDayShiftIfNeeded}
        autoComplete={pendingCompleteJobId === selectedJobId}
        employeeName={myEmployee ? `${myEmployee.firstName} ${myEmployee.lastName || ""}`.trim() : ""}
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
    const html = emailShell(settings?.companyName || "Crew Boss", "Crew Arrived", `<p>${myEmployee.firstName} ${myEmployee.lastName} has arrived at a job:</p><ul><li><b>Address:</b> ${job.address}</li>${cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : ""}<li><b>Time:</b> ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</li></ul>`);
    sendEmail(settings, { to: ownerEmail, subject: `${myEmployee.firstName} arrived — ${job.address}`, body: html }).catch(() => {});
  };

  const JobCard = ({ job }: { job: Job }) => {
    const customer = findCustomer(job.customerId);
    const preItems = job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS;
    const postItems = job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS;
    const allItems = [...preItems, ...(job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS), ...postItems];
    const doneCount = allItems.filter(i => i.done).length;
    // BUG 4 — read/write the parent-hoisted picker state so it survives the
    // frequent re-renders that otherwise remounted this card and flashed it shut.
    const latePickerOpen = lateOpenJobId === job.id;
    const setLatePickerOpen = (open: boolean) => setLateOpenJobId(open ? job.id : null);
    const sendingLate = sendingLateJobId === job.id;
    const lateNote = lateOpenJobId === job.id ? lateNoteText : "";
    const setLateNote = (v: string) => setLateNoteText(v);

    const otwOpenCard = otwOpenJobId === job.id;
    const setOtwOpenCard = (open: boolean) => setOtwOpenJobId(open ? job.id : null);
    const sendingOtwCard = sendingOtwJobId === job.id;

    const sendOTW = async () => {
      if (!customer) { console.warn("[OTW] no customer object"); toast("No customer info for this job", "yellow"); return; }
      setSendingOtwJobId(job.id);
      const msg = `Hi ${customer.firstName || "there"}, your CrewBoss technician is on the way!`;
      try {
        if (otwCardChannel === "sms") {
          if (!customer.phone) throw new Error("No phone on file for this customer.");
          await withTimeout(twilioSend(settings as any, customer.phone, msg), 15000, "OTW SMS");
          logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: msg }).catch(() => {});
        } else {
          if (!customer.email) throw new Error("No email on file for this customer.");
          const html = emailShell(settings?.companyName || "Crew Boss", "On My Way", `<p>${msg}</p>`);
          await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, "Your technician is on the way", html), 15000, "OTW email");
        }
        updateJob(job.id, { commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: today(), note: `📍 On my way message sent via ${otwCardChannel === "sms" ? "text" : "email"}` }] });
        toast(`✅ Message sent to ${customer.firstName || "customer"}`, "green");
        setOtwOpenJobId(null);
      } catch (err: any) {
        console.error("[OTW] — error:", err?.message || err);
        toast(`❌ Failed to send — ${err?.message || "reason unknown"}`, "red");
      } finally {
        setSendingOtwJobId(null);
      }
    };
    const sendRunningLateCard = async (e: React.MouseEvent, minutes: number) => {
      e.stopPropagation();
      if (!customer) { console.warn("[RunningLate] no customer object"); toast("No customer info for this job", "yellow"); return; }
      if (!customer.phone && !customer.email) { console.warn("[RunningLate] customer has no phone/email"); toast("No contact info for this customer", "yellow"); return; }
      setSendingLateJobId(job.id);
      const nowMs = Date.now() + minutes * 60000;
      const newEta = new Date(nowMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const reason = lateNote.trim() ? ` — ${lateNote.trim()}` : "";
      const msg = `Running ${minutes} min late${reason}. New ETA: ${newEta}. -Crew Boss`;
      try {
        if (lateCardChannel === "sms") {
          if (!customer.phone) throw new Error("No phone on file for this customer.");
          await withTimeout(twilioSend(settings as any, customer.phone, `Hi ${customer.firstName}, ${msg}`), 15000, "Running late SMS");
          toast(`✅ Message sent to ${customer.firstName}`, "green");
          logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: `Hi ${customer.firstName}, ${msg}` }).catch(() => {});
        } else {
          if (!customer.email) throw new Error("No email on file for this customer.");
          const html = emailShell(settings?.companyName || "Crew Boss", "Running Late", `<p>Hi ${customer.firstName},</p><p>${msg}</p>`);
          await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, "Your technician is running late", html), 15000, "Running late email");
          toast(`✅ Message sent to ${customer.firstName}`, "green");
        }
        const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
        if (ownerEmail) {
          const ownerMsg = emailShell(settings?.companyName || "Crew Boss", "Crew Running Late", `<p>${myEmployee.firstName} ${myEmployee.lastName} is running ~${minutes} min late to ${job.address}${lateNote.trim() ? ` (${lateNote.trim()})` : ""}.</p>`);
          sendOwnerGmailOnly(settings as any, ownerEmail, `Running late — ${job.address}`, ownerMsg).catch(() => {});
        }
        const newScheduledTime = shiftScheduledTime(job.scheduledTime, minutes);
        updateJob(job.id, {
          commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: today(), note: `⏱ Running late +${minutes}min${lateNote.trim() ? ` (${lateNote.trim()})` : ""} — customer notified via ${lateCardChannel === "sms" ? "text" : "email"}` }],
          ...(newScheduledTime ? { scheduledTime: newScheduledTime } : {}),
        });
      } catch (err: any) {
        const errMsg = err?.message || "";
        console.error("[RunningLate] — error:", errMsg);
        if (/401|expired|reconnect/i.test(errMsg)) toast("❌ Failed to send — Google token expired, reconnect Google in Settings.", "red");
        else toast(`❌ Failed to send — ${errMsg || "reason unknown"}`, "red");
      } finally {
        setSendingLateJobId(null);
        setLateOpenJobId(null);
        setLateNoteText("");
        setLateMinutes(null);
      }
    };

    const arriveCard = (e: React.MouseEvent) => {
      e.stopPropagation();
      updateJob(job.id, { arrivedAt: Date.now(), status: job.status === "scheduled" ? "in_progress" : job.status });
      toast("Marked as arrived ✓ — owner notified");
      const cust = customers.find(c => c.id === job.customerId);
      notifyOwnerArrival?.(job, cust);
      startDayShiftIfNeeded();
    };

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
              {customer ? (
                <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap">
                  <span>{customer.firstName} {customer.lastName}</span>
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/80 hover:text-blue-300 flex items-center gap-0.5">
                      <Phone size={9} />{customer.phone}
                    </a>
                  )}
                </div>
              ) : job.customerId ? (
                <div className="text-xs text-white/30 italic">Customer info loading...</div>
              ) : null}
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
          {job.status === "completed"
            ? <div className="text-xs text-white/30">Done ✓</div>
            : job.loggedHours ? <div className="text-xs text-white/30">{job.loggedHours}h logged</div>
            : null
          }
        </div>
        {/* OTW + Running Late — any non-completed job */}
        {job.status !== "completed" && job.status !== "cancelled" && (
          <div className="px-4 pb-2 space-y-2" onClick={e => e.stopPropagation()}>
            {latePickerOpen ? (
              <div className="p-2 rounded-xl bg-orange-950/20 border border-orange-700/30 space-y-2">
                <div className="text-[10px] text-orange-300 font-semibold">Running Late</div>
                {/* Send via — explicit choice, never silently defaults away from the chosen channel */}
                <div className="flex gap-1">
                  <button disabled={!customer?.phone} onClick={e => { e.stopPropagation(); setLateCardChannel("sms"); }}
                    className={"flex-1 py-1 rounded-lg border text-[10px] font-semibold transition disabled:opacity-30 " + (lateCardChannel === "sms" ? "border-orange-500 bg-orange-900/40 text-orange-200" : "border-white/10 bg-black/30 text-white/50")}>
                    💬 Text
                  </button>
                  <button disabled={!customer?.email} onClick={e => { e.stopPropagation(); setLateCardChannel("email"); }}
                    className={"flex-1 py-1 rounded-lg border text-[10px] font-semibold transition disabled:opacity-30 " + (lateCardChannel === "email" ? "border-orange-500 bg-orange-900/40 text-orange-200" : "border-white/10 bg-black/30 text-white/50")}>
                    📧 Email
                  </button>
                </div>
                {lateCardChannel === "sms" && !settings?.twilioSid && (
                  <div className="text-[9px] text-yellow-400/80">Twilio isn't configured — add it in Settings, or switch to Email.</div>
                )}
                {lateCardChannel === "email" && !googleLiveCard && (
                  <div className="text-[9px] text-yellow-400/80">Google isn't connected — connect it in Settings, or switch to Text.</div>
                )}
                {/* Reason templates */}
                <div className="flex flex-wrap gap-1">
                  {["Stuck in traffic", "Previous job ran over", "Equipment issue", "Weather delay"].map(t => (
                    <button key={t} onClick={e => { e.stopPropagation(); setLateNote(lateNote === t ? "" : t); }}
                      className={"text-[9px] px-2 py-1 rounded-lg border transition " + (lateNote === t ? "bg-orange-800/50 border-orange-500/60 text-orange-200" : "bg-white/5 border-white/15 text-white/50 hover:border-orange-700/40 hover:text-orange-300")}>
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={lateNote}
                  onChange={e => { e.stopPropagation(); setLateNote(e.target.value); }}
                  onClick={e => e.stopPropagation()}
                  placeholder="Custom note (optional)…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-white placeholder-white/30 focus:outline-none focus:border-orange-700/60"
                />
                <div className="text-[10px] text-white/50">How many minutes late?</div>
                <div className="flex gap-1">
                  {[5, 10, 15, 20, 30].map(m => (
                    <button key={m} onClick={e => { e.stopPropagation(); setLateMinutes(m); }}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-bold transition " + (lateMinutes === m ? "bg-orange-600 border-orange-400 text-white" : "bg-orange-900/40 border-orange-700/40 text-orange-300 hover:bg-orange-900/60")}>
                      {m}
                    </button>
                  ))}
                </div>
                {/* Explicit Send button — a picked minute value only SELECTS now;
                    the message isn't sent until the tech confirms here. */}
                <button
                  disabled={sendingLate || lateMinutes == null}
                  onClick={e => sendRunningLateCard(e, lateMinutes || 0)}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-orange-600 to-orange-800 border border-orange-500/60 text-white text-xs font-bold disabled:opacity-40 hover:from-orange-500 hover:to-orange-700 transition flex items-center justify-center gap-1.5">
                  <Navigation size={12} />{sendingLate ? "Sending…" : lateMinutes == null ? "Pick minutes above" : `Send "${lateMinutes} min late" message`}
                </button>
                <button onClick={e => { e.stopPropagation(); setLatePickerOpen(false); setLateNote(""); setLateMinutes(null); }} className="text-[10px] text-white/30 hover:text-white/60">Cancel</button>
              </div>
            ) : otwOpenCard ? (
              <div className="p-2 rounded-xl bg-blue-950/20 border border-blue-700/30 space-y-2">
                <div className="text-[10px] text-blue-300 font-semibold">On My Way</div>
                <div className="flex gap-1">
                  <button disabled={!customer?.phone} onClick={e => { e.stopPropagation(); setOtwCardChannel("sms"); }}
                    className={"flex-1 py-1 rounded-lg border text-[10px] font-semibold transition disabled:opacity-30 " + (otwCardChannel === "sms" ? "border-blue-500 bg-blue-900/40 text-blue-200" : "border-white/10 bg-black/30 text-white/50")}>
                    💬 Text
                  </button>
                  <button disabled={!customer?.email} onClick={e => { e.stopPropagation(); setOtwCardChannel("email"); }}
                    className={"flex-1 py-1 rounded-lg border text-[10px] font-semibold transition disabled:opacity-30 " + (otwCardChannel === "email" ? "border-blue-500 bg-blue-900/40 text-blue-200" : "border-white/10 bg-black/30 text-white/50")}>
                    📧 Email
                  </button>
                </div>
                {otwCardChannel === "sms" && !settings?.twilioSid && (
                  <div className="text-[9px] text-yellow-400/80">Twilio isn't configured — add it in Settings, or switch to Email.</div>
                )}
                {otwCardChannel === "email" && !googleLiveCard && (
                  <div className="text-[9px] text-yellow-400/80">Google isn't connected — connect it in Settings, or switch to Text.</div>
                )}
                <div className="flex gap-1">
                  <button disabled={sendingOtwCard} onClick={e => { e.stopPropagation(); sendOTW(); }}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 border border-blue-500/60 text-white text-xs font-bold disabled:opacity-40 transition">
                    {sendingOtwCard ? "Sending…" : "Send"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setOtwOpenCard(false); }} className="text-[10px] text-white/30 hover:text-white/60 px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {(customer?.phone || customer?.email) && (
                  <button onClick={e => { e.stopPropagation(); setOtwCardChannel(customer?.phone ? "sms" : "email"); setOtwOpenCard(true); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-blue-950/30 border border-blue-700/40 text-blue-300 text-[10px] font-semibold hover:bg-blue-900/40 transition">
                    <Navigation size={10} />OTW
                  </button>
                )}
                {(customer?.phone || customer?.email) && (
                  <button onClick={e => { e.stopPropagation(); setLateCardChannel(customer?.phone ? "sms" : "email"); setLatePickerOpen(true); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-orange-950/30 border border-orange-700/40 text-orange-300 text-[10px] font-semibold hover:bg-orange-900/40 transition">
                    <Clock size={10} />Running Late
                  </button>
                )}
                {!customer?.phone && !customer?.email && job.customerId && (
                  <div className="text-[10px] text-white/30 italic py-1.5">No contact info for this customer</div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="px-4 pb-3 flex gap-2">
          <button onClick={() => setSelectedJobId(job.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold transition">
            <ChevronRight size={12} />View Details
          </button>
          {!isCompletedCard && (
            <button onClick={e => { e.stopPropagation(); setPendingCompleteJobId(job.id); setSelectedJobId(job.id); }}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-green-950/40 hover:bg-green-900/50 border border-green-700/40 text-green-300 text-xs font-semibold transition">
              <CheckCircle size={12} />Complete
            </button>
          )}
        </div>
      </div>
    );
  };


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

      {/* Persistent shift timer bar — visible on all tabs while clocked in */}
      {empDayClockInAt && (() => {
        const empDayLunchStartAt: number | null = optimisticDayLunchStartAt !== undefined
          ? optimisticDayLunchStartAt
          : ((myEmployee as any)?.dayLunchStartAt ?? null);
        const dayPausedMinutes = Number((myEmployee as any)?.dayPausedMinutes) || 0;
        const currentPauseMs = empDayLunchStartAt ? Math.max(0, Date.now() - empDayLunchStartAt) : 0;
        const netSecs = Math.max(0, Math.floor((Date.now() - empDayClockInAt - dayPausedMinutes * 60000 - currentPauseMs) / 1000));
        const hh = Math.floor(netSecs / 3600);
        const mm = Math.floor((netSecs % 3600) / 60);
        const ss = netSecs % 60;
        const display = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
        const onLunch = !!empDayLunchStartAt;
        const locationSharing = optimisticLocationSharing !== undefined ? optimisticLocationSharing : !!(myEmployee as any)?.locationSharing;
        const empId = (myEmployee as any)?.id;
        const headerToggleLocation = async () => {
          if (!empId) return;
          const turningOn = !locationSharing;
          if (turningOn && navigator.geolocation) {
            setLocationPermissionPending(true);
            let settled = false;
            const safety = setTimeout(() => { if (settled) return; settled = true; setLocationPermissionPending(false); toast("Location request timed out", "red"); }, 12000);
            navigator.geolocation.getCurrentPosition(
              async pos => {
                if (settled) return; settled = true; clearTimeout(safety);
                setLocationPermissionPending(false);
                // Optimistic flip so the "📍 Sharing" badge shows instantly.
                setOptimisticLocationSharing(true);
                toast("📍 Location sharing active", "green");
                // Write BOTH fields in one update so the badge state and the pin
                // land together — a split write meant a missing/slow second
                // update left the badge off even though coords were captured.
                const { error } = await (supabase as any).from("employees").update({ locationSharing: true, lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() } }).eq("id", empId);
                if (error) console.error("[Share Location] — error saving:", error.message);
                else refetchEmployees?.();
              },
              err => { if (settled) return; settled = true; clearTimeout(safety); setLocationPermissionPending(false); console.error("[Share Location] — error:", err.code, err.message); toast("Location denied — enable in settings (" + err.message + ")", "red"); },
              { enableHighAccuracy: true, timeout: 10000 }
            );
            return;
          } else if (turningOn && !navigator.geolocation) {
            toast("This browser doesn't support location sharing", "red"); return;
          }
          // Turning OFF
          setOptimisticLocationSharing(false);
          try {
            const result = await (supabase as any).from("employees").update({ locationSharing: false }).eq("id", empId);
            if (result?.error) { toast("Failed to save — " + result.error.message, "red"); return; }
            refetchEmployees?.();
          } catch (e: any) { toast("Failed to save — " + (e?.message || "try again"), "red"); }
        };
        return (
          <>
            <div className={"flex items-center justify-between px-4 py-1.5 border-b text-xs font-semibold " + (onLunch ? "bg-yellow-950/40 border-yellow-800/30 text-yellow-400" : "bg-green-950/30 border-green-800/20 text-green-400")}>
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className={"absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping " + (onLunch ? "bg-yellow-400" : "bg-green-400")} />
                  <span className={"relative inline-flex rounded-full h-2 w-2 " + (onLunch ? "bg-yellow-400" : "bg-green-400")} />
                </span>
                {onLunch ? "On Lunch / Paused" : "Shift Active"}
              </span>
              <div className="flex items-center gap-3">
                <button onClick={headerToggleLocation} disabled={locationPermissionPending}
                  className={"flex items-center gap-1 px-2 py-0.5 rounded-lg border transition disabled:opacity-50 " + (locationSharing ? "bg-blue-900/40 border-blue-600/40 text-blue-300" : "bg-white/5 border-white/10 text-white/40 hover:text-white/70")}>
                  {locationPermissionPending
                    ? <div className="w-2.5 h-2.5 border border-white/40 border-t-transparent rounded-full animate-spin" />
                    : <MapPin size={10} />}
                  {locationSharing ? "📍 Sharing" : "Share location"}
                </button>
                <span className="font-mono tracking-widest">{display}</span>
              </div>
            </div>
          </>
        );
      })()}

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
            {/* Welcome header + top-of-page Route button (FEATURE 2) */}
            <div className="pb-1 flex items-start justify-between gap-2">
              <div>
                <div className="text-xl font-bold text-white">Welcome, {myEmployee.firstName}!</div>
                <div className="text-sm text-white/50 mt-0.5">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </div>
              </div>
              {todayJobs.filter(j => j.status !== "completed" && j.address).length >= 1 && (
                <button onClick={optimizeRoute} disabled={routeLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-xs font-semibold transition disabled:opacity-40 flex-shrink-0">
                  <Route size={13} />{routeLoading ? "Routing…" : "Route"}
                </button>
              )}
            </div>

            {/* Start My Day — overall work-hours clock, separate from clocking
                into an individual job (job clock-in/out tracks time per stop;
                this tracks the whole shift). */}
            {(() => {
              const dayClockInAt = optimisticDayClockInAt !== undefined ? optimisticDayClockInAt : (myEmployee as any)?.dayClockInAt;
              const dayLunchStartAt = optimisticDayLunchStartAt !== undefined ? optimisticDayLunchStartAt : (myEmployee as any)?.dayLunchStartAt;
              const dayPausedMinutes = Number((myEmployee as any)?.dayPausedMinutes) || 0;
              const empId = (myEmployee as any)?.id;
              // FIX 2 — if the employee already ended their shift once today,
              // "Start My Day" must never overwrite dayClockInAt with a fresh
              // Date.now() (which reset the visible timer back to 0:00 and
              // silently discarded the hours already logged). Track today's
              // already-worked hours from the last End-My-Day and, on Resume,
              // backdate the new dayClockInAt by that amount so the timer
              // continues from where it left off instead of restarting.
              // FIX 2 — prefer the Supabase-synced lastShiftHours/lastShiftDate, but
              // fall back to a localStorage copy for THIS device/browser. If the
              // migration adding those two columns was never run against the real
              // Supabase project, the server write silently fails (see toggleDay's
              // retry chain below) and the Resume feature would otherwise never
              // work at all, no matter how correct this logic is — the localStorage
              // copy guarantees same-device Resume always works regardless.
              const localLastShift = (() => {
                if (!empId) return null;
                try { return JSON.parse(localStorage.getItem("smocks.lastShift." + empId) || "null"); } catch { return null; }
              })();
              // BLOCKER 13 (mobile round 9) — shiftDayStr() (4am cutover)
              // instead of localDateStr() (midnight), so ending/resuming a
              // shift that straddles local midnight doesn't get treated as
              // two different days and silently reset to zero.
              const alreadyWorkedTodayHours = (myEmployee as any)?.lastShiftDate === shiftDayStr()
                ? Number((myEmployee as any)?.lastShiftHours) || 0
                : (localLastShift?.date === shiftDayStr() ? Number(localLastShift?.hours) || 0 : 0);
              const isResuming = !dayClockInAt && alreadyWorkedTodayHours > 0;
              const onLunch = !!dayLunchStartAt;
              const currentPauseMs = onLunch ? Date.now() - dayLunchStartAt : 0;
              const netShiftHoursNow = dayClockInAt
                ? Math.max(0, (Date.now() - dayClockInAt - dayPausedMinutes * 60000 - currentPauseMs) / 3600000)
                : 0;
              const shiftSecs = Math.floor(netShiftHoursNow * 3600);
              const shiftHHMMSS = [Math.floor(shiftSecs / 3600), Math.floor((shiftSecs % 3600) / 60), shiftSecs % 60].map(n => String(n).padStart(2, "0")).join(":");
              const sendEndOfDaySummary = async (finalHours: number) => {
                const todayStr = today();
                const todaysJobs = myJobs.filter(j => j.scheduledDate === todayStr);
                const completedToday = todaysJobs.filter(j => j.status === "completed");
                const loggedHoursToday = Math.round(todaysJobs.reduce((s, j) => s + (Number(j.loggedHours) || 0), 0) * 100) / 100;
                const hours = loggedHoursToday > 0 ? loggedHoursToday : finalHours;
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
                const companyName = settings?.companyName || "Crew Boss";

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
                // FIX 2 — Resuming after an earlier End-My-Day must never reset the
                // visible timer to 0:00. Backdate the new dayClockInAt by whatever
                // was already logged today (isResuming/alreadyWorkedTodayHours,
                // computed above) so `now - dayClockInAt` picks up right where the
                // last shift left off instead of restarting from scratch. The time
                // spent "ended" in between is simply not counted, which is correct.
                const nextVal = endingDay ? null : Date.now() - Math.round(alreadyWorkedTodayHours * 3600000);
                const finalHours = Math.round(netShiftHoursNow * 100) / 100;
                // FIX 2 (mobile round 8) — confirms the Resume flow actually
                // continued from the prior total rather than restarting at
                // zero; alreadyWorkedTodayHours/isResuming are read straight
                // off myEmployee (Supabase-backed), so this is correct
                // whether the employee stayed on this tab, switched tabs and
                // came back, or reloaded the app entirely.
                if (!endingDay && isResuming) console.log("[Verify] Resume Day — continuing from", alreadyWorkedTodayHours.toFixed(2), "h already logged today (not resetting to 0)");
                // Flip immediately — a Supabase update() call resolves with an
                // {error} object on a 400 rather than throwing, so a try/catch
                // around it alone was silently swallowing real failures (the
                // success toast fired and refetchEmployees() then reverted the
                // UI right back since the row was never actually updated).
                setOptimisticDayClockInAt(nextVal);
                // Human-readable total (7h 23m) shown in a banner before the
                // timer disappears, and logged to lastShiftHours below.
                const totH = Math.floor(finalHours);
                const totM = Math.round((finalHours - totH) * 60);
                const totalLabel = `${totH}h ${String(totM).padStart(2, "0")}m`;
                if (endingDay) {
                  setOptimisticDayLunchStartAt(null);
                  sendEndOfDaySummary(finalHours);
                  // Persist for the rest of the day (no auto-hide) — FIX 11.
                  setShiftEndedMsg(`Shift ended · Total ${totalLabel}`);
                } else {
                  // Starting a fresh shift clears any prior "shift ended" banner.
                  setShiftEndedMsg(null);
                }
                // Always write the localStorage fallback immediately, regardless of
                // how the Supabase write below goes — this is what guarantees
                // Resume works on this device even if the lastShiftHours/
                // lastShiftDate columns don't exist yet server-side.
                if (endingDay && empId) {
                  try { localStorage.setItem("smocks.lastShift." + empId, JSON.stringify({ hours: finalHours, date: shiftDayStr() })); } catch { /* ignore */ }
                }
                const patch: any = endingDay
                  ? { dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0, lastShiftHours: finalHours, lastShiftDate: shiftDayStr() }
                  : { dayClockInAt: nextVal, dayLunchStartAt: null, dayPausedMinutes: 0 };
                try {
                  let result = await (supabase as any).from("employees").update(patch).eq("id", empId);
                  if (result?.error) {
                    // Retry with ONLY the shift-timer columns from migration 0002 —
                    // a missing lastShiftHours/lastShiftDate column must not stop
                    // dayClockInAt from persisting, or the owner never sees the shift.
                    console.warn("[HoursSync] full patch failed:", result.error.message, "— retrying without lastShiftHours/lastShiftDate");
                    const core = endingDay
                      ? { dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0 }
                      : { dayClockInAt: nextVal, dayLunchStartAt: null, dayPausedMinutes: 0 };
                    result = await (supabase as any).from("employees").update(core).eq("id", empId);
                  }
                  if (result?.error) {
                    // Even dayLunchStartAt/dayPausedMinutes (migration 0002) may be
                    // missing — fall back to JUST dayClockInAt (migration 0001, the
                    // oldest/most foundational column) so the owner's Live Team View
                    // at least sees the shift, even if pause/lunch tracking can't save.
                    console.warn("[HoursSync] core patch also failed:", result.error.message, "— retrying dayClockInAt only. Run supabase/migrations/0001 and 0002 in the Supabase SQL editor.");
                    result = await (supabase as any).from("employees").update({ dayClockInAt: nextVal }).eq("id", empId);
                  }
                  if (result?.error) {
                    console.error("[HoursSync] — error:", result.error.message);
                    toast("Saved locally, but couldn't sync to the server: " + result.error.message, "red");
                  } else {
                    refetchEmployees?.();
                    toast(endingDay ? `Shift ended · Total ${totalLabel} logged, summary emailed` : "Day started — owner can see you're on shift");
                  }
                } catch (e: any) {
                  console.error("[HoursSync] — error:", e?.message || e);
                  toast("Saved locally, but couldn't sync to the server: " + (e?.message || "unknown error"), "red");
                }
              };
              const toggleLunchPause = async (isLunch?: boolean) => {
                if (!empId || !dayClockInAt) return;
                const turningOn = !onLunch;
                if (turningOn) {
                  setOptimisticDayLunchStartAt(Date.now());
                  if (isLunch !== undefined) setPauseMode(isLunch);
                } else {
                  setOptimisticDayLunchStartAt(null);
                  setPauseMode(false);
                }
                const patch: any = turningOn
                  ? { dayLunchStartAt: Date.now() }
                  : { dayLunchStartAt: null, dayPausedMinutes: dayPausedMinutes + currentPauseMs / 60000 };
                try {
                  const result = await (supabase as any).from("employees").update(patch).eq("id", empId);
                  if (result?.error) { toast("Failed to save — " + result.error.message, "red"); return; }
                  refetchEmployees?.();
                  if (turningOn) {
                    toast(isLunch ? "Lunch started — timer paused 🍽️" : "Timer paused ⏸");
                  } else {
                    toast("Timer resumed ▶");
                  }
                } catch (e: any) {
                  toast("Saved locally, but couldn't sync to the server: " + (e?.message || ""), "red");
                }
              };
              const maxLunchMins = Number((settings as any)?.maxLunchMinutes ?? 30);
              const lunchElapsedSecs = onLunch ? Math.floor(currentPauseMs / 1000) : 0;
              const lunchRemainSecs = Math.max(0, maxLunchMins * 60 - lunchElapsedSecs);
              const lunchOverSecs = Math.max(0, lunchElapsedSecs - maxLunchMins * 60);
              const lunchCountdownHHMMSS = [Math.floor(lunchRemainSecs / 3600), Math.floor((lunchRemainSecs % 3600) / 60), lunchRemainSecs % 60].map(n => String(n).padStart(2, "0")).join(":");
              const locationSharing = !!(myEmployee as any)?.locationSharing;
              const toggleLocationSharing = async () => {
                if (!empId) { toast("Still loading your profile — try again in a moment", "yellow"); return; }
                const turningOn = !locationSharing;
                // Request the permission prompt immediately on tap — previously
                // this only flipped a DB flag and GPS posting silently waited
                // for the employee to also be clocked in, so pressing the
                // button while off-shift looked like it "did nothing" with no
                // permission prompt and no feedback at all.
                if (turningOn && navigator.geolocation) {
                  setLocationPermissionPending(true);
                  // Belt-and-suspenders timeout: some mobile browsers/WebViews
                  // don't reliably honor getCurrentPosition's own `timeout`
                  // option and just never call either callback, which is what
                  // left the button stuck on "Requesting location permission…"
                  // forever. This guarantees the pending state always clears.
                  let settled = false;
                  const safety = setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    setLocationPermissionPending(false);
                    toast("Location request timed out — try again", "red");
                  }, 12000);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      if (settled) return;
                      settled = true; clearTimeout(safety);
                      setLocationPermissionPending(false);
                      toast("📍 Location sharing active");
                      (supabase as any).from("employees").update({ lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() }, locationSharing: true }).eq("id", empId).then((r: any) => { if (r?.error) console.error("[Share Location] — error saving coords:", r.error.message); else refetchEmployees?.(); });
                    },
                    (err) => {
                      if (settled) return;
                      settled = true; clearTimeout(safety);
                      setLocationPermissionPending(false);
                      console.error("[Share Location] — error:", err.code, err.message);
                      toast("Location denied — enable in settings (" + err.message + ")", "red");
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                } else if (turningOn && !navigator.geolocation) {
                  toast("This browser doesn't support location sharing", "red");
                  return;
                }
                try {
                  const result = await (supabase as any).from("employees").update({ locationSharing: turningOn }).eq("id", empId);
                  if (result?.error) { toast("Failed to save — " + result.error.message, "red"); return; }
                  refetchEmployees?.();
                } catch (e: any) { toast("Failed to save — " + (e?.message || "try again"), "red"); }
              };
              return (
                <>
                  {shiftEndedMsg && !dayClockInAt && (
                    <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-green-950/40 border border-green-700/40 text-green-300 font-semibold text-sm">
                      <CheckCircle size={16} />{shiftEndedMsg}
                    </div>
                  )}
                  {dayClockInAt && (
                    <div className="text-center py-2 rounded-2xl">
                      <div className={"font-mono text-2xl font-bold tracking-wider " + (onLunch ? "text-yellow-400" : "text-green-300")}>
                        {shiftHHMMSS}
                      </div>
                      {onLunch && (
                        pauseIsLunch ? (
                          lunchOverSecs > 0 ? (
                            <div className="text-[10px] font-sans font-normal text-red-400/80 mt-0.5">
                              🍽️ Lunch over by {Math.ceil(lunchOverSecs / 60)}m — tap Resume when back
                            </div>
                          ) : (
                            <div className="text-xs font-sans font-semibold text-yellow-400 mt-0.5">
                              🍽️ {lunchCountdownHHMMSS} remaining
                            </div>
                          )
                        ) : (
                          <div className="text-[10px] font-sans font-normal text-yellow-400/70 mt-0.5">⏸ Timer paused</div>
                        )
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={toggleDay} className={"flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition active:scale-95 " + (dayClockInAt ? "bg-green-900/40 border-2 border-green-500/60 text-green-300" : isResuming ? "bg-blue-900/40 border-2 border-blue-500/60 text-blue-300 hover:bg-blue-900/60" : "bg-red-700/40 border-2 border-red-500/60 text-white hover:bg-red-700/60")}>
                      {dayClockInAt ? <Clock size={16} /> : isResuming ? <Play size={16} /> : <Clock size={16} />}
                      {dayClockInAt ? "End My Day" : isResuming ? "Resume" : "Start My Day"}
                    </button>
                    {dayClockInAt && onLunch && (
                      <button onClick={() => toggleLunchPause()} className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4 rounded-2xl font-semibold text-sm transition active:scale-95 bg-yellow-900/40 border-2 border-yellow-500/60 text-yellow-300">
                        <Play size={14} />Resume
                      </button>
                    )}
                    {dayClockInAt && !onLunch && (
                      <button onClick={() => toggleLunchPause(false)} className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 rounded-2xl font-semibold text-xs transition active:scale-95 bg-white/5 border-2 border-white/10 text-white/60 hover:text-white">
                        <Pause size={13} />Pause
                      </button>
                    )}
                    {dayClockInAt && !onLunch && (
                      <button onClick={() => toggleLunchPause(true)} className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 rounded-2xl font-semibold text-xs transition active:scale-95 bg-yellow-950/40 border-2 border-yellow-700/40 text-yellow-400 hover:bg-yellow-900/30">
                        🍽️ Lunch
                      </button>
                    )}
                  </div>
                  <button onClick={toggleLocationSharing} disabled={locationPermissionPending} className={"w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition disabled:opacity-60 " + (locationSharing ? "bg-blue-900/30 border border-blue-500/40 text-blue-300" : "bg-white/5 border border-white/10 text-white/50")}>
                    {locationPermissionPending
                      ? <div className="w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                      : <MapPin size={12} />}
                    {locationPermissionPending ? "Requesting location permission…" : locationSharing ? "Sharing my location with owner 🟢" : "Share My Location (off)"}
                  </button>
                  {/* FIX 11 — sharing itself never needs a Maps key (just browser
                      geolocation); the map preview is a nice-to-have bonus, not a
                      requirement. Without a key, show a plain confirmation badge
                      instead of LiveMap's "add a Maps API key" placeholder, which
                      read as if sharing were broken/incomplete. */}
                  {locationSharing && (myEmployee as any)?.lastLocation?.lat != null && (
                    (settings.googleMapsKey || settings.mapsKey) ? (
                      <LiveMap
                        apiKey={settings.googleMapsKey || settings.mapsKey || ""}
                        pins={[{ id: empId, label: (myEmployee as any).firstName || "Me", lat: (myEmployee as any).lastLocation.lat, lng: (myEmployee as any).lastLocation.lng, updatedAt: (myEmployee as any).lastLocation.updatedAt }]}
                      />
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-950/20 border border-blue-700/30 text-blue-300 text-xs">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" /></span>
                        Location updated {new Date((myEmployee as any).lastLocation.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} — owner can see you on Live Crew View
                      </div>
                    )
                  )}
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
            {todayJobs.filter(j => j.status !== "completed" && j.address).length >= 1 && (
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
            // Cancelled jobs are hidden from the calendar by default — same
            // "Show Cancelled" convention as the All Jobs tab — rather than
            // the calendar showing every assigned job regardless of status
            // with no way to filter cancellations out.
            const calVisibleJobs = showCanceledJobs ? myJobs : myJobs.filter(j => j.status !== "cancelled");
            const calCanceledCount = myJobs.filter(j => j.status === "cancelled").length;
            const calDayJobs = calVisibleJobs.filter(j => j.scheduledDate === calSelectedDate);
            // AUDIT — the [EmpCalendar] trace log here (FIX 3, mobile round
            // 8) ran on every render of this tab, which re-renders on every
            // 3s/10s jobs poll and realtime update while an employee has the
            // Calendar tab open — flooding the console all day. The pipeline
            // bug it was tracing is confirmed fixed; removed rather than left
            // logging continuously.

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
                {calCanceledCount > 0 && (
                  <button onClick={() => setShowCanceledJobs(v => !v)} className={"w-full flex items-center justify-center gap-1.5 py-1.5 mb-3 rounded-xl border text-xs font-medium transition " + (showCanceledJobs ? "bg-red-950/20 border-red-700/40 text-red-300" : "bg-black/30 border-white/10 text-white/40 hover:text-white/60")}>
                    {showCanceledJobs ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {showCanceledJobs ? `Showing ${calCanceledCount} canceled job${calCanceledCount !== 1 ? "s" : ""}` : `Show Canceled (${calCanceledCount})`}
                  </button>
                )}
                {showAvailability && (
                  <div className="mb-3 space-y-2">
                    <div className="p-2.5 rounded-xl bg-orange-950/20 border border-orange-700/30 text-xs text-orange-200/70">
                      Tap dates to mark yourself <b>unavailable</b>. Gray dates = blocked. Owner will see these when scheduling.
                      {availability.length > 0 && <span className="ml-2 text-orange-300">{availability.length} day{availability.length !== 1 ? "s" : ""} blocked</span>}
                    </div>
                    {/* FEATURE 5 — recurring weekday off (e.g. "every Sunday"),
                        separate from the specific-date picker below. */}
                    <div className="p-2.5 rounded-xl bg-orange-950/10 border border-orange-700/20">
                      <div className="text-xs text-orange-200/70 mb-2">Recurring days off <span className="text-white/30">(every week)</span></div>
                      <div className="flex flex-wrap gap-1.5">
                        {weekdayLabels.map((lbl, i) => {
                          const active = recurringDaysOff.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => toggleRecurringDayOff(i)}
                              className={"px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition " + (active ? "bg-orange-600 border-orange-500 text-white" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
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
                        const dayJobs = calVisibleJobs.filter(j => j.scheduledDate === dateStr);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === calSelectedDate && !showAvailability;
                        // FEATURE 5 — a recurring day off (e.g. "every Sunday")
                        // must show as blocked here too, not just specific dates.
                        const isUnavail = availability.includes(dateStr) || recurringDaysOff.includes(d.getDay());
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
                                    {c && (
                          <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap">
                            <span>{c.firstName} {c.lastName}</span>
                            {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/80 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                          </div>
                        )}
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
                    {/* Month navigation — prev/next buttons are also drag targets:
                        hovering while dragging a job for 500ms auto-advances the month */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => setCalMonthOffset(o => o - 1)}
                        onDragOver={e => {
                          e.preventDefault();
                          if (!calDragJobId) return;
                          if (!calMonthEdgeTimerRef.current) {
                            calMonthEdgeTimerRef.current = setTimeout(() => {
                              setCalMonthOffset(o => o - 1);
                              calMonthEdgeTimerRef.current = null;
                            }, 500);
                          }
                        }}
                        onDragLeave={() => { clearTimeout(calMonthEdgeTimerRef.current); calMonthEdgeTimerRef.current = null; }}
                        onDrop={() => { clearTimeout(calMonthEdgeTimerRef.current); calMonthEdgeTimerRef.current = null; }}
                        className={"p-2 rounded-lg text-white/50 hover:text-white transition " + (calDragJobId ? "hover:bg-blue-900/40 border border-dashed border-blue-700/40" : "hover:bg-white/10")}>
                        <ChevronLeft size={16} />
                      </button>
                      <div className="text-sm font-semibold">{calMonthLabel}</div>
                      <button
                        onClick={() => setCalMonthOffset(o => o + 1)}
                        onDragOver={e => {
                          e.preventDefault();
                          if (!calDragJobId) return;
                          if (!calMonthEdgeTimerRef.current) {
                            calMonthEdgeTimerRef.current = setTimeout(() => {
                              setCalMonthOffset(o => o + 1);
                              calMonthEdgeTimerRef.current = null;
                            }, 500);
                          }
                        }}
                        onDragLeave={() => { clearTimeout(calMonthEdgeTimerRef.current); calMonthEdgeTimerRef.current = null; }}
                        onDrop={() => { clearTimeout(calMonthEdgeTimerRef.current); calMonthEdgeTimerRef.current = null; }}
                        className={"p-2 rounded-lg text-white/50 hover:text-white transition " + (calDragJobId ? "hover:bg-blue-900/40 border border-dashed border-blue-700/40" : "hover:bg-white/10")}>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {["S","M","T","W","T","F","S"].map((d, i) => (
                        <div key={i} className="text-center text-[10px] text-white/30 font-semibold py-1">{d}</div>
                      ))}
                    </div>
                    {/* Month grid — day cells are drop targets when dragging a job */}
                    <div className="grid grid-cols-7 gap-0.5 mb-4">
                      {Array.from({ length: calFirstDay }, (_, i) => <div key={"e" + i} />)}
                      {Array.from({ length: calDaysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dateStr = `${calMonthYear}-${String(calMonthMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const dayJobs = calVisibleJobs.filter(j => j.scheduledDate === dateStr);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === calSelectedDate && !showAvailability;
                        // FEATURE 5 — recurring weekday off applies here too.
                        const isUnavail = availability.includes(dateStr) || recurringDaysOff.includes(new Date(calMonthYear, calMonthMonth, day).getDay());
                        return (
                          <button key={day}
                            onClick={() => showAvailability ? toggleAvailability(dateStr) : setCalSelectedDate(dateStr)}
                            onDragOver={e => { if (calDragJobId) e.preventDefault(); }}
                            onDrop={e => {
                              e.preventDefault();
                              if (!calDragJobId) return;
                              updateJob(calDragJobId, { scheduledDate: dateStr });
                              setCalDragJobId(null);
                              setCalSelectedDate(dateStr);
                              toast("Job moved to " + new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }));
                            }}
                            className={`flex flex-col items-center py-1.5 rounded-lg transition min-h-[44px] ${
                              calDragJobId ? "cursor-copy" : ""
                            } ${
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
                    {/* Jobs for selected day — draggable + right-click context menu */}
                    <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                      <span>{new Date(calSelectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                      {calDayJobs.length > 0 && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{calDayJobs.length}</span>}
                      {calDragJobId && <span className="text-[10px] text-blue-300 animate-pulse">Drop on a date to reschedule</span>}
                    </div>
                    {calDayJobs.length === 0 ? (
                      <div className="text-center py-6 text-white/30 text-sm">No jobs this day</div>
                    ) : (
                      <div className="space-y-2">
                        {calDayJobs.map(j => {
                          const c = customers.find(x => x.id === j.customerId);
                          return (
                            <div key={j.id}
                              draggable
                              onDragStart={() => setCalDragJobId(j.id)}
                              onDragEnd={() => setCalDragJobId(null)}
                              onContextMenu={e => {
                                e.preventDefault();
                                setCalCtxMenu({ jobId: j.id, x: e.clientX, y: e.clientY });
                              }}
                              className={"rounded-xl border overflow-hidden transition cursor-grab active:cursor-grabbing " + (calDragJobId === j.id ? "opacity-50 border-blue-600/60 bg-blue-950/20" : "bg-white/5 border-white/10")}>
                              <button onClick={() => setSelectedJobId(j.id)} className="w-full text-left p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{j.address}</div>
                                    {c && (
                                      <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap">
                                        <span>{c.firstName} {c.lastName}</span>
                                        {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/80 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                                      </div>
                                    )}
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
                                <span className="text-[10px] text-white/20 ml-auto">drag to reschedule</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Right-click context menu — positioned at click coords, not at bottom of page */}
                    {calCtxMenu && (() => {
                      const ctxJob = myJobs.find(j => j.id === calCtxMenu.jobId);
                      if (!ctxJob) return null;
                      return (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setCalCtxMenu(null)} />
                          <div
                            className="fixed z-50 w-48 rounded-xl bg-black/95 border border-white/15 shadow-2xl overflow-hidden"
                            style={{ left: Math.min(calCtxMenu.x, window.innerWidth - 200), top: Math.min(calCtxMenu.y, window.innerHeight - 200) }}>
                            <div className="px-3 py-2 border-b border-white/10">
                              <div className="text-[11px] font-semibold text-white/80 truncate">{ctxJob.address}</div>
                              <div className="text-[10px] text-white/40">{ctxJob.scheduledDate}</div>
                            </div>
                            <button onClick={() => { setSelectedJobId(calCtxMenu.jobId); setCalCtxMenu(null); }}
                              className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition flex items-center gap-2">
                              <ChevronRight size={12} />View Details
                            </button>
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ctxJob.address)}`}
                              target="_blank" rel="noreferrer"
                              onClick={() => setCalCtxMenu(null)}
                              className="block px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition flex items-center gap-2">
                              <Navigation size={12} />Navigate
                            </a>
                            <a href={toGCalUrl(ctxJob)} target="_blank" rel="noreferrer"
                              onClick={() => setCalCtxMenu(null)}
                              className="block px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition flex items-center gap-2">
                              <Calendar size={12} />Add to Google Cal
                            </a>
                            {!ctxJob.arrivedAt && ctxJob.status !== "completed" && (
                              <button onClick={() => {
                                updateJob(calCtxMenu.jobId, { arrivedAt: Date.now() });
                                toast("Marked as arrived ✓");
                                setCalCtxMenu(null);
                              }} className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition flex items-center gap-2">
                                <MapPin size={12} />Mark Arrived
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
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
                {/* Route button — optimize today's stops (FEATURE 2) */}
                {todayJobs.filter(j => j.status !== "completed" && j.address).length >= 1 && (
                  <button onClick={optimizeRoute} disabled={routeLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-sm font-semibold transition disabled:opacity-40">
                    <Route size={15} />{routeLoading ? "Optimizing route…" : "Route Today's Jobs"}
                  </button>
                )}
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
              // FIX 5 (mobile round 3) — this used to only count job.loggedHours,
              // missing the shift-timer top-up (ended OR still-in-progress)
              // that the Today tab's widget already includes — so an employee
              // whose hours came mostly from the whole-day shift timer instead
              // of completed jobs saw $0 here even though Today showed hours.
              const hrs = pJobs.reduce((acc, j) => acc + Number(j.loggedHours || 0), 0) + computeEmployeeShiftTopUp(s, e);
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
            // FIX 5 — "where does the Pay tab fetch hours from": the jobs
            // table (via the `jobs` prop, polled from Supabase by App.tsx,
            // filtered here to this employee's crew) for loggedHours, plus
            // this employee's own dayClockInAt/lastShiftHours (via the
            // `employees` prop) for the shift-timer top-up. No separate
            // Supabase query happens in this component — it all reads
            // already-fetched, live-polled parent state.

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
                <div><h1>${settings.companyName || "Crew Boss"}</h1><p style="color:#666;margin-top:4px">Employee Tax Summary — ${empName} · ${thisYear} · Generated ${today()}</p></div>
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
                        {p.status === "paid" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/40 text-green-300">Paid</span>
                        ) : (
                          <button
                            onClick={() => markPeriodPaid(p.start)}
                            disabled={markingPaidPeriod === p.start}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-300 hover:bg-yellow-800/40 transition disabled:opacity-50"
                            title="Confirm you received this pay — this notifies the owner"
                          >
                            {markingPaidPeriod === p.start ? "Saving…" : "Mark as Paid"}
                          </button>
                        )}
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

                {/* FIX 3 — daily calendar view: every day this month with logged
                    hours, its earnings (respecting per-job-type rate overrides via
                    getEffectiveRate), and an individually-markable paid/unpaid
                    status — separate from the 14-day period marking above. */}
                {(() => {
                  const calBase = new Date();
                  calBase.setMonth(calBase.getMonth() + payCalMonthOffset, 1);
                  const year = calBase.getFullYear(), month = calBase.getMonth();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const firstDow = new Date(year, month, 1).getDay();
                  const paidDaysMap: Record<string, "paid" | "unpaid"> = (myEmployee as any)?.paidDays || {};
                  const dayCells: Array<{ key: string; day: number; hours: number; pay: number; status: "paid" | "unpaid" } | null> = [];
                  for (let i = 0; i < firstDow; i++) dayCells.push(null);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const dayJobs = myJobs.filter(j => j.scheduledDate === key && Number(j.loggedHours) > 0);
                    const hours = Math.round(dayJobs.reduce((s, j) => s + Number(j.loggedHours || 0), 0) * 100) / 100;
                    const pay = Math.round(dayJobs.reduce((s, j) => s + Number(j.loggedHours || 0) * getEffectiveRate(myEmployee, j), 0) * 100) / 100;
                    dayCells.push({ key, day: d, hours, pay, status: paidDaysMap[key] || "unpaid" });
                  }
                  const monthLabel = calBase.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                  const monthTotal = dayCells.reduce((s, c) => s + (c?.pay || 0), 0);
                  return (
                    <Glass className="p-4 !bg-black/40">
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={() => setPayCalMonthOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><ChevronLeft size={14} /></button>
                        <div className="text-xs font-semibold text-white/70">{monthLabel}</div>
                        <button onClick={() => setPayCalMonthOffset(o => Math.min(0, o + 1))} disabled={payCalMonthOffset >= 0} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 disabled:opacity-30"><ChevronRight size={14} /></button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center mb-1">
                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-[9px] text-white/30 font-semibold">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {dayCells.map((c, i) => c === null ? <div key={i} /> : (
                          <button
                            key={i}
                            onClick={() => c.hours > 0 && markDayPaid(c.key)}
                            disabled={c.hours === 0 || markingPaidDay === c.key}
                            className={"aspect-square rounded-lg text-[9px] flex flex-col items-center justify-center gap-0.5 transition " +
                              (c.hours === 0 ? "text-white/20" : c.status === "paid" ? "bg-green-900/40 border border-green-600/40 text-green-300 hover:bg-green-800/40" : "bg-yellow-950/30 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/40")}
                            title={c.hours > 0 ? `${c.hours}h · ${fmt(c.pay)} · ${c.status === "paid" ? "Paid — tap to unmark" : "Unpaid — tap to mark paid"}` : undefined}
                          >
                            <span className="font-semibold">{c.day}</span>
                            {c.hours > 0 && <span>{c.hours}h</span>}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10 text-[10px]">
                        <span className="text-white/40">Month total</span>
                        <span className="font-bold text-white/70">{fmt(monthTotal)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[9px] text-white/30">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-700/60" />Unpaid</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-700/60" />Paid</span>
                        <span>· tap a day to toggle</span>
                      </div>
                    </Glass>
                  );
                })()}

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

                {/* Hours & Earnings breakdown — daily/weekly/monthly granularity,
                    pulled from real loggedHours on completed jobs (same source
                    of truth as the pay periods above). */}
                {(() => {
                  const rate = myEmployee?.hourlyRate || 0;
                  // BLOCKER 11 (mobile round 7) — bucketed hours used to be
                  // job.loggedHours only, unlike the Pay Period table above
                  // which already includes computeEmployeeShiftTopUp — so an
                  // employee whose hours came mostly from the whole-day
                  // shift timer (not a completed job) saw this chart
                  // under-report vs. the numbers just above it. Adding the
                  // top-up on whichever single bucket contains lastShiftDate
                  // keeps both sections consistent.
                  const bucketHours = (dateKeys: string[]): { name: string; hours: number; earnings: number }[] =>
                    dateKeys.map(key => {
                      const jobHrs = myJobs.filter(j => (j.scheduledDate || "").startsWith(key)).reduce((s, j) => s + (Number(j.loggedHours) || 0), 0);
                      const topUp = computeEmployeeShiftTopUp(key, key);
                      const hrs = jobHrs + topUp;
                      return { name: key, hours: Math.round(hrs * 100) / 100, earnings: Math.round(hrs * rate * 100) / 100 };
                    });
                  const bucketRangeHours = (s: string, e: string): number =>
                    myJobs.filter(j => j.scheduledDate >= s && j.scheduledDate <= e).reduce((acc, j) => acc + (Number(j.loggedHours) || 0), 0) + computeEmployeeShiftTopUp(s, e);
                  let chartData: { name: string; hours: number; earnings: number }[];
                  let ChartComp: any = BarChart;
                  if (payChartRange === "7d") {
                    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().slice(0, 10); });
                    chartData = bucketHours(days).map((d, i) => ({ ...d, name: new Date(days[i] + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }) }));
                  } else if (payChartRange === "4wk") {
                    chartData = Array.from({ length: 4 }, (_, i) => {
                      const end = new Date(); end.setDate(end.getDate() - (3 - i) * 7);
                      const start = new Date(end); start.setDate(start.getDate() - 6);
                      const s = start.toISOString().slice(0, 10), e = end.toISOString().slice(0, 10);
                      const hrs = bucketRangeHours(s, e);
                      return { name: `${start.getMonth() + 1}/${start.getDate()}`, hours: Math.round(hrs * 100) / 100, earnings: Math.round(hrs * rate * 100) / 100 };
                    });
                  } else if (payChartRange === "custom") {
                    const s = payCustomStart, e = payCustomEnd > payCustomStart ? payCustomEnd : payCustomStart;
                    const spanDays = Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1);
                    if (spanDays <= 31) {
                      const days = Array.from({ length: spanDays }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });
                      chartData = bucketHours(days).map((d, i) => ({ ...d, name: new Date(days[i] + "T12:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) }));
                    } else {
                      const weeks = Math.ceil(spanDays / 7);
                      chartData = Array.from({ length: weeks }, (_, i) => {
                        const wStart = new Date(s); wStart.setDate(wStart.getDate() + i * 7);
                        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
                        const ws = wStart.toISOString().slice(0, 10), we = (wEnd.toISOString().slice(0, 10) > e ? e : wEnd.toISOString().slice(0, 10));
                        const hrs = bucketRangeHours(ws, we);
                        return { name: `${wStart.getMonth() + 1}/${wStart.getDate()}`, hours: Math.round(hrs * 100) / 100, earnings: Math.round(hrs * rate * 100) / 100 };
                      });
                    }
                  } else {
                    ChartComp = LineChart;
                    chartData = Array.from({ length: 12 }, (_, i) => {
                      const d = new Date(); d.setMonth(d.getMonth() - (11 - i)); d.setDate(1);
                      const key = d.toISOString().slice(0, 7);
                      const monthStart = key + "-01";
                      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
                      const hrs = bucketRangeHours(monthStart, monthEnd);
                      return { name: d.toLocaleDateString("en-US", { month: "short" }), hours: Math.round(hrs * 100) / 100, earnings: Math.round(hrs * rate * 100) / 100 };
                    });
                  }
                  const DataComp: any = payChartRange === "12mo" ? Line : Bar;
                  return (
                    <Glass className="p-4 !bg-black/40 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="text-xs text-white/50 uppercase tracking-wider">Hours & Earnings</div>
                        <div className="flex gap-1 p-0.5 bg-black/40 border border-white/10 rounded-lg">
                          {([["7d", "7 Days"], ["4wk", "4 Weeks"], ["12mo", "12 Months"], ["custom", "Custom"]] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setPayChartRange(k)} className={"px-2 py-1 rounded text-[10px] font-medium transition " + (payChartRange === k ? "bg-red-700/40 text-white" : "text-white/40")}>{l}</button>
                          ))}
                        </div>
                      </div>
                      {payChartRange === "custom" && (
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <input type="date" value={payCustomStart} max={payCustomEnd} onChange={e => setPayCustomStart(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white" />
                          <span>to</span>
                          <input type="date" value={payCustomEnd} min={payCustomStart} max={today()} onChange={e => setPayCustomEnd(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white" />
                        </div>
                      )}
                      <div>
                        <div className="text-[10px] text-white/40 mb-1">Hours</div>
                        <div style={{ width: "100%", height: 130 }}>
                          <ResponsiveContainer>
                            <ChartComp data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
                              <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} formatter={(v: any) => `${v}h`} />
                              <DataComp dataKey="hours" {...(payChartRange === "12mo" ? { stroke: "#60a5fa", strokeWidth: 2, dot: false } : { fill: "#60a5fa", radius: [4, 4, 0, 0] })} />
                            </ChartComp>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 mb-1">Earnings</div>
                        <div style={{ width: "100%", height: 130 }}>
                          <ResponsiveContainer>
                            <ChartComp data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
                              <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} formatter={(v: any) => fmt(v)} />
                              <DataComp dataKey="earnings" {...(payChartRange === "12mo" ? { stroke: "#22c55e", strokeWidth: 2, dot: false } : { fill: "#22c55e", radius: [4, 4, 0, 0] })} />
                            </ChartComp>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </Glass>
                  );
                })()}

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
            // Linked but no valid token — only treat this as "needs reconnect" when
            // there's also no refresh_token to silently fix it with (the 5-minute
            // background refresh effect above handles that case automatically), OR
            // a real refresh attempt with that refresh_token already failed
            // (empGoogleRefreshFailed — FIX 10, mobile round 6). Showing "reconnect"
            // the instant the 1hr access token expires, even though a refresh_token
            // exists and hasn't been tried/has succeeded before, was alarming
            // employees over a transient, self-healing state — but silently retrying
            // forever against a revoked refresh_token with no visible failure state
            // was the opposite problem.
            const empGoogleExpired = empGoogleIdentityLinked && !empGoogleValid && (!storedToken?.refreshToken || empGoogleRefreshFailed);
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
                  <Glass className={"p-4 " + (empGoogleConfigMissing ? "!bg-red-950/20 !border-red-700/30" : "!bg-yellow-950/20 !border-yellow-700/30")}>
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle size={18} className={(empGoogleConfigMissing ? "text-red-400" : "text-yellow-400") + " flex-shrink-0"} />
                      <div className="flex-1 min-w-0">
                        <div className={"font-semibold text-sm " + (empGoogleConfigMissing ? "text-red-300" : "text-yellow-300")}>
                          {empGoogleConfigMissing ? "Google Sync Unavailable — Server Setup Needed" : "Google Connection Expired"}
                        </div>
                        {empGoogleEmail && <div className="text-xs text-white/50 mt-0.5">{empGoogleEmail}</div>}
                        {/* AUDIT — reconnecting can't fix a missing
                            GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET on the
                            server; every "expired" banner used to say the
                            same generic thing regardless of cause, so an
                            employee (and the owner they escalated to) had no
                            way to tell "just expired" from "will never work
                            until an admin fixes Cloudflare." */}
                        <div className="text-xs text-white/40 mt-0.5">
                          {empGoogleConfigMissing
                            ? "This isn't something reconnecting will fix — ask the business owner to check Settings → Integrations → Google."
                            : "Your access token expired — reconnect to resume calendar sync"}
                        </div>
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
                    knownAddresses={Array.from(new Set([...myJobs.map(j => j.address), ...customers.map((c: any) => c.address)].filter(Boolean)))}
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
                                {c && (
                                  <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap">
                                    <span>{c.firstName} {c.lastName}</span>
                                    {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/70 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                                  </div>
                                )}
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

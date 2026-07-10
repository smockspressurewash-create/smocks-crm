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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, requiredChemicalsList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, compressImageFile, getEffectiveRate } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField, JobChecklistItem, ChecklistPhoto, JobVideo, JobSignOff } from "../../types";
import { twilioSend, sendEmail, sendViaGmail, sendOwnerGmailOnly, emailShell, emailButton, logOutboundSmsToInbox } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { createGCalEvent as createGCalEventApi, updateGCalEvent as updateGCalEventApi, deleteGCalEvent as deleteGCalEventApi, refreshEmpGoogleToken } from "../../lib/googleApi";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { supabase } from "../../lib/supabase";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";
import { Modal } from "./Modal";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import { Badge } from "./Badge";
import { Stat } from "./Stat";
import { PBar } from "./PBar";
import { PageFade } from "./PageFade";
import { TimeframeSelector } from "./TimeframeSelector";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { PropertyMapEmbed } from "./PropertyMapEmbed";

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

function ChecklistSection({ title, emoji, items, onUpdate }: {
  title: string; emoji: string;
  items: JobChecklistItem[];
  onUpdate: (items: JobChecklistItem[]) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const done = items.filter(i => i.done).length;
  const allDone = done === items.length;

  const toggle = (id: string) =>
    onUpdate(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
  const updateNotes = (id: string, notes: string) =>
    onUpdate(items.map(it => it.id === id ? { ...it, notes } : it));
  const addPhoto = (id: string, dataUrl: string) =>
    onUpdate(items.map(it => it.id === id ? { ...it, photos: [...(it.photos || []), { id: uid(), dataUrl }] } : it));
  const removePhoto = (itemId: string, photoId: string) =>
    onUpdate(items.map(it => it.id === itemId ? { ...it, photos: (it.photos || []).filter(p => p.id !== photoId) } : it));

  return (
    <Glass className={"p-3 !bg-black/40 " + (allDone ? "!border-green-700/40" : "")}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1">
          <span>{emoji}</span>{title}
        </div>
        <div className={"text-xs font-bold " + (allDone ? "text-green-400" : "text-white/40")}>
          {done}/{items.length} {allDone && "✓"}
        </div>
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg">
              <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)}
                className="w-4 h-4 accent-green-500 cursor-pointer flex-shrink-0" />
              <span className={"text-xs flex-1 " + (item.done ? "line-through text-white/30" : "text-white/80")}>
                {item.label}
              </span>
              {(item.photos || []).length > 0 && (
                <span className="text-[9px] text-blue-400/70">📷{item.photos!.length}</span>
              )}
              <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                className="text-white/20 hover:text-white/60 flex-shrink-0 transition">
                <ChevronRight size={12} className={"transition-transform " + (expanded === item.id ? "rotate-90" : "")} />
              </button>
            </div>
            {expanded === item.id && (
              <div className="pl-6 pr-2 pb-2 space-y-2">
                <GTxt rows={1} value={item.notes || ""} onChange={e => updateNotes(item.id, e.target.value)}
                  placeholder="Add notes..." className="!text-xs" />
                {(item.photos || []).length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {(item.photos || []).map(p => (
                      <div key={p.id} className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10 group">
                        <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => removePhoto(item.id, p.id)}
                          className="absolute top-0.5 right-0.5 bg-black/80 text-white rounded p-0.5 opacity-0 group-hover:opacity-100">
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="cursor-pointer inline-block">
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const r = new FileReader();
                      r.onload = ev => addPhoto(item.id, ev.target!.result as string);
                      r.readAsDataURL(f); e.target.value = "";
                    }} />
                  <div className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 cursor-pointer transition">
                    <Plus size={8} />📷 Add Photo
                  </div>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
    </Glass>
  );
}

// Small embedded map for a job address — see PropertyMapEmbed for why this
// replaced the Street View Static API (403 key-restriction errors).
function StreetViewThumb({ address }: { address: string; apiKey?: string }) {
  return <PropertyMapEmbed address={address} height={144} />;
}

// Small "type a name, hit Enter or click +" input used to add equipment or
// chemical items that aren't on the preset list — owners aren't limited to
// whatever's hardcoded in equipmentList/requiredChemicalsList.
function CustomItemInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  const submit = () => { const t = v.trim(); if (!t) return; onAdd(t); setV(""); };
  return (
    <div className="flex gap-2">
      <input
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/80 placeholder:text-white/30 focus:outline-none focus:border-red-500/50"
      />
      <button onClick={submit} disabled={!v.trim()} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white disabled:opacity-40">
        <Plus size={11} className="inline mr-1" />Add
      </button>
    </div>
  );
}

// Races any promise against a hard timeout — a thrown error already gets
// caught by try/catch, but a HUNG promise (an awaited Supabase/Google call
// that never resolves or rejects, e.g. from internal auth-lock contention)
// skips catch entirely and can block a button's loading state forever. This
// is the actual fix for "button hangs on a 401" — the 401 itself throws
// fine; it's the surrounding await chain that can stall.
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label + " timed out")), ms)),
  ]);

export function JobDetailModal({ jobId, job, onClose, customers = [], employees = [], updateJob, toast, gToken = "", settings = {} as any, estimates = [], setEstimates = (() => {}) as any, onPortal = (_id: string) => {}, ownerId = "" }: { jobId: any; job: any; onClose: any; customers?: any[]; employees?: any[]; updateJob: any; toast: any; gToken?: string; settings?: any; estimates?: any[]; setEstimates?: any; onPortal?: (id: string) => void; ownerId?: string }) {
  const [commNote, setCommNote] = useState("");
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [commType, setCommType] = useState("note");
  const [chemName, setChemName] = useState("");
  const [chemGal, setChemGal] = useState(0);
  const [chemCost, setChemCost] = useState(0);
  const [tagInput, setTagInput] = useState("");
  const [attName, setAttName] = useState("");
  const [attType, setAttType] = useState("pdf");
  const [, forceTick] = useState(0);
  const notifyEmployeesRef = useRef<(emps: any[], buildSubject: (emp: any) => string, buildHtml: (emp: any) => string) => Promise<number>>(() => Promise.resolve(0));
  const [showSignOff, setShowSignOff] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [gSyncing, setGSyncing] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestEmpId, setRequestEmpId] = useState("");
  const [requestMsg, setRequestMsg] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleEmpId, setScheduleEmpId] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // Live timer tick while clock is running
  useEffect(() => {
    if (!job?.clockInAt) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [job?.clockInAt]);

  // Detect schedule/address changes on an already-crewed job and notify assigned
  // employees automatically. Skips the initial mount and skips when the modal is
  // reused for a different job (jobId change resets the baseline silently).
  // Must stay ABOVE the `if (!job) return null` below — hooks can never follow an
  // early return, or the hook count differs between renders where job is/isn't set
  // (React error #310, "rendered fewer hooks than expected").
  const prevScheduleRef = useRef<{ jobId: string; date?: string; time?: string; address?: string; status?: string }>({
    jobId, date: job?.scheduledDate, time: job?.scheduledTime, address: job?.address, status: job?.status,
  });
  // Looks up the first crew member with a usable (or refreshable) Google
  // token and autoSyncCalendar on — same selection the event was originally
  // created under in scheduleAndNotify, so update/delete target the calendar
  // that actually holds the event instead of the owner's own calendar (which
  // was never where employee-assigned events live).
  const findSyncableEmpToken = async (): Promise<string | null> => {
    const crewEmps = (job!.crew || []).map((id: string) => employees.find(e => e.id === id)).filter(Boolean);
    for (const emp of crewEmps) {
      try {
        const { data: empRow } = await withTimeout<any>(
          (supabase as any).from("employees").select("google_token, google_token_expires_at, google_refresh_token, autoSyncCalendar").eq("id", (emp as any).id).maybeSingle(),
          6000, "Employee lookup"
        );
        if (empRow?.autoSyncCalendar === false) continue;
        let tok = empRow?.google_token;
        const validTok = tok && empRow?.google_token_expires_at && new Date(empRow.google_token_expires_at).getTime() > Date.now();
        if (tok && !validTok && empRow?.google_refresh_token && settings?.googleBackendUrl) {
          const refreshed = await refreshEmpGoogleToken(settings.googleBackendUrl, empRow.google_refresh_token);
          if (refreshed) tok = refreshed.token; else tok = null;
        } else if (!validTok) {
          tok = null;
        }
        if (tok) return tok;
      } catch { /* try next crew member */ }
    }
    return null;
  };
  useEffect(() => {
    if (!job) return;
    const prev = prevScheduleRef.current;
    if (prev.jobId !== jobId) {
      prevScheduleRef.current = { jobId, date: job.scheduledDate, time: job.scheduledTime, address: job.address, status: job.status };
      return;
    }
    const crewEmps = (job.crew || []).map((id: string) => employees.find(e => e.id === id)).filter(Boolean);
    const withEmail = crewEmps.filter((e: any) => e.email);
    const changes: string[] = [];
    if (prev.date !== job.scheduledDate) changes.push(`date changed to ${job.scheduledDate}`);
    if (prev.time !== job.scheduledTime) changes.push(`time changed to ${job.scheduledTime || "unscheduled"}`);
    if (prev.address !== job.address) changes.push(`address changed to ${job.address}`);
    const justCancelled = prev.status !== "cancelled" && job.status === "cancelled";
    prevScheduleRef.current = { jobId, date: job.scheduledDate, time: job.scheduledTime, address: job.address, status: job.status };
    if (changes.length > 0 && withEmail.length > 0) {
      notifyEmployeesRef.current(
        withEmail,
        () => `Job Updated — ${job.address}`,
        (emp: any) => emailShell(settings.companyName || "Crew Boss", "Job Updated", `<p>Hi ${emp.firstName},</p><p>Your job has changed:</p><ul>${changes.map(c => `<li>${c}</li>`).join("")}</ul>`)
      ).then((sent: number) => { if (sent > 0) toast(`Notified ${sent} crew member${sent !== 1 ? "s" : ""} of the change`, "green"); });
    }
    // Calendar sync happens immediately on the same change, not on a timer.
    if (job.googleEventId && justCancelled) {
      findSyncableEmpToken().then(tok => {
        if (!tok) return;
        deleteGCalEventApi(tok, job.googleEventId!).then(() => updateJob(jobId, { googleEventId: undefined })).catch(() => {});
      });
    } else if (job.googleEventId && (changes.includes(`date changed to ${job.scheduledDate}`) || prev.time !== job.scheduledTime) && job.scheduledDate) {
      findSyncableEmpToken().then(tok => {
        if (!tok) return;
        const startDt = new Date(`${job.scheduledDate}T${job.scheduledTime || "09:00"}:00`);
        const endDt = new Date(startDt.getTime() + (Number(job.duration) || 2) * 3600000);
        updateGCalEventApi(tok, job.googleEventId!, { start: startDt.toISOString(), end: endDt.toISOString(), location: job.address }).catch(() => {});
      });
    }
  }, [job?.scheduledDate, job?.scheduledTime, job?.address, job?.status, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) return null;
  const c = customers.find(x => x.id === job.customerId);

  // Direct assignment = automatic acceptance: toggling an employee onto the crew
  // here saves immediately (no accept/decline step) and emails them right away.
  // Only the "Request" flow (sendJobRequest below) requires the employee to
  // accept/decline via the Incoming Requests section of their portal.
  const toggleCrew = eid => {
    const crew = job.crew || [];
    const adding = !crew.includes(eid);
    const newCrew = adding ? [...crew, eid] : crew.filter(x => x !== eid);
    // crewAssignedAt records when each employee was added, so the portal's
    // Today tab can show a "New Assignment" banner for anything assigned
    // recently — this doubles as the durable assignment record itself.
    const patch: any = { crew: newCrew };
    if (adding) patch.crewAssignedAt = { ...(job.crewAssignedAt || {}), [eid]: Date.now() };
    updateJob(jobId, patch);
    if (adding) {
      const emp = employees.find(e => e.id === eid);
      if (emp?.email) {
        const cust = customers.find(x => x.id === job.customerId);
        notifyEmployeesRef.current(
          [emp],
          () => `You've Been Assigned — ${job.scheduledDate || job.address}`,
          () => emailShell(settings.companyName || "Crew Boss", "You've Been Assigned", `<p>Hi ${emp.firstName},</p><p>You've been assigned to a job:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : ""}</ul><p>This job is already on your schedule — no action needed.</p>`)
        ).then((sent: number) => { if (sent > 0) toast?.(`Notified ${emp.firstName} ✓`, "green"); });
      }
    }
  };

  // Sends one notification per employee. Prefers the EMPLOYEE'S OWN connected Gmail
  // account (their token, persisted in their employees row when they connect Google
  // in the portal) so the email comes from/through their own account; falls back to
  // the owner's connected Gmail account when unavailable.
  const notifyEmployees = async (
    emps: any[],
    buildSubject: (emp: any) => string,
    buildHtml: (emp: any) => string
  ): Promise<number> => {
    // Lookups run in parallel (not one-at-a-time) so a single slow row never
    // delays everyone else's notification, and the timeout is short (3s) so
    // the owner-channel fallback kicks in fast instead of stalling.
    const results = await Promise.allSettled(emps.filter(e => e.email).map(async emp => {
      const subj = buildSubject(emp);
      const html = buildHtml(emp);
      let viaEmpGmail = false;
      try {
        const { data: empRow } = await withTimeout<any>(
          (supabase as any).from("employees").select("google_token, google_token_expires_at, google_refresh_token, google_email").eq("id", emp.id).maybeSingle(),
          6000, "Employee lookup"
        );
        let tok = empRow?.google_token;
        const validTok = tok && empRow?.google_token_expires_at && new Date(empRow.google_token_expires_at).getTime() > Date.now();
        if (tok && !validTok && empRow?.google_refresh_token && settings?.googleBackendUrl) {
          // Employee's token is expired — this needs THEIR refresh_token, not
          // the owner's session, so the owner-side supabase.auth.refreshSession()
          // retry inside sendViaGmail would refresh the wrong account's token.
          const refreshed = await refreshEmpGoogleToken(settings.googleBackendUrl, empRow.google_refresh_token);
          if (refreshed) {
            tok = refreshed.token;
            (supabase as any).from("employees").update({ google_token: refreshed.token, google_token_expires_at: new Date(refreshed.expiresAt).toISOString() }).eq("id", emp.id).catch(() => {});
          } else tok = null;
        } else if (!validTok) {
          tok = null;
        }
        if (tok) {
          await withTimeout(sendViaGmail(tok, empRow.google_email || emp.email, emp.email, subj, html), 6000, "Gmail send");
          viaEmpGmail = true;
        }
      } catch (err) {
        console.warn("Employee Gmail send failed — falling back to owner channel:", err);
      }
      if (!viaEmpGmail) {
        await withTimeout(sendEmail(settings, { to: emp.email, subject: subj, body: html }), 6000, "Email send");
      }
      return true;
    }));
    return results.filter(r => r.status === "fulfilled").length;
  };
  notifyEmployeesRef.current = notifyEmployees;

  // Generates an invoice (an Estimate record flagged invoiced=true) from this
  // completed job's amount, then emails the customer a payment link. The link
  // re-uses the same client-portal flow estimates already use, where the
  // customer can pay in full, pay a deposit, or — once a deposit is on
  // record — pay the remaining balance. "Send Invoice" only validates contact
  // info and opens the preview modal — the actual send happens in
  // confirmSendInvoice once the owner reviews/edits it and clicks Send there.
  const sendInvoice = () => {
    const c = customers.find(x => x.id === job.customerId);
    if (!c?.email && !c?.phone) { toast("No contact info for this customer. Add email or phone first.", "red"); return; }
    setShowInvoicePreview(true);
  };
  const confirmSendInvoice = async (subject: string, bodyHtml: string) => {
    const c = customers.find(x => x.id === job.customerId);
    if (!c) return;
    setSendingInvoice(true);
    try {
      const newInv = {
        id: uid(),
        customerId: job.customerId,
        lineItems: [{ id: uid(), description: job.notes || job.address || "Service", quantity: 1, unitPrice: Number(job.amount) || 0 }],
        subtotal: Number(job.amount) || 0,
        discount: 0,
        depositRequired: 0,
        tax: 0,
        total: Number(job.amount) || 0,
        status: "approved" as const,
        createdAt: today(),
        validUntil: daysFromNow(30),
        invoiced: true,
        invoicedAt: today(),
      };
      setEstimates((prev: any[]) => [...prev, newInv]);
      // FIX 17 — #/portal/ID is the employee portal's route, not a customer
      // invoice view; #/estimate/ID is the public no-login pay/sign portal.
      const payLink = `${window.location.origin}${window.location.pathname}#/estimate/${newInv.id}`;
      if (c.email) {
        const html = emailShell(settings.companyName || "Crew Boss", subject, bodyHtml + emailButton("View & Pay Invoice", payLink));
        await withTimeout(sendOwnerGmailOnly(settings as any, c.email, subject, html), 10000, "Invoice email");
      } else {
        const smsBody = `Hi ${c.firstName}, your invoice for $${(Number(job.amount) || 0).toFixed(2)} is ready: ${payLink}`;
        await withTimeout(twilioSend(settings as any, c.phone!, smsBody), 10000, "Invoice SMS");
        logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone!, customerId: c.id, body: smsBody }).catch(() => {});
      }
      updateJob(jobId, { invoiceSentAt: today(), paymentType: "Invoice" as any, paymentStatus: job.paymentStatus === "Paid" ? job.paymentStatus : "Pending" as any });
      toast(`Invoice sent to ${c.firstName} ✓`, "green");
      setShowInvoicePreview(false);
    } catch (err: any) {
      toast(err?.message || "Failed to send invoice", "red");
    } finally {
      setSendingInvoice(false);
    }
  };

  // BUG 16 — send a review request for a completed job. Links to the #/rate
  // page (4–5★ → Google review, 1–3★ → private feedback). Prefers SMS via
  // Twilio, falls back to email.
  const sendReviewRequest = async () => {
    const c = customers.find(x => x.id === job.customerId);
    if (!c) { toast("No customer on this job", "red"); return; }
    if (!c.phone && !c.email) { toast("No phone or email on file for this customer", "red"); return; }
    setSendingReview(true);
    try {
      const companyName = settings.companyName || "Crew Boss";
      const rateLink = `${window.location.origin}${window.location.pathname}#/rate?c=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.firstName)}&g=${encodeURIComponent(settings.googlePlaceId || "")}&co=${encodeURIComponent(companyName)}`;
      if (settings.twilioSid && c.phone) {
        await withTimeout(twilioSend(settings as any, c.phone, `Hi ${c.firstName}, thanks for choosing ${companyName}! How did we do? ${rateLink}`), 10000, "Review SMS");
      } else if (c.email) {
        const html = emailShell(companyName, "How did we do?", `<p>Hi ${c.firstName},</p><p>Thanks for choosing ${companyName}! We'd love your feedback on your recent service.</p>` + emailButton("Leave a Review", rateLink));
        await withTimeout(sendEmail(settings, { to: c.email, subject: `How did we do, ${c.firstName}?`, body: html }), 10000, "Review email");
      } else if (c.phone) {
        window.location.href = "sms:" + c.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(`Hi ${c.firstName}, how did we do? ${rateLink}`);
      }
      updateJob(jobId, { reviewRequestedAt: today() } as any);
      toast(`Review request sent to ${c.firstName} ✓`, "green");
    } catch (err: any) {
      toast(err?.message || "Failed to send review request", "red");
    } finally {
      setSendingReview(false);
    }
  };

  const notifyCrew = async () => {
    const crewEmps = (job.crew || []).map(id => employees.find(e => e.id === id)).filter(Boolean);
    const withEmail = crewEmps.filter(e => e.email);
    if (!withEmail.length) { toast("No crew members have email addresses set", "yellow"); return; }
    setNotifying(true);
    try {
      const c = customers.find(x => x.id === job.customerId);
      const jobLink = `${window.location.origin}${window.location.pathname}#/portal`;
      const sent = await notifyEmployees(
        withEmail,
        () => `Job Assignment — ${job.scheduledDate}`,
        emp => emailShell(settings.companyName || "Crew Boss", "Job Assignment", `<p>Hi ${emp.firstName},</p><p>You've been assigned to a job:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${c ? `<li><b>Customer:</b> ${c.firstName} ${c.lastName}</li>` : ""}</ul>` + emailButton("Open Crew Portal", jobLink))
      );
      toast(sent > 0 ? `Notified ${sent} crew member${sent !== 1 ? "s" : ""} ✓` : "Email send failed — check Gmail connection in Settings → Integrations", sent > 0 ? "green" : "red");
    } catch (err: any) {
      toast(err?.message || "Failed to notify crew", "red");
    } finally {
      setNotifying(false);
    }
  };

  const sendJobRequest = async () => {
    const emp = employees.find(e => e.id === requestEmpId);
    if (!emp) return;
    setRequestSending(true);
    try {
      if (!ownerId) {
        toast("Still finishing sign-in — wait a moment and try again", "red");
        setRequestSending(false);
        return;
      }
      const { data, error } = await withTimeout<any>(
        (supabase as any).from("job_requests").insert({
          job_id: jobId,
          employee_id: requestEmpId,
          owner_id: ownerId,
          status: "pending",
          message: requestMsg.trim() || null,
        }).select("id").single(),
        15000, "Save request"
      );
      if (!error && data) {
        // The save succeeded — the request is on the books regardless of whether
        // the notification email below succeeds, so the UI must reflect success
        // here and treat the email as best-effort, not a precondition.
        if (emp.email) {
          const reqUrl = `${window.location.origin}${window.location.pathname}#/portal?request=${data.id}`;
          const cust = customers.find((x: any) => x.id === job.customerId);
          try {
            await notifyEmployees(
              [emp],
              () => `Job Request — ${job.scheduledDate}`,
              () => emailShell(settings.companyName || "Crew Boss", "Job Request", `<p>Hi ${emp.firstName},</p><p>${requestMsg || "You have a new job request:"}</p>
                <ul>
                  <li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li>
                  <li><b>Address:</b> ${job.address}</li>
                  ${cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : ""}
                  ${job.amount ? `<li><b>Amount:</b> $${job.amount}</li>` : ""}
                </ul>
                <div style="text-align:center;margin:22px 0 4px">
                  <a href="${reqUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;margin-right:8px">✓ Accept Job</a>
                  <a href="${reqUrl}&action=deny" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px">✗ Decline</a>
                </div>`)
            );
          } catch (err) {
            console.warn("Job request email notification failed — request still saved:", err);
          }
        }
        toast(`Request sent to ${emp.firstName} ✓`, "green");
        setShowRequestForm(false);
        setRequestMsg("");
        setRequestEmpId("");
      } else {
        toast("Request failed — run the job_requests SQL in Supabase first", "red");
      }
    } catch (err: any) {
      toast(err?.message || "Error sending request", "red");
    } finally {
      setRequestSending(false);
    }
  };

  // Schedule & Notify — assigns crew immediately, attempts a Google Calendar event
  // on the employee's own calendar (only possible if they've connected Google and
  // their token has been persisted to Supabase), and sends a "you're scheduled"
  // email without requiring acceptance.
  const scheduleAndNotify = async () => {
    const emp = employees.find(e => e.id === scheduleEmpId);
    if (!emp) return;
    setScheduling(true);
    // The crew assignment and notification must complete even if Google Calendar
    // sync fails OR hangs (a 401 from an expired/disconnected employee token can
    // trigger an internal Supabase token-refresh attempt that itself stalls) —
    // a calendar problem should never leave this button stuck on "Scheduling…"
    // forever, and it should never block the actual crew save either.
    try {
      const crew = job.crew || [];
      if (!crew.includes(emp.id)) updateJob(jobId, { crew: [...crew, emp.id] });

      let calendarSynced = false;
      let calendarSkippedReason = "";
      if (job.scheduledDate) {
        try {
          const { data: empRow } = await withTimeout<any>(
            (supabase as any).from("employees").select("google_token, google_token_expires_at, google_refresh_token, autoSyncCalendar").eq("id", emp.id).maybeSingle(),
            6000, "Employee lookup"
          );
          let tok = empRow?.google_token;
          const validTok = tok && empRow?.google_token_expires_at && new Date(empRow.google_token_expires_at).getTime() > Date.now();
          if (tok && !validTok && empRow?.google_refresh_token && settings?.googleBackendUrl) {
            const refreshed = await refreshEmpGoogleToken(settings.googleBackendUrl, empRow.google_refresh_token);
            if (refreshed) {
              tok = refreshed.token;
              (supabase as any).from("employees").update({ google_token: refreshed.token, google_token_expires_at: new Date(refreshed.expiresAt).toISOString() }).eq("id", emp.id).catch(() => {});
            } else tok = null;
          } else if (!validTok) {
            tok = null;
          }
          if (tok && empRow?.autoSyncCalendar !== false) {
            const timeStr = job.scheduledTime || "09:00";
            const startDt = new Date(`${job.scheduledDate}T${timeStr}:00`);
            const endDt = new Date(startDt.getTime() + (Number(job.duration) || 2) * 3600000);
            const cust = customers.find(x => x.id === job.customerId);
            const custName = cust ? `${cust.firstName} ${cust.lastName}` : "Customer";
            // Race against a hard timeout so a hung token-refresh/API call can never
            // block this flow — 10s is generous for a real network round trip.
            const evId = await Promise.race([
              createGCalEventApi(tok, { title: `CrewBoss Job: ${custName}`, start: startDt.toISOString(), end: endDt.toISOString(), location: job.address, description: job.notes || "" }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Google Calendar sync timed out")), 10000)),
            ]);
            updateJob(jobId, { googleEventId: evId });
            calendarSynced = true;
          } else {
            calendarSkippedReason = empRow?.autoSyncCalendar === false ? "employee has auto-sync turned off" : "employee hasn't connected Google";
          }
        } catch (err) {
          console.warn("Google Calendar sync failed — continuing without it:", err);
          calendarSkippedReason = "calendar sync failed";
        }
      }

      const cust = customers.find(x => x.id === job.customerId);
      try {
        await notifyEmployees(
          [emp],
          () => `You've Been Scheduled — ${job.scheduledDate}`,
          () => emailShell(settings.companyName || "Crew Boss", "You've Been Scheduled", `<p>Hi ${emp.firstName},</p><p>You've been scheduled for a job — you're confirmed, no action needed:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : ""}</ul>${calendarSynced ? "<p>This has been added to your Google Calendar.</p>" : ""}`)
        );
      } catch (err) {
        console.warn("Schedule notification email failed — crew assignment still saved:", err);
      }

      if (calendarSynced) {
        toast(`${emp.firstName} scheduled & notified — calendar synced ✓`, "green");
      } else {
        toast(`Crew assigned! (Google Calendar sync skipped — ${calendarSkippedReason || "no Google token"})`, "yellow");
      }
      setShowScheduleForm(false);
      setScheduleEmpId("");
    } catch (err) {
      console.error("Error scheduling employee:", err);
      toast("Error scheduling employee", "red");
    } finally {
      setScheduling(false);
    }
  };

  const toggleEquip = eq => {
    const list = job.equipment || [];
    updateJob(jobId, { equipment: list.includes(eq) ? list.filter(x => x !== eq) : [...list, eq] });
  };
  const toggleRequiredChemical = chem => {
    const list = job.requiredChemicals || [];
    updateJob(jobId, { requiredChemicals: list.includes(chem) ? list.filter(x => x !== chem) : [...list, chem] });
  };
  const toggleTag = t => {
    const tags = job.tags || [];
    updateJob(jobId, { tags: tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t] });
  };
  const addTag = () => {
    if (!tagInput.trim()) return;
    const tags = job.tags || [];
    if (tags.includes(tagInput.trim())) { setTagInput(""); return; }
    updateJob(jobId, { tags: [...tags, tagInput.trim()] });
    setTagInput("");
  };
  const removeTag = t => updateJob(jobId, { tags: (job.tags || []).filter(x => x !== t) });
  const addAtt = () => {
    if (!attName.trim()) return;
    const entry = { id: uid(), name: attName.trim(), type: attType };
    updateJob(jobId, { attachments: [...(job.attachments || []), entry] });
    setAttName("");
  };
  const removeAtt = id => updateJob(jobId, { attachments: (job.attachments || []).filter(a => a.id !== id) });
  // FIX 5 — Owner self-assign: when the owner (identified by the same
  // `owner_<email>` synthetic id the Crew toggle uses) is on this job's crew,
  // clocking in/out here also flips their employees row's dayClockInAt so they
  // show up in Live Crew View exactly like a technician on shift.
  const ownerEmpId = settings.ownerName ? `owner_${settings.googleEmail || "owner"}` : null;
  const ownerOnCrew = !!ownerEmpId && (job.crew || []).includes(ownerEmpId);
  const clockIn = () => {
    updateJob(jobId, { clockInAt: Date.now() });
    toast("Clocked in");
    if (ownerOnCrew) (supabase as any).from("employees").update({ dayClockInAt: Date.now() }).eq("id", ownerEmpId).catch(() => {});
  };
  const clockOut = () => {
    const started = job.clockInAt;
    if (!started) return;
    const hrs = (Date.now() - started) / 3600000;
    const rounded = Math.round(hrs * 100) / 100;
    updateJob(jobId, { clockInAt: null, loggedHours: Math.round(((Number(job.loggedHours) || 0) + rounded) * 100) / 100 });
    toast("+" + rounded + "h logged");
    if (ownerOnCrew) (supabase as any).from("employees").update({ dayClockInAt: null }).eq("id", ownerEmpId).catch(() => {});
  };
  const handleGoogleSync = async () => {
    if (!gToken || !job.scheduledDate) { toast("Add a scheduled date first"); return; }
    setGSyncing(true);
    try {
      const timeStr = job.scheduledTime || "09:00";
      const startDt = new Date(`${job.scheduledDate}T${timeStr}:00`);
      const endDt = new Date(startDt.getTime() + (Number(job.duration) || 2) * 3600000);
      const customer = customers.find((x: any) => x.id === job.customerId);
      const title = customer ? `${customer.firstName} ${customer.lastName} — Crew Boss Service` : "Crew Boss Service";
      if (job.googleEventId) {
        await updateGCalEventApi(gToken, job.googleEventId, { title, start: startDt.toISOString(), end: endDt.toISOString(), location: job.address, description: job.notes || "" });
        toast("Google Calendar event updated ✓");
      } else {
        const evId = await createGCalEventApi(gToken, { title, start: startDt.toISOString(), end: endDt.toISOString(), location: job.address, description: job.notes || "" });
        updateJob(jobId, { googleEventId: evId });
        toast("Synced to Google Calendar ✓");
      }
    } catch {
      toast("Google sync failed — check connection");
    }
    setGSyncing(false);
  };

  const addComm = () => {
    if (!commNote.trim()) return;
    const entry = { id: uid(), type: commType, date: today(), note: commNote.trim() };
    updateJob(jobId, { commLog: [...(job.commLog || []), entry] });
    setCommNote("");
  };
  const addChem = () => {
    if (!chemName.trim()) return;
    const entry = { name: chemName, gallons: Number(chemGal), cost: Number(chemCost) };
    updateJob(jobId, { chemicalsUsed: [...(job.chemicalsUsed || []), entry] });
    setChemName(""); setChemGal(0); setChemCost(0);
  };
  const removeChem = idx => updateJob(jobId, { chemicalsUsed: (job.chemicalsUsed || []).filter((_, i) => i !== idx) });

  const updateChecklist = (field: "preChecklist" | "duringChecklist" | "postChecklist", items: JobChecklistItem[]) =>
    updateJob(jobId, { [field]: items });

  const openSignOff = () => {
    setSignerName(job.signOff?.signerName || "");
    setShowSignOff(true);
  };

  const saveSignOff = () => {
    if (!signerName.trim()) { toast("Please enter customer name"); return; }
    const ts = new Date().toLocaleString();
    updateJob(jobId, { signOff: { signerName: signerName.trim(), timestamp: ts } });
    toast("Sign-off saved");
    printSignOff(signerName.trim(), ts);
  };

  const printSignOff = (name: string, ts: string) => {
    const customer = customers.find(x => x.id === job.customerId);
    const beforePhoto = (job.photos || []).find(p => p.type === "before" && p.dataUrl);
    const afterPhoto = (job.photos || []).find(p => p.type === "after" && p.dataUrl);
    const preItems = job.preChecklist || PRE_DEFAULTS;
    const postItems = job.postChecklist || POST_DEFAULTS;
    const preIssues = preItems.filter(i => i.notes).map(i => `<li>${i.label}: ${i.notes}</li>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Job Sign-Off</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #111; font-size: 14px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
  .section { margin-bottom: 20px; }
  .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
  .photos { display: flex; gap: 16px; margin-bottom: 16px; }
  .photos img { width: 48%; border-radius: 8px; border: 1px solid #ddd; }
  .photo-label { font-size: 10px; text-align: center; color: #888; margin-top: 4px; }
  .disclaimer { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 14px; font-size: 12px; color: #444; line-height: 1.6; }
  .sig-block { margin-top: 24px; border-top: 2px solid #111; padding-top: 16px; }
  .sig-name { font-size: 20px; font-family: Georgia, serif; margin-bottom: 4px; }
  .sig-ts { font-size: 11px; color: #888; }
  .checklist { list-style: none; padding: 0; }
  .checklist li { padding: 3px 0; font-size: 13px; }
  .checklist li.done::before { content: "✓ "; color: green; font-weight: bold; }
  .checklist li.undone::before { content: "○ "; color: #ccc; }
</style></head><body>
<h1>Service Completion Sign-Off</h1>
<div class="sub">Generated ${ts}</div>
<div class="section">
  <h2>Customer & Job Details</h2>
  <p><strong>Customer:</strong> ${customer ? customer.firstName + " " + customer.lastName : "N/A"}</p>
  <p><strong>Address:</strong> ${job.address || "N/A"}</p>
  <p><strong>Service Date:</strong> ${job.scheduledDate || "N/A"}</p>
  <p><strong>Total Amount:</strong> $${(job.amount || 0).toFixed(2)}</p>
  <p><strong>Payment:</strong> ${job.paymentType || "N/A"} · ${job.paymentStatus || "Pending"}</p>
</div>
${(beforePhoto || afterPhoto) ? `<div class="section">
  <h2>Before &amp; After Photos</h2>
  <div class="photos">
    ${beforePhoto ? `<div><img src="${beforePhoto.dataUrl}" alt="Before"/><div class="photo-label">BEFORE</div></div>` : ""}
    ${afterPhoto ? `<div><img src="${afterPhoto.dataUrl}" alt="After"/><div class="photo-label">AFTER</div></div>` : ""}
  </div>
</div>` : ""}
<div class="section">
  <h2>Post-Job Checklist</h2>
  <ul class="checklist">
    ${postItems.map(i => `<li class="${i.done ? "done" : "undone"}">${i.label}${i.notes ? ` — <em>${i.notes}</em>` : ""}</li>`).join("")}
  </ul>
</div>
${preIssues ? `<div class="section"><h2>Pre-Existing Conditions Noted</h2><ul>${preIssues}</ul></div>` : ""}
${job.notes ? `<div class="section"><h2>Job Notes</h2><p>${job.notes}</p></div>` : ""}
<div class="section">
  <h2>Legal Disclaimer</h2>
  <div class="disclaimer">
    I confirm that all services have been completed to my satisfaction. I accept the work as described above and acknowledge that the service provider is not liable for pre-existing conditions documented in the pre-job checklist. By signing below, I authorize payment of the amount stated and release the company from further obligation for this service call.
  </div>
</div>
<div class="sig-block">
  <div class="sig-name">${name}</div>
  <div class="sig-ts">Signed: ${ts}</div>
  <div style="margin-top:12px;font-size:11px;color:#aaa;">Digital signature — customer typed and confirmed their full name</div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=800,height=900");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const totalChemCost = (job.chemicalsUsed || []).reduce((s, c) => s + Number(c.cost), 0);
  const totalGallons = (job.chemicalsUsed || []).reduce((s, c) => s + Number(c.gallons), 0);

  // Timer display
  const liveHrs = job.clockInAt ? (Date.now() - job.clockInAt) / 3600000 : 0;
  const liveDisplay = (() => {
    const total = Math.floor(liveHrs * 3600);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
  })();

  const attIcon = t => t === "image" ? "🖼️" : t === "pdf" ? "📄" : "📎";

  return (
    <Modal open={!!jobId} onClose={onClose} title={"Job · " + (c?.firstName + " " + c?.lastName)} maxW="max-w-2xl">
      <div className="space-y-4">
        {job.address && <StreetViewThumb address={job.address} apiKey={settings.googleMapsKey || settings.mapsKey} />}

        {/* FIX 5 — customer + job summary, always visible at the top: name,
            phone, address, and the estimate/quote amount, none of which the
            modal surfaced before (the title only showed the customer's name). */}
        <Glass className="p-3 !bg-black/40 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm truncate">{c ? `${c.firstName} ${c.lastName}` : "Unknown customer"}</div>
            {job.amount > 0 && <div className="text-lg font-bold text-green-400 flex-shrink-0">{fmt(job.amount)}</div>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
            {c?.phone && (
              <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-white transition"><Phone size={11} />{c.phone}</a>
            )}
            {c?.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-white transition"><Mail size={11} />{c.email}</a>
            )}
            {!c?.phone && !c?.email && <span className="italic text-white/30">No contact info on file</span>}
          </div>
          {job.address && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition">
              <MapPin size={11} />{job.address}
            </a>
          )}
        </Glass>

        {/* Priority + Duration + Recurring + Job Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><AlertCircle size={10} />Priority</label>
            <GSel value={job.priority || "normal"} onChange={e => updateJob(jobId, { priority: e.target.value })}>
              {priorityLevels.map(p => <option key={p.key} value={p.key} className="bg-black">{p.label}</option>)}
            </GSel>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Est. Duration (hrs)</label><GInput type="number" step="0.25" value={job.duration || ""} onChange={e => updateJob(jobId, { duration: e.target.value })} placeholder="e.g. 3.5" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Recurring</label><GSel value={job.recurringFreq || "monthly"} onChange={e => updateJob(jobId, { recurringFreq: e.target.value, isRecurring: true })}>{recurringFreqs.map(f => <option key={f.key} value={f.key} className="bg-black">{f.label}</option>)}</GSel></div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Job Type <span className="text-white/30">(drives crew pay rate)</span></label>
            <GSel value={job.jobType || "residential"} onChange={e => updateJob(jobId, { jobType: e.target.value as any })}>
              <option value="residential" className="bg-black">Residential</option>
              <option value="commercial" className="bg-black">Commercial</option>
            </GSel>
          </div>
        </div>
        {/* FIX 10 — effective pay rate for each crew member on THIS job's type */}
        {(job.crew || []).length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-green-400/80 -mt-1">
            {(job.crew || []).map((empId: string) => {
              const emp = employees.find((e: any) => e.id === empId);
              if (!emp) return null;
              const rate = getEffectiveRate(emp, job);
              return <span key={empId} className="flex items-center gap-1"><DollarSign size={10} />{emp.firstName}: {fmt(rate)}/hr</span>;
            })}
          </div>
        )}

        {/* Time Tracking */}
        <Glass className={"p-3 " + (job.clockInAt ? "!bg-green-950/20 !border-green-600/40" : "!bg-black/40")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (job.clockInAt ? "bg-green-900/40 animate-pulse" : "bg-white/5")}><Clock size={14} className={job.clockInAt ? "text-green-400" : "text-white/60"} /></div>
              <div>
                <div className="text-xs text-white/60 uppercase tracking-wider">Time Tracking</div>
                <div className="text-sm">
                  {job.clockInAt ? <span className="font-mono text-green-400 text-base font-bold">{liveDisplay}</span> : <span className="text-white/50">Logged: <span className="text-white font-semibold">{job.loggedHours || 0}h</span></span>}
                  {!job.clockInAt && job.duration && <span className="text-white/40"> · est {job.duration}h</span>}
                </div>
              </div>
            </div>
            {job.clockInAt ? <GBtn variant="danger" onClick={clockOut} className="!text-xs">Clock Out</GBtn> : <GBtn onClick={clockIn} className="!text-xs"><Play size={10} className="inline mr-1" />Clock In</GBtn>}
          </div>
        </Glass>

        {/* Payment status + Send Invoice — only once the job is actually done */}
        {job.status === "completed" && (
          <Glass className={"p-3 flex items-center justify-between gap-3 " + (job.paymentStatus === "Paid" ? "!bg-green-950/15 !border-green-700/30" : "!bg-yellow-950/15 !border-yellow-700/30")}>
            <div className="text-xs text-white/60">
              <div className={"font-semibold mb-0.5 " + (job.paymentStatus === "Paid" ? "text-green-300" : "text-yellow-300")}>
                {job.paymentStatus === "Paid" ? `Paid (${job.paymentType || "Cash"})` : job.paymentType === "Invoice" || job.invoiceSentAt ? "Unpaid — Invoice Sent" : "Unpaid"}
              </div>
              {job.amountCollected ? `${job.amountCollected} collected` : "Email the customer an invoice with a payment link — full, deposit, or remaining balance."}
            </div>
            {job.paymentStatus !== "Paid" && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <GSel value="" onChange={e => { if (e.target.value) updateJob(jobId, { paymentStatus: "Paid", paymentType: e.target.value as any, amountCollected: Number(job.amount) || 0 }); }} className="!text-xs !py-1.5 !w-28">
                  <option value="" className="bg-black">Mark Paid…</option>
                  {["Cash", "Check", "Card", "Zelle", "Venmo"].map(m => <option key={m} value={m} className="bg-black">{m}</option>)}
                </GSel>
                <GBtn onClick={sendInvoice} disabled={sendingInvoice} className="!text-xs !py-1.5">
                  {sendingInvoice ? "Sending…" : <><Send size={11} className="inline mr-1" />Send Invoice</>}
                </GBtn>
              </div>
            )}
          </Glass>
        )}

        {/* Send Review Request — completed jobs only (BUG 16) */}
        {job.status === "completed" && (
          <Glass className="p-3 flex items-center justify-between gap-3 !bg-purple-950/15 !border-purple-700/30">
            <div className="text-xs text-white/60">
              <div className="font-semibold mb-0.5 text-purple-300 flex items-center gap-1"><Star size={11} />Review Request</div>
              {(job as any).reviewRequestedAt ? `Sent ${(job as any).reviewRequestedAt}` : "Ask the customer for a review — 4–5★ routes to Google, low ratings stay private."}
            </div>
            <GBtn onClick={sendReviewRequest} disabled={sendingReview} className="!text-xs !py-1.5 flex-shrink-0">
              {sendingReview ? "Sending…" : <><Star size={11} className="inline mr-1" />Send Review Request</>}
            </GBtn>
          </Glass>
        )}

        {/* Google Calendar Sync */}
        {gToken && (
          <div className={"flex items-center justify-between p-3 rounded-xl border " + (job.googleEventId ? "bg-green-950/20 border-green-700/40" : "bg-white/5 border-white/10")}>
            <div className="flex items-center gap-2">
              <Globe size={14} className={job.googleEventId ? "text-green-400" : "text-white/50"} />
              <div>
                <div className="text-xs font-medium">{job.googleEventId ? "Synced to Google Calendar" : "Google Calendar Sync"}</div>
                {job.googleEventId && <div className="text-[10px] text-green-400/70">Event ID: {job.googleEventId.slice(0, 12)}…</div>}
              </div>
            </div>
            <GBtn onClick={handleGoogleSync} disabled={gSyncing} className={"!text-xs !py-1.5 " + (job.googleEventId ? "!bg-green-900/40 !border-green-700/50 !text-green-300 hover:!bg-green-800/50" : "")}>
              {gSyncing ? "Syncing…" : job.googleEventId ? "↻ Update" : "☁ Sync"}
            </GBtn>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Tag size={10} />Tags</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {jobTagOptions.map(t => {
              const sel = (job.tags || []).includes(t);
              return <button key={t} onClick={() => toggleTag(t)} className={"text-[10px] px-2.5 py-1 rounded-full border transition " + (sel ? "bg-red-900/40 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-white/50 hover:text-white")}>{t}</button>;
            })}
          </div>
          {(job.tags || []).filter(t => !jobTagOptions.includes(t)).length > 0 && <div className="flex gap-1 flex-wrap mb-2">
            {(job.tags || []).filter(t => !jobTagOptions.includes(t)).map(t => <span key={t} className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/40 text-blue-300">{t}<button onClick={() => removeTag(t)} className="hover:text-red-400"><X size={8} /></button></span>)}
          </div>}
          <div className="flex gap-2">
            <GInput placeholder="Custom tag..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} className="!py-1.5 !text-xs" />
            <GBtn onClick={addTag} className="!py-1.5 !px-3"><Plus size={12} /></GBtn>
          </div>
        </div>

        {/* Crew */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-white/60 flex items-center gap-1"><Users size={10} />Crew</label>
            <div className="flex items-center gap-1.5">
              {(job.crew || []).length > 0 && (
                <button onClick={notifyCrew} disabled={notifying}
                  className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/30 text-blue-400 hover:text-blue-300 transition disabled:opacity-50">
                  <Mail size={9} />{notifying ? "Sending…" : "Notify"}
                </button>
              )}
              <button onClick={() => setShowRequestForm(s => !s)}
                className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-700/30 text-yellow-400 hover:text-yellow-300 transition">
                <Send size={9} />Request
              </button>
              <button onClick={() => setShowScheduleForm(s => !s)}
                className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-700/30 text-purple-300 hover:text-purple-200 transition">
                <Calendar size={9} />Schedule & Notify
              </button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Owner self-assign */}
            {settings.ownerName && (() => {
              const ownerId = `owner_${settings.googleEmail || "owner"}`;
              const sel = (job.crew || []).includes(ownerId);
              return (
                <button key="owner" onClick={() => toggleCrew(ownerId)}
                  className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-red-900/40 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
                  {settings.ownerName} (Owner)
                </button>
              );
            })()}
            {employees.filter(e => e.status === "active").map(e => {
              const sel = (job.crew || []).includes(e.id);
              return <button key={e.id} onClick={() => toggleCrew(e.id)} className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-red-900/40 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>{e.firstName} {e.lastName[0]}.</button>;
            })}
          </div>
          {showRequestForm && (
            <div className="mt-3 p-3 rounded-xl bg-yellow-950/20 border border-yellow-700/30 space-y-2">
              <div className="text-xs text-yellow-300 font-semibold">Request an Employee for This Job</div>
              <select value={requestEmpId} onChange={e => setRequestEmpId(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-500/50">
                <option value="">Select employee…</option>
                {employees.filter(e => e.status === "active").map(e => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
              {requestEmpId && (() => {
                const emp = employees.find(e => e.id === requestEmpId);
                const av: string[] = (emp as any)?.availability || [];
                const isUnavail = job.scheduledDate && av.includes(job.scheduledDate);
                return isUnavail ? (
                  <div className="text-[10px] text-orange-300 bg-orange-950/30 border border-orange-700/30 rounded-lg px-2 py-1.5">
                    ⚠ {emp?.firstName} marked {job.scheduledDate} as unavailable. You can still request them.
                  </div>
                ) : null;
              })()}
              <textarea value={requestMsg} onChange={e => setRequestMsg(e.target.value)}
                placeholder="Message to employee (optional)…" rows={2}
                className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 resize-none" />
              <div className="flex gap-2">
                <button onClick={sendJobRequest} disabled={!requestEmpId || requestSending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-black text-xs font-bold transition">
                  <Send size={11} />{requestSending ? "Sending…" : "Send Request"}
                </button>
                <button onClick={() => setShowRequestForm(false)}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {showScheduleForm && (
            <div className="mt-3 p-3 rounded-xl bg-purple-950/20 border border-purple-700/30 space-y-2">
              <div className="text-xs text-purple-300 font-semibold">Schedule & Notify — assigns immediately, no acceptance needed</div>
              <select value={scheduleEmpId} onChange={e => setScheduleEmpId(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50">
                <option value="">Select employee…</option>
                {employees.filter(e => e.status === "active").map(e => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
              <div className="text-[10px] text-white/40">Adds them to crew, emails "You've been scheduled," and adds a Google Calendar event on their calendar if they've connected one.</div>
              <div className="flex gap-2">
                <button onClick={scheduleAndNotify} disabled={!scheduleEmpId || scheduling}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition">
                  <Calendar size={11} />{scheduling ? "Scheduling…" : "Schedule & Notify"}
                </button>
                <button onClick={() => setShowScheduleForm(false)}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Equipment */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Required Equipment <span className="text-white/30">(crew sees this before starting)</span></label>
          <div className="flex gap-2 flex-wrap mb-2">
            {equipmentList.map(eq => {
              const sel = (job.equipment || []).includes(eq);
              return <button key={eq} onClick={() => toggleEquip(eq)} className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-red-900/40 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>{eq}</button>;
            })}
            {(job.equipment || []).filter((eq: string) => !equipmentList.includes(eq)).map((eq: string) => (
              <button key={eq} onClick={() => toggleEquip(eq)} className="text-xs px-3 py-1.5 rounded-lg border bg-red-900/40 border-red-500/50 text-red-300 flex items-center gap-1">{eq}<X size={10} /></button>
            ))}
          </div>
          <CustomItemInput placeholder="Add custom equipment…" onAdd={v => toggleEquip(v)} />
        </div>

        {/* Required chemicals */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Required Chemicals</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {requiredChemicalsList.map(chem => {
              const sel = (job.requiredChemicals || []).includes(chem);
              return <button key={chem} onClick={() => toggleRequiredChemical(chem)} className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-purple-900/40 border-purple-500/50 text-purple-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>{chem}</button>;
            })}
            {(job.requiredChemicals || []).filter((chem: string) => !requiredChemicalsList.includes(chem)).map((chem: string) => (
              <button key={chem} onClick={() => toggleRequiredChemical(chem)} className="text-xs px-3 py-1.5 rounded-lg border bg-purple-900/40 border-purple-500/50 text-purple-300 flex items-center gap-1">{chem}<X size={10} /></button>
            ))}
          </div>
          <CustomItemInput placeholder="Add custom chemical…" onAdd={v => toggleRequiredChemical(v)} />
        </div>

        {/* Job Notes — visible to both owner and the assigned employee in their job detail view */}
        <div>
          <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><FileText size={10} />Notes <span className="text-white/30 font-normal">(visible to crew)</span></label>
          <GTxt rows={2} value={job.notes || ""} onChange={e => updateJob(jobId, { notes: e.target.value })} placeholder="Service details, access instructions..." />
        </div>

        {/* Internal Notes */}
        <div>
          <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Clipboard size={10} />Internal Notes (crew only)</label>
          <GTxt rows={2} value={job.internalNotes || ""} onChange={e => updateJob(jobId, { internalNotes: e.target.value })} placeholder="Site details, warnings, tips for next visit..." />
        </div>

        {/* Pre-Job Checklist */}
        <ChecklistSection
          title="Pre-Job Checklist"
          emoji="🔵"
          items={job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS}
          onUpdate={items => updateChecklist("preChecklist", items)}
        />

        {/* During Job Checklist */}
        <ChecklistSection
          title="During Job Checklist"
          emoji="🟡"
          items={job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS}
          onUpdate={items => updateChecklist("duringChecklist", items)}
        />

        {/* Post-Job Checklist */}
        <ChecklistSection
          title="Post-Job Checklist"
          emoji="🟢"
          items={job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS}
          onUpdate={items => updateChecklist("postChecklist", items)}
        />

        {/* Photos (Before / After) */}
        <Glass className="p-3 !bg-black/40">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1"><Eye size={10} />Before / After Photos</div>
            <div className="text-xs text-white/50">{(job.photos || []).length} photo{(job.photos || []).length !== 1 ? "s" : ""}</div>
          </div>

          {/* Before/After comparison slider */}
          {(() => {
            const beforePhoto = (job.photos || []).find(p => p.type === "before" && p.dataUrl);
            const afterPhoto = (job.photos || []).find(p => p.type === "after" && p.dataUrl);
            if (!beforePhoto || !afterPhoto) return null;
            return <BeforeAfterSlider before={beforePhoto.dataUrl} after={afterPhoto.dataUrl} />;
          })()}

          {(job.photos || []).length > 0 && <div className="grid grid-cols-3 gap-2 mb-2 mt-2">
            {(job.photos || []).map((p, i) => (
              <div key={p.id || i} className="relative group aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900 border border-red-900/30">
                {p.dataUrl ? <img src={p.dataUrl} alt={p.caption || ""} className="absolute inset-0 w-full h-full object-cover" />
                  : <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">{p.type === "before" ? "📷" : p.type === "after" ? "✨" : "🖼️"}</div>}
                <div className={"absolute top-1 left-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded " + (p.type === "before" ? "bg-blue-600/90" : p.type === "after" ? "bg-green-600/90" : "bg-black/70")}>{p.type || "photo"}</div>
                <button onClick={() => updateJob(jobId, { photos: (job.photos || []).filter(x => x !== p) })} className="absolute top-1 right-1 p-1 rounded bg-black/70 opacity-0 group-hover:opacity-100 hover:bg-red-900/80 text-white/80"><X size={10} /></button>
                {p.caption && <div className="absolute bottom-0 left-0 right-0 p-1 text-[9px] bg-gradient-to-t from-black/90 to-transparent truncate">{p.caption}</div>}
              </div>
            ))}
          </div>}
          <div className="grid grid-cols-3 gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                const files = Array.from(e.target.files || []);
                files.forEach(f => {
                  compressImageFile(f).then(dataUrl => {
                    const newPhoto = { id: uid(), type: "before", caption: "Before — " + today(), dataUrl, addedAt: today() };
                    const nextPhotos = [...(job.photos || []), newPhoto];
                    console.log("[PhotoSync] owner adding before photo — job:", jobId, "photo count now:", nextPhotos.length);
                    updateJob(jobId, { photos: nextPhotos });
                  });
                });
                e.target.value = "";
                toast("Before photo added");
              }} />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs font-medium transition"><Plus size={12} />📷 Before</div>
            </label>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                const files = Array.from(e.target.files || []);
                files.forEach(f => {
                  compressImageFile(f).then(dataUrl => {
                    const newPhoto = { id: uid(), type: "after", caption: "After — " + today(), dataUrl, addedAt: today() };
                    const nextPhotos = [...(job.photos || []), newPhoto];
                    console.log("[PhotoSync] owner adding after photo — job:", jobId, "photo count now:", nextPhotos.length);
                    updateJob(jobId, { photos: nextPhotos });
                  });
                });
                e.target.value = "";
                toast("After photo added");
              }} />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-950/30 hover:bg-green-900/40 border border-green-700/40 text-green-300 text-xs font-medium transition"><Plus size={12} />✨ After</div>
            </label>
            <label className="cursor-pointer">
              <input type="file" accept="video/*" capture="environment" className="hidden" onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                if (f.size > 80 * 1024 * 1024) { toast("Video too large (max ~80MB)"); return; }
                const r = new FileReader();
                r.onload = ev => {
                  const vid: JobVideo = { id: uid(), dataUrl: ev.target!.result as string, caption: today(), addedAt: today() };
                  updateJob(jobId, { videos: [...(job.videos || []), vid] });
                };
                r.readAsDataURL(f);
                e.target.value = "";
                toast("Video added");
              }} />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs font-medium transition"><Plus size={12} />🎥 Video</div>
            </label>
          </div>
          {(job.videos || []).length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Videos ({(job.videos || []).length})</div>
              <div className="grid grid-cols-2 gap-2">
                {(job.videos || []).map((v, i) => (
                  <div key={v.id || i} className="relative rounded-lg overflow-hidden bg-black border border-purple-900/30 group">
                    <video src={v.dataUrl} controls className="w-full max-h-32 object-contain" />
                    <button onClick={() => updateJob(jobId, { videos: (job.videos || []).filter(x => x.id !== v.id) })}
                      className="absolute top-1 right-1 p-1 rounded bg-black/70 opacity-0 group-hover:opacity-100 hover:bg-red-900/80 text-white/80"><X size={10} /></button>
                    {v.caption && <div className="text-[9px] text-white/40 px-1 pb-1">{v.caption}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-[10px] text-white/40 mt-1.5">Tip: on mobile, tapping opens the camera directly. Drag the slider on comparison view.</div>
        </Glass>

        {/* Attachments */}
        <Glass className="p-3 !bg-black/40">
          <div className="flex items-center justify-between mb-2"><div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1"><FileText size={10} />Attachments</div><div className="text-xs text-white/50">{(job.attachments || []).length} file{(job.attachments || []).length !== 1 ? "s" : ""}</div></div>
          <div className="grid grid-cols-7 gap-2 mb-2">
            <GInput placeholder="Filename (e.g. contract.pdf)" value={attName} onChange={e => setAttName(e.target.value)} onKeyDown={e => e.key === "Enter" && addAtt()} className="col-span-4 !py-1.5 !text-xs" />
            <GSel value={attType} onChange={e => setAttType(e.target.value)} className="col-span-2 !py-1.5 !text-xs">
              <option value="pdf" className="bg-black">PDF</option>
              <option value="image" className="bg-black">Image</option>
              <option value="other" className="bg-black">Other</option>
            </GSel>
            <GBtn onClick={addAtt} className="col-span-1 !py-1.5"><Plus size={12} /></GBtn>
          </div>
          {(job.attachments || []).length > 0 && <div className="space-y-1">
            {(job.attachments || []).map(a => <div key={a.id} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded hover:bg-white/10">
              <div className="flex items-center gap-2 flex-1 min-w-0"><span>{attIcon(a.type)}</span><span className="truncate">{a.name}</span></div>
              <div className="flex items-center gap-1"><button onClick={() => toast("Would download " + a.name)} className="p-1 text-white/50 hover:text-white"><Download size={10} /></button><button onClick={() => removeAtt(a.id)} className="p-1 text-white/40 hover:text-red-400"><X size={10} /></button></div>
            </div>)}
          </div>}
        </Glass>

        {/* Chemical Usage */}
        <Glass className="p-3 !bg-black/40">
          <div className="flex items-center justify-between mb-2"><div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1"><FlaskConical size={10} />Chemical Usage</div><div className="text-xs text-white/50">{totalGallons}gal · {fmt(totalChemCost)}</div></div>
          <div className="grid grid-cols-7 gap-2 mb-2">
            <GInput placeholder="Chemical" value={chemName} onChange={e => setChemName(e.target.value)} className="col-span-3 !py-1.5 !text-xs" />
            <GInput type="number" step="0.1" placeholder="Gal" value={chemGal} onChange={e => setChemGal(e.target.value)} className="col-span-1 !py-1.5 !text-xs" />
            <GInput type="number" step="0.01" placeholder="Cost $" value={chemCost} onChange={e => setChemCost(e.target.value)} className="col-span-2 !py-1.5 !text-xs" />
            <GBtn onClick={addChem} className="col-span-1 !py-1.5 !text-xs"><Plus size={12} /></GBtn>
          </div>
          {(job.chemicalsUsed || []).length > 0 && <div className="space-y-1">
            {(job.chemicalsUsed || []).map((ch, i) => <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-white/5 rounded"><span>{ch.name}</span><span className="text-white/50">{ch.gallons}gal · {fmt(ch.cost)}</span><button onClick={() => removeChem(i)} className="text-red-400 hover:text-red-300"><X size={10} /></button></div>)}
          </div>}
        </Glass>

        {/* Job Costing & Profitability */}
        <Glass className="p-3 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1"><DollarSign size={10} />Job Costing & Profitability</div>
          <div className="flex items-center gap-3 mb-3 p-2 bg-black/40 border border-red-900/30 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer text-sm flex-1">
              <input type="checkbox" checked={!!job.isCash} onChange={e => updateJob(jobId, { isCash: e.target.checked })} className="w-4 h-4" />
              <span className="text-white/80">💵 Cash payment</span>
            </label>
            {job.isCash && <span className="text-[9px] px-2 py-1 rounded-full bg-green-900/30 border border-green-700/40 text-green-300">Separate for taxes</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs p-2 bg-black/40 border border-red-900/20 rounded-xl">
              <input type="checkbox" checked={!!job.noShow} onChange={e => updateJob(jobId, { noShow: e.target.checked })} className="w-3.5 h-3.5" />
              <span className="text-white/70">🚫 No-show</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs p-2 bg-black/40 border border-blue-900/20 rounded-xl">
              <input type="checkbox" checked={!!job.rainGuarantee} onChange={e => updateJob(jobId, { rainGuarantee: e.target.checked, rainGuaranteeDate: e.target.checked ? today() : null })} className="w-3.5 h-3.5" />
              <span className="text-white/70">🌧️ Rain guarantee</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs p-2 bg-black/40 border border-yellow-900/20 rounded-xl col-span-2">
              <input type="checkbox" checked={!!job.weatherOverride} onChange={e => updateJob(jobId, { weatherOverride: e.target.checked })} className="w-3.5 h-3.5" />
              <span className="text-white/70">⚡ Proceed despite weather (weather override)</span>
            </label>
          </div>
          {job.rainGuarantee && <div className="mb-3 p-2 bg-blue-950/20 border border-blue-700/30 rounded-xl text-xs">
            <div className="text-blue-300 font-semibold mb-1">48-hour rain guarantee active</div>
            <div className="text-blue-200/60">Guarantee set: {job.rainGuaranteeDate}. If it rains within 48h, this job is eligible for a free re-spray. Check weather and follow up with customer.</div>
          </div>}

          {/* Sq footage + rate calculator */}
          <div className="mb-3 p-2 bg-black/40 border border-red-900/20 rounded-xl">
            <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Square Footage Calculator</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/40 mb-0.5 block">Sq Ft</label>
                <GInput type="number" value={job.sqFootage || ""} onChange={e => updateJob(jobId, { sqFootage: Number(e.target.value) })} placeholder="2400" className="!py-1 !text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-0.5 block">Rate / sq ft</label>
                <GInput type="number" step="0.001" value={job.sqFtRate || ""} onChange={e => updateJob(jobId, { sqFtRate: Number(e.target.value) })} placeholder="0.15" className="!py-1 !text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-0.5 block">Est. Price</label>
                <div className="py-1 px-2 bg-black/60 border border-red-900/20 rounded-lg text-xs font-bold text-red-400">
                  {job.sqFootage && job.sqFtRate ? fmt(job.sqFootage * job.sqFtRate) : "—"}
                </div>
              </div>
            </div>
            {job.sqFootage && job.sqFtRate && Math.abs((job.sqFootage * job.sqFtRate) - job.amount) > 10 && (
              <button onClick={() => updateJob(jobId, { amount: Math.round(job.sqFootage * job.sqFtRate * 100) / 100 })} className="mt-1.5 text-[10px] text-blue-400 hover:text-blue-300">
                Apply {fmt(job.sqFootage * job.sqFtRate)} to job price →
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider">Labor Cost ($)</label>
              <GInput type="number" step="0.01" value={job.laborCost || ""} onChange={e => updateJob(jobId, { laborCost: Number(e.target.value) })} placeholder="0.00" className="!py-1.5 !text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider">Material Cost ($)</label>
              <GInput type="number" step="0.01" value={job.materialCost || ""} onChange={e => updateJob(jobId, { materialCost: Number(e.target.value) })} placeholder="0.00" className="!py-1.5 !text-xs mt-1" />
            </div>
          </div>
          {(() => {
            const labor = Number(job.laborCost) || 0;
            const materials = Number(job.materialCost) || 0;
            const chems = totalChemCost;
            const totalCost = labor + materials + chems;
            const revenue = job.amount || 0;
            const profit = revenue - totalCost;
            const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
            const marginTone = Number(margin) >= 60 ? "text-green-400" : Number(margin) >= 40 ? "text-yellow-400" : "text-red-400";
            return <div className="space-y-1.5">
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] mb-2">
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Revenue</div><div className="font-bold text-white">{fmt(revenue)}</div></div>
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Costs</div><div className="font-bold text-red-400">{fmt(totalCost)}</div></div>
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Profit</div><div className={"font-bold " + (profit >= 0 ? "text-green-400" : "text-red-400")}>{fmt(profit)}</div></div>
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Margin</div><div className={"font-bold " + marginTone}>{margin}%</div></div>
              </div>
              {totalCost > 0 && <div className="h-2 rounded-full overflow-hidden bg-black/40 flex">
                <div className="bg-blue-600/70" style={{ width: (labor / totalCost * 100) + "%" }} title={"Labor " + fmt(labor)} />
                <div className="bg-orange-500/70" style={{ width: (materials / totalCost * 100) + "%" }} title={"Materials " + fmt(materials)} />
                <div className="bg-yellow-500/70" style={{ width: (chems / totalCost * 100) + "%" }} title={"Chemicals " + fmt(chems)} />
              </div>}
              {totalCost > 0 && <div className="flex gap-3 text-[9px] text-white/50">
                <span><span className="inline-block w-2 h-2 rounded-full bg-blue-600/70 mr-1" />Labor {fmt(labor)}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-orange-500/70 mr-1" />Materials {fmt(materials)}</span>
                {chems > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-500/70 mr-1" />Chemicals {fmt(chems)}</span>}
              </div>}
            </div>;
          })()}
        </Glass>

        {/* Comm Log */}
        <Glass className="p-3 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1"><MessageSquare size={10} />Communication Log</div>
          <div className="flex gap-2 mb-2">
            <GSel value={commType} onChange={e => setCommType(e.target.value)} className="!w-28 !py-1.5 !text-xs">
              <option value="note" className="bg-black">note</option>
              <option value="call" className="bg-black">call</option>
              <option value="text" className="bg-black">text</option>
              <option value="email" className="bg-black">email</option>
            </GSel>
            <GInput placeholder="Add entry..." value={commNote} onChange={e => setCommNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addComm()} className="!py-1.5 !text-xs" />
            <GBtn onClick={addComm} className="!py-1.5"><Plus size={12} /></GBtn>
          </div>
          {(job.commLog || []).length > 0 && <div className="space-y-1 max-h-32 overflow-y-auto">
            {(job.commLog || []).slice().reverse().map(e => {
              // Notes save a full ISO timestamp (FIX 6); older/other entry types
              // may still just be a bare YYYY-MM-DD date — show both sensibly.
              const d = new Date(e.date);
              const label = !isNaN(d.getTime()) && e.date.length > 10
                ? d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                : e.date;
              return <div key={e.id} className="text-xs p-2 bg-white/5 rounded flex items-center gap-2"><Badge tone="gray">{e.type}</Badge><span className="flex-1">{e.note}</span><span className="text-white/40 flex-shrink-0">{label}</span></div>;
            })}
          </div>}
        </Glass>

        {/* Payment & Completion */}
        <Glass className="p-3 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1"><CreditCard size={10} />Payment & Completion</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Payment Type</label>
              <GSel value={job.paymentType || ""} onChange={e => updateJob(jobId, { paymentType: e.target.value as any })}>
                <option value="" className="bg-black">— Select —</option>
                {["Cash", "Check", "Card", "Zelle", "Venmo", "Invoice"].map(t => <option key={t} value={t} className="bg-black">{t}</option>)}
              </GSel>
            </div>
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Payment Status</label>
              <GSel value={job.paymentStatus || ""} onChange={e => updateJob(jobId, { paymentStatus: e.target.value as any })}>
                <option value="" className="bg-black">— Select —</option>
                {["Pending", "Partial", "Paid"].map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
              </GSel>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Amount Collected ($)</label>
            <GInput type="number" step="0.01" value={job.amountCollected ?? ""} onChange={e => updateJob(jobId, { amountCollected: Number(e.target.value) })} placeholder="0.00" className="!py-1.5 !text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Surface Type</label>
              <GSel value={job.surfaceType || ""} onChange={e => updateJob(jobId, { surfaceType: e.target.value })}>
                <option value="" className="bg-black">— Select —</option>
                {["Vinyl Siding", "Brick", "Stucco", "Wood", "Concrete", "Asphalt", "Pavers", "Composite Deck", "Wood Deck", "Metal Roof", "Shingle Roof", "Other"].map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
              </GSel>
            </div>
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Chemical Mix Ratio</label>
              <GInput value={job.chemMixRatio || ""} onChange={e => updateJob(jobId, { chemMixRatio: e.target.value })} placeholder="e.g. 3% SH, 1% SC" className="!py-1.5 !text-xs" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-green-950/20 border border-green-700/30 rounded-xl">
            <input type="checkbox" checked={!!job.customerAccepted} onChange={e => updateJob(jobId, { customerAccepted: e.target.checked })} className="w-4 h-4 accent-green-500" />
            <div>
              <div className="text-sm font-medium text-white/90">✅ Customer Accepts Work Complete</div>
              <div className="text-[10px] text-white/50 mt-0.5">Customer acknowledges job is done to satisfaction</div>
            </div>
          </label>
        </Glass>

        {/* Client Sign-Off */}
        <Glass className={"p-3 " + (job.signOff ? "!bg-green-950/20 !border-green-700/40" : "!bg-black/40")}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1">
              <CheckSquare size={10} />Client Sign-Off
            </div>
            {job.signOff && <div className="text-[10px] text-green-400 font-semibold">✓ Signed</div>}
          </div>
          {job.signOff ? (
            <div className="space-y-1">
              {(job.signOff as any).sigType === "draw" && (job.signOff as any).sigData ? (
                <img src={(job.signOff as any).sigData} alt="Signature" className="bg-white rounded-lg max-h-16" />
              ) : (
                <div className="text-sm font-medium text-white/90">{job.signOff.signerName}</div>
              )}
              <div className="text-[11px] text-white/40">{job.signOff.timestamp}</div>
              <div className="flex gap-2 mt-2">
                <GBtn onClick={() => printSignOff(job.signOff!.signerName, job.signOff!.timestamp)} className="!text-xs !py-1.5">
                  <Download size={11} className="inline mr-1" />Print / Save PDF
                </GBtn>
                <GBtn variant="danger" onClick={() => updateJob(jobId, { signOff: null })} className="!text-xs !py-1.5">
                  Clear Signature
                </GBtn>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs text-white/50 mb-3">
                Generate a completion document with before/after photos, checklist summary, and customer signature. Opens a printable PDF.
              </div>
              <GBtn onClick={openSignOff} className="w-full !justify-center">
                <CheckSquare size={13} className="inline mr-1.5" />Generate Sign-Off Document
              </GBtn>
            </div>
          )}
        </Glass>

        {/* Sign-Off Modal */}
        {showSignOff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setShowSignOff(false)}>
            <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-base font-semibold">Client Sign-Off</div>
                <button onClick={() => setShowSignOff(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
              </div>
              <div className="mb-4 p-3 bg-white/5 rounded-xl text-xs text-white/60 leading-relaxed">
                By signing, the customer confirms all services were completed to their satisfaction and acknowledges pre-existing conditions documented during the pre-job inspection.
              </div>
              <div className="mb-2">
                <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Services Performed</label>
                <div className="p-2 bg-white/5 rounded-lg text-xs text-white/70">
                  {job.notes || "Pressure washing service"} · Total: ${(job.amount || 0).toFixed(2)}
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
                  Customer Full Name (Digital Signature) <span className="text-red-400">*</span>
                </label>
                <GInput
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Type full name to sign..."
                  className="!text-base !font-serif"
                  onKeyDown={e => { if (e.key === "Enter" && signerName.trim()) saveSignOff(); }}
                />
                {signerName && (
                  <div className="mt-1.5 px-2 py-1 border-b border-white/20 text-lg font-serif text-white/80 italic">
                    {signerName}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-white/30 mb-4">
                Timestamp will be recorded automatically at time of signing.
              </div>
              <div className="flex gap-2">
                <GBtn onClick={() => setShowSignOff(false)} variant="ghost" className="flex-1 !justify-center">Cancel</GBtn>
                <GBtn onClick={saveSignOff} className="flex-1 !justify-center !bg-green-800 hover:!bg-green-700">
                  <CheckSquare size={13} className="inline mr-1" />Sign & Save PDF
                </GBtn>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end"><GBtn onClick={onClose}>Done</GBtn></div>
      </div>
      <InvoicePreviewModal
        open={showInvoicePreview}
        onClose={() => setShowInvoicePreview(false)}
        onConfirm={confirmSendInvoice}
        sending={sendingInvoice}
        data={(() => {
          const c = customers.find(x => x.id === job.customerId);
          if (!c) return null;
          return { customerName: c.firstName, address: job.address || "", amount: Number(job.amount) || 0, companyName: settings.companyName || "Crew Boss", payLink: "" };
        })()}
      />
    </Modal>
  );
}

// ===== PIPELINE =====
// ===== PIPELINE SCROLL CONTAINER =====
// Handles horizontal scroll with visible scrollbar + touch swipe on mobile

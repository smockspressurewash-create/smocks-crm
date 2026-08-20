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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, describeRecurringSchedule, buildChecklistFromServices, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, withTimeout } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell, emailButton, logOutboundSmsToInbox } from "../../lib/messaging";
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

export function EstimatesPage({ estimates = [], setEstimates, customers = [], services = [], settings = {} as AppSettings, toast, onPortal = () => {}, estimateTemplates = [], setEstimateTemplates = () => {}, setJobs = () => {}, onNav = () => {}, autoOpenNew = false, onAutoOpenNewConsumed }: { estimates?: any[]; setEstimates?: any; customers?: any[]; services?: any[]; settings?: AppSettings; toast?: any; onPortal?: any; estimateTemplates?: any[]; setEstimateTemplates?: any; setJobs?: any; onNav?: any; autoOpenNew?: boolean; onAutoOpenNewConsumed?: () => void }) {
  const [builderOpen, setBuilderOpen] = useState(false);
  // ISSUE 21 — FAB's "New Quote" now opens the builder immediately.
  useEffect(() => {
    if (!autoOpenNew) return;
    setBuilderOpen(true);
    onAutoOpenNewConsumed?.();
  }, [autoOpenNew]); // eslint-disable-line react-hooks/exhaustive-deps
  const [viewing, setViewing] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [sendModalEst, setSendModalEst] = useState<any>(null);
  const [sendChannel, setSendChannel] = useState<"email" | "sms" | "both">("email");
  const [sendTemplateId, setSendTemplateId] = useState<string>("");
  const [sendPreviewOn, setSendPreviewOn] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);

  // FIX 17/20 — #/portal/ID is the employee portal's route, not a customer
  // estimate view; #/estimate/ID is the public no-login sign/decline/pay portal.
  const portalUrlFor = (estId: string) => `${window.location.origin}${window.location.pathname}#/estimate/${estId}`;

  // FEATURE (round 13, item 1) — a "package"/"options" estimate has no
  // single final price until the customer actually picks between tiers or
  // toggles optional line items on the estimate page itself (ClientPortal.tsx
  // computes effectiveTotal live off their selection). Quoting est.total (the
  // saved default/starting total) in the SMS/email up front was misleading —
  // it read as a fixed price when it was really just one possible outcome.
  // Only "standard"/fixed-price estimates have one real number to quote.
  const hasSelectableOptions = (est: any) => est?.estimateType === "package" || est?.estimateType === "options";

  const buildSendHtml = (est: any, cust: any) => {
    const tpl = estimateTemplates.find((t: any) => t.id === sendTemplateId);
    const link = portalUrlFor(est.id);
    const headerColor = tpl?.colorHeader || "#dc2626";
    const textColor = tpl?.colorText || "#111111";
    const font = tpl?.font || "Arial";
    const priceLine = hasSelectableOptions(est)
      ? `<p>Your ${est.estimateType === "package" ? "packages" : "service options"} are ready to review — pick what works for you and see your total.</p>`
      : `<p>Your estimate of <strong>${fmt(est.total)}</strong> is ready to review${(tpl?.layout) ? "" : ""}.</p>`;
    const bodyInner = `
      <div style="font-family:'${font}',sans-serif;color:${textColor}">
        ${tpl?.logoUrl ? `<img src="${tpl.logoUrl}" style="max-height:48px;margin-bottom:12px" />` : ""}
        <h2 style="margin:0 0 6px;color:${headerColor}">${tpl?.headerText || "Your Estimate"}</h2>
        <p>Hi ${cust.firstName},</p>
        ${priceLine}
        <p>Valid until ${est.validUntil}.</p>
        ${(tpl?.photoSlots || []).filter(Boolean).length ? `<div style="display:flex;gap:8px;margin:12px 0">${tpl.photoSlots.filter(Boolean).map((p: string) => `<img src="${p}" style="width:70px;height:70px;object-fit:cover;border-radius:8px" />`).join("")}</div>` : ""}
        <div style="text-align:center;margin:20px 0"><a href="${link}" style="display:inline-block;background:${headerColor};color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:10px">Review &amp; Sign</a></div>
        ${tpl?.footerText ? `<p style="font-size:11px;color:#888;margin-top:16px">${tpl.footerText}</p>` : ""}
      </div>`;
    return bodyInner;
  };

  const buildSendSms = (est: any, cust: any) => {
    const link = portalUrlFor(est.id);
    const priceText = hasSelectableOptions(est)
      ? `Your ${est.estimateType === "package" ? "packages" : "service options"} from ` + (settings?.companyName || "Crew Boss") + " are ready — pick what works for you."
      : "Your estimate of " + fmt(est.total) + " from " + (settings?.companyName || "Crew Boss") + " is ready.";
    return "Hi " + cust.firstName + "! " + priceText + " Review and sign here: " + link + " — questions? Call " + (settings?.companyPhone || "(717) 555-0100");
  };

  const doSend = async () => {
    if (!sendModalEst) return;
    const cust = customers.find((c: any) => c.id === sendModalEst.customerId);
    if (!cust) return;
    setSendBusy(true);
    try {
      if ((sendChannel === "email" || sendChannel === "both")) {
        if (!cust.email) { toast?.("No email on file for " + cust.firstName, "error"); }
        // A hung Gmail fetch with no timeout is exactly what left this button
        // stuck on "Sending…" forever — same fix as invoice sends (FIX 4).
        else await withTimeout(sendEmail(settings, { to: cust.email, subject: "Your estimate from " + (settings?.companyName || "Crew Boss") + " — " + fmt(sendModalEst.total), body: buildSendHtml(sendModalEst, cust) }), 10000, "Estimate email");
      }
      if ((sendChannel === "sms" || sendChannel === "both")) {
        if (!cust.phone) { toast?.("No phone on file for " + cust.firstName, "error"); }
        else if (settings?.twilioSid) {
          const smsMsg = buildSendSms(sendModalEst, cust);
          await withTimeout(twilioSend(settings, cust.phone, smsMsg), 10000, "Estimate SMS");
          logOutboundSmsToInbox({ contactName: `${cust.firstName} ${cust.lastName}`, contactPhone: cust.phone, customerId: cust.id, body: smsMsg }).catch(() => {});
        }
        else { window.location.href = "sms:" + cust.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(buildSendSms(sendModalEst, cust)); }
      }
      setEstimates((prev: any[]) => prev.map((x: any) => x.id === sendModalEst.id ? { ...x, sentAt: today(), sendChannel, templateId: sendTemplateId || undefined } : x));
      (supabase as any).from("estimates").update({ sentAt: today(), sendChannel }).eq("id", sendModalEst.id).catch(() => {});
      toast?.(`📧 Estimate sent to ${cust.firstName} ✓`, "green");
      setSendModalEst(null);
      setSendPreviewOn(false);
    } catch (err: any) {
      console.error("[SendEstimate] — error:", err?.message || err);
      const msg = err?.message === "Estimate email timed out"
        ? "Send timed out — check your Gmail connection in Settings → Integrations"
        : /expired|reconnect/i.test(err?.message || "")
        ? "Google token expired — reconnect in Settings → Integrations"
        : (err?.message || "Failed to send");
      toast?.(msg, "error");
    } finally {
      setSendBusy(false);
    }
  };

  const setTimeline = (..._args: any[]) => {};
  const createGoogleCalendarEvent = (..._args: any[]) => Promise.resolve(null);

  // An approved/signed estimate needs to show up somewhere the owner will
  // actually see it and schedule it — without this it just sits in the
  // Estimates list with status "approved" and nothing prompts scheduling.
  // Creates an unscheduled job (scheduledDate: "", the existing convention
  // this app already uses for "needs a date") tagged "Needs Scheduling".
  // Guarded by estimateId so re-approving (or both the owner's "Approve"
  // button and the client portal's own approve path) never double-creates.
  const createJobFromApprovedEstimate = (estId: string) => {
    let created: any = null;
    setJobs((prev: any[]) => {
      if (prev.some((j: any) => j.estimateId === estId)) return prev;
      const est = estimates.find((x: any) => x.id === estId);
      if (!est) return prev;
      const cust = customers.find((c: any) => c.id === est.customerId);
      const combinedChecklist = buildChecklistFromServices(est.lineItems, services);
      created = {
        id: uid(), customerId: est.customerId, address: cust?.address || "",
        amount: est.total, status: "scheduled", scheduledDate: "", duration: 2,
        priority: "normal", crew: [], checklist: combinedChecklist, preChecklist: combinedChecklist, photos: [], chemicalsUsed: [],
        equipment: [], tags: ["Needs Scheduling"], commLog: [],
        notes: "From approved estimate #" + estId.slice(-4).toUpperCase(),
        createdAt: today(), estimateId: estId,
        // FIX 4 (mobile round 2) — carry a recurring quote's pattern
        // straight onto the job it becomes, instead of the owner having to
        // re-enter it in JobDetailModal after the fact.
        ...((est as any).isRecurring ? {
          isRecurring: true,
          recurringMode: (est as any).recurringMode,
          recurringFreq: (est as any).recurringFreq,
          recurringInterval: (est as any).recurringInterval,
          recurringWeekdays: (est as any).recurringWeekdays,
        } : {}),
      };
      return [...prev, created];
    });
    // FIX G — same missing-Supabase-insert bug as onSchedule below: this used
    // to be local-state-only, so a job created here (recurring quotes
    // included) never reached the jobs table until the owner later gave it a
    // scheduledDate/crew through JobDetailModal (whose own updateJob call
    // does insert/save correctly) — but if the row itself never existed in
    // Supabase, that update had nothing to attach to. Safe-column retry
    // matches the same pattern used for new jobs in JobsPage.tsx.
    if (created) {
      console.log("[Recurring] saving job from approved estimate", created.id, "isRecurring:", created.isRecurring);
      (async () => {
        const { error } = await withTimeout<any>((supabase as any).from("jobs").insert(created), 15000, "Save job from approved estimate");
        if (error) {
          console.error("[Recurring] job-from-approved-estimate insert failed:", error.message, "— retrying without recurring-schedule columns");
          const { isRecurring, recurringMode, recurringFreq, recurringInterval, recurringWeekdays, ...coreJob } = created;
          const retry = await (supabase as any).from("jobs").insert(coreJob);
          if (retry?.error) {
            console.error("[Recurring] core-column retry also failed:", retry.error.message);
            toast?.("Job created locally, but failed to save to the server — " + retry.error.message, "red");
          } else if (created.isRecurring) {
            toast?.("Job saved, but recurring schedule couldn't be saved — ask your admin to run the pending database migration.", "yellow");
          }
        } else {
          console.log("[Recurring] job from approved estimate saved to Supabase ✓", created.id);
        }
      })();
    }
  };
  const cn = id => { const c = customers.find(x => x.id === id); return c ? c.firstName + " " + c.lastName : "Unknown"; };
  // ITEM 29 — Quotes tab had status pills but no way to sort or search a
  // growing list; added a text search (customer name) and a sort dropdown.
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteSort, setQuoteSort] = useState<"newest" | "oldest" | "amount_high" | "amount_low" | "expiring">("newest");
  const statusFiltered = filter === "all" ? estimates : estimates.filter(e => e.status === filter);
  const searchFiltered = quoteSearch.trim()
    ? statusFiltered.filter(e => cn(e.customerId).toLowerCase().includes(quoteSearch.trim().toLowerCase()))
    : statusFiltered;
  const filtered = [...searchFiltered].sort((a, b) => {
    switch (quoteSort) {
      case "oldest": return (a.createdAt || "").localeCompare(b.createdAt || "");
      case "amount_high": return (b.total || 0) - (a.total || 0);
      case "amount_low": return (a.total || 0) - (b.total || 0);
      case "expiring": return (a.validUntil || "").localeCompare(b.validUntil || "");
      default: return (b.createdAt || "").localeCompare(a.createdAt || "");
    }
  });

  const toggleSel = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleSelAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(e => e.id));

  // FEATURE 5 (mobile round 7) — CSV export of the selected estimates/quotes.
  const downloadSelectedCsv = () => {
    const rows = selected.map(id => {
      const e = estimates.find(x => x.id === id);
      if (!e) return null;
      const c = customers.find(x => x.id === e.customerId);
      return [e.id, cn(e.customerId), e.status, e.createdAt || "", e.total, e.invoiced ? "invoice" : "estimate"]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    }).filter(Boolean);
    const csv = "ID,Customer,Status,Created,Total,Type\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "estimates-" + today() + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Downloaded ${selected.length} estimate${selected.length !== 1 ? "s" : ""}`);
  };

  const duplicate = e => {
    const copy = { ...e, id: uid(), createdAt: today(), validUntil: daysFromNow(30), status: "pending", viewed: false, viewedAt: null };
    setEstimates([copy, ...estimates]);
    toast("Estimate duplicated");
  };

  const exportPDF = e => {
    const c = customers.find(x => x.id === e.customerId);
    const html = `<!DOCTYPE html><html><head><title>Estimate ${e.id}</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:auto}h1{color:#e11d48}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}.total{font-size:20px;color:#e11d48;font-weight:bold}</style></head><body><h1>Crew Boss</h1><h2>Estimate #${e.id.toUpperCase()}</h2><p><strong>Bill to:</strong> ${c?.firstName} ${c?.lastName}<br>${c?.address || ''}</p><table><tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr>${e.lineItems.map(li => `<tr><td>${li.description}</td><td>${li.quantity}</td><td>${fmt(li.unitPrice)}</td><td>${fmt(li.quantity * li.unitPrice)}</td></tr>`).join('')}</table><p>Subtotal: ${fmt(e.subtotal)}<br>Tax: ${fmt(e.tax)}<br><span class="total">Total: ${fmt(e.total)}</span></p></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estimate-" + e.id + ".html";
    a.click();
    URL.revokeObjectURL(url);
    toast("Estimate exported (HTML — print to PDF)");
  };

  const bulkDelete = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`Permanently delete ${selected.length} estimate${selected.length !== 1 ? "s" : ""}? This can't be undone.`)) return;
    const ids = [...selected];
    setEstimates(estimates.filter(e => !ids.includes(e.id)));
    setSelected([]);
    // Must also delete server-side — otherwise the next cross-device sync poll
    // just re-fetches these rows from Supabase and they reappear locally.
    try {
      const { error } = await (supabase as any).from("estimates").delete().in("id", ids);
      if (error) { toast(`Deleted locally, but failed to delete from server — ${error.message}`, "red"); return; }
    } catch (err: any) {
      toast(`Deleted locally, but failed to delete from server — ${err?.message || "unknown error"}`, "red");
      return;
    }
    toast(ids.length + " deleted");
  };

  const openPreview = est => {
    setViewing(est);
    if (!est.viewed) {
      setEstimates(prev => prev.map(x => x.id === est.id ? { ...x, viewed: true, viewedAt: today() } : x));
      toast("📬 Estimate #" + est.id.slice(-4).toUpperCase() + " opened by " + (customers.find(c => c.id === est.customerId)?.firstName || "customer"));
    }
  };

  const getExpiryStatus = e => {
    if (e.status !== "pending") return null;
    const days = daysSince(e.validUntil) * -1;
    if (days < 0) return { tone: "red", label: "EXPIRED", border: "border-red-500/60" };
    if (days <= 7) return { tone: "yellow", label: days + "d left", border: "border-yellow-500/50" };
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          {["all", "pending", "approved", "rejected"].map(s => <button key={s} onClick={() => setFilter(s)} className={"px-3 py-1.5 rounded-xl text-xs font-medium transition border " + (filter === s ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{s === "all" ? "All (" + estimates.length + ")" : (s === "rejected" ? "declined" : s) + " (" + estimates.filter(e => e.status === s).length + ")"}</button>)}
          <input value={quoteSearch} onChange={(e: any) => setQuoteSearch(e.target.value)} placeholder="Search customer…" className="px-3 py-1.5 rounded-xl text-xs bg-black/40 border border-red-900/30 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 w-36" />
          <select value={quoteSort} onChange={(e: any) => setQuoteSort(e.target.value)} className="px-2 py-1.5 rounded-xl text-xs bg-black/40 border border-red-900/30 text-white/70 focus:outline-none">
            <option value="newest" className="bg-black">Newest first</option>
            <option value="oldest" className="bg-black">Oldest first</option>
            <option value="amount_high" className="bg-black">Amount: high → low</option>
            <option value="amount_low" className="bg-black">Amount: low → high</option>
            <option value="expiring" className="bg-black">Expiring soonest</option>
          </select>
          {filtered.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-white/50 pl-2 cursor-pointer">
              <input type="checkbox" checked={selected.length === filtered.length} onChange={toggleSelAll} className="w-4 h-4 rounded accent-red-600" />
              Select all
            </label>
          )}
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && <>
            <GBtn variant="ghost" onClick={downloadSelectedCsv} className="!text-xs"><Download size={12} className="inline mr-1" />Download ({selected.length})</GBtn>
            <GBtn variant="ghost" onClick={async () => {
              let sent = 0;
              for (const id of selected) {
                const est = estimates.find(x => x.id === id);
                const c = est && customers.find(x => x.id === est.customerId);
                if (!c?.phone || !settings?.twilioSid) continue;
                // BUG FIX (round 13) — this pointed to a hardcoded fake
                // "smocks.com" domain that doesn't route anywhere real for
                // any deployment; every other send path uses portalUrlFor()
                // (window.location.origin-based). Also applies the same
                // amount-hiding rule as buildSendSms for options/package
                // estimates.
                const msg = buildSendSms(est, c);
                await twilioSend(settings, c.phone, msg).then(() => {
                  logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
                }).catch(() => {});
                setEstimates(prev => prev.map(e => e.id === id ? { ...e, sentAt: today() } : e));
                sent++;
              }
              toast("SMS sent to " + sent + " customers ✓");
            }} className="!text-xs"><MessageSquare size={12} className="inline mr-1" />SMS ({selected.length})</GBtn>
            <GBtn variant="ghost" onClick={async () => {
              let sent = 0;
              for (const id of selected) {
                const est = estimates.find(x => x.id === id);
                const c = est && customers.find(x => x.id === est.customerId);
                if (!c?.email) continue;
                const estCoName = (settings as any)?.companyName || "Crew Boss";
                const estCoPhone = (settings as any)?.companyPhone || "(717) 555-0100";
                // BUG FIX (round 13) — same broken "smocks.com" domain + fixed-
                // price wording issue as the SMS bulk-send above; now uses the
                // real portal link and hides the amount for options/package
                // estimates.
                const priceLine = hasSelectableOptions(est)
                  ? `Your ${est.estimateType === "package" ? "packages" : "service options"} are ready to review and sign.`
                  : `Your estimate of <strong>${fmt(est.total)}</strong> is ready to review and sign.`;
                const estHtml = emailShell(settings as any, "Your Estimate", `<p>Hi ${c.firstName},</p><p>${priceLine}</p><p>Questions? Call ${estCoPhone}.</p>` + emailButton("View & Sign Estimate", portalUrlFor(est.id)));
                await sendEmail(settings, { to: c.email, subject: "Your estimate from " + estCoName + (hasSelectableOptions(est) ? "" : " — " + fmt(est.total)), body: estHtml }).catch(() => {});
                setEstimates(prev => prev.map(e => e.id === id ? { ...e, sentAt: today() } : e));
                sent++;
              }
              toast("Email sent to " + sent + " customers ✓");
            }} className="!text-xs"><Mail size={12} className="inline mr-1" />Email ({selected.length})</GBtn>
            <GBtn variant="danger" onClick={bulkDelete} className="!text-xs"><Trash2 size={12} className="inline mr-1" />Delete</GBtn>
          </>}
          <GBtn onClick={() => setBuilderOpen(true)}><Plus size={14} className="inline mr-1.5" />New</GBtn>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(e => {
          const expiry = getExpiryStatus(e);
          const isSel = selected.includes(e.id);
          return (
            <Glass key={e.id} className={"p-5 hover:border-red-600/50 transition-all " + (isSel ? "ring-2 ring-red-500/50 " : "") + (expiry ? expiry.border : "")}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <input type="checkbox" checked={isSel} onChange={() => toggleSel(e.id)} className="mt-1 w-4 h-4 rounded accent-red-600" />
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                      #{e.id.toUpperCase()}
                      {e.viewed && <span title={"Viewed " + e.viewedAt}><Eye size={10} className="text-green-400" /></span>}
                    </div>
                    <div className="font-semibold mt-1">{cn(e.customerId)}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Badge tone={e.status === "approved" ? "green" : e.status === "rejected" ? "red" : "yellow"}>{e.status === "rejected" ? "declined" : e.status}</Badge>
                  {e.invoiced && <Badge tone="blue">Invoiced</Badge>}
                  {expiry && <Badge tone={expiry.tone}>{expiry.label}</Badge>}
                  {/* AUDIT A (mobile round 4) — recurring estimates had no
                      indicator anywhere in this list even though the toggle/
                      schedule picker exists in EstimateBuilder; Jobs list has
                      had one all along. */}
                  {(e as any).isRecurring && <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 bg-blue-900/20 border border-blue-800/30 px-2 py-0.5 rounded-full"><Repeat size={8} />{describeRecurringSchedule(e as any)}</span>}
                </div>
              </div>
              <div className="text-2xl font-bold cursor-pointer" onClick={() => openPreview(e)}>{fmt(e.total)}</div>
              <div className="text-xs text-white/50 mt-1 space-y-0.5">
                <div>{e.lineItems.length} items · {e.createdAt}</div>
                {e.discount > 0 && <div className="text-green-400">Discount: {fmt(e.discount)}</div>}
                {e.depositRequired > 0 && <div className="text-yellow-400">Deposit: {fmt(e.depositRequired)}</div>}
              </div>
              <div className="flex gap-1 pt-3 mt-3 border-t border-red-900/20">
                <button onClick={() => openPreview(e)} className="flex-1 p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-[11px] transition flex items-center justify-center gap-1"><Eye size={11} />View</button>
                <button onClick={() => { setSendModalEst(e); setSendChannel(e.sendChannel || "email"); setSendTemplateId(e.templateId || ""); setSendPreviewOn(false); }} title="Send estimate to customer" className="flex-1 p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400 text-[11px] transition flex items-center justify-center gap-1"><Send size={11} />Send</button>
                <button onClick={() => onPortal(e.id)} className="flex-1 p-1.5 rounded-lg hover:bg-purple-900/30 text-white/60 hover:text-purple-400 text-[11px] transition flex items-center justify-center gap-1" title="Preview exactly what the customer sees — sign, pay, and account history"><Globe size={11} />Preview as Customer</button>
                <button onClick={() => duplicate(e)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-[11px] transition flex items-center justify-center"><Copy size={11} /></button>
              </div>
            </Glass>
          );
        })}
      </div>

      <EstimateBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} customers={customers} services={services} settings={settings} estimateTemplates={estimateTemplates} setEstimateTemplates={setEstimateTemplates} onSave={est => {
        setEstimates([...estimates, est]);
        setBuilderOpen(false);
        toast("Estimate created");
        // FIX 13 — a brand-new estimate previously only reached Supabase via
        // the 30s app-level bulk autosave. If the owner sends the "Review &
        // Sign" link within that window, the customer's #/estimate/ID page
        // (an anonymous fetch straight from Supabase) would 404 on a row that
        // doesn't exist there yet. Insert immediately instead.
        (supabase as any).from("estimates").insert(est)
          .then((r: any) => { if (r?.error) toast("Saved locally, but failed to sync — " + r.error.message, "red"); })
          .catch((e: any) => toast("Saved locally, but failed to sync — " + (e?.message || ""), "red"));
        // Auto-add to customer timeline
        const c = customers.find(x => x.id === est.customerId);
        if (c) setTimeline(prev => ({ ...prev, [c.id]: [{ id: uid(), type: "estimate", note: "Estimate created — " + fmt(est.total), date: today() }, ...(prev[c.id] || [])] }));
      }} />
      <EstimatePreview estimate={viewing} customers={customers} settings={settings} onClose={() => setViewing(null)} onApprove={id => {
        setEstimates(estimates.map(x => x.id === id ? { ...x, status: "approved", signedAt: today() } : x));
        createJobFromApprovedEstimate(id);
        setViewing(null);
        toast("Approved!");
      }} onConvert={id => { setEstimates(estimates.map(x => x.id === id ? { ...x, invoiced: true, invoicedAt: today() } : x)); setViewing(null); toast("Converted to invoice"); }} onSchedule={est => {
        const c = customers.find(x => x.id === est.customerId);
        const combinedChecklist = buildChecklistFromServices(est.lineItems, services);
        const newJob = {
          id: uid(), customerId: est.customerId, address: c?.address || "", amount: est.total, status: "scheduled", scheduledDate: today(), duration: 3, priority: "normal", checklist: combinedChecklist, preChecklist: combinedChecklist, photos: [], chemicalsUsed: [], crew: [], notes: "From estimate #" + (est.id || "").slice(-4), pipelineStage: "scheduled", createdAt: today(),
          // FIX 4 (mobile round 2) — carry the estimate's recurring pattern
          // onto the job instead of always hardcoding isRecurring: false.
          isRecurring: !!(est as any).isRecurring,
          ...((est as any).isRecurring ? {
            recurringMode: (est as any).recurringMode,
            recurringFreq: (est as any).recurringFreq,
            recurringInterval: (est as any).recurringInterval,
            recurringWeekdays: (est as any).recurringWeekdays,
          } : {}),
        };
        setJobs(prev => [...prev, newJob]);
        // FIX G — this used to ONLY call setJobs (local React state), the
        // same "local-state-only mutation" bug already found and fixed for
        // invoice inserts (FIX 1). With no Supabase insert at all, a job
        // scheduled from an estimate — recurring ones included, since
        // isRecurring/recurringFreq/etc. are carried over above — never
        // reached the jobs table, so the employee portal (which reads jobs
        // straight from Supabase) never saw it, no matter who was later
        // assigned to the crew. Insert immediately, with a safe-column retry
        // for isRecurring/recurringMode/recurringFreq/recurringInterval/
        // recurringWeekdays in case migration 0007 hasn't been run yet —
        // matching the same pattern already used for new jobs in JobsPage.tsx.
        console.log("[Recurring] saving job scheduled from estimate", newJob.id, "isRecurring:", (newJob as any).isRecurring);
        (async () => {
          const { error } = await withTimeout<any>((supabase as any).from("jobs").insert(newJob), 15000, "Save job from estimate");
          if (error) {
            console.error("[Recurring] job-from-estimate insert failed:", error.message, "— retrying without recurring-schedule columns");
            const { isRecurring, recurringMode, recurringFreq, recurringInterval, recurringWeekdays, ...coreJob } = newJob as any;
            const retry = await (supabase as any).from("jobs").insert(coreJob);
            if (retry?.error) {
              console.error("[Recurring] core-column retry also failed:", retry.error.message);
              toast?.("Job created locally, but failed to save to the server — " + retry.error.message, "red");
            } else if ((newJob as any).isRecurring) {
              toast?.("Job saved, but recurring schedule couldn't be saved — ask your admin to run the pending database migration.", "yellow");
            }
          } else {
            console.log("[Recurring] job from estimate saved to Supabase ✓", newJob.id);
          }
        })();
        // Auto-sync to Google Calendar if connected
        if (settings?.googleConnected && settings?.googleScopes?.calendar) {
          createGoogleCalendarEvent(settings, newJob, c).then(ev => { if (ev) toast("📅 Synced to Google Calendar ✓"); });
        }
        setViewing(null);
        toast("Job scheduled from estimate ✓ — set date in Jobs");
        onNav("jobs");
      }} onMarkDepositPaid={(id: string, amount: number) => {
        // FEATURE 6 — manual "collected outside the CRM" deposit (cash/check),
        // distinct from the client's own online Stripe payment in ClientPortal.
        setEstimates(prev => prev.map(x => x.id === id ? { ...x, paidDeposit: amount, depositPaidAt: today() } : x));
        (supabase as any).from("estimates").update({ paidDeposit: amount, depositPaidAt: today() }).eq("id", id)
          .then((r: any) => { if (r?.error) { console.warn("[Deposit] save failed:", r.error.message); toast?.("Marked locally, but failed to sync — " + r.error.message, "red"); } else toast?.("Deposit marked as paid ✓", "green"); })
          .catch((e: any) => { console.warn("[Deposit] save threw:", e?.message); toast?.("Marked locally, but failed to sync", "red"); });
      }} />

      <Modal open={!!sendModalEst} onClose={() => { setSendModalEst(null); setSendPreviewOn(false); }} title="Send Estimate" maxW="max-w-md">
        {sendModalEst && (() => {
          const cust = customers.find((c: any) => c.id === sendModalEst.customerId);
          return (
            <div className="space-y-3">
              <div className="text-sm text-white/70">To <strong className="text-white">{cust?.firstName} {cust?.lastName}</strong> — {fmt(sendModalEst.total)}</div>

              <div>
                <label className="text-xs text-white/60 mb-1.5 block">Send Via</label>
                <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
                  {(["email", "sms", "both"] as const).map(ch => (
                    <button key={ch} onClick={() => setSendChannel(ch)} className={"flex-1 py-1.5 rounded-lg text-xs capitalize transition " + (sendChannel === ch ? "bg-red-700/40 text-white border border-red-700/50" : "text-white/50")}>{ch}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/60 mb-1.5 block">Template</label>
                <GSel value={sendTemplateId} onChange={(e: any) => setSendTemplateId(e.target.value)} className="!text-xs">
                  <option value="" className="bg-black">Default</option>
                  {estimateTemplates.map((t: any) => <option key={t.id} value={t.id} className="bg-black">{t.name}</option>)}
                </GSel>
              </div>

              <button onClick={() => setSendPreviewOn(p => !p)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"><Eye size={12} />{sendPreviewOn ? "Hide" : "Show"} preview</button>
              {sendPreviewOn && cust && (
                <div className="border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  {sendChannel === "sms" ? (
                    <div className="p-3 bg-black/40 text-xs whitespace-pre-wrap">{buildSendSms(sendModalEst, cust)}</div>
                  ) : (
                    <div className="p-3 bg-white" dangerouslySetInnerHTML={{ __html: buildSendHtml(sendModalEst, cust) }} />
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
                <GBtn variant="ghost" onClick={() => setSendModalEst(null)}>Cancel</GBtn>
                <GBtn onClick={doSend} disabled={sendBusy}><Send size={13} className="inline mr-1" />{sendBusy ? "Sending…" : "Send"}</GBtn>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// ===== CHEMICAL COST CALCULATOR (AI-powered) =====

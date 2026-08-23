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
import { twilioSend, sendEmail, logOutboundSmsToInbox } from "../../lib/messaging";
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

export function LeadIntakePage({ customers = [], setCustomers, estimates = [], setEstimates, services = [], jobs = [], settings = {} as AppSettings, setSettings, toast, onNav, onConvertToEstimate, ownerId = "" }: { customers?: any[]; setCustomers?: any; estimates?: any[]; setEstimates?: any; services?: any[]; jobs?: any[]; settings?: AppSettings; setSettings?: any; toast?: any; onNav?: any; onConvertToEstimate?: (customerId: string) => void; ownerId?: string }) {
  const [submissions, setSubmissions] = usePersistent("smocks.intakeLeads", []);
  const [preview, setPreview] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  // FEATURE — Lead Intake list: sort/filter/actions for incoming leads. A
  // "lead" is any `customers` row with pipelineStage === "lead" (the row
  // LeadFormPage.tsx's public embed form — or the in-app preview form below
  // — inserts). Reading straight off `customers` (not the local-only
  // `submissions` state above) is what makes this list actually reflect
  // leads submitted from a real embedded form on another device: `submissions`
  // is localStorage-only (usePersistent), so leads captured through the real
  // public embed on the owner's website — a different browser/device
  // entirely — never touched it and never showed up here.
  const [leadSort, setLeadSort] = useState<"newest" | "oldest" | "name" | "source">("newest");
  const [leadSourceFilter, setLeadSourceFilter] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", service: "", message: "", source: "Website", sqFootage: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Capture UTM params from current URL automatically
  const utmParams = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return { utm_source: p.get("utm_source"), utm_medium: p.get("utm_medium"), utm_campaign: p.get("utm_campaign"), utm_content: p.get("utm_content"), utm_term: p.get("utm_term"), ref: p.get("ref") };
    } catch { return {}; }
  })();
  const hasUtm = Object.values(utmParams).some(Boolean);

  const handleSubmit = () => {
    if (!f.firstName || !f.phone) return;
    setSubmitting(true);
    setTimeout(() => {
      const custId = uid();
      // Determine lead source from UTM or manual
      const derivedSource = utmParams.utm_source ? (utmParams.utm_source === "google" ? "Google" : utmParams.utm_source === "facebook" ? "Facebook" : utmParams.utm_source === "instagram" ? "Instagram" : utmParams.utm_source === "nextdoor" ? "Nextdoor" : utmParams.utm_source) : f.source;
      const newCustomer = { id: custId, firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone, address: f.address, leadSource: derivedSource, sqFootage: f.sqFootage, notes: f.message, tags: [], createdAt: today(), totalSpent: 0, pipelineStage: "lead", utmSource: utmParams.utm_source, utmMedium: utmParams.utm_medium, utmCampaign: utmParams.utm_campaign, utmContent: utmParams.utm_content, refCode: utmParams.ref };
      setCustomers(prev => [...prev, newCustomer]);
      const lead = { id: uid(), type: "intake", customerId: custId, service: f.service, message: f.message, source: derivedSource, utmParams, submittedAt: new Date().toISOString(), status: "new" };
      setSubmissions(prev => [lead, ...prev]);

      // Also notify Will by email
      if (settings?.googleConnected && settings?.googleScopes?.gmail) {
        const notifyMsg = `New lead from ${derivedSource}:\n${f.firstName} ${f.lastName}\n${f.phone}\n${f.email || "no email"}\n${f.address}\nService: ${f.service || "not specified"}\nMessage: ${f.message || "none"}`;
        sendEmail(settings, { to: settings.companyEmail || "smocks@smockspower.com", subject: "🔔 New Lead: " + f.firstName + " " + f.lastName + " (" + derivedSource + ")", body: notifyMsg }).catch(() => {});
      }

      // Instant auto-response SMS to the lead
      if (settings?.twilioSid && f.phone) {
        const autoReply = "Hi " + f.firstName + "! Thanks for reaching out to Crew Boss 🙌 We received your request" + (f.service ? " for " + f.service : "") + " and will follow up within 24 hours with a quote. Questions? Call (717) 555-0100. — Will @ Crew Boss";
        twilioSend(settings, f.phone, autoReply)
          .then(() => logOutboundSmsToInbox({ contactName: `${f.firstName} ${f.lastName}`, contactPhone: f.phone, customerId: custId, body: autoReply }).catch(() => {}))
          .catch(() => {});
      }

      // Alfred: find 3 open slots → text Will to confirm booking
      if (settings?.myPhone && settings?.twilioSid) {
        const slots = [];
        for (let i = 1; i <= 21 && slots.length < 3; i++) {
          const d = new Date(); d.setDate(d.getDate() + i);
          if (d.getDay() === 0 || d.getDay() === 6) continue;
          const ds = d.toISOString().slice(0, 10);
          const dayJobs = jobs.filter(j => j.scheduledDate === ds && j.status === "scheduled");
          if (dayJobs.length < 4) slots.push({ date: ds, day: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), count: dayJobs.length });
        }
        const slotText = slots.map((s, i) => (i+1) + ". " + s.day + (s.count > 0 ? " (" + s.count + " jobs)" : " ✅ open")).join("\n");
        const willMsg = "📋 NEW ESTIMATE REQUEST\n\n" + f.firstName + " " + f.lastName + "\n" + (f.phone || "") + "\n" + (f.address || "Address: " + (f.message || "not given")) + "\nService: " + (f.service || "General") + "\n\nOpen slots:\n" + slotText + "\n\nReply 1, 2, or 3 to confirm a time and Alfred will book it. — Alfred";
        setTimeout(() => twilioSend(settings, settings.myPhone, willMsg).catch(() => {}), 2000);
      }
      setSubmitting(false);
      setSubmitted(true);
      toast("New lead! " + f.firstName + " " + f.lastName + " added to CRM" + (derivedSource !== "Website" ? " via " + derivedSource : ""));
      setTimeout(() => { setSubmitted(false); setF({ firstName: "", lastName: "", email: "", phone: "", address: "", service: "", message: "", source: "Website", sqFootage: "" }); setPreview(false); }, 3000);
    }, 1000);
  };

  // ── Incoming leads list — the real source of truth is `customers` rows
  // still sitting in the "lead" pipeline stage (see comment above), so this
  // reflects leads from the real embedded form, the in-app preview form, and
  // manually-added customers alike, synced cross-device like every other
  // list in this app.
  const allLeads = customers.filter((c: any) => c.pipelineStage === "lead");
  const leadSources = [...new Set(allLeads.map((c: any) => c.leadSource).filter(Boolean))] as string[];
  const visibleLeads = allLeads
    .filter((c: any) => leadStatusFilter === "all" ? true : leadStatusFilter === "archived" ? !!c.leadArchived : !c.leadArchived)
    .filter((c: any) => leadSourceFilter ? c.leadSource === leadSourceFilter : true)
    .sort((a: any, b: any) => {
      if (leadSort === "name") return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (leadSort === "source") return (a.leadSource || "").localeCompare(b.leadSource || "");
      const at = new Date(a.createdAt || 0).getTime(), bt = new Date(b.createdAt || 0).getTime();
      return leadSort === "oldest" ? at - bt : bt - at;
    });

  // Shared save path for lead-row actions — same local-update + Supabase
  // upsert + success/failure toast pattern as CustomersPage.tsx's `save`,
  // including its "safe column" retry for fields that might not have a
  // migration applied yet (see CustomersPage.tsx's `folder` handling).
  const updateLeadCustomer = (updated: any, successMsg: string, retryDropFields: string[] = []) => {
    setCustomers((prev: any[]) => prev.map(c => c.id === updated.id ? updated : c));
    (supabase as any).from("customers").upsert(updated, { onConflict: "id" })
      .then(async (result: any) => {
        if (result?.error) {
          if (retryDropFields.length && retryDropFields.some(f => f in updated)) {
            console.warn("[LeadIntake] update failed:", result.error.message, "— retrying without", retryDropFields.join(", "));
            const core = { ...updated };
            retryDropFields.forEach(f => delete core[f]);
            const retry = await (supabase as any).from("customers").upsert(core, { onConflict: "id" });
            if (retry?.error) {
              console.error("[LeadIntake] core retry also failed:", retry.error.message);
              toast("Saved locally, but failed to sync — " + retry.error.message, "red");
            } else {
              toast("Saved, but needs a pending database migration to fully sync", "yellow");
            }
            return;
          }
          console.error("[LeadIntake] update failed:", result.error.message);
          toast("Saved locally, but failed to sync — " + result.error.message, "red");
          return;
        }
        toast(successMsg, "green");
      })
      .catch((e: any) => {
        console.error("[LeadIntake] update threw:", e?.message);
        toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red");
      });
  };

  const convertToCustomer = (lead: any) => {
    updateLeadCustomer({ ...lead, pipelineStage: "contacted" }, `${lead.firstName} ${lead.lastName} converted to customer ✓`);
  };

  const convertToEstimateAction = (lead: any) => {
    if (!onConvertToEstimate) { toast("Unable to open the estimate builder from here", "red"); return; }
    onConvertToEstimate(lead.id);
    toast(`Opening a new estimate for ${lead.firstName} ${lead.lastName} ✓`, "green");
  };

  const archiveLead = (lead: any) => {
    updateLeadCustomer({ ...lead, leadArchived: true }, `${lead.firstName} ${lead.lastName} archived ✓`, ["leadArchived"]);
  };

  const unarchiveLead = (lead: any) => {
    updateLeadCustomer({ ...lead, leadArchived: false }, `${lead.firstName} ${lead.lastName} restored ✓`, ["leadArchived"]);
  };

  const deleteLead = (lead: any) => {
    if (!window.confirm(`Permanently delete lead "${lead.firstName} ${lead.lastName}"? This can't be undone.`)) return;
    setCustomers((prev: any[]) => prev.filter(c => c.id !== lead.id));
    (supabase as any).from("customers").delete().eq("id", lead.id)
      .then((result: any) => {
        if (result?.error) {
          console.error("[LeadIntake] delete failed:", result.error.message);
          toast("Deleted locally, but failed to delete from server — " + result.error.message, "red");
          return;
        }
        toast(`${lead.firstName} ${lead.lastName} deleted ✓`, "green");
      })
      .catch((e: any) => {
        console.error("[LeadIntake] delete threw:", e?.message);
        toast("Deleted locally, but failed to delete from server — " + (e?.message || "unknown error"), "red");
      });
  };

  const companyName = settings?.companyName || "Crew Boss";
  // BUG FIX — "changing colors doesn't update the preview": these three
  // values used to only be computed inside the embedOpen IIFE below, so the
  // "Preview Form" block (a separate section, hardcoded red/black Tailwind
  // classes) never reflected them at all — only the raw embed HTML/iframe
  // URL did, and that's only visible by opening it in a new tab. Lifted to
  // component scope so the in-app preview can use the same live values.
  const leadBg = (settings as any)?.leadFormBgColor || "#0a0a0a";
  const leadBtn = (settings as any)?.leadFormButtonColor || "#dc2626";
  const leadText = (settings as any)?.leadFormTextColor || "#ffffff";

  return (
    <div className="space-y-5">
      {/* Header */}
      <Glass className="p-5 !bg-gradient-to-br !from-blue-950/30 !to-black/60 !border-blue-700/30">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1"><FileImage size={16} className="text-blue-400" /><h3 className="font-bold text-lg">Lead Intake Form</h3></div>
            <p className="text-xs text-white/60 max-w-lg">New leads from your website land here and auto-create a customer record in the CRM. Preview the customer-facing form, then embed the code on your site.</p>
          </div>
          <div className="flex items-center gap-2">
            <GBtn variant="ghost" onClick={() => setPreview(!preview)} className="!text-xs"><Globe size={12} className="inline mr-1" />{preview ? "Hide Form" : "Preview Form"}</GBtn>
            <GBtn onClick={() => setEmbedOpen(o => !o)} className="!text-xs"><Copy size={12} className="inline mr-1" />Get Embed Code</GBtn>
          </div>
        </div>
      </Glass>

      {/* FIX 18 — the old "Copy Embed" button silently copied an iframe
          pointed at a hardcoded, nonexistent URL (https://smocks.com/lead-form
          isn't a real page anywhere) — pasting it into a real website showed a
          blank/permanent-404 iframe, so no lead submitted through it could
          ever reach the CRM. #/lead-form is now a real public route
          (LeadFormPage.tsx) that inserts straight into Supabase's customers
          table with no owner session required. */}
      {embedOpen && (() => {
        // ITEM 1 — owner-set colors ride along as bg/btn/text query params;
        // LeadFormPage.tsx reads and applies them, same non-secret pattern as
        // co/ph above.
        // BUG FIX — this embed URL never carried which business the lead
        // belongs to (oid=). Harmless when this was truly single-tenant, but
        // once RLS went owner_id-scoped there was no way for the public
        // #/lead-form page to know whose account to save the lead under.
        const embedUrl = `${window.location.origin}${window.location.pathname}#/lead-form?oid=${encodeURIComponent(ownerId)}&co=${encodeURIComponent(companyName)}&ph=${encodeURIComponent(settings?.companyPhone || "")}&bg=${encodeURIComponent(leadBg)}&btn=${encodeURIComponent(leadBtn)}&text=${encodeURIComponent(leadText)}`;
        const embedHtml = `<!-- ${companyName} — Request a Quote -->\n<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="720"\n  frameborder="0"\n  style="border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15)"\n  title="Request a Quote"\n></iframe>`;
        return (
          <Glass className="p-5 space-y-3">
            <div className="text-sm font-semibold">Embed on your website</div>
            <div className="text-xs text-white/60 leading-relaxed">
              Paste this snippet into your website's HTML (most site builders — Wix, Squarespace, WordPress — have an "Embed HTML" or "Custom Code" block). Every submission creates a customer record in this CRM automatically — no setup needed on your end.
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-white/50 mb-1 block">Background</label>
                <input type="color" value={leadBg} onChange={(e: any) => setSettings?.((s: any) => ({ ...s, leadFormBgColor: e.target.value }))} className="w-full h-8 rounded-lg bg-transparent cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block">Buttons / Header</label>
                <input type="color" value={leadBtn} onChange={(e: any) => setSettings?.((s: any) => ({ ...s, leadFormButtonColor: e.target.value }))} className="w-full h-8 rounded-lg bg-transparent cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block">Text</label>
                <input type="color" value={leadText} onChange={(e: any) => setSettings?.((s: any) => ({ ...s, leadFormTextColor: e.target.value }))} className="w-full h-8 rounded-lg bg-transparent cursor-pointer" />
              </div>
            </div>
            <pre className="text-[11px] bg-black/60 border border-white/10 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all text-white/80">{embedHtml}</pre>
            <div className="flex gap-2">
              <GBtn onClick={() => { navigator.clipboard?.writeText(embedHtml).catch(() => {}); toast("Embed code copied! Paste into your website's HTML ✓"); }} className="!text-xs">
                <Copy size={12} className="inline mr-1" />Copy Code
              </GBtn>
              <GBtn variant="ghost" onClick={() => window.open(embedUrl, "_blank", "noopener,noreferrer")} className="!text-xs">
                <ExternalLink size={12} className="inline mr-1" />Open Form in New Tab
              </GBtn>
            </div>
          </Glass>
        );
      })()}

      {/* Incoming Leads — sortable/filterable list of customers rows still in
          the "lead" pipeline stage (see comment above allLeads), with row
          actions. Table on desktop, same row content stacks/scrolls on
          mobile via overflow-x-auto — same responsive convention as
          CustomersPage.tsx's customer table (icon-only action buttons +
          overflow-x-auto wrapper + hiding secondary columns on small
          screens), rather than inventing a new mobile layout. */}
      {/* BUG FIX — sort/filter/action controls used to only render once at
          least one lead existed, so a brand-new owner with zero leads had no
          way to see this section even worked. Always show the controls;
          only the table-vs-empty-message part below depends on lead count. */}
      <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-white/50 uppercase tracking-wider font-semibold flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {visibleLeads.length} Lead{visibleLeads.length !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <GSel value={leadSourceFilter} onChange={(e: any) => setLeadSourceFilter(e.target.value)} className="!text-xs !py-1.5 !w-auto">
                <option value="" className="bg-black">All Sources</option>
                {leadSources.map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
              </GSel>
              <GSel value={leadStatusFilter} onChange={(e: any) => setLeadStatusFilter(e.target.value)} className="!text-xs !py-1.5 !w-auto">
                <option value="active" className="bg-black">Active</option>
                <option value="archived" className="bg-black">Archived</option>
                <option value="all" className="bg-black">All</option>
              </GSel>
              <GSel value={leadSort} onChange={(e: any) => setLeadSort(e.target.value)} className="!text-xs !py-1.5 !w-auto">
                <option value="newest" className="bg-black">Newest First</option>
                <option value="oldest" className="bg-black">Oldest First</option>
                <option value="name" className="bg-black">Name (A–Z)</option>
                <option value="source" className="bg-black">Source</option>
              </GSel>
            </div>
          </div>

          {allLeads.length === 0 ? (
            <Glass className="p-6 text-center text-sm text-white/40">No leads yet — preview the form below, then embed it on your website to start capturing leads automatically.</Glass>
          ) : visibleLeads.length === 0 ? (
            <Glass className="p-6 text-center text-sm text-white/40">No leads match these filters.</Glass>
          ) : (
            <Glass className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-red-900/30 bg-black/40">
                      <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Lead</th>
                      <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider hidden md:table-cell">Source</th>
                      <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider hidden lg:table-cell">Phone</th>
                      <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                      <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLeads.map((c: any) => (
                      <tr key={c.id} className={"border-b border-red-900/10 hover:bg-white/5 transition " + (c.leadArchived ? "opacity-50" : "")}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{c.firstName} {c.lastName}</span>
                            {c.leadArchived && <Badge tone="gray">Archived</Badge>}
                          </div>
                          <div className="text-xs text-white/50">{c.email}</div>
                          <div className="text-xs text-white/50 md:hidden">{c.leadSource || "—"}</div>
                          {c.address && <div className="text-[11px] text-white/40 mt-0.5">📍 {c.address}</div>}
                          {c.notes && <div className="text-[11px] text-white/40 italic mt-0.5 max-w-xs truncate" title={c.notes}>"{c.notes}"</div>}
                        </td>
                        <td className="px-5 py-4 text-white/70 hidden md:table-cell">{c.leadSource ? <Badge tone="blue">{c.leadSource}</Badge> : "—"}</td>
                        <td className="px-5 py-4 text-white/70 hidden lg:table-cell">{c.phone || "—"}</td>
                        <td className="px-5 py-4 text-white/50 text-xs hidden sm:table-cell">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <button onClick={() => convertToCustomer(c)} title="Convert to Customer" className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400 transition"><UserCheck size={14} /></button>
                            <button onClick={() => convertToEstimateAction(c)} title="Convert to Estimate" className="p-1.5 rounded-lg hover:bg-blue-900/30 text-white/60 hover:text-blue-400 transition"><FileText size={14} /></button>
                            {c.leadArchived ? (
                              <button onClick={() => unarchiveLead(c)} title="Unarchive" className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"><Eye size={14} /></button>
                            ) : (
                              <button onClick={() => archiveLead(c)} title="Archive" className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/60 hover:text-yellow-400 transition"><EyeOff size={14} /></button>
                            )}
                            <button onClick={() => deleteLead(c)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-900/30 text-white/60 hover:text-red-400 transition"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Glass>
          )}
      </div>

      {/* Customer-facing form preview */}
      {preview && (
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          {/* Form header */}
          <div className="px-6 py-5" style={{ background: leadBtn }}>
            <div className="font-bold text-lg" style={{ color: leadText }}>{companyName}</div>
            <div className="text-xs mt-0.5 opacity-80" style={{ color: leadText }}>Get a free estimate — we respond within 2 hours</div>
          </div>

          {/* Form body */}
          <div className="p-6" style={{ background: leadBg }}>
            {submitted ? (
              <div className="text-center py-8 space-y-3">
                <div className="text-4xl">🎉</div>
                <div className="text-xl font-bold text-green-400">We got your request!</div>
                <div className="text-white/60 text-sm">We'll call or text you within 2 hours to schedule your free estimate.</div>
              </div>
            ) : (
              <div className="space-y-4 max-w-lg mx-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-white/60 mb-1 block">First Name *</label><GInput value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} placeholder="Jennifer" /></div>
                  <div><label className="text-xs text-white/60 mb-1 block">Last Name *</label><GInput value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} placeholder="Walsh" /></div>
                </div>
                <div><label className="text-xs text-white/60 mb-1 block">Phone Number *</label><GInput type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="(717) 555-0100" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="jen@email.com" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Property Address *</label><AddressAutocomplete value={f.address} onChange={v => setF({ ...f, address: v })} mapsKey={settings.googleMapsKey || (settings as any).mapsKey || ""} placeholder="412 Oak Ridge Ln, York PA" knownAddresses={customers.map((c: any) => c.address).filter(Boolean)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-white/60 mb-1 block">Service Needed</label>
                    <GSel value={f.service} onChange={e => setF({ ...f, service: e.target.value })} className="!text-xs">
                      <option value="" className="bg-black">Select service…</option>
                      {services.map(s => <option key={s.id} value={s.name} className="bg-black">{s.name}</option>)}
                      <option value="Not sure" className="bg-black">Not sure yet</option>
                    </GSel>
                  </div>
                  <div><label className="text-xs text-white/60 mb-1 block">Est. Sq Footage</label><GInput type="number" value={f.sqFootage} onChange={e => setF({ ...f, sqFootage: e.target.value })} placeholder="2000" /></div>
                </div>
                <div><label className="text-xs text-white/60 mb-1 block">Anything else we should know?</label><GTxt rows={3} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} placeholder="Gate code, dog on property, specific concerns..." className="!text-xs" /></div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">How did you find us?</label>
                  <GSel value={f.source} onChange={e => setF({ ...f, source: e.target.value })} className="!text-xs">
                    {["Website","Google Search","Google Maps","Facebook","Instagram","Nextdoor","Referral from friend","Yard sign","Angi / HomeAdvisor","Thumbtack","Other"].map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
                  </GSel>
                  {hasUtm && <div className="mt-2 p-2 bg-blue-950/20 border border-blue-700/30 rounded-xl text-[10px] text-blue-300 flex flex-wrap gap-2">
                    <span className="font-semibold">🔗 UTM detected:</span>
                    {utmParams.utm_source && <span>source: <b>{utmParams.utm_source}</b></span>}
                    {utmParams.utm_medium && <span>medium: <b>{utmParams.utm_medium}</b></span>}
                    {utmParams.utm_campaign && <span>campaign: <b>{utmParams.utm_campaign}</b></span>}
                    {utmParams.ref && <span>ref: <b>{utmParams.ref}</b></span>}
                  </div>}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!f.firstName || !f.phone || !f.address || submitting}
                  style={{ background: leadBtn, color: leadText }}
                  className="w-full py-4 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting…" : "Get My Free Estimate →"}
                </button>
                <div className="text-center text-[10px] opacity-50" style={{ color: leadText }}>🔒 We never share your info · No spam · Usually respond within 2 hours</div>
              </div>
            )}
          </div>
        </div>
      )}

      {allLeads.length === 0 && !preview && (
        <div className="text-center pt-2">
          <GBtn onClick={() => setPreview(true)}>Preview Customer Form</GBtn>
        </div>
      )}
    </div>
  );
}

// ===== REVIEW → SOCIAL GRAPHIC GENERATOR =====

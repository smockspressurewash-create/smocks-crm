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

export function LeadIntakePage({ customers = [], setCustomers, estimates = [], setEstimates, services = [], jobs = [], settings = {} as AppSettings, toast, onNav }: { customers?: any[]; setCustomers?: any; estimates?: any[]; setEstimates?: any; services?: any[]; jobs?: any[]; settings?: AppSettings; toast?: any; onNav?: any }) {
  const [submissions, setSubmissions] = usePersistent("smocks.intakeLeads", []);
  const [preview, setPreview] = useState(false);
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
      if (settings?.resendKey || (settings?.googleConnected && settings?.googleScopes?.gmail)) {
        const notifyMsg = `New lead from ${derivedSource}:\n${f.firstName} ${f.lastName}\n${f.phone}\n${f.email || "no email"}\n${f.address}\nService: ${f.service || "not specified"}\nMessage: ${f.message || "none"}`;
        sendEmail(settings, { to: settings.companyEmail || "smocks@smockspower.com", subject: "🔔 New Lead: " + f.firstName + " " + f.lastName + " (" + derivedSource + ")", body: notifyMsg }).catch(() => {});
      }

      // Instant auto-response SMS to the lead
      if (settings?.twilioSid && f.phone) {
        const autoReply = "Hi " + f.firstName + "! Thanks for reaching out to Smock's Pressure Washing 🙌 We received your request" + (f.service ? " for " + f.service : "") + " and will follow up within 24 hours with a quote. Questions? Call (717) 555-0100. — Will @ Smock's";
        twilioSend(settings, f.phone, autoReply).catch(() => {});
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

  const dismiss = id => setSubmissions(prev => prev.filter(s => s.id !== id));
  const convertToJob = sub => {
    const c = customers.find(x => x.id === sub.customerId);
    if (c) { toast("Opening pipeline for " + c.firstName); onNav("pipeline"); }
    dismiss(sub.id);
  };

  const companyName = settings?.companyName || "Smock's Pressure Washing";

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
            <GBtn onClick={() => {
              const embedHtml = `<!-- Smock's Pressure Washing Lead Form -->\n<iframe\n  src="https://smocks.com/lead-form"\n  width="100%"\n  height="620"\n  frameborder="0"\n  style="border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15)"\n  title="Request a Quote"\n></iframe>`;
              navigator.clipboard?.writeText(embedHtml).catch(()=>{});
              toast("Embed code copied! Paste into your website's HTML ✓");
            }} className="!text-xs"><Copy size={12} className="inline mr-1" />Copy Embed</GBtn>
          </div>
        </div>
      </Glass>

      {/* New Submissions */}
      {submissions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-white/50 uppercase tracking-wider font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {submissions.length} New Lead{submissions.length !== 1 ? "s" : ""}
          </div>
          {submissions.map(sub => {
            const c = customers.find(x => x.id === sub.customerId);
            return (
              <Glass key={sub.id} className="p-4 !bg-green-950/20 !border-green-700/30">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-base font-bold flex-shrink-0">
                    {c?.firstName?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{c?.firstName} {c?.lastName}</span>
                      <Badge tone="green">New Lead</Badge>
                      <span className="text-[10px] text-white/40">{new Date(sub.submittedAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-white/60 mt-1 space-y-0.5">
                      {c?.phone && <div>📱 {c.phone}</div>}
                      {c?.email && <div>📧 {c.email}</div>}
                      {sub.service && <div>🔨 Service: {sub.service}</div>}
                      {c?.address && <div>📍 {c.address}</div>}
                      {sub.message && <div className="text-white/50 italic mt-1">"{sub.message}"</div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <GBtn onClick={() => convertToJob(sub)} className="!text-xs !py-1.5 !px-3">Send Estimate</GBtn>
                    <GBtn variant="ghost" onClick={() => dismiss(sub.id)} className="!text-xs !py-1.5 !px-3">Dismiss</GBtn>
                  </div>
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {/* Customer-facing form preview */}
      {preview && (
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          {/* Form header */}
          <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-5">
            <div className="font-bold text-lg text-white">{companyName}</div>
            <div className="text-red-200 text-xs mt-0.5">Get a free estimate — we respond within 2 hours</div>
          </div>

          {/* Form body */}
          <div className="bg-neutral-950 p-6">
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
                <div><label className="text-xs text-white/60 mb-1 block">Property Address *</label><AddressAutocomplete value={f.address} onChange={v => setF({ ...f, address: v })} mapsKey={settings.googleMapsKey || (settings as any).mapsKey || ""} placeholder="412 Oak Ridge Ln, York PA" /></div>
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
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting…" : "Get My Free Estimate →"}
                </button>
                <div className="text-center text-[10px] text-white/30">🔒 We never share your info · No spam · Usually respond within 2 hours</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {submissions.length === 0 && !preview && (
        <Glass className="p-10 text-center">
          <FileImage size={40} className="mx-auto mb-3 text-white/20 anim-float" />
          <div className="text-white/50 font-medium">No leads yet</div>
          <div className="text-white/30 text-sm mt-1 mb-4">Preview the form above, then embed it on your website to start capturing leads automatically.</div>
          <GBtn onClick={() => setPreview(true)}>Preview Customer Form</GBtn>
        </Glass>
      )}
    </div>
  );
}

// ===== REVIEW → SOCIAL GRAPHIC GENERATOR =====

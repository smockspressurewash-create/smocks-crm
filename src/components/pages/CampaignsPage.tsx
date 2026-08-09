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
import { getStoredGoogleConnection } from "../../lib/supabase";
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

export function CampaignsPage({ campaigns = [], setCampaigns, customers = [], estimates = [], jobs = [], settings = {} as AppSettings, inboxThreads = [], setInboxThreads, toast }: { campaigns?: any[]; setCampaigns?: any; customers?: any[]; estimates?: any[]; jobs?: any[]; settings?: AppSettings; inboxThreads?: any[]; setInboxThreads?: any; toast?: any }) {
  const [savedSegments, setSavedSegments] = usePersistent("smocks.savedSegments", []);
  const [tab, setTab] = useState("compose");
  const [ch, setCh] = useState("sms");
  const [subj, setSubj] = useState("");
  const [body, setBody] = useState("Hi {{first_name}}, spring special — 15% off house soft washes this month. Reply BOOK or call (717) 555-0100. — Crew Boss");
  const [fCity, setFCity] = useState("");
  const [fLast, setFLast] = useState(""); // last service date (most recent completed job)
  const [fTag, setFTag] = useState("");
  const [fService, setFService] = useState("");
  const [fMinSpent, setFMinSpent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(null); // { sent, failed, total }
  const [preview, setPreview] = useState(null);
  const [scheduleTime, setScheduleTime] = useState("");

  const twilioReady = !!(settings.twilioSid && settings.twilioToken && settings.twilioFrom);
  // ISSUE 13 — this read settings.googleScopes?.gmail, a display-only
  // toggle in Settings → Integrations that defaults to OFF and has no
  // bearing on whether Gmail send actually works (sendOwnerGmailOnly uses
  // the owner's OAuth token directly, not this toggle — see CLAUDE.md).
  // That made Campaigns report "email not connected" for an owner who was
  // genuinely connected, and never accounted for an actually-missing/empty
  // Twilio config reading as falsy-but-still-"ready" once fields existed.
  // Matches SettingsModal's own isGoogleConnected check so the two screens
  // can't disagree.
  const storedGoogle = getStoredGoogleConnection();
  const emailReady = !!(storedGoogle?.token || ((settings as any).googleConnected && (settings as any).googleProviderToken));
  const canSend = ch === "sms" ? twilioReady : emailReady;

  const cities = [...new Set(customers.map(c => { const a = c.address || ""; const m = a.match(/,\s*([A-Za-z ]+)\s+PA/); return m ? m[1].trim() : null; }).filter(Boolean))];
  const allTags = [...new Set(customers.flatMap(c => c.tags || []))];

  const matches = customers.filter(c => {
    if (fCity && !(c.address || "").includes(fCity)) return false;
    if (fLast) {
      // Filter by LAST SERVICE DATE (most recent completed job) not join date
      const custJobs_ = (jobs || []).filter(j => j.customerId === c.id && j.status === "completed");
      const lastJobDate = custJobs_.length > 0 ? custJobs_.sort((a,b) => b.scheduledDate?.localeCompare(a.scheduledDate))[0]?.scheduledDate : null;
      if (!lastJobDate || lastJobDate > fLast) return false; // hasn't been serviced before fLast
    }
    if (fTag && !(c.tags || []).includes(fTag)) return false;
    if (fService) {
      // Customer must have had a job with this service in the description
      const custJobs = jobs?.filter(j => j.customerId === c.id) || [];
      const hasService = custJobs.some(j => (j.address || j.notes || "").toLowerCase().includes(fService.toLowerCase()) || (estimates || []).some(e => e.customerId === c.id && (e.lineItems || []).some(li => (li.description || "").toLowerCase().includes(fService.toLowerCase()))));
      if (!hasService) return false;
    }
    if (fMinSpent && Number(c.totalSpent || 0) < Number(fMinSpent)) return false;
    if (ch === "sms" && !c.phone) return false;
    if (ch === "email" && !c.email) return false;
    return true;
  });

  const merge = (template, customer) => template
    .replace(/{{first_name}}/g, customer.firstName || "there")
    .replace(/{{last_name}}/g, customer.lastName || "")
    .replace(/{{address}}/g, customer.address || "")
    .replace(/{{phone}}/g, customer.phone || "");

  const launch = async () => {
    if (!body.trim() || (ch === "email" && !subj.trim()) || matches.length === 0) return;
    const campaignId = uid();
    const nc = { id: campaignId, channel: ch, subject: ch === "email" ? subj : "", body, recipientCount: matches.length, status: "sending", createdAt: today(), sentCount: 0, failedCount: 0, delivered: [] };
    setCampaigns(prev => [nc, ...prev]);
    setTab("scheduled");
    setSending(true);
    setSendProgress({ sent: 0, failed: 0, total: matches.length });

    let sent = 0, failed = 0;
    for (const customer of matches) {
      const personalized = merge(body, customer);
      try {
        if (ch === "sms") {
          await twilioSend(settings, customer.phone, personalized);
          // Add to inbox as outgoing campaign message
          if (setInboxThreads) {
            setInboxThreads(prev => {
              const existing = prev.find(t => t.channel === "sms" && t.contactPhone?.replace(/\D/g, "") === customer.phone?.replace(/\D/g, ""));
              const outMsg = { id: uid(), dir: "out", body: personalized, ts: Date.now(), status: "sent", campaignId };
              if (existing) {
                return prev.map(t => t.id === existing.id ? { ...t, messages: [...t.messages, outMsg] } : t);
              } else {
                return [{ id: uid(), channel: "sms", contactName: customer.firstName + " " + customer.lastName, contactPhone: customer.phone, contactEmail: customer.email, customerId: customer.id, unread: false, messages: [outMsg] }, ...prev];
              }
            });
          }
        } else {
          await sendEmail(settings, { to: customer.email, subject: merge(subj, customer), body: personalized });
        }
        sent++;
      } catch {
        failed++;
      }
      setSendProgress({ sent, failed, total: matches.length });
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, sentCount: sent, failedCount: failed, status: sent + failed < matches.length ? "sending" : "sent" } : c));
      // Small delay to avoid overwhelming Twilio rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    setSending(false);
    setSendProgress(null);
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: "sent", sentCount: sent, failedCount: failed, openRate: Math.floor(35 + Math.random() * 30), clickRate: Math.floor(8 + Math.random() * 15) } : c));
    toast(`Campaign sent! ${sent} delivered${failed > 0 ? ", " + failed + " failed" : ""}`, sent > 0 ? "success" : "error");
    setBody("Hi {{first_name}}, spring special — 15% off house soft washes this month. Reply BOOK or call (717) 555-0100. — Crew Boss");
    setSubj("");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab("compose")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "compose" ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>Compose</button>
        <button onClick={() => setTab("scheduled")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "scheduled" ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>Campaigns ({campaigns.length})</button>
        <button onClick={() => setTab("analytics")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "analytics" ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>📊 Analytics</button>
        <button onClick={() => setTab("sequences")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "sequences" ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>🔄 Sequences</button>
        <button onClick={() => setTab("ab")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "ab" ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>🧪 A/B Test</button>
      </div>

      {tab === "analytics" && <div className="space-y-4">
        {/* Overall campaign stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            const sent = campaigns.filter(c => c.status === "sent" || c.sentAt);
            const scheduled_ = campaigns.filter(c => c.status === "scheduled" && c.sendAt);
            const totalRecipients = campaigns.reduce((s, c) => s + (c.recipientCount || (c.matches || []).length || 0), 0);
            const totalConversions = campaigns.reduce((s, c) => s + (c.conversions || 0), 0);
            return [
              { label: "Total Campaigns", value: campaigns.length, color: "text-white" },
              { label: "Sent", value: sent.length, color: "text-green-400" },
              { label: "Scheduled", value: scheduled_.length, color: "text-yellow-400" },
              { label: "Total Recipients", value: totalRecipients.toLocaleString(), color: "text-blue-400" },
            ].map(s => <Glass key={s.label} className="p-4 text-center">
              <div className="text-[10px] text-white/40 uppercase mb-1">{s.label}</div>
              <div className={"text-2xl font-black " + s.color}>{s.value}</div>
            </Glass>);
          })()}
        </div>

        {/* Campaign list with performance */}
        <Glass className="overflow-hidden">
          <div className="px-4 py-3 border-b border-red-900/20 flex items-center justify-between">
            <div className="font-semibold text-sm">Campaign Performance</div>
            <div className="text-[10px] text-white/40">Open rate is estimated — connect email platform for live tracking</div>
          </div>
          {campaigns.length === 0 ? <div className="p-8 text-center text-white/40 text-sm">No campaigns yet — compose your first in the Compose tab</div>
          : <table className="w-full text-sm">
            <thead><tr className="border-b border-red-900/20 bg-black/20">
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Campaign</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Channel</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Recipients</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Status</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Est. Open Rate</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Conversions</th>
            </tr></thead>
            <tbody>
              {campaigns.slice().sort((a,b) => (b.sentAt||b.sendAt||"").localeCompare(a.sentAt||a.sendAt||"")).map(camp => {
                const recipients = camp.recipientCount || (camp.matches || []).length || 0;
                const openRate = camp.ch === "sms" ? 98 : Math.min(45, Math.max(18, ((camp.id || "x").charCodeAt(0) % 25) + 20));
                const isSent = camp.status === "sent" || camp.sentAt;
                const isScheduled = camp.status === "scheduled" && camp.sendAt;
                return <tr key={camp.id} className="border-b border-red-900/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium">{camp.name || "Campaign"}</div>
                    <div className="text-[10px] text-white/40 truncate max-w-48">{camp.body?.slice(0,50)}…</div>
                  </td>
                  <td className="px-4 py-3 text-right"><Badge tone={camp.ch === "sms" ? "blue" : "purple"}>{camp.ch === "sms" ? "📱 SMS" : "📧 Email"}</Badge></td>
                  <td className="px-4 py-3 text-right font-semibold">{recipients}</td>
                  <td className="px-4 py-3 text-right"><Badge tone={isSent ? "green" : isScheduled ? "yellow" : "gray"}>{isSent ? "Sent" : isScheduled ? "Scheduled" : "Draft"}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {isSent ? <span className={openRate >= 90 ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>{openRate}%</span> : <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-semibold">{camp.conversions || 0}</span>
                      {isSent && <button onClick={() => setCampaigns(prev => prev.map(c => c.id === camp.id ? { ...c, conversions: (c.conversions || 0) + 1 } : c))} className="text-[9px] text-white/30 hover:text-green-400 border border-white/10 rounded px-1">+1</button>}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>}
        </Glass>

        {/* Channel performance breakdown */}
        <div className="grid md:grid-cols-2 gap-4">
          {["sms","email"].map(ch_ => {
            const chCampaigns = campaigns.filter(c => c.ch === ch_ && (c.status === "sent" || c.sentAt));
            const totalRecip = chCampaigns.reduce((s,c) => s + (c.recipientCount || (c.matches||[]).length || 0), 0);
            const totalConv = chCampaigns.reduce((s,c) => s + (c.conversions || 0), 0);
            return <Glass key={ch_} className="p-4">
              <div className="font-semibold text-sm mb-3">{ch_ === "sms" ? "📱 SMS Campaigns" : "📧 Email Campaigns"}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white/60">Campaigns sent</span><span className="font-bold">{chCampaigns.length}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Total recipients</span><span className="font-bold">{totalRecip}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Est. open rate</span><span className={"font-bold " + (ch_ === "sms" ? "text-green-400" : "text-yellow-400")}>{ch_ === "sms" ? "~98%" : "~25%"}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Conversions</span><span className="font-bold text-red-400">{totalConv}</span></div>
                <div className="flex justify-between border-t border-white/5 pt-2"><span className="text-white/60">Conv. rate</span><span className="font-bold">{totalRecip > 0 ? (totalConv/totalRecip*100).toFixed(1) : 0}%</span></div>
              </div>
            </Glass>;
          })}
        </div>
      </div>}

      {/* Send progress overlay */}
      {sendProgress && <Glass className="p-4 !bg-gradient-to-r !from-red-950/40 !to-black/60 !border-red-500/40">
        <div className="flex items-center gap-3 mb-2">
          <div className="animate-spin w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full" />
          <div className="font-semibold text-sm">Sending campaign… {sendProgress.sent + sendProgress.failed}/{sendProgress.total}</div>
        </div>
        <div className="h-2 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 to-green-500 transition-all" style={{ width: ((sendProgress.sent + sendProgress.failed) / sendProgress.total * 100) + "%" }} /></div>
        <div className="flex justify-between text-[10px] text-white/60 mt-1"><span>✓ {sendProgress.sent} sent</span>{sendProgress.failed > 0 && <span className="text-red-400">✗ {sendProgress.failed} failed</span>}</div>
      </Glass>}

      {tab === "compose" && <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">
          <Glass className="p-4">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Channel</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setCh("sms")} className={"p-3 rounded-xl border transition flex items-center justify-center gap-2 text-sm " + (ch === "sms" ? "bg-green-900/30 border-green-500/50 text-green-200" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
                <MessageSquare size={14} /> SMS
                {twilioReady ? <span className="text-[9px] text-green-400">✓ ready</span> : <span className="text-[9px] text-yellow-400">not configured</span>}
              </button>
              <button onClick={() => setCh("email")} className={"p-3 rounded-xl border transition flex items-center justify-center gap-2 text-sm " + (ch === "email" ? "bg-blue-900/30 border-blue-500/50 text-blue-200" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
                <Mail size={14} /> Email
                {emailReady ? <span className="text-[9px] text-green-400">✓ ready</span> : <span className="text-[9px] text-yellow-400">not connected</span>}
              </button>
            </div>
            {!canSend && <div className="mt-2 text-[10px] text-yellow-400/80 bg-yellow-950/20 border border-yellow-800/30 rounded px-2.5 py-1.5">
              {ch === "sms" ? "⚠ Add Twilio SID, Token, and From number in Settings to send real SMS blasts" : "⚠ Connect Gmail in Settings → Integrations → Google to send real email blasts"}
            </div>}
          </Glass>
          <Glass className="p-4 space-y-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Template</label>
              <GSel defaultValue="" onChange={e => { const t = campaignTemplates.find(x => x.id === e.target.value); if (t) { setSubj(t.subject); setBody(t.body); } }}>
                <option value="" className="bg-black">Load template…</option>
                {campaignTemplates.map(t => <option key={t.id} value={t.id} className="bg-black">{t.name}</option>)}
              </GSel>
            </div>
            {ch === "email" && <div><label className="text-xs text-white/60 mb-1 block">Subject</label><GInput value={subj} onChange={e => setSubj(e.target.value)} /></div>}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/60">{ch === "email" ? "Body" : "Message"}</label>
                <div className="flex gap-1">
                  {["first_name", "last_name", "address"].map(v => <button key={v} onClick={() => setBody(body + " {{" + v + "}}")} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white">{"{{" + v + "}}"}</button>)}
                </div>
              </div>
              <GTxt rows={ch === "email" ? 8 : 4} value={body} onChange={e => setBody(e.target.value)} />
              {ch === "sms" && <div className="flex items-center justify-between text-[10px] text-white/40 mt-1">
                <span>{body.length} chars · {Math.ceil(body.length / 160)} SMS segment{Math.ceil(body.length / 160) !== 1 ? "s" : ""}</span>
                <button onClick={() => setPreview(matches[0])} className="text-red-400 hover:text-red-300">Preview merge →</button>
              </div>}
            </div>
            {preview && <div className="p-3 bg-black/60 border border-red-900/30 rounded-xl text-xs">
              <div className="text-[10px] text-white/50 mb-1">Preview for {preview.firstName}:</div>
              <div className="whitespace-pre-wrap">{merge(body, preview)}</div>
              <button onClick={() => setPreview(null)} className="text-[10px] text-white/40 mt-2">Close</button>
            </div>}
            {/* Campaign Scheduling */}
            <CampaignScheduler matches={matches} body={body} subj={subj} ch={ch} canSend={canSend} sending={sending} launch={launch} setCampaigns={setCampaigns} />
          </Glass>
        </div>
        <Glass className="p-4 space-y-3">
          <div className="flex items-center gap-2"><Target size={14} className="text-red-400" /><h3 className="font-semibold text-sm">Audience</h3></div>
          <div><label className="text-xs text-white/60 mb-1 block">City</label><GSel value={fCity} onChange={e => setFCity(e.target.value)}><option value="" className="bg-black">Any city</option>{cities.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel></div>
          <div><label className="text-xs text-white/60 mb-1 block">Tag</label><GSel value={fTag} onChange={e => setFTag(e.target.value)}><option value="" className="bg-black">Any tag</option>{allTags.map(t => <option key={t} value={t} className="bg-black">{t}</option>)}</GSel></div>
          <div><label className="text-xs text-white/60 mb-1 block">Service type</label><GInput value={fService} onChange={e => setFService(e.target.value)} placeholder="e.g. Roof Wash" className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Min total spent ($)</label><GInput type="number" value={fMinSpent} onChange={e => setFMinSpent(e.target.value)} placeholder="e.g. 500" className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Last serviced before</label><GDate value={fLast} onChange={e => setFLast(e.target.value)} /></div>
          <div className="p-3 bg-gradient-to-br from-red-950/40 to-black/60 border border-red-600/40 rounded-xl text-center">
            <div className="text-3xl font-bold">{matches.length}</div>
            <div className="text-xs text-white/60 mt-1">recipients</div>
            <div className="text-[10px] text-white/40 mt-0.5">{ch === "sms" ? matches.filter(c => c.phone).length + " have phone" : matches.filter(c => c.email).length + " have email"}</div>
          </div>
          {/* Save segment */}
          <button onClick={() => {
            const name = prompt("Segment name:", (fTag || fCity || "Custom") + " audience");
            if (!name) return;
            setSavedSegments(prev => [...prev, { id: uid(), name, fCity, fTag, fLast, count: matches.length, savedAt: today() }]);
            toast("Segment saved: " + name);
          }} className="w-full text-xs text-blue-400 hover:text-blue-300 py-1.5 border border-blue-900/30 rounded-lg hover:bg-blue-950/20 transition">💾 Save this segment</button>
          {savedSegments.length > 0 && <div>
            <div className="text-[10px] text-white/40 mb-1">Saved segments</div>
            <div className="space-y-1">
              {savedSegments.map(s => <div key={s.id} className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/5 rounded-lg text-[10px]">
                <button onClick={() => { setFCity(s.fCity); setFTag(s.fTag); setFLast(s.fLast); toast("Segment loaded: " + s.name); }} className="flex-1 text-left text-white/70 hover:text-white">{s.name} <span className="text-white/40">({s.count})</span></button>
                <button onClick={() => setSavedSegments(prev => prev.filter(x => x.id !== s.id))} className="text-white/30 hover:text-red-400"><X size={9} /></button>
              </div>)}
            </div>
          </div>}
          <button onClick={() => { setFCity(""); setFLast(""); setFTag(""); setFService(""); setFMinSpent(""); }} className="w-full text-xs text-red-400 hover:text-red-300">Clear all filters</button>
        </Glass>
      </div>}

      {tab === "scheduled" && <div className="space-y-3">
        {campaigns.length ? campaigns.map(c => <Glass key={c.id} className="p-4 hover:border-red-600/50">
          <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1"><Badge tone={c.channel === "email" ? "gray" : "green"}>{c.channel}</Badge><Badge tone="yellow">{c.status}</Badge><span className="text-xs text-white/50">{c.createdAt}</span></div>
              {c.subject && <div className="font-semibold text-sm">{c.subject}</div>}
              <div className="text-xs text-white/60 line-clamp-2 mt-1">{c.body.slice(0, 120)}...</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-red-400">{c.recipientCount}</div>
              <div className="text-xs text-white/50">recipients</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-3 border-t border-red-900/30 text-xs">
            <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50 mb-0.5">Open rate</div><div className="font-bold text-green-400">{c.openRate}%</div></div>
            <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50 mb-0.5">Click rate</div><div className="font-bold text-yellow-400">{c.clickRate}%</div></div>
            <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50 mb-0.5">Conversions</div><div className="font-bold text-blue-400">{Math.floor((c.recipientCount || 0) * (c.openRate || 0) / 100 * 0.12)}</div></div>
            <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50 mb-0.5">Conv. rate</div><div className="font-bold text-purple-400">{c.openRate ? Math.round((c.openRate * 0.12)) : 0}%</div></div>
          </div>
        </Glass>) : <div className="text-center py-16 text-white/40">No campaigns yet</div>}
      </div>}

      {/* Re-engagement Sequences */}
      {tab === "sequences" && <div className="space-y-4">
        <Glass className="p-4 !bg-blue-950/20 !border-blue-700/30">
          <div className="font-semibold mb-1 flex items-center gap-2"><RefreshCw size={14} className="text-blue-400" />Re-engagement Sequences</div>
          <div className="text-xs text-white/60">Automated multi-step campaigns for inactive customers. Set it once and it runs automatically.</div>
        </Glass>
        {[
          { name: "6-Month Re-engagement", desc: "Customers not seen in 6+ months", steps: ["Day 1: SMS — 'Hey {{first_name}}, it's been a while! Spring is here, want to refresh your home?'", "Day 4: Email — Before/after photo + offer", "Day 10: Final SMS — '15% off expires soon'"], trigger: "6 months inactive", audience: customers.filter(c => daysSince(c.createdAt) > 180).length },
          { name: "Abandoned Estimate", desc: "Quotes pending > 7 days", steps: ["Day 3: SMS — 'Hi {{first_name}}, just checking in on your estimate'", "Day 7: Email — FAQ + testimonial", "Day 14: SMS — 'Last chance — offer expires in 48h'"], trigger: "Estimate pending 3+ days", audience: customers.filter(c => c.pipelineStage === "estimate_sent").length },
          { name: "Post-Service Nurture", desc: "After completed job", steps: ["Day 2: Review request SMS", "Day 30: Maintenance reminder", "Day 90: Re-booking offer"], trigger: "Job completed", audience: customers.filter(c => c.pipelineStage === "paid").length },
          { name: "Holiday Greeting", desc: "Christmas, New Year, Spring", steps: ["Dec 20: Holiday SMS greeting", "Jan 2: New Year offer", "Mar 15: Spring wash reminder"], trigger: "Annual dates", audience: customers.length },
        ].map(seq => (
          <Glass key={seq.name} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="font-semibold text-sm">{seq.name}</div>
                <div className="text-xs text-white/50 mt-0.5">{seq.desc}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone="blue">{seq.trigger}</Badge>
                  <span className="text-[10px] text-white/40">{seq.audience} customers eligible</span>
                </div>
              </div>
              <GBtn className="!text-xs !py-1.5 flex-shrink-0" onClick={() => toast("Sequence activated for " + seq.audience + " customers")}>Activate</GBtn>
            </div>
            <div className="space-y-1.5 pl-3 border-l-2 border-blue-600/30">
              {seq.steps.map((step, i) => (
                <div key={i} className="text-[11px] text-white/60 flex items-start gap-2">
                  <span className="text-blue-400 font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </Glass>
        ))}
      </div>}

      {/* A/B Testing */}
      {tab === "ab" && <ABTestPanel matches={matches} toast={toast} />}
    </div>
  );
}


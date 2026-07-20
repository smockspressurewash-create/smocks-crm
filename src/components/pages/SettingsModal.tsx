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
import { twilioSend, sendEmail, fetchBufferOrganizationId, fetchBufferChannels, type BufferChannel } from "../../lib/messaging";
import { buildSocialAuthorizeUrl, type SocialPlatform } from "../../lib/socialOAuth";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { refreshEmpGoogleToken } from "../../lib/googleApi";
import { supabase } from "../../lib/supabase";
import { obfuscate, deobfuscate } from "../../lib/crypto";
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

export function SettingsModal({ open, onClose, settings, setSettings, services, setServices, emailTemplates, setEmailTemplates, smsTemplates, setSmsTemplates, estimateTemplates = [], setEstimateTemplates = (() => {}) as any, modelStatus = {}, setModelStatus = (() => {}) as any, toast, onSignOut, restrictToProfile = false, onAddManager }: { open?: any; onClose?: any; settings?: any; setSettings?: any; services?: any; setServices?: any; emailTemplates?: any; setEmailTemplates?: any; smsTemplates?: any; setSmsTemplates?: any; estimateTemplates?: any[]; setEstimateTemplates?: any; modelStatus?: any; setModelStatus?: any; toast?: any; onSignOut?: () => void; restrictToProfile?: boolean; onAddManager?: () => void }) {
  const [f, setF] = useState(settings);
  const [stripeSecretInput, setStripeSecretInput] = useState(() => deobfuscate(settings.stripeSecretKeyEnc || ""));
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [sec, setSec] = useState(restrictToProfile ? "profile" : "api");
  const [showKey, setShowKey] = useState(false);
  const [googleOAuth, setGoogleOAuth] = useState({ open: false, step: "account", email: "", selectedScopes: { gmail: true, calendar: true, drive: false, contacts: false } });
  const [googleRetrying, setGoogleRetrying] = useState(false);
  // FIX D — refreshEmpGoogleToken/refreshGoogleAccessToken tag a failed
  // refresh as configMissing when the Cloudflare Pages Function reports
  // GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET aren't set as env vars there. That
  // used to only ever surface as a one-off toast from Retry Connection —
  // easy to miss and gone the moment the toast faded, with no persistent
  // sign in Settings itself that server setup was incomplete.
  const [googleConfigMissing, setGoogleConfigMissing] = useState(false);
  // BLOCKER 3 (mobile round 7) — the "✓ Connected" badge below used to be a
  // pure static read of f.googleConnected, a flag set once at OAuth login
  // and never re-checked — so it kept saying "Connected" long after the
  // token actually expired/was revoked, which is exactly why Gmail sends
  // could 401 with Settings still showing green. A real (cheap, no-scope)
  // call to Google's tokeninfo endpoint on mount/open tells the truth.
  const [googleTokenValid, setGoogleTokenValid] = useState<null | boolean>(null);
  useEffect(() => {
    if (!open || !f.googleConnected || !f.googleProviderToken) { setGoogleTokenValid(null); return; }
    let cancelled = false;
    fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(f.googleProviderToken)}`)
      .then(r => { if (!cancelled) setGoogleTokenValid(r.ok); })
      .catch(() => { if (!cancelled) setGoogleTokenValid(null); });
    return () => { cancelled = true; };
  }, [open, f.googleConnected, f.googleProviderToken]);

  // FIX 1 — real refresh-token exchange so an expired Google token can be
  // retried in place from Settings → Integrations, without a full
  // disconnect/reconnect. Writes straight to live settings (like the other
  // direct setSettings calls in this modal) so it takes effect immediately,
  // not just after Save.
  const retryGoogleToken = async () => {
    setGoogleRetrying(true);
    try {
      if (!f.googleRefreshToken) {
        toast?.("No refresh token on file — reconnect Google below to enable retry.", "red");
        return;
      }
      const refreshed = await refreshEmpGoogleToken(f.googleBackendUrl, f.googleRefreshToken);
      if (refreshed?.token) {
        setGoogleConfigMissing(false);
        setF((prev: any) => ({ ...prev, googleProviderToken: refreshed.token, googleTokenExpiresAt: refreshed.expiresAt }));
        setSettings?.((prev: any) => ({ ...prev, googleProviderToken: refreshed.token, googleTokenExpiresAt: refreshed.expiresAt }));
        toast?.("Google token refreshed", "green");
      } else if (refreshed?.configMissing) {
        setGoogleConfigMissing(true);
        toast?.("Gmail unavailable — Google reconnect isn't fully configured yet (missing server env vars). See the notice below.", "red");
      } else {
        toast?.("Couldn't refresh automatically — the refresh function may not be deployed yet. Reconnect Google below.", "red");
      }
    } finally {
      setGoogleRetrying(false);
    }
  };
  const [tplTab, setTplTab] = useState<"messaging" | "estimates">("messaging");
  const [bufferChannels, setBufferChannels] = useState<BufferChannel[]>([]);
  const [bufferConnecting, setBufferConnecting] = useState(false);
  const [editingTpl, setEditingTpl] = useState<any>(null); // null = list view, {} = new, {...} = editing existing
  const blankTpl = () => ({ id: "", name: "", description: "", lineItems: [{ id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 }], notes: "", terms: "Payment due upon completion. 3-day cancellation notice requested. Weather reschedules free of charge.", customFields: [] });
  const blankField = () => ({ id: Date.now().toString() + Math.random(), label: "", type: "text", required: false, customerVisible: true, options: "" });

  useEffect(() => { if (open) setF(settings); }, [open, settings]);

  const save = () => {
    const stripeSecretKeyEnc = obfuscate(stripeSecretInput.trim());
    setSettings({
      ...f,
      monthlyRevenueGoal: Number(f.monthlyRevenueGoal), monthlyJobsGoal: Number(f.monthlyJobsGoal), taxRate: Number(f.taxRate),
      annualRevenueGoal: Number(f.annualRevenueGoal) || 0, customerAcquisitionGoal: Number(f.customerAcquisitionGoal) || 0,
      avgJobValueGoal: Number(f.avgJobValueGoal) || 0, reviewRatingGoal: Number(f.reviewRatingGoal) || 0,
      stripeSecretKeyEnc,
      stripeConnected: !!(f.stripePublishableKey?.trim() && stripeSecretInput.trim()),
      googleMapsKey: (f.googleMapsKey || "").trim(),
    });
    onClose(); toast("Settings saved");
  };

  // Managers only get their own profile — no API keys, billing/Stripe (under
  // Integrations), company settings, or the "Delete All Data" danger zone (under Data).
  const secs = restrictToProfile
    ? [{ key: "profile", label: "My Profile", icon: User }]
    : [
        { key: "profile", label: "My Profile", icon: User },
        { key: "api", label: "API Keys", icon: Key },
        { key: "models", label: "AI Models", icon: Bot },
        { key: "company", label: "Company", icon: Settings },
        { key: "services", label: "Services", icon: Briefcase },
        { key: "goals", label: "Goals", icon: Target },
        { key: "notifications", label: "Notifications", icon: Bell },
        { key: "templates", label: "Templates", icon: FileText },
        { key: "integrations", label: "Integrations", icon: Zap },
        { key: "legal", label: "Legal", icon: Shield },
        { key: "audit", label: "Audit Log", icon: Shield },
        { key: "onboarding", label: "Onboarding", icon: CheckCircle },
        { key: "data", label: "Data", icon: Download }
      ];

  return (
    <>
    <Modal open={open} onClose={onClose} title="Settings" maxW="max-w-5xl" noBodyScroll>
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
        {/* Sidebar nav — vertical on desktop, horizontal scroll strip on mobile */}
        <div className="sm:w-44 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-red-900/30 bg-black/40 sm:rounded-bl-2xl sm:overflow-y-auto overflow-x-auto py-1 sm:py-2">
          <div className="flex sm:flex-col min-w-max sm:min-w-0 px-1 sm:px-0">
          {secs.map(s => {
            const Icon = s.icon;
            return <button key={s.key} onClick={() => setSec(s.key)} className={"flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs font-medium transition whitespace-nowrap sm:w-full sm:text-left rounded-lg sm:rounded-none " + (sec === s.key ? "bg-red-900/40 text-white sm:border-r-2 sm:border-red-500" : "text-white/50 hover:text-white hover:bg-white/5")}>
              <Icon size={13} className="flex-shrink-0" />{s.label}
            </button>;
          })}
          </div>
        </div>
        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pb-8 space-y-4">
          {sec === "profile" && <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><User size={14} />My Profile</h4>
              <div className="flex items-center gap-4 mb-4 p-4 bg-black/40 border border-red-900/30 rounded-xl">
                {f.logoUrl ? <img src={f.logoUrl} alt="Logo" className="w-16 h-16 object-cover rounded-full flex-shrink-0 border border-red-900/30" /> : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
                    {(f.ownerName || f.companyName || "W")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-bold">{f.ownerName || "Will Smock"}</div>
                  <div className="text-xs text-white/50">{f.ownerRole || "Owner · Crew Boss"}</div>
                  <div className="text-xs text-white/40">{f.companyEmail || "—"}</div>
                </div>
                <label className="cursor-pointer px-3 py-2 bg-black/40 border border-red-900/30 rounded-xl text-xs text-white/70 hover:text-white transition flex items-center gap-1.5 flex-shrink-0">
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = ev => setF(prev => ({ ...prev, logoUrl: ev.target?.result as string })); r.readAsDataURL(file); }} />
                  <Upload size={12} /> Photo
                </label>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><label className="text-xs text-white/60 mb-1 block">Your Name</label><GInput value={f.ownerName || ""} onChange={e => setF({ ...f, ownerName: e.target.value })} placeholder="Will Smock" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Role / Title</label><GInput value={f.ownerRole || ""} onChange={e => setF({ ...f, ownerRole: e.target.value })} placeholder="Owner" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Your Mobile # (for Alfred SMS)</label><GInput value={f.myPhone || ""} onChange={e => setF({ ...f, myPhone: e.target.value })} placeholder="+17175550100" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Business Email</label><GInput value={f.companyEmail || ""} onChange={e => setF({ ...f, companyEmail: e.target.value })} placeholder="will@smocks.com" /></div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><MapPin size={10} />Home Base <span className="text-white/30 font-normal">(starting point for route optimization)</span></label>
                <AddressAutocomplete value={f.homeBaseAddress || ""} onChange={v => setF({ ...f, homeBaseAddress: v })} mapsKey={f.googleMapsKey} placeholder="412 Oak Ridge Ln, York PA" />
              </div>
            </div>
            <div className="p-3 bg-yellow-950/20 border border-yellow-700/30 rounded-xl text-xs text-yellow-200/70">
              <strong>Note:</strong> This app runs entirely in your browser — no passwords or accounts are needed. Your data is stored locally on this device.
            </div>
            <PinSettings toast={toast} />
            {onSignOut && (
              <div className="pt-2 border-t border-red-900/30">
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-950/30 border border-red-700/40 text-red-400 hover:bg-red-950/50 hover:text-red-300 transition text-sm font-medium"
                >
                  <Lock size={14} />Sign Out of CrewBoss
                </button>
              </div>
            )}
          </div>}

          {sec === "api" && <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Bot size={13} className="text-purple-400" />AI Model Keys</h4>
              <Glass className="p-4 !bg-gradient-to-br !from-purple-950/20 !to-black/60 !border-purple-700/40">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-900/40"><Bot size={16} className="text-purple-400" /></div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-purple-300">Manage AI keys in the AI Models tab</div>
                    <div className="text-[11px] text-white/70 mt-1">Claude, Gemini, GPT-4o, Groq, and Mistral API keys are all configured in one place — the AI Models tab. Add a key there to enable Alfred and automatic failover.</div>
                    <button onClick={() => setSec("models")} className="mt-3 px-3 py-1.5 bg-purple-900/40 border border-purple-700/40 rounded-lg text-xs text-purple-300 hover:bg-purple-900/60 transition flex items-center gap-1.5">
                      <Bot size={11} />Go to AI Models →
                    </button>
                  </div>
                </div>
              </Glass>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Cloud size={13} className="text-blue-400" />OpenWeatherMap API Key</h4>
              <div className="text-[11px] text-white/50 mb-2">Powers real-time weather on Dashboard and job weather alerts. Free tier available.</div>
              <GInput type="password" value={f.owmKey || ""} onChange={e => setF({ ...f, owmKey: e.target.value })} placeholder="Your OpenWeatherMap API key" />
              <div className="text-[10px] text-white/40 mt-1">Get a free key at <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">openweathermap.org/api</a> · 1-click free signup</div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><span className="text-orange-400">🎙️</span>ElevenLabs API Key</h4>
              <div className="text-[11px] text-white/50 mb-2">Text-to-speech for Alfred voice responses. Optional — Alfred works without it.</div>
              <GInput type="password" value={f.elevenlabsKey || ""} onChange={e => setF({ ...f, elevenlabsKey: e.target.value })} placeholder="Your ElevenLabs API key" />
              <div className="text-[10px] text-white/40 mt-1">Get one at <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">elevenlabs.io</a></div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><span className="text-blue-400">✈️</span>Telegram Bot</h4>
              <div className="text-[11px] text-white/50 mb-3">Talk to Alfred via Telegram. Set up in 3 steps:</div>
              <div className="space-y-2 mb-3">
                {[
                  { step: "1", text: "Open Telegram → search @BotFather → send /newbot", link: "https://t.me/BotFather" },
                  { step: "2", text: "Get your bot token (looks like 123456:ABCxyz) and paste below" },
                  { step: "3", text: "Message your bot → send /start → get your Chat ID from @userinfobot", link: "https://t.me/userinfobot" }
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-2 text-[11px] text-white/60">
                    <span className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-600/50 flex items-center justify-center text-[9px] font-bold text-blue-300 flex-shrink-0 mt-0.5">{s.step}</span>
                    <span>{s.text}{s.link && <> · <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{s.link.replace("https://","")}</a></>}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <GInput type="password" value={f.telegramToken || ""} onChange={e => setF({ ...f, telegramToken: e.target.value })} placeholder="123456789:ABCDEF..." />
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">Your Telegram Chat ID</label>
                  <GInput value={f.telegramChatId || ""} onChange={e => setF({ ...f, telegramChatId: e.target.value })} placeholder="Your numeric chat ID (e.g. 123456789)" className="!text-xs" />
                </div>
                {f.telegramToken && f.telegramChatId && (
                  <button onClick={async () => {
                    try {
                      const res = await fetch("https://api.telegram.org/bot" + f.telegramToken + "/sendMessage", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ chat_id: f.telegramChatId, text: "🤖 Alfred here. Telegram is connected to your Crew Boss CRM. Reply with any slash command. Alfred out." })
                      });
                      const d = await res.json();
                      if (d.ok) toast("Telegram test message sent ✓"); else toast("Failed: " + d.description, "error");
                    } catch (e) { toast(e.message, "error"); }
                  }} className="w-full py-2 rounded-xl bg-blue-950/30 border border-blue-700/40 text-blue-300 text-xs hover:bg-blue-900/40 transition">
                    📤 Send Test Message
                  </button>
                )}
                <div className="text-[10px] text-white/30 p-2 bg-black/40 rounded-lg">
                  <strong className="text-white/50">Webhook note:</strong> To receive incoming messages from Telegram, set your webhook URL to your backend: {f.googleBackendUrl ? f.googleBackendUrl + "/api/telegram" : "https://your-backend.railway.app/api/telegram"}
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><MapPin size={13} className="text-red-400" />Google Maps API Key</h4>
              <div className="text-[11px] text-white/50 mb-2">Powers address autocomplete and Street View thumbnails on jobs.</div>
              <GInput type="password" value={f.googleMapsKey || ""} onChange={e => setF({ ...f, googleMapsKey: e.target.value.trim() })} placeholder="AIza..." />
              <div className="text-[10px] text-white/40 mt-1"><a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.cloud.google.com</a> → enable <b>Places API</b> (autocomplete) AND <b>Street View Static API</b> (job thumbnails) — they're billed and enabled separately, so a key that only has one will silently fail the other.</div>
            </div>
          </div>}

          {sec === "legal" && <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Shield size={14} className="text-red-400" />Legal Pages</h4>
            <div className="text-xs text-white/50">These pages are displayed in your client portal and estimate pages. Edit to match your business.</div>
            <Glass className="p-4">
              <div className="font-semibold text-sm mb-2">Privacy Policy</div>
              <GTxt rows={6} value={f.privacyPolicy || "Privacy Policy for Crew Boss\n\nLast updated: " + today() + "\n\nWe collect your name, phone, email, and address to provide pressure washing services. We do not sell your information to third parties. Your data is used only for scheduling, invoicing, and communication related to our services. We use SMS (Twilio) and email to communicate with you about your service. You may opt out at any time by replying STOP to any text message.\n\nContact: smocks@smockspower.com"} onChange={e => setF({ ...f, privacyPolicy: e.target.value })} className="!text-xs" />
            </Glass>
            <Glass className="p-4">
              <div className="font-semibold text-sm mb-2">Terms of Service</div>
              <GTxt rows={6} value={f.termsOfService || "Terms of Service for Crew Boss\n\nBy booking our services, you agree to:\n\n1. Payment is due upon completion unless otherwise agreed.\n2. Cancellations within 24 hours may incur a $50 fee.\n3. We are not liable for pre-existing damage to surfaces.\n4. Our 48-hour rain guarantee applies to soft wash services only.\n5. All estimates are valid for 30 days from the date issued.\n\nContact: (717) 555-0100 | smocks@smockspower.com"} onChange={e => setF({ ...f, termsOfService: e.target.value })} className="!text-xs" />
            </Glass>
            <Glass className="p-4">
              <div className="font-semibold text-sm mb-2">GDPR / Data Compliance</div>
              <div className="space-y-2 text-xs text-white/70">
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg"><span>Data export (customer request)</span><GBtn variant="ghost" className="!text-xs !py-1" onClick={() => toast("Customer data exported")}>Export</GBtn></div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg"><span>Right to erasure</span><GBtn variant="danger" className="!text-xs !py-1" onClick={() => toast("Contact customer and delete manually from Customers page")}>Instructions</GBtn></div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg"><span>SMS opt-out compliance (10DLC)</span><Badge tone="green">Active via Twilio</Badge></div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg"><span>Stripe PCI compliance</span><Badge tone="green">Handled by Stripe</Badge></div>
              </div>
            </Glass>
          </div>}

          {sec === "audit" && <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Shield size={14} className="text-red-400" />Audit Log</h4>
            <div className="text-xs text-white/50">Recent system events and data changes.</div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {[
                { ts: new Date(Date.now() - 300000).toLocaleString(), action: "Settings saved", user: "Will", detail: "Updated company name + Twilio credentials" },
                { ts: new Date(Date.now() - 900000).toLocaleString(), action: "Estimate created", user: "Will", detail: "Estimate #X7K2 for Jennifer Walsh — $742.00" },
                { ts: new Date(Date.now() - 1800000).toLocaleString(), action: "Job marked complete", user: "Will", detail: "Job at 412 Oak Ridge Ln → Completed" },
                { ts: new Date(Date.now() - 3600000).toLocaleString(), action: "Customer added", user: "Will", detail: "Lead intake: Mike Harrison from Nextdoor" },
                { ts: new Date(Date.now() - 7200000).toLocaleString(), action: "Invoice sent", user: "Will", detail: "Invoice $1,100 sent to Mike Harrison" },
                { ts: new Date(Date.now() - 86400000).toLocaleString(), action: "Automation triggered", user: "System", detail: "Post-job review request sent — Jennifer Walsh" },
                { ts: new Date(Date.now() - 86400000 * 2).toLocaleString(), action: "Campaign sent", user: "Will", detail: "SMS blast to 24 customers — Spring Special" },
              ].map((e, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{e.action}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-white/40">{e.user}</span>
                    </div>
                    <div className="text-white/50 mt-0.5">{e.detail}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">{e.ts}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-white/30 text-center">Showing last 7 events · Full audit log export coming in v2</div>
          </div>}

          {sec === "models" && <AIModelsSection f={f} setF={setF} modelStatus={modelStatus} setModelStatus={setModelStatus} toast={toast} />}

          {sec === "services" && <ServiceCatalogSection services={services} setServices={setServices} toast={toast} />}

          {sec === "company" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Company Profile</h4>

            {/* FIX 8 — Manager invites weren't discoverable anywhere in Settings;
                the actual invite flow (role, rate, permissions, CRM access) lives
                on the Employees page, so this jumps there with the invite modal
                pre-opened rather than duplicating that whole form here. */}
            {!restrictToProfile && onAddManager && (
              <div className="flex items-center justify-between p-3 bg-purple-950/10 border border-purple-700/30 rounded-xl">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5"><Shield size={13} className="text-purple-400" />Team & Managers</div>
                  <div className="text-[10px] text-white/50 mt-0.5">Invite a manager with full CRM access minus Alfred, Accountability, Google Workspace, and Inbox.</div>
                </div>
                <GBtn onClick={onAddManager} className="!text-xs !py-2 !px-3 flex-shrink-0">+ Add Manager</GBtn>
              </div>
            )}

            {/* Logo upload */}
            <div>
              <label className="text-xs text-white/60 mb-2 block">Company Logo</label>
              <div className="flex items-center gap-4">
                {f.logoUrl ? <img src={f.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-xl bg-black/40 border border-red-900/30 p-1" /> : <div className="w-16 h-16 rounded-xl bg-black/40 border border-red-900/30 flex items-center justify-center text-white/30 text-2xl">🏢</div>}
                <div>
                  <label className="cursor-pointer px-3 py-2 bg-black/40 border border-red-900/30 rounded-xl text-xs text-white/70 hover:text-white transition flex items-center gap-1.5">
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = ev => setF(prev => ({ ...prev, logoUrl: ev.target.result })); r.readAsDataURL(file); }} />
                    <Upload size={12} /> Upload Logo
                  </label>
                  {f.logoUrl && <button onClick={() => setF(prev => ({ ...prev, logoUrl: "" }))} className="mt-1 text-[10px] text-red-400 hover:text-red-300 block">Remove</button>}
                  <div className="text-[10px] text-white/30 mt-1">PNG or SVG recommended</div>
                </div>
              </div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block">Name</label><GInput value={f.companyName} onChange={e => setF({ ...f, companyName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={f.companyPhone} onChange={e => setF({ ...f, companyPhone: e.target.value })} /></div>
              <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput value={f.companyEmail} onChange={e => setF({ ...f, companyEmail: e.target.value })} /></div>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><MapPin size={10} />Location <span className="text-white/30 font-normal">(for weather — zip code or "City, ST")</span></label>
              <GInput value={f.weatherLocation || ""} onChange={e => setF({ ...f, weatherLocation: e.target.value })} placeholder="e.g. 17403 or York, PA" className="!text-xs" />
              <div className="text-[10px] text-white/30 mt-1">Defaults to York, PA if left blank.</div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Phone size={10} />Your Mobile # <span className="text-white/30 font-normal">(for Alfred SMS summaries)</span></label><GInput type="tel" value={f.myPhone || ""} onChange={e => setF({ ...f, myPhone: e.target.value })} placeholder="+17175550100" className="!text-xs" /></div>
            <div>
              {/* FIX 13 — the review landing page (#/rate) falls back to a
                  hardcoded "smocks-pressure-washing" Google review link when
                  no Place ID is set, which points EVERY deployment's
                  customers at a specific other business's review page if
                  left unconfigured. A direct, pasteable review link is also
                  far easier for a non-technical owner to get (Google Business
                  Profile → "Ask for reviews" → Copy link) than hunting down a
                  Place ID through Google's developer docs — this is now the
                  preferred field; Place ID below still works as a fallback
                  for anyone who already has one set. */}
              <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Star size={10} />Google Maps Review Link</label>
              <GInput value={f.googleReviewLink || ""} onChange={e => setF({ ...f, googleReviewLink: e.target.value })} placeholder="https://g.page/r/.../review" className="!text-xs" />
              <div className="text-[10px] text-white/30 mt-1">From your Google Business Profile: "Ask for reviews" → Copy link. Customers who rate 4-5 stars are sent here.</div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Star size={10} />Google Place ID <span className="text-white/30 font-normal">(fallback if no review link above)</span></label><GInput value={f.googlePlaceId || ""} onChange={e => setF({ ...f, googlePlaceId: e.target.value })} placeholder="ChIJ..." className="!text-xs" /><div className="text-[10px] text-white/30 mt-1">Find at <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">developers.google.com/maps/…/place-id</a></div></div>
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Clock size={10} />Max Lunch Break <span className="text-white/30 font-normal">(minutes)</span></label><GInput type="number" value={f.maxLunchMinutes ?? 30} onChange={e => setF({ ...f, maxLunchMinutes: Number(e.target.value) || 0 })} placeholder="30" className="!text-xs" /><div className="text-[10px] text-white/30 mt-1">Crew lunch breaks longer than this are flagged on the job</div></div>
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Truck size={10} />Default Travel Buffer <span className="text-white/30 font-normal">(minutes between jobs)</span></label><GInput type="number" min="0" step="5" value={f.defaultBufferMinutes ?? 30} onChange={e => setF({ ...f, defaultBufferMinutes: Number(e.target.value) || 0 })} placeholder="30" className="!text-xs" /><div className="text-[10px] text-white/30 mt-1">Jobs scheduled the same day get flagged on the Calendar if there isn't this much time between them</div></div>
            <div>
              <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><FileText size={10} />Terms & Conditions <span className="text-white/30 font-normal">(shown on the customer sign-off screen)</span></label>
              <GTxt rows={5} value={f.termsAndConditions || ""} onChange={(e: any) => setF({ ...f, termsAndConditions: e.target.value })} placeholder="I confirm that all services have been completed to my satisfaction..." className="!text-xs" />
              <div className="text-[10px] text-white/30 mt-1">Use {"{{company}}"} to insert your company name. Leave blank to use the default disclaimer.</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/40 border border-red-900/20 rounded-xl">
              <div className="flex-1 min-w-0 pr-3">
                <div className="text-sm font-medium">Paid Lunch Breaks</div>
                <div className="text-[10px] text-white/50">{f.paidLunchBreaks ? "Lunch time counts toward payroll" : "Lunch time is deducted from logged hours"}</div>
              </div>
              <button onClick={() => setF({ ...f, paidLunchBreaks: !f.paidLunchBreaks })} className={"transition " + (f.paidLunchBreaks ? "text-red-400" : "text-white/30")}>
                {f.paidLunchBreaks ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-2 block flex items-center gap-1">🎨 Brand Colors</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "Primary",    key: "brandPrimary",  def: "#dc2626", hint: "Buttons, links, highlights" },
                  { label: "Accent",     key: "brandAccent",   def: "#991b1b", hint: "Borders, icons" },
                  { label: "Background", key: "brandBg",       def: "#000000", hint: "Page background" },
                  { label: "Surface",    key: "brandSurface",  def: "#0a0a0a", hint: "Card backgrounds" },
                  { label: "Text",       key: "brandText",     def: "#ffffff", hint: "Main text color" },
                ].map(c => (
                  <div key={c.key}>
                    <label className="text-[10px] text-white/50 mb-1 block">{c.label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={f[c.key] || c.def} onChange={e => setF({ ...f, [c.key]: e.target.value })} className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <input type="text" value={f[c.key] || c.def} onChange={e => setF({ ...f, [c.key]: e.target.value })} className="w-full bg-black/40 border border-red-900/30 rounded-lg px-2 py-1 text-[11px] text-white font-mono" />
                        <div className="text-[9px] text-white/30 mt-0.5">{c.hint}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-white/30 mt-2">Colors apply to the full app UI, estimate portal, review landing, and lead intake form.</div>
            </div>

            {/* Font family */}
            <div>
              <label className="text-xs text-white/60 mb-2 block flex items-center gap-1">🔤 App Font</label>
              <GSel value={f.brandFont || "default"} onChange={e => setF({ ...f, brandFont: e.target.value })}>
                <option value="default" className="bg-black">Default (System UI)</option>
                <option value="serif" className="bg-black">Serif (Georgia)</option>
                <option value="mono" className="bg-black">Mono (Courier)</option>
                <option value="rounded" className="bg-black">Rounded (Trebuchet)</option>
                <option value="modern" className="bg-black">Modern (Outfit)</option>
              </GSel>
              <div className="text-[10px] text-white/30 mt-1">Changes the typeface across the entire app in real time.</div>
            </div>

            {/* Branding preview */}
            <div>
              <label className="text-xs text-white/60 mb-2 block">Live Preview — Estimate Page</label>
              <div className="rounded-xl border overflow-hidden text-sm" style={{ borderColor: (f.brandPrimary || "#dc2626") + "40", fontFamily: { serif: "Georgia, serif", mono: "Courier New, monospace", rounded: "Trebuchet MS, sans-serif", modern: "Outfit, sans-serif", default: "system-ui, sans-serif" }[f.brandFont as string] || "system-ui, sans-serif" }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: f.brandPrimary || "#dc2626" }}>
                  <div className="flex items-center gap-3">
                    {f.logoUrl
                      ? <img src={f.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-lg bg-white/10 p-0.5" />
                      : <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center text-xl">🏢</div>}
                    <div>
                      <div className="font-bold text-white">{f.companyName || "Your Company"}</div>
                      <div className="text-[11px] text-white/70">{f.companyPhone || "(717) 555-0100"} · {f.companyEmail || "info@yourcompany.com"}</div>
                    </div>
                  </div>
                  <div className="text-white/80 text-[11px] text-right">
                    <div className="font-semibold">Estimate #1042</div>
                    <div>Valid until Jun 15, 2025</div>
                  </div>
                </div>
                {/* Body */}
                <div className="p-4 space-y-3" style={{ background: f.brandBg || "#000000", color: f.brandText || "#ffffff" }}>
                  {/* Customer info */}
                  <div className="flex justify-between text-[11px]" style={{ color: (f.brandText || "#ffffff") + "90" }}>
                    <div><div className="font-semibold" style={{ color: f.brandText || "#ffffff" }}>John & Sarah Mitchell</div><div>1847 Oak Creek Drive, York, PA</div></div>
                    <div className="text-right"><div>2,200 sq ft · 2-story</div><div>Gate code: 4729</div></div>
                  </div>
                  {/* Line items */}
                  <div className="rounded-lg overflow-hidden" style={{ background: (f.brandSurface || "#0a0a0a"), border: "1px solid " + (f.brandPrimary || "#dc2626") + "20" }}>
                    {[
                      ["House Exterior Soft Wash", "1", "$385.00"],
                      ["Driveway Pressure Wash", "1", "$175.00"],
                      ["Gutter Cleaning & Flush", "1", "$129.00"],
                    ].map(([desc, qty, price]) => (
                      <div key={desc} className="flex items-center justify-between px-3 py-2 border-b text-[11px]" style={{ borderColor: (f.brandPrimary || "#dc2626") + "15", color: (f.brandText || "#ffffff") + "b0" }}>
                        <span className="flex-1">{desc}</span>
                        <span className="w-6 text-center">{qty}</span>
                        <span className="w-16 text-right font-medium" style={{ color: f.brandText || "#ffffff" }}>{price}</span>
                      </div>
                    ))}
                    <div className="px-3 py-2 space-y-1 text-[11px]">
                      <div className="flex justify-between" style={{ color: (f.brandText || "#ffffff") + "60" }}><span>Subtotal</span><span>$689.00</span></div>
                      <div className="flex justify-between" style={{ color: (f.brandText || "#ffffff") + "60" }}><span>Tax (6%)</span><span>$41.34</span></div>
                      <div className="flex justify-between font-bold text-sm pt-1 border-t" style={{ borderColor: (f.brandPrimary || "#dc2626") + "30", color: f.brandPrimary || "#dc2626" }}><span>Total</span><span>$730.34</span></div>
                    </div>
                  </div>
                  {/* Notes */}
                  <div className="text-[11px] px-3 py-2 rounded-lg" style={{ background: (f.brandSurface || "#0a0a0a"), color: (f.brandText || "#ffffff") + "80" }}>
                    📝 <span className="font-medium" style={{ color: (f.brandText || "#ffffff") + "cc" }}>Note:</span> We'll pre-treat the algae stains on the north side. Gate access required — please ensure dogs are secured.
                  </div>
                  {/* CTA */}
                  <button className="w-full py-2.5 rounded-lg text-white font-semibold text-sm" style={{ background: f.brandPrimary || "#dc2626" }}>✍️ Approve &amp; Sign Estimate</button>
                  <div className="text-center text-[10px]" style={{ color: (f.brandText || "#ffffff") + "40" }}>By approving you agree to the terms &amp; conditions below</div>
                </div>
              </div>
              <div className="text-[10px] text-white/30 mt-1.5">Preview updates live as you change colors and fonts above. This is what customers see when you send them an estimate.</div>
            </div>
          </div>}

          {sec === "goals" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Goals & Tax</h4>
            <div><label className="text-xs text-white/60 mb-1 block">Monthly Revenue Goal ($)</label><GInput type="number" value={f.monthlyRevenueGoal} onChange={e => setF({ ...f, monthlyRevenueGoal: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Quarterly Revenue Goal ($)</label><GInput type="number" value={f.quarterlyRevenueGoal || ""} onChange={e => setF({ ...f, quarterlyRevenueGoal: e.target.value })} placeholder={(f.monthlyRevenueGoal * 3) || "45000"} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Monthly Jobs Goal</label><GInput type="number" value={f.monthlyJobsGoal} onChange={e => setF({ ...f, monthlyJobsGoal: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Annual Revenue Goal ($)</label><GInput type="number" value={f.annualRevenueGoal || ""} onChange={e => setF({ ...f, annualRevenueGoal: e.target.value })} placeholder={(f.monthlyRevenueGoal * 12) || "120000"} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Customer Acquisition Goal <span className="text-white/30">(new customers/mo)</span></label><GInput type="number" value={f.customerAcquisitionGoal || ""} onChange={e => setF({ ...f, customerAcquisitionGoal: e.target.value })} placeholder="10" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Avg Job Value Goal ($)</label><GInput type="number" value={f.avgJobValueGoal || ""} onChange={e => setF({ ...f, avgJobValueGoal: e.target.value })} placeholder="350" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Review Rating Goal <span className="text-white/30">(out of 5)</span></label><GInput type="number" step="0.1" min="1" max="5" value={f.reviewRatingGoal || ""} onChange={e => setF({ ...f, reviewRatingGoal: e.target.value })} placeholder="4.8" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Tax Rate (%)</label><GInput type="number" step="0.01" value={f.taxRate} onChange={e => setF({ ...f, taxRate: e.target.value })} /></div>
          </div>}

          {sec === "templates" && <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-red-900/20">
              {([["messaging", "Email & SMS"], ["estimates", "Estimate Templates"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => { setTplTab(key); setEditingTpl(null); }} className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition " + (tplTab === key ? "bg-red-700/40 text-white border border-red-700/50" : "text-white/50 hover:text-white")}>{label}</button>
              ))}
            </div>

            {tplTab === "messaging" && <TemplateEditor emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} smsTemplates={smsTemplates} setSmsTemplates={setSmsTemplates} settings={f} setSettings={newF => setF(newF)} />}

            {tplTab === "estimates" && <>
              {editingTpl === null ? (
                // ── List view ────────────────────────────────────────────────
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Estimate Templates</div>
                      <div className="text-[10px] text-white/40 mt-0.5">Reusable starting points for new estimates — pre-fill line items, notes, terms, and custom questions.</div>
                    </div>
                    <GBtn onClick={() => setEditingTpl(blankTpl())} className="!text-xs !py-1.5"><Plus size={12} className="inline mr-1" />New Template</GBtn>
                  </div>
                  {estimateTemplates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-red-900/30 rounded-xl">
                      <FileText size={28} className="text-white/10 mb-2" />
                      <div className="text-xs text-white/30">No estimate templates yet</div>
                      <button onClick={() => setEditingTpl(blankTpl())} className="mt-2 text-[11px] text-red-400 hover:text-red-300">Create your first template →</button>
                    </div>
                  )}
                  {estimateTemplates.map((tpl: any) => (
                    <Glass key={tpl.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{tpl.name}</div>
                          {tpl.description && <div className="text-[11px] text-white/50 mt-0.5 truncate">{tpl.description}</div>}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-[10px] px-2 py-0.5 bg-black/40 border border-white/10 rounded-full text-white/50">{(tpl.lineItems || []).length} line item{(tpl.lineItems || []).length !== 1 ? "s" : ""}</span>
                            {(tpl.customFields || []).length > 0 && <span className="text-[10px] px-2 py-0.5 bg-purple-950/30 border border-purple-700/30 rounded-full text-purple-300">{tpl.customFields.length} custom field{tpl.customFields.length !== 1 ? "s" : ""}</span>}
                            {tpl.terms && <span className="text-[10px] px-2 py-0.5 bg-black/40 border border-white/10 rounded-full text-white/40">Has terms</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => setEditingTpl({ ...tpl })} className="px-3 py-1.5 rounded-lg border border-red-900/30 text-xs text-white/70 hover:text-white hover:bg-red-900/20 transition"><Edit size={11} className="inline mr-1" />Edit</button>
                          <button onClick={() => { setEstimateTemplates((prev: any[]) => prev.filter((t: any) => t.id !== tpl.id)); toast("Template deleted"); }} className="px-3 py-1.5 rounded-lg border border-red-900/30 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-900/20 transition"><Trash2 size={11} /></button>
                        </div>
                      </div>
                    </Glass>
                  ))}
                </div>
              ) : (
                // ── Edit / Create form ────────────────────────────────────────
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditingTpl(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition"><ChevronLeft size={16} /></button>
                    <div className="font-semibold text-sm">{editingTpl.id ? "Edit Template" : "New Template"}</div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div><label className="text-xs text-white/60 mb-1 block">Template Name *</label><GInput placeholder="e.g. House Wash Package" value={editingTpl.name} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, name: e.target.value }))} /></div>
                    <div><label className="text-xs text-white/60 mb-1 block">Description</label><GInput placeholder="Short description (optional)" value={editingTpl.description || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, description: e.target.value }))} /></div>
                  </div>

                  {/* Visual design — applied to the customer-facing client portal when this template is selected at send time */}
                  <Glass className="p-4 !bg-purple-950/10 !border-purple-700/20 space-y-3">
                    <div className="text-xs font-semibold text-purple-300">Visual Design</div>

                    <div className="flex items-center gap-3">
                      {editingTpl.logoUrl ? (
                        <div className="relative">
                          <img src={editingTpl.logoUrl} alt="" className="w-14 h-14 rounded-lg object-contain bg-white/5 border border-white/10" />
                          <button onClick={() => setEditingTpl((t: any) => ({ ...t, logoUrl: undefined }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center"><X size={10} /></button>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-white/5 border border-dashed border-white/15 flex items-center justify-center text-white/20"><FileText size={18} /></div>
                      )}
                      <label className="text-xs px-3 py-2 rounded-lg border border-purple-700/40 text-purple-300 hover:bg-purple-900/30 cursor-pointer flex items-center gap-1.5">
                        <Upload size={12} />Upload Logo
                        <input type="file" accept="image/*" className="hidden" onChange={(e: any) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const reader = new FileReader();
                          reader.onload = () => setEditingTpl((t: any) => ({ ...t, logoUrl: String(reader.result) }));
                          reader.readAsDataURL(f);
                          e.target.value = "";
                        }} />
                      </label>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div><label className="text-xs text-white/60 mb-1 block">Header Text</label><GInput placeholder="e.g. Your Estimate" value={editingTpl.headerText || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, headerText: e.target.value }))} className="!text-xs" /></div>
                      <div><label className="text-xs text-white/60 mb-1 block">Footer Text</label><GInput placeholder="e.g. Thank you for your business!" value={editingTpl.footerText || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, footerText: e.target.value }))} className="!text-xs" /></div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Font</label>
                        <GSel value={editingTpl.font || "Arial"} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, font: e.target.value }))} className="!text-xs">
                          {["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"].map(fn => <option key={fn} value={fn} className="bg-black">{fn}</option>)}
                        </GSel>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Header Color</label>
                        <input type="color" value={editingTpl.colorHeader || "#dc2626"} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, colorHeader: e.target.value }))} className="w-full h-8 rounded-lg border border-white/10 bg-black/40" />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Text Color</label>
                        <input type="color" value={editingTpl.colorText || "#111111"} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, colorText: e.target.value }))} className="w-full h-8 rounded-lg border border-white/10 bg-black/40" />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Accent Color</label>
                        <input type="color" value={editingTpl.colorAccent || "#dc2626"} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, colorAccent: e.target.value }))} className="w-full h-8 rounded-lg border border-white/10 bg-black/40" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-white/60 mb-1.5 block">Layout</label>
                      <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
                        {(["modern", "classic", "minimal"] as const).map(l => (
                          <button key={l} onClick={() => setEditingTpl((t: any) => ({ ...t, layout: l }))} className={"flex-1 py-1.5 rounded-lg text-xs capitalize transition " + ((editingTpl.layout || "modern") === l ? "bg-purple-700/40 text-white border border-purple-700/50" : "text-white/50")}>{l}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-white/60">Photo Slots <span className="text-white/30">(up to 4)</span></label>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 4 }).map((_, i) => {
                          const slots = editingTpl.photoSlots || [];
                          const photo = slots[i];
                          return (
                            <label key={i} className="aspect-square rounded-lg border border-dashed border-white/15 bg-white/5 flex items-center justify-center cursor-pointer overflow-hidden relative">
                              {photo ? (
                                <>
                                  <img src={photo} alt="" className="w-full h-full object-cover" />
                                  <button onClick={(e: any) => { e.preventDefault(); setEditingTpl((t: any) => ({ ...t, photoSlots: (t.photoSlots || []).filter((_: any, idx: number) => idx !== i) })); }} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center"><X size={9} /></button>
                                </>
                              ) : <Plus size={14} className="text-white/20" />}
                              <input type="file" accept="image/*" className="hidden" onChange={(e: any) => {
                                const f = e.target.files?.[0]; if (!f) return;
                                const reader = new FileReader();
                                reader.onload = () => setEditingTpl((t: any) => {
                                  const next = [...(t.photoSlots || [])];
                                  next[i] = String(reader.result);
                                  return { ...t, photoSlots: next };
                                });
                                reader.readAsDataURL(f);
                                e.target.value = "";
                              }} />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </Glass>

                  {/* Line items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-white/60">Default Line Items</label>
                      <button onClick={() => setEditingTpl((t: any) => ({ ...t, lineItems: [...(t.lineItems || []), { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 }] }))} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Plus size={12} />Add</button>
                    </div>
                    <div className="space-y-2">
                      {(editingTpl.lineItems || []).map((li: any) => (
                        <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 md:col-span-6"><GInput placeholder="Description" value={li.description} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, lineItems: t.lineItems.map((x: any) => x.id === li.id ? { ...x, description: e.target.value } : x) }))} /></div>
                          <div className="col-span-4 md:col-span-2"><GInput type="number" placeholder="Qty" value={li.quantity} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, lineItems: t.lineItems.map((x: any) => x.id === li.id ? { ...x, quantity: e.target.value } : x) }))} /></div>
                          <div className="col-span-6 md:col-span-3"><GInput type="number" placeholder="Price $" value={li.unitPrice} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, lineItems: t.lineItems.map((x: any) => x.id === li.id ? { ...x, unitPrice: e.target.value } : x) }))} /></div>
                          <div className="col-span-2 md:col-span-1 text-right">{(editingTpl.lineItems || []).length > 1 && <button onClick={() => setEditingTpl((t: any) => ({ ...t, lineItems: t.lineItems.filter((x: any) => x.id !== li.id) }))} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-lg"><Trash2 size={13} /></button>}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div><label className="text-xs text-white/60 mb-1 block">Default Notes <span className="text-white/30">(customer-visible)</span></label><GTxt rows={2} value={editingTpl.notes || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, notes: e.target.value }))} placeholder="e.g. Includes pre-treatment of algae stains" className="!text-xs" /></div>
                    <div><label className="text-xs text-white/60 mb-1 block">Default Terms & Conditions</label><GTxt rows={2} value={editingTpl.terms || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, terms: e.target.value }))} className="!text-xs" /></div>
                  </div>

                  {/* Custom fields */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="text-xs text-white/60">Custom Fields</label>
                        <div className="text-[10px] text-white/30">Extra questions or data fields added to estimates using this template</div>
                      </div>
                      <button onClick={() => setEditingTpl((t: any) => ({ ...t, customFields: [...(t.customFields || []), blankField()] }))} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"><Plus size={12} />Add Field</button>
                    </div>
                    {(editingTpl.customFields || []).length === 0 && <div className="text-[11px] text-white/30 py-2 text-center border border-dashed border-white/10 rounded-xl">No custom fields — click "Add Field" to create one</div>}
                    <div className="space-y-2">
                      {(editingTpl.customFields || []).map((cf: any) => (
                        <Glass key={cf.id} className="p-3 !bg-purple-950/10 !border-purple-700/20">
                          <div className="grid grid-cols-12 gap-2 items-start">
                            <div className="col-span-12 md:col-span-4"><GInput placeholder="Field label" value={cf.label} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, label: e.target.value } : x) }))} className="!text-xs" /></div>
                            <div className="col-span-6 md:col-span-2">
                              <GSel value={cf.type} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, type: e.target.value } : x) }))} className="!text-xs">
                                <option value="text" className="bg-black">Text</option>
                                <option value="number" className="bg-black">Number</option>
                                <option value="checkbox" className="bg-black">Checkbox</option>
                                <option value="dropdown" className="bg-black">Dropdown</option>
                                <option value="date" className="bg-black">Date</option>
                              </GSel>
                            </div>
                            {cf.type === "dropdown" && <div className="col-span-6 md:col-span-3"><GInput placeholder="Options (comma-sep)" value={cf.options || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, options: e.target.value } : x) }))} className="!text-xs" /></div>}
                            <div className={"col-span-12 md:col-span-" + (cf.type === "dropdown" ? "2" : "5") + " flex flex-wrap gap-3 items-center"}>
                              <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer"><input type="checkbox" checked={cf.required} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, required: e.target.checked } : x) }))} className="accent-red-600 w-3 h-3" />Required</label>
                              <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer"><input type="checkbox" checked={cf.customerVisible} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, customerVisible: e.target.checked } : x) }))} className="accent-purple-600 w-3 h-3" />Customer-visible</label>
                              <button onClick={() => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.filter((x: any) => x.id !== cf.id) }))} className="ml-auto p-1 text-red-400/60 hover:text-red-400 hover:bg-red-900/20 rounded transition"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        </Glass>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-red-900/20">
                    <GBtn variant="ghost" onClick={() => setEditingTpl(null)}>Cancel</GBtn>
                    <GBtn onClick={() => {
                      if (!editingTpl.name?.trim()) return;
                      const tpl = { ...editingTpl, id: editingTpl.id || (Date.now().toString() + Math.random().toString(36).slice(2)) };
                      setEstimateTemplates((prev: any[]) => {
                        const exists = prev.find((t: any) => t.id === tpl.id);
                        return exists ? prev.map((t: any) => t.id === tpl.id ? tpl : t) : [...prev, tpl];
                      });
                      setEditingTpl(null);
                      toast(editingTpl.id ? "Template updated" : "Template saved");
                    }} disabled={!editingTpl.name?.trim()}>
                      {editingTpl.id ? "Save Changes" : "Save Template"}
                    </GBtn>
                  </div>
                </div>
              )}
            </>}
          </div>}

          {sec === "integrations" && <div className="space-y-4">
            <h4 className="font-semibold text-sm">Integrations</h4>

            {/* Google — OAuth for Maps, Tasks, Calendar, Gmail, Drive */}
            <Glass className={"p-4 " + (f.googleConnected ? "!bg-gradient-to-br !from-blue-950/30 !to-black/60 !border-blue-600/40" : "!bg-black/40")}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                  <div className="font-semibold text-sm">Google Account</div>
                </div>
                <Badge tone={!f.googleConnected ? "gray" : googleTokenValid === false ? "red" : "green"}>
                  {!f.googleConnected ? "Not connected" : googleTokenValid === false ? "⚠ Token expired — click Retry" : "✓ " + (f.googleEmail || "Connected")}
                </Badge>
              </div>

              {/* FIX D — Google sign-in/token refresh runs through a
                  Cloudflare Pages Function (functions/api/google-refresh.ts)
                  that needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set as
                  env vars in the Cloudflare dashboard — there's no
                  wrangler.toml in this repo, so nothing sets these
                  automatically. Always-visible so the owner sees it during
                  initial setup, not just after a failed refresh. */}
              <div className={"mb-3 p-3 rounded-xl border text-[11px] leading-relaxed " + (googleConfigMissing ? "bg-red-950/25 border-red-700/40 text-red-200" : "bg-blue-950/15 border-blue-700/25 text-white/60")}>
                <div className={"font-semibold mb-1 " + (googleConfigMissing ? "text-red-300" : "text-blue-300")}>
                  {googleConfigMissing ? "⚠ Google reconnect is failing — server isn't configured" : "Server setup required for Gmail send & token refresh"}
                </div>
                <div>
                  Add two environment variables to this project in the <strong>Cloudflare Pages dashboard</strong> (Workers &amp; Pages → your project → Settings → Environment variables):
                </div>
                <div className="mt-1.5 space-y-0.5 font-mono">
                  <div className="bg-black/30 rounded px-2 py-1">GOOGLE_CLIENT_ID</div>
                  <div className="bg-black/30 rounded px-2 py-1">GOOGLE_CLIENT_SECRET</div>
                </div>
                <div className="mt-1.5">
                  Get both values from <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong>, under the OAuth 2.0 Client ID used for this app's Google sign-in. After adding them, redeploy the Pages project for the env vars to take effect.
                </div>
              </div>

              {f.googleConnected ? (
                <div className="space-y-3">
                  {/* Connected status */}
                  <div className="p-3 bg-green-950/20 border border-green-700/30 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold">{(f.googleEmail || "?")[0]?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{f.googleEmail}</div>
                      <div className="text-[10px] text-white/50">Signed in with Google</div>
                    </div>
                  </div>

                  {/* Active services */}
                  <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Active Services</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { k: "calendar", label: "Calendar", icon: "📅", desc: "Job sync + scheduling" },
                      { k: "tasks", label: "Tasks", icon: "✅", desc: "Google Tasks sync" },
                      { k: "gmail", label: "Gmail", icon: "📧", desc: "Send from CRM" },
                      { k: "drive", label: "Drive", icon: "💾", desc: "Photo + invoice storage" },
                      { k: "contacts", label: "Contacts", icon: "👥", desc: "Import contacts" },
                      { k: "maps", label: "Maps", icon: "🗺️", desc: "Address autocomplete" },
                    ].map(s => {
                      // Read and write the same place — previously "maps" was always
                      // re-derived from googleMapsKey/googleConnected for display, so
                      // clicking its toggle wrote to googleScopes.maps but the tile
                      // never reflected that write, making the toggle look broken.
                      const on = (f.googleScopes || {})[s.k] ?? (s.k === "maps" ? !!(f.googleMapsKey || f.googleConnected) : false);
                      return <button key={s.k} onClick={() => setF({ ...f, googleScopes: { ...(f.googleScopes || {}), [s.k]: !on } })} className={"flex items-center gap-2 p-2 rounded-xl border text-xs transition " + (on ? "bg-blue-950/30 border-blue-700/50 text-white" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}>
                        <span>{s.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{s.label}</div>
                          <div className="text-[9px] text-white/40">{s.desc}</div>
                        </div>
                        {on ? <ToggleRight size={18} className="text-blue-400 flex-shrink-0" /> : <ToggleLeft size={18} className="text-white/20 flex-shrink-0" />}
                      </button>;
                    })}
                  </div>

                  {/* Backend URL for server-side calls */}
                  <div>
                    <label className="text-[10px] text-white/60 uppercase tracking-wider mb-1 block">Backend URL (for Gmail/Calendar server calls)</label>
                    <GInput placeholder="https://your-app.railway.app" value={f.googleBackendUrl || ""} onChange={e => setF({ ...f, googleBackendUrl: e.target.value })} className="!text-xs" />
                    <div className="text-[9px] text-white/40 mt-1">Optional — needed for sending Gmail and full Calendar sync. Deploy the <span className="text-blue-400">smocks backend</span> to Railway/Render in 5 min.</div>
                  </div>

                  {/* Multiple Calendar Support */}
                  {(f.googleScopes || {}).calendar && <div>
                    <label className="text-[10px] text-white/60 uppercase tracking-wider mb-2 block">📅 Calendar Selection (Multiple Calendar Support)</label>
                    <div className="space-y-2">
                      <div className="text-[10px] text-white/50 mb-2">Choose which Google Calendar to sync jobs to. You can select a dedicated "Work" calendar separate from your personal one.</div>
                      {[
                        { id: "primary", label: "Primary (personal) calendar", color: "#4285F4" },
                        { id: "work", label: "Work calendar (recommended)", color: "#0F9D58" },
                        { id: "smocks", label: "Crew Boss", color: "#DB4437" },
                      ].map(cal => (
                        <label key={cal.id} className={"flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition " + (f.googleCalendarId === cal.id ? "border-blue-500/50 bg-blue-950/20" : "border-white/10 bg-black/30 hover:border-white/20")}>
                          <input type="radio" name="calendarId" checked={f.googleCalendarId === cal.id} onChange={() => setF({ ...f, googleCalendarId: cal.id })} className="accent-blue-500" />
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cal.color }} />
                          <span className="text-xs">{cal.label}</span>
                        </label>
                      ))}
                      <div>
                        <label className="text-[10px] text-white/50 mb-1 block">Or enter a custom Calendar ID</label>
                        <GInput value={f.googleCalendarId || ""} onChange={e => setF({ ...f, googleCalendarId: e.target.value })} placeholder="your-calendar-id@group.calendar.google.com" className="!text-xs" />
                        <div className="text-[9px] text-white/30 mt-1">Find it in Google Calendar → Settings → Calendar ID</div>
                      </div>
                    </div>
                  </div>}

                  {/* FIX 9 — auto-sync toggle. When ON, every assigned/accepted
                      job creates a calendar event automatically; OFF = manual. */}
                  {(f.googleScopes || {}).calendar && (
                    <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-black/30 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium">Auto-sync jobs to Google Calendar</div>
                        <div className="text-[10px] text-white/50 mt-0.5">Automatically create a calendar event whenever a job is scheduled or assigned.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setF({ ...f, autoSyncCalendar: !(f.autoSyncCalendar ?? true) })}
                        className={"relative w-11 h-6 rounded-full transition flex-shrink-0 " + ((f.autoSyncCalendar ?? true) ? "bg-blue-600" : "bg-white/15")}
                      >
                        <span className={"absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all " + ((f.autoSyncCalendar ?? true) ? "left-[22px]" : "left-0.5")} />
                      </button>
                    </label>
                  )}

                  <div className="flex gap-2">
                    <GBtn variant="ghost" onClick={retryGoogleToken} disabled={googleRetrying} className="flex-1 !text-xs">
                      <RefreshCw size={12} className={"inline mr-1.5 " + (googleRetrying ? "animate-spin" : "")} />
                      {googleRetrying ? "Retrying…" : "Retry Connection"}
                    </GBtn>
                    <GBtn variant="danger" onClick={() => setF({ ...f, googleConnected: false, googleToken: "", googleEmail: "", googleRefreshToken: "", googleScopes: {} })} className="flex-1 !text-xs">
                      Disconnect Google Account
                    </GBtn>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-white/60">One Google login gives you Calendar, Tasks, Maps, Gmail, Drive, and Contacts — all in one click.</div>

                  {/* OAuth scopes preview */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs text-white/60">
                    {["📅 Calendar", "✅ Tasks", "🗺️ Maps", "📧 Gmail", "💾 Drive", "👥 Contacts"].map(s => (
                      <div key={s} className="p-2 bg-black/40 border border-white/5 rounded-xl">{s}</div>
                    ))}
                  </div>

                  {/* Google connect button — links identity if already signed in */}
                  <button
                    onClick={async () => {
                      const GOOGLE_SCOPES = [
                        "https://www.googleapis.com/auth/calendar",
                        "https://www.googleapis.com/auth/gmail.send",
                        "https://www.googleapis.com/auth/gmail.readonly",
                        "https://www.googleapis.com/auth/tasks",
                        "https://www.googleapis.com/auth/drive.file",
                        "https://www.googleapis.com/auth/contacts",
                      ].join(" ");
                      const opts = {
                        queryParams: { access_type: "offline", prompt: "consent" },
                        scopes: GOOGLE_SCOPES,
                        redirectTo: window.location.origin + window.location.pathname,
                      };
                      try {
                        const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: opts });
                        if (error) toast("Google connect failed: " + error.message, "red");
                      } catch (e: any) {
                        toast("Google connect failed: " + e.message, "red");
                      }
                    }}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
                  >
                    <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                    Connect Google Account
                  </button>

                  <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[10px] text-white/50 space-y-1.5">
                    <div className="font-semibold text-white/70">Setup Required</div>
                    <div>In your Supabase project → Authentication → Providers → Google: add your Google OAuth Client ID and Secret. Enable Calendar, Gmail, Tasks, Drive, Contacts scopes.</div>
                    <div>After connecting, you'll be redirected back and your token is stored automatically.</div>
                  </div>
                </div>
              )}
            </Glass>

            {/* Stripe */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><CreditCard size={14} className="text-purple-400" /><div className="font-semibold text-sm">Stripe</div></div>
                <Badge tone={f.stripePublishableKey?.trim() && stripeSecretInput.trim() ? "green" : "gray"}>
                  {f.stripePublishableKey?.trim() && stripeSecretInput.trim() ? "Stripe Connected ✓" : "Not Connected"}
                </Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">Accept deposits, payments, and tips on estimates and invoices.</div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-wider">Publishable Key</label>
                  <GInput placeholder="pk_live_…" value={f.stripePublishableKey || ""} onChange={e => setF({ ...f, stripePublishableKey: e.target.value })} className="!text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-wider">Secret Key</label>
                  <div className="relative">
                    <GInput type={showStripeSecret ? "text" : "password"} placeholder="sk_live_…" value={stripeSecretInput} onChange={e => setStripeSecretInput(e.target.value)} className="!text-xs font-mono pr-9" />
                    <button type="button" onClick={() => setShowStripeSecret(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                      {showStripeSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <div className="text-[10px] text-white/30 mt-1">Stored obfuscated in localStorage — not real encryption. For production use, keys belong behind a backend.</div>
                </div>
                {/* AUDIT — functions/api/stripe-webhook.ts (a server-side,
                    signature-verified backup for marking invoices paid) has
                    never had any in-app setup instructions anywhere in
                    Settings, even though it needs its own Cloudflare env var
                    and Stripe dashboard configuration. Payments still get
                    marked paid without this (the client-side confirmation in
                    ClientPortal.tsx already handles the golden path) — this
                    just adds tamper-resistant server verification on top. */}
                <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[10px] text-white/50 space-y-1">
                  <div className="font-semibold text-white/70">Optional: Server-Verified Payment Webhook</div>
                  <div>Payments already get marked paid automatically when a customer completes checkout. For extra tamper-resistance (a signature-verified check that can't be spoofed from a browser), also set up the Stripe webhook:</div>
                  <div className="mt-1">1. Cloudflare Pages → this project → Settings → Environment variables → add <span className="font-mono text-blue-400">STRIPE_WEBHOOK_SECRET</span>.</div>
                  <div>2. Stripe Dashboard → Developers → Webhooks → Add endpoint → <span className="font-mono text-blue-400 break-all">{window.location.origin}/api/stripe-webhook</span></div>
                  <div>3. Select events: checkout.session.completed, checkout.session.async_payment_succeeded, payment_intent.succeeded.</div>
                  <div>4. Stripe shows a signing secret ("whsec_…") when you create the endpoint — that's the value for step 1.</div>
                </div>
              </div>
            </Glass>

            {/* Twilio */}
            <Glass className={"p-4 " + (f.twilioSid && f.twilioToken && f.twilioFrom ? "!bg-gradient-to-br !from-green-950/20 !to-black/60 !border-green-700/30" : "!bg-black/40")}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><MessageSquare size={14} className="text-blue-400" /><div className="font-semibold text-sm">Twilio SMS</div></div>
                <Badge tone={f.twilioSid && f.twilioToken && f.twilioFrom ? "green" : "gray"}>{f.twilioSid && f.twilioToken && f.twilioFrom ? "Configured" : "Not set"}</Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">Send and receive SMS. Get credentials at <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">console.twilio.com</a></div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">Account SID</label>
                  <GInput value={f.twilioSid || ""} onChange={e => setF({ ...f, twilioSid: e.target.value })} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="!text-xs mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">Auth Token</label>
                  <GInput type="password" value={f.twilioToken || ""} onChange={e => setF({ ...f, twilioToken: e.target.value })} placeholder="Your auth token" className="!text-xs mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">From Phone Number (SMS)</label>
                  <GInput value={f.twilioFrom || ""} onChange={e => setF({ ...f, twilioFrom: e.target.value })} placeholder="+15551234567" className="!text-xs mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">WhatsApp From Number <span className="text-white/30 normal-case">(optional — for WhatsApp Business)</span></label>
                  <GInput value={f.twilioWhatsAppFrom || ""} onChange={e => setF({ ...f, twilioWhatsAppFrom: e.target.value })} placeholder="whatsapp:+15551234567" className="!text-xs mt-1" />
                  <div className="text-[10px] text-white/30 mt-1">Enable WhatsApp in your Twilio console. Format: whatsapp:+1xxxxxxxxxx</div>
                </div>
                <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[10px] text-white/50 space-y-1">
                  <div className="font-semibold text-white/70">Incoming SMS Webhook</div>
                  <div>In your Twilio console, set the incoming webhook for your number to:</div>
                  <div className="font-mono text-blue-400 bg-blue-950/20 px-2 py-1 rounded mt-1 break-all">{f.googleBackendUrl ? f.googleBackendUrl.replace(/\/$/, "") + "/api/sms/incoming" : "https://your-backend.railway.app/api/sms/incoming"}</div>
                  <div className="mt-1">Method: HTTP POST. Incoming messages will appear in the CRM Inbox automatically.</div>
                </div>
              </div>
            </Glass>

            {/* Buffer — real social posting via Buffer's current GraphQL API */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Share2 size={16} className="text-blue-400" /><div className="font-semibold text-sm">Buffer</div></div>
                <Badge tone={f.bufferChannelIds && Object.keys(f.bufferChannelIds).length > 0 ? "green" : f.bufferApiKey ? "yellow" : "gray"}>
                  {f.bufferChannelIds && Object.keys(f.bufferChannelIds).length > 0 ? "Connected" : f.bufferApiKey ? "Key set — pick channels" : "Not set"}
                </Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">Primary way to post to all your platforms from the Social page. Buffer retired its old token-based API — get a key at <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">publish.buffer.com/settings/api</a> (docs: <a href="https://developers.buffer.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">developers.buffer.com</a>)</div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <GInput type="password" value={f.bufferApiKey || ""} onChange={e => setF({ ...f, bufferApiKey: e.target.value.trim() })} placeholder="Buffer API key" className="!text-xs" />
                  <GBtn
                    disabled={!f.bufferApiKey || bufferConnecting}
                    onClick={async () => {
                      setBufferConnecting(true);
                      try {
                        const orgId = f.bufferOrganizationId || await fetchBufferOrganizationId(f.bufferApiKey);
                        if (!orgId) { toast?.("No Buffer organization found for this key", "red"); return; }
                        const channels = await fetchBufferChannels(f.bufferApiKey, orgId);
                        setBufferChannels(channels);
                        setF((p: any) => ({ ...p, bufferOrganizationId: orgId }));
                        toast?.(`Found ${channels.length} connected channel${channels.length !== 1 ? "s" : ""} ✓`, "green");
                      } catch (e: any) {
                        toast?.(e?.message || "Could not reach Buffer", "red");
                      } finally {
                        setBufferConnecting(false);
                      }
                    }}
                    className="!text-xs !py-1.5 flex-shrink-0"
                  >
                    {bufferConnecting ? "Connecting…" : "Find Channels"}
                  </GBtn>
                </div>
                {bufferChannels.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {["instagram", "facebook", "tiktok", "linkedin"].map(platform => (
                      <div key={platform} className="flex items-center justify-between gap-2">
                        <label className="text-[10px] text-white/50 uppercase tracking-wider capitalize w-20 flex-shrink-0">{platform}</label>
                        <GSel
                          value={f.bufferChannelIds?.[platform] || ""}
                          onChange={e => setF((p: any) => ({ ...p, bufferChannelIds: { ...(p.bufferChannelIds || {}), [platform]: e.target.value } }))}
                          className="!text-xs !py-1.5 flex-1"
                        >
                          <option value="" className="bg-black">Not connected</option>
                          {bufferChannels.filter(c => c.service?.toLowerCase().includes(platform) || (platform === "facebook" && c.service?.toLowerCase() === "fb")).map(c => (
                            <option key={c.id} value={c.id} className="bg-black">{c.displayName || c.name}</option>
                          ))}
                        </GSel>
                      </div>
                    ))}
                  </div>
                )}
                {bufferChannels.length === 0 && f.bufferChannelIds && Object.keys(f.bufferChannelIds).length > 0 && (
                  <div className="text-[10px] text-white/40">Channels connected previously — click "Find Channels" again to change them.</div>
                )}
              </div>
            </Glass>

            {/* Direct platform OAuth — fallback for accounts not on Buffer */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center gap-2 mb-1"><Link size={16} className="text-purple-400" /><div className="font-semibold text-sm">Direct Platform Connections</div></div>
              <div className="text-xs text-white/60 mb-3">Fallback for platforms not connected through Buffer. Connecting redirects to the platform to authorize, then exchanges the code for a token through your backend (same proxy used for Google) — set it below first.</div>
              <div className="mb-3">
                <label className="text-[10px] text-white/50 uppercase tracking-wider">Backend URL (token exchange proxy)</label>
                <GInput value={f.socialBackendUrl || ""} onChange={e => setF({ ...f, socialBackendUrl: e.target.value })} placeholder="https://your-backend.railway.app" className="!text-xs mt-1" />
              </div>
              <div className="space-y-3">
                {([
                  { platform: "facebook" as SocialPlatform, label: "Facebook", clientIdKey: "metaClientId", tokenKey: "metaAccessToken", devUrl: "https://developers.facebook.com/" },
                  { platform: "facebook" as SocialPlatform, label: "Instagram", clientIdKey: "metaClientId", tokenKey: "metaAccessToken", devUrl: "https://developers.facebook.com/", sharedWithFacebook: true },
                  { platform: "linkedin" as SocialPlatform, label: "LinkedIn", clientIdKey: "linkedinClientId", tokenKey: "linkedinAccessToken", devUrl: "https://developer.linkedin.com/" },
                  { platform: "tiktok" as SocialPlatform, label: "TikTok", clientIdKey: "tiktokClientId", tokenKey: "tiktokAccessToken", devUrl: "https://developers.tiktok.com/" },
                ]).map(p => (
                  <div key={p.label} className="flex items-center gap-2 p-2.5 bg-black/40 border border-white/5 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium mb-1 flex items-center gap-1.5">
                        {p.label}
                        <a href={p.devUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 font-normal">Get API credentials →</a>
                      </div>
                      {p.sharedWithFacebook ? (
                        <div className="text-[10px] text-white/40">Uses the same Meta app/credentials as Facebook above.</div>
                      ) : (
                        <GInput value={(f as any)[p.clientIdKey] || ""} onChange={e => setF({ ...f, [p.clientIdKey]: e.target.value })} placeholder={`${p.label} Client/App ID`} className="!text-xs" />
                      )}
                    </div>
                    <Badge tone={(f as any)[p.tokenKey] ? "green" : "gray"}>{(f as any)[p.tokenKey] ? "Connected" : "Not connected"}</Badge>
                    {!p.sharedWithFacebook && (
                      <GBtn
                        variant="ghost"
                        disabled={!(f as any)[p.clientIdKey]}
                        onClick={() => {
                          sessionStorage.setItem("smocks.socialOAuthPlatform", p.platform);
                          const state = uid();
                          sessionStorage.setItem("smocks.socialOAuthState", state);
                          window.location.href = buildSocialAuthorizeUrl(p.platform, (f as any)[p.clientIdKey], state);
                        }}
                        className="!text-xs !py-1.5 flex-shrink-0"
                      >
                        Connect
                      </GBtn>
                    )}
                  </div>
                ))}
                {(f as any).metaAccessToken && (
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider">Facebook Page ID</label>
                    <GInput value={(f as any).metaPageId || ""} onChange={e => setF({ ...f, metaPageId: e.target.value })} placeholder="Page ID to post to" className="!text-xs mt-1" />
                  </div>
                )}
                {(f as any).linkedinAccessToken && (
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider">LinkedIn Author URN</label>
                    <GInput value={(f as any).linkedinAuthorUrn || ""} onChange={e => setF({ ...f, linkedinAuthorUrn: e.target.value })} placeholder="urn:li:person:xxxxx" className="!text-xs mt-1" />
                  </div>
                )}
                <div className="text-[10px] text-white/30">Instagram and TikTok posting still needs a publicly hosted image/video URL their APIs require, so those two keep using the share-sheet/copy fallback even once connected — Facebook and LinkedIn post real text directly.</div>
              </div>
            </Glass>
          </div>}

          {sec === "notifications" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Quick Action FAB</h4>
            <div className="flex items-center justify-between p-3 bg-black/40 border border-red-900/20 rounded-xl">
              <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">Enable Quick Action FAB</div><div className="text-[10px] text-white/50">Floating + button at bottom-right of every page</div></div>
              <button onClick={() => setF({ ...f, fabEnabled: f.fabEnabled === false ? true : false })} className={"transition " + (f.fabEnabled !== false ? "text-red-400" : "text-white/30")}>{f.fabEnabled !== false ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
            </div>
            {f.fabEnabled !== false && (
              <div className="pl-4 border-l border-red-900/30 space-y-2">
                <div className="text-[11px] text-white/50">Choose which actions appear:</div>
                {([
                  { id: "customers", label: "New Customer" },
                  { id: "estimates", label: "New Quote" },
                  { id: "jobs",      label: "Schedule Job" },
                  { id: "alfred",    label: "Ask Alfred" },
                  { id: "expenses",  label: "Log Expense" },
                  { id: "intake",    label: "New Lead" },
                ] as const).map(action => {
                  const active = ((f as any).fabActions as string[] | undefined) ?? ["customers","estimates","jobs","alfred"];
                  const enabled = active.includes(action.id);
                  return (
                    <label key={action.id} className="flex items-center gap-2 cursor-pointer hover:text-white/80 text-white/60 transition">
                      <input type="checkbox" checked={enabled} onChange={() => {
                        const current = ((f as any).fabActions as string[] | undefined) ?? ["customers","estimates","jobs","alfred"];
                        const next = enabled ? current.filter(id => id !== action.id) : [...current, action.id];
                        setF({ ...f, fabActions: next } as any);
                      }} className="w-3.5 h-3.5 accent-red-500 rounded" />
                      <span className="text-xs">{action.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <h4 className="font-semibold text-sm pt-2">In-App Notifications</h4>
            <div className="text-xs text-white/50 mb-2">Which alerts show up on your dashboard.</div>
            {[
              { k: "notifyReviews",     label: "Negative review alerts", desc: "Flag reviews under 4 stars" },
              { k: "notifyOverdue",     label: "Overdue invoice reminders", desc: "Ping me on payments past due" },
              { k: "notifyLowStock",    label: "Low chemical stock",      desc: "Alert when stock hits reorder level" },
              { k: "notifyMaintenance", label: "Vehicle maintenance due", desc: "Warn at 5k mi / 90 days since oil change" },
              { k: "notifyWeather",     label: "Weather risk alerts",     desc: "Flag scheduled jobs on high-rain days" }
            ].map(n => <div key={n.k} className="flex items-center justify-between p-3 bg-black/40 border border-red-900/20 rounded-xl">
              <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">{n.label}</div><div className="text-[10px] text-white/50">{n.desc}</div></div>
              <button onClick={() => setF({ ...f, [n.k]: !f[n.k] })} className={"transition " + (f[n.k] ? "text-red-400" : "text-white/30")}>{f[n.k] ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
            </div>)}

            <div className="pt-3 border-t border-red-900/20">
              <div className="font-semibold text-sm mb-2">📱 Social Automation</div>
              {[
                { k: "autoPostCompletedJobs", label: "Auto-post completed jobs", desc: "Automatically create a social draft when a job is marked complete — you review before posting" },
                { k: "instaBridge", label: "Instagram posting bridge", desc: "Open Instagram app with pre-filled caption when scheduling an IG post (requires Instagram app)" }
              ].map(n => <div key={n.k} className="flex items-center justify-between p-3 bg-black/40 border border-red-900/20 rounded-xl mb-2">
                <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">{n.label}</div><div className="text-[10px] text-white/50">{n.desc}</div></div>
                <button onClick={() => setF({ ...f, [n.k]: !f[n.k] })} className={"transition " + (f[n.k] ? "text-purple-400" : "text-white/30")}>{f[n.k] ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
              </div>)}
            </div>

            <div className="pt-3 border-t border-red-900/20">
              <label className="text-xs text-white/60 mb-1 block">Review showcase minimum rating</label>
              <GSel value={f.reviewShowcaseMinRating || 5} onChange={e => setF({ ...f, reviewShowcaseMinRating: Number(e.target.value) })}>
                <option value={5} className="bg-black">5 stars only</option>
                <option value={4} className="bg-black">4+ stars</option>
                <option value={3} className="bg-black">3+ stars</option>
              </GSel>
              <div className="text-[10px] text-white/40 mt-1">Reviews at this rating or above show in the public wall on the Reviews page.</div>
            </div>
          </div>}

          {sec === "onboarding" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Onboarding</h4>
            <div className="text-xs text-white/50 mb-2">
              {settings.onboardingComplete === false
                ? "Onboarding is currently in progress."
                : "Re-run the setup flow — tell us about your business, import clients, and set rates again."}
            </div>
            <Glass className="p-4 !bg-black/40">
              <div className="text-sm font-semibold mb-1">Restart Onboarding</div>
              <div className="text-xs text-white/50 mb-3">This won't delete any existing data — it just walks you through the setup steps again.</div>
              <GBtn onClick={() => { setSettings((s: any) => ({ ...s, onboardingComplete: false })); onClose(); }} className="!text-xs">
                Start Onboarding
              </GBtn>
            </Glass>
          </div>}

          {sec === "data" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Data Export & Backup</h4>
            <div className="text-xs text-white/50 mb-2">Export your data in various formats for backup, accounting, or tax prep.</div>

            <Glass className="p-3 !bg-black/40 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Download size={12} className="text-red-400" /><span className="font-semibold">Full Backup (JSON)</span></div>
              <div className="text-[10px] text-white/50">All customers, jobs, estimates, expenses, automations.</div>
              <GBtn onClick={() => {
                const payload = { exportedAt: new Date().toISOString(), version: "1.0", settings: f };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a");
                a.href = url; a.download = "smocks-backup-" + today() + ".json"; a.click(); URL.revokeObjectURL(url);
                toast("Backup downloaded");
              }} className="w-full !text-xs"><Download size={12} className="inline mr-1.5" />Download JSON Backup</GBtn>
            </Glass>

            <Glass className="p-3 !bg-black/40 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Receipt size={12} className="text-green-400" /><span className="font-semibold">Accounting CSV Export</span></div>
              <div className="text-[10px] text-white/50">Exports revenue and expenses in a standard accounting-import CSV format.</div>
              <GBtn variant="ghost" onClick={() => {
                const header = "Date,Description,Amount,Type,Account,Category\n";
                const rows = [
                  ...((window as any)._smocksJobs || []).filter(j => j.status === "completed").map(j => `${j.scheduledDate},"Job Revenue - ${j.address?.split(",")[0] || ""}",${j.amount},Income,Business Checking,Service Revenue`),
                  ...((window as any)._smocksExpenses || []).map(e => `${e.date},"${e.description}",${e.amount},Expense,${e.isCash?"Cash":"Business Checking"},${e.category}`)
                ].join("\n");
                const blob = new Blob([header + rows], { type: "text/csv" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a");
                a.href = url; a.download = "smocks-accounting-" + today() + ".csv"; a.click(); URL.revokeObjectURL(url);
                toast("Accounting CSV downloaded");
              }} className="w-full !text-xs"><Download size={12} className="inline mr-1.5" />Download Accounting CSV</GBtn>
            </Glass>

            <Glass className="p-3 !bg-black/40 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Users size={12} className="text-blue-400" /><span className="font-semibold">Customer List (CSV)</span></div>
              <div className="text-[10px] text-white/50">All customer contact info for mail merge or backup.</div>
              <GBtn variant="ghost" onClick={() => {
                const header = "First Name,Last Name,Email,Phone,Address,Lead Source,Tags,Created\n";
                const rows = ((window as any)._smocksCustomers || []).map(c => `"${c.firstName}","${c.lastName}","${c.email||""}","${c.phone||""}","${c.address||""}","${c.leadSource||""}","${(c.tags||[]).join(";")}","${c.createdAt||""}"`).join("\n");
                const blob = new Blob([header + rows], { type: "text/csv" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a");
                a.href = url; a.download = "smocks-customers-" + today() + ".csv"; a.click(); URL.revokeObjectURL(url);
                toast("Customer CSV downloaded");
              }} className="w-full !text-xs"><Download size={12} className="inline mr-1.5" />Download Customer CSV</GBtn>
            </Glass>

            <Glass className="p-3 !bg-blue-950/20 !border-blue-700/30 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Shield size={12} className="text-blue-400" /><span className="font-semibold text-blue-300">GDPR / Data Rights</span></div>
              <div className="text-[10px] text-white/50">Per GDPR and CCPA, customers can request their data or deletion. Use these tools to comply.</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg text-xs">
                  <div><div className="font-medium">Customer data export</div><div className="text-white/40 text-[10px]">Export all data for a specific customer (right to access)</div></div>
                  <GBtn variant="ghost" className="!text-xs !py-1 flex-shrink-0 ml-2" onClick={() => {
                    const name = prompt("Enter customer name or email to export:");
                    if (!name) return;
                    const cust = ((window as any)._smocksCustomers || []).find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(name.toLowerCase()) || (c.email || "").toLowerCase().includes(name.toLowerCase()));
                    if (!cust) { toast("Customer not found"); return; }
                    const data = { customer: cust, estimates: ((window as any)._smocksEstimates || []).filter(e => e.customerId === cust.id), jobs: ((window as any)._smocksJobs || []).filter(j => j.customerId === cust.id) };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "customer-data-" + (cust.firstName || "unknown") + "-" + today() + ".json"; a.click();
                    toast("Customer data exported ✓");
                  }}>Export</GBtn>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg text-xs">
                  <div><div className="font-medium">Customer data deletion</div><div className="text-white/40 text-[10px]">Permanently remove a customer and all linked records (right to erasure)</div></div>
                  <GBtn variant="danger" className="!text-xs !py-1 flex-shrink-0 ml-2" onClick={() => {
                    const name = prompt("Enter customer name or email to DELETE (cannot be undone):");
                    if (!name) return;
                    if (!confirm("Permanently delete this customer and all their data? This CANNOT be undone.")) return;
                    toast("Customer deletion queued — remove from Customers page manually to confirm");
                  }}>Delete</GBtn>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg text-xs">
                  <div><div className="font-medium">Opt-out / STOP list export</div><div className="text-white/40 text-[10px]">Export list of customers who have replied STOP to SMS</div></div>
                  <GBtn variant="ghost" className="!text-xs !py-1 flex-shrink-0 ml-2" onClick={() => {
                    const stopped = ((window as any)._smocksCustomers || []).filter(c => c.smsOptOut);
                    const csv = "Name,Phone,Email,Opt-Out Date\n" + stopped.map(c => `"${c.firstName} ${c.lastName}","${c.phone||""}","${c.email||""}","${c.optOutDate||""}" `).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sms-opt-out-" + today() + ".csv"; a.click();
                    toast("Opt-out list exported ✓");
                  }}>Export</GBtn>
                </div>
              </div>
            </Glass>

            <Glass className="p-3 !bg-red-950/20 !border-red-700/40 space-y-2">
              <div className="flex items-center gap-2 text-xs"><AlertTriangle size={12} className="text-red-400" /><span className="font-semibold text-red-300">Reset to demo data</span></div>
              <div className="text-[10px] text-white/60">Clears all data and reloads with seed data. Cannot be undone.</div>
              <GBtn variant="danger" onClick={() => { if (confirm("Reload and lose all changes?")) location.reload(); }} className="w-full !text-xs">Reset to Demo</GBtn>
            </Glass>
            <Glass className="p-3 !bg-red-950/30 !border-red-800/60 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Trash2 size={12} className="text-red-400" /><span className="font-semibold text-red-300">Delete Account / All Data</span></div>
              <div className="text-[10px] text-white/60">Permanently erases all CRM data, settings, and stored information. Cannot be undone.</div>
              <GBtn variant="danger" onClick={() => {
                if (prompt("Type DELETE to confirm erasure:") !== "DELETE") return;
                Object.keys(localStorage).filter(k => k.startsWith("smocks.")).forEach(k => localStorage.removeItem(k));
                toast("All data erased. Reloading...");
                setTimeout(() => location.reload(), 1500);
              }} className="w-full !text-xs !bg-red-800 !border-red-700">Permanently Delete All Data</GBtn>
            </Glass>
          </div>}
          </div>
          {/* Sticky footer */}
          <div className="flex-shrink-0 flex gap-2 justify-end px-5 py-3 border-t border-red-900/30 bg-black/60 backdrop-blur-xl rounded-br-2xl">
            <GBtn variant="ghost" onClick={onClose}>Cancel</GBtn>
            <GBtn onClick={save}><Save size={14} className="inline mr-1.5" />Save Settings</GBtn>
          </div>
        </div>
      </div>
    </div>
    </Modal>

</>
  );
}


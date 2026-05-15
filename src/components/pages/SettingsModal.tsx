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

export function SettingsModal({ open, onClose, settings, setSettings, services, setServices, emailTemplates, setEmailTemplates, smsTemplates, setSmsTemplates, modelStatus = {}, setModelStatus = (() => {}) as any, toast }: { open?: any; onClose?: any; settings?: any; setSettings?: any; services?: any; setServices?: any; emailTemplates?: any; setEmailTemplates?: any; smsTemplates?: any; setSmsTemplates?: any; modelStatus?: any; setModelStatus?: any; toast?: any }) {
  const [f, setF] = useState(settings);
  const [sec, setSec] = useState("api");
  const [showKey, setShowKey] = useState(false);
  const [googleOAuth, setGoogleOAuth] = useState({ open: false, step: "account", email: "", selectedScopes: { gmail: true, calendar: true, drive: false, contacts: false } });

  useEffect(() => { if (open) setF(settings); }, [open, settings]);

  const save = () => { setSettings({ ...f, monthlyRevenueGoal: Number(f.monthlyRevenueGoal), monthlyJobsGoal: Number(f.monthlyJobsGoal), taxRate: Number(f.taxRate) }); onClose(); toast("Settings saved"); };

  const secs = [
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
    { key: "data", label: "Data", icon: Download }
  ];

  return (
    <>
    <Modal open={open} onClose={onClose} title="Settings" maxW="max-w-5xl" noBodyScroll>
      <div className="flex gap-0 h-full overflow-hidden">
        {/* Sidebar nav */}
        <div className="w-44 flex-shrink-0 border-r border-red-900/30 bg-black/40 rounded-bl-2xl overflow-y-auto py-2">
          {secs.map(s => {
            const Icon = s.icon;
            return <button key={s.key} onClick={() => setSec(s.key)} className={"w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition text-left " + (sec === s.key ? "bg-red-900/40 text-white border-r-2 border-red-500" : "text-white/50 hover:text-white hover:bg-white/5")}>
              <Icon size={13} className="flex-shrink-0" />{s.label}
            </button>;
          })}
        </div>
        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sec === "profile" && <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><User size={14} />My Profile</h4>
              <div className="flex items-center gap-4 mb-4 p-4 bg-black/40 border border-red-900/30 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
                  {(f.userName || f.companyName || "W")[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{f.userName || "Will Smock"}</div>
                  <div className="text-xs text-white/50">{f.userRole || "Owner · Smock's Pressure Washing"}</div>
                  <div className="text-xs text-white/40">{f.companyEmail || "—"}</div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><label className="text-xs text-white/60 mb-1 block">Your Name</label><GInput value={f.userName || ""} onChange={e => setF({ ...f, userName: e.target.value })} placeholder="Will Smock" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Role / Title</label><GInput value={f.userRole || ""} onChange={e => setF({ ...f, userRole: e.target.value })} placeholder="Owner" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Your Mobile # (for Alfred SMS)</label><GInput value={f.myPhone || ""} onChange={e => setF({ ...f, myPhone: e.target.value })} placeholder="+17175550100" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Business Email</label><GInput value={f.companyEmail || ""} onChange={e => setF({ ...f, companyEmail: e.target.value })} placeholder="will@smocks.com" /></div>
              </div>
            </div>
            <div className="p-3 bg-yellow-950/20 border border-yellow-700/30 rounded-xl text-xs text-yellow-200/70">
              <strong>Note:</strong> This app runs entirely in your browser — no passwords or accounts are needed. Your data is stored locally on this device.
            </div>
            <PinSettings toast={toast} />
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
                        body: JSON.stringify({ chat_id: f.telegramChatId, text: "🤖 Alfred here. Telegram is connected to your Smock's CRM. Reply with any slash command. Alfred out." })
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
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Mail size={13} className="text-green-400" />Resend API Key</h4>
              <div className="text-[11px] text-white/50 mb-2">Transactional email sending (estimates, invoices, campaigns) without Google. Free 3,000 emails/month.</div>
              <GInput type="password" value={f.resendKey || ""} onChange={e => setF({ ...f, resendKey: e.target.value })} placeholder="re_..." />
              <div className="text-[10px] text-white/40 mt-1"><a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">resend.com</a> — free to start</div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><MapPin size={13} className="text-red-400" />Google Maps API Key</h4>
              <div className="text-[11px] text-white/50 mb-2">Powers address autocomplete and satellite view for property estimation.</div>
              <GInput type="password" value={f.googleMapsKey || ""} onChange={e => setF({ ...f, googleMapsKey: e.target.value })} placeholder="AIza..." />
              <div className="text-[10px] text-white/40 mt-1"><a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.cloud.google.com</a> → Enable Maps JavaScript API</div>
            </div>
          </div>}

          {sec === "legal" && <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Shield size={14} className="text-red-400" />Legal Pages</h4>
            <div className="text-xs text-white/50">These pages are displayed in your client portal and estimate pages. Edit to match your business.</div>
            <Glass className="p-4">
              <div className="font-semibold text-sm mb-2">Privacy Policy</div>
              <GTxt rows={6} value={f.privacyPolicy || "Privacy Policy for Smock's Pressure Washing\n\nLast updated: " + today() + "\n\nWe collect your name, phone, email, and address to provide pressure washing services. We do not sell your information to third parties. Your data is used only for scheduling, invoicing, and communication related to our services. We use SMS (Twilio) and email to communicate with you about your service. You may opt out at any time by replying STOP to any text message.\n\nContact: smocks@smockspower.com"} onChange={e => setF({ ...f, privacyPolicy: e.target.value })} className="!text-xs" />
            </Glass>
            <Glass className="p-4">
              <div className="font-semibold text-sm mb-2">Terms of Service</div>
              <GTxt rows={6} value={f.termsOfService || "Terms of Service for Smock's Pressure Washing\n\nBy booking our services, you agree to:\n\n1. Payment is due upon completion unless otherwise agreed.\n2. Cancellations within 24 hours may incur a $50 fee.\n3. We are not liable for pre-existing damage to surfaces.\n4. Our 48-hour rain guarantee applies to soft wash services only.\n5. All estimates are valid for 30 days from the date issued.\n\nContact: (717) 555-0100 | smocks@smockspower.com"} onChange={e => setF({ ...f, termsOfService: e.target.value })} className="!text-xs" />
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
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Phone size={10} />Your Mobile # <span className="text-white/30 font-normal">(for Alfred SMS summaries)</span></label><GInput type="tel" value={f.myPhone || ""} onChange={e => setF({ ...f, myPhone: e.target.value })} placeholder="+17175550100" className="!text-xs" /></div>
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Star size={10} />Google Place ID <span className="text-white/30 font-normal">(for review links)</span></label><GInput value={f.googlePlaceId || ""} onChange={e => setF({ ...f, googlePlaceId: e.target.value })} placeholder="ChIJ..." className="!text-xs" /><div className="text-[10px] text-white/30 mt-1">Find at <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">developers.google.com/maps/…/place-id</a></div></div>
            <div>
              <label className="text-xs text-white/60 mb-2 block flex items-center gap-1">🎨 Brand Colors</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Primary", key: "brandPrimary", def: "#dc2626" },
                  { label: "Accent", key: "brandAccent", def: "#991b1b" },
                  { label: "Background", key: "brandBg", def: "#000000" }
                ].map(c => (
                  <div key={c.key}>
                    <label className="text-[10px] text-white/50 mb-1 block">{c.label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={f[c.key] || c.def} onChange={e => setF({ ...f, [c.key]: e.target.value })} className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent" />
                      <input type="text" value={f[c.key] || c.def} onChange={e => setF({ ...f, [c.key]: e.target.value })} className="flex-1 bg-black/40 border border-red-900/30 rounded-lg px-2 py-1.5 text-xs text-white font-mono" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-white/30 mt-2">Colors apply to estimate portal, review landing, and lead intake form branding.</div>
            </div>
          </div>}

          {sec === "goals" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Goals & Tax</h4>
            <div><label className="text-xs text-white/60 mb-1 block">Monthly Revenue Goal ($)</label><GInput type="number" value={f.monthlyRevenueGoal} onChange={e => setF({ ...f, monthlyRevenueGoal: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Quarterly Revenue Goal ($)</label><GInput type="number" value={f.quarterlyRevenueGoal || ""} onChange={e => setF({ ...f, quarterlyRevenueGoal: e.target.value })} placeholder={(f.monthlyRevenueGoal * 3) || "45000"} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Monthly Jobs Goal</label><GInput type="number" value={f.monthlyJobsGoal} onChange={e => setF({ ...f, monthlyJobsGoal: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Tax Rate (%)</label><GInput type="number" step="0.01" value={f.taxRate} onChange={e => setF({ ...f, taxRate: e.target.value })} /></div>
          </div>}

          {sec === "templates" && <TemplateEditor emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} smsTemplates={smsTemplates} setSmsTemplates={setSmsTemplates} settings={f} setSettings={newF => setF(newF)} />}

          {sec === "integrations" && <div className="space-y-4">
            <h4 className="font-semibold text-sm">Integrations</h4>

            {/* Google — OAuth for Maps, Tasks, Calendar, Gmail, Drive */}
            <Glass className={"p-4 " + (f.googleConnected ? "!bg-gradient-to-br !from-blue-950/30 !to-black/60 !border-blue-600/40" : "!bg-black/40")}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                  <div className="font-semibold text-sm">Google Account</div>
                </div>
                <Badge tone={f.googleConnected ? "green" : "gray"}>{f.googleConnected ? "✓ " + (f.googleEmail || "Connected") : "Not connected"}</Badge>
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
                      const on = s.k === "maps" ? !!(f.googleMapsKey || f.googleConnected) : (f.googleScopes || {})[s.k];
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
                        { id: "smocks", label: "Smock's Pressure Washing", color: "#DB4437" },
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

                  <GBtn variant="danger" onClick={() => setF({ ...f, googleConnected: false, googleToken: "", googleEmail: "", googleRefreshToken: "", googleScopes: {} })} className="w-full !text-xs">
                    Disconnect Google Account
                  </GBtn>
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

                  {/* Mock OAuth button */}
                  <button
                    onClick={() => setGoogleOAuth({ open: true, step: "account", email: "", selectedScopes: { gmail: true, calendar: true, drive: true, contacts: true, maps: true } as any })}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
                  >
                    <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                    Sign in with Google
                  </button>

                  {/* Production setup instructions */}
                  <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[10px] text-white/50 space-y-1.5">
                    <div className="font-semibold text-white/70">Production Setup</div>
                    <div>1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.cloud.google.com</a> → New project</div>
                    <div>2. Enable: Calendar API, Tasks API, Gmail API, Maps JavaScript API, Drive API, People API</div>
                    <div>3. Create OAuth 2.0 credentials (Web application type)</div>
                    <div>4. Add your domain as authorized origin + redirect URI</div>
                    <div>5. Deploy the Smock's backend to Railway — paste URL above</div>
                    <div>6. Visit /auth/google on your backend to complete OAuth</div>
                  </div>
                </div>
              )}
            </Glass>

            {/* Stripe */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><CreditCard size={14} className="text-purple-400" /><div className="font-semibold text-sm">Stripe</div></div>
                <Badge tone={f.stripeConnected ? "green" : "gray"}>{f.stripeConnected ? "Connected" : "Disconnected"}</Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">Accept deposits, payments, and tips on estimates.</div>
              {f.stripeConnected ? <GBtn variant="danger" onClick={() => setF({ ...f, stripeConnected: false })} className="w-full !text-xs">Disconnect</GBtn> : <GBtn onClick={() => setF({ ...f, stripeConnected: true })} className="w-full !text-xs">Connect Stripe (Mock)</GBtn>}
            </Glass>

            {/* QuickBooks */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><Receipt size={14} className="text-green-400" /><div className="font-semibold text-sm">QuickBooks Online</div></div>
                <Badge tone={f.quickbooksConnected ? "green" : "gray"}>{f.quickbooksConnected ? "Connected" : "Disconnected"}</Badge>

              </div>
              <div className="text-xs text-white/60 mb-3">Auto-sync invoices, payments, and customers.</div>
              {f.quickbooksConnected ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs p-2 bg-green-950/20 border border-green-800/30 rounded-lg">
                    <div className="text-center"><div className="text-white/50">Invoices</div><div className="font-bold text-green-400">12</div></div>
                    <div className="text-center"><div className="text-white/50">Payments</div><div className="font-bold text-green-400">9</div></div>
                    <div className="text-center"><div className="text-white/50">Last sync</div><div className="font-bold text-white/70">2h ago</div></div>
                  </div>
                  <GBtn variant="danger" onClick={() => setF({ ...f, quickbooksConnected: false })} className="w-full !text-xs">Disconnect</GBtn>
                </div>
              ) : <GBtn onClick={() => setF({ ...f, quickbooksConnected: true })} className="w-full !text-xs">Connect QuickBooks (Mock)</GBtn>}
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
              <div className="flex items-center gap-2 text-xs"><Receipt size={12} className="text-green-400" /><span className="font-semibold">QuickBooks CSV Export</span></div>
              <div className="text-[10px] text-white/50">Exports revenue and expenses in QuickBooks-compatible CSV format.</div>
              <GBtn variant="ghost" onClick={() => {
                const header = "Date,Description,Amount,Type,Account,Category\n";
                const rows = [
                  ...((window as any)._smocksJobs || []).filter(j => j.status === "completed").map(j => `${j.scheduledDate},"Job Revenue - ${j.address?.split(",")[0] || ""}",${j.amount},Income,Business Checking,Service Revenue`),
                  ...((window as any)._smocksExpenses || []).map(e => `${e.date},"${e.description}",${e.amount},Expense,${e.isCash?"Cash":"Business Checking"},${e.category}`)
                ].join("\n");
                const blob = new Blob([header + rows], { type: "text/csv" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a");
                a.href = url; a.download = "smocks-quickbooks-" + today() + ".csv"; a.click(); URL.revokeObjectURL(url);
                toast("QuickBooks CSV downloaded");
              }} className="w-full !text-xs"><Download size={12} className="inline mr-1.5" />Download QuickBooks CSV</GBtn>
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
    </Modal>

    {/* Google OAuth simulation modal */}
    <Modal open={googleOAuth.open} onClose={() => setGoogleOAuth({ ...googleOAuth, open: false })} title="" maxW="max-w-md">
      <div className="-mx-4 -mt-2">
        {/* Google-style header */}
        <div className="px-6 pt-4 pb-5 border-b border-white/10 flex items-center gap-3">
          <svg viewBox="0 0 48 48" width="24" height="24"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          <div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider">Sign in with Google</div>
            <div className="text-xs text-white/40">to continue to Smock's CRM</div>
          </div>
        </div>

        <div className="px-6 py-6">
          {googleOAuth.step === "account" && <div className="space-y-4">
            <div className="text-base font-medium">Choose an account</div>
            <div className="space-y-2">
              {["smock.owner@gmail.com", "info@smocks.com"].map(em => (
                <button key={em} onClick={() => setGoogleOAuth({ ...googleOAuth, email: em, step: "scopes" })} className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:border-blue-500/40 hover:bg-blue-950/20 transition">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold">{em[0].toUpperCase()}</div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">{em.split("@")[0]}</div>
                    <div className="text-[10px] text-white/50">{em}</div>
                  </div>
                  <ChevronRight size={14} className="text-white/30" />
                </button>
              ))}
            </div>
            <button onClick={() => setGoogleOAuth({ ...googleOAuth, step: "custom" })} className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-white/10 hover:border-blue-500/40 transition text-white/70">
              <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><Plus size={14} /></div>
              <div className="text-sm">Use another account</div>
            </button>
            <div className="text-[10px] text-white/40 mt-4 p-3 bg-yellow-950/20 border border-yellow-800/30 rounded-lg">
              🎭 <strong>Mock OAuth flow</strong> — in production this would be Google's real consent screen. No real data leaves your browser.
            </div>
          </div>}

          {googleOAuth.step === "custom" && <div className="space-y-3">
            <div className="text-base font-medium">Enter email address</div>
            <GInput autoFocus value={googleOAuth.email} onChange={e => setGoogleOAuth({ ...googleOAuth, email: e.target.value })} placeholder="you@example.com" />
            <div className="flex gap-2 justify-end">
              <GBtn variant="ghost" onClick={() => setGoogleOAuth({ ...googleOAuth, step: "account", email: "" })}>Back</GBtn>
              <GBtn onClick={() => setGoogleOAuth({ ...googleOAuth, step: "scopes" })} disabled={!/^.+@.+\..+/.test(googleOAuth.email)}>Next</GBtn>
            </div>
          </div>}

          {googleOAuth.step === "scopes" && <div className="space-y-4">
            <div>
              <div className="text-xs text-white/50 mb-2">Signed in as <span className="text-blue-300">{googleOAuth.email}</span></div>
              <div className="text-base font-medium">Smock's CRM wants to access your Google Account</div>
            </div>
            <div className="space-y-2">
              {[
                { k: "gmail", label: "Gmail", desc: "Read, send, and manage email", icon: Mail },
                { k: "calendar", label: "Calendar", desc: "View and edit events on your calendars", icon: Calendar },
                { k: "drive", label: "Drive", desc: "See, edit, create, and delete your Drive files", icon: Cloud },
                { k: "contacts", label: "Contacts", desc: "Manage your contacts", icon: Users }
              ].map(s => {
                const Icon = s.icon;
                const on = googleOAuth.selectedScopes[s.k];
                return <label key={s.k} className="flex items-start gap-3 p-3 bg-black/40 border border-white/10 rounded-xl hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={on} onChange={() => setGoogleOAuth({ ...googleOAuth, selectedScopes: { ...googleOAuth.selectedScopes, [s.k]: !on } })} className="mt-0.5 w-4 h-4 accent-blue-600" />
                  <Icon size={14} className={"mt-0.5 " + (on ? "text-blue-400" : "text-white/40")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold">{s.label}</div>
                    <div className="text-[10px] text-white/50">{s.desc}</div>
                  </div>
                </label>;
              })}
            </div>
            <div className="text-[10px] text-white/40 leading-relaxed">By clicking <strong>Allow</strong>, you let Smock's CRM use your info per its Privacy Policy. You can revoke access in your Google Account at any time.</div>
            <div className="flex gap-2 justify-end">
              <GBtn variant="ghost" onClick={() => setGoogleOAuth({ ...googleOAuth, open: false })}>Cancel</GBtn>
              <GBtn onClick={() => {
                const scopesTrue = googleOAuth.selectedScopes;
                setF({ ...f, googleConnected: true, googleEmail: googleOAuth.email, googleScopes: scopesTrue });
                setGoogleOAuth({ ...googleOAuth, open: false });
                toast("Connected to Google as " + googleOAuth.email);
              }} disabled={!Object.values(googleOAuth.selectedScopes).some(Boolean)}>Allow</GBtn>
            </div>
          </div>}
        </div>
      </div>
    </Modal>
    </>
  );
}


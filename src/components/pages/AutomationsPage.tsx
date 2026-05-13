// @ts-nocheck
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

export function AutomationsPage({ automations = [], setAutomations, jobs = [], customers = [], estimates = [], settings = {}, toast }) {
  const [builderOpen, setBuilderOpen] = useState({ open: false, data: null });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [logOpen, setLogOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  const execLog = useAutomationEngine(automations, setAutomations, jobs, customers, estimates, toast, settings);

  const toggle = id => setAutomations(automations.map(a => a.id === id ? { ...a, active: !a.active } : a));
  const del = id => { if (confirm("Delete this workflow?")) setAutomations(automations.filter(a => a.id !== id)); };

  const inferCtxType = a => {
    const t = (a.steps?.[0]?.label || a.trigger || "").toLowerCase();
    if (t.match(/job complete|after job|post.?job/)) return "job_complete";
    if (t.match(/job start|crew start/)) return "job_started";
    if (t.match(/job schedul|24h before/)) return "job_scheduled";
    if (t.match(/estimate sent|quote sent/)) return "estimate_sent";
    if (t.match(/new (customer|inquiry|lead)/)) return "customer_added";
    if (t.match(/invoice|unpaid|overdue/)) return "invoice_unpaid";
    if (t.match(/review|rating/)) return "review_submitted";
    return "manual";
  };

  const testRun = async a => {
    const mockCustomer = customers[0] || { firstName: "Jennifer", lastName: "Walsh", email: "j@test.com", phone: "+17175550201" };
    const mockJob = jobs.find(j => j.status === "completed") || jobs[0] || { id: "mock", amount: 742, scheduledDate: today(), status: "completed" };
    const result = await runWorkflow(a, { type: inferCtxType(a), job: mockJob, customer: mockCustomer, estimate: estimates[0] || null, daysSinceInvoiced: 8, daysSinceLast: 200, rating: 5 }, toast, settings);
    if (!result.triggered) { toast(`Trigger didn't match — click Edit to adjust`, "error"); return; }
    setAutomations(prev => prev.map(x => x.id === a.id ? { ...x, count: (x.count || 0) + 1, lastTriggered: today(), runLog: [...(x.runLog || []), ...result.log].slice(0, 50) } : x));
    toast(`✅ Test run — ${result.log.length} step${result.log.length !== 1 ? "s" : ""} fired`);
  };

  const openBuilder = (data = null) => setBuilderOpen({ open: true, data: data || { name: "", category: "other", icon: "⚡", steps: [{ id: uid(), type: "trigger", label: "Choose a trigger…" }] } });

  const catOf = a => {
    const t = (a.trigger || a.steps?.[0]?.label || "").toLowerCase();
    if (t.match(/estimate|quote/)) return "estimates";
    if (t.match(/job|crew|schedule/)) return "jobs";
    if (t.match(/invoice|payment|paid|overdue|unpaid/)) return "payments";
    if (t.match(/review|complete/)) return "reviews";
    if (t.match(/annual|birthday|anniversary|month|seasonal/)) return "lifecycle";
    if (t.match(/referral/)) return "referrals";
    return "other";
  };

  const NODE_COLORS = {
    trigger:   { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd", icon: "▶" },
    condition: { bg: "#3f2f00", border: "#f59e0b", text: "#fcd34d", icon: "⬡" },
    delay:     { bg: "#2d1b69", border: "#8b5cf6", text: "#c4b5fd", icon: "⏳" },
    action:    { bg: "#052e16", border: "#16a34a", text: "#86efac", icon: "⚡" },
    branch:    { bg: "#4c0519", border: "#e11d48", text: "#fda4af", icon: "⑂" },
  };

  const catMeta = {
    estimates: { label: "Estimates", icon: FileText, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    jobs:      { label: "Jobs",      icon: Briefcase, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
    payments:  { label: "Payments",  icon: DollarSign, color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
    reviews:   { label: "Reviews",   icon: Star, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    lifecycle: { label: "Lifecycle", icon: Heart, color: "#ec4899", bg: "rgba(236,72,153,0.1)" },
    referrals: { label: "Referrals", icon: Award, color: "#a855f7", bg: "rgba(168,85,247,0.1)" },
    other:     { label: "Other",     icon: Workflow, color: "#64748b", bg: "rgba(100,116,139,0.1)" }
  };

  const filtered = automations
    .filter(a => !search || (a.name + a.trigger + a.action).toLowerCase().includes(search.toLowerCase()))
    .filter(a => category === "all" || catOf(a) === category);

  const activeCount = automations.filter(a => a.active).length;
  const totalRuns = automations.reduce((s, a) => s + (a.count || 0), 0);

  // Render inline node flow strip for a workflow card
  const NodeStrip = ({ steps }) => {
    const show = (steps || []).slice(0, 5);
    return (
      <div className="flex items-center gap-0 overflow-hidden">
        {show.map((step, i) => {
          const nc = NODE_COLORS[step.type] || NODE_COLORS.action;
          return (
            <React.Fragment key={step.id || i}>
              {i > 0 && <div className="w-5 h-px flex-shrink-0" style={{ background: "linear-gradient(90deg, " + NODE_COLORS[show[i-1].type]?.border + ", " + nc.border + ")" }} />}
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium flex-shrink-0 border" style={{ background: nc.bg, borderColor: nc.border + "80", color: nc.text }}>
                <span>{nc.icon}</span>
                <span className="max-w-[80px] truncate hidden sm:block">{step.label || step.type}</span>
              </div>
            </React.Fragment>
          );
        })}
        {(steps || []).length > 5 && (
          <>
            <div className="w-4 h-px bg-white/20 flex-shrink-0" />
            <span className="text-[9px] text-white/40 flex-shrink-0">+{steps.length - 5}</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Workflow size={20} className="text-purple-400" />
            Automation Hub
          </h2>
          <div className="text-xs text-white/50 mt-0.5">{activeCount} active · {totalRuns} total runs · workflows fire automatically as events happen</div>
        </div>
        <div className="flex items-center gap-2">
          <GBtn variant="ghost" onClick={() => setLogOpen(!logOpen)} className={"!text-xs " + (execLog.length > 0 ? "!border-green-700/50 !text-green-400" : "")}>
            <Activity size={12} className="inline mr-1.5" />Log {execLog.length > 0 && `(${execLog.length})`}
          </GBtn>
          <GBtn variant="ghost" onClick={() => setTemplatesOpen(true)} className="!text-xs">
            <Layers size={12} className="inline mr-1.5" />Templates
          </GBtn>
          <GBtn onClick={() => openBuilder()} className="!text-sm">
            <Plus size={14} className="inline mr-1.5" />New Workflow
          </GBtn>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active", value: activeCount, icon: "🟢", color: "text-green-400" },
          { label: "Paused", value: automations.length - activeCount, icon: "⏸", color: "text-white/50" },
          { label: "Total Runs", value: totalRuns, icon: "▶", color: "text-purple-400" },
          { label: "Fired Today", value: automations.filter(a => a.lastTriggered === today()).length, icon: "⚡", color: "text-yellow-400" },
        ].map(s => (
          <Glass key={s.label} className="p-4 flex items-center gap-3">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className={"text-2xl font-bold " + s.color}>{s.value}</div>
              <div className="text-[10px] text-white/50">{s.label}</div>
            </div>
          </Glass>
        ))}
      </div>

      {/* Execution log */}
      {logOpen && (
        <Glass className="p-4 !bg-black/80 !border-green-700/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-2 h-2 rounded-full bg-green-400 anim-pulse" />
              Execution Log
              <span className="text-[10px] text-white/40 font-normal">{execLog.length} entries</span>
            </div>
            <button onClick={() => setLogOpen(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
          </div>
          {execLog.length === 0
            ? <div className="text-xs text-white/40 text-center py-6">No executions yet. Click ▶ Test on any workflow, or trigger one by changing a job status.</div>
            : <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {execLog.slice(0, 30).map((l, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-green-950/20 border border-green-800/30 text-xs">
                  <span className="flex-shrink-0">{l.channel === "email" ? "📧" : l.channel === "sms" ? "💬" : l.channel === "task" ? "✅" : l.channel === "delay" ? "⏳" : "🔔"}</span>
                  <span className="flex-1 truncate text-white/80">{l.message}</span>
                  {l.workflowName && <span className="text-[9px] text-white/40 flex-shrink-0">{l.workflowName}</span>}
                  <span className="text-[9px] text-white/30 flex-shrink-0">{new Date(l.ts).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          }
        </Glass>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows…" className="bg-black/40 border border-red-900/30 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-red-500/60 w-48" />
        </div>
        <div className="flex gap-1 bg-black/40 border border-red-900/30 rounded-xl p-1">
          <button onClick={() => setCategory("all")} className={"px-2.5 py-1 rounded-lg text-[10px] font-semibold transition " + (category === "all" ? "bg-red-600/30 text-white" : "text-white/40 hover:text-white")}>All {automations.length}</button>
          {Object.entries(catMeta).map(([k, m]) => {
            const n = automations.filter(a => catOf(a) === k).length;
            if (!n) return null;
            const Icon = m.icon;
            return <button key={k} onClick={() => setCategory(k === category ? "all" : k)} className={"px-2 py-1 rounded-lg text-[10px] font-semibold transition flex items-center gap-1 " + (category === k ? "text-white" : "text-white/40 hover:text-white")} style={category === k ? { background: m.bg } : {}}>
              <Icon size={9} style={{ color: m.color }} />{m.label} {n}
            </button>;
          })}
        </div>
      </div>

      {/* Workflow cards — n8n style */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Workflow size={48} className="mx-auto mb-4 text-white/20 anim-float" />
          <div className="text-white/50 font-semibold mb-1">No workflows yet</div>
          <div className="text-xs text-white/30 mb-4">Create your first automation or pick a template</div>
          <div className="flex gap-2 justify-center">
            <GBtn onClick={() => setTemplatesOpen(true)} variant="ghost">Browse Templates</GBtn>
            <GBtn onClick={() => openBuilder()}>New Workflow</GBtn>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map(a => {
            const cat = catOf(a);
            const cm = catMeta[cat];
            const CatIcon = cm.icon;
            const steps = a.steps || [];
            const isActive = a.active;
            const hovered = hoveredId === a.id;

            return (
              <div
                key={a.id}
                className="group relative rounded-2xl border transition-all duration-200"
                style={{
                  background: isActive ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)",
                  borderColor: hovered ? (isActive ? "#9333ea60" : "#ffffff20") : (isActive ? "#7c3aed30" : "#7f1d1d20"),
                  boxShadow: hovered && isActive ? "0 0 0 1px #9333ea40, 0 8px 32px -8px rgba(0,0,0,0.8)" : "none"
                }}
                onMouseEnter={() => setHoveredId(a.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Active indicator bar */}
                {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-purple-500 to-blue-500" />}

                <div className="p-4">
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="text-2xl flex-shrink-0">{a.icon || "⚡"}</div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm leading-tight truncate">{a.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CatIcon size={9} style={{ color: cm.color }} />
                          <span className="text-[10px]" style={{ color: cm.color }}>{cm.label}</span>
                          {steps.length > 0 && <span className="text-[9px] text-white/30">· {steps.length} steps</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Run count badge */}
                      {(a.count || 0) > 0 && (
                        <div className="px-2 py-0.5 rounded-full text-[9px] font-bold border" style={{ background: "rgba(147,51,234,0.15)", borderColor: "#9333ea40", color: "#c084fc" }}>
                          ▶ {a.count} run{a.count !== 1 ? "s" : ""}
                        </div>
                      )}
                      {/* Toggle */}
                      <button onClick={() => toggle(a.id)} className="flex-shrink-0">
                        {isActive
                          ? <ToggleRight size={28} className="text-green-400 hover:text-green-300 transition" />
                          : <ToggleLeft size={28} className="text-white/25 hover:text-white/50 transition" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Node flow strip */}
                  <div className="mb-3 p-2 rounded-xl border border-white/5 bg-black/40 overflow-hidden">
                    {steps.length > 0 ? (
                      <NodeStrip steps={steps} />
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="px-2 py-1 rounded-lg text-[10px] border" style={{ background: NODE_COLORS.trigger.bg, borderColor: NODE_COLORS.trigger.border + "80", color: NODE_COLORS.trigger.text }}>
                          ▶ {a.trigger || "Trigger"}
                        </div>
                        <div className="w-8 h-px bg-white/20" />
                        <div className="px-2 py-1 rounded-lg text-[10px] border" style={{ background: NODE_COLORS.action.bg, borderColor: NODE_COLORS.action.border + "80", color: NODE_COLORS.action.text }}>
                          ⚡ {a.action || "Action"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-white/35 flex items-center gap-2">
                      {a.lastTriggered
                        ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Last ran {a.lastTriggered}</>
                        : <><span className="w-1.5 h-1.5 rounded-full bg-white/20 inline-block" /> Never triggered</>
                      }
                    </div>
                    {/* Action buttons — appear on hover */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">
                      <button onClick={() => testRun(a)} title="Test run" className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/40 hover:text-green-400 transition flex items-center gap-1 text-[10px]">
                        <Play size={11} /> Test
                      </button>
                      <button onClick={() => openBuilder(a)} title="Edit" className="p-1.5 rounded-lg hover:bg-purple-900/30 text-white/40 hover:text-purple-400 transition flex items-center gap-1 text-[10px]">
                        <Edit size={11} /> Edit
                      </button>
                      <button onClick={() => del(a.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-900/30 text-white/40 hover:text-red-400 transition">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template Gallery */}
      <Modal open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Workflow Templates" maxW="max-w-4xl">
        <div className="space-y-3">
          <div className="text-xs text-white/60">Click any template to open it in the workflow builder. Customize it, then save.</div>
          <div className="grid md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {AUTOMATION_TEMPLATES.map(tpl => (
              <button key={tpl.id} onClick={() => {
                const cloned = { name: tpl.name, category: tpl.category, icon: tpl.icon, description: tpl.description, steps: tpl.steps.map(s => ({ ...s, id: uid() })), trigger: tpl.steps[0]?.label || "", action: tpl.steps.find(s => s.type === "action")?.label || "" };
                setBuilderOpen({ open: true, data: cloned });
                setTemplatesOpen(false);
              }} className="text-left p-4 rounded-xl bg-black/40 border border-red-900/20 hover:border-purple-500/50 hover:bg-purple-950/20 transition group">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{tpl.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm group-hover:text-purple-300 transition">{tpl.name}</div>
                    <div className="text-[10px] text-white/50 mt-0.5 line-clamp-2">{tpl.description}</div>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {tpl.steps.slice(0, 6).map((s, i) => {
                        const nc = NODE_COLORS[s.type] || NODE_COLORS.action;
                        return <span key={i} className="text-[9px] px-1.5 py-0.5 rounded border" style={{ background: nc.bg, borderColor: nc.border + "60", color: nc.text }}>{nc.icon}</span>;
                      })}
                      {tpl.steps.length > 6 && <span className="text-[9px] text-white/30">+{tpl.steps.length - 6}</span>}
                      <span className="text-[9px] text-white/30 ml-1">{tpl.steps.length} steps</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {/* Blank template */}
            <button onClick={() => { openBuilder(); setTemplatesOpen(false); }} className="text-left p-4 rounded-xl border border-dashed border-white/20 hover:border-purple-500/50 hover:bg-purple-950/10 transition">
              <div className="flex items-center gap-3">
                <span className="text-3xl">➕</span>
                <div>
                  <div className="font-semibold text-sm text-white/70">Start from blank</div>
                  <div className="text-[10px] text-white/40">Build your own workflow step by step</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Visual Workflow Builder */}
      <VisualWorkflowBuilder open={builderOpen.open} data={builderOpen.data} onClose={() => setBuilderOpen({ open: false, data: null })} onSave={d => {
        const firstTrigger = d.steps.find(s => s.type === "trigger");
        const firstAction = d.steps.find(s => s.type === "action");
        const newAuto = { id: d.id || uid(), name: d.name, trigger: firstTrigger?.label || "Manual", action: firstAction?.label || "", steps: d.steps, isWorkflow: true, category: d.category, icon: d.icon, description: d.description, count: d.count || 0, lastTriggered: d.lastTriggered || null, active: d.active !== false, runLog: d.runLog || [] };
        if (d.id && automations.some(a => a.id === d.id)) setAutomations(automations.map(a => a.id === d.id ? newAuto : a));
        else setAutomations([...automations, newAuto]);
        setBuilderOpen({ open: false, data: null });
        toast("Workflow saved · " + d.steps.length + " steps");
      }} />
    </div>
  );
}

// ===== VISUAL WORKFLOW BUILDER (n8n-style) =====

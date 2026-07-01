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
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { Stat } from "./Stat";
import { PBar } from "./PBar";
import { PageFade } from "./PageFade";
import { TimeframeSelector } from "./TimeframeSelector";

export function AIModelsSection({ f, setF, modelStatus, setModelStatus, toast }) {
  const [, forceTick] = useState(0);
  const [showKey, setShowKey] = useState({});
  const ms: Record<string, any> = modelStatus || {};

  // Tick every second so countdown timers update live
  useEffect(() => {
    if (!modelStatus || Object.values(ms).every((s: any) => !s?.lockedUntil || s.lockedUntil < Date.now())) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [modelStatus]);

  // Always show all 5 models — merge saved order with any missing models
  const allModelIds = Object.keys(MODELS);
  const savedPriority: string[] = f.modelPriority || [];
  const priority = [
    ...savedPriority.filter((id: string) => MODELS[id]),
    ...allModelIds.filter(id => !savedPriority.includes(id)),
  ];
  const modelKeys = f.modelKeys || {};
  const activeModel = f.activeModel || "claude";

  const fmtDuration = ms => {
    if (ms <= 0) return "ready";
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + "s";
    const m = Math.floor(s / 60);
    const rs = s % 60;
    if (m < 60) return m + "m " + rs + "s";
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return h + "h " + rm + "m";
  };

  const moveUp = mid => {
    const i = priority.indexOf(mid);
    if (i <= 0) return;
    const next = [...priority];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setF({ ...f, modelPriority: next });
  };
  const moveDown = mid => {
    const i = priority.indexOf(mid);
    if (i === -1 || i >= priority.length - 1) return;
    const next = [...priority];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setF({ ...f, modelPriority: next });
  };
  const clearLock = mid => {
    setModelStatus(s => { const n = { ...s }; delete n[mid]; return n; });
    toast(MODELS[mid].name + " unlocked");
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-sm">AI Models & Failover</h4>
        <div className="text-[11px] text-white/50 mt-1">Alfred can use multiple AI providers. Add API keys to enable each, and turn on failover to auto-switch when one hits its rate limit.</div>
      </div>

      {/* Master failover toggle */}
      <Glass className="p-4 !bg-gradient-to-br !from-purple-950/20 !to-black/60 !border-purple-700/40">
        <div className="flex items-start gap-3">
          <button onClick={() => setF({ ...f, failoverEnabled: !f.failoverEnabled })}>{f.failoverEnabled ? <ToggleRight size={28} className="text-purple-400" /> : <ToggleLeft size={28} className="text-white/30" />}</button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Auto-failover</div>
            <div className="text-[11px] text-white/60 mt-0.5">When the active model hits a rate limit or fails, automatically try the next model in the priority order below. Recommended.</div>
          </div>
        </div>
      </Glass>

      {/* Active model picker */}
      <div>
        <label className="text-xs text-white/60 mb-2 block">Active model (first to try)</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.values(MODELS).map(m => {
            const hasKey = !m.needsKey || !!modelKeys[m.id];
            const isActive = activeModel === m.id;
            const locked = (ms[m.id] as any)?.lockedUntil > Date.now();
            return <button key={m.id} onClick={() => { if (hasKey) setF({ ...f, activeModel: m.id }); else toast("Add " + m.name + " API key first"); }} className={"p-3 rounded-xl border text-left transition " + (isActive ? "bg-gradient-to-br " + m.color + " border-white/30 text-white" : hasKey ? "bg-black/40 border-red-900/30 hover:border-red-600/50" : "bg-white/5 border-white/10 opacity-50")}>
              <div className="flex items-center justify-between gap-1">
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  {m.name}
                  {m.free && <span className="text-[8px] px-1 py-0.5 rounded bg-green-900/40 border border-green-600/40 text-green-300 font-bold uppercase tracking-wide">Free</span>}
                </div>
                {isActive && <CheckCircle size={12} />}
                {locked && !isActive && <Clock size={11} className="text-yellow-400" />}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">{m.label}</div>
              {m.needsKey && !hasKey && <div className="text-[9px] mt-1 text-yellow-400">No API key</div>}
            </button>;
          })}
        </div>
      </div>

      {/* Per-model configuration */}
      <div>
        <label className="text-xs text-white/60 mb-2 block">Priority order & API keys</label>
        <div className="space-y-2">
          {priority.map((mid, idx) => {
            const m = (MODELS as any)[mid];
            if (!m) return null;
            const status: any = ms[mid];
            const locked = status?.lockedUntil > Date.now();
            const remaining = locked ? status.lockedUntil - Date.now() : 0;
            const hasKey = !m.needsKey || !!modelKeys[mid];
            return <Glass key={mid} className={"p-3 " + (locked ? "!bg-yellow-950/20 !border-yellow-700/40" : hasKey ? "!bg-black/40" : "!bg-white/5 opacity-70")}>
              <div className="flex items-start gap-3">
                {/* Priority controls */}
                <div className="flex flex-col gap-0.5 pt-1">
                  <button onClick={() => moveUp(mid)} disabled={idx === 0} className="p-0.5 text-white/40 hover:text-white disabled:opacity-20"><ChevronLeft size={12} className="rotate-90" /></button>
                  <div className="text-[9px] text-white/40 text-center font-mono">{idx + 1}</div>
                  <button onClick={() => moveDown(mid)} disabled={idx === priority.length - 1} className="p-0.5 text-white/40 hover:text-white disabled:opacity-20"><ChevronLeft size={12} className="-rotate-90" /></button>
                </div>

                <div className={"w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br " + m.color}><Bot size={14} /></div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-sm">{m.name}</div>
                    {m.free && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/40 border border-green-600/40 text-green-300 font-bold uppercase tracking-wide">Free</span>}
                    <Badge tone={locked ? "yellow" : hasKey ? "green" : "gray"}>{locked ? "Rate-limited" : hasKey ? "Ready" : "No key"}</Badge>
                    {m.supportsTools && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/30 border border-purple-700/40 text-purple-300">tools</span>}
                  </div>
                  <div className="text-[10px] text-white/50 mt-0.5">{m.label} · {m.provider}</div>

                  {locked && <div className="mt-2 p-2 bg-yellow-950/30 border border-yellow-700/40 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-yellow-300"><Clock size={11} /><span>Resets in <span className="font-mono font-bold">{fmtDuration(remaining)}</span></span></div>
                    <button onClick={() => clearLock(mid)} className="text-[10px] text-yellow-400 hover:text-yellow-300 underline">Reset now</button>
                  </div>}

                  {m.needsKey && <div className="mt-2">
                    <div className="relative">
                      <GInput type={showKey[mid] ? "text" : "password"} placeholder={"Paste your " + m.name + " API key"} value={modelKeys[mid] || ""} onChange={e => setF({ ...f, modelKeys: { ...modelKeys, [mid]: e.target.value } })} className="!text-xs !py-1.5 pr-16" />
                      <button onClick={() => setShowKey(s => ({ ...s, [mid]: !s[mid] }))} className="absolute right-10 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">{showKey[mid] ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                      <a href={m.keyUrl} target="_blank" rel="noopener noreferrer" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-red-400" title={"Get key from " + m.apiLabel}><ExternalLink size={12} /></a>
                    </div>
                  </div>}
                  {!m.needsKey && <div className="mt-1 text-[10px] text-green-400">✓ Built in — no API key needed</div>}
                </div>
              </div>
            </Glass>;
          })}
        </div>
      </div>

      <Glass className="p-3 !bg-black/40 text-[11px] text-white/60 leading-relaxed">
        <div className="font-semibold text-white/80 mb-1">How failover works</div>
        When Alfred hits a rate limit (HTTP 429 or quota-exceeded), the model is marked locked with a countdown based on the provider's reset window — 1 hour for most, 24 hours for Gemini/Groq daily limits. Alfred auto-switches to the next model with a valid key. Messages show which model answered in the footer.
      </Glass>
    </div>
  );
}

// ===== SERVICE CATALOG SECTION (inside Settings) =====

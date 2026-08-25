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

export function AIModelsSection({ f, setF, modelStatus, setModelStatus, employees = [], toast }) {
  const [, forceTick] = useState(0);
  const [showKey, setShowKey] = useState({});
  const [newAlfredPhone, setNewAlfredPhone] = useState("");
  const ms: Record<string, any> = modelStatus || {};
  // FEATURE — "double-check all the connections for the LLM providers, make
  // sure they're all working." There was no way to actually verify a saved
  // key works short of trying to use Alfred and hoping — this fires one
  // real, minimal round-trip through the exact same callModel() path Alfred
  // itself uses (no tools, ~10 tokens) so a bad/expired/wrong-format key
  // surfaces immediately with the provider's own real error text, not a guess.
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string } | undefined>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const testConnection = async (mid: string) => {
    setTesting(t => ({ ...t, [mid]: true }));
    setTestResult(r => ({ ...r, [mid]: undefined }));
    try {
      const res = await callModel({
        modelId: mid,
        apiKey: (f.modelKeys || {})[mid],
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        maxTokens: 10,
      });
      setTestResult(r => ({ ...r, [mid]: { ok: true, msg: res.text?.trim() ? `Responded: "${res.text.trim().slice(0, 40)}"` : "Connected (empty reply, but the request succeeded)" } }));
    } catch (e: any) {
      setTestResult(r => ({ ...r, [mid]: { ok: false, msg: e?.message || "Connection failed" } }));
    } finally {
      setTesting(t => ({ ...t, [mid]: false }));
    }
  };

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

      {/* FIX — "text Alfred" was only discoverable buried in the Company
          tab under the myPhone field, with no heading calling it out. Since
          it's gated on having a Claude key set (right here in this tab)
          and the owner specifically looked here for it, surface it
          directly in AI Models too, not just Company. */}
      <Glass className={"p-4 " + (f.alfredSmsEnabled ? "!bg-gradient-to-br !from-red-950/20 !to-black/60 !border-red-700/40" : "!bg-black/40")}>
        <div className="flex items-start gap-3">
          <button onClick={() => setF({ ...f, alfredSmsEnabled: !f.alfredSmsEnabled })}>{f.alfredSmsEnabled ? <ToggleRight size={28} className="text-red-400" /> : <ToggleLeft size={28} className="text-white/30" />}</button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm flex items-center gap-1.5"><Bot size={13} />Text Alfred from your phone</div>
            <div className="text-[11px] text-white/60 mt-0.5">Text your CRM's Twilio number from your own mobile number (set under Company → Your Mobile #) and Alfred replies right there — schedule/reschedule jobs, assign crew, text customers, business stats. Uses whichever AI provider(s) you've added a key for below (Claude, GPT-4o, Gemini, Groq, Mistral, or a free NVIDIA model), in your configured priority order — needs at least one key, plus your mobile number set.</div>
            {!Object.keys(MODELS).some(mid => !!modelKeys[mid]) && <div className="text-[11px] text-yellow-400 mt-1.5">⚠️ Add at least one AI provider key below first.</div>}
            {!f.myPhone && <div className="text-[11px] text-yellow-400 mt-1.5">⚠️ Set "Your Mobile #" under Settings → Company first.</div>}
            {f.alfredSmsEnabled && (
              <div className="text-[11px] text-white/40 mt-1.5">
                Alfred can also text you follow-ups later ("nudge me at 3", "text me once that job's done") — that needs one free one-time setup: a scheduler pinging <code className="text-white/60">/api/check-reminders</code> every few minutes, since Cloudflare Pages has no built-in cron. Free option: <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-red-400 underline">cron-job.org</a> — point it at your domain + that path.
              </div>
            )}
            {f.alfredSmsEnabled && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-[11px] font-semibold text-white/70 mb-1">Other numbers allowed to text Alfred</div>
                <div className="text-[10px] text-white/40 mb-2">
                  By default a number added here gets full OWNER-level access — same as your main number (schedule jobs, assign crew, text customers, business stats). Useful for testing, or if a manager needs the same access.
                  {" "}<b className="text-white/60">To give an EMPLOYEE a narrower Alfred</b> (their own clock in/out, their own jobs, their own calendar only — nothing else) — assign the number to them below instead of leaving it "Owner," or set it directly on that employee's profile: Employees → edit → Portal Permissions → Text Alfred.
                </div>
                {(f.alfredExtraPhones || []).map((p: string, i: number) => {
                  const digits = (p || "").replace(/\D/g, "");
                  const roles: Record<string, string> = f.alfredExtraPhoneRoles || {};
                  const assignedEmpId = roles[digits] || "";
                  return (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/70">{p}</div>
                      <select
                        value={assignedEmpId}
                        onChange={e => {
                          const empId = e.target.value;
                          const nextRoles = { ...roles };
                          if (empId) nextRoles[digits] = empId; else delete nextRoles[digits];
                          setF({ ...f, alfredExtraPhoneRoles: nextRoles });
                        }}
                        className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 focus:outline-none focus:border-red-500/50"
                      >
                        <option value="" className="bg-black">Owner access</option>
                        {employees.filter((emp: any) => emp.role !== "owner").map((emp: any) => (
                          <option key={emp.id} value={emp.id} className="bg-black">{emp.firstName} {emp.lastName}</option>
                        ))}
                      </select>
                      <button onClick={() => {
                        const nextRoles = { ...(f.alfredExtraPhoneRoles || {}) };
                        delete nextRoles[digits];
                        setF({ ...f, alfredExtraPhones: (f.alfredExtraPhones || []).filter((_: string, xi: number) => xi !== i), alfredExtraPhoneRoles: nextRoles });
                      }} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-950/30 transition"><X size={12} /></button>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={newAlfredPhone}
                    onChange={e => setNewAlfredPhone(e.target.value)}
                    placeholder="+17175550100"
                    className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-red-500/50"
                  />
                  <button
                    onClick={() => {
                      const v = newAlfredPhone.trim();
                      if (!v) return;
                      setF({ ...f, alfredExtraPhones: [...(f.alfredExtraPhones || []), v] });
                      setNewAlfredPhone("");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60 text-xs font-semibold transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
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
                    {hasKey && <div className="mt-1.5 flex items-center gap-2">
                      <button onClick={() => testConnection(mid)} disabled={testing[mid]} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition disabled:opacity-50 flex items-center gap-1">
                        {testing[mid] ? <><div className="w-2.5 h-2.5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />Testing…</> : <>Test Connection</>}
                      </button>
                      {testResult[mid] && (
                        <span className={"text-[10px] " + (testResult[mid]!.ok ? "text-green-400" : "text-red-400")}>
                          {testResult[mid]!.ok ? "✓ " : "✗ "}{testResult[mid]!.msg}
                        </span>
                      )}
                    </div>}
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

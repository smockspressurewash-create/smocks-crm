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

export function AccountabilityPage({ entries = [], setEntries, goals = [], setGoals, wins = [], setWins, toast, settings = {} as AppSettings }: { entries?: any[]; setEntries?: any; goals?: any[]; setGoals?: any; wins?: any[]; setWins?: any; toast?: any; settings?: AppSettings }) {
  const [tab, setTab] = useState("today");
  const [f, setF] = useState<{ sleep: any; water: any; gymMinutes: any; meditationMinutes: any; steps: any; mood: any; notes: string; personalNotes?: string }>({ sleep: 7, water: 0, gymMinutes: 0, meditationMinutes: 0, steps: 0, mood: 3, notes: "" });
  const [gText, setGText] = useState("");
  const [wText, setWText] = useState("");

  const tKey = today();
  const todayEntry = entries.find(e => e.date === tKey);
  const hour = new Date().getHours(); // Define hour here, in scope

  useEffect(() => {
    if (todayEntry) setF({ sleep: todayEntry.sleep, water: todayEntry.water, gymMinutes: todayEntry.gymMinutes || (todayEntry.gym ? 60 : 0), meditationMinutes: todayEntry.meditationMinutes || 0, steps: todayEntry.steps, mood: todayEntry.mood, notes: todayEntry.notes || "" });
  }, [todayEntry]);

  const save = () => {
    const payload = { id: todayEntry?.id || uid(), date: tKey, ...f, sleep: Number(f.sleep), water: Number(f.water), gymMinutes: Number(f.gymMinutes), meditationMinutes: Number(f.meditationMinutes), steps: Number(f.steps), mood: Number(f.mood) };
    if (todayEntry) setEntries(entries.map(e => e.id === todayEntry.id ? payload : e));
    else setEntries([...entries, payload]);
    toast("Check-in logged");
  };

  const addGoal = () => {
    if (!gText.trim()) return;
    setGoals([...goals, { id: uid(), text: gText.trim(), category: "general", done: false, createdAt: tKey }]);
    setGText("");
    toast("Goal added");
  };

  const addWin = () => {
    if (!wText.trim()) return;
    setWins([...wins, { id: uid(), text: wText.trim(), date: tKey, category: "general" }]);
    setWText("");
    toast("Win logged! 🏆");
  };

  const [reminders, setReminders] = usePersistent("smocks.reminders", []);

  // Large personal expense alert — pull from personal budget transactions
  const [personalTxns] = usePersistent("smocks.personal.transactions", []);
  const recentLargeExp = personalTxns.filter(t => t.type === "expense" && Number(t.amount) > 200 && daysSince(t.date) <= 3);

  // Smart alerts
  const sedentaryAlert = todayEntry && Number(todayEntry.steps) < 2000 && hour >= 14 && hour < 19;
  const noGymDays = (() => { for (let i = 1; i <= 7; i++) { const e = entries.find(x => x.date === daysFromNow(-i)); if (!e) continue; if ((e.gymMinutes || 0) > 0 || e.gym) return null; } return 7; })();
  const lowWater = todayEntry && Number(todayEntry.water) < 48 && hour >= 15;
  const lateNight = hour >= 23 || hour < 1;
  const lunchAlert = hour >= 13 && hour < 14 && !todayEntry?.lunchTaken;
  const stretchAlert = hour >= 15 && hour < 16 && !todayEntry?.stretchDone;

  // "Call Mom" — check if weekly reminder is overdue
  const callMomReminder = reminders.find(r => r.text === "Call Mom");
  const callMomOverdue = callMomReminder && (!callMomReminder.lastDone || daysSince(callMomReminder.lastDone) >= 7);

  // Anniversary/important date detection (no customers prop needed — just date-based)
  const anniversaryAlerts = (() => {
    const alerts = [];
    const monthDay = tKey.slice(5); // MM-DD
    if (monthDay === "06-15") alerts.push("Father's Day coming up — call Dad");
    if (monthDay === "05-12") alerts.push("Mother's Day — have you called?");
    return alerts;
  })();

  return (
    <div className="space-y-4">
      {sedentaryAlert && <div className="flex items-center gap-3 p-3 bg-orange-950/30 border border-orange-700/40 rounded-xl text-sm">
        <span className="text-xl">🦵</span>
        <div className="flex-1"><div className="font-semibold text-orange-300">Sedentary alert</div><div className="text-xs text-white/60">Only {Number(todayEntry?.steps || 0).toLocaleString()} steps. Take a quick walk.</div></div>
      </div>}
      {noGymDays && <div className="flex items-center gap-3 p-3 bg-yellow-950/30 border border-yellow-700/40 rounded-xl text-sm">
        <span className="text-xl">🏋️</span>
        <div className="flex-1"><div className="font-semibold text-yellow-300">No gym in 7+ days</div><div className="text-xs text-white/60">You haven't logged a workout in over a week. Get back on it.</div></div>
      </div>}
      {lowWater && <div className="flex items-center gap-3 p-3 bg-blue-950/30 border border-blue-700/40 rounded-xl text-sm">
        <span className="text-xl">💧</span>
        <div className="flex-1"><div className="font-semibold text-blue-300">Hydration reminder</div><div className="text-xs text-white/60">Only {Number(todayEntry?.water || 0)}oz today. Drink more water.</div></div>
      </div>}
      {callMomOverdue && <div className="flex items-center gap-3 p-3 bg-pink-950/30 border border-pink-700/40 rounded-xl text-sm">
        <span className="text-xl">📞</span>
        <div className="flex-1"><div className="font-semibold text-pink-300">Call Mom</div><div className="text-xs text-white/60">{callMomReminder.lastDone ? "It's been " + daysSince(callMomReminder.lastDone) + " days. She'd love to hear from you." : "You haven't logged this yet. Give her a call."}</div></div>
        <div className="flex gap-2">
          <a href="tel:" className="px-2.5 py-1.5 bg-pink-900/40 border border-pink-700/40 text-pink-300 rounded-lg text-xs">Call ☎️</a>
          <button onClick={() => setReminders(prev => prev.map(r => r.id === "r1" ? { ...r, lastDone: today() } : r))} className="px-2.5 py-1.5 bg-black/40 border border-white/10 text-white/50 rounded-lg text-xs">Done ✓</button>
        </div>
      </div>}
      {recentLargeExp.length > 0 && <div className="flex items-center gap-3 p-3 bg-red-950/30 border border-red-700/40 rounded-xl text-sm">
        <span className="text-xl">💸</span>
        <div className="flex-1"><div className="font-semibold text-red-300">Large expense alert</div><div className="text-xs text-white/60">{recentLargeExp[0]?.description || "Recent purchase"} — {fmt(Number(recentLargeExp[0]?.amount))} in the last 3 days</div></div>
      </div>}
      {anniversaryAlerts.map((a, i) => <div key={i} className="flex items-center gap-3 p-3 bg-pink-950/30 border border-pink-700/40 rounded-xl text-sm">
        <span className="text-xl">🗓️</span>
        <div className="flex-1"><div className="font-semibold text-pink-300">Date alert</div><div className="text-xs text-white/70">{a}</div></div>
      </div>)}
      {lunchAlert && <div className="flex items-center gap-3 p-3 bg-green-950/30 border border-green-700/40 rounded-xl text-sm">
        <span className="text-xl">🥗</span>
        <div className="flex-1"><div className="font-semibold text-green-300">Lunch break</div><div className="text-xs text-white/60">It's 1pm. Step away and eat. Your brain needs fuel.</div></div>
        <button onClick={() => setEntries(prev => prev.map(e => e.date === tKey ? { ...e, lunchTaken: true } : e))} className="px-2.5 py-1.5 bg-green-900/40 border border-green-700/40 text-green-300 rounded-lg text-xs">Done ✓</button>
      </div>}
      {stretchAlert && <div className="flex items-center gap-3 p-3 bg-purple-950/30 border border-purple-700/40 rounded-xl text-sm">
        <span className="text-xl">🧘</span>
        <div className="flex-1"><div className="font-semibold text-purple-300">Stretch reminder</div><div className="text-xs text-white/60">3pm. Stand up, roll your shoulders, stretch your back. Takes 2 min.</div></div>
        <button onClick={() => setEntries(prev => prev.map(e => e.date === tKey ? { ...e, stretchDone: true } : e))} className="px-2.5 py-1.5 bg-purple-900/40 border border-purple-700/40 text-purple-300 rounded-lg text-xs">Done ✓</button>
      </div>}
      {lateNight && <div className="flex items-center gap-3 p-3 bg-purple-950/30 border border-purple-700/40 rounded-xl text-sm">
        <span className="text-xl">🌙</span>
        <div className="flex-1"><div className="font-semibold text-purple-300">Late night phone use</div><div className="text-xs text-white/60">Put it down. Sleep is your biggest performance lever.</div></div>
      </div>}
      {recentLargeExp.map(t => <div key={t.id} className="flex items-center gap-3 p-3 bg-red-950/30 border border-red-700/40 rounded-xl text-sm">
        <span className="text-xl">💸</span>
        <div className="flex-1"><div className="font-semibold text-red-300">Large personal expense</div><div className="text-xs text-white/60">{t.description} — {fmt(Number(t.amount))} on {t.date}. Intentional?</div></div>
      </div>)}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Flame} label="Check-ins" value={entries.length} />
        <Stat icon={Target} label="Active Goals" value={goals.filter(g => !g.done).length} />
        <Stat icon={Trophy} label="Wins" value={wins.length} />
        <Stat icon={Heart} label="Mood Avg" value={entries.length ? (entries.reduce((s, e) => s + e.mood, 0) / entries.length).toFixed(1) : "—"} />
      </div>

      <div className="flex gap-2 flex-wrap">{["today", "history", "goals", "wins", "reminders", "reflect"].map(t => <button key={t} onClick={() => setTab(t)} className={"px-4 py-2 rounded-xl text-sm font-medium transition border capitalize " + (tab === t ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{t === "reflect" ? "✨ Reflect" : t}</button>)}</div>

      {tab === "reminders" && <div className="space-y-3">
        <Glass className="p-4 !bg-gradient-to-br !from-purple-950/20 !to-black/60 !border-purple-700/30">
          <div className="font-semibold text-sm flex items-center gap-2 mb-1">📋 Personal Reminders</div>
          <div className="text-xs text-white/60">Things you want to remember to do — not business tasks.</div>
        </Glass>
        <div className="space-y-2">
          {reminders.map(r => {
            const overdue = r.lastDone ? (r.frequency === "daily" ? daysSince(r.lastDone) >= 1 : daysSince(r.lastDone) >= 7) : true;
            return <div key={r.id} className={"flex items-center gap-3 p-3.5 rounded-xl border transition " + (overdue ? "bg-red-950/20 border-red-700/30" : "bg-black/40 border-white/10")}>
              <span className="text-2xl">{r.emoji}</span>
              <div className="flex-1">
                <div className="font-medium text-sm">{r.text}</div>
                <div className="text-[10px] text-white/50">{r.frequency} · {r.lastDone ? "Last: " + r.lastDone : "Never done"}{overdue ? " — ⚠️ overdue" : " — ✓ current"}</div>
              </div>
              <button onClick={() => setReminders(prev => prev.map(x => x.id === r.id ? { ...x, lastDone: today() } : x))} className="px-2.5 py-1.5 bg-green-900/40 border border-green-700/40 text-green-300 rounded-lg text-xs hover:bg-green-900/60">Done ✓</button>
              <button onClick={() => setReminders(prev => prev.filter(x => x.id !== r.id))} className="p-1.5 text-white/30 hover:text-red-400"><X size={12} /></button>
            </div>;
          })}
        </div>
        <Glass className="p-4">
          <div className="text-xs text-white/60 mb-3">Add reminder</div>
          <div className="flex gap-2">
            <GInput placeholder="Reminder text..." value={gText} onChange={e => setGText(e.target.value)} className="flex-1" onKeyDown={e => e.key === "Enter" && gText.trim() && (setReminders(prev => [...prev, { id: uid(), text: gText.trim(), frequency: "weekly", emoji: "📌", lastDone: null }]), setGText(""), toast("Reminder added"))} />
            <GBtn onClick={() => { if (!gText.trim()) return; setReminders(prev => [...prev, { id: uid(), text: gText.trim(), frequency: "weekly", emoji: "📌", lastDone: null }]); setGText(""); toast("Reminder added"); }}>Add</GBtn>
          </div>
        </Glass>
      </div>}

      {tab === "today" && (
        <Glass className="p-5">
          <div className="flex items-center gap-2 mb-4"><Heart size={16} className="text-red-400" /><h3 className="font-semibold">Daily Check-in · {tKey}</h3>{todayEntry && <Badge tone="green">Logged</Badge>}</div>
          <div className="space-y-4">
            <div><label className="text-xs text-white/60 mb-2 flex items-center gap-1"><Moon size={10} />Sleep (hrs): <span className="text-red-400 font-bold ml-1">{f.sleep}</span></label><input type="range" min="0" max="12" step="0.5" value={f.sleep} onChange={e => setF({ ...f, sleep: e.target.value })} className="w-full accent-red-600" /></div>
            <div><label className="text-xs text-white/60 mb-2 flex items-center gap-1"><Droplet size={10} />Water (oz): <span className="text-red-400 font-bold ml-1">{f.water}</span></label><input type="range" min="0" max="128" step="8" value={f.water} onChange={e => setF({ ...f, water: e.target.value })} className="w-full accent-red-600" /></div>
            <div><label className="text-xs text-white/60 mb-2 flex items-center gap-1"><Activity size={10} />Steps: <span className="text-red-400 font-bold ml-1">{Number(f.steps).toLocaleString()}</span></label><input type="range" min="0" max="20000" step="500" value={f.steps} onChange={e => setF({ ...f, steps: e.target.value })} className="w-full accent-red-600" /></div>
            <div><label className="text-xs text-white/60 mb-2 flex items-center gap-1"><Smile size={10} />Mood:</label><div className="flex gap-2">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setF({ ...f, mood: n })} className={"flex-1 py-2 rounded-lg text-xl transition " + (f.mood === n ? "bg-red-900/40 border border-red-500/50" : "bg-white/5 border border-white/10")}>{["😞", "😕", "😐", "🙂", "🔥"][n - 1]}</button>)}</div></div>
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
              <Dumbbell size={16} className={Number(f.gymMinutes) > 0 ? "text-red-400" : "text-white/50"} />
              <span className={Number(f.gymMinutes) > 0 ? "font-semibold flex-1" : "text-white/60 flex-1"}>Workout</span>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="300" step="5" value={f.gymMinutes} onChange={e => setF({ ...f, gymMinutes: Number(e.target.value) })} className="w-16 bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-red-500/50" />
                <span className="text-xs text-white/50">min</span>
              </div>
              {Number(f.gymMinutes) > 0 && <span className="text-[10px] text-red-400 font-bold">🔥</span>}
            </div>
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
              <span className="text-base">🧘</span>
              <span className={Number(f.meditationMinutes) > 0 ? "font-semibold flex-1 text-sm" : "text-white/60 flex-1 text-sm"}>Meditation</span>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="120" step="5" value={f.meditationMinutes} onChange={e => setF({ ...f, meditationMinutes: Number(e.target.value) })} className="w-16 bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-red-500/50" />
                <span className="text-xs text-white/50">min</span>
              </div>
              {Number(f.meditationMinutes) > 0 && <span className="text-[10px] text-purple-400 font-bold">✨</span>}
            </div>
            <div><label className="text-xs text-white/60 mb-2 flex items-center gap-1"><FileText size={10} />Personal Notes</label><GTxt rows={2} value={f.personalNotes || ""} onChange={e => setF({ ...f, personalNotes: e.target.value })} placeholder="Thoughts, wins, things to remember..." className="!text-xs" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="What happened today?" /></div>
            <GBtn onClick={save} className="w-full"><Save size={14} className="inline mr-1.5" />{todayEntry ? "Update" : "Log"} Check-in</GBtn>
          </div>
        </Glass>
      )}

      {tab === "history" && (
        <Glass className="p-5">
          <h3 className="font-semibold mb-4">Check-in History</h3>
          <div className="space-y-2">
            {entries.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => (
              <div key={e.id} className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">{e.date}</div>
                  <div className="text-lg">{["😞","😕","😐","🙂","🔥"][e.mood - 1]}</div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                  <div className="text-center"><div className="text-white/50">Sleep</div><div className="font-bold">{e.sleep}h</div></div>
                  <div className="text-center"><div className="text-white/50">Water</div><div className="font-bold">{e.water}oz</div></div>
                  <div className="text-center"><div className="text-white/50">Steps</div><div className="font-bold">{Number(e.steps || 0).toLocaleString()}</div></div>
                  <div className="text-center"><div className="text-white/50">Workout</div><div className={"font-bold " + ((e.gymMinutes || 0) > 0 ? "text-red-400" : "text-white/30")}>{(e.gymMinutes || 0) > 0 ? (e.gymMinutes || 0) + "m" : "—"}</div></div>
                  <div className="text-center"><div className="text-white/50">Meditate</div><div className={"font-bold " + ((e.meditationMinutes || 0) > 0 ? "text-purple-400" : "text-white/30")}>{(e.meditationMinutes || 0) > 0 ? (e.meditationMinutes || 0) + "m" : "—"}</div></div>
                  <div className="text-center"><div className="text-white/50">Mood</div><div className="font-bold">{e.mood}/5</div></div>
                </div>
                {e.notes && <div className="text-[10px] text-white/50 mt-2 truncate">📝 {e.notes}</div>}
              </div>
            ))}
            {entries.length === 0 && <div className="text-center py-8 text-white/40 text-sm">No check-ins yet — start logging today</div>}
          </div>
        </Glass>
      )}

      {tab === "goals" && (
        <div className="space-y-4">
          {/* Goal Progress Overview */}
          {goals.length > 0 && (() => {
            const done = goals.filter(g => g.done).length;
            const pct = Math.round(done / goals.length * 100);
            const byCategory = { revenue: goals.filter(g => (g.category||"general") === "revenue"), fitness: goals.filter(g => g.category === "fitness"), learning: goals.filter(g => g.category === "learning"), family: goals.filter(g => g.category === "family"), general: goals.filter(g => !g.category || g.category === "general") };
            return <Glass className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm">Goal Progress</div>
                <div className="text-lg font-black text-red-400">{pct}%</div>
              </div>
              <div className="h-3 bg-black/40 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-500" style={{width: pct + "%"}} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[["💰","revenue","Revenue"],["💪","fitness","Fitness"],["📚","learning","Learning"],["👨‍👩‍👧","family","Family"]].map(([icon,key,label]) => {
                  const cats = byCategory[key] || [];
                  if (cats.length === 0) return null;
                  const catDone = cats.filter(g => g.done).length;
                  return <div key={key} className="text-center p-2 bg-black/30 rounded-xl">
                    <div className="text-lg">{icon}</div>
                    <div className="text-[10px] text-white/50">{label}</div>
                    <div className="text-xs font-bold">{catDone}/{cats.length}</div>
                  </div>;
                }).filter(Boolean)}
              </div>
            </Glass>;
          })()}

          <Glass className="p-5">
            <div className="flex gap-2 mb-3">
              <GInput placeholder="Add a goal..." value={gText} onChange={e => setGText(e.target.value)} onKeyDown={e => e.key === "Enter" && addGoal()} className="flex-1" />
              <GSel value="" onChange={e => {}} className="!text-xs !w-32">
                <option value="" className="bg-black">Category</option>
                <option value="revenue" className="bg-black">💰 Revenue</option>
                <option value="fitness" className="bg-black">💪 Fitness</option>
                <option value="learning" className="bg-black">📚 Learning</option>
                <option value="family" className="bg-black">👨‍👩‍👧 Family</option>
              </GSel>
              <GBtn onClick={addGoal}><Plus size={14} /></GBtn>
            </div>
            <div className="space-y-2">
              {goals.map(g => {
                const catIcon = { revenue:"💰", fitness:"💪", learning:"📚", family:"👨‍👩‍👧" }[g.category] || "🎯";
                return <div key={g.id} className={"flex items-center gap-3 p-3 rounded-xl border transition " + (g.done ? "bg-green-900/20 border-green-700/40" : "bg-white/5 border-white/10")}>
                  <input type="checkbox" checked={g.done} onChange={() => setGoals(goals.map(x => x.id === g.id ? { ...x, done: !x.done, completedAt: !x.done ? today() : null } : x))} className="w-5 h-5 accent-red-600" />
                  <span className="text-sm">{catIcon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={"text-sm " + (g.done ? "line-through text-white/40" : "")}>{g.text}</div>
                    <div className="text-[10px] text-white/40">{g.done ? "✅ Completed " + (g.completedAt || "") : "Added " + g.createdAt}</div>
                  </div>
                  <button onClick={() => setGoals(goals.filter(x => x.id !== g.id))} className="p-1 text-white/40 hover:text-red-400"><Trash2 size={12} /></button>
                </div>;
              })}
              {goals.length === 0 && <div className="text-center py-8 text-white/40 text-sm">No goals yet — set your first one above</div>}
            </div>
          </Glass>
        </div>
      )}

      {tab === "wins" && (
        <Glass className="p-5">
          <div className="flex gap-2 mb-4"><GInput placeholder="Log a win..." value={wText} onChange={e => setWText(e.target.value)} onKeyDown={e => e.key === "Enter" && addWin()} /><GBtn onClick={addWin}><Plus size={14} /></GBtn></div>
          <div className="space-y-2">
            {wins.map(w => <div key={w.id} className="flex items-start gap-3 p-3 bg-gradient-to-br from-yellow-950/20 to-black/40 border border-yellow-800/30 rounded-xl">
              <Trophy size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0"><div className="text-sm">{w.text}</div><div className="text-[10px] text-white/40">{w.date}</div></div>
              <button onClick={() => setWins(wins.filter(x => x.id !== w.id))} className="p-1 text-white/40 hover:text-red-400"><Trash2 size={12} /></button>
            </div>)}
            {wins.length === 0 && <div className="text-center py-8 text-white/40 text-sm">Log your first win</div>}
          </div>
        </Glass>
      )}
      {tab === "reflect" && <WeeklyReflectionTab entries={entries} goals={goals} wins={wins} toast={toast} settings={settings} />}
    </div>
  );
}


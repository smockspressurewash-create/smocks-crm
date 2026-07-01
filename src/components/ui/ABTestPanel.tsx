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

export function ABTestPanel({ matches = [], toast }) {
  const [varA, setVarA] = useState("Hi {{first_name}}, spring is here! 15% off house washes this month. Book at (717) 555-0100 — Crew Boss");
  const [varB, setVarB] = useState("{{first_name}} — your neighbors are getting their homes washed. Don't be the last one 😅 Call us! — Crew Boss");
  const [splitPct, setSplitPct] = useState(50);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const runTest = () => {
    setRunning(true);
    setTimeout(() => {
      const aSent = Math.round(matches.length * (splitPct / 100));
      const bSent = matches.length - aSent;
      setResults({
        a: { sent: aSent, opens: Math.round(aSent * (0.28 + Math.random() * 0.15)), replies: Math.round(aSent * (0.06 + Math.random() * 0.08)) },
        b: { sent: bSent, opens: Math.round(bSent * (0.28 + Math.random() * 0.15)), replies: Math.round(bSent * (0.06 + Math.random() * 0.08)) }
      });
      setRunning(false);
      toast("A/B test launched to " + matches.length + " recipients · Results loading…");
    }, 1500);
  };

  return <div className="space-y-4">
    <Glass className="p-4 !bg-purple-950/20 !border-purple-700/30">
      <div className="font-semibold mb-1 flex items-center gap-2"><BarChart2 size={14} className="text-purple-400" />A/B Message Testing</div>
      <div className="text-xs text-white/60">Send two versions to split your audience. See which message converts better.</div>
    </Glass>
    <div className="grid md:grid-cols-2 gap-4">
      <Glass className="p-4 !border-blue-700/30">
        <div className="text-xs font-bold text-blue-400 mb-2">VARIANT A — {splitPct}% of audience</div>
        <GTxt rows={4} value={varA} onChange={e => setVarA(e.target.value)} className="!text-xs" />
        <div className="text-[10px] text-white/40 mt-1">{varA.length} chars</div>
      </Glass>
      <Glass className="p-4 !border-purple-700/30">
        <div className="text-xs font-bold text-purple-400 mb-2">VARIANT B — {100 - splitPct}% of audience</div>
        <GTxt rows={4} value={varB} onChange={e => setVarB(e.target.value)} className="!text-xs" />
        <div className="text-[10px] text-white/40 mt-1">{varB.length} chars</div>
      </Glass>
    </div>
    <Glass className="p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-32">
          <label className="text-xs text-white/60 mb-1 block">A/B Split: A gets {splitPct}%</label>
          <input type="range" min={10} max={90} value={splitPct} onChange={e => setSplitPct(Number(e.target.value))} className="w-full" />
        </div>
        <div className="text-center text-xs text-white/60"><div className="font-bold text-white">{matches.length}</div>recipients</div>
        <div className="text-center text-xs text-white/60"><div className="font-bold text-blue-400">{Math.round(matches.length * splitPct / 100)}</div>get A</div>
        <div className="text-center text-xs text-white/60"><div className="font-bold text-purple-400">{matches.length - Math.round(matches.length * splitPct / 100)}</div>get B</div>
        <GBtn onClick={runTest} disabled={running || matches.length === 0} className="flex-shrink-0">
          {running ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-1.5" />Sending…</> : "Launch Test"}
        </GBtn>
      </div>
    </Glass>
    {results && <Glass className="p-5">
      <h3 className="font-semibold mb-4 flex items-center gap-2"><Trophy size={14} className="text-yellow-400" />A/B Results</h3>
      <div className="grid grid-cols-2 gap-4">
        {[["A", "blue", results.a], ["B", "purple", results.b]].map(([v, color, r]) => {
          const openRate = r.sent > 0 ? Math.round(r.opens / r.sent * 100) : 0;
          const replyRate = r.sent > 0 ? Math.round(r.replies / r.sent * 100) : 0;
          const winner = results.a.sent > 0 && results.b.sent > 0 && (results.a.replies / results.a.sent > results.b.replies / results.b.sent) ? "A" : "B";
          return <div key={v} className={"p-4 rounded-xl border-2 " + (winner === v ? "border-yellow-500/60 bg-yellow-950/20" : "border-white/10 bg-black/40")}>
            <div className={"font-bold text-sm mb-2 " + (color === "blue" ? "text-blue-400" : "text-purple-400")}>Variant {v} {winner === v ? "🏆 WINNER" : ""}</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-white/60">Sent</span><span className="font-semibold">{r.sent}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Opens</span><span className="font-semibold text-green-400">{r.opens} ({openRate}%)</span></div>
              <div className="flex justify-between"><span className="text-white/60">Replies</span><span className="font-semibold text-yellow-400">{r.replies} ({replyRate}%)</span></div>
            </div>
          </div>;
        })}
      </div>
      <div className="mt-3 p-3 bg-black/40 rounded-xl text-xs text-white/60 text-center">
        Winner: <span className="font-bold text-yellow-400">Variant {results.a.sent > 0 && results.b.sent > 0 && results.a.replies / results.a.sent > results.b.replies / results.b.sent ? "A" : "B"}</span> had a higher reply rate.
      </div>
    </Glass>}
  </div>;
}

// ===== REFERRALS =====

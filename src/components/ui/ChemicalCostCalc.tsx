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

export function ChemicalCostCalc({ items = [], settings = {} }) {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  const services = items.filter(i => i.description).map(i => i.description).join(", ");

  const calculate = async () => {
    if (!services) return;
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [{ role: "user", content: `For a pressure washing job with these services: "${services}", estimate the chemical costs. Respond ONLY with a JSON object: {"sqsh": dollar amount for SH (sodium hypochlorite), "surf": dollar amount for surfactant, "degreaser": dollar amount for degreaser (0 if not needed), "total": total chemical cost, "notes": one short sentence about main chemicals used}. Use typical pressure washing industry costs. No other text.` }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text?.replace(/```json|```/g, "").trim() || "{}";
      const parsed = JSON.parse(text);
      setEstimate(parsed);
    } catch {
      // Fallback heuristic
      const hasRoof = services.toLowerCase().includes("roof");
      const hasDriveway = services.toLowerCase().includes("driv");
      setEstimate({ sqsh: hasRoof ? 18 : 12, surf: 4, degreaser: hasDriveway ? 6 : 0, total: hasRoof ? 28 : hasDriveway ? 22 : 16, notes: "SH + surfactant blend for soft wash" });
    }
    setLoading(false);
  };

  if (!services) return null;

  return (
    <div className="p-3 bg-gradient-to-br from-yellow-950/20 to-black/60 border border-yellow-700/30 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-yellow-300 flex items-center gap-1.5">🧪 Chemical Cost Estimate</div>
        <GBtn onClick={calculate} disabled={loading} className="!text-xs !py-1 !px-2.5">
          {loading ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block mr-1" />AI Calculating…</> : <><Zap size={10} className="inline mr-1" />Calculate</>}
        </GBtn>
      </div>
      {estimate ? (
        <div className="grid grid-cols-4 gap-2 text-center text-xs mt-2">
          {[["SH", estimate.sqsh], ["Surf.", estimate.surf], ["Degreaser", estimate.degreaser], ["Total", estimate.total]].map(([l, v]) => (
            <div key={l} className={"p-2 rounded-lg " + (l === "Total" ? "bg-yellow-900/30 border border-yellow-700/40" : "bg-black/40")}>
              <div className="text-[10px] text-white/50 mb-0.5">{l}</div>
              <div className={"font-bold " + (l === "Total" ? "text-yellow-300" : "text-white/80")}>{fmt(v || 0)}</div>
            </div>
          ))}
          <div className="col-span-4 text-[10px] text-white/50 text-left mt-1">{estimate.notes}</div>
        </div>
      ) : (
        <div className="text-[10px] text-yellow-300/60">Click "Calculate" for AI-estimated chemical costs based on your services</div>
      )}
    </div>
  );
}


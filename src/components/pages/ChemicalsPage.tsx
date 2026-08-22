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
import { twilioSend, sendEmail, sendOwnerGmailOnly, emailShell } from "../../lib/messaging";
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

export function ChemicalsPage({ chemicals = [], setChemicals, toast = () => {}, settings = {} as AppSettings }: { chemicals?: any[]; setChemicals?: any; toast?: any; settings?: AppSettings }) {
  const [modal, setModal] = useState({ open: false, data: null });
  // FEATURE — "Chemicals & Equipment": itemType filter so nozzles/wands/
  // surface cleaners aren't mixed into the chemical reorder math (a nozzle
  // has no meaningful "gallons remaining" concept) while still living in
  // one shared inventory list.
  const [typeFilter, setTypeFilter] = useState<"all" | "chemical" | "equipment">("all");
  const visible = chemicals.filter(c => typeFilter === "all" || (c.itemType || "chemical") === typeFilter);
  const low = visible.filter(c => (c.itemType || "chemical") === "chemical" && c.stock <= c.reorderLevel);
  const totVal = chemicals.reduce((s, c) => s + c.stock * c.unitCost, 0);
  const equipmentCount = chemicals.filter(c => c.itemType === "equipment").length;
  const save = d => {
    if (d.id) setChemicals(chemicals.map(c => c.id === d.id ? d : c));
    else setChemicals([...chemicals, { ...d, id: uid() }]);
    setModal({ open: false, data: null });
    toast("Chemical saved");
  };
  const bump = (id, delta) => setChemicals(chemicals.map(c => c.id === id ? { ...c, stock: Math.max(0, c.stock + delta) } : c));

  // ISSUE 13 (round 11) — replaced SMS ("Text Me List") with email, per
  // explicit request; also used by the auto-reminder effect below so a
  // manual click and the automatic daily nudge send the exact same content.
  const reorderListHtml = () => `
    <p>Chemicals at or below their reorder point:</p>
    <ul>${low.map(c => `<li><b>${c.name}</b> — ${c.stock} gal left (reorder at ${c.reorderLevel} gal, ${fmt(c.unitCost)}/gal)</li>`).join("")}</ul>
    <p>Total restock cost: <b>${fmt(low.reduce((s, c) => s + ((Math.max(c.reorderLevel * 2, 20) - c.stock) * c.unitCost), 0))}</b></p>`;
  const sendReorderEmail = () => {
    const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
    if (!ownerEmail) { toast("Add your email in Settings → My Profile to get reorder emails"); return; }
    sendOwnerGmailOnly(settings as any, ownerEmail, "🧪 Chemical reorder needed", emailShell(settings as any, "Chemical Reorder List", reorderListHtml()))
      .then(() => toast("Reorder list emailed ✓"))
      .catch((e: any) => toast("Email failed — " + (e?.message || "check Google connection in Settings"), "red"));
  };

  // ISSUE 13 (round 11) — auto-reminder: previously reordering was
  // ENTIRELY manual (the owner had to notice low stock themselves and tap
  // the button). Once per calendar day, if anything is at/below its reorder
  // point, email the same list automatically — same dedupe pattern as the
  // daily briefing/summary auto-sends elsewhere in the app (a persisted
  // date-stamp key, so a reload/re-render can't re-fire it).
  const [lastAutoReorderDate, setLastAutoReorderDate] = usePersistent<string>("smocks.chemReorderEmailDate", "");
  useEffect(() => {
    if (low.length === 0) return;
    const todayKey = today();
    if (lastAutoReorderDate === todayKey) return;
    const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
    if (!ownerEmail) return;
    setLastAutoReorderDate(todayKey);
    sendOwnerGmailOnly(settings as any, ownerEmail, "🧪 Chemical reorder needed", emailShell(settings as any, "Chemical Reorder List", reorderListHtml())).catch(() => {});
  }, [low.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat icon={FlaskConical} label="SKUs" value={chemicals.length} />
        <Stat icon={Wrench} label="Equipment" value={equipmentCount} />
        <Stat icon={AlertTriangle} label="Low Stock" value={low.length} />
        <Stat icon={DollarSign} label="Inventory $" value={fmt(totVal)} />
      </div>
      <div className="flex gap-2">
        {[["all", "All"], ["chemical", "🧪 Chemicals"], ["equipment", "🔧 Equipment"]].map(([k, l]) => (
          <button key={k} onClick={() => setTypeFilter(k as any)} className={"px-3 py-1.5 rounded-xl text-xs font-medium transition border " + (typeFilter === k ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>
            {l} ({k === "all" ? chemicals.length : chemicals.filter(c => (c.itemType || "chemical") === k).length})
          </button>
        ))}
      </div>
      {low.length > 0 && <Glass className="p-4 !bg-red-950/30 !border-red-600/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-red-400" /><span className="font-semibold text-red-300">Reorder Suggestion</span></div>
          <button onClick={sendReorderEmail} className="text-[10px] px-2.5 py-1.5 bg-red-900/40 border border-red-700/40 text-red-300 rounded-lg hover:bg-red-800/50 transition flex items-center gap-1">📧 Email Me List</button>
        </div>
        <div className="space-y-2">
          {low.map(c => {
            const target = Math.max(c.reorderLevel * 2, 20);
            const needed = target - c.stock;
            const cost = needed * c.unitCost;
            return <div key={c.id} className="flex items-center justify-between p-2.5 bg-black/40 border border-red-900/30 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                <div className="text-[10px] text-white/50">Stock {c.stock} · reorder at {c.reorderLevel} · suggest +{needed} ({fmt(cost)})</div>
              </div>
              <button onClick={() => { setChemicals(chemicals.map(x => x.id === c.id ? { ...x, stock: x.stock + needed } : x)); toast("Ordered " + needed + " " + c.name.split(" ")[0]); }} className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/50 border border-red-600/40 text-red-300 text-xs font-semibold whitespace-nowrap">Order</button>
            </div>;
          })}
          <div className="flex items-center justify-between pt-2 border-t border-red-900/30 text-xs">
            <span className="text-white/60">Total restock cost</span>
            <span className="font-bold text-red-400">{fmt(low.reduce((s, c) => s + ((Math.max(c.reorderLevel * 2, 20) - c.stock) * c.unitCost), 0))}</span>
          </div>
        </div>
      </Glass>}
      <div className="flex justify-end"><GBtn onClick={() => setModal({ open: true, data: null })}><Plus size={14} className="inline mr-1.5" />Add</GBtn></div>
      <Glass className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-red-900/30 bg-black/40">
            <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-white/60">Name</th>
            <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-white/60 hidden md:table-cell">Brand</th>
            <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-white/60 hidden lg:table-cell">Supplier</th>
            <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-white/60">On Hand</th>
            <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-white/60">Cost/Unit</th>
            <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-white/60">Actions</th>
          </tr></thead>
          <tbody>
            {visible.map(c => {
              const isEq = (c.itemType || "chemical") === "equipment";
              const lo = !isEq && c.stock <= c.reorderLevel;
              const suppliers: any[] = (c.suppliers && c.suppliers.length) ? c.suppliers : (c.supplier ? [{ id: "legacy", name: c.supplier, phone: "" }] : []);
              return <tr key={c.id} className={"border-b border-red-900/10 " + (lo ? "bg-red-950/20" : "hover:bg-white/5")}>
                <td className="px-5 py-4"><div className="flex items-center gap-2">{lo && <AlertTriangle size={14} className="text-red-400" />}<div><div className="font-medium">{isEq ? "🔧 " : ""}{c.name}</div><div className="text-xs text-white/50 md:hidden">{c.brand}</div></div></div></td>
                <td className="px-5 py-4 text-white/70 hidden md:table-cell">{c.brand}</td>
                <td className="px-5 py-4 text-white/70 hidden lg:table-cell">
                  {suppliers.length === 0 && <span className="text-white/30">—</span>}
                  {suppliers.map(s => (
                    <div key={s.id} className="text-xs">
                      {s.name}
                      {s.phone && <a href={"tel:" + s.phone.replace(/[^\d+]/g, "")} className="ml-1.5 text-red-400 hover:text-red-300 inline-flex items-center gap-0.5"><Phone size={9} />{s.phone}</a>}
                    </div>
                  ))}
                </td>
                <td className={"px-5 py-4 text-right font-bold " + (lo ? "text-red-400" : "")}>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => bump(c.id, -1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white/60">−</button>
                    <span className="w-14 text-center">{c.stock} {c.unit || "gal"}</span>
                    <button onClick={() => bump(c.id, 1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white/60">+</button>
                  </div>
                </td>
                <td className="px-5 py-4 text-right text-red-400">{fmt(c.unitCost)}</td>
                <td className="px-5 py-4 text-right">
                  {lo && <a href={"https://www.amazon.com/s?k=" + encodeURIComponent((c.brand ? c.brand + " " : "") + c.name + " pressure washing")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-yellow-950/40 border border-yellow-700/40 text-yellow-300 rounded-lg hover:bg-yellow-900/50 mr-1.5" title="Order on Amazon">🛒 Order</a>}
                  <button onClick={() => setModal({ open: true, data: c })} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"><Edit size={14} /></button>
                  <button onClick={() => setChemicals(chemicals.filter(x => x.id !== c.id))} className="p-1.5 rounded-lg hover:bg-red-900/30 text-white/60 hover:text-red-400 transition"><Trash2 size={14} /></button>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </Glass>
      <ChemicalModal open={modal.open} onClose={() => setModal({ open: false, data: null })} data={modal.data} onSave={save} />
    </div>
  );
}

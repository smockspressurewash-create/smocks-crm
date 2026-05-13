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

export function ChemicalsPage({ chemicals = [], setChemicals, toast = () => {}, settings = {} }) {
  const [modal, setModal] = useState({ open: false, data: null });
  const low = chemicals.filter(c => c.stock <= c.reorderLevel);
  const totVal = chemicals.reduce((s, c) => s + c.stock * c.unitCost, 0);
  const save = d => {
    if (d.id) setChemicals(chemicals.map(c => c.id === d.id ? d : c));
    else setChemicals([...chemicals, { ...d, id: uid() }]);
    setModal({ open: false, data: null });
    toast("Chemical saved");
  };
  const bump = (id, delta) => setChemicals(chemicals.map(c => c.id === id ? { ...c, stock: Math.max(0, c.stock + delta) } : c));

  const sendReorderAlert = () => {
    if (!settings?.myPhone || !settings?.twilioSid) { toast("Add Twilio + your mobile # in Settings to send SMS alerts"); return; }
    const msg = "🧪 CHEMICAL REORDER NEEDED\n\n" + low.map(c => "• " + c.name + " — " + c.stock + " left (reorder at " + c.reorderLevel + ")").join("\n") + "\n\nTotal restock cost: " + fmt(low.reduce((s, c) => s + ((Math.max(c.reorderLevel * 2, 20) - c.stock) * c.unitCost), 0)) + " — Alfred out.";
    twilioSend(settings, settings.myPhone, msg).then(() => toast("Reorder alert sent ✓")).catch(() => toast("SMS failed — check Twilio in Settings"));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={FlaskConical} label="SKUs" value={chemicals.length} />
        <Stat icon={AlertTriangle} label="Low Stock" value={low.length} />
        <Stat icon={DollarSign} label="Inventory $" value={fmt(totVal)} />
      </div>
      {low.length > 0 && <Glass className="p-4 !bg-red-950/30 !border-red-600/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-red-400" /><span className="font-semibold text-red-300">Reorder Suggestion</span></div>
          <button onClick={sendReorderAlert} className="text-[10px] px-2.5 py-1.5 bg-red-900/40 border border-red-700/40 text-red-300 rounded-lg hover:bg-red-800/50 transition flex items-center gap-1">📱 Text Me List</button>
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
            <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-white/60">Stock</th>
            <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-white/60">Unit $</th>
            <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-white/60">Actions</th>
          </tr></thead>
          <tbody>
            {chemicals.map(c => {
              const lo = c.stock <= c.reorderLevel;
              return <tr key={c.id} className={"border-b border-red-900/10 " + (lo ? "bg-red-950/20" : "hover:bg-white/5")}>
                <td className="px-5 py-4"><div className="flex items-center gap-2">{lo && <AlertTriangle size={14} className="text-red-400" />}<div><div className="font-medium">{c.name}</div><div className="text-xs text-white/50 md:hidden">{c.brand}</div></div></div></td>
                <td className="px-5 py-4 text-white/70 hidden md:table-cell">{c.brand}</td>
                <td className={"px-5 py-4 text-right font-bold " + (lo ? "text-red-400" : "")}>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => bump(c.id, -1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white/60">−</button>
                    <span className="w-10 text-center">{c.stock}</span>
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

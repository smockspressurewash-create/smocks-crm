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

const BLANK_CHEMICAL = { name: "", brand: "", category: "Surfactant", itemType: "chemical", unit: "gal", stock: 0, reorderLevel: 5, unitCost: 0, suppliers: [] as any[], notes: "" };
const UNIT_OPTIONS = ["gal", "oz", "qt", "L", "each", "box", "case"];

export function ChemicalModal({ open, onClose, data, onSave }) {
  const [f, setF] = useState<any>(BLANK_CHEMICAL);
  // Old data may only have the single deprecated `supplier` string — seed
  // the new list from it once so it's not silently dropped on save.
  useEffect(() => {
    if (!open) return;
    if (data) {
      const seededSuppliers = Array.isArray(data.suppliers) && data.suppliers.length
        ? data.suppliers
        : (data.supplier ? [{ id: uid(), name: data.supplier, phone: "" }] : []);
      setF({ ...BLANK_CHEMICAL, ...data, itemType: data.itemType || "chemical", unit: data.unit || "gal", suppliers: seededSuppliers });
    } else {
      setF(BLANK_CHEMICAL);
    }
  }, [open, data]);

  const isEquipment = f.itemType === "equipment";
  const addSupplier = () => setF({ ...f, suppliers: [...(f.suppliers || []), { id: uid(), name: "", phone: "" }] });
  const updateSupplier = (id: string, patch: any) => setF({ ...f, suppliers: (f.suppliers || []).map((s: any) => s.id === id ? { ...s, ...patch } : s) });
  const removeSupplier = (id: string) => setF({ ...f, suppliers: (f.suppliers || []).filter((s: any) => s.id !== id) });

  return <Modal open={open} onClose={onClose} title={data ? `Edit ${isEquipment ? "Equipment" : "Chemical"}` : `New ${isEquipment ? "Equipment" : "Chemical"}`}>
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[["chemical", "🧪 Chemical"], ["equipment", "🔧 Equipment"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setF({ ...f, itemType: k, unit: k === "equipment" && f.unit === "gal" ? "each" : f.unit })}
            className={"py-2 rounded-xl text-xs font-medium border transition " + (f.itemType === k ? "bg-red-900/40 border-red-500/50 text-white" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
            {l}
          </button>
        ))}
      </div>
      <div><label className="text-xs text-white/60 mb-1 block">Name *</label><GInput value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder={isEquipment ? "e.g. 15° Rotating Nozzle" : "e.g. Sodium Hypochlorite"} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-white/60 mb-1 block">Brand</label><GInput value={f.brand} onChange={e => setF({ ...f, brand: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Category</label><GInput value={f.category} onChange={e => setF({ ...f, category: e.target.value })} placeholder={isEquipment ? "e.g. Nozzles, Surface Cleaners" : "e.g. Surfactant"} /></div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div><label className="text-xs text-white/60 mb-1 block">{isEquipment ? "On Hand" : "Remaining"}</label><GInput type="number" value={f.stock} onChange={e => setF({ ...f, stock: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Unit</label>
          <GSel value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}>
            {UNIT_OPTIONS.map(u => <option key={u} value={u} className="bg-black">{u}</option>)}
          </GSel>
        </div>
        <div><label className="text-xs text-white/60 mb-1 block">Reorder at</label><GInput type="number" value={f.reorderLevel} onChange={e => setF({ ...f, reorderLevel: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Cost / unit</label><GInput type="number" step="0.01" value={f.unitCost} onChange={e => setF({ ...f, unitCost: e.target.value })} /></div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-white/60">Suppliers</label>
          <button type="button" onClick={addSupplier} className="text-[10px] text-red-400 hover:text-red-300 transition">+ Add supplier</button>
        </div>
        {(f.suppliers || []).length === 0 && <div className="text-[11px] text-white/30 italic">No suppliers on file yet.</div>}
        <div className="space-y-2">
          {(f.suppliers || []).map((s: any) => (
            <div key={s.id} className="p-2 rounded-lg bg-black/20 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <GInput value={s.name} onChange={e => updateSupplier(s.id, { name: e.target.value })} placeholder="Supplier name" className="flex-1" />
                <GInput type="tel" value={s.phone} onChange={e => updateSupplier(s.id, { phone: e.target.value })} placeholder="Phone" className="w-32" />
                <button type="button" onClick={() => removeSupplier(s.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-950/30 transition flex-shrink-0"><X size={14} /></button>
              </div>
              <div className="flex items-center gap-2">
                <GInput type="email" value={s.email || ""} onChange={e => updateSupplier(s.id, { email: e.target.value })} placeholder="Email (optional)" className="flex-1" />
                <GInput value={s.notes || ""} onChange={e => updateSupplier(s.id, { notes: e.target.value })} placeholder="Notes — account #, lead time, etc." className="flex-1" />
              </div>
            </div>
          ))}
        </div>
        {(f.suppliers || []).length > 0 && <div className="text-[10px] text-white/30 mt-1.5">Alfred can text or email any supplier here about stock, pricing, or availability — just ask.</div>}
      </div>
      <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} rows={2} placeholder="Nozzle size, hookup type, storage instructions, anything worth remembering" /></div>
      <div className="flex gap-2 justify-end pt-3"><GBtn variant="ghost" onClick={onClose}>Cancel</GBtn><GBtn onClick={() => { if (!f.name) return; const clean = { ...f, stock: Number(f.stock), reorderLevel: Number(f.reorderLevel), unitCost: Number(f.unitCost), suppliers: (f.suppliers || []).filter((s: any) => s.name.trim()) }; onSave(data ? { ...data, ...clean } : clean); }}>{data ? "Save" : "Add"}</GBtn></div>
    </div>
  </Modal>;
}

// ===== REPORTS =====
// ===== CREW VIEW (field-optimized, mobile-first) =====
// ===== GOOGLE WORKSPACE PAGE =====

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

export function ServiceCatalogSection({ services = [], setServices, toast }) {
  const [f, setF] = useState({ name: "", description: "", price: "", unit: "flat", category: "Washing", taxable: true });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const categories = ["Washing", "Sealing", "Gutter", "Roof", "Commercial", "Recurring", "Add-on", "Other"];

  const save = () => {
    if (!f.name.trim() || !f.price) return;
    if (editId) {
      setServices(prev => prev.map(s => s.id === editId ? { ...s, ...f, price: Number(f.price) } : s));
      toast("Service updated");
    } else {
      setServices(prev => [...prev, { id: uid(), ...f, price: Number(f.price) }]);
      toast("Service added");
    }
    setF({ name: "", description: "", price: "", unit: "flat", category: "Washing", taxable: true });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = s => { setF({ name: s.name, description: s.description || "", price: String(s.price), unit: s.unit || "flat", category: s.category || "Washing", taxable: s.taxable !== false }); setEditId(s.id); setShowForm(true); };
  const del = id => { if (confirm("Remove service?")) setServices(prev => prev.filter(s => s.id !== id)); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Service Catalog</h4>
        <GBtn onClick={() => { setF({ name: "", description: "", price: "", unit: "flat", category: "Washing", taxable: true }); setEditId(null); setShowForm(!showForm); }} className="!text-xs !py-1.5"><Plus size={11} className="inline mr-1" />{showForm ? "Cancel" : "Add Service"}</GBtn>
      </div>

      {showForm && <Glass className="p-4 !bg-black/60">
        <div className="text-xs font-semibold text-white/70 mb-3">{editId ? "Edit Service" : "New Service"}</div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-white/50 mb-1 block">Service name *</label><GInput value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="House Soft Wash" className="!text-xs" /></div>
            <div><label className="text-[10px] text-white/50 mb-1 block">Category</label><GSel value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className="!text-xs">{categories.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel></div>
          </div>
          <div><label className="text-[10px] text-white/50 mb-1 block">Description</label><GInput value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Low-pressure siding & eave cleaning" className="!text-xs" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-white/50 mb-1 block">Default Price ($)</label><GInput type="number" step="5" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} placeholder="450" className="!text-xs" /></div>
            <div><label className="text-[10px] text-white/50 mb-1 block">Pricing Unit</label><GSel value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className="!text-xs">
              <option value="flat" className="bg-black">Flat rate</option>
              <option value="sqft" className="bg-black">Per sq ft</option>
              <option value="linear_ft" className="bg-black">Per linear ft</option>
              <option value="hour" className="bg-black">Per hour</option>
            </GSel></div>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={f.taxable} onChange={e => setF({ ...f, taxable: e.target.checked })} className="w-3.5 h-3.5" />Taxable service</label>
          <div className="flex gap-2 justify-end pt-1">
            <GBtn variant="ghost" onClick={() => { setShowForm(false); setEditId(null); }} className="!text-xs !py-1.5">Cancel</GBtn>
            <GBtn onClick={save} disabled={!f.name.trim() || !f.price} className="!text-xs !py-1.5">Save</GBtn>
          </div>
        </div>
      </Glass>}

      <div className="space-y-1.5">
        {services.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 bg-black/40 border border-red-900/20 rounded-xl group hover:border-red-700/40 transition">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{s.name}</span>
                {s.category && <Badge tone="blue">{s.category}</Badge>}
                {s.taxable !== false && <span className="text-[9px] text-white/40">taxable</span>}
              </div>
              {s.description && <div className="text-xs text-white/50 mt-0.5">{s.description}</div>}
            </div>
            <div className="text-red-400 font-bold text-sm flex-shrink-0">{fmt(s.price)}{s.unit && s.unit !== "flat" ? "/" + s.unit.replace("_", " ") : ""}</div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
              <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-white/10 text-white/50"><Edit size={12} /></button>
              <button onClick={() => del(s.id)} className="p-1.5 rounded hover:bg-red-900/30 text-white/50 hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {services.length === 0 && <div className="text-center py-6 text-xs text-white/40">No services yet — add your first one above</div>}
      </div>
    </div>
  );
}


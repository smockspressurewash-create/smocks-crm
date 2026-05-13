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

export function EstimateBuilder({ open, onClose, customers = [], services = [], settings = {}, onSave, estimateTemplates = [], setEstimateTemplates = () => {} }) {
  const [cid, setCid] = useState("");
  const [items, setItems] = useState([]);
  const [vu, setVu] = useState(daysFromNow(30));
  const [discount, setDiscount] = useState(0);
  const [depositRequired, setDepositRequired] = useState(0);
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const taxRate = Number(settings?.taxRate || 6);

  useEffect(() => {
    if (open) {
      setCid(customers[0]?.id || "");
      setItems([{ id: uid(), description: "", quantity: 1, unitPrice: 0 }]);
      setVu(daysFromNow(30));
      setDiscount(0);
      setDepositRequired(0);
      setTerms("Payment due upon completion. 3-day cancellation notice requested. Weather reschedules free of charge.");
      setNotes("");
      setSavingTemplate(false);
      setTemplateName("");
    }
  }, [open, customers]);

  const sub = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);
  const afterDisc = Math.max(0, sub - Number(discount));
  const tax = afterDisc * (taxRate / 100);
  const tot = afterDisc + tax;

  const addSvc = sid => {
    const s = services.find(x => x.id === sid);
    if (!s) return;
    setItems([...items.filter(i => i.description), { id: uid(), description: s.name, quantity: 1, unitPrice: s.price }]);
  };

  const loadTemplate = tpl => {
    setItems(tpl.lineItems.map(li => ({ ...li, id: uid() })));
    if (tpl.discount) setDiscount(tpl.discount);
    if (tpl.depositRequired) setDepositRequired(tpl.depositRequired);
    if (tpl.terms) setTerms(tpl.terms);
    if (tpl.notes) setNotes(tpl.notes);
  };

  const saveAsTemplate = () => {
    if (!templateName.trim()) return;
    const tpl = { id: uid(), name: templateName.trim(), lineItems: items, discount: Number(discount), depositRequired: Number(depositRequired), terms, notes, createdAt: today() };
    setEstimateTemplates(prev => [...prev, tpl]);
    setSavingTemplate(false);
    setTemplateName("");
  };

  const submit = () => {
    if (!cid || items.some(i => !i.description)) return;
    onSave({ id: uid(), customerId: cid, lineItems: items, subtotal: sub, discount: Number(discount), depositRequired: Number(depositRequired), tax, total: tot, status: "pending", createdAt: today(), validUntil: vu, viewed: false, viewedAt: null, terms, notes, internalNote });
  };

  return (
    <Modal open={open} onClose={onClose} title="Build Estimate" maxW="max-w-3xl">
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block">Customer</label><GSel value={cid} onChange={e => setCid(e.target.value)}>{customers.map(c => <option key={c.id} value={c.id} className="bg-black">{c.firstName} {c.lastName}</option>)}</GSel></div>
          <div><label className="text-xs text-white/60 mb-1 block">Valid until</label><GDate value={vu} onChange={e => setVu(e.target.value)} /></div>
        </div>

        {/* Template loader */}
        {estimateTemplates.length > 0 && <div className="flex items-center gap-2 p-3 bg-purple-950/20 border border-purple-700/30 rounded-xl">
          <Layers size={13} className="text-purple-400 flex-shrink-0" />
          <label className="text-xs text-white/60 flex-shrink-0">Load template:</label>
          <GSel onChange={e => { if (e.target.value) { const t = estimateTemplates.find(x => x.id === e.target.value); if (t) loadTemplate(t); e.target.value = ""; } }} value="" className="!text-xs flex-1">
            <option value="" className="bg-black">— Choose template —</option>
            {estimateTemplates.map(t => <option key={t.id} value={t.id} className="bg-black">{t.name}</option>)}
          </GSel>
        </div>}

        <div className="p-3 bg-black/40 border border-red-900/20 rounded-xl">
          <label className="text-xs text-white/60 mb-1 block">Add from catalog</label>
          <GSel onChange={e => e.target.value && addSvc(e.target.value)} value=""><option value="" className="bg-black">Select service...</option>{services.map(s => <option key={s.id} value={s.id} className="bg-black">{s.name} — {fmt(s.price)}</option>)}</GSel>
        </div>

        {/* AI Pricing Assistant — sqft-based + AI comparables */}
        {(() => {
          const c = customers.find(x => x.id === cid);
          const sqft = c?.sqFootage ? Number(c.sqFootage) : null;
          if (!sqft || sqft <= 0) return null;
          const suggestions = [
            { service: "House Soft Wash", rate: 0.15, min: 299, desc: "Full exterior siding" },
            { service: "Driveway Wash", rate: 0.08, min: 149, desc: "Concrete / pavers" },
            { service: "Roof Soft Wash", rate: 0.22, min: 399, desc: "Algae + moss removal" },
            { service: "Deck / Patio Wash", rate: 0.12, min: 199, desc: "Wood or concrete" },
            { service: "Fence Wash", rate: 0.10, min: 149, desc: "Privacy or picket" },
            { service: "Gutter Cleaning", rate: 0.06, min: 129, desc: "Clean + flush" },
          ].map(s => ({ ...s, price: Math.max(s.min, Math.round(sqft * s.rate / 5) * 5) }));
          // Market comparison based on region (York PA averages)
          const marketAvg = { "House Soft Wash": 385, "Driveway Wash": 175, "Roof Soft Wash": 520, "Deck / Patio Wash": 245, "Fence Wash": 175, "Gutter Cleaning": 159 };
          return <div className="p-4 bg-gradient-to-br from-blue-950/30 to-black/60 border border-blue-700/30 rounded-xl">
            <div className="text-xs text-blue-300 font-semibold mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">✨ AI Pricing Assistant <span className="text-blue-400/60 font-normal">for {sqft.toLocaleString()} sq ft</span></span>
              <span className="text-[10px] text-blue-400/50">York PA market rates</span>
            </div>
            <div className="grid gap-2">
              {suggestions.map(s => {
                const mkt = marketAvg[s.service] || s.price;
                const diff = s.price - mkt;
                const pct = Math.round(Math.abs(diff) / mkt * 100);
                return <div key={s.service} className="flex items-center gap-3 p-2.5 bg-black/40 border border-blue-900/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold">{s.service} <span className="text-white/40 font-normal">({s.desc})</span></div>
                    <div className="text-[10px] text-white/40 mt-0.5">Market avg: {fmt(mkt)} · {diff >= 0 ? "+" : ""}{pct}% {diff >= 0 ? "above" : "below"} avg</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={"text-sm font-bold " + (diff >= 0 ? "text-green-400" : "text-yellow-400")}>{fmt(s.price)}</div>
                  </div>
                  <button onClick={() => setItems(prev => [...prev.filter(i => i.description), { id: uid(), description: s.service, quantity: 1, unitPrice: s.price }])} className="px-2.5 py-1.5 rounded-lg bg-blue-950/60 border border-blue-700/40 text-blue-200 text-xs hover:bg-blue-900/60 transition flex-shrink-0">Add</button>
                </div>;
              })}
            </div>
            <div className="text-[10px] text-blue-400/50 mt-2">Prices based on square footage and York PA market comparables. Adjust for property condition, access difficulty, and travel distance.</div>
          </div>;
        })()}

        {/* Chemical Cost Calculator (AI-powered) */}
        <ChemicalCostCalc items={items} settings={settings} />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/60">Line items</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setSavingTemplate(!savingTemplate)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"><Save size={10} />Save as template</button>
              <button onClick={() => setItems([...items, { id: uid(), description: "", quantity: 1, unitPrice: 0 }])} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
          </div>
          {savingTemplate && <div className="flex gap-2 mb-2 p-2.5 bg-purple-950/20 border border-purple-700/30 rounded-xl">
            <GInput placeholder="Template name (e.g. House + Driveway Package)" value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveAsTemplate()} className="!text-xs flex-1" />
            <GBtn onClick={saveAsTemplate} disabled={!templateName.trim()} className="!text-xs !py-1.5 flex-shrink-0">Save</GBtn>
            <button onClick={() => setSavingTemplate(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
          </div>}
          <div className="space-y-2">
            {items.map(it => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 md:col-span-6"><GInput placeholder="Description" value={it.description} onChange={e => setItems(items.map(i => i.id === it.id ? { ...i, description: e.target.value } : i))} /></div>
                <div className="col-span-4 md:col-span-2"><GInput type="number" placeholder="Qty" value={it.quantity} onChange={e => setItems(items.map(i => i.id === it.id ? { ...i, quantity: e.target.value } : i))} /></div>
                <div className="col-span-6 md:col-span-3"><GInput type="number" placeholder="Price" value={it.unitPrice} onChange={e => setItems(items.map(i => i.id === it.id ? { ...i, unitPrice: e.target.value } : i))} /></div>
                <div className="col-span-2 md:col-span-1 text-right">{items.length > 1 && <button onClick={() => setItems(items.filter(i => i.id !== it.id))} className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg"><Trash2 size={14} /></button>}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block">Discount ($)</label><GInput type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Deposit Required ($)</label><GInput type="number" step="0.01" value={depositRequired} onChange={e => setDepositRequired(e.target.value)} /></div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Shield size={10} />Terms & Conditions</label><GTxt rows={3} value={terms} onChange={e => setTerms(e.target.value)} placeholder="Payment terms, cancellation policy..." className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Clipboard size={10} />Customer Notes <span className="text-white/30 font-normal">(visible on estimate)</span></label><GTxt rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. 'We'll pre-treat the algae stains on the north side'" className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Lock size={10} className="text-yellow-400" />Internal Notes <span className="text-white/30 font-normal">(crew only, not shown to customer)</span></label><GTxt rows={2} value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Gate code, dog warning, access issues, chemical notes..." className="!text-xs border-yellow-900/30" /></div>
        </div>

        <Glass className="p-4 !rounded-xl bg-black/60">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-white/70"><span>Subtotal</span><span>{fmt(sub)}</span></div>
            {Number(discount) > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>− {fmt(Number(discount))}</span></div>}
            <div className="flex justify-between text-white/70"><span>Tax ({taxRate}%)</span><span>{fmt(tax)}</span></div>
            <div className="flex justify-between font-bold text-white text-base pt-2 border-t border-red-900/30"><span>Total</span><span className="text-red-400">{fmt(tot)}</span></div>
          </div>
        </Glass>

        <div className="flex gap-2 justify-end"><GBtn variant="ghost" onClick={onClose}>Cancel</GBtn><GBtn onClick={submit}>Create</GBtn></div>
      </div>
    </Modal>
  );
}


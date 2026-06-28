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

export function CustomersPage({ customers = [], setCustomers, estimates = [], jobs = [], toast, timeline = {}, setTimeline = () => {}, settings = {} as AppSettings }: { customers?: any[]; setCustomers?: any; estimates?: any[]; jobs?: any[]; toast?: any; timeline?: any; setTimeline?: any; settings?: AppSettings }) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState({ open: false, data: null });
  const [detail, setDetail] = useState(null);
  const [pageTab, setPageTab] = useState("list"); // list | analytics | duplicates
  const [dupPairs, setDupPairs] = useState(null); // null = not scanned, [] = no dupes
  const [mergeModal, setMergeModal] = useState(null); // { a, b }
  const [mergeChoices, setMergeChoices] = useState({}); // field → "a" | "b"
  const [mergeMode, setMergeMode] = useState(false);
  const [mergePair, setMergePair] = useState([]);
  const fileRef = useRef(null);

  const toggleMerge = id => setMergePair(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev);

  const doSimpleMerge = () => {
    if (mergePair.length !== 2) return;
    const [aId, bId] = mergePair;
    const a = customers.find(c => c.id === aId);
    const b = customers.find(c => c.id === bId);
    if (!a || !b) return;
    const merged = { ...a, ...b, id: a.id, totalSpent: (a.totalSpent || 0) + (b.totalSpent || 0), notes: [a.notes, b.notes].filter(Boolean).join(" | ") };
    setCustomers(customers.filter(c => c.id !== bId).map(c => c.id === aId ? merged : c));
    setMergeMode(false);
    setMergePair([]);
    toast("Customers merged ✓");
  };

  const filtered = customers.filter(c => (c.firstName + " " + c.lastName + " " + c.email + " " + c.phone).toLowerCase().includes(search.toLowerCase()));

  const save = d => {
    if (d.id) setCustomers(customers.map(c => c.id === d.id ? d : c));
    else setCustomers([...customers, { ...d, id: uid(), totalSpent: 0, createdAt: today() }]);
    setModal({ open: false, data: null });
    toast("Customer saved");
  };

  // Scan for duplicates by name similarity, phone, or email
  const scanDuplicates = () => {
    const pairs = [];
    const seen = new Set();
    for (let i = 0; i < customers.length; i++) {
      for (let j = i + 1; j < customers.length; j++) {
        const a = customers[i], b = customers[j];
        const key = [a.id, b.id].sort().join("-");
        if (seen.has(key)) continue;
        const nameA = (a.firstName + " " + a.lastName).toLowerCase().trim();
        const nameB = (b.firstName + " " + b.lastName).toLowerCase().trim();
        const samePhone = a.phone && b.phone && a.phone.replace(/\D/g,"") === b.phone.replace(/\D/g,"");
        const sameEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();
        const sameName = nameA === nameB || (nameA.length > 3 && nameB.startsWith(nameA.slice(0,4)));
        if (samePhone || sameEmail || sameName) {
          const reason = samePhone ? "Same phone" : sameEmail ? "Same email" : "Similar name";
          pairs.push({ a, b, reason });
          seen.add(key);
        }
      }
    }
    setDupPairs(pairs);
    setPageTab("duplicates");
    toast(pairs.length > 0 ? "Found " + pairs.length + " potential duplicate" + (pairs.length !== 1 ? "s" : "") : "No duplicates found ✓");
  };

  // Smart merge — user picks which field wins
  const openMerge = (a, b) => {
    const choices = {};
    const fields = ["firstName","lastName","phone","email","address","notes","leadSource","sqFootage","gateCode"];
    fields.forEach(f => { choices[f] = a[f] ? "a" : "b"; });
    setMergeChoices(choices);
    setMergeModal({ a, b });
  };

  const doMerge = () => {
    const { a, b } = mergeModal;
    const merged = { ...a };
    Object.entries(mergeChoices).forEach(([field, choice]) => { merged[field] = choice === "a" ? a[field] : b[field]; });
    merged.totalSpent = (a.totalSpent || 0) + (b.totalSpent || 0);
    merged.tags = [...new Set([...(a.tags||[]), ...(b.tags||[])])];
    setCustomers(customers.filter(c => c.id !== b.id).map(c => c.id === a.id ? merged : c));
    setDupPairs(prev => prev?.filter(p => !(p.a.id === a.id && p.b.id === b.id)));
    setMergeModal(null);
    toast("Merged: " + merged.firstName + " " + merged.lastName + " ✓");
  };

  const exportCSV = () => {
    const rows = [["firstName", "lastName", "email", "phone", "address", "totalSpent", "createdAt", "gateCode", "hasDog", "dogName", "sensitivePlants", "notes"]];
    customers.forEach(c => rows.push([c.firstName, c.lastName, c.email, c.phone, c.address, c.totalSpent, c.createdAt, c.gateCode || "", c.hasDog ? "yes" : "", c.dogName || "", c.sensitivePlants || "", c.notes || ""]));
    const csv = rows.map(r => r.map(v => '"' + String(v || "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(u);
    toast("Exported " + customers.length + " customers");
  };

  const importCSV = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const lines = (r.result as string).split(/\r?\n/).filter(Boolean);
        const [hdr, ...rows] = lines;
        const cols = hdr.split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());

        // Flexible field mapping — handles Markate, generic CSVs, and our own format
        const fieldMap = {
          firstName: ["firstname", "first_name", "first name", "fname", "given name"],
          lastName: ["lastname", "last_name", "last name", "lname", "surname", "family name"],
          email: ["email", "email address", "e-mail"],
          phone: ["phone", "phonenumber", "phone_number", "phone number", "mobile", "cell"],
          address: ["address", "street", "street address", "property address", "location"],
          notes: ["notes", "note", "comments", "description"],
          leadSource: ["leadsource", "lead_source", "lead source", "source", "how found"],
          tags: ["tags", "tag", "customer type", "type"],
          totalSpent: ["totalspent", "total_spent", "total spent", "revenue", "ltv"],
          sqFootage: ["sqfootage", "sq_footage", "sqft", "square feet", "sq ft"],
          gateCode: ["gatecode", "gate_code", "gate code", "access code"]
        };

        const getField = (obj, fieldKey) => {
          const aliases = fieldMap[fieldKey] || [fieldKey];
          for (const alias of aliases) {
            const found = Object.keys(obj).find(k => k.toLowerCase() === alias);
            if (found) return obj[found];
          }
          return "";
        };

        const imported = rows.map(ln => {
          // Handle quoted CSV fields correctly
          const vals = [];
          let current = "", inQuote = false;
          for (const ch of ln) {
            if (ch === '"') { inQuote = !inQuote; }
            else if (ch === "," && !inQuote) { vals.push(current.trim()); current = ""; }
            else { current += ch; }
          }
          vals.push(current.trim());

          const raw = {};
          cols.forEach((k, i) => raw[k] = vals[i] || "");

          return {
            id: uid(),
            firstName: getField(raw, "firstName"),
            lastName: getField(raw, "lastName"),
            email: getField(raw, "email"),
            phone: getField(raw, "phone"),
            address: getField(raw, "address"),
            notes: getField(raw, "notes"),
            leadSource: getField(raw, "leadSource"),
            tags: getField(raw, "tags") ? [getField(raw, "tags")] : [],
            totalSpent: Number(getField(raw, "totalSpent").replace(/[^0-9.]/g, "")) || 0,
            sqFootage: getField(raw, "sqFootage"),
            gateCode: getField(raw, "gateCode"),
            createdAt: today(),
            pipelineStage: "lead"
          };
        }).filter(c => c.firstName || c.lastName);

        if (imported.length) {
          // Duplicate detection — skip if email matches existing
          const existing = new Set(customers.map(c => c.email?.toLowerCase()).filter(Boolean));
          const fresh = imported.filter(c => !c.email || !existing.has(c.email.toLowerCase()));
          const dupes = imported.length - fresh.length;
          setCustomers(prev => [...prev, ...fresh]);
          toast("✅ Imported " + fresh.length + " customers" + (dupes > 0 ? " · " + dupes + " duplicates skipped" : ""));
        } else {
          toast("No valid rows found. Check column headers (need First Name, Last Name).", "error");
        }
      } catch (err) { toast("Import failed: " + err.message, "error"); }
    };
    r.readAsText(file);
    e.target.value = "";
  };

  const quickAction = (kind, c) => {
    if (kind === "call" && c.phone) { window.location.href = "tel:" + c.phone.replace(/\D/g, ""); return; }
    if (kind === "text" && c.phone) { window.location.href = "sms:" + c.phone.replace(/\D/g, ""); return; }
    if (kind === "email" && c.email) { window.location.href = "mailto:" + c.email; return; }
    toast("No contact info for " + kind);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 items-center">
          {["list", "analytics", "duplicates"].map(t => <button key={t} onClick={() => { setPageTab(t); if (t === "duplicates" && dupPairs === null) scanDuplicates(); }} className={"px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition " + (pageTab === t ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{t === "analytics" ? "📊 LTV Analytics" : t === "duplicates" ? "🔍 Find Duplicates" + (dupPairs?.length > 0 ? " (" + dupPairs.length + ")" : "") : "👥 Customers"}</button>)}
          {pageTab === "list" && <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <GInput placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="!pl-9 !py-1.5 !text-xs" />
          </div>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
          <GBtn variant="ghost" onClick={() => fileRef.current?.click()}><Download size={14} className="inline mr-1.5 rotate-180" />Import</GBtn>
          <GBtn variant="ghost" onClick={exportCSV}><Download size={14} className="inline mr-1.5" />Export</GBtn>
          <GBtn variant={mergeMode ? "danger" : "ghost"} onClick={() => { setMergeMode(!mergeMode); setMergePair([]); }}><UserCheck size={14} className="inline mr-1.5" />{mergeMode ? "Cancel Merge" : "Merge"}</GBtn>
          <GBtn onClick={() => setModal({ open: true, data: null })}><Plus size={14} className="inline mr-1.5" />Add</GBtn>
        </div>
      </div>

      {/* LTV Analytics tab */}
      {pageTab === "analytics" && <CustomerAnalytics customers={customers} jobs={jobs} estimates={estimates} />}

      {/* Duplicates tab */}
      {pageTab === "duplicates" && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/60">{dupPairs === null ? "Click Scan to find duplicates" : dupPairs.length === 0 ? "✅ No duplicates found" : dupPairs.length + " potential duplicate" + (dupPairs.length !== 1 ? "s" : "") + " found"}</div>
          <GBtn onClick={scanDuplicates} className="!text-xs"><Search size={12} className="inline mr-1" />Rescan</GBtn>
        </div>
        {dupPairs?.length > 0 && <div className="space-y-3">
          {dupPairs.map((pair, i) => (
            <Glass key={i} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge tone="yellow">{pair.reason}</Badge>
                <div className="flex gap-2">
                  <GBtn onClick={() => openMerge(pair.a, pair.b)} className="!text-xs !py-1">Merge</GBtn>
                  <GBtn variant="ghost" onClick={() => setDupPairs(prev => prev.filter((_, j) => j !== i))} className="!text-xs !py-1">Not a dup</GBtn>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {[pair.a, pair.b].map((c, ci) => (
                  <div key={c.id} className={"p-3 rounded-xl border " + (ci === 0 ? "border-blue-700/40 bg-blue-950/20" : "border-purple-700/40 bg-purple-950/20")}>
                    <div className="font-bold">{c.firstName} {c.lastName}</div>
                    <div className="text-white/60 mt-1 space-y-0.5">
                      {c.phone && <div>📞 {c.phone}</div>}
                      {c.email && <div>📧 {c.email}</div>}
                      {c.address && <div>📍 {c.address.split(",")[0]}</div>}
                      <div className="text-white/40">LTV: {fmt(c.totalSpent || 0)} · Added {c.createdAt}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Glass>
          ))}
        </div>}
      </div>}

      {/* Merge modal */}
      {mergeModal && <Modal open={!!mergeModal} onClose={() => setMergeModal(null)} title="Merge Customers — Choose which info to keep" maxW="max-w-2xl">
        <div className="space-y-3">
          <div className="text-xs text-white/60 mb-2">Click each field to choose which version to keep. Combined LTV and tags are kept from both.</div>
          {[
            { key: "firstName", label: "First Name" }, { key: "lastName", label: "Last Name" },
            { key: "phone", label: "Phone" }, { key: "email", label: "Email" },
            { key: "address", label: "Address" }, { key: "leadSource", label: "Lead Source" },
            { key: "sqFootage", label: "Sq Footage" }, { key: "gateCode", label: "Gate Code" },
            { key: "notes", label: "Notes" }
          ].filter(f => mergeModal.a[f.key] || mergeModal.b[f.key]).map(f => (
            <div key={f.key} className="grid grid-cols-3 gap-2 items-center">
              <div className="text-[10px] text-white/50 uppercase tracking-wider">{f.label}</div>
              {["a","b"].map(side => {
                const c = mergeModal[side];
                const val = c[f.key];
                const active = mergeChoices[f.key] === side;
                return <button key={side} onClick={() => setMergeChoices(prev => ({ ...prev, [f.key]: side }))} className={"p-2.5 rounded-xl border text-left text-xs transition " + (active ? "border-green-500/60 bg-green-950/30 text-green-300" : "border-white/10 bg-black/40 text-white/50 hover:text-white hover:border-white/20") + (!val ? " opacity-30" : "")}>
                  {active && <span className="text-green-400 mr-1">✓</span>}{val || <span className="italic text-white/30">empty</span>}
                </button>;
              })}
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-3 border-t border-red-900/20">
            <GBtn variant="ghost" onClick={() => setMergeModal(null)}>Cancel</GBtn>
            <GBtn onClick={doMerge}>Merge → Keep Selected Fields</GBtn>
          </div>
        </div>
      </Modal>}

      {pageTab === "list" && <>
      {mergeMode && <Glass className="p-3 !bg-yellow-950/20 !border-yellow-700/40">
        <div className="flex items-center justify-between">
          <div className="text-sm text-yellow-300">Select 2 customers to merge ({mergePair.length}/2)</div>
          {mergePair.length === 2 && <GBtn onClick={doSimpleMerge} className="!py-1 !text-xs"><UserCheck size={12} className="inline mr-1" />Merge Now</GBtn>}
        </div>
      </Glass>}

      <Glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-red-900/30 bg-black/40">
                {mergeMode && <th className="px-4 py-3"></th>}
                <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider hidden lg:table-cell">Phone</th>
                <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Spent</th>
                <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const sel = mergePair.includes(c.id);
                return (
                  <tr key={c.id} className={"border-b border-red-900/10 hover:bg-white/5 transition " + (sel ? "bg-yellow-950/20" : "")}>
                    {mergeMode && <td className="px-4 py-4"><input type="checkbox" checked={sel} onChange={() => toggleMerge(c.id)} className="w-4 h-4 accent-red-600" /></td>}
                    <td className="px-5 py-4 cursor-pointer" onClick={() => !mergeMode && setDetail(c)}>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{c.firstName} {c.lastName}</div>
                        {c.hasDog && <span title={"Dog: " + c.dogName} className="text-[10px]">🐕</span>}
                        {c.gateCode && <span title={"Gate: " + c.gateCode} className="text-[10px]">🔒</span>}
                      </div>
                      <div className="text-xs text-white/50">{c.email}</div>
                    </td>
                    <td className="px-5 py-4 text-white/70 hidden lg:table-cell cursor-pointer" onClick={() => !mergeMode && setDetail(c)}>{c.phone}</td>
                    <td className="px-5 py-4 text-right font-semibold text-red-400 cursor-pointer" onClick={() => !mergeMode && setDetail(c)}>{fmt(c.totalSpent)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => quickAction("call", c)} className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400 transition"><Phone size={14} /></button>
                        <button onClick={() => quickAction("text", c)} className="p-1.5 rounded-lg hover:bg-blue-900/30 text-white/60 hover:text-blue-400 transition"><MessageSquare size={14} /></button>
                        <button onClick={() => window.open("https://maps.google.com/?q=" + encodeURIComponent(c.address || ""), "_blank")} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition" title="Directions"><MapPin size={14} /></button>
                        <button onClick={() => { const lastJob = jobs.filter(j => j.customerId === c.id && j.status === "completed").slice(-1)[0]; if (lastJob) { toast("Review request queued for " + c.firstName); } else { toast("No completed jobs for " + c.firstName, "error"); }}} className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/60 hover:text-yellow-400 transition" title="Send review request"><Star size={14} /></button>
                        <button onClick={() => setModal({ open: true, data: c })} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"><Edit size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Glass>

      <CustomerModal open={modal.open} onClose={() => setModal({ open: false, data: null })} data={modal.data} onSave={save} mapsKey={settings.googleMapsKey || (settings as any).mapsKey || ""} />
      <CustomerDetail customer={detail} onClose={() => setDetail(null)} estimates={estimates} jobs={jobs} timeline={timeline} setTimeline={setTimeline} settings={settings} />
      </>}
    </div>
  );
}

// ===== CUSTOMER LTV ANALYTICS =====

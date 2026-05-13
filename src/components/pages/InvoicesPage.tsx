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

export function InvoicesPage({ estimates = [], setEstimates, customers = [], settings = {}, toast }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState(null);
  const [selected, setSelected] = useState([]);

  // Only approved+invoiced estimates are invoices
  const invoices = estimates.filter(e => e.invoiced);

  const bucket = inv => {
    if (inv.paidAt) return "paid";
    const age = inv.invoicedAt ? daysSince(inv.invoicedAt) : 0;
    if (age > 60) return "overdue60";
    if (age > 30) return "overdue30";
    if (age > 14) return "overdue";
    return "open";
  };

  const filtered = invoices
    .filter(inv => filter === "all" || bucket(inv) === filter || (filter === "unpaid" && !inv.paidAt))
    .filter(inv => {
      if (!search.trim()) return true;
      const c = customers.find(x => x.id === inv.customerId);
      const q = search.toLowerCase();
      return inv.id.toLowerCase().includes(q) || (c?.firstName + " " + c?.lastName).toLowerCase().includes(q);
    })
    .sort((a, b) => (b.invoicedAt || "").localeCompare(a.invoicedAt || ""));

  // Stats
  const totalOutstanding = invoices.filter(i => !i.paidAt).reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter(i => i.paidAt).reduce((s, i) => s + i.total, 0);
  const overdueTotal = invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) > 14).reduce((s, i) => s + i.total, 0);
  const avgDaysToPay = (() => {
    const paid = invoices.filter(i => i.paidAt && i.invoicedAt);
    if (paid.length === 0) return "—";
    const avg = paid.reduce((s, i) => s + (daysSince(i.invoicedAt) - daysSince(i.paidAt)), 0) / paid.length;
    return Math.round(avg) + "d";
  })();

  // Aging buckets
  const aging = {
    current: invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) <= 14).reduce((s, i) => s + i.total, 0),
    days15_30: invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) > 14 && daysSince(i.invoicedAt) <= 30).reduce((s, i) => s + i.total, 0),
    days31_60: invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) > 30 && daysSince(i.invoicedAt) <= 60).reduce((s, i) => s + i.total, 0),
    days60plus: invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) > 60).reduce((s, i) => s + i.total, 0)
  };
  const totalAging = aging.current + aging.days15_30 + aging.days31_60 + aging.days60plus;

  const markPaid = id => {
    setEstimates(estimates.map(e => e.id === id ? { ...e, paidAt: today(), status: "approved" } : e));
    toast("Marked paid");
  };
  const markUnpaid = id => {
    setEstimates(estimates.map(e => e.id === id ? { ...e, paidAt: null } : e));
    toast("Marked unpaid");
  };
  const sendReminder = async inv => {
    const c = customers.find(x => x.id === inv.customerId);
    if (!c) return;
    const age = inv.invoicedAt ? daysSince(inv.invoicedAt) : 0;
    const msg = `Hi ${c.firstName}, this is a friendly reminder that your invoice of ${fmt(inv.total)} from Smock's Pressure Washing is ${age > 0 ? age + " days " : ""}past due. Pay online or call (717) 555-0100. Thank you!`;
    if (settings?.twilioSid && c.phone) {
      try {
        await twilioSend(settings, c.phone, msg);
        toast("Reminder sent to " + c.firstName + " via SMS ✓");
      } catch (e) {
        toast("SMS failed: " + e.message, "error");
      }
    } else {
      toast("Reminder queued for " + c.firstName + " — connect Twilio to send SMS");
    }
  };
  const sendBulkReminders = async () => {
    const toSend = selected.length > 0
      ? estimates.filter(e => selected.includes(e.id) && e.invoiced && !e.paidAt)
      : estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 7);
    let sent = 0, failed = 0;
    for (const inv of toSend) {
      const c = customers.find(x => x.id === inv.customerId);
      if (!c) continue;
      const age = inv.invoicedAt ? daysSince(inv.invoicedAt) : 0;
      const msg = "Hi " + c.firstName + ", friendly reminder that your invoice of " + fmt(inv.total) + " from Smock's is " + (age > 0 ? age + " days " : "") + "past due. Please pay at your convenience. Call (717) 555-0100 with questions. Thank you!";
      try {
        if (settings?.twilioSid && c.phone) { await twilioSend(settings, c.phone, msg); sent++; }
        else if (c.phone) { window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg); sent++; break; }
      } catch { failed++; }
    }
    setSelected([]);
    toast("Reminders sent: " + sent + (failed > 0 ? " · " + failed + " failed" : ""));
  };

  const toggleSel = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleSelAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(i => i.id));

  const statusBadge = inv => {
    const b = bucket(inv);
    if (b === "paid") return <Badge tone="green">Paid</Badge>;
    if (b === "overdue60") return <Badge tone="red">60+ days</Badge>;
    if (b === "overdue30") return <Badge tone="red">30+ days</Badge>;
    if (b === "overdue") return <Badge tone="yellow">Overdue</Badge>;
    return <Badge tone="blue">Open</Badge>;
  };

  const filterTabs = [
    { k: "all", l: "All", n: invoices.length },
    { k: "unpaid", l: "Unpaid", n: invoices.filter(i => !i.paidAt).length },
    { k: "open", l: "Open", n: invoices.filter(i => bucket(i) === "open").length },
    { k: "overdue", l: "Overdue", n: invoices.filter(i => ["overdue", "overdue30", "overdue60"].includes(bucket(i))).length },
    { k: "paid", l: "Paid", n: invoices.filter(i => i.paidAt).length }
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Outstanding" value={fmt(totalOutstanding)} />
        <Stat icon={AlertTriangle} label="Overdue" value={fmt(overdueTotal)} />
        <Stat icon={CheckCircle} label="Paid YTD" value={fmt(totalPaid)} />
        <Stat icon={Clock} label="Avg Days to Pay" value={avgDaysToPay} />
      </div>

      {/* Aging breakdown */}
      {totalAging > 0 && <Glass className="p-5">
        <div className="flex items-center gap-2 mb-4"><Activity size={14} className="text-red-400" /><h3 className="font-semibold text-sm">Accounts Receivable Aging</h3></div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { k: "current", l: "Current (0-14d)", v: aging.current, tone: "bg-green-600" },
            { k: "days15_30", l: "15-30 days", v: aging.days15_30, tone: "bg-yellow-500" },
            { k: "days31_60", l: "31-60 days", v: aging.days31_60, tone: "bg-orange-500" },
            { k: "days60plus", l: "60+ days", v: aging.days60plus, tone: "bg-red-600" }
          ].map(b => {
            const pct = totalAging ? (b.v / totalAging) * 100 : 0;
            return <div key={b.k} className="space-y-1">
              <div className="text-[10px] text-white/50 uppercase tracking-wider">{b.l}</div>
              <div className="text-lg font-bold">{fmt(b.v)}</div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden"><div className={"h-full " + b.tone} style={{ width: pct + "%" }} /></div>
            </div>;
          })}
        </div>
        <div className="text-[10px] text-white/40 pt-3 border-t border-red-900/20">Total receivable: <span className="text-red-400 font-semibold">{fmt(totalAging)}</span></div>
      </Glass>}

      {/* Filter + search + actions */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map(t => (
            <button key={t.k} onClick={() => setFilter(t.k)} className={"px-3 py-1.5 rounded-xl text-xs font-medium transition border " + (filter === t.k ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{t.l} ({t.n})</button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="bg-black/40 border border-red-900/30 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-red-500/60 w-44" />
          </div>
          {selected.length > 0 && <GBtn onClick={sendBulkReminders} className="!text-xs"><Send size={12} className="inline mr-1" />Remind ({selected.length})</GBtn>}
        </div>
      </div>

      {/* Invoice table */}
      <Glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-red-900/30 bg-black/40">
              <th className="px-3 py-3 w-10"><input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={toggleSelAll} className="w-4 h-4 rounded accent-red-600" /></th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60">Invoice</th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60">Customer</th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60 hidden md:table-cell">Invoiced</th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60 hidden lg:table-cell">Age</th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60">Status</th>
              <th className="text-right px-3 py-3 text-xs uppercase tracking-wider text-white/60">Amount</th>
              <th className="text-right px-3 py-3 text-xs uppercase tracking-wider text-white/60">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(inv => {
                const c = customers.find(x => x.id === inv.customerId);
                const age = inv.invoicedAt ? daysSince(inv.invoicedAt) : 0;
                const isSel = selected.includes(inv.id);
                return (
                  <tr key={inv.id} className={"border-b border-red-900/10 transition " + (isSel ? "bg-red-950/20" : "hover:bg-white/5")}>
                    <td className="px-3 py-3"><input type="checkbox" checked={isSel} onChange={() => toggleSel(inv.id)} className="w-4 h-4 rounded accent-red-600" /></td>
                    <td className="px-3 py-3"><span className="font-mono text-xs text-red-400">#{inv.id.toUpperCase()}</span></td>
                    <td className="px-3 py-3"><div className="font-medium">{c?.firstName} {c?.lastName}</div><div className="text-[10px] text-white/50 md:hidden">{inv.invoicedAt}</div></td>
                    <td className="px-3 py-3 text-white/70 hidden md:table-cell">{inv.invoicedAt || "—"}</td>
                    <td className="px-3 py-3 hidden lg:table-cell">{inv.paidAt ? <span className="text-green-400 text-xs">Paid</span> : <span className={"text-xs " + (age > 30 ? "text-red-400" : age > 14 ? "text-yellow-400" : "text-white/60")}>{age}d</span>}</td>
                    <td className="px-3 py-3">{statusBadge(inv)}</td>
                    <td className="px-3 py-3 text-right font-bold text-red-400">{fmt(inv.total)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(inv)} title="View" className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"><Eye size={12} /></button>
                        <button onClick={() => {
                          const c = customers.find(x => x.id === inv.customerId);
                          const html = `<!DOCTYPE html><html><head><title>Invoice</title><style>body{font-family:Arial;padding:32px;color:#111;max-width:700px;margin:auto}h1{color:#e11d48}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #e11d48;padding-bottom:16px;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:8px;border-bottom:1px solid #ccc;font-size:10px;text-transform:uppercase}td{padding:8px;border-bottom:1px solid #eee}.r{text-align:right}.total{font-weight:bold;font-size:16px;color:#e11d48}.paid{background:#dcfce7;border:1px solid #16a34a;padding:12px;text-align:center;margin-top:16px;border-radius:8px;font-weight:bold}</style></head><body>
                          <div class="hdr"><div><h1>Smock's Pressure Washing</h1><div style="font-size:12px;color:#666">York, PA · (717) 555-0100</div></div><div style="text-align:right"><strong>INVOICE #${inv.id.slice(-8).toUpperCase()}</strong><br><span style="font-size:12px;color:#666">${inv.invoicedAt || today()}</span></div></div>
                          <div style="margin-bottom:16px"><strong>Bill To:</strong><br>${c ? c.firstName + " " + c.lastName : ""}<br>${c?.address || ""}</div>
                          <table><thead><tr><th>Service</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Amount</th></tr></thead><tbody>
                          ${(inv.lineItems || []).map(li => `<tr><td>${li.description}</td><td class="r">${li.quantity}</td><td class="r">$${Number(li.unitPrice).toFixed(2)}</td><td class="r">$${(li.quantity*li.unitPrice).toFixed(2)}</td></tr>`).join("")}
                          </tbody></table>
                          <div style="text-align:right;margin-top:8px"><div class="total">Total: $${Number(inv.total).toFixed(2)}</div></div>
                          ${inv.paidAt ? `<div class="paid">✓ PAID on ${inv.paidAt}</div>` : ""}
                          <script>window.onload=()=>setTimeout(window.print,300)<\/script></body></html>`;
                          const w = window.open("","_blank"); if(w){w.document.write(html);w.document.close();}
                        }} title="Download PDF" className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"><Download size={12} /></button>
                        {!inv.paidAt && <>
                          <button onClick={() => sendReminder(inv)} title="Send reminder" className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/60 hover:text-yellow-400"><Send size={12} /></button>
                          <button onClick={() => markPaid(inv.id)} title="Mark paid" className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400"><CheckCircle size={12} /></button>
                        </>}
                        {inv.paidAt && <button onClick={() => markUnpaid(inv.id)} title="Mark unpaid" className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/60 hover:text-yellow-400"><Undo2 size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-white/40">
                <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                <div className="text-sm">No invoices yet</div>
                <div className="text-[10px] mt-1">Approve an estimate and convert it to an invoice to see it here.</div>
              </td></tr>}
            </tbody>
          </table>
        </div>
      </Glass>

      {/* Invoice detail modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? "Invoice #" + viewing.id.toUpperCase() : ""} maxW="max-w-2xl">
        {viewing && (() => {
          const c = customers.find(x => x.id === viewing.customerId);
          const age = viewing.invoicedAt ? daysSince(viewing.invoicedAt) : 0;
          return <div className="space-y-4">
            <div className="bg-white text-black rounded-xl p-6">
              <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-red-600">
                <div><div className="text-2xl font-bold text-red-700">Smock's Pressure Washing</div><div className="text-xs text-gray-600 mt-1">Professional Exterior Cleaning</div></div>
                <div className="text-right text-sm"><div className="font-bold text-gray-800">INVOICE</div><div className="text-xs text-gray-600">#{viewing.id.toUpperCase()}</div><div className="text-xs text-gray-600">Invoiced {viewing.invoicedAt}</div></div>
              </div>
              <div className="mb-5 text-sm"><div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Bill to</div><div className="font-semibold">{c?.firstName} {c?.lastName}</div><div className="text-gray-600 text-xs">{c?.address}</div></div>
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500"><th className="text-left py-2">Description</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Unit</th><th className="text-right py-2">Amount</th></tr></thead>
                <tbody>{viewing.lineItems.map(li => <tr key={li.id} className="border-b border-gray-100"><td className="py-2">{li.description}</td><td className="text-right py-2">{li.quantity}</td><td className="text-right py-2">{fmt(li.unitPrice)}</td><td className="text-right py-2 font-medium">{fmt(li.quantity * li.unitPrice)}</td></tr>)}</tbody>
              </table>
              <div className="ml-auto w-56 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{fmt(viewing.subtotal)}</span></div>
                {viewing.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>− {fmt(viewing.discount)}</span></div>}
                <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{fmt(viewing.tax)}</span></div>
                <div className="flex justify-between font-bold text-base border-t-2 border-red-600 pt-1 text-red-700"><span>Total Due</span><span>{fmt(viewing.total)}</span></div>
              </div>
              {viewing.paidAt && <div className="mt-5 p-3 bg-green-50 border border-green-300 rounded-lg text-center text-green-900"><CheckCircle size={18} className="inline mb-0.5 mr-1.5" />Paid on {viewing.paidAt}</div>}
              {!viewing.paidAt && age > 14 && <div className="mt-5 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-900 text-sm"><AlertTriangle size={14} className="inline mr-1.5 mb-0.5" />{age} days past due</div>}
            </div>
            <div className="flex gap-2 justify-end flex-wrap">
              <GBtn variant="ghost" onClick={() => {
                const payLink = "https://smocks.com/pay/" + viewing.id;
                navigator.clipboard?.writeText(payLink).catch(() => {});
                toast("Payment link copied ✓");
              }} className="!text-xs"><Link size={11} className="inline mr-1" />Regen Link</GBtn>
              <GBtn variant="ghost" onClick={() => {
                const html = '<!DOCTYPE html><html><head><title>Invoice ' + viewing.id + '</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:auto;color:#111}h1{color:#e11d48;margin:0}.hdr{display:flex;justify-content:space-between;align-items:start;border-bottom:2px solid #e11d48;padding-bottom:16px;margin-bottom:24px}.sub{color:#666;font-size:12px;margin-top:4px}.meta{text-align:right;font-size:13px}.meta strong{color:#222}.bill{margin-bottom:24px}.bill-lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:4px}.bill-name{font-weight:bold;font-size:15px}.bill-addr{color:#555;font-size:12px}table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px}th{text-align:left;padding:8px;text-transform:uppercase;font-size:10px;letter-spacing:1px;color:#999;border-bottom:1px solid #ccc}td{padding:10px 8px;border-bottom:1px solid #eee}.r{text-align:right}.totals{margin-left:auto;width:280px;font-size:13px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.totals .total{font-weight:bold;font-size:17px;color:#e11d48;border-top:2px solid #e11d48;padding-top:8px;margin-top:8px}.paid{background:#dcfce7;border:1px solid #16a34a;color:#14532d;padding:12px;text-align:center;border-radius:8px;margin-top:24px;font-weight:bold}.due{background:#fef9c3;border:1px solid #ca8a04;color:#713f12;padding:12px;text-align:center;border-radius:8px;margin-top:24px}@media print{body{padding:20px}}</style></head><body>' +
                  '<div class="hdr"><div><h1>Smock\'s Pressure Washing</h1><div class="sub">Professional Exterior Cleaning · York, PA</div></div><div class="meta"><strong>INVOICE</strong><br>#' + viewing.id.toUpperCase() + '<br><span style="color:#666">Invoiced ' + (viewing.invoicedAt || '—') + '</span></div></div>' +
                  '<div class="bill"><div class="bill-lbl">Bill To</div><div class="bill-name">' + (c?.firstName || '') + ' ' + (c?.lastName || '') + '</div><div class="bill-addr">' + (c?.address || '') + '</div></div>' +
                  '<table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Amount</th></tr></thead><tbody>' +
                  viewing.lineItems.map(li => '<tr><td>' + li.description + '</td><td class="r">' + li.quantity + '</td><td class="r">' + fmt(li.unitPrice) + '</td><td class="r"><strong>' + fmt(li.quantity * li.unitPrice) + '</strong></td></tr>').join('') +
                  '</tbody></table>' +
                  '<div class="totals"><div><span>Subtotal</span><span>' + fmt(viewing.subtotal) + '</span></div>' +
                  (viewing.discount > 0 ? '<div style="color:#16a34a"><span>Discount</span><span>− ' + fmt(viewing.discount) + '</span></div>' : '') +
                  '<div><span>Tax</span><span>' + fmt(viewing.tax) + '</span></div><div class="total"><span>Total Due</span><span>' + fmt(viewing.total) + '</span></div></div>' +
                  (viewing.paidAt ? '<div class="paid">✓ PAID on ' + viewing.paidAt + '</div>' : (age > 14 ? '<div class="due">⚠ ' + age + ' days past due — please remit payment.</div>' : '')) +
                  '<div style="margin-top:40px;font-size:11px;color:#888;text-align:center">Thank you for your business. Questions? Call (717) 555-0100</div>' +
                  '<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>';
                const w = window.open("", "_blank");
                if (w) { w.document.write(html); w.document.close(); }
                toast("Opening print dialog — Save as PDF");
              }}><Download size={12} className="inline mr-1.5" />PDF</GBtn>
              {!viewing.paidAt && <>
                <GBtn variant="ghost" className="!text-xs" onClick={() => {
                  navigator.clipboard?.writeText("smocks.com/portal/" + viewing.id).catch(() => {});
                  toast("Payment link copied ✓");
                }}><Link size={11} className="inline mr-1" />Copy Link</GBtn>
                <GBtn variant="ghost" onClick={() => {
                  const cv = customers.find(x => x.id === viewing?.customerId);
                  if (!cv?.phone) { toast("No phone for this customer"); return; }
                  const msg2 = "Hi " + cv.firstName + "! Your invoice for " + fmt(viewing.total) + " from Smock's is ready: smocks.com/portal/" + viewing.id;
                  if (settings?.twilioSid) twilioSend(settings, cv.phone, msg2).then(() => toast("Link sent ✓")).catch(e => toast(e.message, "error"));
                  else window.location.href = "sms:" + cv.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg2);
                }} className="!text-xs"><Send size={11} className="inline mr-1" />Text Link</GBtn>
                <GBtn variant="ghost" onClick={() => {
                  const amt = prompt("Partial payment amount ($):", "");
                  if (!amt || isNaN(Number(amt))) return;
                  const partial = Number(amt);
                  const newBalance = Math.max(0, viewing.total - partial);
                  setEstimates(estimates.map(e => e.id === viewing.id ? { ...e, partialPaid: (e.partialPaid || 0) + partial, paidAt: newBalance === 0 ? today() : null } : e));
                  setViewing({ ...viewing, partialPaid: (viewing.partialPaid || 0) + partial, paidAt: newBalance === 0 ? today() : null });
                  toast("Partial payment of " + fmt(partial) + " recorded · Balance: " + fmt(newBalance));
                }} className="!text-xs"><CreditCard size={11} className="inline mr-1" />Partial Pay</GBtn>
                <GBtn variant="ghost" onClick={() => sendReminder(viewing)}><Send size={12} className="inline mr-1.5" />Remind</GBtn>
                <GBtn onClick={() => { markPaid(viewing.id); setViewing({ ...viewing, paidAt: today() }); }}><CheckCircle size={12} className="inline mr-1.5" />Mark Paid</GBtn>
              </>}
              {viewing.paidAt && <>
                <GBtn variant="ghost" className="!text-xs !border-red-800/40 !text-red-400" onClick={() => {
                  if (!confirm("Issue a refund for this invoice? This marks it as unpaid.")) return;
                  markUnpaid(viewing.id);
                  setViewing({ ...viewing, paidAt: null, refundedAt: today() });
                  toast("Refund issued — invoice marked unpaid");
                }}><Undo2 size={11} className="inline mr-1" />Refund</GBtn>
                <GBtn variant="ghost" onClick={() => { markUnpaid(viewing.id); setViewing({ ...viewing, paidAt: null }); }}><Undo2 size={12} className="inline mr-1.5" />Unpaid</GBtn>
              </>}
            </div>
          </div>;
        })()}
      </Modal>
    </div>
  );
}

// ===== CLIENT PORTAL =====
// ===== CUSTOMER PORTAL LOGIN =====

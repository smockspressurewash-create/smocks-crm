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

export function EstimatesPage({ estimates = [], setEstimates, customers = [], services = [], settings = {} as AppSettings, toast, onPortal = () => {}, estimateTemplates = [], setEstimateTemplates = () => {}, setJobs = () => {}, onNav = () => {} }: { estimates?: any[]; setEstimates?: any; customers?: any[]; services?: any[]; settings?: AppSettings; toast?: any; onPortal?: any; estimateTemplates?: any[]; setEstimateTemplates?: any; setJobs?: any; onNav?: any }) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState([]);

  const setTimeline = (..._args: any[]) => {};
  const createGoogleCalendarEvent = (..._args: any[]) => Promise.resolve(null);
  const cn = id => { const c = customers.find(x => x.id === id); return c ? c.firstName + " " + c.lastName : "Unknown"; };
  const filtered = filter === "all" ? estimates : estimates.filter(e => e.status === filter);

  const toggleSel = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const duplicate = e => {
    const copy = { ...e, id: uid(), createdAt: today(), validUntil: daysFromNow(30), status: "pending", viewed: false, viewedAt: null };
    setEstimates([copy, ...estimates]);
    toast("Estimate duplicated");
  };

  const exportPDF = e => {
    const c = customers.find(x => x.id === e.customerId);
    const html = `<!DOCTYPE html><html><head><title>Estimate ${e.id}</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:auto}h1{color:#e11d48}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}.total{font-size:20px;color:#e11d48;font-weight:bold}</style></head><body><h1>Smock's Pressure Washing</h1><h2>Estimate #${e.id.toUpperCase()}</h2><p><strong>Bill to:</strong> ${c?.firstName} ${c?.lastName}<br>${c?.address || ''}</p><table><tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr>${e.lineItems.map(li => `<tr><td>${li.description}</td><td>${li.quantity}</td><td>${fmt(li.unitPrice)}</td><td>${fmt(li.quantity * li.unitPrice)}</td></tr>`).join('')}</table><p>Subtotal: ${fmt(e.subtotal)}<br>Tax: ${fmt(e.tax)}<br><span class="total">Total: ${fmt(e.total)}</span></p></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estimate-" + e.id + ".html";
    a.click();
    URL.revokeObjectURL(url);
    toast("Estimate exported (HTML — print to PDF)");
  };

  const bulkDelete = () => {
    setEstimates(estimates.filter(e => !selected.includes(e.id)));
    toast(selected.length + " deleted");
    setSelected([]);
  };

  const openPreview = est => {
    setViewing(est);
    if (!est.viewed) {
      setEstimates(prev => prev.map(x => x.id === est.id ? { ...x, viewed: true, viewedAt: today() } : x));
      toast("📬 Estimate #" + est.id.slice(-4).toUpperCase() + " opened by " + (customers.find(c => c.id === est.customerId)?.firstName || "customer"));
    }
  };

  const getExpiryStatus = e => {
    if (e.status !== "pending") return null;
    const days = daysSince(e.validUntil) * -1;
    if (days < 0) return { tone: "red", label: "EXPIRED", border: "border-red-500/60" };
    if (days <= 7) return { tone: "yellow", label: days + "d left", border: "border-yellow-500/50" };
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "approved"].map(s => <button key={s} onClick={() => setFilter(s)} className={"px-3 py-1.5 rounded-xl text-xs font-medium transition border " + (filter === s ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{s === "all" ? "All (" + estimates.length + ")" : s + " (" + estimates.filter(e => e.status === s).length + ")"}</button>)}
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && <>
            <GBtn variant="ghost" onClick={async () => {
              let sent = 0;
              for (const id of selected) {
                const est = estimates.find(x => x.id === id);
                const c = est && customers.find(x => x.id === est.customerId);
                if (!c?.phone || !settings?.twilioSid) continue;
                const msg = "Hi " + c.firstName + "! Your estimate of " + fmt(est.total) + " from Smock's is ready. View it here: smocks.com/portal/" + est.id + " — Questions? Call (717) 555-0100.";
                await twilioSend(settings, c.phone, msg).catch(() => {});
                setEstimates(prev => prev.map(e => e.id === id ? { ...e, sentAt: today() } : e));
                sent++;
              }
              toast("SMS sent to " + sent + " customers ✓");
            }} className="!text-xs"><MessageSquare size={12} className="inline mr-1" />SMS ({selected.length})</GBtn>
            <GBtn variant="ghost" onClick={async () => {
              let sent = 0;
              for (const id of selected) {
                const est = estimates.find(x => x.id === id);
                const c = est && customers.find(x => x.id === est.customerId);
                if (!c?.email) continue;
                await sendEmail(settings, { to: c.email, subject: "Your estimate from Smock's Pressure Washing — " + fmt(est.total), body: "Hi " + c.firstName + ",\n\nYour estimate of " + fmt(est.total) + " is ready to review and sign.\n\nView estimate: smocks.com/portal/" + est.id + "\n\nQuestions? Call (717) 555-0100.\n\n— Smock's Pressure Washing" }).catch(() => {});
                setEstimates(prev => prev.map(e => e.id === id ? { ...e, sentAt: today() } : e));
                sent++;
              }
              toast("Email sent to " + sent + " customers ✓");
            }} className="!text-xs"><Mail size={12} className="inline mr-1" />Email ({selected.length})</GBtn>
            <GBtn variant="danger" onClick={bulkDelete} className="!text-xs"><Trash2 size={12} className="inline mr-1" />Delete</GBtn>
          </>}
          <GBtn onClick={() => setBuilderOpen(true)}><Plus size={14} className="inline mr-1.5" />New</GBtn>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(e => {
          const expiry = getExpiryStatus(e);
          const isSel = selected.includes(e.id);
          return (
            <Glass key={e.id} className={"p-5 hover:border-red-600/50 transition-all " + (isSel ? "ring-2 ring-red-500/50 " : "") + (expiry ? expiry.border : "")}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <input type="checkbox" checked={isSel} onChange={() => toggleSel(e.id)} className="mt-1 w-4 h-4 rounded accent-red-600" />
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                      #{e.id.toUpperCase()}
                      {e.viewed && <span title={"Viewed " + e.viewedAt}><Eye size={10} className="text-green-400" /></span>}
                    </div>
                    <div className="font-semibold mt-1">{cn(e.customerId)}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Badge tone={e.status === "approved" ? "green" : "yellow"}>{e.status}</Badge>
                  {e.invoiced && <Badge tone="blue">Invoiced</Badge>}
                  {expiry && <Badge tone={expiry.tone}>{expiry.label}</Badge>}
                </div>
              </div>
              <div className="text-2xl font-bold cursor-pointer" onClick={() => openPreview(e)}>{fmt(e.total)}</div>
              <div className="text-xs text-white/50 mt-1 space-y-0.5">
                <div>{e.lineItems.length} items · {e.createdAt}</div>
                {e.discount > 0 && <div className="text-green-400">Discount: {fmt(e.discount)}</div>}
                {e.depositRequired > 0 && <div className="text-yellow-400">Deposit: {fmt(e.depositRequired)}</div>}
              </div>
              <div className="flex gap-1 pt-3 mt-3 border-t border-red-900/20">
                <button onClick={() => openPreview(e)} className="flex-1 p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-[11px] transition flex items-center justify-center gap-1"><Eye size={11} />View</button>
                <button onClick={async () => {
                  const c = customers.find(x => x.id === e.customerId);
                  if (!c) return;
                  const portalUrl = "smocks.com/portal/" + e.id;
                  const msg = "Hi " + c.firstName + "! Your estimate of " + fmt(e.total) + " from Smock's is ready. Review and sign here: " + portalUrl + " — questions? Call (717) 555-0100";
                  if (settings?.twilioSid && c.phone) {
                    await twilioSend(settings, c.phone, msg).then(() => { toast("Estimate texted to " + c.firstName + " ✓"); setEstimates(prev => prev.map(x => x.id === e.id ? { ...x, sentAt: today() } : x)); }).catch(er => toast(er.message, "error"));
                  } else if (c.phone) {
                    window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg);
                    toast("SMS app opened with estimate link");
                  } else toast("No phone number for " + c.firstName, "error");
                }} title="Text estimate to customer" className="flex-1 p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400 text-[11px] transition flex items-center justify-center gap-1"><MessageSquare size={11} />SMS</button>
                <button onClick={async () => {
                  const c = customers.find(x => x.id === e.customerId);
                  if (!c?.email) { toast("No email for " + (c?.firstName || "customer"), "error"); return; }
                  const portalUrl = "smocks.com/portal/" + e.id;
                  const subject = "Your estimate from Smock's Pressure Washing — " + fmt(e.total);
                  const body = "Hi " + c.firstName + ",\n\nYour estimate is ready to review:\n\nTotal: " + fmt(e.total) + "\nValid until: " + e.validUntil + "\n\nSign and approve here: " + portalUrl + "\n\nQuestions? Call (717) 555-0100.\n\n— Smock's Pressure Washing";
                  try { await sendEmail(settings, { to: c.email, subject, body }); toast("Estimate emailed to " + c.firstName + " ✓"); setEstimates(prev => prev.map(x => x.id === e.id ? { ...x, sentAt: today() } : x)); }
                  catch(er) { toast(er.message, "error"); }
                }} title="Email estimate to customer" className="flex-1 p-1.5 rounded-lg hover:bg-blue-900/30 text-white/60 hover:text-blue-400 text-[11px] transition flex items-center justify-center gap-1"><Mail size={11} />Email</button>
                <button onClick={() => onPortal(e.id)} className="flex-1 p-1.5 rounded-lg hover:bg-purple-900/30 text-white/60 hover:text-purple-400 text-[11px] transition flex items-center justify-center gap-1" title="Preview exactly what the customer sees — sign, pay, and account history"><Globe size={11} />Preview as Customer</button>
                <button onClick={() => duplicate(e)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-[11px] transition flex items-center justify-center"><Copy size={11} /></button>
              </div>
            </Glass>
          );
        })}
      </div>

      <EstimateBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} customers={customers} services={services} settings={settings} estimateTemplates={estimateTemplates} setEstimateTemplates={setEstimateTemplates} onSave={est => {
        setEstimates([...estimates, est]);
        setBuilderOpen(false);
        toast("Estimate created");
        // Auto-add to customer timeline
        const c = customers.find(x => x.id === est.customerId);
        if (c) setTimeline(prev => ({ ...prev, [c.id]: [{ id: uid(), type: "estimate", note: "Estimate created — " + fmt(est.total), date: today() }, ...(prev[c.id] || [])] }));
      }} />
      <EstimatePreview estimate={viewing} customers={customers} settings={settings} onClose={() => setViewing(null)} onApprove={id => { setEstimates(estimates.map(x => x.id === id ? { ...x, status: "approved", signedAt: today() } : x)); setViewing(null); toast("Approved!"); }} onConvert={id => { setEstimates(estimates.map(x => x.id === id ? { ...x, invoiced: true, invoicedAt: today() } : x)); setViewing(null); toast("Converted to invoice"); }} onSchedule={est => {
        const c = customers.find(x => x.id === est.customerId);
        const newJob = { id: uid(), customerId: est.customerId, address: c?.address || "", amount: est.total, status: "scheduled", scheduledDate: today(), duration: 3, priority: "normal", checklist: [], photos: [], chemicalsUsed: [], crew: [], notes: "From estimate #" + (est.id || "").slice(-4), isRecurring: false, pipelineStage: "scheduled", createdAt: today() };
        setJobs(prev => [...prev, newJob]);
        // Auto-sync to Google Calendar if connected
        if (settings?.googleConnected && settings?.googleScopes?.calendar) {
          createGoogleCalendarEvent(settings, newJob, c).then(ev => { if (ev) toast("📅 Synced to Google Calendar ✓"); });
        }
        setViewing(null);
        toast("Job scheduled from estimate ✓ — set date in Jobs");
        onNav("jobs");
      }} />
    </div>
  );
}

// ===== CHEMICAL COST CALCULATOR (AI-powered) =====

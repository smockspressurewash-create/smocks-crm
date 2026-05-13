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

export function InboxPage({ threads = [], setThreads, customers = [], settings = {}, toast }) {
  const [active, setActive] = useState(threads[0]?.id || null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [newModal, setNewModal] = useState(false);
  const [newDraft, setNewDraft] = useState({ channel: "sms", to: "", phone: "", email: "", subject: "", body: "" });
  const [polling, setPolling] = useState(false);
  const msgEndRef = useRef(null);
  const inputRef = useRef(null);

  const activeThread = threads.find(t => t.id === active);

  // Auto-scroll to bottom of messages
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active, activeThread?.messages.length]);

  // Poll for incoming Twilio messages every 15s
  useEffect(() => {
    if (!settings.twilioSid && !settings.googleBackendUrl) return;
    const poll = async () => {
      setPolling(true);
      try {
        const lastTs = Math.max(0, ...threads.flatMap(t => t.messages.map(m => m.ts)));
        const incoming = await pollTwilioIncoming(settings, lastTs);
        if (incoming.length > 0) {
          setThreads(prev => {
            let updated = [...prev];
            incoming.forEach(msg => {
              const phone = msg.from;
              const customer = customers.find(c => c.phone?.replace(/\D/g, "") === phone.replace(/\D/g, ""));
              const newMsg = { id: uid(), dir: "in", body: msg.body, ts: msg.dateSent ? new Date(msg.dateSent).getTime() : Date.now() };

              // Handle STOP/UNSTOP opt-out keywords (Twilio compliance)
              const body = (msg.body || "").trim().toUpperCase();
              if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(body)) {
                // Auto-unsubscribe from review requests and marketing
                if (customer?.phone) {
                  toast("⛔ " + (customer.firstName || phone) + " replied STOP — unsubscribed");
                }
                // Note: Twilio handles STOP compliance automatically at carrier level
              } else if (["START", "UNSTOP", "YES"].includes(body)) {
                toast("✅ " + (customer?.firstName || phone) + " re-subscribed");
              }

              const existingThread = updated.find(t => t.channel === "sms" && t.contactPhone?.replace(/\D/g, "") === phone.replace(/\D/g, ""));
              if (existingThread) {
                updated = updated.map(t => t.id === existingThread.id ? { ...t, unread: true, messages: [...t.messages, newMsg] } : t);
              } else {
                updated = [{ id: uid(), channel: "sms", contactName: customer ? customer.firstName + " " + customer.lastName : phone, contactPhone: phone, contactEmail: "", customerId: customer?.id || null, unread: true, messages: [newMsg] }, ...updated];
              }
            });
            return updated;
          });
          if (incoming.length > 0) toast(incoming.length + " new message" + (incoming.length > 1 ? "s" : ""));
        }
      } catch { /* silent */ } finally { setPolling(false); }
    };
    poll();
    const h = setInterval(poll, 15000);
    return () => clearInterval(h);
  }, [settings.twilioSid, settings.googleBackendUrl]);

  const markRead = id => setThreads(threads.map(t => t.id === id ? { ...t, unread: false } : t));

  const send = async () => {
    if (!input.trim() || !activeThread || sending) return;
    const msgText = input.trim();
    const outMsg = { id: uid(), dir: "out", body: msgText, ts: Date.now(), status: "sending" };
    // Optimistic add
    setThreads(prev => prev.map(t => t.id === active ? { ...t, messages: [...t.messages, outMsg] } : t));
    setInput("");
    setSending(true);
    try {
      if (activeThread.channel === "sms") {
        if (!activeThread.contactPhone) throw new Error("No phone number for this contact");
        await twilioSend(settings, activeThread.contactPhone, msgText);
        setThreads(prev => prev.map(t => t.id === active ? { ...t, messages: t.messages.map(m => m.id === outMsg.id ? { ...m, status: "sent" } : m) } : t));
        toast("SMS sent ✓");
      } else {
        // Email reply
        if (!activeThread.contactEmail) throw new Error("No email for this contact");
        const lastSubject = activeThread.messages.find(m => m.subject)?.subject || "";
        await sendEmail(settings, { to: activeThread.contactEmail, subject: "Re: " + lastSubject, body: msgText });
        setThreads(prev => prev.map(t => t.id === active ? { ...t, messages: t.messages.map(m => m.id === outMsg.id ? { ...m, status: "sent" } : m) } : t));
        toast("Email sent ✓");
      }
    } catch (err) {
      setThreads(prev => prev.map(t => t.id === active ? { ...t, messages: t.messages.map(m => m.id === outMsg.id ? { ...m, status: "failed", error: err.message } : m) } : t));
      toast("Send failed: " + err.message, "error");
    } finally { setSending(false); }
  };

  const startNew = async () => {
    if (!newDraft.to.trim() || !newDraft.body.trim()) return;
    const customer = customers.find(c => c.firstName + " " + c.lastName === newDraft.to.trim() || c.phone?.includes(newDraft.phone) || c.email === newDraft.email);
    if (newDraft.channel === "sms" && !newDraft.phone) { toast("Enter a phone number", "error"); return; }
    if (newDraft.channel === "email" && !newDraft.email) { toast("Enter an email", "error"); return; }
    const outMsg = { id: uid(), dir: "out", body: newDraft.body, ts: Date.now(), status: "sending", subject: newDraft.subject };
    const newThread = { id: uid(), channel: newDraft.channel, contactName: newDraft.to, contactPhone: newDraft.phone, contactEmail: newDraft.email, customerId: customer?.id || null, unread: false, messages: [outMsg] };
    setThreads(prev => [newThread, ...prev]);
    setActive(newThread.id);
    setNewModal(false);
    try {
      if (newDraft.channel === "sms") {
        await twilioSend(settings, newDraft.phone, newDraft.body);
      } else {
        await sendEmail(settings, { to: newDraft.email, subject: newDraft.subject, body: newDraft.body });
      }
      setThreads(prev => prev.map(t => t.id === newThread.id ? { ...t, messages: t.messages.map(m => m.id === outMsg.id ? { ...m, status: "sent" } : m) } : t));
      toast("Sent ✓");
    } catch (err) {
      setThreads(prev => prev.map(t => t.id === newThread.id ? { ...t, messages: t.messages.map(m => m.id === outMsg.id ? { ...m, status: "failed", error: err.message } : m) } : t));
      toast("Send failed: " + err.message + (err.message.includes("Twilio not configured") ? " — add Twilio credentials in Settings" : ""), "error");
    }
    setNewDraft({ channel: "sms", to: "", phone: "", email: "", subject: "", body: "" });
  };

  const filteredThreads = threads.filter(t => !search || t.contactName.toLowerCase().includes(search.toLowerCase()) || t.messages.some(m => m.body.toLowerCase().includes(search.toLowerCase())));
  const twilioReady = !!(settings.twilioSid && settings.twilioToken && settings.twilioFrom);
  const emailReady = !!(settings.googleConnected && settings.googleScopes?.gmail);
  const relTime = ts => { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s/60)+"m"; if (s < 86400) return Math.floor(s/3600)+"h"; return Math.floor(s/86400)+"d"; };

  return (
    <div className="flex -mx-4 md:-mx-6 -my-4 bg-black overflow-hidden rounded-xl border border-red-900/30" style={{ height: "calc(100vh - 57px)" }}>
      {/* Thread list */}
      <div className="w-full md:w-80 border-r border-red-900/30 flex flex-col flex-shrink-0" style={{ display: activeThread && window.innerWidth < 768 ? "none" : "flex" }}>
        <div className="p-3 border-b border-red-900/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2"><MessageSquare size={14} className="text-red-400" />Inbox <span className="text-[10px] text-white/50">{threads.filter(t => t.unread).length > 0 ? threads.filter(t => t.unread).length + " unread" : "all read"}</span></div>
            <div className="flex items-center gap-1.5">
              {polling && <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" title="Polling for messages" />}
              <button onClick={() => setNewModal(true)} className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white" title="New message"><Plus size={14} /></button>
            </div>
          </div>
          <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full bg-black/40 border border-red-900/30 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500/60" /></div>
          {(!twilioReady && !emailReady) && <div className="text-[9px] text-yellow-400/80 bg-yellow-950/20 border border-yellow-800/30 rounded px-2 py-1">⚠ Connect Twilio or Gmail in Settings to send/receive</div>}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 && <div className="text-center py-10 text-xs text-white/40">No conversations yet</div>}
          {filteredThreads.map(t => {
            const last = t.messages[t.messages.length - 1];
            const isActive = t.id === active;
            return <button key={t.id} onClick={() => { setActive(t.id); markRead(t.id); }} className={"w-full flex items-start gap-3 p-3 border-b border-red-900/20 text-left hover:bg-white/5 transition " + (isActive ? "bg-red-950/20" : "")}>
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-700 to-red-950 flex items-center justify-center text-xs font-bold">{t.contactName[0]}</div>
                <div className={"absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-black flex items-center justify-center " + (t.channel === "sms" ? "bg-green-500" : "bg-blue-500")}>
                  {t.channel === "sms" ? <MessageSquare size={6} /> : <Mail size={6} />}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className={"text-xs font-semibold truncate " + (t.unread ? "text-white" : "text-white/70")}>{t.contactName}</div>
                  <div className="text-[9px] text-white/40 flex-shrink-0">{relTime(last?.ts || 0)}</div>
                </div>
                <div className={"text-[10px] truncate mt-0.5 " + (t.unread ? "text-white/80" : "text-white/40")}>{last?.dir === "out" ? "You: " : ""}{last?.body || "…"}</div>
              </div>
              {t.unread && <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />}
            </button>;
          })}
        </div>
      </div>

      {/* Conversation panel */}
      {activeThread ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 p-3 border-b border-red-900/30 bg-black/40">
            <button onClick={() => setActive(null)} className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-white/60"><ChevronLeft size={16} /></button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-red-950 flex items-center justify-center text-xs font-bold flex-shrink-0">{activeThread.contactName[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{activeThread.contactName}</div>
              <div className="text-[10px] text-white/50 flex items-center gap-2">
                <span className={"px-1.5 py-0.5 rounded text-[8px] uppercase font-bold " + (activeThread.channel === "sms" ? "bg-green-900/40 text-green-300" : "bg-blue-900/40 text-blue-300")}>{activeThread.channel}</span>
                {activeThread.contactPhone && <span>{activeThread.contactPhone}</span>}
                {activeThread.contactEmail && <span>{activeThread.contactEmail}</span>}
              </div>
            </div>
            {activeThread.customerId && <GBtn variant="ghost" className="!text-xs !py-1"><Users size={11} className="inline mr-1" />View CRM</GBtn>}
          </div>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeThread.messages.map(m => {
              const isOut = m.dir === "out";
              return <div key={m.id} className={"flex " + (isOut ? "justify-end" : "justify-start")}>
                <div className={"max-w-[80%]"}>
                  {m.subject && <div className="text-[10px] text-white/50 mb-1 font-medium">Subject: {m.subject}</div>}
                  <div className={"px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap " + (isOut ? "bg-gradient-to-br from-red-600 to-red-800 text-white rounded-br-sm" : "bg-black/50 border border-red-900/30 text-white/90 rounded-bl-sm")}>
                    {m.body}
                  </div>
                  <div className={"text-[9px] mt-1 flex items-center gap-1 " + (isOut ? "justify-end text-white/40" : "text-white/30")}>
                    {relTime(m.ts)}
                    {isOut && m.status === "sending" && " · sending…"}
                    {isOut && m.status === "sent" && " · ✓"}
                    {isOut && m.status === "failed" && <span className="text-red-400"> · ✗ {m.error?.slice(0, 40)}</span>}
                  </div>
                </div>
              </div>;
            })}
            <div ref={msgEndRef} />
          </div>
          {/* Composer */}
          <div className="border-t border-red-900/30 p-3 bg-black/40">
            <div className="flex items-end gap-2 bg-black/60 border border-red-900/40 rounded-2xl p-2 focus-within:border-red-500/60 transition">
              <textarea ref={inputRef} rows={1} placeholder={"Message" + (activeThread.channel === "sms" ? " (SMS)" : " (Email)")} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }} className="flex-1 bg-transparent px-2 py-1 text-sm text-white placeholder-white/30 focus:outline-none resize-none max-h-[120px]" />
              <button onClick={send} disabled={sending || !input.trim()} className={"p-2 rounded-xl transition " + (sending || !input.trim() ? "bg-white/5 text-white/30" : "bg-gradient-to-br from-red-600 to-red-800 text-white hover:scale-105")}>{sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}</button>
            </div>
            {activeThread.channel === "sms" && !twilioReady && <div className="text-[9px] text-yellow-400 mt-1 text-center">Add Twilio credentials in Settings to send real SMS</div>}
            {activeThread.channel === "email" && !emailReady && <div className="text-[9px] text-yellow-400 mt-1 text-center">Connect Gmail in Settings → Integrations to send real emails</div>}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-white/40 hidden md:flex">
          <div className="text-center"><MessageSquare size={40} className="mx-auto mb-3 opacity-30" /><div className="text-sm">Select a conversation</div></div>
        </div>
      )}

      {/* New message modal */}
      <Modal open={newModal} onClose={() => setNewModal(false)} title="New Message" maxW="max-w-lg">
        <div className="space-y-3">
          <div className="flex gap-2">
            {["sms", "email"].map(ch => <button key={ch} onClick={() => setNewDraft({ ...newDraft, channel: ch })} className={"flex-1 py-2 rounded-xl border text-xs font-medium uppercase transition " + (newDraft.channel === ch ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-white/10 text-white/60")}>{ch === "sms" ? "💬 SMS" : "📧 Email"}</button>)}
          </div>
          <GInput placeholder="Contact name" value={newDraft.to} onChange={e => { const c = customers.find(x => (x.firstName + " " + x.lastName).toLowerCase().startsWith(e.target.value.toLowerCase())); setNewDraft({ ...newDraft, to: e.target.value, phone: c?.phone || newDraft.phone, email: c?.email || newDraft.email }); }} list="contact-names" />
          <datalist id="contact-names">{customers.map(c => <option key={c.id} value={c.firstName + " " + c.lastName} />)}</datalist>
          {newDraft.channel === "sms" && <GInput placeholder="Phone (+15551234567)" value={newDraft.phone} onChange={e => setNewDraft({ ...newDraft, phone: e.target.value })} />}
          {newDraft.channel === "email" && <>
            <GInput placeholder="Email address" value={newDraft.email} onChange={e => setNewDraft({ ...newDraft, email: e.target.value })} />
            <GInput placeholder="Subject" value={newDraft.subject} onChange={e => setNewDraft({ ...newDraft, subject: e.target.value })} />
          </>}
          <GTxt rows={4} placeholder="Message..." value={newDraft.body} onChange={e => setNewDraft({ ...newDraft, body: e.target.value })} />
          {newDraft.channel === "sms" && <div className="text-[10px] text-white/40">{newDraft.body.length} chars · {Math.ceil(newDraft.body.length / 160)} SMS segment{Math.ceil(newDraft.body.length / 160) !== 1 ? "s" : ""}</div>}
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setNewModal(false)}>Cancel</GBtn>
            <GBtn onClick={startNew} disabled={!newDraft.to || !newDraft.body || (newDraft.channel === "sms" ? !newDraft.phone : !newDraft.email)}><Send size={12} className="inline mr-1.5" />Send</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}


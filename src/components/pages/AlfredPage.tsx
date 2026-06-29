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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, withTimeout } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell, emailButton } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS, parseRateLimitError } from "../../lib/api";
import { supabase } from "../../lib/supabase";
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

export function AlfredPage({ conversations, setConversations, activeConvId, setActiveConvId, memory = [], setMemory, personality, setPersonality, apiKey, openSettings, toast, jobs = [], setJobs, estimates = [], setEstimates, customers = [], setCustomers, employees = [], automations = [], setAutomations = () => {}, stats, setWins, goals = [], setGoals, setSettings, settings = {} as AppSettings, modelStatus = {}, setModelStatus = () => {}, onNav, expenses = [], entries = [], ownerId = "" }: { conversations?: any; setConversations?: any; activeConvId?: any; setActiveConvId?: any; memory?: any; setMemory?: any; personality?: any; setPersonality?: any; apiKey?: any; openSettings?: any; toast?: any; jobs?: any; setJobs?: any; estimates?: any; setEstimates?: any; customers?: any; setCustomers?: any; employees?: any; automations?: any; setAutomations?: any; stats?: any; setWins?: any; goals?: any; setGoals?: any; setSettings?: any; settings?: AppSettings; modelStatus?: any; setModelStatus?: any; onNav?: any; expenses?: any[]; entries?: any[]; ownerId?: string }) {
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState<"dictate" | "note">("dictate");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [editingTitle, setEditingTitle] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [, forceTick] = useState(0);
  // Tick every second when any model is locked out so UI countdowns stay fresh
  useEffect(() => {
    if (!modelStatus || Object.values(modelStatus).every((s: any) => !s?.lockedUntil || s.lockedUntil < Date.now())) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [modelStatus]);

  // Proactive morning briefing — fires once per day at app open between 6-11am
  useEffect(() => {
    const key = "smocks.alfredBriefingDate";
    const lastDate = localStorage.getItem(key);
    const todayStr = today();
    const hour = new Date().getHours();
    if (lastDate === todayStr) return;
    if (hour < 6 || hour > 11) return;
    localStorage.setItem(key, todayStr);
    const t = setTimeout(() => {
      const todayJobs = jobs.filter(j => j.scheduledDate === todayStr && j.status === "scheduled");
      const overdueInv = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14);
      const pendingEst = estimates.filter(e => e.status === "pending");
      const stale = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7);
      const revMonth = jobs.filter(j => j.status === "completed" && j.scheduledDate?.slice(0, 7) === todayStr.slice(0, 7)).reduce((s, j) => s + j.amount, 0);
      const goalRev = settings?.monthlyRevenueGoal || 0;
      const pct = goalRev > 0 ? Math.round(revMonth / goalRev * 100) : null;
      const lines = [
        "🌅 MORNING BRIEFING — " + new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
        "",
        "📅 TODAY: " + (todayJobs.length > 0
          ? todayJobs.length + " job" + (todayJobs.length !== 1 ? "s" : "") + " scheduled\n" + todayJobs.slice(0, 4).map(j => { const c = customers.find(x => x.id === j.customerId); return "  • " + (c ? c.firstName + " " + c.lastName : "?") + " — " + (j.address || "").split(",")[0] + (j.amount ? " · " + fmt(j.amount) : ""); }).join("\n")
          : "Nothing scheduled. Book something."),
        "",
        pct !== null ? "📈 MONTH: " + fmt(revMonth) + " / " + fmt(goalRev) + " goal (" + pct + "%) " + (pct >= 80 ? "🔥 Almost there!" : pct >= 50 ? "📊 On track" : "⚠️ Behind pace") : "📈 MONTH: " + fmt(revMonth) + " collected",
        pendingEst.length > 0 ? "📋 " + pendingEst.length + " pending quote" + (pendingEst.length !== 1 ? "s" : "") + (stale.length > 0 ? " (" + stale.length + " stale — follow up)" : "") : "📋 No pending quotes",
        overdueInv.length > 0 ? "💸 " + overdueInv.length + " overdue invoice" + (overdueInv.length !== 1 ? "s" : "") + " — collect ASAP" : "✅ No overdue invoices",
        "",
        "Type /route to optimize today · /status for quick stats · Alfred out."
      ];
      const briefing = lines.join("\n");
      const newConv = { id: uid(), title: "Morning Briefing — " + todayStr, personality: "drill", messages: [{ id: uid(), role: "alfred", content: briefing, timestamp: Date.now() }], createdAt: Date.now(), updatedAt: Date.now() };
      setConversations(prev => [newConv, ...prev]);
      setActiveConvId(newConv.id);
    }, 2000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // Proactive afternoon check-in — fires at 2pm if no jobs completed today
  useEffect(() => {
    const key = "smocks.alfredAfternoonDate";
    const lastDate = localStorage.getItem(key);
    const todayStr = today();
    const hour = new Date().getHours();
    if (lastDate === todayStr) return;
    if (hour < 14 || hour > 16) return;
    const completedToday = jobs.filter(j => j.scheduledDate === todayStr && j.status === "completed");
    const scheduledToday = jobs.filter(j => j.scheduledDate === todayStr && j.status === "scheduled");
    if (completedToday.length > 0 || scheduledToday.length === 0) return; // no nudge needed
    localStorage.setItem(key, todayStr);
    setTimeout(() => {
      const msg = "⏰ AFTERNOON CHECK-IN\n\nYou have " + scheduledToday.length + " job" + (scheduledToday.length !== 1 ? "s" : "") + " scheduled today but none completed yet.\n\n" + scheduledToday.map(j => { const c = customers.find(x => x.id === j.customerId); return "• " + (c ? c.firstName : "?") + " — " + (j.address || "").split(",")[0]; }).join("\n") + "\n\nEverything ok? Update job status or text /status. Alfred watching.";
      const newConv = { id: uid(), title: "Afternoon Check-in", personality: "drill", messages: [{ id: uid(), role: "alfred", content: msg, timestamp: Date.now() }], createdAt: Date.now(), updatedAt: Date.now() };
      setConversations(prev => [newConv, ...prev]);
    }, 1000);
  }, []); // eslint-disable-line
  const [showSlash, setShowSlash] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCat, setNewMemoryCat] = useState("general");
  const [memFilter, setMemFilter] = useState("all");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const active = conversations.find(c => c.id === activeConvId) || conversations[0];
  const chats = active?.messages || [];

  // Auto-initialize: if no conversations exist, create one so appendMessage always has a target
  useEffect(() => {
    if (!conversations || conversations.length === 0) {
      const cid = uid();
      const greeting = (personalities as any)[personality]?.greeting || "Hey. What do we need to handle today? Alfred out.";
      const newConv = { id: cid, title: "New chat", personality, createdAt: today(), updatedAt: Date.now(), messages: [{ id: uid(), role: "alfred", content: greeting, timestamp: Date.now() }] };
      setConversations([newConv]);
      setActiveConvId(cid);
    }
  }, []); // eslint-disable-line

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [chats.length, loading]);

  // Slash command suggestions
  const slashCmds = [
    { cmd: "/rollcall", desc: "Morning briefing" },
    { cmd: "/debrief", desc: "End of day" },
    { cmd: "/status", desc: "Quick stats" },
    { cmd: "/route", desc: "Today's route" },
    { cmd: "/followup", desc: "Stale quotes" },
    { cmd: "/top", desc: "Top customers" },
    { cmd: "/daily", desc: "Today's debrief + MTD stats" },
    { cmd: "/weather", desc: "Forecast check" },
    { cmd: "/quote", desc: "Mock estimate" },
    { cmd: "/motivate", desc: "Drill quote" },
    { cmd: "/savagemode", desc: "Roast metrics" },
    { cmd: "/accountability", desc: "Check-in prompt" },
    { cmd: "/proud [win]", desc: "Log a win" },
    { cmd: "/compete", desc: "Month over month" },
    { cmd: "/goal [text/number]", desc: "Set goal/revenue" },
    { cmd: "/weekly", desc: "7-day business summary" },
    { cmd: "/monthly", desc: "30-day monthly review" },
    { cmd: "/post [desc]", desc: "Generate 3 social captions" },
    { cmd: "/review send [name]", desc: "Queue review request" },
    { cmd: "/reschedule [job]", desc: "Text customer to reschedule" },
    { cmd: "/reflect", desc: "Open weekly reflection" },
    { cmd: "/override", desc: "Weather override for today" },
    { cmd: "/automations", desc: "List workflows" },
    { cmd: "/help", desc: "All commands" }
  ];
  const slashFiltered = showSlash ? slashCmds.filter(s => s.cmd.toLowerCase().startsWith(input.trim().toLowerCase())) : [];

  // Suggested prompts for empty chat
  const suggestions = [
    { icon: Activity, title: "Morning briefing", prompt: "/rollcall" },
    { icon: Target, title: "Who should I call?", prompt: "/followup" },
    { icon: Workflow, title: "Build an automation", prompt: "Build me a workflow: when a job is marked complete, wait 2 hours, then send the customer a review request by SMS, then 3 days later if they haven't rated us, send a follow-up email with a 10% off coupon." },
    { icon: BarChart2, title: "Weekly summary", prompt: "/weekly" },
    { icon: Zap, title: "Show my workflows", prompt: "/automations" },
    { icon: Route, title: "Optimize my route", prompt: "/route" },
  ];

  const activeId = active?.id ?? activeConvId;
  const updateActive = patch => setConversations(prev => prev.map(c => c.id === activeId ? { ...c, ...patch, updatedAt: Date.now() } : c));
  const appendMessage = msg => setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() } : c));
  const replaceMessages = msgs => setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: msgs, updatedAt: Date.now() } : c));

  const newConversation = () => {
    const cid = uid();
    const newConv = {
      id: cid,
      title: "New chat",
      personality,
      createdAt: today(),
      updatedAt: Date.now(),
      messages: [{ id: uid(), role: "alfred", content: (personalities as any)[personality]?.greeting || "Hello! How can I help?", timestamp: Date.now() }]
    };
    setConversations([newConv, ...conversations]);
    setActiveConvId(cid);
    setSidebarOpen(false);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteConversation = cid => {
    const remaining = conversations.filter(c => c.id !== cid);
    setConversations(remaining);
    if (cid === activeConvId) setActiveConvId(remaining[0]?.id || null);
    if (remaining.length === 0) {
      // auto-create fresh
      setTimeout(newConversation, 0);
    }
    setConfirmDelete(null);
    toast("Conversation deleted");
  };

  const deleteAllConversations = () => {
    setConversations([]);
    setActiveConvId(null);
    setTimeout(newConversation, 0);
    toast("All conversations cleared");
  };

  const startRename = c => { setEditingTitle(c.id); setTitleDraft(c.title); };
  const commitRename = () => {
    if (editingTitle && titleDraft.trim()) {
      setConversations(conversations.map(c => c.id === editingTitle ? { ...c, title: titleDraft.trim() } : c));
    }
    setEditingTitle(null);
  };

  const clearChat = () => {
    if (!active) return;
    replaceMessages([{ id: uid(), role: "alfred", content: (personalities as any)[active.personality || personality]?.greeting || "Hello! How can I help?", timestamp: Date.now() }]);
    setMenuOpen(false);
    toast("Chat cleared");
  };

  const addMemory = () => {
    if (!newMemoryText.trim()) return;
    setMemory([...memory, { id: uid(), text: newMemoryText.trim(), category: newMemoryCat, createdAt: today() }]);
    setNewMemoryText("");
  };
  const removeMemory = id => setMemory(memory.filter(m => m.id !== id));
  const clearMemory = () => { if (confirm("Wipe all Alfred memory?")) { setMemory([]); toast("Memory cleared"); } };

  const runSlash = async text => {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const args = rest.join(" ");
    const t = today();

    switch (cmd.toLowerCase()) {
      case "/rollcall": {
        const todayJobs = jobs.filter(j => j.scheduledDate === t);
        const urgent = jobs.filter(j => j.priority === "urgent" && j.status !== "completed" && j.status !== "cancelled");
        const msg = "☀️ MORNING BRIEFING\n\n" + t + "\nActive jobs: " + stats.activeJobs + "\nToday: " + todayJobs.length + " scheduled\nPending quotes: " + stats.pendingEst + "\nRevenue MTD: " + fmt(stats.totalRev) + (urgent.length ? "\n\n🚨 " + urgent.length + " URGENT job(s)" : "") + "\n\nMOVE. Alfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/debrief": {
        const todayCompleted = jobs.filter(j => j.scheduledDate === t && j.status === "completed");
        const todayRev = todayCompleted.reduce((s, j) => s + j.amount, 0);
        const cashToday = todayCompleted.filter(j => j.isCash).reduce((s, j) => s + j.amount, 0);
        const todayPending = estimates.filter(e => e.status === "pending" && e.createdAt === t);
        const stale = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7);
        const overdue = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14);
        const msg = "🌙 END OF DAY DEBRIEF — " + t + "\n\n" +
          "💰 Today's Revenue: " + fmt(todayRev) + (cashToday > 0 ? " (" + fmt(cashToday) + " cash)" : "") + "\n" +
          "🔨 Jobs Completed: " + todayCompleted.length + "\n" +
          (todayPending.length > 0 ? "📋 New Quotes Today: " + todayPending.length + "\n" : "") +
          (stale.length > 0 ? "⚠️ Stale Quotes: " + stale.length + " over 7 days — follow up tomorrow\n" : "") +
          (overdue.length > 0 ? "💸 Overdue Invoices: " + overdue.length + " — collect ASAP\n" : "") +
          "\n" + (todayRev >= 1000 ? "💪 Solid day. Rest up." : todayRev > 0 ? "Not bad. Push harder tomorrow." : "No revenue today — what happened? Fix it tomorrow.") +
          "\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/status": {
        const msg = "📊 STATUS\n\nRevenue: " + fmt(stats.totalRev) + "\nActive: " + stats.activeJobs + " jobs\nQuotes: " + stats.pendingEst + " pending\nClose rate: " + stats.closeRate + "%\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/quote": {
        if (!args) return "USAGE: /quote [customer name] [service] [amount]\n\nExample: /quote Jennifer Walsh house soft wash 450\nExample: /quote Sarah Miller driveway 250\n\nAlfred will create the estimate and open it. Alfred out.";
        const parts = args.match(/^(.+?)\s+(.+?)\s+(\d+(?:\.\d+)?)$/);
        if (!parts) {
          // Try to find customer and give pricing suggestions
          const matchQ = customers.find(c => args.toLowerCase().includes(c.firstName.toLowerCase()) || args.toLowerCase().includes(c.lastName.toLowerCase()));
          const sqft = matchQ?.sqFootage ? Number(matchQ.sqFootage) : 2000;
          return "📋 QUOTE BUILDER\n\n" + (matchQ ? "Customer: " + matchQ.firstName + " " + matchQ.lastName + "\nAddress: " + (matchQ.address || "not on file") + "\nSq Ft: " + sqft.toLocaleString() + "\n\n" : "") + "Suggested pricing:\n• House Soft Wash — $" + Math.max(299, Math.round(sqft * 0.15 / 5) * 5) + "\n• Driveway — $" + Math.max(149, Math.round(sqft * 0.08 / 5) * 5) + "\n• Roof Soft Wash — $" + Math.max(399, Math.round(sqft * 0.22 / 5) * 5) + "\n\nFull syntax: /quote [name] [service] [amount]\nAlfred out.";
        }
        const [, customerName, service, amountStr] = parts;
        const amount = parseFloat(amountStr);
        const cMatch = customers.find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(customerName.toLowerCase()));
        if (!cMatch) return "❌ Customer \"" + customerName + "\" not found. Add them to Customers first, or create with: /quote and then create estimate manually. Alfred out.";
        const tax = amount * ((Number(settings.taxRate) || 6) / 100);
        const newEst = { id: uid(), customerId: cMatch.id, lineItems: [{ id: uid(), description: service, quantity: 1, unitPrice: amount }], subtotal: amount, discount: 0, depositRequired: 0, tax, total: amount + tax, status: "pending", createdAt: today(), validUntil: daysFromNow(30), viewed: false, notes: "Created by Alfred", terms: settings.terms || "Payment due upon completion." };
        setEstimates(prev => [...prev, newEst]);
        toast("Alfred created estimate for " + cMatch.firstName + " — " + fmt(amount + tax));
        onNav("estimates");
        return "✅ ESTIMATE CREATED\n\nCustomer: " + cMatch.firstName + " " + cMatch.lastName + "\nService: " + service + "\nAmount: " + fmt(amount) + " + tax = " + fmt(amount + tax) + "\n\nOpening Estimates now. Send it from there. Alfred out.";
      }
      case "/nearby": {
        if (!args) return "USAGE: /nearby [what]\n\nExamples:\n• /nearby gas station\n• /nearby hardware store\n• /nearby customer [name] — find best slot near their address\n\nAlfred opens Google Maps search near your location. Alfred out.";

        // Check if asking about scheduling near a customer
        const lowerArgs = args.toLowerCase();
        const isScheduleRequest = lowerArgs.startsWith("customer") || lowerArgs.startsWith("estimate") || lowerArgs.includes("schedule") || lowerArgs.includes("slot");
        if (isScheduleRequest) {
          const searchTerm = args.replace(/customer|estimate|schedule|slot|for|near/gi, "").trim();
          const matchedCust = customers.find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(searchTerm.toLowerCase()) || (c.address || "").toLowerCase().includes(searchTerm.toLowerCase()));
          if (matchedCust) {
            // Find jobs near this customer's area (same city/zip)
            const area = (matchedCust.address || "").split(",")[1]?.trim() || "York";
            const nearbyJobs = jobs.filter(j => j.status === "scheduled" && (j.address || "").includes(area));
            const slots = [];
            for (let i = 1; i <= 14 && slots.length < 3; i++) {
              const d = new Date(); d.setDate(d.getDate() + i);
              if (d.getDay() === 0 || d.getDay() === 6) continue;
              const ds = d.toISOString().slice(0,10);
              const dayJobs = nearbyJobs.filter(j => j.scheduledDate === ds);
              const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              slots.push({ date: ds, day: dayLabel, nearbyJobs: dayJobs.length });
            }
            const slotText = slots.map((s,i) => (i+1) + ". " + s.day + (s.nearbyJobs > 0 ? " ✅ " + s.nearbyJobs + " nearby job" + (s.nearbyJobs !== 1 ? "s" : "") + " already in the area" : " (no nearby jobs yet)")).join("\n");
            return "📍 SMART SCHEDULE\n\nCustomer: " + matchedCust.firstName + " " + matchedCust.lastName + "\nAddress: " + (matchedCust.address || "not on file") + "\nArea: " + area + "\n\nBest slots (grouped by nearby jobs to reduce drive time):\n" + slotText + "\n\nTip: pick a day you're already in " + area + " to batch your route. Alfred out.";
          }
          return "❌ No customer found matching \"" + searchTerm + "\". Alfred out.";
        }

        // Regular nearby search
        const openMaps = (lat = 39.9626, lng = -76.7277) => {
          const mapsUrl = "https://www.google.com/maps/search/" + encodeURIComponent(args) + "/@" + lat + "," + lng + ",13z";
          window.open(mapsUrl, "_blank");
          return "📍 NEARBY: " + args.toUpperCase() + "\n\nOpened Google Maps" + (lat !== 39.9626 ? " at your current location" : " near York, PA") + ".\n\nTop results will show in the Maps app. Alfred out.";
        };
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            pos => { openMaps(pos.coords.latitude, pos.coords.longitude); },
            () => { openMaps(); }
          );
          return "📍 NEARBY: " + args + "\n\nGetting your location... Maps opening now. Alfred out.";
        }
        return openMaps();
      }
      case "/route": {
        const today_scheduled = jobs.filter(j => j.scheduledDate === t && j.status === "scheduled");
        if (today_scheduled.length === 0) return "🗺️ ROUTE\n\nNothing on the books for today. Alfred out.";

        // Build Google Maps multi-stop URL
        const addresses = today_scheduled.map(j => encodeURIComponent(j.address || "York PA")).join("/");
        const mapsUrl = "https://www.google.com/maps/dir/" + addresses;
        window.open(mapsUrl, "_blank");

        // If Google Maps key available, use Distance Matrix API for optimized order
        if (settings.googleMapsKey && today_scheduled.length > 2) {
          try {
            const origins = today_scheduled.map(j => encodeURIComponent(j.address || "York PA")).join("|");
            const destinations = today_scheduled.map(j => encodeURIComponent(j.address || "York PA")).join("|");
            const dmUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&key=${settings.googleMapsKey}`;
            // Note: real Distance Matrix needs a backend proxy due to CORS
            // For now open optimized Maps URL and show the stops
          } catch { /* silent */ }
        }

        const stopList = today_scheduled.map((j, i) => {
          const c = customers.find(x => x.id === j.customerId);
          return (i + 1) + ". " + (c ? c.firstName + " " + c.lastName : "?") + "\n   📍 " + (j.address || "?").split(",")[0] + "\n   💰 " + fmt(j.amount);
        }).join("\n\n");

        return "🗺️ ROUTE — " + today_scheduled.length + " stops\n\n" + stopList + "\n\n✅ Opened in Google Maps. Alfred out.";
      }
      case "/schedule": {
        if (!args) return "USAGE: /schedule [customer name or address]\n\nExample: /schedule Jennifer Walsh\nExample: /schedule 412 Oak Ridge Ln\n\nAlfred finds open slots and texts the customer options. Alfred out.";

        // Try to find customer by name or address
        const searchLower = args.toLowerCase();
        const matchedCustomer = customers.find(c =>
          (c.firstName + " " + c.lastName).toLowerCase().includes(searchLower) ||
          (c.address || "").toLowerCase().includes(searchLower)
        );

        // Find open slots
        const slots = [];
        for (let i = 1; i <= 21 && slots.length < 3; i++) {
          const d = new Date(); d.setDate(d.getDate() + i);
          if (d.getDay() === 0 || d.getDay() === 6) continue;
          const ds = d.toISOString().slice(0, 10);
          const dayJobs = jobs.filter(j => j.scheduledDate === ds && j.status === "scheduled");
          if (dayJobs.length < 4) slots.push({ date: ds, existing: dayJobs.length, day: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) });
        }

        const slotsText = slots.map((s, i) => (i + 1) + ". " + s.day + (s.existing > 0 ? " (" + s.existing + " jobs that day)" : " (open day ✅)")).join("\n");

        if (matchedCustomer?.phone) {
          const offerMsg = "Hi " + matchedCustomer.firstName + "! This is Will from Smock's. I have a few openings coming up — which works for you?\n\n" + slotsText + "\n\nReply 1, 2, or 3 to confirm. Thanks!";
          if (settings?.twilioSid) {
            try {
              await twilioSend(settings, matchedCustomer.phone, offerMsg);
              return "📅 Scheduling: " + matchedCustomer.firstName + " " + matchedCustomer.lastName + "\n\nSent slot options to " + matchedCustomer.phone + ":\n\n" + slotsText + "\n\nWaiting for their reply. When they pick, use /schedule confirm [date] to book. Alfred out.";
            } catch (e) {
              return "Found customer but SMS failed: " + e.message + "\n\nSlot options:\n" + slotsText + "\n\nManually text: " + matchedCustomer.phone;
            }
          } else {
            window.location.href = "sms:" + matchedCustomer.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent("Hi " + matchedCustomer.firstName + "! Openings:\n" + slotsText + "\nReply 1/2/3 — Smock's");
            return "📅 Scheduling for " + matchedCustomer.firstName + "\n\nOpened SMS with slot options. Connect Twilio in Settings for automatic sending. Alfred out.";
          }
        }

        return "📅 SCHEDULING" + (args ? ": " + args : "") + "\n\n" + (matchedCustomer ? "Found: " + matchedCustomer.firstName + " " + matchedCustomer.lastName + " (no phone on file)\n\n" : "No customer match — creating new estimate?\n\n") + "Best available slots:\n\n" + slotsText + "\n\nReply '/schedule confirm [date]' to book. Alfred out.";
      }
      case "/motivate":
        const quotes = ["Pain is weakness leaving the pressure washer. Alfred out.", "Excuses don't clean siding. Alfred out.", "You fall to your systems. Build better ones. Alfred out."];
        return quotes[Math.floor(Math.random() * quotes.length)];
      case "/savagemode":
        const stale = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) > 7).length;
        return "🔥 SAVAGE MODE\n\n" + stats.pendingEst + " quotes rotting.\n" + stale + " quotes over 7 days old.\nClose rate: " + stats.closeRate + "%. Do better.\n\nAlfred out.";
      case "/accountability":
        return "💪 ACCOUNTABILITY\n\nOpen the Accountability tab.\nLog sleep, water, gym, steps, mood.\n\nNo excuses. Alfred out.";
      case "/proud":
        if (!args) return "USAGE: /proud [your win]. Alfred out.";
        setWins(prev => [{ id: uid(), text: args, date: t }, ...prev]);
        return "🏆 WIN LOGGED: \"" + args + "\"\n\nAdded to your Accountability board. Alfred out.";
      case "/compete":
        const lastMonthRev = Math.round(stats.totalRev * 0.82);
        const growth = stats.totalRev > 0 ? Math.round(((stats.totalRev - lastMonthRev) / lastMonthRev) * 100) : 0;
        return "📊 COMPETITION\n\nThis month: " + fmt(stats.totalRev) + "\nLast month (est): " + fmt(lastMonthRev) + "\nGrowth: " + (growth >= 0 ? "+" : "") + growth + "%\n\n" + (growth > 0 ? "Keep pushing." : "Step it up.") + " Alfred out.";
      case "/daily": {
        const todayJobs = jobs.filter(j => j.scheduledDate === t);
        const doneToday = todayJobs.filter(j => j.status === "completed");
        const pendingToday = todayJobs.filter(j => j.status === "scheduled" || j.status === "in_progress");
        const todayRev = doneToday.reduce((s, j) => s + j.amount, 0);
        const todayTips = doneToday.reduce((s, j) => s + (Number(j.tip) || 0), 0);
        const pendingEst = estimates.filter(e => e.status === "pending");
        const overdueInv = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 7);
        const expToday = expenses.filter(e => e.date === t);
        const expTodayAmt = expToday.reduce((s, e) => s + Number(e.amount), 0);
        const monthStart = t.slice(0, 7);
        const mtdRev = jobs.filter(j => j.status === "completed" && j.scheduledDate?.startsWith(monthStart)).reduce((s, j) => s + j.amount, 0);
        const mtdGoal = settings.monthlyRevenueGoal || 0;
        const paceMsg = mtdGoal > 0
          ? (mtdRev >= mtdGoal ? "🔥 Monthly goal HIT." : "📈 " + fmt(mtdGoal - mtdRev) + " left to hit monthly goal.")
          : "";
        const msg = "📅 DAILY DEBRIEF — " + t + "\n\n" +
          "✅ Done: " + doneToday.length + " job" + (doneToday.length !== 1 ? "s" : "") + " · " + fmt(todayRev) + (todayTips > 0 ? " + " + fmt(todayTips) + " tips" : "") + "\n" +
          (pendingToday.length > 0 ? "🔨 Remaining: " + pendingToday.length + " job" + (pendingToday.length !== 1 ? "s" : "") + " today\n" : "") +
          (expTodayAmt > 0 ? "💸 Expenses today: " + fmt(expTodayAmt) + "\n" : "") +
          "📋 Pending quotes: " + pendingEst.length + "\n" +
          (overdueInv.length > 0 ? "⚠️ Overdue invoices: " + overdueInv.length + " (" + fmt(overdueInv.reduce((s, e) => s + e.total, 0)) + ")\n" : "") +
          "\n📊 MTD: " + fmt(mtdRev) + (mtdGoal > 0 ? " / " + fmt(mtdGoal) : "") + "\n" +
          paceMsg + "\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }

      case "/weekly": {
        const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
        const wkStr = weekStart.toISOString().slice(0,10);
        const wkJobs = jobs.filter(j => j.status === "completed" && j.scheduledDate >= wkStr);
        const wkRev = wkJobs.reduce((s, j) => s + j.amount, 0);
        const wkTips = wkJobs.reduce((s, j) => s + (Number(j.tip) || 0), 0);
        const wkCash = wkJobs.filter(j => j.isCash).reduce((s, j) => s + j.amount, 0);
        const wkAvg = wkJobs.length ? wkRev / wkJobs.length : 0;
        const wkPending = estimates.filter(e => e.status === "pending");
        const wkNewCust = customers.filter(c => c.createdAt >= wkStr).length;
        const profitTip = wkRev < 2000 ? "💡 TIP: Follow up on " + wkPending.length + " pending quotes. One close = another $" + Math.round(wkAvg) + "." :
          wkAvg < 400 ? "💡 TIP: Avg job value is low. Bundle services — add gutter cleaning to driveway jobs." :
          "💡 TIP: Strong week. Ask every customer for a referral.";
        const msg = "📊 WEEKLY REPORT — Last 7 Days\n\n" +
          "💰 Revenue: " + fmt(wkRev) + "\n" +
          "💵 Cash: " + fmt(wkCash) + " · Tips: " + fmt(wkTips) + "\n" +
          "🔨 Jobs: " + wkJobs.length + " · Avg: " + fmt(wkAvg) + "\n" +
          "📋 Pending quotes: " + wkPending.length + " ($" + Math.round(wkPending.reduce((s,e) => s+e.total, 0)) + " pipeline)\n" +
          "👥 New customers: " + wkNewCust + "\n\n" +
          profitTip + "\n\n" +
          (wkRev >= 3000 ? "🔥 Strong week. Keep pushing." : wkRev >= 1500 ? "👍 Decent week. More quotes = more cash." : "⚡ Light week. Get those estimates out NOW.") +
          "\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/monthly": {
        const monthStart = new Date(); monthStart.setDate(monthStart.getDate() - 30);
        const moStr = monthStart.toISOString().slice(0,10);
        const moJobs = jobs.filter(j => j.status === "completed" && j.scheduledDate >= moStr);
        const moRev = moJobs.reduce((s, j) => s + j.amount, 0);
        const moTips = moJobs.reduce((s, j) => s + (Number(j.tip) || 0), 0);
        const moCash = moJobs.filter(j => j.isCash).reduce((s, j) => s + j.amount, 0);
        const moChemCost = moJobs.reduce((s, j) => s + (j.chemicalsUsed || []).reduce((cs, ch) => cs + Number(ch.cost || 0), 0), 0);
        const moApproved = estimates.filter(e => e.status === "approved" && e.createdAt >= moStr);
        const moSent = estimates.filter(e => e.createdAt >= moStr);
        const moCR = moSent.length ? Math.round(moApproved.length / moSent.length * 100) : 0;
        const moGoal = settings.monthlyRevenueGoal || 0;
        const moOverdue = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14).reduce((s, e) => s + e.total, 0);
        const profit = moRev - moChemCost;
        const margin = moRev > 0 ? Math.round(profit / moRev * 100) : 0;

        // Spending advice
        const spendTips = [];
        if (moChemCost / moRev > 0.15) spendTips.push("Chemical costs are high (" + Math.round(moChemCost/moRev*100) + "%). Bulk order SH to cut costs.");
        if (moCR < 50) spendTips.push("Close rate " + moCR + "% is weak. Follow up on quotes within 2h of sending.");
        if (moOverdue > 500) spendTips.push("$" + Math.round(moOverdue) + " overdue A/R — text those customers TODAY.");
        if (moTips < moRev * 0.05) spendTips.push("Tip rate is low. Add a tip option to your client portal.");
        if (spendTips.length === 0) spendTips.push("Numbers look solid. Focus on referrals to grow without extra ad spend.");

        const msg = "📅 MONTHLY REVIEW — Last 30 Days\n\n" +
          "💰 Revenue: " + fmt(moRev) + (moGoal > 0 ? " / " + fmt(moGoal) + " (" + Math.round(moRev/moGoal*100) + "%)" : "") + "\n" +
          "💵 Cash: " + fmt(moCash) + " · Tips: " + fmt(moTips) + "\n" +
          "🔨 Jobs: " + moJobs.length + " · Avg: " + fmt(moJobs.length ? moRev/moJobs.length : 0) + "\n" +
          "🧪 Chemical cost: " + fmt(moChemCost) + " · Margin: " + margin + "%\n" +
          "📋 Close rate: " + moCR + "% · Profit: " + fmt(profit) + "\n" +
          (moOverdue > 0 ? "⚠️ Overdue A/R: " + fmt(moOverdue) + "\n" : "") +
          "\n💡 Plans to improve profit:\n" + spendTips.map((t, i) => (i+1) + ". " + t).join("\n") +
          "\n\n" + (moRev >= (moGoal || 10000) ? "🔥 Goal hit. Raise it." : "⚡ " + fmt(Math.max(0, (moGoal || 10000) - moRev)) + " short. Close faster.") +
          "\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/goal":
        if (!args) return "USAGE: /goal [text or number]. Alfred out.";
        const num = Number(args.replace(/[^0-9]/g, ""));
        if (num > 0) {
          setSettings({ ...settings, monthlyRevenueGoal: num });
          return "🎯 REVENUE GOAL SET: " + fmt(num) + "\n\nDashboard updated. Alfred out.";
        }
        setGoals([...goals, { id: uid(), text: args, createdAt: t, done: false }]);
        return "🎯 GOAL LOGGED: \"" + args + "\"\n\nAdded to Accountability. Alfred out.";
      case "/post":
        if (!args) return "USAGE: /post [describe the job or 'before after']\n\nExample: /post before after driveway soft wash York PA\n\nAlfred will generate 3 caption options. Alfred out.";
        return "📸 SOCIAL CAPTION OPTIONS for: \"" + args + "\"\n\n" +
          "Option 1 (Professional):\nTransformation complete 💦 Before → After soft wash in York, PA. Years of algae and grime removed safely with low-pressure cleaning. DM for a free estimate! #pressurewashing #softwash #yorkpa\n\n" +
          "Option 2 (Casual/CTA):\nCan you spot the difference? 👀 This York homeowner couldn't believe the results. Your driveway/siding could look like this too. Call (717) 555-0100 for a free quote. #beforeandafter #curb appeal\n\n" +
          "Option 3 (Funny):\nThe pressure washer said 'hold my SH mix' 😂 Another satisfied customer in York, PA. 10/10 would wash again. #smockspressurewashing #yorkpa #satisfying\n\nAlfred out.";
      case "/review": {
        if (!args || !args.includes("send")) return "USAGE: /review send [customer name]\nExample: /review send Jennifer Walsh\n\nAlfred out.";
        const name = args.replace("send ", "").trim();
        const rc = customers.find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(name.toLowerCase()));
        if (!rc) return "Customer \"" + name + "\" not found. Check spelling. Alfred out.";
        const lastJob = jobs.filter(j => j.customerId === rc.id && j.status === "completed").slice(-1)[0];
        if (!lastJob) return rc.firstName + " has no completed jobs. Can't send review request yet. Alfred out.";
        return "📨 REVIEW REQUEST QUEUED\n\nCustomer: " + rc.firstName + " " + rc.lastName + "\nPhone: " + (rc.phone || "none on file") + "\nLast job: " + (lastJob.scheduledDate || "unknown") + "\n\nText will go: \"Hi " + rc.firstName + ", thanks for choosing Smock's! Got 30 seconds? Leave us a review: [link]. We appreciate it!\"\n\nGo to Reviews page to send. Alfred out.";
      }
      case "/reflect": {
        const last7 = entries.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0, 7);
        if (last7.length === 0) return "✨ REFLECT\n\nNo check-ins logged yet. Start logging daily in Accountability and I'll give you a real coaching reflection. Alfred out.";
        const avgSleep = (last7.reduce((s,e) => s + Number(e.sleep||0), 0) / last7.length).toFixed(1);
        const avgWater = Math.round(last7.reduce((s,e) => s + Number(e.water||0), 0) / last7.length);
        const avgSteps = Math.round(last7.reduce((s,e) => s + Number(e.steps||0), 0) / last7.length);
        const gymDays = last7.filter(e => (e.gymMinutes||0) > 0).length;
        const avgMood = (last7.reduce((s,e) => s + Number(e.mood||3), 0) / last7.length).toFixed(1);
        const weekRev = jobs.filter(j => j.status === "completed" && daysSince(j.scheduledDate) <= 7).reduce((s,j) => s+j.amount, 0);
        const prompt = `You are Alfred, Will Smock's no-BS AI business and accountability coach. Will runs Smock's Pressure Washing in York PA. Here's his last 7 days:\n\nBusiness: ${weekRev > 0 ? '$' + weekRev.toFixed(0) + ' revenue' : 'no completed jobs'} this week\nHealth: ${avgSleep}h sleep avg, ${avgWater}oz water avg, ${Math.round(avgSteps/1000*10)/10}k steps avg, ${gymDays}/7 gym days\nMood: ${avgMood}/5 avg\n\nWrite a SHORT (150 words max), honest, direct weekly reflection. Alfred's personality: like a drill sergeant crossed with a mentor — no fluff, real talk. Point out what's good, what needs work. End with one specific action for next week.`;
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 300, messages: [{ role: "user", content: prompt }] })
          });
          const d = await res.json();
          const text = d.content?.[0]?.text;
          if (text) return "✨ WEEKLY REFLECT\n\n" + text + "\n\nAlfred out.";
        } catch {}
        // Fallback if API fails
        return `✨ WEEKLY REFLECT\n\nSleep: ${avgSleep}h avg · Water: ${avgWater}oz · Steps: ${avgSteps.toLocaleString()} · Gym: ${gymDays}/7 days · Mood: ${avgMood}/5\nRevenue: ${fmt(weekRev)}\n\n${gymDays < 3 ? "Gym attendance is weak — fix that." : "Good gym consistency."} ${Number(avgSleep) < 7 ? "You're undersleeping. That's affecting everything." : "Sleep is solid."} ${weekRev < 1000 ? "Revenue needs attention — close something this week." : "Good week on the revenue side."}\n\nAlfred out.`;
      }
      case "/reschedule": {
        if (!args) return "USAGE: /reschedule [customer name or address]\n\nAlfred texts the customer asking to reschedule. If they decline or don't respond, Alfred texts you back. Alfred out.";
        // Match by name or address
        const searchR = args.toLowerCase();
        const rcust = customers.find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(searchR));
        const rjob = rcust
          ? jobs.find(j => j.status === "scheduled" && j.customerId === rcust.id)
          : jobs.find(j => j.status === "scheduled" && (j.address || "").toLowerCase().includes(searchR));
        const rc = rjob ? (rcust || customers.find(c => c.id === rjob.customerId)) : rcust;
        if (!rjob || !rc) return "No scheduled job found matching \"" + args + "\". Check the name or address. Alfred out.";
        const clientMsg = "Hi " + rc.firstName + "! This is Will from Smock's Pressure Washing. Unfortunately we need to reschedule your " + (rjob.scheduledDate || "upcoming") + " appointment. What day works best for you? Just reply with a date and we'll confirm. Sorry for any inconvenience!";
        const willFollowUp = settings.twilioSid && settings.myPhone
          ? "\n\nI'll text you at " + settings.myPhone + " if they don't confirm within 24h or if they say a day doesn't work."
          : "\n\nConnect Twilio and set your mobile # in Settings → Company for automatic follow-up.";
        if (settings.twilioSid && rc.phone) {
          try {
            await twilioSend(settings, rc.phone, clientMsg);
            // Schedule a follow-up note (conceptual - in production would set a delayed webhook)
            const followUpMsg = "⚠️ RESCHEDULE PENDING: " + rc.firstName + " " + rc.lastName + " was texted about rescheduling their " + (rjob.scheduledDate || "") + " job. Follow up if no response in 24h. Address: " + rjob.address;
            if (settings.myPhone) setTimeout(() => twilioSend(settings, settings.myPhone, followUpMsg).catch(() => {}), 24 * 60 * 60 * 1000); // reminder after 24h
            return "📱 RESCHEDULE SENT\n\nTexted: " + rc.firstName + " " + rc.lastName + " (" + rc.phone + ")\n\n\"" + clientMsg.slice(0, 100) + "...\"\n\nJob: " + rjob.scheduledDate + " — " + rjob.address + willFollowUp + "\n\nWatch Inbox for their reply. Alfred out.";
          } catch (e) {
            return "SMS failed: " + e.message + "\n\nManual draft:\nTo: " + rc.phone + "\n" + clientMsg + "\n\nAlfred out.";
          }
        }
        // No Twilio — open SMS app
        window.location.href = "sms:" + (rc.phone || "").replace(/\D/g,"") + "?body=" + encodeURIComponent(clientMsg);
        return "📱 SMS app opened with reschedule message for " + rc.firstName + ". Connect Twilio in Settings for automatic sending. Alfred out.";
      }
      case "/override": {
        const todayJobs = jobs.filter(j => j.scheduledDate === t && j.status === "scheduled");
        if (todayJobs.length === 0) return "No scheduled jobs today to override. Alfred out.";
        return "⚠️ WEATHER OVERRIDE\n\nToday's jobs (" + todayJobs.length + "):\n" + todayJobs.map(j => "• " + j.address?.split(",")[0]).join("\n") + "\n\nWeather risk overridden. Proceeding with scheduled jobs. Flag individual jobs as 'weather override' in job detail if needed.\n\nAlfred out.";
      }
      case "/slack":
        if (!args) return "USAGE: /slack [metric]. Example: /slack revenue Alfred out.";
        return "🔥 TARGETED ROAST — " + args.toUpperCase() + "\n\n" + args + " isn't going to improve by itself. What's the plan? Set a goal with /goal or close a quote with /followup. Alfred out.";
      case "/followup":
        const stale2 = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 3).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (stale2.length === 0) return "✅ No stale quotes. All current. Alfred out.";
        return "📞 FOLLOW-UP HITLIST\n\n" + stale2.slice(0, 5).map(e => {
          const c = customers.find(x => x.id === e.customerId);
          return "• " + (c?.firstName || "?") + " " + (c?.lastName || "") + " — " + fmt(e.total) + " (" + daysSince(e.createdAt) + "d old)";
        }).join("\n") + "\n\nCall them. Alfred out.";
      case "/weather":
        return "🌤️ WEATHER\n\nCheck Dashboard for the 7-day forecast. High rain chance = call ahead and reschedule before customers do. Alfred out.";
      case "/top":
        const top = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
        return "🏆 TOP CUSTOMERS\n\n" + top.map((c, i) => (i + 1) + ". " + c.firstName + " " + c.lastName + " — " + fmt(c.totalSpent)).join("\n") + "\n\nTreat them like gold. Alfred out.";
      case "/remember":
        if (!args) return "USAGE: /remember [fact]. Alfred out.";
        setMemory(m => [...m, { id: uid(), text: args, createdAt: t }]);
        return "🧠 NOTED: \"" + args + "\"\n\nSaved to memory. Alfred out.";
      case "/forget":
        if (!args) return "USAGE: /forget [keyword]. Alfred out.";
        const removed = memory.filter(m => m.text.toLowerCase().includes(args.toLowerCase())).length;
        setMemory(m => m.filter(mem => !mem.text.toLowerCase().includes(args.toLowerCase())));
        return removed ? "🧹 FORGOT " + removed + " item(s) matching \"" + args + "\". Alfred out." : "Nothing matched. Alfred out.";
      case "/automations":
        const autoList = automations.slice(0, 8).map((a, i) => `${i + 1}. ${a.icon || "⚡"} ${a.name} — ${a.active ? "ON" : "OFF"} · ran ${a.count || 0}x`).join("\n");
        return `⚡ AUTOMATIONS\n\n${automations.length} workflows (${automations.filter(a => a.active).length} active)\n\n${autoList || "No automations yet."}\n\nTell me to build one. Alfred out.`;
      case "/help":
        return "🛠️ COMMANDS\n\n/rollcall  /debrief  /status\n/quote [name] [service] [$]  → create estimate\n/route  /schedule [name]  /reschedule [name]\n/nearby [what]  → Google Maps search\n/followup  /top  /weather\n/compete  /motivate  /savagemode\n/accountability  /proud [win]\n/goal [text|$]  /reflect\n/weekly  /monthly\n/remember [fact]  /forget [keyword]\n/post [caption]  /review send [name]\n/automations  → list workflows\n/help  → this list\n\nOr just talk to me naturally. Alfred out.";
      default:
        return null;
    }
  };

  // When a name lookup misses an exact match, surface the closest candidates
  // (substring match either direction, or shared first name) instead of a
  // bare "not found" — that's what lets Alfred ask "Do you mean X?" with
  // real suggestions instead of a generic follow-up question.
  const suggestNames = (query: string, list: any[], nameFn: (t: any) => string, limit = 3): string[] => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return [];
    const scored = list
      .map(item => {
        const name = nameFn(item).toLowerCase();
        let score = 0;
        if (name.includes(q) || q.includes(name)) score = 3;
        else if (name.split(" ").some(part => part && (part.startsWith(q) || q.startsWith(part)))) score = 2;
        else if (name.split(" ").some(part => q.split(" ").some(qp => qp && part.startsWith(qp.slice(0, 3))))) score = 1;
        return { name: nameFn(item), score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(x => x.name);
  };

  // ===== ALFRED TOOL DEFINITIONS =====
  // Tools Alfred can invoke to read/modify the CRM. Each returns a JSON-serializable result.
  const executeTool = async (name, inputs) => {
    try {
      switch (name) {
        case "search_customers": {
          const q = (inputs.query || "").toLowerCase();
          const results = customers.filter(c => (c.firstName + " " + c.lastName + " " + (c.email || "") + " " + (c.address || "")).toLowerCase().includes(q)).slice(0, 10).map(c => ({
            id: c.id, name: c.firstName + " " + c.lastName, email: c.email, phone: c.phone, address: c.address, totalSpent: c.totalSpent, notes: c.notes
          }));
          return { count: results.length, customers: results };
        }
        case "get_customer_details": {
          const c = customers.find(x => x.id === inputs.customerId || (x.firstName + " " + x.lastName).toLowerCase() === (inputs.name || "").toLowerCase());
          if (!c) {
            const suggestions = suggestNames(inputs.name || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          const cJobs = jobs.filter(j => j.customerId === c.id);
          const cEsts = estimates.filter(e => e.customerId === c.id);
          return {
            customer: c,
            jobCount: cJobs.length,
            totalSpent: c.totalSpent,
            recentJobs: cJobs.slice(-3).map(j => ({ date: j.scheduledDate, amount: j.amount, status: j.status })),
            estimates: cEsts.map(e => ({ id: e.id, total: e.total, status: e.status, createdAt: e.createdAt }))
          };
        }
        case "list_jobs": {
          const filter = inputs.status || "all";
          const list = jobs.filter(j => filter === "all" || j.status === filter).slice(0, 15).map(j => {
            const c = customers.find(x => x.id === j.customerId);
            return { id: j.id, customer: c ? c.firstName + " " + c.lastName : "Unknown", date: j.scheduledDate, amount: j.amount, status: j.status, priority: j.priority, address: j.address };
          });
          return { count: list.length, jobs: list };
        }
        case "list_overdue_invoices": {
          const overdue = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14).map(e => {
            const c = customers.find(x => x.id === e.customerId);
            return { id: e.id, customer: c ? c.firstName + " " + c.lastName : "Unknown", amount: e.total, daysOverdue: daysSince(e.invoicedAt), invoicedAt: e.invoicedAt };
          });
          return { count: overdue.length, overdue };
        }
        case "create_customer": {
          if (!inputs.firstName || !inputs.lastName) return { error: "firstName and lastName required" };
          const newC = { id: uid(), firstName: inputs.firstName, lastName: inputs.lastName, email: inputs.email || "", phone: inputs.phone || "", address: inputs.address || "", totalSpent: 0, createdAt: today(), notes: inputs.notes || "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "" };
          // Alfred must never claim a customer was created unless the Supabase
          // write actually succeeded — local setState always "succeeds" (it's
          // just a React render), so that alone was the literal cause of
          // Alfred reporting success for customers that never existed.
          let saved: any = null;
          let saveError: any = null;
          try {
            const { data, error } = await withTimeout<any>(
              (supabase as any).from("customers").insert(newC).select().single(),
              8000, "Save customer"
            );
            saved = data;
            saveError = error;
          } catch (e: any) {
            saveError = e;
          }
          console.log("TOOL CALL: create_customer — result:", { saved, error: saveError });
          if (saveError || !saved) {
            return { error: "Failed to create customer — " + (saveError?.message || "Supabase write did not return a row") };
          }
          // No local setCustomers call — Supabase is the only source of truth.
          // The existing 3s cross-device sync poll (App.tsx) picks this row up
          // and merges it into local state on its own; Alfred never mutates
          // local state directly, so there's no path where the UI shows a
          // customer that doesn't actually exist in the database.
          toast("Alfred created customer: " + saved.firstName + " " + saved.lastName);
          setTimeout(() => onNav("customers"), 1200);
          return { success: true, customer: saved };
        }
        case "create_estimate": {
          const c = customers.find(x => x.id === inputs.customerId || (x.firstName + " " + x.lastName).toLowerCase() === (inputs.customerName || "").toLowerCase());
          if (!c) {
            const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found. Create customer first or provide valid customerId." };
          }
          const items = (inputs.lineItems || []).map(li => ({ id: uid(), description: li.description, quantity: li.quantity || 1, unitPrice: li.unitPrice || 0 }));
          const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
          const tax = subtotal * ((Number(settings.taxRate) || 6) / 100);
          const total = subtotal + tax;
          const newE = { id: uid(), customerId: c.id, lineItems: items, subtotal, discount: 0, depositRequired: 0, tax, total, status: "pending", createdAt: today(), validUntil: daysFromNow(30), viewed: false, viewedAt: null, terms: "Payment due upon completion.", notes: inputs.notes || "" };
          let savedE: any = null;
          let saveErrorE: any = null;
          try {
            const { data, error } = await withTimeout<any>(
              (supabase as any).from("estimates").insert(newE).select().single(),
              8000, "Save estimate"
            );
            savedE = data;
            saveErrorE = error;
          } catch (e: any) {
            saveErrorE = e;
          }
          console.log("TOOL CALL: create_estimate — result:", { saved: savedE, error: saveErrorE });
          if (saveErrorE || !savedE) {
            return { error: "Failed to create estimate — " + (saveErrorE?.message || "Supabase write did not return a row") };
          }
          // No local setEstimates call — see create_customer above.
          toast("Alfred created estimate #" + savedE.id.toUpperCase() + " · " + fmt(total));
          setTimeout(() => onNav("estimates"), 1200);
          return { success: true, estimateId: savedE.id, total, customer: c.firstName + " " + c.lastName };
        }
        case "schedule_job": {
          const c = customers.find(x => x.id === inputs.customerId || (x.firstName + " " + x.lastName).toLowerCase() === (inputs.customerName || "").toLowerCase());
          if (!c) {
            const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          const newJ = { id: uid(), customerId: c.id, scheduledDate: inputs.date || daysFromNow(3), status: "scheduled", pipelineStage: "scheduled", address: c.address, amount: inputs.amount || 0, photos: [], checklist: (inputs.checklist || ["Confirm water access"]).map(t => ({ label: t, done: false })), isRecurring: false, recurringFreq: "monthly", cancelReason: "", noShow: false, crew: [], duration: inputs.duration || 2, internalNotes: inputs.notes || "", chemicalsUsed: [], equipment: [], commLog: [], priority: inputs.priority || "normal", tags: inputs.tags || [], loggedHours: 0, clockInAt: null, attachments: [] };
          let savedJ: any = null;
          let saveErrorJ: any = null;
          try {
            const { data, error } = await withTimeout<any>(
              (supabase as any).from("jobs").insert(newJ).select().single(),
              8000, "Save job"
            );
            savedJ = data;
            saveErrorJ = error;
          } catch (e: any) {
            saveErrorJ = e;
          }
          console.log("TOOL CALL: schedule_job — result:", { saved: savedJ, error: saveErrorJ });
          if (saveErrorJ || !savedJ) {
            return { error: "Failed to schedule job — " + (saveErrorJ?.message || "Supabase write did not return a row") };
          }
          // No local setJobs call — see create_customer above.
          toast("Alfred scheduled job for " + c.firstName + " on " + savedJ.scheduledDate);
          setTimeout(() => onNav("jobs"), 1200);
          return { success: true, jobId: savedJ.id, date: savedJ.scheduledDate, customer: c.firstName + " " + c.lastName };
        }
        case "update_job_priority": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          setJobs(prev => prev.map(x => x.id === inputs.jobId ? { ...x, priority: inputs.priority } : x));
          return { success: true, jobId: inputs.jobId, newPriority: inputs.priority };
        }
        case "reschedule_job": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          if (!inputs.date) return { error: "date is required" };
          setJobs(prev => prev.map(x => x.id === inputs.jobId ? { ...x, scheduledDate: inputs.date, ...(inputs.time ? { scheduledTime: inputs.time } : {}) } : x));
          toast("Alfred rescheduled job to " + inputs.date + (inputs.time ? " at " + inputs.time : ""));
          setTimeout(() => onNav("jobs"), 1200);
          return { success: true, jobId: inputs.jobId, newDate: inputs.date, newTime: inputs.time || j.scheduledTime };
        }
        case "cancel_job": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          setJobs(prev => prev.map(x => x.id === inputs.jobId ? { ...x, status: "cancelled", cancelReason: inputs.reason || "" } : x));
          toast("Alfred cancelled the " + (j.scheduledDate || "") + " job");
          setTimeout(() => onNav("jobs"), 1200);
          return { success: true, jobId: inputs.jobId, status: "cancelled" };
        }
        case "get_calendar_summary": {
          const from = inputs.from || today();
          const to = inputs.to || daysFromNow(7);
          const inRange = jobs.filter(j => j.scheduledDate >= from && j.scheduledDate <= to && j.status !== "cancelled").map(j => {
            const c = customers.find(x => x.id === j.customerId);
            return { date: j.scheduledDate, time: j.scheduledTime, customer: c ? c.firstName + " " + c.lastName : "Unknown", address: j.address, status: j.status, amount: j.amount };
          }).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
          return { from, to, count: inRange.length, jobs: inRange };
        }
        case "get_employee_status": {
          const list = employees.filter((e: any) => e.status === "active").map((e: any) => {
            const activeJob = jobs.find((j: any) => !!j.clockInAt && (j.crew || []).includes(e.id) && j.status !== "completed" && j.status !== "cancelled");
            return {
              name: e.firstName + " " + e.lastName,
              clockedInForDay: !!e.dayClockInAt,
              onJob: activeJob ? { address: activeJob.address, elapsedMinutes: Math.round((Date.now() - activeJob.clockInAt) / 60000) } : null,
            };
          });
          return { count: list.length, employees: list };
        }
        case "assign_employee": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          const emp = employees.find(e => e.id === inputs.employeeId || (e.firstName + " " + e.lastName).toLowerCase() === (inputs.employeeName || "").toLowerCase());
          if (!emp) {
            const suggestions = suggestNames(inputs.employeeName || "", employees, e => `${e.firstName} ${e.lastName}`);
            return suggestions.length
              ? { error: "Employee not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Employee not found" };
          }
          const crew = j.crew || [];
          if (!crew.includes(emp.id)) setJobs(prev => prev.map(x => x.id === j.id ? { ...x, crew: [...(x.crew || []), emp.id] } : x));
          if (emp.email) {
            const c = customers.find(x => x.id === j.customerId);
            const portalLink = `${window.location.origin}${window.location.pathname}#/portal`;
            const html = emailShell(settings.companyName || "Smock's Pressure Washing", "Job Assignment", `<p>Hi ${emp.firstName},</p><p>You've been assigned to a job:</p><ul><li><b>Date:</b> ${j.scheduledDate}${j.scheduledTime ? " at " + j.scheduledTime : ""}</li><li><b>Address:</b> ${j.address}</li>${c ? `<li><b>Customer:</b> ${c.firstName} ${c.lastName}</li>` : ""}</ul>` + emailButton("Open Crew Portal", portalLink));
            sendEmail(settings, { to: emp.email, subject: `You've Been Assigned — ${j.scheduledDate}`, body: html }).catch(() => {});
          }
          toast("Alfred assigned " + emp.firstName + " to the " + j.scheduledDate + " job");
          return { success: true, jobId: j.id, employeeId: emp.id, employee: emp.firstName + " " + emp.lastName };
        }
        case "request_employee": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          const emp = employees.find(e => e.id === inputs.employeeId || (e.firstName + " " + e.lastName).toLowerCase() === (inputs.employeeName || "").toLowerCase());
          if (!emp) {
            const suggestions = suggestNames(inputs.employeeName || "", employees, e => `${e.firstName} ${e.lastName}`);
            return suggestions.length
              ? { error: "Employee not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Employee not found" };
          }
          try {
            if (!ownerId) return { error: "Still finishing sign-in — try again in a moment" };
            const { data, error } = await withTimeout<any>(
              (supabase as any).from("job_requests").insert({
                job_id: j.id, employee_id: emp.id, owner_id: ownerId, status: "pending", message: inputs.message || null,
              }).select("id").single(),
              8000, "Save request"
            );
            if (error || !data) return { error: "Could not save request — " + (error?.message || "run the job_requests SQL in Supabase first") };
            if (emp.email) {
              const c = customers.find(x => x.id === j.customerId);
              const reqUrl = `${window.location.origin}${window.location.pathname}#/portal?request=${data.id}`;
              const html = emailShell(settings.companyName || "Smock's Pressure Washing", "Job Request", `<p>Hi ${emp.firstName},</p><p>${inputs.message || "You have a new job request:"}</p><ul><li><b>Date:</b> ${j.scheduledDate}${j.scheduledTime ? " at " + j.scheduledTime : ""}</li><li><b>Address:</b> ${j.address}</li>${c ? `<li><b>Customer:</b> ${c.firstName} ${c.lastName}</li>` : ""}</ul><div style="text-align:center;margin:22px 0 4px"><a href="${reqUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;margin-right:8px">✓ Accept Job</a><a href="${reqUrl}&action=deny" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px">✗ Decline</a></div>`);
              withTimeout(sendEmail(settings, { to: emp.email, subject: `Job Request — ${j.scheduledDate}`, body: html }), 8000, "Email send").catch((e: any) => console.warn("Alfred job request email failed — request still saved:", e?.message));
            }
            toast("Alfred sent a job request to " + emp.firstName);
            return { success: true, jobId: j.id, employeeId: emp.id, requestId: data.id, employee: emp.firstName + " " + emp.lastName };
          } catch (e: any) {
            return { error: "Request failed: " + (e?.message || String(e)) };
          }
        }
        case "send_reminder": {
          const c = customers.find(x => x.id === inputs.customerId);
          if (!c) return { error: "Customer not found" };
          const msg = inputs.message || ("Hi " + c.firstName + ", a quick reminder from Smock's Pressure Washing. Reply or call (717) 555-0100.");
          const channel = inputs.channel || "sms";
          if (channel === "sms" && c.phone) {
            if (settings?.twilioSid) {
              try { await twilioSend(settings, c.phone, msg); }
              catch(e) { return { error: "SMS failed: " + e.message }; }
            } else {
              return { success: false, note: "Twilio not configured — add credentials in Settings to send real SMS", draft: msg };
            }
          } else if (channel === "email" && c.email) {
            try { await sendEmail(settings, { to: c.email, subject: inputs.subject || "Reminder from Smock's", body: emailShell(settings?.companyName || "Smock's Pressure Washing", "Reminder", `<p>${msg}</p>`) }); }
            catch(e) { return { error: "Email failed: " + e.message }; }
          }
          toast("Reminder sent to " + c.firstName + " via " + channel + " ✓");
          return { success: true, sentTo: c.firstName + " " + c.lastName, channel, message: msg };
        }
        case "remember_fact": {
          if (!inputs.fact) return { error: "fact required" };
          const newMem = { id: uid(), text: inputs.fact, category: inputs.category || "general", createdAt: today() };
          setMemory(prev => [...prev, newMem]);
          toast("Alfred remembered something");
          return { success: true, remembered: inputs.fact };
        }
        case "get_business_stats": {
          return {
            revenue_mtd: stats.totalRev,
            active_jobs: stats.activeJobs,
            pending_quotes: stats.pendingEst,
            close_rate_pct: stats.closeRate,
            jobs_completed_this_month: stats.doneMonth,
            total_customers: customers.length,
            total_employees: employees.length
          };
        }
        case "navigate_to": {
          if (!inputs.page) return { error: "page required" };
          onNav(inputs.page);
          return { success: true, navigatedTo: inputs.page };
        }
        case "create_automation": {
          if (!inputs.name || !inputs.steps || inputs.steps.length === 0) return { error: "name and steps required" };
          const steps = inputs.steps.map(s => ({ ...s, id: s.id || uid() }));
          const firstTrigger = steps.find(s => s.type === "trigger");
          const firstAction = steps.find(s => s.type === "action");
          const newAuto = {
            id: uid(),
            name: inputs.name,
            description: inputs.description || "",
            icon: inputs.icon || "⚡",
            category: inputs.category || "other",
            trigger: firstTrigger?.label || "Manual",
            action: firstAction?.label || "Multi-step",
            steps,
            isWorkflow: true,
            active: true,
            count: 0,
            lastTriggered: null,
            runLog: [],
            createdByAlfred: true
          };
          setAutomations(prev => [...prev, newAuto]);
          onNav("automations");
          toast("Alfred created workflow: " + newAuto.name);
          return { success: true, automationId: newAuto.id, name: newAuto.name, stepCount: steps.length };
        }
        case "list_automations": {
          return {
            count: automations.length,
            active: automations.filter(a => a.active).length,
            automations: automations.map(a => ({ id: a.id, name: a.name, active: a.active, trigger: a.trigger, count: a.count || 0, lastTriggered: a.lastTriggered, steps: (a.steps || []).length }))
          };
        }
        case "toggle_automation": {
          if (!inputs.automationId) return { error: "automationId required" };
          const a = automations.find(x => x.id === inputs.automationId);
          if (!a) return { error: "Automation not found" };
          setAutomations(prev => prev.map(x => x.id === inputs.automationId ? { ...x, active: inputs.active } : x));
          toast((inputs.active ? "Enabled" : "Disabled") + ": " + a.name);
          return { success: true, automationId: inputs.automationId, active: inputs.active };
        }
        case "send_email_via_gmail": {
          if (!settings.googleConnected || !(settings.googleScopes || {}).gmail) return { error: "Gmail not connected. Ask user to go to Settings → Integrations → Google and connect." };
          if (!inputs.to || !inputs.subject || !inputs.body) return { error: "to, subject, body required" };
          const url = settings.googleBackendUrl;
          const token = settings.googleToken;
          if (url && token) {
            try {
              const sendGmailEmail = async (u: string, t: string, opts: any) => { const r = await fetch(u + "/gmail/send", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(opts) }); return r.json(); };
              const result = await sendGmailEmail(url, token, { to: inputs.to, subject: inputs.subject, body: inputs.body, cc: inputs.cc });
              toast("Email sent to " + inputs.to + " ✓");
              return { success: true, sent: true, via: "gmail", to: inputs.to, subject: inputs.subject, messageId: result.id || "sent" };
            } catch (e) {
              return { error: "Gmail send failed: " + e.message };
            }
          } else {
            // Backend not configured — show what would happen
            toast("Email staged: " + inputs.to + " (add backend URL in Settings to actually send)");
            return { success: true, sent: false, staged: true, to: inputs.to, subject: inputs.subject, note: "Backend URL not configured. Token + URL needed to send real emails." };
          }
        }
        case "create_calendar_event": {
          if (!settings.googleConnected || !(settings.googleScopes || {}).calendar) return { error: "Calendar not connected. Ask user to go to Settings → Integrations → Google and enable Calendar." };
          if (!inputs.title || !inputs.date) return { error: "title and date required" };
          const url = settings.googleBackendUrl;
          const token = settings.googleToken;
          const startDt = inputs.date + "T" + (inputs.time || "09:00") + ":00";
          const endMin = (inputs.duration_minutes || 60);
          const endDt = new Date(new Date(startDt).getTime() + endMin * 60000).toISOString().slice(0, 19);
          if (url && token) {
            try {
              const calResult = await (createCalendarEvent as any)(url, token, { title: inputs.title, start: startDt, end: endDt, description: inputs.notes || "", location: inputs.location || "", attendees: inputs.attendees || [] });
              toast("Event created in Google Calendar: " + inputs.title);
              return { success: true, eventId: (calResult as any)?.id || uid(), title: inputs.title, start: startDt, end: endDt };
            } catch (e) {
              return { error: "Calendar event failed: " + e.message };
            }
          } else {
            toast("Event queued: " + inputs.title + " on " + inputs.date + " (add backend URL in Settings to sync to Google Calendar)");
            return { success: true, queued: true, title: inputs.title, date: inputs.date, note: "Backend URL not configured. Token + URL needed to create real Calendar events." };
          }
        }
        case "upload_to_drive": {
          if (!settings.googleConnected || !(settings.googleScopes || {}).drive) return { error: "Drive not connected. Ask user to go to Settings → Integrations → Google and enable Drive." };
          if (!inputs.filename) return { error: "filename required" };
          const url = settings.googleBackendUrl;
          const token = settings.googleToken;
          if (url && token) {
            try {
              const uploadToDrive = async (u: string, t: string, opts: any) => { const r = await fetch(u + "/drive/upload", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(opts) }); return r.json(); };
              const result = await uploadToDrive(url, token, { filename: inputs.filename, content: inputs.content || "", mimeType: inputs.mimeType || "text/plain", folderId: inputs.folder });
              toast("Uploaded to Drive: " + inputs.filename + " ✓");
              return { success: true, fileId: result.id || uid(), filename: inputs.filename, webViewLink: result.webViewLink };
            } catch (e) {
              return { error: "Drive upload failed: " + e.message };
            }
          } else {
            toast("File queued: " + inputs.filename + " (add backend URL in Settings to upload to Drive)");
            return { success: true, queued: true, filename: inputs.filename, note: "Backend URL not configured." };
          }
        }
        case "create_google_task": {
          if (!settings.googleConnected || !(settings.googleScopes || {}).tasks) return { error: "Google Tasks not connected. Enable Tasks scope in Settings → Integrations → Google." };
          if (!inputs.title) return { error: "title required" };
          const url = settings.googleBackendUrl;
          const token = settings.googleToken;
          if (url && token) {
            try {
              const createTask = async (u: string, t: string, opts: any) => { const r = await fetch(u + "/tasks", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(opts) }); return r.json(); };
              const result = await createTask(url, token, { title: inputs.title, notes: inputs.notes, due: inputs.due });
              toast("Task created in Google Tasks: " + inputs.title);
              return { success: true, taskId: result.id, title: inputs.title };
            } catch (e) {
              return { error: "Task creation failed: " + e.message };
            }
          } else {
            toast("Task queued: " + inputs.title + " (add backend URL to sync to Google Tasks)");
            return { success: true, queued: true, title: inputs.title };
          }
        }
        default:
          return { error: "Unknown tool: " + name };
      }
    } catch (err) {
      return { error: err.message || String(err) };
    }
  };

  const toolDefinitions = [
    {
      name: "search_customers",
      description: "Search customers by name, email, or address. Use this to find a customer before referencing them.",
      input_schema: { type: "object", properties: { query: { type: "string", description: "Search text (name, email, or address fragment)" } }, required: ["query"] }
    },
    {
      name: "get_customer_details",
      description: "Get full details for one customer including their job history, spending, and estimates.",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, name: { type: "string", description: "Full name like 'Mike Harrison' as alternative to id" } } }
    },
    {
      name: "list_jobs",
      description: "List jobs, optionally filtered by status (scheduled, in_progress, completed, cancelled, or 'all').",
      input_schema: { type: "object", properties: { status: { type: "string", enum: ["all", "scheduled", "in_progress", "completed", "cancelled"] } } }
    },
    {
      name: "list_overdue_invoices",
      description: "List invoices that are more than 14 days past due.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "create_customer",
      description: "Add a new customer to the CRM.",
      input_schema: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, notes: { type: "string" } }, required: ["firstName", "lastName"] }
    },
    {
      name: "create_estimate",
      description: "Create a new estimate for a customer. Provide line items with description, quantity, unitPrice. Tax is added automatically.",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, customerName: { type: "string" }, lineItems: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unitPrice: { type: "number" } }, required: ["description", "unitPrice"] } }, notes: { type: "string" } }, required: ["lineItems"] }
    },
    {
      name: "schedule_job",
      description: "Schedule a new job for a customer on a specific date (YYYY-MM-DD).",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, customerName: { type: "string" }, date: { type: "string" }, amount: { type: "number" }, duration: { type: "number" }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] }, tags: { type: "array", items: { type: "string" } }, checklist: { type: "array", items: { type: "string" } }, notes: { type: "string" } } }
    },
    {
      name: "update_job_priority",
      description: "Change the priority of an existing job.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] } }, required: ["jobId", "priority"] }
    },
    {
      name: "reschedule_job",
      description: "Move an existing job to a new date and/or time.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM, optional" } }, required: ["jobId", "date"] }
    },
    {
      name: "cancel_job",
      description: "Cancel an existing job.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, reason: { type: "string" } }, required: ["jobId"] }
    },
    {
      name: "get_calendar_summary",
      description: "Get what's scheduled for a date range — use for 'what's on the calendar today/this week' questions.",
      input_schema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD, defaults to today" }, to: { type: "string", description: "YYYY-MM-DD, defaults to 7 days from 'from'" } } }
    },
    {
      name: "get_employee_status",
      description: "See which employees are currently clocked in, what job they're on, and elapsed time — use for 'who's working' / 'who's clocked in' questions.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "assign_employee",
      description: "Assign an employee to a job's crew directly — they're added immediately and emailed, no acceptance needed.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, employeeId: { type: "string" }, employeeName: { type: "string", description: "Full name like 'Jake Smith' as alternative to employeeId" } }, required: ["jobId"] }
    },
    {
      name: "request_employee",
      description: "Send a job request to an employee — they must accept or decline before being added to the crew.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, employeeId: { type: "string" }, employeeName: { type: "string", description: "Full name like 'Jake Smith' as alternative to employeeId" }, message: { type: "string" } }, required: ["jobId"] }
    },
    {
      name: "send_reminder",
      description: "Send a payment or appointment reminder to a customer (mocked).",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, channel: { type: "string", enum: ["email", "sms"] } }, required: ["customerId"] }
    },
    {
      name: "remember_fact",
      description: "Save an important fact to long-term memory. Use when the user shares preferences, business info, or wants something remembered. Categories: preferences, business, facts, goals.",
      input_schema: { type: "object", properties: { fact: { type: "string" }, category: { type: "string", enum: ["preferences", "business", "facts", "goals", "general"] } }, required: ["fact"] }
    },
    {
      name: "get_business_stats",
      description: "Get current live business KPIs.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "navigate_to",
      description: "Navigate the user's screen to a CRM page. Valid pages: dashboard, customers, estimates, invoices, jobs, pipeline, calendar, campaigns, referrals, reviews, automations, social, accountability, employees, fleet, expenses, chemicals, reports.",
      input_schema: { type: "object", properties: { page: { type: "string" } }, required: ["page"] }
    },
    {
      name: "create_automation",
      description: "Create a new multi-step workflow automation in the CRM. Build an n8n-style workflow from a description. Each step must have: id (generate unique string), type (trigger|condition|delay|action|branch), label (human-readable description). Action steps also need channel (email|sms|task|webhook|calendar|internal). Delay steps need duration (number) and unit (min|hour|day|week|month). Condition steps need check (from list). Set trigger step first always.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Descriptive name for the workflow" },
          description: { type: "string" },
          category: { type: "string", enum: ["estimates", "jobs", "payments", "reviews", "lifecycle", "referrals", "other"] },
          icon: { type: "string", description: "Single emoji" },
          steps: {
            type: "array",
            description: "Ordered steps. First must be type=trigger.",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string", enum: ["trigger", "condition", "delay", "action", "branch"] },
                label: { type: "string" },
                channel: { type: "string", enum: ["email", "sms", "task", "webhook", "calendar", "internal"] },
                check: { type: "string" },
                duration: { type: "number" },
                unit: { type: "string", enum: ["min", "hour", "day", "week", "month"] },
                template: { type: "string" },
                url: { type: "string" },
                target: { type: "string" }
              },
              required: ["type", "label"]
            }
          }
        },
        required: ["name", "steps"]
      }
    },
    {
      name: "list_automations",
      description: "Get all existing workflow automations with their status and run counts.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "toggle_automation",
      description: "Enable or disable an automation workflow by ID.",
      input_schema: { type: "object", properties: { automationId: { type: "string" }, active: { type: "boolean" } }, required: ["automationId", "active"] }
    },
    {
      name: "create_google_task",
      description: "Create a task in Google Tasks. Only works if Google Tasks scope is enabled.",
      input_schema: { type: "object", properties: { title: { type: "string" }, notes: { type: "string" }, due: { type: "string", description: "YYYY-MM-DD" } }, required: ["title"] }
    },
    {
      name: "send_email_via_gmail",
      description: "Send an email via the user's connected Gmail account. Only works if Google is connected in Settings with Gmail scope enabled.",
      input_schema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, cc: { type: "string" } }, required: ["to", "subject", "body"] }
    },
    {
      name: "create_calendar_event",
      description: "Create an event on the user's Google Calendar. Only works if Google Calendar is connected.",
      input_schema: { type: "object", properties: { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h" }, duration_minutes: { type: "number" }, location: { type: "string" }, attendees: { type: "array", items: { type: "string" } }, notes: { type: "string" } }, required: ["title", "date"] }
    },
    {
      name: "upload_to_drive",
      description: "Upload a file to the user's Google Drive. Only works if Google Drive is connected.",
      input_schema: { type: "object", properties: { filename: { type: "string" }, folder: { type: "string" }, content: { type: "string" } }, required: ["filename"] }
    }
  ];

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    // If no conversation exists yet (edge case on first render), create one now
    if (!active) {
      const cid = uid();
      const greeting = (personalities as any)[personality]?.greeting || "Hey. What do we need to handle today? Alfred out.";
      const newConv = { id: cid, title: text.slice(0, 42) + (text.length > 42 ? "…" : ""), personality, createdAt: today(), updatedAt: Date.now(), messages: [] };
      setConversations([newConv]);
      setActiveConvId(cid);
      // Can't append to it this render — state not yet committed. Return and let user retry.
      // In practice the auto-init useEffect handles this; this guard prevents a silent no-op.
      console.warn("No active conversation on send — auto-created one. Please send again.");
      return;
    }

    const userMsg = { id: uid(), role: "user", content: text, timestamp: Date.now() };
    appendMessage(userMsg);

    // Auto-title from first user message
    if (active && (active.title === "New chat" || !active.title)) {
      const title = text.length > 42 ? text.slice(0, 42) + "…" : text;
      updateActive({ title });
    }

    setInput("");
    setShowSlash(false);

    if (text.startsWith("/")) {
      const r = await runSlash(text);
      if (r !== null) {
        appendMessage({ id: uid(), role: "alfred", content: r, timestamp: Date.now() });
        return;
      }
      // Unknown slash command — let AI handle it naturally
      // Don't dead-end, just pass through to Claude with the text
    }

    setLoading(true);

    try {
      const prompts = {
        drill: "You are Alfred, a gruff drill sergeant who manages Smock's Pressure Washing, a pressure washing business in York, PA. Be aggressive, motivating, use military terminology. Keep responses short and punchy (2-4 short lines usually). End every response with 'Alfred out.'",
        butler: "You are Alfred, a polished British butler at Smock's Pressure Washing in York, PA. Be formal, courteous, and refined. Use 'sir' and British expressions. Keep responses concise and professional.",
        quiet: "You are Alfred, a stoic operations manager at Smock's Pressure Washing in York, PA. Be terse, data-driven, and matter-of-fact. No pleasantries. Just facts and actions. Keep it short.",
        savage: "You are Alfred, a sarcastic but brilliant assistant at Smock's Pressure Washing in York, PA. Roast the user occasionally but always be helpful underneath. Be witty and sharp."
      };
      const activePersonality = active?.personality || personality;
      const memByCat: Record<string, string[]> = memory.reduce((acc: Record<string, string[]>, m: any) => { const k = m.category || "general"; (acc[k] = acc[k] || []).push(m.text); return acc; }, {});
      const memoryContext = memory.length > 0 ? "\n\nWhat you remember about the user (organized by category):\n" + Object.entries(memByCat).map(([k, list]) => "  [" + k + "]: " + list.join("; ")).join("\n") : "";
      const businessContext = "\n\nCurrent business snapshot:\n- Active jobs: " + stats.activeJobs + "\n- Pending quotes: " + stats.pendingEst + "\n- Revenue MTD: " + fmt(stats.totalRev) + "\n- Close rate: " + stats.closeRate + "%\n- Jobs completed this month: " + stats.doneMonth + "\n- Total customers: " + customers.length;
      const googleStatus = settings.googleConnected
        ? `\n\nGoogle Workspace: CONNECTED as ${settings.googleEmail}. Backend: ${settings.googleBackendUrl ? "configured ✓" : "NOT configured — calls will be queued until backend URL is added"}. Enabled scopes: ${Object.entries(settings.googleScopes || {}).filter(([k, v]) => v).map(([k]) => k).join(", ")}. You CAN use send_email_via_gmail, create_calendar_event, create_google_task, and upload_to_drive — they will call the real Google APIs if backend is configured, or stage for later if not.`
        : `\n\nGoogle Workspace: NOT CONNECTED. If the user asks to send email, create calendar events, or manage tasks, tell them to go to Settings → Integrations → Google and connect their backend.`;
      const toolHint = `\n\nYou have tools available to READ and MODIFY the CRM. USE THEM AGGRESSIVELY — don't just describe what you would do, actually do it.\n\nRESPONSE STYLE: Do not narrate your reasoning, your plan, or which tool you're about to call ("Let me check...", "I'll create that now...", "First I need to..."). Just call the tool(s) silently and then give the user the final result in 1-3 short sentences. No step-by-step thinking out loud.\n\nVERIFY BEFORE CONFIRMING: every action tool returns either {"success": true, ...} or {"error": "..."}. NEVER say "Done" or "All set" without checking which one came back. If you see an "error" field, tell the user exactly what went wrong (the error text) and what they could try instead — do not pretend it worked, and do not retry silently. Only confirm success when the tool result actually contains "success": true.\n\nKEY TOOL RULES:\n- Customer queries → USE search_customers or get_customer_details FIRST\n- Stats requests → USE get_business_stats\n- "What's on the calendar" → USE get_calendar_summary\n- "Who's clocked in / who's working" → USE get_employee_status\n- "Remember/note/don't forget" → USE remember_fact\n- Create estimates, customers, jobs → USE create_estimate/create_customer/schedule_job\n- Move or cancel a job → USE reschedule_job/cancel_job\n- Navigate somewhere → USE navigate_to (the app already auto-navigates after schedule_job/create_customer/create_estimate, but call navigate_to yourself for anything else the user asks to see)\n- Preferences/facts shared → USE remember_fact automatically\n\nAUTOMATION TOOLS (VERY IMPORTANT):\n- When user describes ANY workflow, drip sequence, reminder, or "when X do Y" scenario → USE create_automation IMMEDIATELY. Build a proper n8n-style multi-step workflow with real step types: trigger (first), then delays, conditions, actions. NEVER just describe what you'd build — actually build it with create_automation.\n- "Send review request after job complete" → trigger: Job complete, delay: 2h, action: SMS review request\n- "Follow up on unpaid invoices" → trigger: Invoice unpaid 7 days, action: polite reminder email, delay: 4 days, condition: still unpaid, action: firm SMS\n- To check existing workflows → USE list_automations\n- To enable/disable a workflow → USE toggle_automation\n\nCurrent automations: ${automations.length} total, ${automations.filter(a => a.active).length} active\n\nNAME MATCHING: if a tool result comes back with "error": "Customer not found" or "Employee not found" and includes a "suggestions" array, ask the user "Do you mean [name], or [name]?" using those exact suggested names — never ask a generic clarifying question like "who do you mean?" when real candidate names are available.`;
      const systemPrompt = prompts[activePersonality] + memoryContext + businessContext + googleStatus + toolHint;

      // Build initial message list — allow multi-turn tool calls up to 5 rounds
      let convMessages = [...chats, userMsg].slice(-12).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      let rounds = 0;
      let finalText = "";
      const toolTraces = [];
      let modelUsed = settings.activeModel || "claude";
      const failoverChain = [];

      // Build the ordered list of candidates: try active model first, then priority chain (skipping missing keys).
      // Locked (rate-limited) models are excluded from the initial list but will be detected mid-chain.
      const priority = settings.modelPriority || ["claude", "openai", "gemini", "groq", "mistral"];
      const tryOrder = [modelUsed, ...priority.filter(m => m !== modelUsed)];
      const now = Date.now();
      const MODELS_MAP: any = MODELS;
      const viableModels = tryOrder.filter(mid => {
        const m = MODELS_MAP[mid];
        if (!m) return false;
        if (m.needsKey && !(settings.modelKeys || {})[mid]) return false; // no key
        const status: any = modelStatus[mid];
        if (status && status.lockedUntil && status.lockedUntil > now) return false; // locked out
        return true;
      });
      if (viableModels.length === 0) {
        const lockedWithKey = tryOrder.filter(mid => {
          const m = MODELS_MAP[mid];
          if (!m || (m.needsKey && !(settings.modelKeys || {})[mid])) return false;
          const status: any = modelStatus[mid];
          return status?.lockedUntil > now;
        });
        if (lockedWithKey.length > 0) {
          const soonest = lockedWithKey.map(mid => (modelStatus[mid] as any)?.lockedUntil).sort()[0];
          const wait = Math.ceil((soonest - now) / 60000);
          const lines = lockedWithKey.map(mid => {
            const rem = Math.ceil(((modelStatus[mid] as any)?.lockedUntil - now) / 60000);
            return `• ${MODELS_MAP[mid]?.name || mid}: rate-limited, resets in ~${rem}m`;
          });
          throw new Error("All models are rate-limited:\n" + lines.join("\n") + `\n\nSoonest reset: ~${wait} min. You can unlock manually in Settings → AI Models.`);
        }
        throw new Error("No AI models available. Go to Settings → AI Models and add at least one API key (Claude, Gemini, OpenAI, Groq, or Mistral).");
      }
      // Always try all viable models in order — failoverEnabled controls whether non-rate-limit errors cascade
      const chain = viableModels;

      let success = false;
      for (const mid of chain) {
        try {
          modelUsed = mid;
          rounds = 0;
          // Reset convo for this attempt
          let localConv = [...convMessages];
          let localFinal = "";
          const localTraces = [];
          while (rounds < 5) {
            rounds++;
            const toolsForModel = MODELS_MAP[mid]?.supportsTools ? toolDefinitions : undefined;
            const result = await (callModel as any)({
              modelId: mid,
              apiKey: (settings.modelKeys || {})[mid],
              systemPrompt,
              messages: localConv,
              tools: toolsForModel,
              maxTokens: 1500
            });
            if (result.text) localFinal = result.text;
            if (result.toolUses.length > 0 && result.stopReason === "tool_use" && toolsForModel) {
              localConv.push({ role: "assistant", content: result.raw });
              const toolResults = await Promise.all(result.toolUses.map(async tu => {
                const r = await executeTool(tu.name, tu.input || {});
                console.log("ALFRED TOOL CALL —", tu.name, "input:", tu.input, "→ result:", r, r?.error ? "(FAILED)" : "(ok)");
                localTraces.push({ tool: tu.name, input: tu.input, result: r });
                return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(r) };
              }));
              localConv.push({ role: "user", content: toolResults });
              continue;
            }
            break;
          }
          // Success: commit
          finalText = localFinal;
          toolTraces.push(...localTraces);
          success = true;
          // Clear any stale lockout for this model since it just worked
          if (modelStatus[mid]) setModelStatus(s => { const n = { ...s }; delete n[mid]; return n; });
          break;
        } catch (err) {
          failoverChain.push({ model: mid, error: err.message });
          const rateLimit = (parseRateLimitError as any)(err, mid);
          const isLast = chain.indexOf(mid) === chain.length - 1;
          if (rateLimit) {
            setModelStatus(s => ({ ...s, [mid]: { lockedUntil: rateLimit.lockedUntil, lastError: err.message, since: Date.now() } }));
            toast((MODELS_MAP[mid]?.name || mid) + " rate-limited" + (!isLast ? " — trying next" : ""), "error");
          } else if (isLast) {
            // last in chain and not rate-limit — bubble up so outer catch shows a red error bubble
            throw err;
          } else {
            const overloaded = (err as any)?.status === 503 || /overloaded|503/i.test(err.message || "");
            toast((MODELS_MAP[mid]?.name || mid) + (overloaded ? " overloaded — auto-switching to next model" : " failed — trying next"), "error");
          }
          // continue to next model
        }
      }

      if (!success) {
        // Build a clear, actionable error message
        const lockedModels = Object.entries(modelStatus).filter(([_, s]) => (s as any)?.lockedUntil > Date.now());
        const allCorsBlocked = failoverChain.length > 0 && failoverChain.every(f => /failed to fetch|cors|network/i.test(f.error));

        let errorMsg;
        if (allCorsBlocked) {
          errorMsg = "All third-party AI providers blocked your browser request (CORS).\n\n💡 Fix: Use Claude (the only built-in model) — it works without a backend.\n\nThe other providers (OpenAI, Gemini, Groq, Mistral, MiniMax) need a backend proxy to work in a browser. Their API keys are stored, but the calls fail at the network layer.";
        } else if (lockedModels.length === priority.length) {
          const soonest = lockedModels.map(([_, s]) => (s as any).lockedUntil).sort()[0];
          const wait = Math.ceil((soonest - Date.now()) / 60000);
          errorMsg = "All models are rate-limited.\n\n⏱ Soonest reset: ~" + wait + " min\n\nYou can wait, or unlock a model manually in Settings → AI Models → Reset now.";
        } else {
          errorMsg = "Tried " + chain.length + " model(s):\n" + failoverChain.slice(-5).map(f => "• " + (MODELS_MAP[f.model]?.name || f.model) + ": " + f.error).join("\n");
        }
        throw new Error(errorMsg);
      }

      if (!finalText) finalText = "Done.";
      // Only show the final answer — no self-identifying model footer (it was
      // showing up redundantly) and no tool-trace text appended to the visible
      // message. modelUsed/toolTraces/failoverChain are still stored as
      // metadata on the message in case something else needs them later; they
      // just aren't concatenated into the displayed text anymore. A failover
      // is the one thing still worth surfacing, since it explains why the
      // response might read differently than usual.
      let displayText = finalText;
      if (modelUsed !== (settings.activeModel || "claude")) {
        displayText += "\n\n*⚡ Failed over to " + (MODELS_MAP[modelUsed]?.name || modelUsed) + "*";
      }
      appendMessage({ id: uid(), role: "alfred", content: displayText, timestamp: Date.now(), toolTraces, modelUsed, failoverChain });

      // ElevenLabs TTS — read response aloud if enabled and key set
      if (settings.elevenlabsKey && settings.ttsEnabled) {
        try {
          const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
          const ttsText = finalText.replace(/\*\*?([^*]+)\*\*?/g, "$1").replace(/\n+/g, " ").slice(0, 500);
          const ttsRes = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voiceId, {
            method: "POST",
            headers: { "Content-Type": "application/json", "xi-api-key": settings.elevenlabsKey },
            body: JSON.stringify({ text: ttsText, model_id: "eleven_monolingual_v1", voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
          });
          if (ttsRes.ok) {
            const blob = await ttsRes.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play().catch(() => {});
            audio.onended = () => URL.revokeObjectURL(url);
          }
        } catch { /* TTS failure is silent */ }
      }

      // Self-learning: auto-extract memory from patterns
      if (/^(remember (that |this:? ?)?|note that |don'?t forget )/i.test(text)) {
        const fact = text.replace(/^(remember (that |this:? ?)?|note that |don'?t forget )/i, "").trim();
        if (fact && !memory.some(m => m.text.toLowerCase() === fact.toLowerCase())) {
          setMemory(m => [...m, { id: uid(), text: fact, category: "general", createdAt: today() }]);
          toast("Saved to memory");
        }
      }
      // Extra self-learning — learn from preference patterns
      const prefPatterns = [
        { re: /i (prefer|like|want|need) (.+)/i, cat: "preferences" },
        { re: /my (favorite|go-?to) (.+) is (.+)/i, cat: "preferences" },
        { re: /i (never|don'?t|can'?t) (.+)/i, cat: "preferences" },
        { re: /(charge|price|rate|quote) (.+) for (.+)/i, cat: "business" }
      ];
      for (const p of prefPatterns) {
        if (p.re.test(text) && text.length < 200) {
          const lower = text.toLowerCase();
          if (!memory.some(m => m.text.toLowerCase() === lower)) {
            setMemory(m => [...m, { id: uid(), text: text, category: p.cat, createdAt: today(), autoLearned: true }]);
          }
          break;
        }
      }
    } catch (err) {
      appendMessage({ id: uid(), role: "alfred", content: "⚠️ " + (err.message || "Connection failed") + "\n\nSlash commands still work without a connection. Try /help.", timestamp: Date.now() });
    } finally {
      setLoading(false);
    }
  };

  const onInputChange = e => {
    const v = e.target.value;
    setInput(v);
    setShowSlash(v.startsWith("/") && !v.includes(" "));
  };

  const pickSlash = s => {
    const cmd = s.cmd.split(" ")[0];
    setInput(cmd + (s.cmd.includes("[") ? " " : ""));
    setShowSlash(false);
    inputRef.current?.focus();
  };

  const cur: any = (personalities as any)[active?.personality || personality] || { name: "Alfred", color: "from-red-600 to-red-900", icon: Bot };
  const CurIcon = cur.icon || Bot;

  const filteredConvs = conversations
    .filter(c => !convSearch.trim() || c.title.toLowerCase().includes(convSearch.toLowerCase()) || c.messages.some(m => m.content.toLowerCase().includes(convSearch.toLowerCase())))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  // Group conversations by recency
  const groupConvs = list => {
    const now = Date.now();
    const today_ = [], week = [], older = [];
    list.forEach(c => {
      const age = (now - (c.updatedAt || 0)) / 86400000;
      if (age < 1) today_.push(c);
      else if (age < 7) week.push(c);
      else older.push(c);
    });
    return [["Today", today_], ["Previous 7 days", week], ["Older", older]].filter(([, g]) => g.length > 0);
  };
  const convGroups = groupConvs(filteredConvs);

  const relTime = ts => {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m";
    if (diff < 86400) return Math.floor(diff / 3600) + "h";
    return Math.floor(diff / 86400) + "d";
  };

  return (
    <div className="relative -mx-4 md:-mx-6 -my-4 md:-my-6 flex bg-black overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>
      {/* Conversation sidebar */}
      <aside className={"bg-black/80 backdrop-blur-xl border-r border-red-900/30 flex flex-col transition-all duration-300 overflow-hidden " + (sidebarOpen ? "w-[280px] md:w-[280px]" : "w-0") + " absolute md:relative h-full z-20"}>
        <div className="p-3 border-b border-red-900/30 flex items-center gap-2">
          <button onClick={newConversation} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-600/40 bg-red-950/30 hover:bg-red-900/40 text-sm font-medium transition">
            <Plus size={14} />New chat
          </button>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-white/5 text-white/50"><X size={14} /></button>
        </div>

        <div className="p-3 border-b border-red-900/20">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Search chats..." className="w-full bg-black/40 border border-red-900/20 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-600/40" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {convGroups.map(([label, group]: [string, any[]]) => (
            <div key={label} className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-white/40 px-2 mb-1">{label}</div>
              {group.map(c => {
                const isActive = c.id === activeConvId;
                const isEditing = editingTitle === c.id;
                return (
                  <div key={c.id} className={"group relative rounded-lg mb-0.5 transition " + (isActive ? "bg-red-900/30 border border-red-600/40" : "hover:bg-white/5 border border-transparent")}>
                    {isEditing ? (
                      <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)} onBlur={commitRename} onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingTitle(null); }} className="w-full bg-black/60 border border-red-600/40 rounded-lg px-2.5 py-2 text-xs focus:outline-none" />
                    ) : (
                      <button onClick={() => { setActiveConvId(c.id); if (window.innerWidth < 768) setSidebarOpen(false); }} className="w-full text-left px-2.5 py-2 pr-16">
                        <div className="text-xs font-medium truncate">{c.title || "Untitled"}</div>
                        <div className="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5">
                          <MessageSquare size={8} />{c.messages.filter(m => m.role === "user").length} · {relTime(c.updatedAt)}
                        </div>
                      </button>
                    )}
                    {!isEditing && (
                      <div className={"absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 " + (isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100") + " transition"}>
                        <button onClick={e => { e.stopPropagation(); startRename(c); }} className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white" title="Rename"><Edit size={10} /></button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(c.id); }} className="p-1 rounded hover:bg-red-900/40 text-white/60 hover:text-red-400" title="Delete"><Trash2 size={10} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {filteredConvs.length === 0 && <div className="text-center py-8 text-xs text-white/30">No chats found</div>}
        </div>

        {/* Bottom: personality switcher + memory toggle */}
        <div className="border-t border-red-900/30 p-2 space-y-1">
          <button onClick={() => setMemoryOpen(true)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/5 text-xs text-white/70 hover:text-white transition">
            <div className="p-1.5 rounded bg-purple-900/30"><Bot size={11} className="text-purple-400" /></div>
            <span className="flex-1 text-left">Memory</span>
            <span className="text-[10px] text-white/40">{memory.length}</span>
          </button>
          <div className="px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Personality</div>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(personalities as any).map(([k, p]: [string, any]) => {
                const Icon = p.icon;
                const a = (active?.personality || personality) === k;
                return <button key={k} onClick={() => { setPersonality(k); if (active) updateActive({ personality: k }); }} className={"flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition border " + (a ? "bg-gradient-to-r " + p.color + " border-red-500/50" : "bg-white/5 hover:bg-white/10 border-transparent text-white/60")}>{Icon && <Icon size={10} />}{p.name}</button>;
              })}
            </div>
          </div>
          {!apiKey && <div className="w-full p-2 rounded-lg bg-green-900/20 border border-green-800/40 text-[10px] text-green-400">✓ Claude AI connected</div>}
          {settings.elevenlabsKey && (
            <button onClick={() => setSettings({ ...settings, ttsEnabled: !settings.ttsEnabled })} className={"w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition border " + (settings.ttsEnabled ? "bg-orange-900/30 border-orange-700/40 text-orange-300" : "bg-white/5 border-transparent text-white/50 hover:text-white")}>
              <span>{settings.ttsEnabled ? "🔊" : "🔇"}</span>
              <span className="flex-1 text-left">Voice {settings.ttsEnabled ? "On" : "Off"}</span>
              <span className="text-[9px] text-white/30">ElevenLabs</span>
            </button>
          )}
        </div>
      </aside>

      {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/60 z-10" onClick={() => setSidebarOpen(false)} />}

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-black to-neutral-950">
        {/* Chat header */}
        <div className="flex items-center gap-2 p-3 border-b border-red-900/30 bg-black/40 backdrop-blur">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-white/5 text-white/70" title="Toggle sidebar">
            <Menu size={16} />
          </button>
          <div className={"p-1.5 rounded-lg bg-gradient-to-br " + cur.color}><CurIcon size={12} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{active?.title || "New chat"}</div>
            <div className="text-[10px] text-white/50">Alfred · {cur.name}</div>
          </div>

          {/* Model switcher */}
          {(() => {
            const activeModel = settings.activeModel || "claude";
            const activeM = (MODELS as any)[activeModel];
            const activeLocked = (modelStatus[activeModel] as any)?.lockedUntil > Date.now();
            const remaining = activeLocked ? (modelStatus[activeModel] as any).lockedUntil - Date.now() : 0;
            const fmtShort = ms => {
              const s = Math.floor(ms / 1000);
              if (s < 60) return s + "s";
              const m = Math.floor(s / 60);
              if (m < 60) return m + "m";
              return Math.floor(m / 60) + "h " + (m % 60) + "m";
            };
            return <div className="relative">
              <button onClick={() => setModelPickerOpen(!modelPickerOpen)} className={"flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition " + (activeLocked ? "bg-yellow-950/30 border-yellow-700/50 text-yellow-300" : "bg-black/40 border-red-900/30 hover:border-red-600/50 text-white/80")}>
                <div className={"w-2 h-2 rounded-full bg-gradient-to-br " + (activeM?.color || "from-gray-500 to-gray-700")} />
                <span className="hidden sm:inline">{activeM?.name || "Model"}</span>
                {activeLocked && <span className="font-mono text-[10px] text-yellow-300">⏱{fmtShort(remaining)}</span>}
                {settings.failoverEnabled && <Zap size={10} className="text-purple-400" />}
                <ChevronRight size={10} className="rotate-90 opacity-60" />
              </button>
              {modelPickerOpen && <>
                <div className="fixed inset-0 z-10" onClick={() => setModelPickerOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-64 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl z-20 backdrop-blur overflow-hidden">
                  <div className="p-2 border-b border-red-900/30 flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wider text-white/50">AI Model</div>
                    <label className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer">
                      <input type="checkbox" checked={!!settings.failoverEnabled} onChange={() => setSettings(s => ({ ...s, failoverEnabled: !s.failoverEnabled }))} className="w-3 h-3 accent-purple-500" />
                      <Zap size={9} className="text-purple-400" />Failover
                    </label>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {Object.values(MODELS as any).map((m: any) => {
                      const hasKey = !m.needsKey || !!(settings.modelKeys || {})[m.id];
                      const isActive = activeModel === m.id;
                      const locked = (modelStatus[m.id] as any)?.lockedUntil > Date.now();
                      const rem = locked ? (modelStatus[m.id] as any).lockedUntil - Date.now() : 0;
                      return <button key={m.id} onClick={() => { if (hasKey) { setSettings(s => ({ ...s, activeModel: m.id })); setModelPickerOpen(false); } else { openSettings(); setModelPickerOpen(false); } }} className={"w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-white/5 border-b border-red-900/20 last:border-b-0 text-left " + (isActive ? "bg-red-950/30" : "")}>
                        <div className={"w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gradient-to-br " + m.color} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{m.name}</span>
                            {isActive && <CheckCircle size={10} className="text-green-400" />}
                            {locked && <Clock size={10} className="text-yellow-400" />}
                          </div>
                          <div className="text-[9px] text-white/50 truncate">{m.label}</div>
                        </div>
                        {!hasKey && <span className="text-[9px] text-yellow-400">Set up</span>}
                        {locked && <span className="text-[9px] font-mono text-yellow-300">{fmtShort(rem)}</span>}
                      </button>;
                    })}
                  </div>
                  <button onClick={() => { openSettings(); setModelPickerOpen(false); }} className="w-full p-2 border-t border-red-900/30 text-[10px] text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center gap-1"><Settings size={10} />Manage API keys</button>
                </div>
              </>}
            </div>;
          })()}

          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-white/5 text-white/70" title="Menu">
              <GripVertical size={16} />
            </button>
            {menuOpen && <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl z-20 py-1 backdrop-blur">
                <button onClick={() => { setMemoryOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2"><Bot size={11} className="text-purple-400" />Manage memory</button>
                <button onClick={() => { startRename(active); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2"><Edit size={11} />Rename chat</button>
                <button onClick={clearChat} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2"><RefreshCw size={11} />Clear messages</button>
                <div className="border-t border-red-900/30 my-1" />
                <button onClick={() => { setConfirmDelete(active?.id); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-red-900/30 text-red-400 flex items-center gap-2"><Trash2 size={11} />Delete chat</button>
                <button onClick={() => { if (confirm("Delete ALL conversations?")) deleteAllConversations(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-red-900/30 text-red-400 flex items-center gap-2"><X size={11} />Delete all chats</button>
              </div>
            </>}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {chats.length <= 1 && (
            <div className="min-h-full flex flex-col items-center justify-center p-6 max-w-2xl mx-auto">
              <div className={"p-4 rounded-2xl bg-gradient-to-br mb-5 " + cur.color}><CurIcon size={28} /></div>
              <h2 className="text-2xl font-bold mb-2">{cur.name}</h2>
              <p className="text-sm text-white/60 text-center mb-6 max-w-md">{cur.greeting}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-2xl">
                {suggestions.map((s, i) => {
                  const Icon = s.icon;
                  return <button key={i} onClick={() => send(s.prompt)} className="p-3 bg-black/40 hover:bg-red-950/20 border border-red-900/30 hover:border-red-600/40 rounded-xl text-left transition group">
                    <Icon size={14} className="text-red-400 mb-1.5 group-hover:scale-110 transition" />
                    <div className="text-xs font-medium">{s.title}</div>
                    <div className="text-[10px] text-white/40 font-mono mt-0.5">{s.prompt}</div>
                  </button>;
                })}
              </div>
            </div>
          )}
          {chats.length > 1 && (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {chats.map(m => {
                const isUser = m.role === "user";
                const isError = !isUser && typeof m.content === "string" && m.content.startsWith("⚠️");
                return (
                  <div key={m.id} className={"flex gap-3 " + (isUser ? "justify-end" : "justify-start")}>
                    {!isUser && <div className={"flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br " + (isError ? "from-red-900 to-red-950" : cur.color)}><CurIcon size={13} /></div>}
                    <div className={"flex-1 min-w-0 " + (isUser ? "max-w-[85%] md:max-w-[75%]" : "max-w-full")}>
                      <div className={"px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed inline-block " + (isUser ? "bg-gradient-to-br from-red-600 to-red-800 text-white rounded-br-sm float-right" : isError ? "bg-red-950/60 border border-red-700/50 rounded-bl-sm text-red-200" : "bg-black/50 border border-red-900/30 rounded-bl-sm text-white/90")}>
                        {isUser ? m.content : String(m.content || "").split("\n").filter(l => l.trim() !== "---").join("\n").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/^#{1,6} /gm, "").trim()}
                      </div>
                      {!isUser && (
                        <div className="flex items-center gap-1 mt-1 opacity-0 hover:opacity-100 transition">
                          <button onClick={() => { navigator.clipboard?.writeText(m.content); toast("Copied"); }} className="p-1 text-white/40 hover:text-white text-[10px]"><Copy size={10} /></button>
                        </div>
                      )}
                    </div>
                    {isUser && <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-900 flex items-center justify-center text-xs font-bold">SM</div>}
                  </div>
                );
              })}
              {loading && <div className="flex gap-3">
                <div className={"flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br " + cur.color}><CurIcon size={13} /></div>
                <div className="px-4 py-3 rounded-2xl bg-black/50 border border-red-900/30"><div className="flex gap-1">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div></div>
              </div>}
            </div>
          )}
        </div>

        {/* No-key warning banner — only when no model is usable */}
        {!(settings.modelPriority || ["claude", "openai", "gemini", "groq", "mistral"]).some(mid => {
          const m = (MODELS as any)[mid];
          if (!m) return false;
          if (m.needsKey && !(settings.modelKeys || {})[mid]) return false;
          const ms: any = (modelStatus || {})[mid];
          if (ms?.lockedUntil > Date.now()) return false;
          return true;
        }) && (
          <div className="border-t border-yellow-900/30 bg-yellow-950/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="text-xs text-yellow-300 flex items-center gap-2 min-w-0">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span className="truncate">No AI model available — add an API key in Settings → AI Models to enable Alfred (slash commands still work)</span>
            </div>
            <button onClick={openSettings} className="flex-shrink-0 text-xs text-yellow-200 bg-yellow-900/40 border border-yellow-700/40 px-3 py-1 rounded-lg hover:bg-yellow-900/60 transition whitespace-nowrap">
              Add key
            </button>
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-red-900/30 bg-black/40 backdrop-blur p-3 md:p-4">
          <div className="max-w-3xl mx-auto relative">
            {/* Slash command autocomplete */}
            {showSlash && slashFiltered.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl max-h-64 overflow-y-auto backdrop-blur">
                {slashFiltered.map(s => (
                  <button key={s.cmd} onClick={() => pickSlash(s)} className="w-full text-left px-3 py-2 hover:bg-red-950/40 flex items-center gap-3 border-b border-red-900/20 last:border-0">
                    <span className="font-mono text-xs text-red-400">{s.cmd}</span>
                    <span className="text-[10px] text-white/50">{s.desc}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 bg-black/60 border border-red-900/40 rounded-2xl p-2 focus-within:border-red-500/60 transition">
              {/* Image/receipt upload */}
              <label className="flex-shrink-0 cursor-pointer p-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 transition" title="Attach photo or receipt">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  e.target.value = "";
                  const r = new FileReader();
                  r.onload = async ev => {
                    const dataUrl = ev.target!.result as string;
                    const base64 = dataUrl.split(",")[1];
                    const mediaType = file.type || "image/jpeg";
                    // Show preview in chat
                    appendMessage({ id: uid(), role: "user", content: "📎 " + file.name + " (analyzing...)", imagePreview: dataUrl, timestamp: Date.now() });
                    setLoading(true);
                    try {
                      const res = await fetch("https://api.anthropic.com/v1/messages", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          model: "claude-sonnet-4-20250514",
                          max_tokens: 400,
                          messages: [{
                            role: "user",
                            content: [
                              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                              { type: "text", text: "You are Alfred, business assistant for Smock's Pressure Washing. Analyze this image. If it's a receipt or invoice: extract vendor name, date, total amount, and category (fuel/supplies/equipment/food/other). Format as: RECEIPT: [vendor] | [date] | $[amount] | [category]. If it's a job photo: describe what you see and whether it's before/after. If other: describe briefly." }
                            ]
                          }]
                        })
                      });
                      const data = await res.json();
                      const reply = data.content?.[0]?.text || "Could not analyze image.";
                      appendMessage({ id: uid(), role: "alfred", content: reply, timestamp: Date.now() });
                      // Auto-parse receipt and offer to create expense
                      if (reply.includes("RECEIPT:")) {
                        const parts = reply.match(/RECEIPT: (.+?) \| (.+?) \| \$?([\d.]+) \| (.+)/i);
                        if (parts) {
                          const [, vendor, date, amount, category] = parts;
                          setTimeout(() => appendMessage({ id: uid(), role: "alfred", content: "💡 Want me to log this as a business expense?\n\n" + vendor + " · $" + amount + " · " + category + "\n\nSay 'yes log it' to add to Expenses.", timestamp: Date.now() }), 500);
                        }
                      }
                    } catch (err) {
                      appendMessage({ id: uid(), role: "alfred", content: "Image analysis failed: " + err.message + ". Alfred out.", timestamp: Date.now() });
                    } finally { setLoading(false); }
                  };
                  r.readAsDataURL(file);
                }} />
                <Paperclip size={16} />
              </label>
              {/* Voice input — two modes: "dictate" lands the transcript in
                  the text box to review/edit before sending, "note" sends
                  automatically once the recording stops. Click the small
                  label to switch modes; click the mic to start/stop. */}
              <button
                onClick={() => setVoiceMode(m => m === "dictate" ? "note" : "dictate")}
                title="Switch voice input mode"
                className="text-[9px] px-1.5 py-2 text-white/30 hover:text-white/60 transition flex-shrink-0 uppercase tracking-wide"
              >
                {voiceMode === "dictate" ? "STT" : "Note"}
              </button>
              <VoiceMicButton
                mode={voiceMode}
                onTranscript={(text, autoSend) => { if (autoSend) send(text); else setInput(prev => prev + (prev ? " " : "") + text); }}
                apiKey={settings?.openAiKey || settings?.openaiKey || ""}
              />
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Message Alfred..."
                value={input}
                onChange={onInputChange}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 200) + "px"; }}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none resize-none max-h-[200px]"
              />
              <button onClick={() => send()} disabled={loading || !input.trim()} className={"p-2.5 rounded-xl transition " + (loading || !input.trim() ? "bg-white/5 text-white/30" : "bg-gradient-to-br from-red-600 to-red-800 text-white hover:scale-105")}>
                <Send size={14} />
              </button>
            </div>
            <div className="text-[10px] text-white/30 text-center mt-2">Alfred can make mistakes. Verify critical info. Shift+Enter for newline.</div>
          </div>
        </div>
      </div>

      {/* Memory drawer */}
      {memoryOpen && (() => {
        const memCats = [
          { k: "preferences", l: "Preferences", icon: "💭", color: "bg-blue-950/30 text-blue-300 border-blue-800/40" },
          { k: "business", l: "Business", icon: "💼", color: "bg-green-950/30 text-green-300 border-green-800/40" },
          { k: "facts", l: "Facts", icon: "📌", color: "bg-yellow-950/30 text-yellow-300 border-yellow-800/40" },
          { k: "goals", l: "Goals", icon: "🎯", color: "bg-red-950/30 text-red-300 border-red-800/40" },
          { k: "general", l: "General", icon: "🧠", color: "bg-white/5 text-white/60 border-white/10" }
        ];
        const catMeta = c => memCats.find(x => x.k === (c || "general")) || memCats[4];
        const filteredMem = memFilter === "all" ? memory : memory.filter(m => (m.category || "general") === memFilter);
        return <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setMemoryOpen(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-black/95 border-l border-red-900/40 z-50 flex flex-col backdrop-blur-xl">
            <div className="p-4 border-b border-red-900/30 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-900/30"><Bot size={14} className="text-purple-400" /></div>
              <div className="flex-1">
                <div className="font-semibold text-sm">Alfred Memory</div>
                <div className="text-[10px] text-white/50">{memory.length} facts · Alfred references these in every conversation</div>
              </div>
              <button onClick={() => setMemoryOpen(false)} className="p-2 rounded-lg hover:bg-white/5"><X size={14} /></button>
            </div>

            <div className="p-4 border-b border-red-900/20 space-y-2">
              <div className="flex gap-2">
                <GInput placeholder="Add a fact..." value={newMemoryText} onChange={e => setNewMemoryText(e.target.value)} onKeyDown={e => e.key === "Enter" && addMemory()} className="!text-xs !py-2" />
                <GSel value={newMemoryCat} onChange={e => setNewMemoryCat(e.target.value)} className="!text-xs !py-2 !w-32">
                  {memCats.map(c => <option key={c.k} value={c.k} className="bg-black">{c.icon} {c.l}</option>)}
                </GSel>
                <GBtn onClick={addMemory} disabled={!newMemoryText.trim()} className="!py-2"><Plus size={12} /></GBtn>
              </div>
              <div className="text-[10px] text-white/40">💡 Say "remember that..." in chat OR Alfred learns preference patterns automatically.</div>
            </div>

            {/* Category filter pills */}
            <div className="px-4 py-2 border-b border-red-900/20 flex gap-1 flex-wrap">
              <button onClick={() => setMemFilter("all")} className={"text-[10px] px-2 py-1 rounded-full border " + (memFilter === "all" ? "bg-red-900/40 border-red-500/50" : "bg-white/5 border-white/10 text-white/50")}>All ({memory.length})</button>
              {memCats.map(c => {
                const n = memory.filter(m => (m.category || "general") === c.k).length;
                if (n === 0) return null;
                return <button key={c.k} onClick={() => setMemFilter(c.k)} className={"text-[10px] px-2 py-1 rounded-full border " + (memFilter === c.k ? "bg-red-900/40 border-red-500/50 text-white" : "bg-white/5 border-white/10 text-white/50")}>{c.icon} {c.l} ({n})</button>;
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredMem.length === 0 && <div className="text-center py-10 text-xs text-white/40">
                <Bot size={28} className="mx-auto mb-3 opacity-30" />
                {memFilter === "all" ? "No memories yet. Alfred learns as you chat." : "Nothing in this category yet."}
              </div>}
              {filteredMem.map(m => {
                const meta = catMeta(m.category);
                return <div key={m.id} className="group flex items-start gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl">
                  <div className={"flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm border " + meta.color}>{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs leading-relaxed">{m.text}</div>
                    <div className="text-[9px] text-white/40 mt-1 flex items-center gap-1.5">
                      <span>{m.createdAt}</span>
                      <span>·</span>
                      <span>{meta.l.toLowerCase()}</span>
                      {m.autoLearned && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-900/40 border border-purple-700/40 text-purple-300 text-[8px]"><Zap size={6} />auto-learned</span>}
                    </div>
                  </div>
                  <button onClick={() => removeMemory(m.id)} className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition"><Trash2 size={11} /></button>
                </div>;
              })}
            </div>
            {memory.length > 0 && <div className="p-4 border-t border-red-900/30"><GBtn variant="danger" onClick={clearMemory} className="w-full !text-xs"><Trash2 size={12} className="inline mr-1.5" />Clear all memory</GBtn></div>}
          </div>
        </>;
      })()}

      {/* Delete confirmation */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete conversation?">
        <div className="space-y-3">
          <p className="text-sm text-white/70">This conversation will be permanently deleted. This can't be undone.</p>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</GBtn>
            <GBtn variant="danger" onClick={() => deleteConversation(confirmDelete)}>Delete</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== EMPLOYEES =====

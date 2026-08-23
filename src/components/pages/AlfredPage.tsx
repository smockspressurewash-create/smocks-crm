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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, withTimeout, withTimeoutRetry, reconcileCrewAfterAssign, getPollIntervalMs } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell, emailButton, logOutboundSmsToInbox, getFreshOwnerGoogleToken } from "../../lib/messaging";
import { fetchCalendarEvents, createGCalEvent, updateGCalEvent, deleteGCalEvent } from "../../lib/googleApi";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES, automationFromTemplate } from "../../lib/seed";
import { callModel, MODELS, parseRateLimitError } from "../../lib/api";
import { supabase, getStoredGoogleConnection } from "../../lib/supabase";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { useIsMobile } from "../../hooks/useIsMobile";
import { usePollGate } from "../../hooks/usePollGate";
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

// FIX 6 — `personalities` (lib/utils.ts) is an ARRAY keyed by each entry's
// `id` field ("drillsergeant"/"butler"/"quietpro"/"savage"), not by array
// position. This file used to look personalities up with plain index syntax
// ((personalities as any)[personality]) and build the switcher itself via
// Object.entries(personalities) — on an array, Object.entries yields numeric-
// string keys ("0","1","2","3"), not each entry's real id. personality state
// defaults to "drillsergeant" (App.tsx), so even the DEFAULT personality
// never matched anything looked up this way, and clicking the switcher only
// ever set personality to "0".."3", which matched even less. The single
// visible symptom was that Alfred's system prompt silently became
// "undefined" + (shared context) regardless of which personality was
// selected — the personality never actually reached the model at all.
const getPersonality = (id: string) => personalities.find(p => p.id === id) || personalities[0];

export function AlfredPage({ conversations, setConversations, activeConvId, setActiveConvId, memory = [], setMemory, personality, setPersonality, apiKey, openSettings, toast, jobs = [], setJobs, estimates = [], setEstimates, customers = [], setCustomers, employees = [], automations = [], setAutomations = () => {}, stats, setWins, goals = [], setGoals, setSettings, settings = {} as AppSettings, modelStatus = {}, setModelStatus = () => {}, onNav, onSpotlight, expenses = [], entries = [], ownerId = "" }: { conversations?: any; setConversations?: any; activeConvId?: any; setActiveConvId?: any; memory?: any; setMemory?: any; personality?: any; setPersonality?: any; apiKey?: any; openSettings?: any; toast?: any; jobs?: any; setJobs?: any; estimates?: any; setEstimates?: any; customers?: any; setCustomers?: any; employees?: any; automations?: any; setAutomations?: any; stats?: any; setWins?: any; goals?: any; setGoals?: any; setSettings?: any; settings?: AppSettings; modelStatus?: any; setModelStatus?: any; onNav?: any; onSpotlight?: (step: { page: string; type?: string; id?: string; label?: string }) => void; expenses?: any[]; entries?: any[]; ownerId?: string }) {
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState<"dictate" | "note">("dictate");
  const [loading, setLoading] = useState(false);
  // FIX 1 — mobile layout. Sidebar defaults OPEN on desktop (typical chat-app
  // layout) but CLOSED on mobile (< 768px) so it doesn't eat the whole screen;
  // toggled by the hamburger button in the chat header either way.
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile);
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

  // AUDIT FIX — the morning-briefing trigger (fires once per day 6-11am) has
  // been MOVED to App.tsx, for the exact same reason the general check-in
  // system was already relocated (see the FIX 14 comment below): this
  // component only mounts when page === "alfred", so a "proactive 6-11am
  // briefing" that lived here could only ever fire while the owner already
  // had Alfred open — never actually proactive. See App.tsx's own effect
  // (alfredBriefingDate gating, same shape as alfredCheckinDate) for the
  // real implementation; the conversation it creates lands in
  // alfredConversations and is picked up by this page's own Supabase sync
  // the next time Alfred is opened, same as check-ins.

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

  // FIX 14 — the general proactive check-in system (originally added here as
  // FIX 7) has been MOVED to App.tsx. This component only mounts when
  // page === "alfred", so a check-in effect that lived here could only ever
  // fire while the owner was already looking at Alfred — never actually
  // "proactive." App.tsx is mounted for the whole session regardless of
  // page, so it can genuinely check in unprompted; see the effect there
  // (keyed off crmUserId, same alfredCheckinDate/alfredCheckinsToday/
  // alfredLastCheckinAt gating in settings) for the real implementation.
  const [showSlash, setShowSlash] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCat, setNewMemoryCat] = useState("general");
  const [memFilter, setMemFilter] = useState("all");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // FIX 2 — Alfred conversations sync with Supabase. Previously lived in
  // App.tsx keyed off the owner's session resolving, which meant it ran (or
  // didn't) regardless of whether this page was ever opened, and was hard to
  // verify from here. Moved to this component's own mount so opening Alfred
  // is what actually triggers the fetch (and the 5s poll stops the moment
  // the user navigates away instead of running for the whole app session).
  const [alfredConvsLoaded, setAlfredConvsLoaded] = useState(false);
  const alfredConvsSaveTimerRef = useRef<any>(null);
  // BUG FIX — the "⚡ Failed over to X" footer had no once-per-conversation
  // gate, so if the top-priority model keeps failing for a non-rate-limit
  // reason (never gets locked out, so every message re-attempts it from
  // scratch), the footer re-appended to EVERY reply in the conversation —
  // reads as broken even though the actual failover logic works correctly
  // each time. Show it once per conversation id, not once per message.
  const failoverNoticeShownRef = useRef<Set<string>>(new Set());
  // FIX 2 (mobile round 3) — tracks which conversation ids we've already sent
  // at least one upsert for, so the save-effect below can tell "brand new
  // conversation" apart from "edited an existing one" and save the new one
  // immediately instead of waiting out the debounce.
  const knownConvIdsRef = useRef<Set<string>>(new Set());
  // Tracks conversations the user deleted locally so the poll merge doesn't
  // bring them back if the Supabase DELETE is still in-flight or slow.
  const deletedConvIdsRef = useRef<Set<string>>(new Set());
  // FIX 4 (mobile round 5) — once we've run the mismatch check/re-key for a
  // given ownerId, don't repeat the extra round-trips on every 5s poll —
  // once is enough; re-arm if ownerId changes (e.g. a different session).
  const mismatchCheckedRef = useRef<string | null>(null);
  // Guards the 7-day-inactivity auto-delete (below) so it only issues a
  // DELETE once per session instead of re-checking on every 5s poll.
  const staleCleanupDoneRef = useRef(false);
  const shouldPollAlfred = usePollGate();
  useEffect(() => {
    if (!ownerId) { console.warn("[Alfred Sync] no ownerId yet — skipping conversation fetch"); return; }
    const loadConversations = async () => {
      try {
        const res: any = await (supabase as any).from("alfred_conversations").select("*").eq("owner_id", ownerId).order("updated_at", { ascending: false });
        if (res.error) {
          console.warn("[Alfred Sync] fetch failed:", res.error.message, "— if this says the relation doesn't exist, run supabase/migrations/0011_owner_settings_and_alfred_schema_fixes.sql in the Supabase SQL editor");
          return;
        }
        let data: any[] = Array.isArray(res.data) ? res.data : [];

        // FIX 4 (mobile round 5) — "the auth user ID is a UUID, but the
        // conversations might be saved with a different ID format": this app
        // is single-tenant (CLAUDE.md — one owner per deployment), so if the
        // filtered query above found nothing but rows DO exist under some
        // OTHER owner_id value, they can only belong to this same owner
        // (saved under a stale scheme from an earlier build). Re-key them to
        // the current owner_id — used for the query AND every future
        // upsert — instead of just reporting the mismatch.
        if (data.length === 0 && mismatchCheckedRef.current !== ownerId) {
          mismatchCheckedRef.current = ownerId;
          try {
            const allRes: any = await (supabase as any).from("alfred_conversations").select("owner_id").limit(1000);
            const otherOwnerIds = Array.from(new Set((allRes?.data || []).map((r: any) => r.owner_id))).filter((v: any) => v != null && v !== ownerId) as string[];
            console.warn("[Alfred Sync] owner_id mismatch check — query used owner_id=" + JSON.stringify(ownerId) + " — distinct owner_id value(s) actually in the table:", otherOwnerIds.length ? otherOwnerIds : "(table is empty)");
            if (otherOwnerIds.length > 0) {
              const migrateRes: any = await (supabase as any).from("alfred_conversations").update({ owner_id: ownerId }).in("owner_id", otherOwnerIds);
              if (migrateRes?.error) {
                console.warn("[Alfred Sync] re-key to current owner_id failed:", migrateRes.error.message);
              } else {
                const retryRes: any = await (supabase as any).from("alfred_conversations").select("*").eq("owner_id", ownerId).order("updated_at", { ascending: false });
                if (Array.isArray(retryRes?.data)) data = retryRes.data;
                console.warn("[Alfred Sync] re-keyed", otherOwnerIds.length, "old owner_id value(s) to", JSON.stringify(ownerId), "— now showing", data.length, "conversation(s)");
              }
            }
          } catch (diagErr: any) {
            console.warn("[Alfred Sync] mismatch check threw:", diagErr?.message);
          }
        }
        if (data.length > 0) console.log("[Verify] Alfred conversations cross-device sync — working —", data.length, "conversation(s) loaded for owner_id=" + ownerId);
        let fromServer: AlfredConversation[] = data.map((r: any) => ({
          id: r.id, title: r.title || "Conversation", messages: Array.isArray(r.messages) ? r.messages : [],
          createdAt: r.created_at || r.createdAt || new Date().toISOString(), updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
        }));
        // FEATURE — auto-delete conversations inactive 7+ days, so the
        // alfred_conversations table (and this owner's cross-device sync
        // payload) doesn't grow unbounded. Only runs the delete once per
        // session (staleCleanupDoneRef), not on every 5s poll — the rows are
        // gone from Supabase after the first pass, so later polls simply
        // won't see them again. Filter them out of THIS pass's result too so
        // they don't flash on screen before the delete lands.
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const staleIds = fromServer.filter(c => Date.now() - new Date(c.updatedAt as any).getTime() > ONE_WEEK_MS).map(c => c.id);
        if (staleIds.length > 0) {
          fromServer = fromServer.filter(c => !staleIds.includes(c.id));
          if (!staleCleanupDoneRef.current) {
            staleCleanupDoneRef.current = true;
            (supabase as any).from("alfred_conversations").delete().eq("owner_id", ownerId).in("id", staleIds)
              .then((r: any) => {
                if (r?.error) console.warn("[Alfred Cleanup] failed to delete stale conversations:", r.error.message);
                else console.log("[Alfred Cleanup] deleted", staleIds.length, "conversation(s) inactive 7+ days");
              })
              .catch((e: any) => console.warn("[Alfred Cleanup] threw:", e?.message));
          }
        }
        // Anything the server already has is "known" — only conversations
        // created locally after this point should trigger an immediate save.
        fromServer.forEach(c => knownConvIdsRef.current.add(c.id));
        // Filter out any IDs the user deleted locally — the Supabase DELETE
        // may not have landed yet, but we never want them to reappear.
        fromServer = fromServer.filter(c => !deletedConvIdsRef.current.has(c.id));
        setConversations((prev: any[]) => {
          const byId = new Map(fromServer.map(c => [c.id, c]));
          // Keep any local conversation not yet confirmed server-side (just
          // created/edited, upsert still in flight) so it doesn't flicker away.
          const localOnly = (prev || []).filter((c: any) => !byId.has(c.id) && !deletedConvIdsRef.current.has(c.id));
          // fromServer always sets updatedAt as an ISO STRING, but local
          // conversations get created/updated with `updatedAt: Date.now()` —
          // a NUMBER. Normalize both shapes to a comparable timestamp instead
          // of assuming either one specifically (mixing them crashed
          // .localeCompare on a number before this fix existed).
          const ts = (v: unknown): number => {
            if (typeof v === "number") return v;
            if (typeof v === "string" && v) { const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; }
            return 0;
          };
          // BUG FIX — if the server row for a conversation has messages:[]
          // (upsert failed silently or messages JSONB wasn't stored), the merge
          // previously overwrote the local copy (which had real messages) with
          // the empty server version, making check-in / new chats appear blank.
          // Keep the local messages if the server copy has none.
          const merged = fromServer.map(serverConv => {
            const localConv = (prev || []).find((c: any) => c.id === serverConv.id);
            if (localConv && (!serverConv.messages?.length) && localConv.messages?.length > 0) {
              return { ...serverConv, messages: localConv.messages };
            }
            return serverConv;
          });
          return [...merged, ...localOnly].sort((a, b) => ts((b as any).updatedAt) - ts((a as any).updatedAt));
        });
        setAlfredConvsLoaded(true);
      } catch (e: any) { console.warn("[Alfred Sync] fetch threw:", e?.message); }
    };
    loadConversations();
    // EGRESS — was a hardcoded 5s regardless of the owner's configured
    // fallback-poll interval (Settings, default 120s) — alfred_conversations
    // rows can carry a full chat history each, so polling that every 5s
    // while Alfred is open was a real contributor to the egress overage.
    const interval = setInterval(() => { if (shouldPollAlfred()) loadConversations(); }, getPollIntervalMs(settings));
    return () => clearInterval(interval);
  }, [ownerId, (settings as any)?.pollIntervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE 2 (mobile round 7) — Alfred's remember_fact tool used to only
  // write to local usePersistent state, so anything the owner told Alfred to
  // remember never left the device it was said on. Mirrors the
  // alfred_conversations sync immediately above: fetch + 5s poll + upsert,
  // keyed by the same ownerId.
  const [alfredMemoryLoaded, setAlfredMemoryLoaded] = useState(false);
  const knownMemIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!ownerId) return;
    const loadMemory = async () => {
      try {
        const res: any = await (supabase as any).from("alfred_memory").select("*").eq("owner_id", ownerId).order("created_at", { ascending: true });
        if (res.error) {
          console.warn("[Alfred Memory Sync] fetch failed:", res.error.message, "— run supabase/migrations/0014_alfred_memory_table.sql in the Supabase SQL editor");
          return;
        }
        const data: any[] = Array.isArray(res.data) ? res.data : [];
        data.forEach(m => knownMemIdsRef.current.add(m.id));
        const fromServer = data.map(m => ({ id: m.id, text: m.text, category: m.category || "general", createdAt: m.created_at || today() }));
        setMemory((prev: any[]) => {
          const byId = new Map(fromServer.map(m => [m.id, m]));
          const localOnly = (prev || []).filter((m: any) => !byId.has(m.id));
          return [...fromServer, ...localOnly];
        });
        setAlfredMemoryLoaded(true);
        if (data.length > 0) console.log("[Verify] Alfred memory cross-device sync — working —", data.length, "fact(s) loaded for owner_id=" + ownerId);
      } catch (e: any) { console.warn("[Alfred Memory Sync] fetch threw:", e?.message); }
    };
    loadMemory();
    const interval = setInterval(() => { if (shouldPollAlfred()) loadMemory(); }, getPollIntervalMs(settings));
    return () => clearInterval(interval);
  }, [ownerId, (settings as any)?.pollIntervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ownerId || !alfredMemoryLoaded) return;
    (memory || []).forEach((m: any) => {
      if (!knownMemIdsRef.current.has(m.id)) {
        knownMemIdsRef.current.add(m.id);
        (supabase as any).from("alfred_memory").upsert({
          id: m.id, owner_id: ownerId, text: m.text, category: m.category || "general", created_at: m.createdAt || new Date().toISOString(),
        }, { onConflict: "id" }).then((r: any) => { if (r?.error) console.warn("[Alfred Memory Sync] save failed:", r.error.message); });
      }
    });
  }, [memory, ownerId, alfredMemoryLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG FIX — conversations get created/updated in several places (morning
  // briefing, afternoon check-in, new-chat, send()) and those sites disagree
  // on whether createdAt/updatedAt is a `Date.now()` NUMBER or a `today()`
  // "YYYY-MM-DD" STRING. Sending that straight through as created_at/
  // updated_at meant Supabase sometimes received a raw epoch-ms integer for
  // a timestamp column — the actual cause of the "date/time field value out
  // of range" console errors, not a schema problem. Normalize both to a
  // real ISO string right here, at the one place that actually talks to
  // Postgres, so it doesn't matter what shape the in-memory value is.
  const toIsoTimestamp = (v: any): string => {
    if (typeof v === "number") return new Date(v).toISOString();
    if (typeof v === "string" && v) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return new Date().toISOString();
  };
  const upsertConversation = (c: any) => {
    (supabase as any).from("alfred_conversations").upsert({
      id: c.id, owner_id: ownerId, title: c.title, messages: c.messages,
      created_at: toIsoTimestamp(c.createdAt), updated_at: toIsoTimestamp(c.updatedAt),
    }, { onConflict: "id" })
      .then((r: any) => {
        if (r?.error) console.warn("[Alfred Sync] save failed for", c.id, ":", r.error.message);
        // AUDIT FIX — the fetch side already logs "[Verify] ... working" on
        // success (see loadConversations above); the write side only ever
        // logged failures. To verify cross-device sync end-to-end: open the
        // console on device A, send a message (watch for this log), then
        // open Alfred on device B within ~2min (or wait for its poll) and
        // confirm the SAME conversation id shows up in its "[Verify] ...
        // loaded" log. SQL to check directly in Supabase SQL Editor:
        //   select id, owner_id, title, updated_at from alfred_conversations
        //   where owner_id = '<ownerId>' order by updated_at desc;
        else console.log("[Verify] Alfred conversation saved to Supabase — id:", c.id, "· owner_id:", ownerId, "· title:", c.title);
      })
      .catch((e: any) => console.warn("[Alfred Sync] save threw for", c.id, ":", e?.message));
  };

  useEffect(() => {
    if (!ownerId || !alfredConvsLoaded) return;
    // FIX 2 — save brand-new conversations immediately instead of waiting for
    // the debounce below, so a chat created right before switching devices
    // doesn't get lost to the 1.2s window never elapsing (tab closed, etc).
    (conversations || []).forEach((c: any) => {
      if (!knownConvIdsRef.current.has(c.id)) {
        knownConvIdsRef.current.add(c.id);
        upsertConversation(c);
      }
    });
    clearTimeout(alfredConvsSaveTimerRef.current);
    alfredConvsSaveTimerRef.current = setTimeout(() => {
      (conversations || []).forEach((c: any) => upsertConversation(c));
    }, 1200);
    return () => clearTimeout(alfredConvsSaveTimerRef.current);
  }, [conversations, ownerId, alfredConvsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = conversations.find(c => c.id === activeConvId) || conversations[0];
  const chats = active?.messages || [];

  // See the BUG FIX comment in send() — when send() had to create a brand
  // new conversation from scratch, it couldn't also append the user's text
  // in the same render (state hadn't committed yet), so it queues that text
  // here and this effect fires the real send() once `active` reflects the
  // just-created conversation, instead of the message silently vanishing.
  const pendingFirstSendRef = useRef<string | null>(null);
  useEffect(() => {
    if (active && pendingFirstSendRef.current) {
      const queued = pendingFirstSendRef.current;
      pendingFirstSendRef.current = null;
      send(queued);
    }
  }); // deliberately no deps — runs after every render, guarded by the ref itself

  // Auto-initialize: if no conversations exist, create one so appendMessage always has a target
  // BLOCKER 5 (mobile round 7) — this ran on mount with empty deps, BEFORE
  // the Supabase fetch above (async, keyed on ownerId) had any chance to
  // land. On a fresh browser/device with no local conversations yet (e.g.
  // opening Alfred on a phone for the first time), this fired first, created
  // a brand-new blank "New chat", and set IT active — so even once the real
  // PC conversations synced in moments later, the phone kept showing the new
  // empty chat instead of them. Looked exactly like "sync isn't working"
  // even though the synced data really was there in the (unselected) list.
  // Waiting for alfredConvsLoaded before deciding "there's really nothing
  // here" fixes that, while still working immediately if there's no owner
  // session at all (fetch will never run).
  useEffect(() => {
    if (ownerId && !alfredConvsLoaded) return;
    if (!conversations || conversations.length === 0) {
      const cid = uid();
      const greeting = getPersonality(personality)?.greeting || "Hey. What do we need to handle today? Alfred out.";
      const newConv = { id: cid, title: "New chat", personality, createdAt: today(), updatedAt: Date.now(), messages: [{ id: uid(), role: "alfred", content: greeting, timestamp: Date.now() }] };
      setConversations([newConv]);
      setActiveConvId(cid);
    }
  }, [alfredConvsLoaded, ownerId]); // eslint-disable-line

  // FIX 5 — reverses BLOCKER 19 (mobile round 9), which deliberately
  // suppressed auto-scroll when switching conversations. The explicit ask now
  // is to scroll to bottom on mount AND on every conversation switch, not
  // just for new messages arriving in the already-active thread — a stale
  // "arrived at the top" was reported for the initial open specifically, and
  // `behavior: "smooth"` animated scrolls could visibly get cut short/reset
  // by a re-render landing mid-animation (e.g. a poll-driven prop update),
  // which reads exactly like "scrolls from the top and stays there." Setting
  // scrollTop = scrollHeight directly is instant — nothing to interrupt.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chats.length, loading, active?.id]);

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
      messages: [{ id: uid(), role: "alfred", content: getPersonality(personality)?.greeting || "Hello! How can I help?", timestamp: Date.now() }]
    };
    setConversations([newConv, ...conversations]);
    setActiveConvId(cid);
    setSidebarOpen(false);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // FEATURE 2 — a locally-removed conversation must also be deleted from
  // alfred_conversations, or App.tsx's 5s cross-device sync poll treats the
  // still-present server row as authoritative and merges it right back into
  // local state (and it never disappears on any OTHER device either, since
  // no device ever told Supabase it was deleted).
  const deleteConversation = cid => {
    deletedConvIdsRef.current.add(cid);
    const remaining = conversations.filter(c => c.id !== cid);
    setConversations(remaining);
    if (cid === activeConvId) setActiveConvId(remaining[0]?.id || null);
    if (remaining.length === 0) {
      // auto-create fresh
      setTimeout(newConversation, 0);
    }
    setConfirmDelete(null);
    toast("Conversation deleted");
    if (ownerId) {
      (supabase as any).from("alfred_conversations").delete().eq("id", cid).eq("owner_id", ownerId)
        .then((r: any) => {
          if (r?.error) { console.warn("[Alfred Sync] delete failed:", r.error.message); toast?.("Deleted locally, but failed to sync deletion — " + r.error.message, "red"); }
        })
        .catch((e: any) => { console.warn("[Alfred Sync] delete threw:", e?.message); toast?.("Deleted locally, but failed to sync deletion", "red"); });
    }
  };

  const deleteAllConversations = () => {
    const ids = conversations.map(c => c.id);
    ids.forEach(id => deletedConvIdsRef.current.add(id));
    setConversations([]);
    setActiveConvId(null);
    setTimeout(newConversation, 0);
    toast("All conversations cleared");
    if (ownerId && ids.length > 0) {
      (supabase as any).from("alfred_conversations").delete().eq("owner_id", ownerId).in("id", ids)
        .then((r: any) => { if (r?.error) { console.warn("[Alfred Sync] bulk delete failed:", r.error.message); toast?.("Cleared locally, but failed to sync deletion — " + r.error.message, "red"); } })
        .catch((e: any) => { console.warn("[Alfred Sync] bulk delete threw:", e?.message); toast?.("Cleared locally, but failed to sync deletion", "red"); });
    }
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
    replaceMessages([{ id: uid(), role: "alfred", content: getPersonality(active.personality || personality)?.greeting || "Hello! How can I help?", timestamp: Date.now() }]);
    setMenuOpen(false);
    toast("Chat cleared");
  };

  const addMemory = () => {
    if (!newMemoryText.trim()) return;
    setMemory([...memory, { id: uid(), text: newMemoryText.trim(), category: newMemoryCat, createdAt: today() }]);
    setNewMemoryText("");
  };
  // FEATURE 2 (mobile round 7) — these only removed memories from local
  // state, so a deleted fact silently reappeared on the next 5s sync poll
  // (or on another device) since the row was still sitting in alfred_memory.
  const removeMemory = id => {
    setMemory(memory.filter(m => m.id !== id));
    (supabase as any).from("alfred_memory").delete().eq("id", id)
      .then((r: any) => { if (r?.error) console.warn("[Alfred Memory Sync] delete failed:", r.error.message); });
  };
  const clearMemory = () => {
    if (!confirm("Wipe all Alfred memory?")) return;
    const ids = memory.map((m: any) => m.id);
    setMemory([]);
    toast("Memory cleared");
    if (ids.length > 0) {
      (supabase as any).from("alfred_memory").delete().in("id", ids)
        .then((r: any) => { if (r?.error) console.warn("[Alfred Memory Sync] bulk delete failed:", r.error.message); });
    }
  };

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
          const offerMsg = "Hi " + matchedCustomer.firstName + "! This is Will from Crew Boss. I have a few openings coming up — which works for you?\n\n" + slotsText + "\n\nReply 1, 2, or 3 to confirm. Thanks!";
          if (settings?.twilioSid) {
            try {
              await twilioSend(settings, matchedCustomer.phone, offerMsg);
              return "📅 Scheduling: " + matchedCustomer.firstName + " " + matchedCustomer.lastName + "\n\nSent slot options to " + matchedCustomer.phone + ":\n\n" + slotsText + "\n\nWaiting for their reply. When they pick, use /schedule confirm [date] to book. Alfred out.";
            } catch (e) {
              return "Found customer but SMS failed: " + e.message + "\n\nSlot options:\n" + slotsText + "\n\nManually text: " + matchedCustomer.phone;
            }
          } else {
            window.location.href = "sms:" + matchedCustomer.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent("Hi " + matchedCustomer.firstName + "! Openings:\n" + slotsText + "\nReply 1/2/3 — " + ((settings as any)?.companyName || "Crew Boss"));
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
        return "📨 REVIEW REQUEST QUEUED\n\nCustomer: " + rc.firstName + " " + rc.lastName + "\nPhone: " + (rc.phone || "none on file") + "\nLast job: " + (lastJob.scheduledDate || "unknown") + "\n\nText will go: \"Hi " + rc.firstName + ", thanks for choosing Crew Boss! Got 30 seconds? Leave us a review: [link]. We appreciate it!\"\n\nGo to Reviews page to send. Alfred out.";
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
        const prompt = `You are Alfred, Will Crew Boss no-BS AI business and accountability coach. Will runs Crew Boss in York PA. Here's his last 7 days:\n\nBusiness: ${weekRev > 0 ? '$' + weekRev.toFixed(0) + ' revenue' : 'no completed jobs'} this week\nHealth: ${avgSleep}h sleep avg, ${avgWater}oz water avg, ${Math.round(avgSteps/1000*10)/10}k steps avg, ${gymDays}/7 gym days\nMood: ${avgMood}/5 avg\n\nWrite a SHORT (150 words max), honest, direct weekly reflection. Alfred's personality: like a drill sergeant crossed with a mentor — no fluff, real talk. Point out what's good, what needs work. End with one specific action for next week.`;
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
        const clientMsg = "Hi " + rc.firstName + "! This is Will from Crew Boss. Unfortunately we need to reschedule your " + (rjob.scheduledDate || "upcoming") + " appointment. What day works best for you? Just reply with a date and we'll confirm. Sorry for any inconvenience!";
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
  // CRITICAL — every single call funnels through this one wrapper (not
  // scattered per-case logging) so "[AlfredTool] logs for EVERY tool call"
  // is actually guaranteed rather than depending on each of the 25+ cases
  // remembering to log itself. Logs name + inputs before dispatch, then the
  // real outcome (the tool's actual return value, which for write tools IS
  // the Supabase response or an error derived from it) after.
  const executeTool = async (name, inputs) => {
    const __t0 = Date.now();
    console.log("[AlfredTool] → call:", name, "input:", inputs);
    let __result;
    try {
      __result = await executeToolCore(name, inputs);
    } catch (err: any) {
      __result = { error: err?.message || String(err) };
    }
    const __ms = Date.now() - __t0;
    if (__result && __result.error) {
      console.error("[AlfredTool] ✗ FAILED:", name, "(" + __ms + "ms) — error:", __result.error, "· full result:", __result);
    } else {
      console.log("[AlfredTool] ✓ OK:", name, "(" + __ms + "ms) — result:", __result);
    }
    return __result;
  };

  const executeToolCore = async (name, inputs) => {
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
          const c = customers.find(x => x.id === inputs.customerId || (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.name || "").trim().toLowerCase());
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
          // A retried/second "create this customer" request (e.g. the model
          // re-asking after a truncated earlier run) used to silently create
          // a second duplicate row for the same person every time, matched
          // only on exact-name in every OTHER tool's lookup — so a stray
          // duplicate would sit invisibly until it caused a wrong-record bug
          // elsewhere. Phone number is the most reliable match; fall back to
          // exact name if no phone was given.
          const dupPhone = (inputs.phone || "").replace(/\D/g, "");
          const existingCust = customers.find(x =>
            (dupPhone && (x.phone || "").replace(/\D/g, "") === dupPhone) ||
            (!dupPhone && (x.firstName + " " + x.lastName).trim().toLowerCase() === `${inputs.firstName} ${inputs.lastName}`.trim().toLowerCase())
          );
          if (existingCust) {
            toast("Alfred found an existing customer: " + existingCust.firstName + " " + existingCust.lastName);
            return { success: true, customer: existingCust, note: "This customer already existed — reused the existing record instead of creating a duplicate." };
          }
          const newC = { id: uid(), firstName: inputs.firstName, lastName: inputs.lastName, email: inputs.email || "", phone: inputs.phone || "", address: inputs.address || "", totalSpent: 0, createdAt: today(), notes: inputs.notes || "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "", owner_id: ownerId };
          // Alfred must never claim a customer was created unless the Supabase
          // write actually succeeded — local setState always "succeeds" (it's
          // just a React render), so that alone was the literal cause of
          // Alfred reporting success for customers that never existed.
          let saved: any = null;
          let saveError: any = null;
          try {
            // BLOCKER 6 (mobile round 9) — was an 8s timeout with no retry;
            // this exact wording ("save customer operation timed out") is
            // what the owner saw the tool report. 15s + one retry.
            const { data, error } = await withTimeoutRetry<any>(
              () => (supabase as any).from("customers").insert(newC).select().single(),
              15000, "Save customer"
            );
            saved = data;
            saveError = error;
          } catch (e: any) {
            saveError = e;
          }
          if (saveError || !saved) {
            return { error: "Failed to create customer — " + (saveError?.message || "Supabase write did not return a row") };
          }
          // No local setCustomers call — Supabase is the only source of truth.
          // The existing 3s cross-device sync poll (App.tsx) picks this row up
          // and merges it into local state on its own; Alfred never mutates
          // local state directly, so there's no path where the UI shows a
          // customer that doesn't actually exist in the database.
          toast("Alfred created customer: " + saved.firstName + " " + saved.lastName);
          // FEATURE — "demonstrate the action": queue a visible spotlight
          // (navigate to Customers, glow the new row, then return to this
          // chat) instead of just navigating away and staying there with no
          // visible confirmation of which row Alfred actually touched.
          if (onSpotlight) onSpotlight({ page: "customers", type: "customer", id: saved.id }); else setTimeout(() => onNav("customers"), 1200);
          return { success: true, customer: saved };
        }
        case "create_estimate": {
          const c = customers.find(x => x.id === inputs.customerId || (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.customerName || "").trim().toLowerCase());
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
          const newE = { id: uid(), customerId: c.id, lineItems: items, subtotal, discount: 0, depositRequired: 0, tax, total, status: "pending", createdAt: today(), validUntil: daysFromNow(30), viewed: false, viewedAt: null, terms: "Payment due upon completion.", notes: inputs.notes || "", owner_id: ownerId };
          let savedE: any = null;
          let saveErrorE: any = null;
          try {
            const { data, error } = await withTimeoutRetry<any>(
              () => (supabase as any).from("estimates").insert(newE).select().single(),
              15000, "Save estimate"
            );
            savedE = data;
            saveErrorE = error;
          } catch (e: any) {
            saveErrorE = e;
          }
          if (saveErrorE || !savedE) {
            return { error: "Failed to create estimate — " + (saveErrorE?.message || "Supabase write did not return a row") };
          }
          // No local setEstimates call — see create_customer above.
          toast("Alfred created estimate #" + savedE.id.toUpperCase() + " · " + fmt(total));
          if (onSpotlight) onSpotlight({ page: "estimates", type: "estimate", id: savedE.id }); else setTimeout(() => onNav("estimates"), 1200);
          return { success: true, estimateId: savedE.id, total, customer: c.firstName + " " + c.lastName };
        }
        case "send_estimate": {
          let est: any = inputs.estimateId ? estimates.find(x => x.id === inputs.estimateId) : null;
          let sc: any = est ? customers.find(x => x.id === est.customerId) : null;
          // create_estimate (above) never mutates local `estimates` state —
          // it relies on the next Supabase poll — so a same-turn chain of
          // create_estimate -> send_estimate won't find the new row in the
          // local array yet. Fetch it directly by id as a fallback.
          if (!est && inputs.estimateId) {
            try {
              const { data } = await (supabase as any).from("estimates").select("*").eq("id", inputs.estimateId).maybeSingle();
              if (data) { est = data; sc = customers.find(x => x.id === data.customerId); }
            } catch { /* fall through to not-found below */ }
          }
          if (!est) {
            const byName = customers.find(x => x.id === inputs.customerId || (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.customerName || "").trim().toLowerCase());
            if (byName) {
              sc = byName;
              est = estimates.filter(x => x.customerId === byName.id && x.status === "pending").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0] || null;
            }
          }
          if (!est) return { error: "No matching pending estimate found — create one first with create_estimate." };
          if (!sc) sc = customers.find(x => x.id === est.customerId);
          if (!sc) return { error: "Customer not found for this estimate." };
          const channel = inputs.channel || "both";
          const link = `${window.location.origin}${window.location.pathname}#/estimate/${est.id}`;
          let sentEmail = false, sentSms = false;
          const errs: string[] = [];
          if ((channel === "email" || channel === "both") && sc.email) {
            try {
              await sendEmail(settings, { to: sc.email, subject: "Your Crew Boss estimate", body: emailShell(settings,"Your Estimate", `<p>Hi ${sc.firstName}, here's your estimate for ${fmt(est.total)}.</p>` + emailButton("View & Sign Estimate", link)) });
              sentEmail = true;
            } catch (e: any) { errs.push("email: " + e.message); }
          }
          if ((channel === "sms" || channel === "both") && sc.phone) {
            try {
              const smsBody = `Hi ${sc.firstName}! Your Crew Boss estimate for ${fmt(est.total)} is ready: ${link}`;
              await twilioSend(settings, sc.phone, smsBody);
              sentSms = true;
              // Every other outbound-SMS tool in this file (text_customer,
              // reschedule notify, etc.) logs to inbox_threads so the owner
              // sees it in the Inbox from any device — this one didn't, so a
              // quote/invoice Alfred texted out never showed up anywhere.
              logOutboundSmsToInbox({ contactName: `${sc.firstName} ${sc.lastName}`, contactPhone: sc.phone, customerId: sc.id, body: smsBody }).catch(() => {});
            } catch (e: any) { errs.push("sms: " + e.message); }
          }
          if (!sentEmail && !sentSms) return { error: "Failed to send — " + (errs.join("; ") || "no email/phone on file for this customer") };
          const sentAt = today();
          (supabase as any).from("estimates").update({ sentAt, sendChannel: channel }).eq("id", est.id).catch(() => {});
          setEstimates((prev: any[]) => prev.map(x => x.id === est.id ? { ...x, sentAt, sendChannel: channel } : x));
          toast("Alfred sent the estimate to " + sc.firstName + (errs.length ? " (partial)" : ""));
          return { success: true, estimateId: est.id, customer: sc.firstName + " " + sc.lastName, sentEmail, sentSms, warnings: errs.length ? errs : undefined };
        }
        case "schedule_job": {
          console.log("[AlfredTool schedule_job] raw inputs from model:", JSON.stringify(inputs));
          // Trim before comparing — a customer with no lastName (a business/
          // HOA-style entry: firstName="Springfield HOA", lastName="") builds
          // a trailing-space string ("springfield hoa ") that a strict `===`
          // against the model's ("springfield hoa") would never match. This
          // silently fell through to "Customer not found" for exactly this
          // kind of customer name.
          const wantedName = (inputs.customerName || "").trim().toLowerCase();
          const c = customers.find(x => x.id === inputs.customerId || (x.firstName + " " + x.lastName).trim().toLowerCase() === wantedName);
          console.log("[AlfredTool schedule_job] customer lookup — searched for:", inputs.customerName || inputs.customerId, "→ found:", c ? c.id + " (" + c.firstName + " " + c.lastName + ")" : "NONE");
          if (!c) {
            const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
            console.warn("[AlfredTool schedule_job] ABORTING — no customer match. Suggestions:", suggestions);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          // The model is responsible for resolving "tomorrow"/"2pm" into
          // real YYYY-MM-DD / HH:MM values before calling this tool. If it
          // ever sends the words through literally, a `date`-typed Postgres
          // column would reject the insert (caught below) — but if
          // scheduledDate is a looser text-like column, garbage like the
          // literal string "tomorrow" would insert with NO Supabase error at
          // all, and the job would silently never show up on any real
          // calendar date. Reject obviously-invalid input up front instead
          // of trusting Supabase to catch it.
          if (inputs.date && !/^\d{4}-\d{2}-\d{2}$/.test(inputs.date)) {
            console.error("[AlfredTool schedule_job] ABORTING — date is not YYYY-MM-DD:", JSON.stringify(inputs.date));
            return { error: "Invalid date format: \"" + inputs.date + "\" — must resolve relative dates like 'tomorrow' to an actual YYYY-MM-DD value before calling this tool, then retry." };
          }
          if (inputs.time && !/^\d{1,2}:\d{2}$/.test(inputs.time)) {
            console.error("[AlfredTool schedule_job] ABORTING — time is not HH:MM:", JSON.stringify(inputs.time));
            return { error: "Invalid time format: \"" + inputs.time + "\" — must be 24h HH:MM (e.g. '14:00' for 2pm), then retry." };
          }
          // CRITICAL (per owner report) — the manual "Schedule Job" form
          // (JobsPage.tsx, its onClick submit handler) is the proven-working
          // reference. This payload is the same shape — same fields, same
          // literal defaults — including `jobType` (Alfred's payload was
          // missing it entirely; the manual form always sends it) and
          // `checklist` (manual form always sends a bare `[]`, never a
          // populated default item). Do not reintroduce any field the
          // manual form doesn't send — see CLAUDE.md's "safe column" note on
          // this exact table.
          const newJ = {
            id: uid(), customerId: c.id,
            address: inputs.address || c.address || "",
            amount: parseFloat(inputs.amount) || 0,
            status: "scheduled" as const,
            scheduledDate: inputs.date || daysFromNow(3),
            scheduledTime: inputs.time || "",
            priority: inputs.priority || "normal",
            jobType: inputs.jobType || "residential",
            notes: inputs.notes || "",
            duration: inputs.duration ? Number(inputs.duration) : undefined,
            crew: [] as any[], checklist: [] as any[], photos: [], commLog: [], chemicalsUsed: [], equipment: [], tags: [],
            loggedHours: 0, createdAt: today(), owner_id: ownerId,
            // REVERTED — organizationId was added here on the strength of a
            // one-off console log that turned out not to hold up: live
            // testing now shows the App.tsx 30s bulk jobs autosave (which
            // upserts the FULL in-memory job object, not just this insert)
            // rejecting every save afterward with "Could not find the
            // organizationId column of jobs in the schema cache" — the
            // column genuinely doesn't exist on this deployment. Once it's on
            // a job object in React state it poisons every future autosave
            // of that job, not just this insert, which the autosave's own
            // safe-column retry doesn't know to strip. Do not re-add without
            // confirming the column actually exists (see CLAUDE.md's Database
            // section on organizations/profiles being aspirational scaffolding).
          };
          console.log("[AlfredTool schedule_job] EXACT payload being sent to Supabase:", JSON.stringify(newJ, null, 2));
          // The manual form itself does setJobs() + toast IMMEDIATELY, then
          // inserts in a detached, un-awaited async IIFE — correct for a UI
          // button (nothing downstream needs its return value), but wrong
          // for a tool call: this return value IS what tells Alfred (and
          // through it, the user) whether the job was actually saved.
          // Awaiting the SAME insert call — not a different one — doesn't
          // change what Supabase does or doesn't accept, only when the code
          // notices the result, which is required so Alfred can never again
          // report success before Supabase confirmed it. Same table
          // ("jobs"), same columns, same bare (non-`.select()`) insert
          // method as the manual form.
          // ITEM 23 — "Save job timed out" persisted even after the
          // navigator-lock passthrough fix (lib/supabase.ts) for some owners,
          // which points at plain slow-network/cold-connection cases too, not
          // only the lock deadlock. A single insert with no retry meant one
          // slow round-trip failed the whole tool call outright; bumped the
          // budget 15s → 25s and added one retry attempt with a further 20s
          // of headroom before actually giving up, same as the existing
          // safe-column retry a few lines down already does for column errors.
          let insertResp: any;
          try {
            insertResp = await withTimeout<any>((supabase as any).from("jobs").insert(newJ), 25000, "Save job");
          } catch (timeoutErr: any) {
            console.warn("[AlfredTool schedule_job] first insert attempt timed out — retrying once:", timeoutErr?.message);
            insertResp = await withTimeout<any>((supabase as any).from("jobs").insert(newJ), 20000, "Save job (retry)");
          }
          // Log the ENTIRE raw response object, not just .error — status/
          // statusText/count reveal e.g. a silent 0-row write that reports
          // no `error` but also didn't actually insert anything.
          console.log("[AlfredTool schedule_job] EXACT Supabase response:", JSON.stringify({
            error: insertResp?.error ? { message: insertResp.error.message, details: insertResp.error.details, hint: insertResp.error.hint, code: insertResp.error.code } : null,
            status: insertResp?.status, statusText: insertResp?.statusText, count: insertResp?.count,
          }, null, 2));
          const jobErr = insertResp?.error;
          if (jobErr) {
            console.error("[AlfredTool schedule_job] ✗ INSERT FAILED:", jobErr.message, "code:", jobErr.code, "— retrying with core columns only");
            // Same fallback the manual form uses for this exact table: if
            // any column in the patch is unrecognized, PostgREST rejects the
            // WHOLE row — retry with a minimal, known-safe column set before
            // giving up entirely.
            const coreJob = {
              id: newJ.id, customerId: newJ.customerId, address: newJ.address, amount: newJ.amount,
              status: newJ.status, scheduledDate: newJ.scheduledDate, scheduledTime: newJ.scheduledTime,
              priority: newJ.priority, notes: newJ.notes, crew: newJ.crew, checklist: newJ.checklist,
              photos: newJ.photos, commLog: newJ.commLog, createdAt: newJ.createdAt, owner_id: newJ.owner_id,
            };
            console.log("[AlfredTool schedule_job] core-column retry payload:", JSON.stringify(coreJob, null, 2));
            const retry: any = await (supabase as any).from("jobs").insert(coreJob);
            console.log("[AlfredTool schedule_job] core-column retry EXACT response:", JSON.stringify({
              error: retry?.error ? { message: retry.error.message, details: retry.error.details, hint: retry.error.hint, code: retry.error.code } : null,
              status: retry?.status,
            }, null, 2));
            if (retry?.error) {
              console.error("[AlfredTool schedule_job] ✗ RETRY ALSO FAILED — job was NOT saved.");
              return { error: "Failed to schedule job — " + (retry.error.message || jobErr.message) };
            }
            console.log("[AlfredTool schedule_job] ✓ retry succeeded — job saved with core columns only");
          } else {
            console.log("[AlfredTool schedule_job] ✓ INSERT SUCCEEDED — no error returned from Supabase.");
          }
          // Verify the row is actually readable back — closes the gap where
          // an insert reports no error (e.g. RLS silently accepting a write
          // path but a mismatched WITH CHECK, or a trigger rewriting/
          // dropping the row) yet nothing is really there to find.
          // BUG FIX — this SELECT was the one Supabase call in the whole
          // schedule_job flow with NO withTimeout wrapper. Every insert
          // around it already had one (see ITEM 23 above) precisely because
          // a hung request here can't be told apart from a real hang — but
          // this specific await had no escape hatch, so if it (not the
          // insert) was the thing hanging, the ENTIRE tool call — and with
          // it, the whole Alfred round-trip, regardless of which AI model
          // was in use — blocked forever with no timeout, no error, no
          // failover. This is almost certainly what "all models timed out"
          // scheduling a job actually was: not a model problem at all.
          const { data: verifyRow, error: verifyErr } = await withTimeout<any>(
            (supabase as any).from("jobs").select("id, scheduledDate").eq("id", newJ.id).maybeSingle(),
            10000, "Verify job save"
          ).catch((e: any) => ({ data: null, error: e }));
          console.log("[AlfredTool schedule_job] post-insert verification SELECT — row found:", !!verifyRow, "data:", verifyRow, "error:", verifyErr?.message);
          if (!verifyRow) {
            console.error("[AlfredTool schedule_job] ✗ Insert reported no error, but the row can't be read back — something is silently dropping it (RLS, a trigger, or a check constraint).");
            return { error: "Supabase accepted the insert with no error, but the job isn't actually readable afterward — this points at an RLS or trigger issue on the jobs table, not a code bug. The job was NOT actually saved." };
          }
          setJobs(prev => [...prev, newJ as any]);
          toast("Alfred scheduled job for " + c.firstName + " on " + newJ.scheduledDate);
          if (onSpotlight) onSpotlight({ page: "jobs", type: "job", id: (newJ as any).id }); else setTimeout(() => onNav("jobs"), 1200);

          // Optional same-call crew assignment — the job itself is already
          // saved at this point, so a failure here must never be reported as
          // the whole tool call failing; it's a warning attached to an
          // otherwise-successful result. Uses the exact same fields the
          // manual form and assign_employee tool write (crew/crewAssignedAt —
          // see CLAUDE.md and assign_employee above), not anything invented.
          let assignedEmployee: string | undefined;
          let assignWarning: string | undefined;
          let assignSuggestions: string[] | undefined;
          if (inputs.employeeName) {
            const wantedEmpName = String(inputs.employeeName).trim().toLowerCase();
            const emp = employees.find((e: any) => (e.firstName + " " + e.lastName).trim().toLowerCase() === wantedEmpName);
            console.log("[AlfredTool schedule_job] employee lookup for assignment — searched for:", inputs.employeeName, "→ found:", emp ? emp.id + " (" + emp.firstName + " " + emp.lastName + ")" : "NONE");
            if (!emp) {
              assignSuggestions = suggestNames(inputs.employeeName, employees, (e: any) => `${e.firstName} ${e.lastName}`);
              assignWarning = "No employee matching \"" + inputs.employeeName + "\" was found to assign.";
              console.warn("[AlfredTool schedule_job] " + assignWarning, "suggestions:", assignSuggestions);
            } else {
              const crewAssignedAt = { [emp.id]: Date.now() };
              const { error: assignErr } = await withTimeoutRetry<any>(
                () => (supabase as any).from("jobs").update({ crew: [emp.id], crewAssignedAt }).eq("id", newJ.id),
                15000, "Assign crew"
              ).catch((e: any) => ({ error: e }));
              console.log("[AlfredTool schedule_job] crew assignment Supabase response — error:", assignErr);
              if (assignErr) {
                assignWarning = "Assigning " + emp.firstName + " failed — " + (assignErr.message || String(assignErr));
                console.error("[AlfredTool schedule_job] " + assignWarning);
              } else {
                setJobs((prev: any[]) => prev.map((x: any) => x.id === newJ.id ? { ...x, crew: [emp.id], crewAssignedAt } : x));
                assignedEmployee = emp.firstName + " " + emp.lastName;
                toast("Alfred assigned " + emp.firstName + " to the " + newJ.scheduledDate + " job");
              }
            }
          }

          // success stays true — the job itself was confirmed saved above,
          // and a failed/ambiguous ASSIGNMENT must never be reported as the
          // whole schedule_job call failing (the job really does exist).
          // assignmentSuggestions/instruction follow the exact same shape
          // the customer/employee "not found" lookups use elsewhere so the
          // model's existing NAME MATCHING rule (ask "Do you mean X?") kicks
          // in the same way here too.
          return {
            success: true, jobId: newJ.id, date: newJ.scheduledDate, customer: c.firstName + " " + c.lastName,
            ...(assignedEmployee ? { assignedEmployee } : {}),
            ...(assignWarning ? {
              assignmentWarning: assignWarning,
              ...(assignSuggestions?.length ? {
                assignmentSuggestions: assignSuggestions,
                instruction: "The job itself was scheduled successfully. Tell the user that, then separately ask 'Do you mean " + assignSuggestions.join(", or ") + "?' to assign crew — do not ask a generic follow-up question.",
              } : {}),
            } : {}),
          };
        }
        case "update_job_priority": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          const { error: prioErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update({ priority: inputs.priority }).eq("id", inputs.jobId),
            15000, "Save priority"
          ).catch((e: any) => ({ error: e }));
          console.log("[AlfredTool update_job_priority] Supabase response — error:", prioErr);
          if (prioErr) return { error: "Could not update priority — " + (prioErr.message || String(prioErr)) };
          setJobs(prev => prev.map(x => x.id === inputs.jobId ? { ...x, priority: inputs.priority } : x));
          toast("Alfred set priority to " + inputs.priority);
          return { success: true, jobId: inputs.jobId, newPriority: inputs.priority };
        }
        case "reschedule_job": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          if (!inputs.date) return { error: "date is required" };
          // CRITICAL (Alfred functionality audit) — this ONLY called
          // setJobs() (local React state) and reported success unconditionally
          // — the exact same silent no-op bug this whole audit exists to root
          // out. Nothing was ever written to Supabase, so the owner's OTHER
          // devices, and the assigned employee's own portal (which reads jobs
          // straight from Supabase), never saw the move at all. Same fix
          // pattern as assign_employee: await the real write, only report
          // success once Supabase confirms it.
          const patch: any = { scheduledDate: inputs.date, ...(inputs.time ? { scheduledTime: inputs.time } : {}) };
          const { error: reschedErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update(patch).eq("id", inputs.jobId),
            15000, "Reschedule job"
          ).catch((e: any) => ({ error: e }));
          console.log("[AlfredTool reschedule_job] Supabase response — error:", reschedErr);
          if (reschedErr) return { error: "Could not reschedule — " + (reschedErr.message || String(reschedErr)) };
          setJobs(prev => prev.map(x => x.id === inputs.jobId ? { ...x, ...patch } : x));
          toast("Alfred rescheduled job to " + inputs.date + (inputs.time ? " at " + inputs.time : ""));
          if (onSpotlight) onSpotlight({ page: "jobs", type: "job", id: inputs.jobId }); else setTimeout(() => onNav("jobs"), 1200);
          // FEATURE — "reschedule this job and text/email the customer" used
          // to require the model to independently chain reschedule_job then
          // send_reminder across two rounds, which worked only if the model
          // reliably composed that itself (never guaranteed). A built-in
          // notify option makes this one deterministic tool call instead of
          // relying on model judgment for a very common compound request —
          // the job move itself still succeeds even if the notify leg fails.
          let notifyWarning: string | undefined;
          if (inputs.notify && inputs.notify !== "none") {
            const c = customers.find(x => x.id === j.customerId);
            const msg = `Hi ${c?.firstName || ""}, your ${settings?.companyName || "service"} appointment has been moved to ${inputs.date}${inputs.time ? " at " + inputs.time : ""}. Let us know if that doesn't work!`;
            try {
              if ((inputs.notify === "sms" || inputs.notify === "both") && c?.phone && settings?.twilioSid) {
                await twilioSend(settings, c.phone, msg);
                logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
              } else if (inputs.notify === "sms" || inputs.notify === "both") {
                notifyWarning = "Job rescheduled, but couldn't text the customer — no phone on file or Twilio not configured.";
              }
              if ((inputs.notify === "email" || inputs.notify === "both") && c?.email) {
                await sendEmail(settings, { to: c.email, subject: "Your appointment has been rescheduled", body: emailShell(settings, "Rescheduled", `<p>${msg}</p>`) });
              } else if (inputs.notify === "email" || inputs.notify === "both") {
                notifyWarning = (notifyWarning ? notifyWarning + " " : "") + "Couldn't email the customer — no email on file.";
              }
            } catch (e: any) {
              notifyWarning = "Job rescheduled, but notifying the customer failed: " + (e?.message || String(e));
            }
          }
          return { success: true, jobId: inputs.jobId, newDate: inputs.date, newTime: inputs.time || j.scheduledTime, ...(notifyWarning ? { notifyWarning } : {}) };
        }
        case "cancel_job": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          // CRITICAL (Alfred functionality audit) — same bug as
          // reschedule_job above: local-only setJobs(), no Supabase write,
          // unconditional "success". Fixed the same way.
          const patch = { status: "cancelled" as const, cancelReason: inputs.reason || "" };
          const { error: cancelErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update(patch).eq("id", inputs.jobId),
            15000, "Cancel job"
          ).catch((e: any) => ({ error: e }));
          console.log("[AlfredTool cancel_job] Supabase response — error:", cancelErr);
          if (cancelErr) return { error: "Could not cancel job — " + (cancelErr.message || String(cancelErr)) };
          setJobs(prev => prev.map(x => x.id === inputs.jobId ? { ...x, ...patch } : x));
          toast("Alfred cancelled the " + (j.scheduledDate || "") + " job");
          if (onSpotlight) onSpotlight({ page: "jobs", type: "job", id: inputs.jobId }); else setTimeout(() => onNav("jobs"), 1200);
          let cancelNotifyWarning: string | undefined;
          if (inputs.notify && inputs.notify !== "none") {
            const c = customers.find(x => x.id === j.customerId);
            const msg = `Hi ${c?.firstName || ""}, your ${settings?.companyName || "service"} appointment on ${j.scheduledDate || "the scheduled date"} has been cancelled.${inputs.reason ? ` (${inputs.reason})` : ""} Reach out any time to reschedule.`;
            try {
              if ((inputs.notify === "sms" || inputs.notify === "both") && c?.phone && settings?.twilioSid) {
                await twilioSend(settings, c.phone, msg);
                logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
              } else if (inputs.notify === "sms" || inputs.notify === "both") {
                cancelNotifyWarning = "Job cancelled, but couldn't text the customer — no phone on file or Twilio not configured.";
              }
              if ((inputs.notify === "email" || inputs.notify === "both") && c?.email) {
                await sendEmail(settings, { to: c.email, subject: "Your appointment has been cancelled", body: emailShell(settings, "Cancelled", `<p>${msg}</p>`) });
              } else if (inputs.notify === "email" || inputs.notify === "both") {
                cancelNotifyWarning = (cancelNotifyWarning ? cancelNotifyWarning + " " : "") + "Couldn't email the customer — no email on file.";
              }
            } catch (e: any) {
              cancelNotifyWarning = "Job cancelled, but notifying the customer failed: " + (e?.message || String(e));
            }
          }
          return { success: true, jobId: inputs.jobId, status: "cancelled", ...(cancelNotifyWarning ? { notifyWarning: cancelNotifyWarning } : {}) };
        }
        // NEW (Alfred functionality audit) — "Show me the details for
        // [customer]'s job" had no dedicated tool; get_customer_details only
        // surfaces a thin recentJobs summary (date/amount/status), not
        // enough to actually answer a "what's going on with this job"
        // question (address, crew, checklist progress, photos, payment).
        case "get_job_details": {
          let j: any = inputs.jobId ? jobs.find(x => x.id === inputs.jobId) : null;
          let matchedCustomer: any = null;
          if (!j && inputs.customerName) {
            matchedCustomer = customers.find(x => (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.customerName || "").trim().toLowerCase());
            if (!matchedCustomer) {
              const suggestions = suggestNames(inputs.customerName, customers, x => `${x.firstName} ${x.lastName}`);
              return suggestions.length
                ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
                : { error: "Customer not found" };
            }
            const cJobs = jobs.filter(x => x.customerId === matchedCustomer.id && x.status !== "cancelled")
              .sort((a, b) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""));
            j = cJobs[0] || null;
          }
          if (!j) return { error: "Job not found — provide jobId, or a customerName with a job on file." };
          const jc = matchedCustomer || customers.find(x => x.id === j.customerId);
          const crewNames = (j.crew || []).map((id: string) => { const e = employees.find((x: any) => x.id === id); return e ? e.firstName + " " + e.lastName : id; });
          const allCk = [...(j.preChecklist || []), ...(j.duringChecklist || []), ...(j.postChecklist || []), ...(j.checklist || [])];
          return {
            jobId: j.id, customer: jc ? jc.firstName + " " + jc.lastName : "Unknown", address: j.address,
            date: j.scheduledDate, time: j.scheduledTime, status: j.status, amount: j.amount,
            priority: j.priority, notes: j.notes, crew: crewNames,
            checklist: { totalItems: allCk.length, completed: allCk.filter((i: any) => i.done).length },
            photoCount: (j.photos || []).length,
            paymentStatus: j.paymentStatus || (j.invoiced ? (j.paidAt ? "Paid" : "Invoiced, unpaid") : "Not invoiced"),
          };
        }
        // NEW (Alfred functionality audit) — "Add [item] to the checklist
        // for [job]" had no tool at all. Writes to preChecklist/
        // duringChecklist/postChecklist — the arrays the field portal
        // actually renders and lets employees check off (see
        // EmployeePortal.tsx) — NOT the legacy top-level `checklist` field,
        // which is only ever read for historical record-keeping, never shown
        // as an interactive list to employees.
        case "add_checklist_item": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          if (!inputs.item) return { error: "item text required" };
          const phase = inputs.phase === "during" ? "duringChecklist" : inputs.phase === "post" ? "postChecklist" : "preChecklist";
          const updatedList = [...((j as any)[phase] || []), { id: uid(), label: inputs.item, done: false }];
          const { error: ckErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update({ [phase]: updatedList }).eq("id", j.id),
            15000, "Save checklist item"
          ).catch((e: any) => ({ error: e }));
          console.log("[AlfredTool add_checklist_item] Supabase response — error:", ckErr);
          if (ckErr) return { error: "Could not save checklist item — " + (ckErr.message || String(ckErr)) };
          setJobs(prev => prev.map(x => x.id === j.id ? { ...x, [phase]: updatedList } : x));
          toast("Alfred added \"" + inputs.item + "\" to the checklist");
          return { success: true, jobId: j.id, phase, item: inputs.item, checklistLength: updatedList.length };
        }
        // NEW (Alfred functionality audit) — "Send an invoice to [customer]
        // for $[amount]" had no tool. Per CLAUDE.md, an invoice IS an
        // estimate row with invoiced:true — reuses the exact same table and
        // the existing send_estimate tool (which doesn't care whether a row
        // is a quote or an invoice) handles actually delivering it, so
        // "create_invoice then send_estimate" mirrors "create_estimate then
        // send_estimate" exactly.
        case "create_invoice": {
          const c = customers.find(x => x.id === inputs.customerId || (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.customerName || "").trim().toLowerCase());
          if (!c) {
            const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found. Create customer first or provide valid customerId." };
          }
          if (!inputs.amount && !(inputs.lineItems && inputs.lineItems.length)) return { error: "amount or lineItems required" };
          const items = (inputs.lineItems && inputs.lineItems.length)
            ? inputs.lineItems.map((li: any) => ({ id: uid(), description: li.description, quantity: li.quantity || 1, unitPrice: li.unitPrice || 0 }))
            : [{ id: uid(), description: inputs.description || "Service", quantity: 1, unitPrice: Number(inputs.amount) || 0 }];
          const subtotal = items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
          const tax = subtotal * ((Number(settings.taxRate) || 6) / 100);
          const total = subtotal + tax;
          const newInv = {
            id: uid(), customerId: c.id, lineItems: items, subtotal, discount: 0, depositRequired: 0, tax, total,
            status: "approved", createdAt: today(), validUntil: daysFromNow(30), viewed: false, viewedAt: null,
            terms: "Payment due upon receipt.", notes: inputs.notes || "", invoiced: true, invoicedAt: today(), owner_id: ownerId,
          };
          const { data: savedInv, error: invErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("estimates").insert(newInv).select().single(),
            15000, "Save invoice"
          ).catch((e: any) => ({ data: null, error: e }));
          console.log("[AlfredTool create_invoice] Supabase response — data:", savedInv, "error:", invErr);
          if (invErr || !savedInv) return { error: "Failed to create invoice — " + (invErr?.message || "Supabase write did not return a row") };
          toast("Alfred created invoice for " + c.firstName + " · " + fmt(total));
          if (onSpotlight) onSpotlight({ page: "invoices", type: "invoice", id: savedInv.id }); else setTimeout(() => onNav("invoices"), 1200);
          return { success: true, invoiceId: savedInv.id, total, customer: c.firstName + " " + c.lastName };
        }
        case "get_calendar_summary": {
          const from = inputs.from || today();
          const to = inputs.to || daysFromNow(7);
          const crmJobs = jobs.filter(j => j.scheduledDate >= from && j.scheduledDate <= to && j.status !== "cancelled").map(j => {
            const c = customers.find(x => x.id === j.customerId);
            return { jobId: j.id, date: j.scheduledDate, time: j.scheduledTime, customer: c ? c.firstName + " " + c.lastName : "Unknown", address: j.address, status: j.status, amount: j.amount, googleEventId: (j as any).googleEventId || null };
          }).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

          // FEATURE — "what's my availability/agenda this week" needs BOTH
          // sources cross-checked, not just CRM jobs: a job the owner never
          // synced to Google (or that sync silently failing, as it did for
          // months — see getFreshOwnerGoogleToken fix) shouldn't be invisible
          // to "what's on my calendar", and a personal/non-job Google event
          // (dentist, another business's meeting) should still show up as a
          // real time commitment even though it has no CRM job behind it.
          let googleEvents: any[] = [];
          let googleConnected = false;
          try {
            const token = await getFreshOwnerGoogleToken(settings as any);
            if (token) {
              googleConnected = true;
              const events = await fetchCalendarEvents(token);
              googleEvents = events.filter(ev => {
                const d = (ev.start || "").slice(0, 10);
                return d >= from && d <= to;
              });
            }
          } catch (e: any) { console.warn("[AlfredTool get_calendar_summary] Google Calendar fetch failed:", e?.message); }

          const jobEventIds = new Set(crmJobs.map(j => j.googleEventId).filter(Boolean));
          // A CRM job that never made it to Google (no googleEventId, or the
          // id it has doesn't actually exist in the fetched range anymore —
          // e.g. deleted directly in Google).
          const fetchedIds = new Set(googleEvents.map(ev => ev.id));
          const jobsMissingFromGoogle = crmJobs.filter(j => !j.googleEventId || !fetchedIds.has(j.googleEventId));
          // A Google event with no CRM job behind it at all — could be a real
          // personal commitment, or a job whose Calendar event was created
          // but the CRM side never got the id (e.g. the same historical sync
          // bug from the other direction).
          const googleOnlyEvents = googleEvents.filter(ev => !jobEventIds.has(ev.id)).map(ev => ({ title: ev.title, start: ev.start, end: ev.end, location: ev.location }));

          return {
            from, to, googleCalendarConnected: googleConnected,
            crmJobs, crmJobCount: crmJobs.length,
            googleOnlyEvents, googleOnlyEventCount: googleOnlyEvents.length,
            jobsNotOnGoogleCalendar: jobsMissingFromGoogle.map(j => ({ date: j.date, time: j.time, customer: j.customer })),
            note: googleConnected
              ? (googleOnlyEvents.length || jobsMissingFromGoogle.length
                  ? "There are discrepancies between the CRM and Google Calendar — report both lists to the owner by name/date, don't just give a job count."
                  : "CRM jobs and Google Calendar agree for this range.")
              : "Google Calendar isn't connected, so this is CRM jobs only — mention that if the owner asked about their real calendar.",
          };
        }
        case "delete_calendar_event": {
          const token = await getFreshOwnerGoogleToken(settings as any);
          if (!token) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
          let eventId = inputs.eventId;
          // Let the owner refer to it by title/date instead of an id they'd
          // never know — look it up in the same window get_calendar_summary
          // already searches.
          if (!eventId && inputs.title) {
            const events = await fetchCalendarEvents(token);
            const q = String(inputs.title).toLowerCase();
            const match = events.find(ev => (ev.title || "").toLowerCase().includes(q) && (!inputs.date || (ev.start || "").slice(0, 10) === inputs.date));
            if (!match) return { error: `No Google Calendar event found matching "${inputs.title}"${inputs.date ? " on " + inputs.date : ""} — call get_calendar_summary first to see what's actually there.` };
            eventId = match.id;
          }
          if (!eventId) return { error: "Need either eventId or a title to find it by." };
          try {
            await deleteGCalEvent(token, eventId);
          } catch (e: any) {
            return { error: "Google Calendar error: " + (e?.message || "delete failed") };
          }
          // If a CRM job was pointing at this event, clear the stale link.
          const linkedJob = jobs.find(j => (j as any).googleEventId === eventId);
          if (linkedJob) setJobs((prev: any[]) => prev.map(j => j.id === linkedJob.id ? { ...j, googleEventId: null } : j));
          return { success: true, deleted: true };
        }
        case "get_employee_status": {
          // FIX — this only recognized a job as "active" via the OWNER's own
          // per-job clock (job.clockInAt), which a field employee never sets
          // — they use "I'm Here" (arrivedAt) or the job simply flips to
          // status "in_progress". So a technician who had arrived and was
          // actively on a job still reported as "not on a job" here, exactly
          // like the Live Team View bug fixed earlier in Dashboard.tsx —
          // same broadened match applied here for consistency.
          const list = employees.filter((e: any) => e.status === "active").map((e: any) => {
            const activeJob = jobs.find((j: any) =>
              (j.crew || []).includes(e.id) &&
              j.status !== "completed" && j.status !== "cancelled" &&
              (j.status === "in_progress" || !!j.clockInAt || !!j.arrivedAt)
            );
            const sinceMs = activeJob ? (activeJob.clockInAt || activeJob.arrivedAt) : null;
            return {
              name: e.firstName + " " + e.lastName,
              clockedInForDay: !!e.dayClockInAt,
              onJob: activeJob ? { address: activeJob.address, elapsedMinutes: sinceMs ? Math.round((Date.now() - sinceMs) / 60000) : null } : null,
            };
          });
          return { count: list.length, employees: list };
        }
        case "assign_employee": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          const emp = employees.find(e => e.id === inputs.employeeId || (e.firstName + " " + e.lastName).trim().toLowerCase() === (inputs.employeeName || "").trim().toLowerCase());
          if (!emp) {
            const suggestions = suggestNames(inputs.employeeName || "", employees, e => `${e.firstName} ${e.lastName}`);
            return suggestions.length
              ? { error: "Employee not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Employee not found" };
          }
          const crew = j.crew || [];
          if (crew.includes(emp.id)) {
            return { success: true, jobId: j.id, employeeId: emp.id, employee: emp.firstName + " " + emp.lastName, note: "Already assigned" };
          }
          const newCrew = [...crew, emp.id];
          const crewAssignedAt = { ...(j.crewAssignedAt || {}), [emp.id]: Date.now() };
          // CRITICAL: persist to Supabase so the employee's portal (which polls
          // Supabase directly every 3s) actually sees the assignment. The old
          // code only did setJobs() locally, so Alfred's assignment never left
          // the owner's browser — the whole "Alfred can't assign crew" bug.
          const { error: assignErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update({ crew: newCrew, crewAssignedAt }).eq("id", j.id),
            15000, "Assign crew"
          ).catch((e: any) => ({ error: e }));
          if (assignErr) {
            console.error("[Alfred assign_employee] — error:", assignErr.message || assignErr);
            return { error: "Could not save the assignment — " + (assignErr.message || String(assignErr)) };
          }
          // reconcileCrewAfterAssign — `newCrew` was computed from Alfred's
          // own possibly-stale `jobs` state. If the owner directly assigned
          // someone else on the CRM (or an employee accepted a pending
          // request) for this same job moments ago, this write would
          // otherwise silently overwrite that addition instead of adding
          // alongside it.
          reconcileCrewAfterAssign(j.id, newCrew, crewAssignedAt, p =>
            (supabase as any).from("jobs").update(p).eq("id", j.id)
          ).catch(() => {});
          // Local echo so the owner UI reflects it before the next poll.
          setJobs(prev => prev.map(x => x.id === j.id ? { ...x, crew: newCrew, crewAssignedAt } : x));
          // Push onto the employee's own Google Calendar if connected — see
          // functions/api/employee-calendar-sync.ts. Fire-and-forget.
          fetch("/api/employee-calendar-sync", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId: emp.id, ownerId, jobId: j.id, action: "upsert",
              title: (() => { const c = customers.find(x => x.id === j.customerId); return (c ? c.firstName + " " + c.lastName + " — " : "") + "Pressure Washing"; })(),
              date: j.scheduledDate, time: j.scheduledTime, durationMinutes: (Number(j.duration) || 2) * 60,
              location: j.address, notes: j.notes,
            }),
          }).catch(() => {});
          if (emp.email) {
            const c = customers.find(x => x.id === j.customerId);
            const portalLink = `${window.location.origin}${window.location.pathname}#/portal`;
            const html = emailShell(settings,"Job Assignment", `<p>Hi ${emp.firstName},</p><p>You've been assigned to a job:</p><ul><li><b>Date:</b> ${j.scheduledDate}${j.scheduledTime ? " at " + j.scheduledTime : ""}</li><li><b>Address:</b> ${j.address}</li>${c ? `<li><b>Customer:</b> ${c.firstName} ${c.lastName}</li>` : ""}</ul>` + emailButton("Open Crew Portal", portalLink));
            sendEmail(settings, { to: emp.email, subject: `You've Been Assigned — ${j.scheduledDate}`, body: html }).catch(() => {});
          }
          toast("Alfred assigned " + emp.firstName + " to the " + j.scheduledDate + " job");
          return { success: true, jobId: j.id, employeeId: emp.id, employee: emp.firstName + " " + emp.lastName };
        }
        case "request_employee": {
          const j = jobs.find(x => x.id === inputs.jobId);
          if (!j) return { error: "Job not found" };
          const emp = employees.find(e => e.id === inputs.employeeId || (e.firstName + " " + e.lastName).trim().toLowerCase() === (inputs.employeeName || "").trim().toLowerCase());
          if (!emp) {
            const suggestions = suggestNames(inputs.employeeName || "", employees, e => `${e.firstName} ${e.lastName}`);
            return suggestions.length
              ? { error: "Employee not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Employee not found" };
          }
          try {
            if (!ownerId) return { error: "Still finishing sign-in — try again in a moment" };
            const { data, error } = await withTimeoutRetry<any>(
              () => (supabase as any).from("job_requests").insert({
                job_id: j.id, employee_id: emp.id, owner_id: ownerId, status: "pending", message: inputs.message || null,
              }).select("id").single(),
              15000, "Save request"
            );
            if (error || !data) return { error: "Could not save request — " + (error?.message || "run the job_requests SQL in Supabase first") };
            if (emp.email) {
              const c = customers.find(x => x.id === j.customerId);
              const reqUrl = `${window.location.origin}${window.location.pathname}#/portal?request=${data.id}`;
              const html = emailShell(settings,"Job Request", `<p>Hi ${emp.firstName},</p><p>${inputs.message || "You have a new job request:"}</p><ul><li><b>Date:</b> ${j.scheduledDate}${j.scheduledTime ? " at " + j.scheduledTime : ""}</li><li><b>Address:</b> ${j.address}</li>${c ? `<li><b>Customer:</b> ${c.firstName} ${c.lastName}</li>` : ""}</ul><div style="text-align:center;margin:22px 0 4px"><a href="${reqUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;margin-right:8px">✓ Accept Job</a><a href="${reqUrl}&action=deny" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px">✗ Decline</a></div>`);
              withTimeout(sendEmail(settings, { to: emp.email, subject: `Job Request — ${j.scheduledDate}`, body: html }), 8000, "Email send").catch((e: any) => console.warn("Alfred job request email failed — request still saved:", e?.message));
            }
            toast("Alfred sent a job request to " + emp.firstName);
            return { success: true, jobId: j.id, employeeId: emp.id, requestId: data.id, employee: emp.firstName + " " + emp.lastName };
          } catch (e: any) {
            return { error: "Request failed: " + (e?.message || String(e)) };
          }
        }
        case "send_reminder": {
          // CRITICAL (Alfred functionality audit) — this used to look up
          // ONLY by customerId (no name fallback, unlike every other tool
          // here), and its schema didn't even declare `message`/`customerName`
          // as accepted params — so "Text John and tell him X" had no real
          // way to reach this tool correctly. Worse: if the chosen channel
          // had no matching contact info (e.g. channel="sms" but the
          // customer has no phone), the whole if/else block was silently
          // skipped and it STILL reported {success:true} and toasted
          // "sent" — a genuine claims-to-but-doesn't bug, not just a missing
          // feature.
          const c = customers.find(x => x.id === inputs.customerId || (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.customerName || "").trim().toLowerCase());
          if (!c) {
            const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          const msg = inputs.message || ("Hi " + c.firstName + ", a quick reminder from Crew Boss. Reply or call (717) 555-0100.");
          const channel = inputs.channel || (c.phone ? "sms" : "email");
          if (channel === "sms") {
            if (!c.phone) return { error: "No phone on file for " + c.firstName + " — use channel: email, or add a phone number first." };
            if (!settings?.twilioSid) return { error: "Twilio isn't configured — add credentials in Settings → API Keys to send real SMS." };
            try {
              await twilioSend(settings, c.phone, msg);
              logOutboundSmsToInbox({ contactName: c.firstName + " " + c.lastName, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
            } catch (e: any) { return { error: "SMS failed: " + (e?.message || String(e)) }; }
          } else {
            if (!c.email) return { error: "No email on file for " + c.firstName + " — use channel: sms, or add an email first." };
            try {
              await sendEmail(settings, { to: c.email, subject: inputs.subject || "Message from " + (settings?.companyName || "Crew Boss"), body: emailShell(settings,"Message", `<p>${msg}</p>`) });
            } catch (e: any) { return { error: "Email failed: " + (e?.message || String(e)) }; }
          }
          toast("Alfred sent a message to " + c.firstName + " via " + channel + " ✓");
          return { success: true, sentTo: c.firstName + " " + c.lastName, channel, message: msg };
        }
        case "remember_fact": {
          if (!inputs.fact) return { error: "fact required" };
          const newMem = { id: uid(), text: inputs.fact, category: inputs.category || "general", createdAt: today() };
          setMemory(prev => [...prev, newMem]);
          toast("Alfred remembered something");
          return { success: true, remembered: inputs.fact };
        }
        case "set_followup_reminder": {
          if (!inputs.message || !inputs.dueAtIso) return { error: "message and dueAtIso required" };
          if (!(settings as any)?.myPhone) return { error: "No mobile number on file — set it in Settings → Company first." };
          const dueAt = new Date(inputs.dueAtIso);
          if (isNaN(dueAt.getTime())) return { error: "Couldn't parse dueAtIso — must be a valid ISO datetime." };
          const row = { id: uid(), owner_id: ownerId, phone: (settings as any).myPhone, message: inputs.message, due_at: dueAt.toISOString(), sent: false, created_at: new Date().toISOString() };
          const { error: remErr } = await (supabase as any).from("alfred_reminders").insert(row);
          if (remErr) return { error: "Could not save the reminder — " + remErr.message };
          toast("Alfred will text you at " + dueAt.toLocaleString());
          return { success: true, reminderId: row.id, dueAt: row.due_at };
        }
        case "list_followup_reminders": {
          const { data: remRows, error: remListErr } = await (supabase as any).from("alfred_reminders").select("id,message,due_at").eq("owner_id", ownerId).eq("sent", false).order("due_at", { ascending: true });
          if (remListErr) return { error: remListErr.message };
          if (!remRows?.length) return { success: true, reminders: [], summary: "No pending follow-ups." };
          return { success: true, reminders: remRows.map((r: any) => ({ id: r.id, message: r.message, dueAt: r.due_at })) };
        }
        case "cancel_followup_reminder": {
          if (!inputs.reminderId) return { error: "reminderId required" };
          const { error: remCancelErr } = await (supabase as any).from("alfred_reminders").delete().eq("id", inputs.reminderId).eq("owner_id", ownerId);
          if (remCancelErr) return { error: remCancelErr.message };
          return { success: true, cancelled: inputs.reminderId };
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
        case "switch_ai_model": {
          const wanted = String(inputs.provider || "").toLowerCase().trim();
          const entry = Object.values(MODELS).find((m: any) =>
            m.id === wanted || m.name.toLowerCase() === wanted || m.name.toLowerCase().includes(wanted) || wanted.includes(m.name.toLowerCase())
          ) as any;
          if (!entry) return { error: `Don't recognize "${inputs.provider}" — available providers: ${Object.values(MODELS).map((m: any) => m.name).join(", ")}.` };
          if (entry.needsKey && !(settings.modelKeys || {})[entry.id]) return { error: `${entry.name} isn't set up yet — no API key saved for it. Add one in Settings → AI Models first.` };
          const currentPriority: string[] = Array.isArray((settings as any).modelPriority) ? (settings as any).modelPriority : Object.keys(MODELS);
          const nextPriority = [entry.id, ...currentPriority.filter((k: string) => k !== entry.id)];
          setSettings((prev: any) => ({ ...prev, activeModel: entry.id, modelPriority: nextPriority }));
          toast("🔀 Switched to " + entry.name);
          return { success: true, switchedTo: entry.name };
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
        case "enable_review_request_automation": {
          const existing = automations.find((a: any) => a.id === "tpl_review_request");
          if (existing?.active) return { success: true, note: "Already on." };
          if (existing) {
            setAutomations(prev => prev.map((a: any) => a.id === "tpl_review_request" ? { ...a, active: true } : a));
          } else {
            const tpl = (AUTOMATION_TEMPLATES as any[]).find(t => t.id === "tpl_review_request");
            if (!tpl) return { error: "Template not found." };
            setAutomations(prev => [...prev, automationFromTemplate(tpl)]);
          }
          toast("📮 Turned on automatic review requests after job completion ✓");
          return { success: true };
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
          if (!inputs.to || !inputs.subject || !inputs.body) return { error: "to, subject, body required" };
          // BUG FIX — this used to (a) gate on settings.googleConnected, a
          // React-state flag that can lag behind the actual connection state
          // GoogleWorkspacePage/Settings show (getStoredGoogleConnection(),
          // written synchronously to localStorage the moment OAuth
          // completes), which is exactly why Alfred could say "not
          // connected" while Settings showed Connected; and (b) require a
          // `settings.googleBackendUrl` that this app has never had — there
          // is no separate backend server (see CLAUDE.md), so this tool
          // could never actually send for anyone, always falling into the
          // "staged" no-op branch. Route through the same sendEmail() helper
          // every other real send in this app uses (direct-from-browser
          // Gmail API call, no backend needed) and let its own connection
          // check be the single source of truth.
          try {
            await sendEmail(settings as any, { to: inputs.to, subject: inputs.subject, body: inputs.body, cc: inputs.cc });
            toast("Email sent to " + inputs.to + " ✓");
            return { success: true, sent: true, via: "gmail", to: inputs.to, subject: inputs.subject };
          } catch (e: any) {
            return { error: e?.message || "Gmail send failed" };
          }
        }
        case "create_calendar_event": {
          if (!inputs.title || !inputs.date) return { error: "title and date required" };
          // BUG FIX — this required settings.googleBackendUrl, a field this
          // app has never had (no separate backend server — see CLAUDE.md),
          // so it always fell into the "queued" no-op branch and never
          // created a real event, identical to the Gmail-send bug fixed
          // earlier. Route through the same direct-fetch Calendar API
          // (googleApi.ts) every other real Calendar call in this app uses.
          const token = await getFreshOwnerGoogleToken(settings as any);
          if (!token) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
          const startDt = inputs.date + "T" + (inputs.time || "09:00") + ":00";
          const endMin = (inputs.duration_minutes || 60);
          const endIso = new Date(new Date(startDt).getTime() + endMin * 60000).toISOString();
          try {
            const eventId = await createGCalEvent(token, {
              title: inputs.title,
              start: new Date(startDt).toISOString(),
              end: endIso,
              description: inputs.notes || "",
              location: inputs.location || "",
            });
            toast("📅 Event created in Google Calendar: " + inputs.title);
            return { success: true, eventId, title: inputs.title, start: startDt, end: endIso };
          } catch (e: any) {
            return { error: "Calendar event failed: " + (e?.message || "unknown error") };
          }
        }
        case "update_calendar_event": {
          const token = await getFreshOwnerGoogleToken(settings as any);
          if (!token) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
          let eventId = inputs.eventId;
          if (!eventId && inputs.title) {
            const events = await fetchCalendarEvents(token);
            const q = String(inputs.title).toLowerCase();
            const match = events.find(ev => (ev.title || "").toLowerCase().includes(q));
            if (!match) return { error: `No Google Calendar event found matching "${inputs.title}" — call get_calendar_summary first to see what's actually there.` };
            eventId = match.id;
          }
          if (!eventId) return { error: "Need either eventId or a title to find it by." };
          const patch: any = {};
          if (inputs.title) patch.title = inputs.title;
          if (inputs.location !== undefined) patch.location = inputs.location;
          if (inputs.notes !== undefined) patch.description = inputs.notes;
          if (inputs.date) {
            const startDt = inputs.date + "T" + (inputs.time || "09:00") + ":00";
            patch.start = new Date(startDt).toISOString();
            patch.end = new Date(new Date(startDt).getTime() + (inputs.duration_minutes || 60) * 60000).toISOString();
          }
          try {
            await updateGCalEvent(token, eventId, patch);
            toast("📅 Google Calendar event updated");
            return { success: true, eventId };
          } catch (e: any) {
            return { error: "Calendar event failed: " + (e?.message || "unknown error") };
          }
        }
        case "upload_to_drive": {
          if (!settings.googleConnected || !(settings.googleScopes || {}).drive) return { error: "Drive not connected. Ask user to go to Settings → Integrations → Google and enable Drive." };
          if (!inputs.filename) return { error: "filename required" };
          const url = settings.googleBackendUrl;
          // AUDIT G — was settings.googleToken (never populated); see the
          // create_calendar_event case above for why.
          const token = settings.googleProviderToken;
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
          // AUDIT G — was settings.googleToken (never populated); see the
          // create_calendar_event case above for why.
          const token = settings.googleProviderToken;
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
      name: "send_estimate",
      description: "Send an existing estimate/quote to its customer via email and/or SMS with a link to view and sign it. Use right after create_estimate if the user asked to 'send' or 'quote' the customer, or when asked to send an already-existing pending estimate.",
      input_schema: { type: "object", properties: { estimateId: { type: "string", description: "Optional — if omitted, sends the customer's most recent pending estimate" }, customerId: { type: "string" }, customerName: { type: "string" }, channel: { type: "string", enum: ["email", "sms", "both"] } } }
    },
    {
      name: "schedule_job",
      description: "Schedule a new job for a customer on a specific date (YYYY-MM-DD) and time (HH:MM 24h). Optionally assign one crew member in the same call via employeeName — this writes the same crew/crewAssignedAt fields assign_employee does, so a separate assign_employee call afterward is unnecessary (and would just no-op with 'Already assigned').",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, customerName: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h, e.g. '14:00' for 2pm" }, amount: { type: "number" }, address: { type: "string", description: "Defaults to the customer's address on file if omitted" }, duration: { type: "number", description: "Estimated hours" }, jobType: { type: "string", enum: ["residential", "commercial"], description: "Drives crew pay-rate overrides; defaults to residential" }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] }, notes: { type: "string" }, employeeName: { type: "string", description: "Full name like 'Luke Smith' — if provided, assigns this employee to the job immediately after it's created" } } }
    },
    {
      name: "update_job_priority",
      description: "Change the priority of an existing job.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] } }, required: ["jobId", "priority"] }
    },
    {
      name: "reschedule_job",
      description: "Move an existing job to a new date and/or time. Can optionally notify the customer in the same call — use this instead of a separate send_reminder call whenever the user asks to reschedule AND notify in one request.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM, optional" }, notify: { type: "string", enum: ["none", "sms", "email", "both"], description: "Whether to notify the customer of the new date/time. Defaults to none." } }, required: ["jobId", "date"] }
    },
    {
      name: "cancel_job",
      description: "Cancel an existing job. Can optionally notify the customer in the same call.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, reason: { type: "string" }, notify: { type: "string", enum: ["none", "sms", "email", "both"], description: "Whether to notify the customer of the cancellation. Defaults to none." } }, required: ["jobId"] }
    },
    {
      name: "get_job_details",
      description: "Get full details for one job — address, date/time, status, amount, assigned crew, checklist progress, photo count, payment status. Use for 'show me the details for [customer]'s job' style questions. If jobId isn't known yet, provide customerName and it resolves their most recent non-cancelled job.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, customerName: { type: "string", description: "Full name like 'Mike Harrison' as alternative to jobId" } } }
    },
    {
      name: "add_checklist_item",
      description: "Add an item to a job's checklist. `phase` selects which checklist: 'pre' (before starting, default), 'during' (while working), or 'post' (before leaving).",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, item: { type: "string", description: "The checklist item text" }, phase: { type: "string", enum: ["pre", "during", "post"] } }, required: ["jobId", "item"] }
    },
    {
      name: "create_invoice",
      description: "Create and save an invoice for a customer for a flat amount or itemized line items — this is a bill for completed work, due immediately (unlike create_estimate, which is a pending quote awaiting approval). After creating it, call send_estimate — pass the returned invoiceId AS send_estimate's estimateId param — to actually deliver it to the customer. Creating alone does not notify the customer.",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, customerName: { type: "string" }, amount: { type: "number", description: "Flat total if not using itemized lineItems" }, description: { type: "string", description: "Line description when using a flat amount, e.g. 'House wash'" }, lineItems: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unitPrice: { type: "number" } }, required: ["description", "unitPrice"] } }, notes: { type: "string" } } }
    },
    {
      name: "get_calendar_summary",
      description: "Get what's scheduled for a date range — use for 'what's on the calendar/my agenda/my availability today/this week' questions. Cross-checks the CRM's own job list against the REAL connected Google Calendar and reports discrepancies both directions (a job never synced to Google, or a Google event — personal or otherwise — with no matching CRM job) — always mention discrepancies if there are any, don't just report the CRM job count.",
      input_schema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD, defaults to today" }, to: { type: "string", description: "YYYY-MM-DD, defaults to 7 days from 'from'" } } }
    },
    {
      name: "delete_calendar_event",
      description: "Delete an event from the user's Google Calendar — use for 'delete/remove this from my calendar'. Identify it by eventId (from get_calendar_summary) or by title (+ optionally date) and this will look it up.",
      input_schema: { type: "object", properties: { eventId: { type: "string" }, title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD, narrows the title search" } } }
    },
    {
      name: "update_calendar_event",
      description: "Move or edit an existing Google Calendar event — use for 'move this to Friday' / 'change the time on X'. Identify it by eventId or by title, then pass only the fields that changed.",
      input_schema: { type: "object", properties: { eventId: { type: "string" }, title: { type: "string", description: "used to find the event if no eventId, or the new title if eventId is given" }, date: { type: "string", description: "YYYY-MM-DD, new date if moving it" }, time: { type: "string", description: "HH:MM 24h, new time" }, duration_minutes: { type: "number" }, location: { type: "string" }, notes: { type: "string" } } }
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
      description: "Send a real, custom text or email message to a customer via SMS or email (requires Twilio/Gmail configured in Settings). Use this for 'text/email [customer] and tell them [anything]' as well as payment/appointment reminders — pass the exact wording as `message`.",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, customerName: { type: "string", description: "Full name like 'Mike Harrison' as alternative to customerId" }, message: { type: "string", description: "The exact message body to send. If omitted, a generic reminder is sent." }, subject: { type: "string", description: "Email subject line, only used when channel is email" }, channel: { type: "string", enum: ["email", "sms"], description: "Defaults to sms if the customer has a phone on file, otherwise email" } } }
    },
    {
      name: "remember_fact",
      description: "Save an important fact to long-term memory. Use when the user shares preferences, business info, or wants something remembered. Categories: preferences, business, facts, goals.",
      input_schema: { type: "object", properties: { fact: { type: "string" }, category: { type: "string", enum: ["preferences", "business", "facts", "goals", "general"] } }, required: ["fact"] }
    },
    // FEATURE — capability parity with text-Alfred's set_reminder/
    // list_reminders/cancel_reminder: a REAL scheduled text sent to the
    // owner's own phone later, not just an in-app note. Same alfred_reminders
    // table and same check-reminders.ts cron delivers it either way — set it
    // here in a normal chat, get texted the follow-up later, from your phone
    // wherever you actually are.
    {
      name: "set_followup_reminder",
      description: "Text the owner (yourself) a follow-up/reminder at a specific future time — a REAL scheduled SMS, delivered even if this chat isn't open. Use whenever the user asks to be followed up with, nudged, checked on, or reminded about something later (e.g. 'remind me at 3 to call Mike', 'text me tonight if that job isn't done', 'follow up with me in an hour'). Resolve any relative time ('in 20 min', 'tomorrow at 9am', 'tonight') into an exact ISO datetime yourself using the current date/time before calling this. Requires the owner's mobile number set in Settings → Company.",
      input_schema: { type: "object", properties: { message: { type: "string", description: "What to text back at that time" }, dueAtIso: { type: "string", description: "Exact ISO 8601 datetime to send it" } }, required: ["message", "dueAtIso"] }
    },
    {
      name: "list_followup_reminders",
      description: "List the owner's own pending (not-yet-sent) follow-up reminders.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "cancel_followup_reminder",
      description: "Cancel a pending follow-up reminder by its id (from list_followup_reminders).",
      input_schema: { type: "object", properties: { reminderId: { type: "string" } }, required: ["reminderId"] }
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
      name: "switch_ai_model",
      description: "Switch which AI provider Alfred uses (here and over text), e.g. 'switch to Claude' / 'use Gemini instead'. Only works for a provider that already has an API key saved in Settings → AI Models.",
      input_schema: { type: "object", properties: { provider: { type: "string", description: "e.g. 'claude', 'gpt-4o', 'gemini', 'groq', 'mistral', 'kimi'" } }, required: ["provider"] }
    },
    {
      name: "enable_review_request_automation",
      description: "Turn on automatically texting customers a review-request link a couple days after their job is marked complete — a real rule-based automation (no AI/API usage on the actual sends), not something you have to remember to do yourself. Use for 'automatically ask for reviews after jobs' / 'send review requests after we finish'.",
      input_schema: { type: "object", properties: {} },
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

    // BUG FIX — "creates a new chat but says nothing": this used to create an
    // empty-messages conversation, switch to it, then return without ever
    // appending the text the user just typed — appendMessage/updateActive
    // below both operate on `active`, which is derived from conversations/
    // activeConvId state that hasn't committed yet on this same render, so
    // the message was silently dropped (only a console warning, no
    // user-visible sign anything went wrong; the user had to notice and
    // retype it). Rather than duplicating this function's ~200-line model-
    // calling/tool-use pipeline below for a "conversation already exists"
    // case, queue the text and let the effect just below re-invoke send()
    // itself (via overrideText) the moment `active` actually exists.
    if (!active) {
      const cid = uid();
      setConversations([{ id: cid, title: text.slice(0, 42) + (text.length > 42 ? "…" : ""), personality, createdAt: today(), updatedAt: Date.now(), messages: [] }]);
      setActiveConvId(cid);
      setInput("");
      setShowSlash(false);
      pendingFirstSendRef.current = text;
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
      const activePersonality = active?.personality || personality;
      console.log("[Personality] active personality for this send:", activePersonality);
      const memByCat: Record<string, string[]> = memory.reduce((acc: Record<string, string[]>, m: any) => { const k = m.category || "general"; (acc[k] = acc[k] || []).push(m.text); return acc; }, {});
      const memoryContext = memory.length > 0 ? "\n\nWhat you remember about the user (organized by category):\n" + Object.entries(memByCat).map(([k, list]) => "  [" + k + "]: " + list.join("; ")).join("\n") : "";
      const businessContext = "\n\nCurrent business snapshot:\n- Active jobs: " + stats.activeJobs + "\n- Pending quotes: " + stats.pendingEst + "\n- Revenue MTD: " + fmt(stats.totalRev) + "\n- Close rate: " + stats.closeRate + "%\n- Jobs completed this month: " + stats.doneMonth + "\n- Total customers: " + customers.length;
      // BUG FIX — this used to check only settings.googleConnected, a
      // React-state flag that can lag behind the real connection state (see
      // getStoredGoogleConnection() in lib/supabase.ts), which is why Alfred
      // could tell the user "not connected" while Settings/Workspace showed
      // Connected. send_email_via_gmail now sends directly via the same
      // browser-side Gmail API call every other real send in this app uses
      // (see its case above) — no backend URL is needed or exists.
      const storedGoogle = getStoredGoogleConnection();
      const googleActuallyConnected = !!(storedGoogle?.token || (settings.googleConnected && settings.googleProviderToken));
      const googleStatus = googleActuallyConnected
        ? `\n\nGoogle Workspace: CONNECTED as ${storedGoogle?.email || settings.googleEmail}. You CAN use send_email_via_gmail to send real email right now. create_calendar_event/create_google_task/upload_to_drive still require a configured backend URL and will stage for later if one isn't set.`
        : `\n\nGoogle Workspace: NOT CONNECTED. If the user asks to send email, create calendar events, or manage tasks, tell them to go to Settings → Integrations → Google and connect.`;
      const toolHint = `\n\nYou have tools available to READ and MODIFY the CRM. USE THEM AGGRESSIVELY — don't just describe what you would do, actually do it.\n\nASK WHEN INFO IS MISSING: using tools aggressively does NOT mean guessing or silently defaulting a value the user never gave you. If a request is missing something a tool actually needs to act correctly — which customer, which date, which employee to assign — ask one short, direct clarifying question instead of calling the tool with a made-up or silently-defaulted value (e.g. schedule_job will default an unspecified date to a few days out — do not let that fire silently; ask "what date?" first if the user didn't give one). Only skip asking when the missing piece has an obviously safe default (e.g. a walkthrough with no stated time) or a tool's own fuzzy-match/suggestions can resolve it on its own (e.g. a slightly misspelled customer name).\n\nRESPONSE STYLE: Do not narrate your reasoning, your plan, or which tool you're about to call ("Let me check...", "I'll create that now...", "First I need to..."). Just call the tool(s) silently and then give the user the final result in 1-3 short sentences. No step-by-step thinking out loud.\n\nVERIFY BEFORE CONFIRMING: every action tool returns either {"success": true, ...} or {"error": "..."}. NEVER say "Done" or "All set" without checking which one came back. If you see an "error" field, tell the user exactly what went wrong (the error text) and what they could try instead — do not pretend it worked, and do not retry silently. Only confirm success when the tool result actually contains "success": true.\n\nTASK RESULT REPORTING — NO PERSONALITY FLAIR: your personality (drill sergeant / butler / quiet pro / savage) shapes how you TALK, not whether a task result is reported straight. The moment you report the outcome of an action tool (schedule_job, create_customer, create_estimate, send_estimate, assign/request crew, etc.), drop the persona voice entirely and state the plain fact: "Job scheduled successfully" / "Failed — [exact error text]" / "Estimate sent to [name] successfully" / "Failed — [exact error text]". No jokes, no military barking, no "sir", no sarcasm on the result line itself — save the personality for ordinary conversation, small talk, and check-ins, never for whether something actually saved.\n\nKEY TOOL RULES:\n- Customer queries → USE search_customers or get_customer_details FIRST\n- Stats requests → USE get_business_stats\n- "What's on the calendar" → USE get_calendar_summary\n- "Who's clocked in / who's working" → USE get_employee_status\n- "Remember/note/don't forget" → USE remember_fact\n- Create estimates, customers, jobs → USE create_estimate/create_customer/schedule_job
- MULTI-STEP CHAINS (e.g. "create a customer, schedule them a job, and assign Mike"): call tools ONE AT A TIME across separate turns when a later step needs an id/result a real tool call hasn't returned yet (e.g. schedule_job needs the customerId create_customer just returned). Do NOT guess or fabricate an id and call multiple dependent tools in the same turn — wait for each real tool_result before issuing the next dependent call. If a step's result is an "error", STOP the chain right there, tell the user exactly which step failed and why, and do not attempt the remaining steps with made-up data.
- "Send a quote/estimate to X" → USE create_estimate (if it doesn't exist yet) THEN send_estimate in the same turn — do not just create it and stop, and do not tell the user it was "sent" unless send_estimate actually returned success\n- "Send an invoice to X for $Y" → USE create_invoice THEN send_estimate (pass the returned invoiceId as send_estimate's estimateId) — same two-step pattern as quotes. create_invoice alone does NOT notify the customer.\n- Move or cancel a job → USE reschedule_job/cancel_job\n- "Reschedule X and text/email/let them know" → USE reschedule_job's own \`notify\` param (sms/email/both) in the SAME call — do not call send_reminder separately for this, reschedule_job already handles notifying the customer of their new date.\n- "Add [item] to the checklist" → USE add_checklist_item\n- "Show me the details for X's job" → USE get_job_details\n- "Text/email X and tell them [anything]" → USE send_reminder with the exact wording as the message param — this is not just for payment reminders, use it for any custom message the user dictates\n- Navigate somewhere → USE navigate_to (the app already auto-navigates after schedule_job/create_customer/create_estimate, but call navigate_to yourself for anything else the user asks to see)\n- Preferences/facts shared → USE remember_fact automatically\n- "Remind/nudge/follow up/text me [later/at X time/in X minutes]" → USE set_followup_reminder — this is a REAL scheduled text sent to the owner's own phone, not just a note; resolve the relative time into an exact ISO datetime yourself first. USE list_followup_reminders/cancel_followup_reminder to manage existing ones.\n- RESOLVING "that job" / "the job we just scheduled" / references to something from an earlier message: a tool result's exact jobId/customerId is only visible to you within the SAME turn it was returned — your own past replies (in the chat history) are plain text, not structured data, so they do NOT reliably carry the real id forward. Before calling assign_employee/request_employee/reschedule_job/cancel_job/add_checklist_item on something referenced from an earlier turn, first call list_jobs or get_calendar_summary (or get_job_details with the customer's name) to look up the real current jobId — never guess, reuse an id from your own prior wording, or fabricate one.\n\nAUTOMATION TOOLS (VERY IMPORTANT):\n- When user describes ANY workflow, drip sequence, reminder, or "when X do Y" scenario → USE create_automation IMMEDIATELY. Build a proper n8n-style multi-step workflow with real step types: trigger (first), then delays, conditions, actions. NEVER just describe what you'd build — actually build it with create_automation.\n- "Send review request after job complete" → trigger: Job complete, delay: 2h, action: SMS review request\n- "Follow up on unpaid invoices" → trigger: Invoice unpaid 7 days, action: polite reminder email, delay: 4 days, condition: still unpaid, action: firm SMS\n- To check existing workflows → USE list_automations\n- To enable/disable a workflow → USE toggle_automation\n\nCurrent automations: ${automations.length} total, ${automations.filter(a => a.active).length} active\n\nNAME MATCHING: if a tool result comes back with "error": "Customer not found" or "Employee not found" and includes a "suggestions" array, ask the user "Do you mean [name], or [name]?" using those exact suggested names — never ask a generic clarifying question like "who do you mean?" when real candidate names are available.`;
      const systemPrompt = getPersonality(activePersonality).systemPrompt + memoryContext + businessContext + googleStatus + toolHint;
      console.log("[Personality] systemPrompt personality clause:", getPersonality(activePersonality).systemPrompt.slice(0, 80) + "…");

      // Build initial message list — allow multi-turn tool calls up to 5 rounds
      let convMessages = [...chats, userMsg].slice(-12).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      let rounds = 0;
      let finalText = "";
      const toolTraces = [];
      let modelUsed = settings.activeModel || "claude";
      const failoverChain = [];

      // FIX 20 — this used to try settings.activeModel FIRST, no matter what
      // order the owner configured in Settings → AI Models, and only fall
      // back to `priority` for everything after that — so setting Gemini
      // first in the priority list did nothing as long as activeModel was
      // still "claude" (its default). The failover chain must be the EXACT
      // order from settings.modelPriority; activeModel no longer jumps the
      // queue. Locked (rate-limited) models are excluded from the initial
      // list but will be detected mid-chain.
      const priority = settings.modelPriority || ["claude", "openai", "gemini", "groq", "mistral"];
      const now = Date.now();
      const MODELS_MAP: any = MODELS;
      // Also include any model with a valid key not in the priority list (e.g. OpenRouter, NVIDIA models)
      const extraModels = Object.keys(MODELS_MAP).filter(mid => {
        if (priority.includes(mid)) return false;
        const m = MODELS_MAP[mid];
        return m && m.needsKey && !!(settings.modelKeys || {})[mid];
      });
      const tryOrder = [...priority, ...extraModels];
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
            // BUG FIX — callModel had NO timeout at all. If a provider's API
            // just hangs (no response, no error — happens for real on flaky
            // connections or an overloaded endpoint that never actually
            // 503s), the whole request sat frozen forever with no failover
            // to the next model in the chain and no error shown — this is
            // almost certainly what "most of the time it says the request
            // timed out" actually was: not Alfred reporting a clean timeout,
            // but the UI eventually giving up after a very long hang.
            // Wrapping it in withTimeout means a hung provider now correctly
            // fails over to the next model within 25s, same as every other
            // async action in this app already does per CLAUDE.md.
            const result: any = await withTimeout<any>((callModel as any)({
              modelId: mid,
              apiKey: (settings.modelKeys || {})[mid],
              systemPrompt,
              messages: localConv,
              tools: toolsForModel,
              maxTokens: 1500
            }), 25000, MODELS_MAP[mid]?.name || mid);
            console.log("[AlfredModel] round", rounds, "model:", mid, "stopReason:", result.stopReason, "toolUses:", (result.toolUses || []).map((tu: any) => tu.name), "textPreview:", (result.text || "").slice(0, 120));
            if (result.text) localFinal = result.text;
            if (result.toolUses.length > 0 && result.stopReason === "tool_use" && toolsForModel) {
              localConv.push({ role: "assistant", content: result.raw });
              // BUG FIX — general safety net alongside the specific
              // schedule_job fix above: any one of the ~30 tools having its
              // own unguarded await (a Supabase call with no withTimeout)
              // would hang this entire round with no way out, no matter
              // which AI model triggered it. Cap each tool call individually
              // so a single bad one reports a clear timeout error back to
              // the model (which can then tell the user plainly) instead of
              // freezing the whole conversation.
              const toolResults = await Promise.all(result.toolUses.map(async tu => {
                const r = await withTimeout<any>(executeTool(tu.name, tu.input || {}), 30000, tu.name)
                  .catch((e: any) => ({ error: (e?.message || String(e)) + " — the action may or may not have actually completed; check the relevant page before retrying." }));
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
            // BUG FIX — a persistent non-rate-limit failure (a browser CORS
            // block on a provider that doesn't support direct browser calls
            // — e.g. NVIDIA's NIM API — an invalid/expired key, a
            // deprecated model) previously got no lockout at all, only
            // rate-limit errors did (above). That meant the same broken
            // model was retried from scratch on EVERY message, failing and
            // re-toasting every time — which is what made "priority order
            // ignored" and "failed over to X repeatedly" both look broken,
            // when the real issue was one specific model in the chain never
            // backing off. Give any failure a short cooldown so a broken
            // model steps aside for the rest of the chain, while still
            // retrying periodically in case it was transient.
            setModelStatus(s => ({ ...s, [mid]: { lockedUntil: Date.now() + 5 * 60000, lastError: err.message, since: Date.now() } }));
            toast((MODELS_MAP[mid]?.name || mid) + (overloaded ? " overloaded — auto-switching to next model" : " failed — trying next"), "error");
          }
          // continue to next model
        }
      }

      if (!success) {
        // Build a clear, actionable error message
        const lockedModels = Object.entries(modelStatus).filter(([_, s]) => (s as any)?.lockedUntil > Date.now());
        const allCorsBlocked = failoverChain.length > 0 && failoverChain.every(f => /failed to fetch|cors|network/i.test(f.error));

        const geminiLocked = lockedModels.some(([mid]) => mid === "gemini");
        let errorMsg;
        if (allCorsBlocked) {
          errorMsg = "All third-party AI providers blocked your browser request (CORS).\n\n💡 Fix: Use Claude (the only built-in model) — it works without a backend.\n\nThe other providers (OpenAI, Gemini, Groq, Mistral, MiniMax) need a backend proxy to work in a browser. Their API keys are stored, but the calls fail at the network layer.";
        } else if (lockedModels.length === priority.length) {
          const soonest = lockedModels.map(([_, s]) => (s as any).lockedUntil).sort()[0];
          const wait = Math.ceil((soonest - Date.now()) / 60000);
          if (geminiLocked && lockedModels.length === 1) {
            errorMsg = "Gemini's daily quota is exhausted.\n\n⏱ Resets in ~" + wait + " min (Google resets at midnight Pacific)\n\n💡 Options:\n• Wait for the quota to reset\n• Add a Claude API key (console.anthropic.com) — no quota issues\n• Add an OpenRouter key for access to many free models\n• Use slash commands (/status, /route, /rollcall) — they work without any AI key";
          } else {
            errorMsg = "All models are rate-limited.\n\n⏱ Soonest reset: ~" + wait + " min\n\n💡 Options:\n• Wait for quota to reset\n• Add a Claude API key in Settings → AI Models\n• Use slash commands (/status, /route, /rollcall) — they work without any AI key\n• Unlock a model manually in Settings → AI Models → Reset now";
          }
        } else {
          errorMsg = "Tried " + failoverChain.length + " model(s):\n" + failoverChain.map(f => "• " + (MODELS_MAP[f.model]?.name || f.model) + ": " + f.error).join("\n");
          if (geminiLocked) errorMsg += "\n\n💡 Gemini's daily quota is exhausted. Add a Claude or OpenRouter key in Settings → AI Models, or wait for Gemini to reset (midnight Pacific).";
          if (!Object.values(MODELS_MAP).some((m: any) => m.needsKey && !!(settings.modelKeys || {})[m.id])) {
            errorMsg += "\n\n💡 No API keys set. Add a Claude, Gemini, or OpenRouter key in Settings → AI Models.";
          }
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
      if (modelUsed !== (settings.activeModel || "claude") && !failoverNoticeShownRef.current.has(activeId)) {
        failoverNoticeShownRef.current.add(activeId);
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

  const cur: any = getPersonality(active?.personality || personality) || { name: "Alfred", color: "from-red-600 to-red-900", icon: Bot };
  const CurIcon = cur.icon || Bot;

  // CRASH FIX (companion to App.tsx's alfred_conversations sync) — updatedAt
  // is a number for conversations created locally (Date.now(), see
  // updateActive/appendMessage/etc. below) but a STRING for anything loaded
  // back from Supabase (App.tsx normalizes it to an ISO string). Subtracting
  // a string from a number here wouldn't crash, just silently produce NaN —
  // every comparison returns false-equal and the "recent" sort/grouping
  // quietly stops working the moment a conversation round-trips through
  // Supabase. Normalize both shapes before comparing.
  const convTs = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v) { const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; }
    return 0;
  };
  const filteredConvs = conversations
    .filter(c => !convSearch.trim() || c.title.toLowerCase().includes(convSearch.toLowerCase()) || c.messages.some(m => m.content.toLowerCase().includes(convSearch.toLowerCase())))
    .sort((a, b) => convTs(b.updatedAt) - convTs(a.updatedAt));

  // Group conversations by recency
  const groupConvs = list => {
    const now = Date.now();
    const today_ = [], week = [], older = [];
    list.forEach(c => {
      const age = (now - convTs(c.updatedAt)) / 86400000;
      if (age < 1) today_.push(c);
      else if (age < 7) week.push(c);
      else older.push(c);
    });
    return [["Today", today_], ["Previous 7 days", week], ["Older", older]].filter(([, g]) => g.length > 0);
  };
  const convGroups = groupConvs(filteredConvs);

  const relTime = ts => {
    const diff = (Date.now() - convTs(ts)) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m";
    if (diff < 86400) return Math.floor(diff / 3600) + "h";
    return Math.floor(diff / 86400) + "d";
  };

  // BLOCKER 19 (mobile round 9) — FIX 1's full-viewport portal (see git
  // history) solved a real mobile-overflow bug (the messages list scrolling
  // App.tsx's own <main> instead of itself) but did it by covering the
  // ENTIRE screen, including the main sidebar and header — "clicking Alfred
  // hides the main sidebar" was that tradeoff, not a separate bug. Rendering
  // in place (no portal) and sizing height off the viewport instead of the
  // parent's auto-sized content keeps the main chrome visible while still
  // giving this container a definite height for its own internal
  // aside/messages panes to scroll within, independent of App.tsx's <main>.
  // FIX 19 — was a hardcoded h-[calc(100dvh-150px)]/[...-160px)] guess at
  // "everything else on screen," which doesn't match App.tsx's actual
  // header/padding/mobile-bottom-nav chrome — sometimes shorter than the
  // real remaining space (dead space below), sometimes taller (forcing the
  // outer page to ALSO scroll, on top of this component's own internal
  // message-list scroll). App.tsx now gives this component's actual parent
  // chain (main → wrapper div → PageFade) a real flex height for the alfred
  // page specifically, so flex-1 here fills it exactly with no guesswork.
  return (
    <div className="relative w-full flex-1 min-h-0 flex bg-black border border-red-900/30 rounded-2xl overflow-hidden">
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
              {personalities.map((p: any) => {
                const k = p.id;
                const Icon = p.icon;
                const a = (active?.personality || personality) === k;
                return <button key={k} onClick={() => { console.log("[Personality] switched to", k); setPersonality(k); if (active) updateActive({ personality: k }); }} className={"flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition border " + (a ? "bg-gradient-to-r " + p.color + " border-red-500/50" : "bg-white/5 hover:bg-white/10 border-transparent text-white/60")}>{Icon && <Icon size={10} />}{p.name}</button>;
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
        {/* Chat header — sticky (belt-and-suspenders on top of the flex
            layout, which already pins it since it's a sibling of the
            scrollable messages div, not an ancestor of it) */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex items-center gap-1.5 md:gap-2 px-2 py-2 md:p-3 border-b border-red-900/30 bg-black/40 backdrop-blur">
          <button onClick={() => onNav && onNav("dashboard")} className="p-2 rounded-lg hover:bg-white/5 text-white/70 flex-shrink-0" title="Back to Dashboard">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-white/5 text-white/70 flex-shrink-0" title="Toggle sidebar">
            <Menu size={16} />
          </button>
          <div className={"p-1.5 rounded-lg bg-gradient-to-br flex-shrink-0 " + cur.color}><CurIcon size={12} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{active?.title || "New chat"}</div>
            <div className="text-[10px] text-white/50 truncate">Alfred · {cur.name}</div>
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
              <button onClick={() => setModelPickerOpen(!modelPickerOpen)} className={"flex items-center gap-1.5 px-2 py-1.5 md:px-2.5 rounded-lg border text-xs transition flex-shrink-0 " + (activeLocked ? "bg-yellow-950/30 border-yellow-700/50 text-yellow-300" : "bg-black/40 border-red-900/30 hover:border-red-600/50 text-white/80")}>
                <div className={"w-2 h-2 rounded-full bg-gradient-to-br " + (activeM?.color || "from-gray-500 to-gray-700")} />
                <span className="hidden md:inline">{activeM?.name || "Model"}</span>
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

          <div className="relative flex-shrink-0">
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

        {/* Messages — the ONLY scrollable area. min-h-0 is required here: a
            flex child's default min-height is "auto" (= its content size),
            which overrides flex-1 and lets it grow past the parent's bounded
            height instead of actually scrolling internally — the classic
            cause of "the whole page scrolls" in a flex chat layout. */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
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

        {/* Composer — sticky bottom, same belt-and-suspenders reasoning as the header above */}
        <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-red-900/30 bg-black/40 backdrop-blur p-3 md:p-4">
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
                              { type: "text", text: "You are Alfred, business assistant for Crew Boss. Analyze this image. If it's a receipt or invoice: extract vendor name, date, total amount, and category (fuel/supplies/equipment/food/other). Format as: RECEIPT: [vendor] | [date] | $[amount] | [category]. If it's a job photo: describe what you see and whether it's before/after. If other: describe briefly." }
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

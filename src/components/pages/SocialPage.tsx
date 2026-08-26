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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, uploadJobMedia } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, postToBuffer, fetchBufferPostAnalytics } from "../../lib/messaging";
import { postToFacebookPage } from "../../lib/socialOAuth";
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
import { AlfredScriptsPanel } from "../ui/AlfredScriptsPanel";

const SOCIAL_HASHTAGS_DEFAULT = "#pressurewashing #softwash #yorkpa #homeimprovement #curb appeal";

export function SocialPage({ posts = [], setPosts, toast, settings = {} as AppSettings, jobs = [], ownerId = "", onNav }: { posts?: any[]; setPosts?: any; toast?: any; settings?: AppSettings; jobs?: any[]; ownerId?: string; onNav?: (page: string) => void }) {
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState("scheduled");
  const initialForm = () => ({
    platforms: ["instagram"] as string[],
    type: "before_after",
    caption: "",
    publishMode: "now" as "now" | "schedule",
    scheduledFor: daysFromNow(1),
    scheduledTime: "09:00",
    hashtags: SOCIAL_HASHTAGS_DEFAULT,
    _imageData: null as any,
    _photoUrl: null as any,
    _mediaType: "image" as "image" | "video",
    _uploadingMedia: false,
  });
  const [f, setF] = useState(initialForm);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState("all");
  // FEATURE — "make the before and after photos sync up to the social
  // section." Every real before/after pair an employee actually captured
  // on a job (EmployeePortal.tsx's pairIndex-matched photos) is real,
  // ready content — this pulls them in directly instead of making the
  // owner re-upload a photo they already took.
  const [jobPhotoPickerOpen, setJobPhotoPickerOpen] = useState(false);
  const [pickingJobPhoto, setPickingJobPhoto] = useState(false);
  const jobsWithPhotoPairs = jobs
    .map((j: any) => {
      const befores = (j.photos || []).filter((p: any) => p.type === "before" && (p.url || p.dataUrl));
      const afters = (j.photos || []).filter((p: any) => p.type === "after" && (p.url || p.dataUrl));
      const count = Math.max(befores.length, afters.length);
      const pairs: { before: any; after: any }[] = [];
      for (let i = 0; i < count; i++) {
        const b = befores.find((p: any) => (p.pairIndex ?? befores.indexOf(p)) === i) || befores[i];
        const a = afters.find((p: any) => (p.pairIndex ?? afters.indexOf(p)) === i) || afters[i];
        if (b && a) pairs.push({ before: b, after: a });
      }
      return { job: j, pairs };
    })
    .filter((x: any) => x.pairs.length > 0);
  // Vision analysis needs base64; job photos are usually a Storage http(s)
  // URL (see uploadJobMedia), so fetch + convert rather than assuming a
  // dataUrl is always present.
  const toBase64 = async (src: string): Promise<{ data: string; mediaType: string } | null> => {
    try {
      if (src.startsWith("data:")) {
        const [header, b64] = src.split(",");
        return { data: b64, mediaType: /data:(.*?);base64/.exec(header)?.[1] || "image/jpeg" };
      }
      const res = await fetch(src);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve({ data: result.split(",")[1], mediaType: blob.type || "image/jpeg" });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };
  const useJobPhotoPair = async (job: any, pair: { before: any; after: any }) => {
    setPickingJobPhoto(true);
    try {
      const afterSrc = pair.after.url || pair.after.dataUrl;
      const vision = await toBase64(afterSrc);
      setF(prev => ({
        ...prev,
        _photoUrl: afterSrc,
        _mediaType: "image",
        _imageData: vision ? { data: vision.data, mediaType: vision.mediaType } : prev._imageData,
      }));
      toast?.("Before/after photo loaded — click Generate for an AI caption, or write your own ✓");
      setJobPhotoPickerOpen(false);
    } finally {
      setPickingJobPhoto(false);
    }
  };

  // Cross-page handoff from Alfred's Content Scripts panel ("Send to Social")
  // — same localStorage-handoff pattern already used elsewhere in this app
  // (App.tsx doesn't thread arbitrary nav-time state between pages), so a
  // script caption + optional before/after photo URL arrives here as JSON
  // under this key, gets consumed once, then cleared.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("smocks.socialPrefill");
      if (!raw) return;
      const prefill = JSON.parse(raw);
      localStorage.removeItem("smocks.socialPrefill");
      if (!prefill?.caption) return;
      setF(prev => ({ ...prev, caption: prefill.caption, _photoUrl: prefill.photoUrl || null }));
      setModal(true);
      toast?.("Loaded script from Alfred — review and schedule ✓");
    } catch { /* ignore malformed handoff */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — "remove posting with LinkedIn... it shows posting with
  // Nextdoor and Google Business, but that isn't even possible." Trimmed
  // down to only platforms this app can actually post to by some real,
  // working method: Buffer (once a channel's connected — see
  // bufferChannelIds), a direct Meta Graph API token (Facebook), or a
  // real device share-sheet/clipboard-paste fallback (Instagram/TikTok
  // both have a working app-open flow below). Nextdoor and Google Business
  // Profile had neither a Buffer channel type nor any direct API wired up
  // anywhere in this app — every "post" to them silently fell through to a
  // generic Web Share call that doesn't actually reach either platform, so
  // listing them as postable was misleading. LinkedIn is removed per
  // explicit request (its OAuth connect flow in Settings → Integrations →
  // Social is removed too).
  const platformMeta = {
    instagram: { color: "from-pink-600 to-purple-700", icon: "📸", limit: 2200, label: "Instagram" },
    facebook: { color: "from-blue-600 to-blue-800", icon: "👥", limit: 63206, label: "Facebook" },
    tiktok: { color: "from-black to-neutral-900", icon: "🎵", limit: 2200, label: "TikTok" },
  };

  // Personalization — mirrors the {{token}} pattern used for SMS/email merge
  // fields elsewhere (see useScheduledCampaigns.ts's `merge`), so a caption
  // template never leaves a literal placeholder for the owner to hand-edit.
  const mergeCaption = (text: string) => (text || "")
    .replace(/\{\{company_name\}\}/g, settings.companyName || "Crew Boss")
    .replace(/\{\{company_phone\}\}/g, settings.companyPhone || "(717) 555-0100");

  const captionTemplates = [
    { type: "before_after", captions: [
      "Before vs. After 😍\n\nYears of algae, grime, and weathering — gone in one afternoon. Our soft wash system is gentle on your home and devastating on buildup.\n\n📍 York, PA | 📞 {{company_phone}} | Free estimates →",
      "The transformation is real ✨\n\nThis customer had NO idea how good their home could look. Soft wash + surface clean = curb appeal on steroids.\n\nDM us to book before the season fills up! 🔥",
      "Can you believe this is the same driveway? 🤯\n\nPressure washing + sealer = looking brand new. We serve all of York County.\n\nTag a neighbor who needs this! 👇"
    ]},
    { type: "promo", captions: [
      "🌸 SPRING SPECIAL — 15% off house soft washes this month only!\n\nSpots are filling fast. Don't wait until the moss wins.\n\nCall or DM {{company_name}} to book. York, PA & surrounding areas.",
      "LIMITED TIME: Book any job over $400 and get your driveway done at 50% off.\n\nWe have openings this week. First come, first served.\n\n📲 {{company_phone}}"
    ]},
    { type: "testimonial", captions: [
      "⭐⭐⭐⭐⭐ \"Couldn't believe the difference. Looked brand new. Worth every penny!\" — Jennifer W.\n\nReviews like this make the early mornings worth it. 🙏\n\n#CustomerLove #5Stars #PressureWashing",
      "We don't just clean houses — we restore them. 🏠✨\n\nThank you to all our amazing {{company_name}} customers for the 5-star love. We work hard to earn every review."
    ]}
  ];

  const generate = async () => {
    setGenerating(true);
    const companyName = settings.companyName || "Crew Boss";
    const companyPhone = settings.companyPhone || "(717) 555-0100";
    const typeDesc = { before_after: "a before/after transformation post", promo: "a promotional offer post", testimonial: "a customer testimonial/review post", tip: "a helpful pressure washing tip", team: "a team/culture/behind-the-scenes post" }[f.type] || "a social media post";
    try {
      // If there's an uploaded image and it's a before_after, use vision analysis
      const imageData = f._imageData;
      let messageContent;
      if (imageData && f.type === "before_after") {
        messageContent = [
          { type: "image", source: { type: "base64", media_type: imageData.mediaType, data: imageData.data } },
          { type: "text", text: `You are writing a social media caption for ${companyName} in York, PA. Analyze this before/after or transformation photo and write a compelling ${f.platforms[0] || "instagram"} caption. Make it engaging, real, and slightly casual. Include a call to action (DM or call ${companyPhone}). Keep it under 150 words. Use natural line breaks.` }
        ];
      } else {
        messageContent = `Write ${typeDesc} for ${companyName} in York, PA. Write one caption only — no alternatives, no intro text. Make it engaging, real, and slightly casual. Include a call to action (mention calling ${companyPhone} if relevant). Keep it under 150 words. Use natural line breaks for readability. Don't use quotation marks around the whole thing. Platform: ${f.platforms[0] || "instagram"}.`;
      }
      const modelId = settings.activeModel || "claude";
      const apiKey = (settings.modelKeys || {})[modelId] || (modelId === "claude" ? settings.anthropicKey : undefined);
      const res = await callModel({ modelId, apiKey, messages: [{ role: "user", content: messageContent }], maxTokens: 300 });
      const text = res.text?.trim();
      if (text) { setF(prev => ({ ...prev, caption: text })); toast(imageData ? "Caption generated from your photo ✓" : "Caption generated ✓"); }
      else throw new Error("No content");
    } catch {
      // Fallback to template
      const templates = captionTemplates.find(t => t.type === f.type)?.captions || captionTemplates[0].captions;
      setF(prev => ({ ...prev, caption: mergeCaption(templates[Math.floor(Math.random() * templates.length)]) }));
      toast("Caption generated (offline template)");
    } finally {
      setGenerating(false);
    }
  };

  // Fires the actual send for one platform: Buffer first (also handles real
  // scheduling via dueAt when scheduledAt is passed), then a direct platform
  // token (Facebook/LinkedIn), then Instagram/TikTok app bridges, then a
  // generic Web Share/clipboard fallback so every platform — not just
  // Instagram/TikTok — gets a real action instead of a no-op "Published" toast.
  const publishOnePlatform = async (platform: string, caption: string, scheduledAt?: Date, mediaUrl?: string | null, mediaType?: "image" | "video"): Promise<{ bufferPostId?: string; method: string }> => {
    if (settings.bufferApiKey && settings.bufferChannelIds?.[platform]) {
      const bufferPostId = await postToBuffer(settings, platform, caption, scheduledAt, mediaUrl || undefined, mediaType);
      toast(`${scheduledAt ? "Scheduled" : "Posted"} to ${platformMeta[platform]?.label || platform} via Buffer ✓`, "green");
      return { bufferPostId: bufferPostId || undefined, method: "buffer" };
    }
    if (scheduledAt) {
      // No Buffer channel connected for this platform — nothing can actually
      // hold a future publish time on its own, so this becomes a local
      // reminder the owner fires manually from the Scheduled tab.
      toast(`No Buffer channel connected for ${platformMeta[platform]?.label || platform} — saved as a reminder, publish it manually when it's time`, "yellow");
      return { method: "local-reminder" };
    }
    if (platform === "facebook" && (settings as any).metaAccessToken && (settings as any).metaPageId) {
      await postToFacebookPage((settings as any).metaAccessToken, (settings as any).metaPageId, caption);
      toast("Posted to Facebook ✓", "green");
      return { method: "meta" };
    }
    if (platform === "instagram" && settings.instaBridge) {
      navigator.clipboard?.writeText(caption).catch(() => {});
      window.location.href = "instagram://library?AssetPath=";
      setTimeout(() => window.open("https://www.instagram.com/", "_blank"), 1500);
      toast("Caption copied! Instagram opening — paste and post 📸");
      return { method: "manual" };
    }
    if (platform === "tiktok") {
      navigator.clipboard?.writeText(caption).catch(() => {});
      window.open("tiktok://", "_blank");
      setTimeout(() => window.open("https://www.tiktok.com/upload", "_blank"), 1500);
      toast("Caption copied! TikTok opening — paste and upload 🎵");
      return { method: "manual" };
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: settings.companyName || "Crew Boss", text: caption, url: "https://smocks.com" });
        toast(`Share sheet opened for ${platformMeta[platform]?.label || platform} ✓`);
        return { method: "manual" };
      } catch { /* cancelled — still copy below so the owner has the caption */ }
    }
    navigator.clipboard?.writeText(caption).catch(() => {});
    toast(`Caption copied! Open ${platformMeta[platform]?.label || platform} and paste 📋`);
    return { method: "manual" };
  };

  // New Post now supports Publish Now (fires publishOnePlatform immediately)
  // and Schedule Post (real date + time, wired through as Buffer's dueAt when
  // a channel is connected) — and multi-selecting platforms fires the whole
  // flow once per selected platform/channel.
  const submitPost = async () => {
    if (!f.caption.trim()) { toast("Write a caption first", "red"); return; }
    if (f.platforms.length === 0) { toast("Pick at least one platform", "red"); return; }
    setSubmitting(true);
    const fullCaption = f.caption + "\n\n" + f.hashtags;
    const isSchedule = f.publishMode === "schedule";
    const scheduledAt = isSchedule && f.scheduledFor ? new Date(`${f.scheduledFor}T${f.scheduledTime || "09:00"}:00`) : undefined;
    const created: any[] = [];
    let anyFailed = false;
    for (const platform of f.platforms) {
      try {
        const result = await publishOnePlatform(platform, fullCaption, scheduledAt, f._photoUrl, (f as any)._mediaType || "image");
        created.push({
          id: uid(), platform, type: f.type, caption: fullCaption, hashtags: f.hashtags, _imageData: f._imageData,
          mediaUrl: f._photoUrl || undefined, mediaType: (f as any)._mediaType || undefined,
          status: isSchedule ? "scheduled" : "published",
          scheduledFor: isSchedule ? f.scheduledFor : undefined,
          scheduledTime: isSchedule ? f.scheduledTime : undefined,
          publishedAt: isSchedule ? undefined : today(),
          likes: 0, shares: 0, comments: 0, reach: 0,
          bufferPostId: result.bufferPostId, postMethod: result.method
        });
      } catch (e: any) {
        anyFailed = true;
        toast(`Failed to post to ${platformMeta[platform]?.label || platform}: ${e?.message || "unknown error"}`, "red");
      }
    }
    if (created.length > 0) {
      setPosts((prev: any[]) => [...created, ...prev]);
      toast(
        `${isSchedule ? "Scheduled" : "Published"} for ${created.length} platform${created.length > 1 ? "s" : ""} ✓`,
        anyFailed ? "yellow" : "green"
      );
      setModal(false);
      setF(initialForm());
    }
    setSubmitting(false);
  };

  // Manual "Publish Now" on an already-scheduled card — only relevant for
  // posts that couldn't be handed to Buffer (see local-reminder above); a
  // post actually scheduled via Buffer publishes itself automatically.
  const publishScheduled = async (id: string) => {
    const post = posts.find((p: any) => p.id === id);
    if (!post) return;
    try {
      const result = await publishOnePlatform(post.platform, post.caption, undefined);
      setPosts((prev: any[]) => prev.map(p => p.id === id ? { ...p, status: "published", publishedAt: today(), bufferPostId: result.bufferPostId || p.bufferPostId, postMethod: result.method } : p));
    } catch (e: any) {
      toast(e?.message || "Publish failed", "red");
    }
  };

  const del = (id: string) => { if (confirm("Delete post?")) setPosts(posts.filter((p: any) => p.id !== id)); };

  // Real analytics refresh — only works for posts that actually went through
  // Buffer (bufferPostId set at post time). Buffer's Post.metrics is
  // populated by the destination network after the fact, so this is a
  // pull-on-demand action, not something we can compute locally.
  const refreshAnalytics = async (post: any) => {
    if (!post.bufferPostId || !settings.bufferApiKey) return;
    setRefreshingId(post.id);
    try {
      const data = await fetchBufferPostAnalytics(settings.bufferApiKey, post.bufferPostId);
      if (!data) { toast("Buffer has no analytics for this post yet", "yellow"); return; }
      const metricValue = (types: string[]) => {
        for (const t of types) {
          const m = data.metrics.find(x => x.type === t);
          if (m) return m.value;
        }
        return undefined;
      };
      setPosts((prev: any[]) => prev.map(x => x.id === post.id ? {
        ...x,
        likes: metricValue(["reactions", "likes"]) ?? x.likes,
        reach: metricValue(["reach", "impressions"]) ?? x.reach,
        comments: metricValue(["comments"]) ?? x.comments,
        shares: metricValue(["reposts", "shares"]) ?? x.shares,
        externalLink: data.externalLink || x.externalLink,
        metricsUpdatedAt: data.metricsUpdatedAt
      } : x));
      toast("Analytics refreshed from Buffer ✓", "green");
    } catch (e: any) {
      toast(e?.message || "Could not fetch analytics from Buffer", "red");
    } finally {
      setRefreshingId(null);
    }
  };

  const togglePlatform = (k: string) => setF(prev => ({
    ...prev,
    platforms: prev.platforms.includes(k) ? prev.platforms.filter(p => p !== k) : [...prev.platforms, k]
  }));

  const allScheduled = posts.filter((p: any) => p.status === "scheduled");
  const allPublished = posts.filter((p: any) => p.status === "published");
  const scheduled = platformFilter === "all" ? allScheduled : allScheduled.filter((p: any) => p.platform === platformFilter);
  const published = platformFilter === "all" ? allPublished : allPublished.filter((p: any) => p.platform === platformFilter);

  const platformColors = {
    instagram: "bg-gradient-to-r from-pink-600 to-purple-700",
    facebook: "bg-blue-700",
    tiktok: "bg-black border border-white/20",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Glass className="p-5 !bg-gradient-to-br !from-red-950/30 !to-black/60 !border-red-900/30 overflow-hidden relative">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-red-600/10 rounded-full blur-2xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1"><Share2 size={16} className="text-red-400" /><h3 className="font-bold text-lg">Social Media</h3></div>
            <p className="text-xs text-white/60 max-w-sm">Post across platforms — publish instantly or schedule for a specific time. AI generates captions from your templates.</p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={!!posts.find((p: any) => p.id === "__autopost_enabled__")} onChange={e => {
                if (e.target.checked) setPosts((prev: any[]) => [...prev, { id: "__autopost_enabled__", type: "setting" }]);
                else setPosts((prev: any[]) => prev.filter(p => p.id !== "__autopost_enabled__"));
              }} className="w-4 h-4 accent-red-500" />
              <span className="text-xs text-white/70">Auto-post completed jobs <span className="text-white/40">(AI generates caption when job status → Completed)</span></span>
            </label>
          </div>
          <GBtn onClick={() => setModal(true)} className="flex-shrink-0"><Plus size={14} className="inline mr-1.5" />New Post</GBtn>
        </div>
      </Glass>

      {/* Connection status per platform — shows exactly which real method
          will actually be used to post ("it doesn't show 'post with this
          platform' or 'post with Buffer'" — this makes that explicit
          instead of leaving it implicit in what happens when you hit
          Publish). Buffer takes priority when a channel's connected for
          that platform; Facebook falls back to a direct Meta token; anything
          else falls back to a manual share-sheet/clipboard-paste flow. */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(platformMeta).map(([k, m]: [string, any]) => {
          const viaBuffer = !!settings.bufferChannelIds?.[k];
          const viaDirect = k === "facebook" && !!(settings as any).metaAccessToken;
          const method = viaBuffer ? "Buffer" : viaDirect ? "Direct" : "Manual";
          const connected = viaBuffer || viaDirect;
          return (
            <div key={k} className={"flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] border " + (connected ? "bg-green-950/30 border-green-700/40 text-green-300" : "bg-white/5 border-white/10 text-white/40")}>
              <span>{m.icon} {m.label}</span>
              <span className={"w-1.5 h-1.5 rounded-full " + (connected ? "bg-green-400" : "bg-white/20")} />
              <span>{connected ? "via " + method : "Manual (copy & paste)"}</span>
            </div>
          );
        })}
      </div>

      {/* Stats — real counts only. No fake/invented reach or engagement
          numbers: Buffer only reports post-level metrics per-post (see the
          "Refresh" action on a published card below), and there's no
          aggregate analytics endpoint to sum honestly here. */}
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Clock} label="Scheduled" value={allScheduled.length} />
        <Stat icon={CheckCircle} label="Published" value={allPublished.length} />
      </div>

      {/* Platform filter — click a platform to filter Scheduled/Published below */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setPlatformFilter("all")} className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105 border " + (platformFilter === "all" ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>
          All {posts.filter((p: any) => p.status !== "setting").length > 0 ? <span className="bg-white/10 px-1.5 py-0.5 rounded-full text-[9px]">{posts.filter((p: any) => p.status !== "setting").length}</span> : null}
        </button>
        {Object.entries(platformMeta).map(([k, m]: [string, any]) => {
          const n = posts.filter((p: any) => p.platform === k).length;
          return <button key={k} onClick={() => setPlatformFilter(k)} className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white transition-all hover:scale-105 border " + (platformFilter === k ? "border-white/40 " + (platformColors[k] || "bg-white/10") : "border-transparent opacity-60 hover:opacity-100 " + (platformColors[k] || "bg-white/10"))}>
            {m.icon} {m.label} {n > 0 ? <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[9px]">{n}</span> : null}
          </button>;
        })}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {["calendar", "scheduled", "published", "content_ideas", "review_graphic", "bulk", "best_time"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={"px-4 py-2 rounded-xl text-xs font-semibold capitalize border transition " + (tab === t ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
            {t === "review_graphic" ? "⭐ Review Graphic" : t === "bulk" ? "📸 Bulk Upload" : t === "best_time" ? "⏰ Best Times" : t === "calendar" ? "📅 Calendar" : t === "content_ideas" ? "✨ Content Ideas" : t + " (" + (t === "scheduled" ? scheduled.length : published.length) + ")"}
          </button>
        ))}
      </div>

      {tab === "best_time" && (() => {
        const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        // Analyze published posts by day of week
        const dayStats = days.map((day, i) => {
          const dayPosts = published.filter((p: any) => p.publishedAt && new Date(p.publishedAt + "T00:00:00").getDay() === i);
          const avgLikes = dayPosts.length > 0 ? Math.round(dayPosts.reduce((s: number, p: any) => s + (p.likes || 0), 0) / dayPosts.length) : 0;
          return { day, posts: dayPosts.length, avgLikes };
        });
        const maxLikes = Math.max(...dayStats.map(d => d.avgLikes), 1);
        // Industry best times for pressure washing (service industry)
        const industryTips = [
          { time: "Tuesday–Thursday 9–11am", reason: "Homeowners browse on weekday mornings before work" },
          { time: "Saturday 7–9am", reason: "Weekend planners looking for home services" },
          { time: "Sunday 6–8pm", reason: "End-of-weekend browsing, planning for the week" },
          { time: "Friday 12–2pm", reason: "Lunchtime scrollers before the weekend" }
        ];
        return <div className="space-y-4">
          <Glass className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">⏰ Best Times to Post</h3>
            <div className="text-xs text-white/60 mb-4">Based on your posting history + industry benchmarks for home services in York PA.</div>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {dayStats.map(d => (
                <div key={d.day} className="text-center">
                  <div className="text-[10px] text-white/50 mb-2">{d.day}</div>
                  <div className="mx-auto w-8 bg-black/40 rounded-full overflow-hidden" style={{height: "60px", display:"flex", alignItems:"flex-end"}}>
                    <div className="w-full rounded-full" style={{height: d.avgLikes > 0 ? (d.avgLikes/maxLikes*100)+"%" : "4%", background: "#dc2626", minHeight: "4px"}} />
                  </div>
                  <div className="text-[9px] text-red-300 mt-1">{d.avgLikes > 0 ? d.avgLikes + "❤" : "—"}</div>
                  <div className="text-[9px] text-white/40">{d.posts} posts</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white/70 mb-2">🏆 Industry Best Times (Home Services)</div>
              {industryTips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-red-950/20 border border-red-900/30 rounded-xl">
                  <div className="text-red-400 font-mono text-xs font-bold flex-shrink-0">{i+1}</div>
                  <div>
                    <div className="text-sm font-semibold text-red-200">{tip.time}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{tip.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </Glass>
        </div>;
      })()}

      {tab === "content_ideas" && (
        <AlfredScriptsPanel
          embedded
          settings={settings}
          jobs={jobs}
          ownerId={ownerId}
          toast={toast}
          onNav={onNav}
          onSendToSocial={(caption, photoUrl) => {
            setF(prev => ({ ...prev, caption, _photoUrl: photoUrl }));
            setModal(true);
          }}
        />
      )}

      {tab === "review_graphic" && <ReviewToGraphic toast={toast} posts={posts} setPosts={setPosts} />}

      {tab === "bulk" && <BulkPhotoUpload toast={toast} posts={posts} setPosts={setPosts} />}

      {tab === "calendar" && <SocialCalendar posts={posts} setPosts={setPosts} toast={toast} platformMeta={platformMeta} />}

      {tab === "scheduled" && <div className="grid md:grid-cols-2 gap-4">
        {scheduled.length === 0 && <div className="md:col-span-2 text-center py-16 text-white/40">
          <Share2 size={40} className="mx-auto mb-3 opacity-30 anim-float" />
          <div className="text-sm font-medium">No posts scheduled</div>
          <div className="text-xs mt-1">Click "New Post" to schedule your first one</div>
        </div>}
        {scheduled.map((p: any) => {
          const meta = platformMeta[p.platform] || platformMeta.instagram;
          const viaBuffer = !!p.bufferPostId;
          return <Glass key={p.id} className="p-4 hover:border-red-500/40 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={"px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold text-white bg-gradient-to-r " + (meta.color || "from-gray-600 to-gray-800")}>{meta.icon} {meta.label}</div>
                <Badge tone="yellow">scheduled</Badge>
              </div>
              <div className="text-xs text-white/50 flex items-center gap-1"><Clock size={10} />{p.scheduledFor}{p.scheduledTime ? " @ " + p.scheduledTime : ""}</div>
            </div>
            {p.mediaUrl && (p.mediaType === "video"
              ? <video src={p.mediaUrl} className="w-full h-40 object-cover rounded-xl mb-3 bg-black" muted controls />
              : <img src={p.mediaUrl} alt="" className="w-full h-40 object-cover rounded-xl mb-3" />)}
            <div className="text-sm text-white/80 whitespace-pre-wrap mb-3 line-clamp-5 leading-relaxed">{p.caption}</div>
            <div className="flex gap-2 pt-3 border-t border-white/5">
              {viaBuffer
                ? <div className="flex-1 text-center text-[10px] text-green-300 bg-green-950/20 border border-green-800/30 rounded-lg py-1.5">Scheduled via Buffer — publishes automatically</div>
                : <GBtn onClick={() => publishScheduled(p.id)} className="flex-1 !text-xs !py-1.5"><Send size={10} className="inline mr-1" />Publish Now</GBtn>}
              <button onClick={() => del(p.id)} className="px-2.5 py-1.5 rounded-lg border bg-white/5 border-white/10 text-white/60 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition"><Trash2 size={12} /></button>
            </div>
          </Glass>;
        })}
      </div>}

      {tab === "published" && <div className="grid md:grid-cols-2 gap-4">
        {published.length === 0 && <div className="md:col-span-2 text-center py-16 text-white/40">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">No published posts yet</div>
        </div>}
        {published.map((p: any) => {
          const meta = platformMeta[p.platform] || platformMeta.instagram;
          const hasRealAnalytics = !!p.bufferPostId;
          return <Glass key={p.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={"px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold text-white bg-gradient-to-r " + (meta.color || "from-gray-600 to-gray-800")}>{meta.icon} {meta.label}</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-white/40">{p.publishedAt}</div>
                <button onClick={() => del(p.id)} className="text-white/20 hover:text-red-400 transition"><X size={12} /></button>
              </div>
            </div>
            {p.mediaUrl && (p.mediaType === "video"
              ? <video src={p.mediaUrl} className="w-full h-40 object-cover rounded-xl mb-3 bg-black" muted controls />
              : <img src={p.mediaUrl} alt="" className="w-full h-40 object-cover rounded-xl mb-3" />)}
            <div className="text-sm text-white/70 line-clamp-3 mb-3">{p.caption}</div>
            {/* Live post link — only rendered when Buffer actually reported a
                real externalLink for this post; never fabricated. */}
            {p.externalLink && (
              <a href={p.externalLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-red-300 hover:text-red-200 mb-2">
                <ExternalLink size={11} />View live post
              </a>
            )}
            {/* Real Buffer analytics only — posts published outside Buffer
                (manual copy/paste, share sheet) have no data source, so we
                show nothing rather than an editable box of invented zeros. */}
            {hasRealAnalytics ? (
              <div>
                <div className="grid grid-cols-3 gap-2 text-center p-2 bg-black/40 rounded-xl">
                  {[
                    { key: "likes", label: "Likes", color: "text-pink-400", icon: "❤️" },
                    { key: "reach", label: "Reach", color: "text-blue-400", icon: "👁" },
                    { key: "shares", label: "Shares", color: "text-green-400", icon: "↗️" }
                  ].map(stat => (
                    <div key={stat.key}>
                      <div className="text-white/40 text-[9px] uppercase mb-1">{stat.icon} {stat.label}</div>
                      <div className={"font-bold text-base " + stat.color}>{p[stat.key] > 0 ? p[stat.key].toLocaleString() : "—"}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => refreshAnalytics(p)} disabled={refreshingId === p.id} className="w-full mt-2 flex items-center justify-center gap-1.5 text-[10px] text-white/50 hover:text-white py-1 disabled:opacity-40">
                  <RefreshCw size={10} className={refreshingId === p.id ? "animate-spin" : ""} />
                  {refreshingId === p.id ? "Refreshing…" : p.metricsUpdatedAt ? "Refresh analytics from Buffer" : "Load real analytics from Buffer"}
                </button>
              </div>
            ) : (
              <div className="text-[10px] text-white/30 text-center py-1">Published manually — no analytics source connected</div>
            )}
          </Glass>;
        })}
      </div>}

      <Modal open={modal} onClose={() => setModal(false)} title="New Social Post" maxW="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Platforms <span className="text-white/30">(pick one or more)</span></label>
              {/* BUG FIX — "connecting Buffer doesn't give me an option to
                  post specifically with Buffer." Buffer WAS already being
                  used automatically behind each individual platform toggle
                  (publishOnePlatform above), but there was no way to just
                  say "post to everything I've connected in Buffer" without
                  manually clicking every platform button one at a time and
                  hoping each one had a Buffer channel wired up. This picks
                  every platform that actually has a connected Buffer
                  channel in one tap. */}
              {(() => {
                const bufferPlatforms = Object.keys(platformMeta).filter(k => !!settings.bufferChannelIds?.[k]);
                if (bufferPlatforms.length === 0) return null;
                const allSelected = bufferPlatforms.every(k => f.platforms.includes(k));
                return (
                  <button
                    type="button"
                    onClick={() => setF(prev => ({ ...prev, platforms: allSelected ? prev.platforms.filter(p => !bufferPlatforms.includes(p)) : Array.from(new Set([...prev.platforms, ...bufferPlatforms])) }))}
                    className={"w-full mb-1.5 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition " + (allSelected ? "bg-blue-900/40 border-blue-500/50 text-blue-200" : "bg-blue-950/20 border-blue-700/40 text-blue-300 hover:bg-blue-900/30")}
                  >
                    <Zap size={12} />{allSelected ? "All Buffer channels selected" : `Post via Buffer to all ${bufferPlatforms.length} connected channel${bufferPlatforms.length > 1 ? "s" : ""}`}
                  </button>
                );
              })()}
              <div className="grid grid-cols-1 gap-1">
                {Object.entries(platformMeta).map(([k, m]: [string, any]) => {
                  const active = f.platforms.includes(k);
                  const viaBuffer = !!settings.bufferChannelIds?.[k];
                  const viaDirect = k === "facebook" && !!(settings as any).metaAccessToken;
                  const methodLabel = viaBuffer ? "via Buffer" : viaDirect ? "Direct" : "Manual — copy & paste";
                  return <button key={k} type="button" onClick={() => togglePlatform(k)} className={"flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition " + (active ? "bg-gradient-to-r " + m.color + " border-white/30 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
                    <span>{m.icon} {m.label}<span className="ml-1.5 text-[9px] opacity-70">{methodLabel}</span></span>
                    {active && <CheckCircle size={12} />}
                  </button>;
                })}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Content type</label>
                <GSel value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="!text-xs">
                  <option value="before_after" className="bg-black">Before/After</option>
                  <option value="promo" className="bg-black">Promotion</option>
                  <option value="testimonial" className="bg-black">Testimonial</option>
                  <option value="tip" className="bg-black">Helpful Tip</option>
                  <option value="team" className="bg-black">Team/Culture</option>
                </GSel>
              </div>
              {/* Publish Now vs Schedule Post — explicit choice, not forced scheduling */}
              <div>
                <label className="text-xs text-white/60 mb-1 block">When</label>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={() => setF(prev => ({ ...prev, publishMode: "now" }))} className={"px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 " + (f.publishMode === "now" ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
                    <Send size={11} />Publish Now
                  </button>
                  <button type="button" onClick={() => setF(prev => ({ ...prev, publishMode: "schedule" }))} className={"px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 " + (f.publishMode === "schedule" ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
                    <Clock size={11} />Schedule
                  </button>
                </div>
                {f.publishMode === "schedule" && (
                  <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    <GDate value={f.scheduledFor} onChange={e => setF({ ...f, scheduledFor: e.target.value })} className="!text-xs" />
                    <GInput type="time" value={f.scheduledTime} onChange={e => setF({ ...f, scheduledTime: e.target.value })} className="!text-xs" />
                  </div>
                )}
                <div className="text-[9px] text-white/40 mt-1 flex items-center gap-1">
                  <span>💡</span>
                  <span>Best times: Instagram 9–11am, Facebook 1–3pm, TikTok 7–9pm (Tue–Fri)</span>
                </div>
              </div>
              <button onClick={generate} disabled={generating} className={"w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition " + (generating ? "bg-red-900/20 border-red-700/30 text-red-400 animate-pulse" : "bg-red-900/30 border-red-600/50 text-red-300 hover:bg-red-900/50")}>
                {generating ? <><div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Generating…</> : <><Zap size={12} />{f._imageData ? "Analyze Photo + Generate Caption" : "AI Generate Caption"}</>}
              </button>
              {/* Photo upload for vision analysis */}
              {f.type === "before_after" && <div className="space-y-1.5">
                {jobsWithPhotoPairs.length > 0 && (
                  <button onClick={() => setJobPhotoPickerOpen(true)} type="button"
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-green-700/40 bg-green-950/20 text-green-300 text-xs font-medium cursor-pointer hover:bg-green-900/30 transition">
                    <ImageIcon size={12} />Use a job's before/after photo ({jobsWithPhotoPairs.length} available)
                  </button>
                )}
                <label className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-red-700/40 text-red-400/70 text-xs cursor-pointer hover:bg-red-950/20 transition">
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const result = ev.target?.result as string;
                      const b64 = result.split(",")[1];
                      const mediaType = file.type as any;
                      setF(prev => ({ ...prev, _imageData: { data: b64, mediaType } }));
                      toast("Photo uploaded — click Generate for AI caption ✓");
                    };
                    reader.readAsDataURL(file);
                  }} />
                  {f._imageData ? <><CheckCircle size={12} className="text-green-400" />Photo ready — click Generate above</> : <><Upload size={12} />Upload photo for AI vision caption</>}
                </label>
                {f._imageData && <div className="text-[10px] text-white/40 mt-1 text-center">AI will analyze your photo and write a custom caption based on what it sees</div>}
              </div>}
            </div>
          </div>
          {/* FEATURE — "there's no option to upload photos and videos, and
              no preview when you upload." This used to only ever populate
              from Alfred's own script-handoff, with no general upload
              button at all. Real upload (photo or video), a real preview
              once it's up, and this is what actually gets attached to the
              Buffer post below (see postToBuffer's mediaUrl param). */}
          <div>
            <label className="text-xs text-white/60 mb-1 block">Photo / Video (optional)</label>
            {f._photoUrl ? (
              <div className="flex items-center gap-2 p-2 bg-red-950/20 border border-red-800/40 rounded-xl">
                {f._mediaType === "video" ? (
                  <video src={f._photoUrl} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-black" muted controls />
                ) : (
                  <img src={f._photoUrl} alt="Post media" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="text-[10px] text-red-300 flex-1">{f._mediaType === "video" ? "Video" : "Photo"} attached — will be included when this posts.</div>
                <button onClick={() => setF(prev => ({ ...prev, _photoUrl: null }))} className="text-white/40 hover:text-white flex-shrink-0"><X size={12} /></button>
              </div>
            ) : (
              <label className={"flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-xs cursor-pointer transition " + ((f as any)._uploadingMedia ? "border-white/10 text-white/30" : "border-white/15 text-white/50 hover:border-red-500/40 hover:text-white")}>
                <input type="file" accept="image/*,video/*" className="hidden" disabled={(f as any)._uploadingMedia} onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const isVideo = file.type.startsWith("video/");
                  setF(prev => ({ ...(prev as any), _uploadingMedia: true }));
                  const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
                  const url = await uploadJobMedia(file, `social/${uid()}.${ext}`, file.type);
                  if (url) {
                    setF(prev => ({ ...(prev as any), _photoUrl: url, _mediaType: isVideo ? "video" : "image", _uploadingMedia: false }));
                    toast("Media uploaded ✓");
                  } else {
                    setF(prev => ({ ...(prev as any), _uploadingMedia: false }));
                    toast("Upload failed — try again", "red");
                  }
                }} />
                {(f as any)._uploadingMedia ? <>Uploading…</> : <><Upload size={12} />Upload a photo or video</>}
              </label>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/60">Caption</label>
              <span className="text-[9px] text-white/40">{f.caption.length} chars</span>
            </div>
            {/* Post Templates — placeholders auto-fill from Settings (business
                name / phone) via mergeCaption, no manual typing needed. */}
            <div className="mb-2">
              <GSel defaultValue="" onChange={e => {
                const templates = [
                  { id: "ba", label: "Before/After Reveal", body: "🚿 Before & After transformation in York, PA!\n\nThis [SERVICE] was looking rough — years of grime, mold, and algae. One visit from {{company_name}} and it looks brand new! 🤩\n\nReady to restore your home? Link in bio or DM us for a free quote!\n\n📞 {{company_phone}}" },
                  { id: "seasonal", label: "Seasonal Promo", body: "🌸 Spring is here and your home deserves a deep clean!\n\nWinter left behind dirt, algae, and mildew on your siding, driveway, and roof. We remove it all safely with our soft wash system.\n\n✅ No damage to plants or surfaces\n✅ Same-day quotes\n✅ York PA & surrounding areas\n\nBook now — slots filling fast! DM or call {{company_phone}}" },
                  { id: "review", label: "Customer Review Feature", body: "⭐⭐⭐⭐⭐ \"[CUSTOMER QUOTE HERE]\"\n\n— Happy customer in York, PA\n\nThank you for the kind words! Nothing motivates us more than knowing we made your home shine again. 🙏\n\nYour home could look like this too. DM us for a free estimate!\n\n#{{company_name}}pressurewashing #yorkpa #pressurewashing" },
                  { id: "tip", label: "Pro Tip / Educational", body: "💡 PRO TIP: Did you know soft washing is SAFER than pressure washing for most surfaces?\n\nHigh pressure can:\n❌ Crack siding\n❌ Damage wood decks\n❌ Force water behind walls\n\nOur low-pressure soft wash uses eco-friendly solutions to clean safely and effectively.\n\nQuestions? Drop them below 👇 or DM us!\n\n📞 {{company_phone}} | York, PA" },
                  { id: "cta", label: "Strong CTA / Urgency", body: "🔴 SPOTS AVAILABLE THIS WEEK in York PA!\n\nWe had a cancellation and can fit in [X] more homes this week. If your driveway, siding, or roof needs some love — now's the time!\n\n💧 House Wash starting at $[PRICE]\n💧 Driveway Cleaning from $[PRICE]\n💧 Roof Soft Wash from $[PRICE]\n\nDM us or call {{company_phone}} to grab your spot!" },
                  { id: "team", label: "Meet the Team / Behind the Scenes", body: "👋 Just another day at {{company_name}}!\n\nStarted at 7am, [X] jobs on the books, and we're making York PA look its best one property at a time. 💪\n\nSmall business, big results. We treat every home like it's our own.\n\nTag someone whose house needs a wash! 👇" },
                ];
                const t = templates.find(x => x.id === e.target.value);
                if (t) setF(prev => ({ ...prev, caption: mergeCaption(t.body) }));
                e.target.value = "";
              }} className="!text-xs w-full">
                <option value="" className="bg-black">📋 Load post template…</option>
                <option value="ba" className="bg-black">Before/After Reveal</option>
                <option value="seasonal" className="bg-black">Seasonal Promo</option>
                <option value="review" className="bg-black">Customer Review Feature</option>
                <option value="tip" className="bg-black">Pro Tip / Educational</option>
                <option value="cta" className="bg-black">Strong CTA / Urgency</option>
                <option value="team" className="bg-black">Meet the Team / BTS</option>
              </GSel>
            </div>
            <GTxt rows={5} value={f.caption} onChange={e => setF({ ...f, caption: e.target.value })} placeholder="Write your caption or click AI Generate…" className="!text-xs" />
          </div>
          <div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/60">Hashtags</label>
                <span className="text-[10px] text-white/30">{f.hashtags.split(" ").filter(h => h.startsWith("#")).length} tags</span>
              </div>
              {/* Hashtag library by service type */}
              <div className="flex gap-1 flex-wrap mb-2">
                {[
                  { label: "House Wash", tags: "#housewash #softwash #pressurewashing #houseexterior #curb appeal #mold removal #algaeremoval" },
                  { label: "Roof Wash", tags: "#roofwash #roofcleaning #softwash #roofmaintenance #mossonroof #algaeroof #protectyourroof" },
                  { label: "Driveway", tags: "#drivewaysealing #drivewayrestoration #concretecleaning #pressurewashing #dirtydriveway #beforeandafter" },
                  { label: "Deck/Patio", tags: "#deckwash #patiocleaning #outdoorliving #deckrestoration #backyard #pressurewashing" },
                  { label: "Gutter", tags: "#guttercleaning #gutterguards #falllleafcleanup #homeprotection #guttermaintenance" },
                  { label: "General", tags: "#pressurewashing #softwash #yorkpa #pennsylvania #homeimprovement #curb appeal #smallbusiness #localsmallbusiness #hometransformation" },
                ].map(lib => (
                  <button key={lib.label} onClick={() => setF(prev => ({ ...prev, hashtags: lib.tags }))} className="px-2 py-1 rounded-lg bg-red-950/30 border border-red-900/30 text-red-300 text-[10px] hover:bg-red-900/40 transition">
                    {lib.label}
                  </button>
                ))}
              </div>
              <GInput value={f.hashtags} onChange={e => setF({ ...f, hashtags: e.target.value })} className="!text-xs" placeholder="#pressurewashing #york" />
            </div>
            <div className="flex gap-1 flex-wrap mt-1.5">
              {[
                { label: "House Wash", tags: "#pressurewashing #housewash #softwash #exteriorcleaning #yorkpa" },
                { label: "Driveway", tags: "#pressurewashing #driveway #concrete #curb appeal #yorkpa" },
                { label: "Roof", tags: "#roofcleaning #softwash #roofwash #algaeremoval #yorkpa" },
                { label: "Commercial", tags: "#commercialcleaning #pressurewashing #businesscleaning #yorkpa" },
                { label: "Before/After", tags: "#beforeandafter #transformation #pressurewashing #softwash #yorkpa" },
              ].map(h => (
                <button key={h.label} onClick={() => setF(prev => ({ ...prev, hashtags: h.tags }))} className="text-[9px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-red-500/50 transition">{h.label}</button>
              ))}
            </div>
          </div>
          {/* Manual multi-platform fallback note — when Buffer isn't
              connected for a selected platform, submitPost still fires the
              copy/share flow once per platform in sequence below. */}
          {f.platforms.length > 1 && f.platforms.some(p => !settings.bufferChannelIds?.[p]) && (
            <div className="text-[10px] text-white/40 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              Some selected platforms aren't connected to Buffer — for those, the caption will be copied to your clipboard one platform at a time so you can paste it in.
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setModal(false)}>Cancel</GBtn>
            <GBtn onClick={submitPost} disabled={!f.caption.trim() || f.platforms.length === 0 || submitting}>
              {submitting ? "Posting…" : f.publishMode === "schedule" ? "Schedule Post" : "Publish Now"}
            </GBtn>
          </div>
        </div>
      </Modal>

      {/* FEATURE — job before/after photo picker (see jobsWithPhotoPairs above) */}
      <Modal open={jobPhotoPickerOpen} onClose={() => setJobPhotoPickerOpen(false)} title="Use a Job's Before/After Photo" maxW="max-w-lg">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {jobsWithPhotoPairs.length === 0 && <div className="text-sm text-white/40 text-center py-8">No jobs with a matched before/after pair yet.</div>}
          {jobsWithPhotoPairs.map(({ job, pairs }: any) => (
            <div key={job.id}>
              <div className="text-xs text-white/50 mb-1.5">{job.address || "Job"} · {job.scheduledDate}</div>
              <div className="grid grid-cols-3 gap-2">
                {pairs.map((pair: any, i: number) => (
                  <button key={i} disabled={pickingJobPhoto} onClick={() => useJobPhotoPair(job, pair)}
                    className="relative aspect-video rounded-lg overflow-hidden border-2 border-white/10 hover:border-red-500 transition disabled:opacity-50">
                    <img src={pair.after.url || pair.after.dataUrl} alt="After" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] text-center py-0.5">Pair {i + 1}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ===== INVOICES =====

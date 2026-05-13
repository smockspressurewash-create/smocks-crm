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

export function SocialPage({ posts = [], setPosts, toast, settings = {} }) {
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState("scheduled");
  const [f, setF] = useState({ platform: "instagram", type: "before_after", caption: "", scheduledFor: daysFromNow(1), hashtags: "#pressurewashing #softwash #yorkpa #homeimprovement #curb appeal" });
  const [generating, setGenerating] = useState(false);
  const [previewPost, setPreviewPost] = useState(null);

  const platformMeta = {
    instagram: { color: "from-pink-600 to-purple-700", icon: "📸", limit: 2200, label: "Instagram" },
    facebook: { color: "from-blue-600 to-blue-800", icon: "👥", limit: 63206, label: "Facebook" },
    tiktok: { color: "from-black to-neutral-900", icon: "🎵", limit: 2200, label: "TikTok" },
    google: { color: "from-blue-500 to-red-500", icon: "🗺️", limit: 1500, label: "Google Business" },
    nextdoor: { color: "from-green-600 to-green-800", icon: "🏘️", limit: 3000, label: "Nextdoor" }
  };

  const captionTemplates = [
    { type: "before_after", captions: [
      "Before vs. After 😍\n\nYears of algae, grime, and weathering — gone in one afternoon. Our soft wash system is gentle on your home and devastating on buildup.\n\n📍 York, PA | 📞 (717) 555-0100 | Free estimates →",
      "The transformation is real ✨\n\nThis customer had NO idea how good their home could look. Soft wash + surface clean = curb appeal on steroids.\n\nDM us to book before the season fills up! 🔥",
      "Can you believe this is the same driveway? 🤯\n\nPressure washing + sealer = looking brand new. We serve all of York County.\n\nTag a neighbor who needs this! 👇"
    ]},
    { type: "promo", captions: [
      "🌸 SPRING SPECIAL — 15% off house soft washes this month only!\n\nSpots are filling fast. Don't wait until the moss wins.\n\nCall or DM to book. York, PA & surrounding areas.",
      "LIMITED TIME: Book any job over $400 and get your driveway done at 50% off.\n\nWe have openings this week. First come, first served.\n\n📲 (717) 555-0100"
    ]},
    { type: "testimonial", captions: [
      "⭐⭐⭐⭐⭐ \"Couldn't believe the difference. Looked brand new. Worth every penny!\" — Jennifer W.\n\nReviews like this make the early mornings worth it. 🙏\n\n#CustomerLove #5Stars #PressureWashing",
      "We don't just clean houses — we restore them. 🏠✨\n\nThank you to all our amazing York County customers for the 5-star love. We work hard to earn every review."
    ]}
  ];

  const generate = async () => {
    setGenerating(true);
    const typeDesc = { before_after: "a before/after transformation post", promo: "a promotional offer post", testimonial: "a customer testimonial/review post", tip: "a helpful pressure washing tip", team: "a team/culture/behind-the-scenes post" }[f.type] || "a social media post";
    try {
      // If there's an uploaded image and it's a before_after, use vision analysis
      const imageData = f._imageData;
      let messageContent;
      if (imageData && f.type === "before_after") {
        messageContent = [
          { type: "image", source: { type: "base64", media_type: imageData.mediaType, data: imageData.data } },
          { type: "text", text: `You are writing a social media caption for Smock's Pressure Washing in York, PA. Analyze this before/after or transformation photo and write a compelling ${f.platform} caption. The owner is Will. Make it engaging, real, and slightly casual. Include a call to action (DM or call (717) 555-0100). Keep it under 150 words. Use natural line breaks.` }
        ];
      } else {
        messageContent = `Write ${typeDesc} for Smock's Pressure Washing in York, PA. The owner's name is Will. Write one caption only — no alternatives, no intro text. Make it engaging, real, and slightly casual. Include a call to action. Keep it under 150 words. Use natural line breaks for readability. Don't use quotation marks around the whole thing. Platform: ${f.platform}.`;
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [{ role: "user", content: messageContent }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text?.trim();
      if (text) { setF(prev => ({ ...prev, caption: text })); toast(imageData ? "Caption generated from your photo ✓" : "Caption generated ✓"); }
      else throw new Error("No content");
    } catch {
      // Fallback to template
      const templates = captionTemplates.find(t => t.type === f.type)?.captions || captionTemplates[0].captions;
      setF(prev => ({ ...prev, caption: templates[Math.floor(Math.random() * templates.length)] }));
      toast("Caption generated (offline template)");
    } finally {
      setGenerating(false);
    }
  };

  const save = () => {
    if (!f.caption.trim()) return;
    const fullCaption = f.caption + "\n\n" + f.hashtags;
    setPosts([{ id: uid(), ...f, caption: fullCaption, status: "scheduled", likes: 0, shares: 0, comments: 0, reach: 0 }, ...posts]);
    setF({ platform: "instagram", type: "before_after", caption: "", scheduledFor: daysFromNow(1), hashtags: "#pressurewashing #softwash #yorkpa #homeimprovement #curb appeal" });
    setModal(false);
    toast("Post scheduled ✓");
  };

  const publish = async id => {
    const post = posts.find(p => p.id === id);
    setPosts(posts.map(p => p.id === id ? { ...p, status: "published", publishedAt: today(), likes: p.likes || 0, shares: p.shares || 0, comments: p.comments || 0, reach: p.reach || 0 } : p));

    if (post && (post.platform === "instagram" || post.platform === "tiktok")) {
      const caption = (post.caption || "") + (post.hashtags ? "\n\n" + post.hashtags : "");
      // Instagram bridge: open app via deep link with caption pre-filled
      if (settings.instaBridge && post.platform === "instagram") {
        navigator.clipboard?.writeText(caption).catch(() => {});
        // Try deep link to Instagram app
        const igUrl = "instagram://library?AssetPath=";
        window.location.href = igUrl;
        setTimeout(() => {
          // Fallback if app not installed
          window.open("https://www.instagram.com/", "_blank");
        }, 1500);
        toast("Caption copied! Instagram opening — paste and post 📸");
        return;
      }
      // TikTok bridge
      if (post.platform === "tiktok") {
        navigator.clipboard?.writeText(caption).catch(() => {});
        window.open("tiktok://", "_blank");
        setTimeout(() => window.open("https://www.tiktok.com/upload", "_blank"), 1500);
        toast("Caption copied! TikTok opening — paste and upload 🎵");
        return;
      }
      // Generic: Web Share API
      if (navigator.share) {
        try {
          await navigator.share({ title: "Smock's Pressure Washing", text: caption, url: "https://smocks.com" });
          toast("Share sheet opened ✓");
          return;
        } catch { /* cancelled */ }
      }
      navigator.clipboard?.writeText(caption).catch(() => {});
      toast("Caption copied! Open " + post.platform + " and paste 📋");
      return;
    }
    toast("Published ✓");
  };
  const del = id => { if (confirm("Delete post?")) setPosts(posts.filter(p => p.id !== id)); };

  const scheduled = posts.filter(p => p.status === "scheduled");
  const published = posts.filter(p => p.status === "published");
  const totalReach = published.reduce((s, p) => s + (p.reach || 0), 0);
  const totalLikes = published.reduce((s, p) => s + (p.likes || 0), 0);

  const platformColors = {
    instagram: "bg-gradient-to-r from-pink-600 to-purple-700",
    facebook: "bg-blue-700",
    tiktok: "bg-black border border-white/20",
    google: "bg-gradient-to-r from-blue-500 to-red-500",
    nextdoor: "bg-green-700"
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Glass className="p-5 !bg-gradient-to-br !from-purple-950/30 !to-black/60 !border-purple-700/40 overflow-hidden relative">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-purple-600/10 rounded-full blur-2xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1"><Share2 size={16} className="text-purple-400" /><h3 className="font-bold text-lg">Social Media</h3></div>
            <p className="text-xs text-white/60 max-w-sm">Schedule posts across platforms. AI generates captions from your templates — paste a before/after photo on the platform after scheduling.</p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={!!posts.find(p => p.id === "__autopost_enabled__")} onChange={e => {
                if (e.target.checked) setPosts(prev => [...prev, { id: "__autopost_enabled__", type: "setting" }]);
                else setPosts(prev => prev.filter(p => p.id !== "__autopost_enabled__"));
              }} className="w-4 h-4 accent-purple-500" />
              <span className="text-xs text-white/70">Auto-post completed jobs <span className="text-white/40">(AI generates caption when job status → Completed)</span></span>
            </label>
          </div>
          <GBtn onClick={() => setModal(true)} className="flex-shrink-0"><Plus size={14} className="inline mr-1.5" />New Post</GBtn>
        </div>
      </Glass>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Clock} label="Scheduled" value={scheduled.length} />
        <Stat icon={CheckCircle} label="Published" value={published.length} />
        <Stat icon={TrendingUp} label="Total Reach" value={totalReach > 0 ? totalReach.toLocaleString() : "—"} />
        <Stat icon={Star} label="Total Likes" value={totalLikes > 0 ? totalLikes.toLocaleString() : "—"} />
      </div>

      {/* Platform quick-links */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(platformMeta).map(([k, m]) => {
          const n = posts.filter(p => p.platform === k).length;
          return <button key={k} className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white transition-all hover:scale-105 " + (platformColors[k] || "bg-white/10")}>
            {m.icon} {m.label} {n > 0 ? <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[9px]">{n}</span> : null}
          </button>;
        })}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {["calendar", "scheduled", "published", "review_graphic", "bulk", "best_time"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={"px-4 py-2 rounded-xl text-xs font-semibold capitalize border transition " + (tab === t ? "bg-purple-900/40 border-purple-500/50 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
            {t === "review_graphic" ? "⭐ Review Graphic" : t === "bulk" ? "📸 Bulk Upload" : t === "best_time" ? "⏰ Best Times" : t === "calendar" ? "📅 Calendar" : t + " (" + (t === "scheduled" ? scheduled.length : published.length) + ")"}
          </button>
        ))}
      </div>

      {tab === "best_time" && (() => {
        const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        // Analyze published posts by day of week
        const dayStats = days.map((day, i) => {
          const dayPosts = published.filter(p => p.publishedAt && new Date(p.publishedAt + "T00:00:00").getDay() === i);
          const avgLikes = dayPosts.length > 0 ? Math.round(dayPosts.reduce((s,p) => s+p.likes,0)/dayPosts.length) : 0;
          const avgReach = dayPosts.length > 0 ? Math.round(dayPosts.reduce((s,p) => s+p.reach,0)/dayPosts.length) : 0;
          return { day, posts: dayPosts.length, avgLikes, avgReach };
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
                    <div className="w-full rounded-full" style={{height: d.avgLikes > 0 ? (d.avgLikes/maxLikes*100)+"%" : "4%", background: "#a855f7", minHeight: "4px"}} />
                  </div>
                  <div className="text-[9px] text-purple-300 mt-1">{d.avgLikes > 0 ? d.avgLikes + "❤" : "—"}</div>
                  <div className="text-[9px] text-white/40">{d.posts} posts</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white/70 mb-2">🏆 Industry Best Times (Home Services)</div>
              {industryTips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-purple-950/20 border border-purple-800/30 rounded-xl">
                  <div className="text-purple-400 font-mono text-xs font-bold flex-shrink-0">{i+1}</div>
                  <div>
                    <div className="text-sm font-semibold text-purple-200">{tip.time}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{tip.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </Glass>
        </div>;
      })()}

      {tab === "review_graphic" && <ReviewToGraphic toast={toast} posts={posts} setPosts={setPosts} />}

      {tab === "bulk" && <BulkPhotoUpload toast={toast} posts={posts} setPosts={setPosts} />}

      {tab === "calendar" && <SocialCalendar posts={posts} setPosts={setPosts} toast={toast} platformMeta={platformMeta} />}

      {tab === "scheduled" && <div className="grid md:grid-cols-2 gap-4">
        {scheduled.length === 0 && <div className="md:col-span-2 text-center py-16 text-white/40">
          <Share2 size={40} className="mx-auto mb-3 opacity-30 anim-float" />
          <div className="text-sm font-medium">No posts scheduled</div>
          <div className="text-xs mt-1">Click "New Post" to schedule your first one</div>
        </div>}
        {scheduled.map(p => {
          const meta = platformMeta[p.platform] || platformMeta.instagram;
          return <Glass key={p.id} className="p-4 hover:border-purple-500/40 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={"px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold text-white bg-gradient-to-r " + (meta.color || "from-gray-600 to-gray-800")}>{meta.icon} {meta.label}</div>
                <Badge tone="yellow">scheduled</Badge>
              </div>
              <div className="text-xs text-white/50 flex items-center gap-1"><Clock size={10} />{p.scheduledFor}</div>
            </div>
            <div className="text-sm text-white/80 whitespace-pre-wrap mb-3 line-clamp-5 leading-relaxed">{p.caption}</div>
            <div className="flex gap-2 pt-3 border-t border-white/5">
              <GBtn onClick={() => publish(p.id)} className="flex-1 !text-xs !py-1.5"><Send size={10} className="inline mr-1" />Publish Now</GBtn>
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
        {published.map(p => {
          const meta = platformMeta[p.platform] || platformMeta.instagram;
          return <Glass key={p.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={"px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold text-white bg-gradient-to-r " + (meta.color || "from-gray-600 to-gray-800")}>{meta.icon} {meta.label}</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-white/40">{p.publishedAt}</div>
                <button onClick={() => del(p.id)} className="text-white/20 hover:text-red-400 transition"><X size={12} /></button>
              </div>
            </div>
            <div className="text-sm text-white/70 line-clamp-3 mb-3">{p.caption}</div>
            {/* Editable performance stats */}
            <div className="grid grid-cols-3 gap-2 text-center p-2 bg-black/40 rounded-xl">
              {[
                { key: "likes", label: "Likes", color: "text-pink-400", icon: "❤️" },
                { key: "reach", label: "Reach", color: "text-blue-400", icon: "👁" },
                { key: "shares", label: "Shares", color: "text-green-400", icon: "↗️" }
              ].map(stat => (
                <div key={stat.key}>
                  <div className="text-white/40 text-[9px] uppercase mb-1">{stat.icon} {stat.label}</div>
                  <input
                    type="number"
                    min="0"
                    value={p[stat.key] || 0}
                    onChange={e => setPosts(prev => prev.map(x => x.id === p.id ? { ...x, [stat.key]: Number(e.target.value) } : x))}
                    className={"w-full bg-transparent text-center font-bold text-base border-b border-white/10 focus:border-white/30 focus:outline-none " + stat.color}
                  />
                </div>
              ))}
            </div>
            <div className="text-[9px] text-white/30 text-center mt-1">Tap numbers to update from your platform analytics</div>
          </Glass>;
        })}
      </div>}

      <Modal open={modal} onClose={() => setModal(false)} title="Schedule Social Post" maxW="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Platform</label>
              <div className="grid grid-cols-1 gap-1">
                {Object.entries(platformMeta).map(([k, m]) => <button key={k} onClick={() => setF({ ...f, platform: k })} className={"flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition " + (f.platform === k ? "bg-gradient-to-r " + m.color + " border-white/30 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>{m.icon} {m.label}</button>)}
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
              <div>
                <label className="text-xs text-white/60 mb-1 block">Scheduled for</label>
                <GDate value={f.scheduledFor} onChange={e => setF({ ...f, scheduledFor: e.target.value })} className="!text-xs" />
                <div className="text-[9px] text-white/40 mt-1 flex items-center gap-1">
                  <span>💡</span>
                  <span>Best times: Instagram 9–11am, Facebook 1–3pm, TikTok 7–9pm (Tue–Fri)</span>
                </div>
              </div>
              <button onClick={generate} disabled={generating} className={"w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition " + (generating ? "bg-purple-900/20 border-purple-700/30 text-purple-400 animate-pulse" : "bg-purple-900/30 border-purple-600/50 text-purple-300 hover:bg-purple-900/50")}>
                {generating ? <><div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generating…</> : <><Zap size={12} />{f._imageData ? "Analyze Photo + Generate Caption" : "AI Generate Caption"}</>}
              </button>
              {/* Photo upload for vision analysis */}
              {f.type === "before_after" && <div>
                <label className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-purple-700/40 text-purple-400/70 text-xs cursor-pointer hover:bg-purple-950/20 transition">
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
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/60">Caption</label>
              <span className="text-[9px] text-white/40">{f.caption.length} chars</span>
            </div>
            {/* Post Templates */}
            <div className="mb-2">
              <GSel defaultValue="" onChange={e => {
                const templates = [
                  { id: "ba", label: "Before/After Reveal", body: "🚿 Before & After transformation in York, PA!\n\nThis [SERVICE] was looking rough — years of grime, mold, and algae. One visit from Smock's and it looks brand new! 🤩\n\nReady to restore your home? Link in bio or DM us for a free quote!\n\n📞 (717) 555-0100" },
                  { id: "seasonal", label: "Seasonal Promo", body: "🌸 Spring is here and your home deserves a deep clean!\n\nWinter left behind dirt, algae, and mildew on your siding, driveway, and roof. We remove it all safely with our soft wash system.\n\n✅ No damage to plants or surfaces\n✅ Same-day quotes\n✅ York PA & surrounding areas\n\nBook now — slots filling fast! DM or call (717) 555-0100" },
                  { id: "review", label: "Customer Review Feature", body: "⭐⭐⭐⭐⭐ \"[CUSTOMER QUOTE HERE]\"\n\n— Happy customer in York, PA\n\nThank you for the kind words! Nothing motivates us more than knowing we made your home shine again. 🙏\n\nYour home could look like this too. DM us for a free estimate!\n\n#smockspressurewashing #yorkpa #pressurewashing" },
                  { id: "tip", label: "Pro Tip / Educational", body: "💡 PRO TIP: Did you know soft washing is SAFER than pressure washing for most surfaces?\n\nHigh pressure can:\n❌ Crack siding\n❌ Damage wood decks\n❌ Force water behind walls\n\nOur low-pressure soft wash uses eco-friendly solutions to clean safely and effectively.\n\nQuestions? Drop them below 👇 or DM us!\n\n📞 (717) 555-0100 | York, PA" },
                  { id: "cta", label: "Strong CTA / Urgency", body: "🔴 SPOTS AVAILABLE THIS WEEK in York PA!\n\nWe had a cancellation and can fit in [X] more homes this week. If your driveway, siding, or roof needs some love — now's the time!\n\n💧 House Wash starting at $[PRICE]\n💧 Driveway Cleaning from $[PRICE]\n💧 Roof Soft Wash from $[PRICE]\n\nDM us or call (717) 555-0100 to grab your spot!" },
                  { id: "team", label: "Meet the Team / Behind the Scenes", body: "👋 Just another day at Smock's Pressure Washing!\n\nStarted at 7am, [X] jobs on the books, and we're making York PA look its best one property at a time. 💪\n\nSmall business, big results. We treat every home like it's our own.\n\nTag someone whose house needs a wash! 👇" },
                ];
                const t = templates.find(x => x.id === e.target.value);
                if (t) setF(prev => ({ ...prev, caption: t.body }));
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
                  <button key={lib.label} onClick={() => setF(prev => ({ ...prev, hashtags: lib.tags }))} className="px-2 py-1 rounded-lg bg-purple-950/30 border border-purple-700/30 text-purple-300 text-[10px] hover:bg-purple-900/40 transition">
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
                <button key={h.label} onClick={() => setF(prev => ({ ...prev, hashtags: h.tags }))} className="text-[9px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-purple-500/50 transition">{h.label}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setModal(false)}>Cancel</GBtn>
            <GBtn onClick={save} disabled={!f.caption.trim()}>Schedule Post</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== INVOICES =====

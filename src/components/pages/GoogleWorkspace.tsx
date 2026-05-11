// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { uid, today, daysSince, fmt, daysFromNow } from '../../lib/utils';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GSel } from '../ui/GSel';
import { Modal } from '../ui/Modal';
import { Glass } from '../ui/Glass';
import { PageFade } from '../ui/PageFade';
import { VoiceMicButton } from '../ui/VoiceMicButton';
import { MODELS, callModel, parseRateLimitError } from '../../lib/ai';
import { twilioSend, sendEmail } from '../../lib/messaging';
import { sendGmailEmail, createCalendarEvent, uploadToDrive } from '../../lib/google';
import { personalities } from '../../lib/constants';

// Destructure common icons to avoid rewriting component code
const { 
  Bot, Settings, X, Plus, Search, Edit, Trash2, Send, Activity, Users,
  MessageSquare, Mic, Play, Volume2, Cloud, FileImage, Link, ArrowRight,
  CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Menu, Zap, Clock, GripVertical, RefreshCw, Copy, Paperclip, Target, Workflow, BarChart2,
  Lock, Key, Image: ImageIcon, MapPin, Map, Sun, Wind, Umbrella, CheckSquare, Save, XCircle
} = LucideIcons;

export function GoogleWorkspacePage({ settings = {}, setSettings, googleData = {}, setGoogleData, customers = [], setCustomers, jobs = [], toast, onNav }) {
  const [tab, setTab] = useState("overview");
  const [syncing, setSyncing] = useState(false);
  const [composing, setComposing] = useState(null); // { to, subject, body }
  const [newTask, setNewTask] = useState({ title: "", notes: "", due: today(), list: "Work" });
  const [addingTask, setAddingTask] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", start: today() + "T09:00", end: today() + "T10:00", location: "", description: "" });
  const [addingEvent, setAddingEvent] = useState(false);
  const [taskFilter, setTaskFilter] = useState("active"); // active | completed | all
  const [, forceUpdate] = useState(0);

  // Use real data if connected + synced, otherwise mock
  const isConnected = settings.googleConnected && settings.googleBackendUrl;
  const data = googleData?.lastSync ? googleData : MOCK_GOOGLE_DATA;
  const isMock = !googleData?.lastSync;

  const scopes = settings.googleScopes || {};

  const doSync = async () => {
    if (!isConnected) { toast("Connect Google first — add backend URL in Settings → Integrations", "error"); return; }
    setSyncing(true);
    try {
      await syncAllGoogle(settings, setGoogleData);
      toast("Google Workspace synced ✓");
    } catch (e) {
      toast("Sync failed: " + e.message, "error");
    } finally {
      setSyncing(false);
    }
  };

  const sendEmail = async (to, subject, body) => {
    if (!isConnected) { toast("Demo: email to " + to + " (connect backend to send real emails)"); setComposing(null); return; }
    try {
      await sendGmailEmail(settings.googleBackendUrl, settings.googleToken, { to, subject, body });
      toast("Email sent ✓");
      setComposing(null);
      doSync();
    } catch (e) { toast("Send failed: " + e.message, "error"); }
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    if (!isConnected) {
      setGoogleData(prev => ({ ...prev, tasks: [{ id: uid(), title: newTask.title, due: newTask.due, status: "needsAction", notes: newTask.notes, listTitle: newTask.list }, ...(prev.tasks || MOCK_GOOGLE_DATA.tasks)], lastSync: prev.lastSync || "mock" }));
      toast("Task added (local — connect backend to sync to Google Tasks)");
      setNewTask({ title: "", notes: "", due: today(), list: "Work" });
      setAddingTask(false);
      return;
    }
    try {
      await createTask(settings.googleBackendUrl, settings.googleToken, { title: newTask.title, notes: newTask.notes, due: newTask.due });
      toast("Task created in Google Tasks ✓");
      setNewTask({ title: "", notes: "", due: today(), list: "Work" });
      setAddingTask(false);
      doSync();
    } catch (e) { toast("Failed: " + e.message, "error"); }
  };

  const toggleTask = async (taskId) => {
    const tasks = data.tasks || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === "completed" ? "needsAction" : "completed";
    // Optimistic update
    setGoogleData(prev => ({
      ...prev,
      tasks: (prev.tasks || MOCK_GOOGLE_DATA.tasks).map(t => t.id === taskId ? { ...t, status: newStatus } : t),
      lastSync: prev.lastSync || "mock"
    }));
    if (!isConnected) { toast(newStatus === "completed" ? "Task done ✓" : "Reopened"); return; }
    try {
      await completeTask(settings.googleBackendUrl, settings.googleToken, taskId);
      toast(newStatus === "completed" ? "Task done in Google Tasks ✓" : "Task reopened ✓");
    } catch (e) { toast("Sync failed — local only", "error"); }
  };

  const addEvent = async () => {
    if (!newEvent.title.trim()) return;
    const startDt = newEvent.start || today() + "T09:00";
    const endDt = newEvent.end || today() + "T10:00";
    if (!isConnected) {
      setGoogleData(prev => ({ ...prev, events: [{ id: uid(), title: newEvent.title, start: startDt, end: endDt, location: newEvent.location, description: newEvent.description, attendees: [], color: "blue" }, ...(prev.events || MOCK_GOOGLE_DATA.events)], lastSync: prev.lastSync || "mock" }));
      toast("Event added (local — connect backend to sync to Google Calendar)");
      setAddingEvent(false);
      return;
    }
    try {
      await createCalendarEvent(settings.googleBackendUrl, settings.googleToken, { title: newEvent.title, start: startDt, end: endDt, location: newEvent.location, description: newEvent.description });
      toast("Event created in Google Calendar ✓");
      setAddingEvent(false);
      doSync();
    } catch (e) { toast("Failed: " + e.message, "error"); }
  };

  const importContact = async (gc) => {
    if (customers.some(c => c.email === gc.email)) { toast("Already in CRM"); return; }
    const newC = { id: uid(), firstName: gc.name.split(" ")[0] || gc.name, lastName: gc.name.split(" ").slice(1).join(" ") || "", email: gc.email || "", phone: gc.phone || "", address: "", totalSpent: 0, createdAt: today(), notes: gc.notes || "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "" };
    setCustomers(prev => [...prev, newC]);
    toast("Imported: " + gc.name + " → Customers");
  };

  const fmtTime = iso => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
  const fmtDate = iso => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString([], { month: "short", day: "numeric" }); };
  const relTime = iso => { if (!iso) return ""; const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 60000; if (diff < 60) return Math.round(diff) + "m"; if (diff < 1440) return Math.round(diff / 60) + "h"; return Math.round(diff / 1440) + "d"; };
  const fileIcon = mime => mime?.includes("pdf") ? "📄" : mime?.includes("image") ? "🖼️" : mime?.includes("sheet") ? "📊" : mime?.includes("doc") ? "📝" : "📁";
  const fmtSize = bytes => bytes > 1000000 ? (bytes / 1000000).toFixed(1) + " MB" : bytes > 1000 ? Math.round(bytes / 1000) + " KB" : bytes + " B";

  const tabs = [
    { k: "overview", l: "Overview", icon: Globe },
    { k: "gmail", l: "Gmail", icon: Mail, scope: "gmail" },
    { k: "calendar", l: "Calendar", icon: Calendar, scope: "calendar" },
    { k: "tasks", l: "Tasks", icon: CheckSquare, scope: "tasks" },
    { k: "contacts", l: "Contacts", icon: Users, scope: "contacts" },
    { k: "drive", l: "Drive", icon: Cloud, scope: "drive" }
  ];

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-red-500/20 border border-white/10">
            <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          </div>
          <div>
            <div className="font-bold">Google Workspace</div>
            <div className="text-[11px] text-white/50">
              {isConnected ? <span className="text-green-400">✓ Connected as {settings.googleEmail}</span> : isMock ? <span className="text-yellow-400">⚠ Preview mode — connect backend to sync real data</span> : <span className="text-red-400">Not connected</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {googleData?.lastSync && !isMock && <div className="text-[10px] text-white/40">Synced {relTime(googleData.lastSync)} ago</div>}
          <GBtn variant="ghost" onClick={doSync} className={"!text-xs " + (syncing ? "animate-pulse" : "")} disabled={syncing}>
            <RefreshCw size={12} className={"inline mr-1.5 " + (syncing ? "animate-spin" : "")} />{syncing ? "Syncing…" : "Sync Now"}
          </GBtn>
          <GBtn variant="ghost" onClick={() => { setSettings(s => ({ ...s })); onNav("settings"); }} className="!text-xs"><Settings size={12} className="inline mr-1.5" />Connect</GBtn>
        </div>
      </div>

      {isMock && <Glass className="p-3 !bg-yellow-950/20 !border-yellow-700/40">
        <div className="flex items-start gap-2 text-xs">
          <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-yellow-300">Preview Mode — showing realistic sample data</div>
            <div className="text-white/60 mt-0.5">To sync real data: deploy the backend to Railway/Render, paste the URL + token in Settings → Integrations → Google, then click Sync Now.</div>
          </div>
        </div>
      </Glass>}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 flex-wrap">
        {tabs.map(t => {
          const Icon = t.icon;
          const enabled = !t.scope || scopes[t.scope];
          return <button key={t.k} onClick={() => { if (!enabled) { toast("Enable " + t.l + " scope in Settings → Integrations → Google"); return; } setTab(t.k); }}
            className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition " + (tab === t.k ? "bg-blue-900/40 border-blue-500/50 text-white" : enabled ? "bg-black/40 border-white/10 text-white/60 hover:text-white" : "bg-black/20 border-white/5 text-white/30 cursor-not-allowed")}>
            <Icon size={12} />{t.l}{!enabled && t.scope && <span className="text-[8px] text-white/30">off</span>}
          </button>;
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat icon={Mail} label="Inbox" value={(data.emails || []).filter(e => !e.read).length + " unread"} />
          <Stat icon={Calendar} label="Events" value={(data.events || []).length + " upcoming"} />
          <Stat icon={CheckSquare} label="Tasks" value={(data.tasks || []).filter(t => t.status !== "completed").length + " open"} />
          <Stat icon={Users} label="Contacts" value={(data.contacts || []).length} />
          <Stat icon={Cloud} label="Drive Files" value={(data.files || []).length} />
          <Stat icon={RefreshCw} label="Last Sync" value={data.lastSync ? relTime(data.lastSync) + " ago" : "Never"} />
        </div>
        {/* Unread emails preview */}
        {(data.emails || []).filter(e => !e.read).length > 0 && <Glass className="p-4">
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2 font-semibold text-sm"><Mail size={14} className="text-red-400" />Unread Emails</div><button onClick={() => setTab("gmail")} className="text-[10px] text-red-400 hover:text-red-300">View all →</button></div>
          <div className="space-y-2">
            {(data.emails || []).filter(e => !e.read).slice(0, 3).map(em => <div key={em.id} className="flex items-start gap-3 p-2.5 bg-blue-950/20 border border-blue-800/30 rounded-lg hover:bg-blue-950/30 cursor-pointer" onClick={() => { setComposing({ to: em.from.match(/<(.+)>/)?.[1] || em.from, subject: "Re: " + em.subject, body: "" }); setTab("gmail"); }}>
              <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2"><div className="text-xs font-medium truncate">{em.from.split("<")[0].trim()}</div><div className="text-[10px] text-white/40 flex-shrink-0">{relTime(em.date)}</div></div>
                <div className="text-[11px] font-semibold truncate">{em.subject}</div>
                <div className="text-[10px] text-white/50 truncate">{em.snippet}</div>
              </div>
            </div>)}
          </div>
        </Glass>}
        {/* Today's events */}
        {(data.events || []).length > 0 && <Glass className="p-4">
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2 font-semibold text-sm"><Calendar size={14} className="text-blue-400" />Upcoming Events</div><button onClick={() => setTab("calendar")} className="text-[10px] text-red-400 hover:text-red-300">View all →</button></div>
          <div className="space-y-2">
            {(data.events || []).slice(0, 3).map(ev => <div key={ev.id} className="flex items-start gap-3 p-2.5 bg-black/40 border border-white/5 rounded-lg">
              <div className={"w-1 h-12 rounded-full flex-shrink-0 bg-" + (ev.color || "blue") + "-500"} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{ev.title}</div>
                <div className="text-[10px] text-white/50">{fmtDate(ev.start)} · {fmtTime(ev.start)} – {fmtTime(ev.end)}</div>
                {ev.location && <div className="text-[10px] text-white/50 flex items-center gap-1 mt-0.5"><MapPin size={8} />{ev.location}</div>}
              </div>
            </div>)}
          </div>
        </Glass>}
        {/* Open tasks */}
        {(data.tasks || []).filter(t => t.status !== "completed").length > 0 && <Glass className="p-4">
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2 font-semibold text-sm"><CheckSquare size={14} className="text-green-400" />Open Tasks</div><button onClick={() => setTab("tasks")} className="text-[10px] text-red-400 hover:text-red-300">View all →</button></div>
          <div className="space-y-1.5">
            {(data.tasks || []).filter(t => t.status !== "completed").slice(0, 4).map(tk => <div key={tk.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => toggleTask(tk.id)}>
              <div className="w-4 h-4 rounded border border-white/30 flex-shrink-0" />
              <div className="flex-1 min-w-0"><div className="text-xs">{tk.title}</div>{tk.due && <div className="text-[10px] text-white/40">{tk.due}</div>}</div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{tk.listTitle}</span>
            </div>)}
          </div>
        </Glass>}
      </div>}

      {/* ── GMAIL ── */}
      {tab === "gmail" && <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold flex items-center gap-2"><Mail size={14} className="text-red-400" />{(data.emails || []).length} messages · {(data.emails || []).filter(e => !e.read).length} unread</div>
          <GBtn onClick={() => setComposing({ to: "", subject: "", body: "" })} className="!text-xs"><Plus size={12} className="inline mr-1.5" />Compose</GBtn>
        </div>
        {composing && <Glass className="p-4">
          <div className="flex items-center justify-between mb-3"><div className="font-semibold text-sm">New Email</div><button onClick={() => setComposing(null)} className="text-white/40 hover:text-white"><X size={14} /></button></div>
          <div className="space-y-2">
            <GInput placeholder="To (email address)" value={composing.to} onChange={e => setComposing({ ...composing, to: e.target.value })} className="!text-xs" />
            <GInput placeholder="Subject" value={composing.subject} onChange={e => setComposing({ ...composing, subject: e.target.value })} className="!text-xs" />
            <GTxt rows={5} placeholder="Body..." value={composing.body} onChange={e => setComposing({ ...composing, body: e.target.value })} className="!text-xs" />
            <div className="flex gap-2 justify-end">
              <GBtn variant="ghost" onClick={() => setComposing(null)} className="!text-xs">Cancel</GBtn>
              <GBtn onClick={() => sendEmail(composing.to, composing.subject, composing.body)} disabled={!composing.to || !composing.subject} className="!text-xs"><Send size={11} className="inline mr-1.5" />Send</GBtn>
            </div>
          </div>
        </Glass>}
        <Glass className="overflow-hidden">
          {(data.emails || []).map((em, i) => {
            const senderName = em.from.split("<")[0].trim() || em.from;
            const senderEmail = em.from.match(/<(.+)>/)?.[1] || em.from;
            const inCRM = customers.some(c => c.email === senderEmail);
            return <div key={em.id} className={"flex items-start gap-3 p-3.5 border-b border-white/5 hover:bg-white/5 cursor-pointer " + (em.read ? "" : "bg-blue-950/10")}>
              <div className={"w-2 h-2 rounded-full flex-shrink-0 mt-2 " + (em.read ? "bg-white/20" : "bg-blue-400")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={"text-xs font-medium truncate " + (em.read ? "text-white/70" : "text-white")}>{senderName}</span>
                    {inCRM && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-900/40 border border-green-700/40 text-green-300 flex-shrink-0">CRM</span>}
                  </div>
                  <span className="text-[10px] text-white/40 flex-shrink-0">{relTime(em.date)}</span>
                </div>
                <div className={"text-[11px] " + (em.read ? "text-white/60" : "font-semibold text-white")}>{em.subject}</div>
                <div className="text-[10px] text-white/40 truncate mt-0.5">{em.snippet}</div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); setComposing({ to: senderEmail, subject: "Re: " + em.subject, body: "" }); }} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white" title="Reply"><Send size={11} className="rotate-180" /></button>
              </div>
            </div>;
          })}
          {(data.emails || []).length === 0 && <div className="text-center py-10 text-white/40 text-sm">No emails — sync to load inbox</div>}
        </Glass>
      </div>}

      {/* ── CALENDAR ── */}
      {tab === "calendar" && <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold flex items-center gap-2"><Calendar size={14} className="text-blue-400" />{(data.events || []).length} upcoming events</div>
          <GBtn onClick={() => setAddingEvent(!addingEvent)} className="!text-xs"><Plus size={12} className="inline mr-1.5" />New Event</GBtn>
        </div>
        {addingEvent && <Glass className="p-4">
          <div className="flex items-center justify-between mb-3"><div className="font-semibold text-sm">New Calendar Event</div><button onClick={() => setAddingEvent(false)} className="text-white/40 hover:text-white"><X size={14} /></button></div>
          <div className="space-y-2">
            <GInput placeholder="Event title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} className="!text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-white/50 mb-1 block">Start</label><GInput type="datetime-local" value={newEvent.start} onChange={e => setNewEvent({ ...newEvent, start: e.target.value })} className="!text-xs" /></div>
              <div><label className="text-[10px] text-white/50 mb-1 block">End</label><GInput type="datetime-local" value={newEvent.end} onChange={e => setNewEvent({ ...newEvent, end: e.target.value })} className="!text-xs" /></div>
            </div>
            <GInput placeholder="Location" value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} className="!text-xs" />
            <GTxt rows={2} placeholder="Description" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} className="!text-xs" />
            <div className="flex gap-2 justify-end">
              <GBtn variant="ghost" onClick={() => setAddingEvent(false)} className="!text-xs">Cancel</GBtn>
              <GBtn onClick={addEvent} disabled={!newEvent.title.trim()} className="!text-xs"><Calendar size={11} className="inline mr-1.5" />Create</GBtn>
            </div>
          </div>
        </Glass>}
        <div className="space-y-2">
          {(data.events || []).map(ev => {
            const colorMap = { blue: "bg-blue-500", green: "bg-green-500", red: "bg-red-500", purple: "bg-purple-500", yellow: "bg-yellow-500" };
            return <Glass key={ev.id} className="p-4 hover:border-blue-500/50 transition">
              <div className="flex items-start gap-3">
                <div className={"w-1 self-stretch rounded-full flex-shrink-0 " + (colorMap[ev.color] || "bg-blue-500")} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{ev.title}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/60 mt-1">
                    <Clock size={11} />{fmtDate(ev.start)} · {fmtTime(ev.start)} – {fmtTime(ev.end)}
                    {ev.location && <><span>·</span><MapPin size={10} />{ev.location}</>}
                  </div>
                  {ev.description && <div className="text-[10px] text-white/50 mt-1">{ev.description}</div>}
                  {ev.attendees?.length > 0 && <div className="text-[10px] text-white/50 mt-1 flex items-center gap-1"><Users size={10} />{ev.attendees.join(", ")}</div>}
                </div>
              </div>
            </Glass>;
          })}
          {(data.events || []).length === 0 && <div className="text-center py-10 text-white/40">No events — add one or sync from Google Calendar</div>}
        </div>
      </div>}

      {/* ── TASKS ── */}
      {tab === "tasks" && <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="font-semibold flex items-center gap-2"><CheckSquare size={14} className="text-green-400" />Tasks</div>
            <div className="flex gap-1">
              {["active", "completed", "all"].map(f => <button key={f} onClick={() => setTaskFilter(f)} className={"text-[11px] px-2.5 py-1 rounded-lg border transition capitalize " + (taskFilter === f ? "bg-green-900/40 border-green-500/50 text-white" : "bg-black/40 border-white/10 text-white/60")}>{f}</button>)}
            </div>
          </div>
          <GBtn onClick={() => setAddingTask(!addingTask)} className="!text-xs"><Plus size={12} className="inline mr-1.5" />New Task</GBtn>
        </div>
        {addingTask && <Glass className="p-4">
          <div className="space-y-2">
            <GInput autoFocus placeholder="Task title" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} onKeyDown={e => e.key === "Enter" && addTask()} className="!text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <GInput type="date" value={newTask.due} onChange={e => setNewTask({ ...newTask, due: e.target.value })} className="!text-xs" />
              <GSel value={newTask.list} onChange={e => setNewTask({ ...newTask, list: e.target.value })} className="!text-xs">
                {["Work", "Sales", "Billing", "Supplies", "Admin"].map(l => <option key={l} value={l} className="bg-black">{l}</option>)}
              </GSel>
            </div>
            <GTxt rows={2} placeholder="Notes (optional)" value={newTask.notes} onChange={e => setNewTask({ ...newTask, notes: e.target.value })} className="!text-xs" />
            <div className="flex gap-2 justify-end">
              <GBtn variant="ghost" onClick={() => setAddingTask(false)} className="!text-xs">Cancel</GBtn>
              <GBtn onClick={addTask} disabled={!newTask.title.trim()} className="!text-xs">Add Task</GBtn>
            </div>
          </div>
        </Glass>}
        <Glass className="overflow-hidden">
          {(data.tasks || [])
            .filter(t => taskFilter === "all" || (taskFilter === "active" ? t.status !== "completed" : t.status === "completed"))
            .map(tk => (
              <div key={tk.id} className={"flex items-start gap-3 p-3.5 border-b border-white/5 hover:bg-white/5 cursor-pointer group " + (tk.status === "completed" ? "opacity-60" : "")} onClick={() => toggleTask(tk.id)}>
                <div className={"w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition " + (tk.status === "completed" ? "bg-green-600 border-green-500" : "border-white/30 group-hover:border-green-400")}>
                  {tk.status === "completed" && <CheckCircle size={12} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={"text-sm " + (tk.status === "completed" ? "line-through text-white/50" : "font-medium")}>{tk.title}</div>
                  {tk.notes && <div className="text-[10px] text-white/50 mt-0.5">{tk.notes}</div>}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-white/40">
                    {tk.due && <span className="flex items-center gap-1"><Clock size={9} />{tk.due}</span>}
                    {tk.listTitle && <span className="px-1.5 py-0.5 rounded bg-white/10">{tk.listTitle}</span>}
                  </div>
                </div>
              </div>
            ))}
          {(data.tasks || []).length === 0 && <div className="text-center py-10 text-white/40">No tasks — create one or sync from Google Tasks</div>}
        </Glass>
      </div>}

      {/* ── CONTACTS ── */}
      {tab === "contacts" && <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold flex items-center gap-2"><Users size={14} className="text-purple-400" />{(data.contacts || []).length} contacts</div>
          <div className="text-[10px] text-white/50">Click "Import" to add to CRM customers</div>
        </div>
        <Glass className="overflow-hidden">
          {(data.contacts || []).map(ct => {
            const inCRM = customers.some(c => c.email === ct.email);
            return <div key={ct.id} className="flex items-center gap-3 p-3.5 border-b border-white/5 hover:bg-white/5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center text-sm font-bold flex-shrink-0">{ct.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{ct.name}</div>
                <div className="text-[11px] text-white/60 flex flex-wrap gap-2 mt-0.5">
                  {ct.email && <span className="flex items-center gap-1"><Mail size={9} />{ct.email}</span>}
                  {ct.phone && <span className="flex items-center gap-1"><Phone size={9} />{ct.phone}</span>}
                </div>
                {ct.company && <div className="text-[10px] text-white/40 mt-0.5">{ct.company}</div>}
              </div>
              {inCRM ? <Badge tone="green">In CRM</Badge> : <button onClick={() => importContact(ct)} className="px-2.5 py-1 rounded-lg text-[11px] bg-purple-900/30 border border-purple-700/40 text-purple-300 hover:bg-purple-900/50 whitespace-nowrap">Import</button>}
            </div>;
          })}
          {(data.contacts || []).length === 0 && <div className="text-center py-10 text-white/40">No contacts — sync to load from Google Contacts</div>}
        </Glass>
      </div>}

      {/* ── DRIVE ── */}
      {tab === "drive" && <div className="space-y-3">
        <div className="font-semibold flex items-center gap-2"><Cloud size={14} className="text-green-400" />{(data.files || []).length} files</div>
        <Glass className="overflow-hidden">
          {(data.files || []).map(f => <div key={f.id} className="flex items-center gap-3 p-3.5 border-b border-white/5 hover:bg-white/5">
            <div className="text-2xl flex-shrink-0">{fileIcon(f.mimeType)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{f.name}</div>
              <div className="text-[10px] text-white/50 mt-0.5 flex items-center gap-2">
                <span>{fmtSize(f.size)}</span>
                <span>·</span>
                <span>Modified {fmtDate(f.modifiedTime)}</span>
              </div>
            </div>
            <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white" onClick={e => { if (f.webViewLink === "#") { e.preventDefault(); toast("Open Drive to view — " + f.name); } }}><ExternalLink size={12} /></a>
          </div>)}
          {(data.files || []).length === 0 && <div className="text-center py-10 text-white/40">No files — sync to load from Google Drive</div>}
        </Glass>
      </div>}
    </div>
  );
}

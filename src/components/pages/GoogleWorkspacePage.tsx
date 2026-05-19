import React, { useState, useEffect, useCallback } from "react";
import {
  Mail, Calendar, CheckSquare, Users, Cloud, Globe, Plus, X, Send,
  RefreshCw, Settings, MapPin, Clock, ExternalLink, ChevronRight,
  AlertTriangle, Activity, Phone, Loader
} from "lucide-react";
import { today } from "../../lib/utils";
import type { AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { supabase } from "../../lib/supabase";
import {
  fetchGmailMessages, sendGmailMessage, markGmailRead,
  fetchCalendarEvents, createGCalEvent, deleteGCalEvent,
  fetchGTasks, createGTask, patchGTask,
  fetchGContacts,
  fetchGDriveFiles,
  type GmailMessage, type GCalEvent, type GTask, type GContact, type GDriveFile,
} from "../../lib/googleApi";
import { fmtSize, fmtDate as fmtDateLib, fileIcon } from "../../lib/google";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const fmtDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};
const relTime = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 60000;
  if (diff < 60) return Math.round(diff) + "m";
  if (diff < 1440) return Math.round(diff / 60) + "h";
  return Math.round(diff / 1440) + "d";
};

// ─── Reusable loading / error states ─────────────────────────────────────────
const LoadingState = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center">
    <Loader size={22} className="text-blue-400 mb-3 animate-spin" />
    <div className="text-sm text-white/50">Loading {label}…</div>
  </div>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
    <AlertTriangle size={22} className="text-yellow-400" />
    <div className="text-sm text-white/60 max-w-xs">{message}</div>
    <GBtn variant="ghost" onClick={onRetry} className="!text-xs"><RefreshCw size={11} className="inline mr-1.5" />Retry</GBtn>
  </div>
);

const EmptyState = ({ label, action }: { label: string; action?: () => void }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center">
    <div className="text-white/20 text-2xl mb-2">—</div>
    <div className="text-sm text-white/40">{label}</div>
    {action && <button onClick={action} className="mt-2 text-xs text-blue-400 hover:text-blue-300">Try again →</button>}
  </div>
);

// ─── Connect prompt (shown when not authenticated) ────────────────────────────
const ConnectPrompt = ({ onNav }: { onNav: (p: string) => void }) => (
  <Glass className="p-8 text-center space-y-4 !border-blue-700/30 !bg-blue-950/10">
    <div className="flex justify-center">
      <svg viewBox="0 0 48 48" width="40" height="40"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
    </div>
    <div>
      <div className="font-semibold text-white">Connect Google Account</div>
      <div className="text-sm text-white/50 mt-1">Sign in with Google to access real Gmail, Calendar, Tasks, Contacts, and Drive data.</div>
    </div>
    <div className="grid grid-cols-3 gap-2 text-center text-xs text-white/50">
      {["📅 Calendar", "✅ Tasks", "🗺️ Maps", "📧 Gmail", "💾 Drive", "👥 Contacts"].map(s => (
        <div key={s} className="p-2 bg-black/40 border border-white/5 rounded-xl">{s}</div>
      ))}
    </div>
    <GBtn onClick={() => onNav("settings")} className="w-full">
      Connect in Settings → Integrations →
    </GBtn>
  </Glass>
);

// ─── Main component ───────────────────────────────────────────────────────────
export function GoogleWorkspacePage({
  settings = {} as AppSettings,
  setSettings,
  googleData = {},
  setGoogleData,
  customers = [],
  setCustomers,
  jobs = [],
  toast,
  onNav,
}: {
  settings?: AppSettings;
  setSettings?: any;
  googleData?: any;
  setGoogleData?: any;
  customers?: any[];
  setCustomers?: any;
  jobs?: any[];
  toast?: any;
  onNav?: any;
}) {
  const [tab, setTab] = useState("overview");

  // ── Per-tab data + status ──────────────────────────────────────────────────
  const [gmailMsgs,  setGmailMsgs]  = useState<GmailMessage[]>([]);
  const [gmailErr,   setGmailErr]   = useState("");
  const [gmailLoad,  setGmailLoad]  = useState(false);

  const [calEvents,  setCalEvents]  = useState<GCalEvent[]>([]);
  const [calErr,     setCalErr]     = useState("");
  const [calLoad,    setCalLoad]    = useState(false);

  const [tasks,      setTasks]      = useState<GTask[]>([]);
  const [tasksErr,   setTasksErr]   = useState("");
  const [tasksLoad,  setTasksLoad]  = useState(false);

  const [contacts,   setContacts]   = useState<GContact[]>([]);
  const [contErr,    setContErr]    = useState("");
  const [contLoad,   setContLoad]   = useState(false);

  const [driveFiles, setDriveFiles] = useState<GDriveFile[]>([]);
  const [driveErr,   setDriveErr]   = useState("");
  const [driveLoad,  setDriveLoad]  = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [composing,   setComposing]   = useState<{ to: string; subject: string; body: string } | null>(null);
  const [sendingMail, setSendingMail] = useState(false);
  const [taskFilter,  setTaskFilter]  = useState<"active" | "completed" | "all">("active");
  const [addingTask,  setAddingTask]  = useState(false);
  const [newTask,     setNewTask]     = useState({ title: "", notes: "", due: today() });
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEvent,    setNewEvent]    = useState({ title: "", start: today() + "T09:00", end: today() + "T10:00", location: "", description: "" });

  const token: string = (settings as any).googleToken || "";
  const isConnected = !!(settings as any).googleConnected && !!token;
  const calId: string = (settings as any).googleCalendarId || "primary";

  // ── Fetch functions ────────────────────────────────────────────────────────
  const loadGmail = useCallback(async () => {
    if (!token) return;
    setGmailLoad(true); setGmailErr("");
    try { setGmailMsgs(await fetchGmailMessages(token)); }
    catch (e: any) { setGmailErr(e.message || "Failed to load Gmail"); }
    finally { setGmailLoad(false); }
  }, [token]);

  const loadCalendar = useCallback(async () => {
    if (!token) return;
    setCalLoad(true); setCalErr("");
    try { setCalEvents(await fetchCalendarEvents(token, calId)); }
    catch (e: any) { setCalErr(e.message || "Failed to load Calendar"); }
    finally { setCalLoad(false); }
  }, [token, calId]);

  const loadTasks = useCallback(async () => {
    if (!token) return;
    setTasksLoad(true); setTasksErr("");
    try { setTasks(await fetchGTasks(token)); }
    catch (e: any) { setTasksErr(e.message || "Failed to load Tasks"); }
    finally { setTasksLoad(false); }
  }, [token]);

  const loadContacts = useCallback(async () => {
    if (!token) return;
    setContLoad(true); setContErr("");
    try { setContacts(await fetchGContacts(token)); }
    catch (e: any) { setContErr(e.message || "Failed to load Contacts"); }
    finally { setContLoad(false); }
  }, [token]);

  const loadDrive = useCallback(async () => {
    if (!token) return;
    setDriveLoad(true); setDriveErr("");
    try { setDriveFiles(await fetchGDriveFiles(token)); }
    catch (e: any) { setDriveErr(e.message || "Failed to load Drive"); }
    finally { setDriveLoad(false); }
  }, [token]);

  // Load all tabs on mount / when token changes
  useEffect(() => {
    if (!token) return;
    loadGmail();
    loadCalendar();
    loadTasks();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load contacts + drive lazily when tab is first opened
  useEffect(() => {
    if (!token) return;
    if (tab === "contacts" && contacts.length === 0 && !contLoad && !contErr) loadContacts();
    if (tab === "drive"    && driveFiles.length === 0 && !driveLoad && !driveErr) loadDrive();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────
  const doSendEmail = async () => {
    if (!composing || !composing.to || !composing.subject) return;
    setSendingMail(true);
    try {
      await sendGmailMessage(token, composing.to, composing.subject, composing.body);
      toast?.("Email sent ✓", "green");
      setComposing(null);
      loadGmail();
    } catch (e: any) {
      toast?.("Send failed: " + e.message, "red");
    } finally {
      setSendingMail(false);
    }
  };

  const doMarkRead = async (id: string) => {
    setGmailMsgs(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    try { await markGmailRead(token, id); } catch { /* silent */ }
  };

  const doAddTask = async () => {
    if (!newTask.title.trim()) return;
    const lists = await fetchGTasks(token).catch(() => [] as GTask[]);
    const listId = lists[0]?.listId || "@default";
    try {
      const created = await createGTask(token, listId, newTask);
      setTasks(prev => [created, ...prev]);
      toast?.("Task created in Google Tasks ✓", "green");
      setNewTask({ title: "", notes: "", due: today() });
      setAddingTask(false);
    } catch (e: any) {
      toast?.("Failed: " + e.message, "red");
    }
  };

  const doToggleTask = async (task: GTask) => {
    const newStatus = task.status === "completed" ? "needsAction" : "completed";
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await patchGTask(token, task.listId, task.id, { status: newStatus });
      toast?.(newStatus === "completed" ? "Task done ✓" : "Reopened", "green");
    } catch { /* optimistic already applied */ }
  };

  const doAddEvent = async () => {
    if (!newEvent.title.trim()) return;
    try {
      const id = await createGCalEvent(token, newEvent, calId);
      setCalEvents(prev => [{
        id,
        title: newEvent.title,
        start: newEvent.start,
        end: newEvent.end,
        location: newEvent.location,
        description: newEvent.description,
        attendees: [],
      }, ...prev]);
      toast?.("Event created in Google Calendar ✓", "green");
      setAddingEvent(false);
      setNewEvent({ title: "", start: today() + "T09:00", end: today() + "T10:00", location: "", description: "" });
    } catch (e: any) {
      toast?.("Failed: " + e.message, "red");
    }
  };

  const doDeleteEvent = async (id: string) => {
    setCalEvents(prev => prev.filter(e => e.id !== id));
    try {
      await deleteGCalEvent(token, id, calId);
      toast?.("Event deleted", "green");
    } catch { /* already removed from UI */ }
  };

  const doImportContact = (c: GContact) => {
    if (customers.some((cu: any) => cu.email === c.email)) { toast?.("Already in CRM"); return; }
    const newC = {
      id: Math.random().toString(36).slice(2),
      firstName: c.name.split(" ")[0] || c.name,
      lastName: c.name.split(" ").slice(1).join(" ") || "",
      email: c.email || "",
      phone: c.phone || "",
      address: "", totalSpent: 0, createdAt: today(),
      notes: "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "", tags: [],
    };
    setCustomers?.((prev: any[]) => [...prev, newC]);
    toast?.("Imported: " + c.name + " → Customers", "green");
  };

  const doDisconnect = async () => {
    await supabase.auth.signOut();
    setSettings?.((prev: any) => ({ ...prev, googleConnected: false, googleToken: "", googleRefreshToken: "", googleEmail: "", googleScopes: {} }));
    toast?.("Disconnected from Google", "green");
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs = [
    { k: "overview",  l: "Overview",  icon: Globe },
    { k: "gmail",     l: "Gmail",     icon: Mail },
    { k: "calendar",  l: "Calendar",  icon: Calendar },
    { k: "tasks",     l: "Tasks",     icon: CheckSquare },
    { k: "contacts",  l: "Contacts",  icon: Users },
    { k: "drive",     l: "Drive",     icon: Cloud },
  ];

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-red-500/20 border border-white/10">
            <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          </div>
          <div>
            <div className="font-bold">Google Workspace</div>
            <div className="text-[11px] text-red-400">Not connected</div>
          </div>
        </div>
        <ConnectPrompt onNav={onNav || (() => {})} />
      </div>
    );
  }

  const unread = gmailMsgs.filter(m => !m.read).length;
  const openTasks = tasks.filter(t => t.status !== "completed").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-green-500/20 border border-white/10">
            <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          </div>
          <div>
            <div className="font-bold">Google Workspace</div>
            <div className="text-[11px] text-green-400">✓ Connected as {(settings as any).googleEmail}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GBtn variant="ghost" onClick={() => { loadGmail(); loadCalendar(); loadTasks(); }} className="!text-xs">
            <RefreshCw size={12} className="inline mr-1.5" />Refresh
          </GBtn>
          <GBtn variant="ghost" onClick={doDisconnect} className="!text-xs !text-red-400">Disconnect</GBtn>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 flex-wrap">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition " + (tab === t.k ? "bg-blue-900/40 border-blue-500/50 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
              <Icon size={12} />{t.l}
              {t.k === "gmail" && unread > 0 && <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center">{unread}</span>}
              {t.k === "tasks" && openTasks > 0 && <span className="w-4 h-4 rounded-full bg-green-600 text-white text-[9px] flex items-center justify-center">{openTasks}</span>}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: Mail,        label: "Unread",     value: gmailLoad  ? "…" : unread + " emails"  },
              { icon: Calendar,    label: "Events",     value: calLoad    ? "…" : calEvents.length + " upcoming" },
              { icon: CheckSquare, label: "Open Tasks", value: tasksLoad  ? "…" : openTasks + " tasks" },
              { icon: Users,       label: "Contacts",   value: contLoad   ? "…" : contacts.length || "—"  },
              { icon: Cloud,       label: "Drive Files",value: driveLoad  ? "…" : driveFiles.length || "—" },
              { icon: Activity,    label: "Status",     value: "Live data" },
            ].map(s => (
              <Glass key={s.label} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon size={14} className="text-blue-400" />
                  <span className="text-[10px] text-white/50 uppercase tracking-wider">{s.label}</span>
                </div>
                <div className="text-lg font-bold">{s.value}</div>
              </Glass>
            ))}
          </div>

          {/* Unread emails preview */}
          {gmailMsgs.filter(m => !m.read).length > 0 && (
            <Glass className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm flex items-center gap-2"><Mail size={13} className="text-red-400" />Unread Emails</div>
                <button onClick={() => setTab("gmail")} className="text-[10px] text-red-400 hover:text-red-300">View all →</button>
              </div>
              <div className="space-y-2">
                {gmailMsgs.filter(m => !m.read).slice(0, 3).map(em => (
                  <div key={em.id} onClick={() => { doMarkRead(em.id); setComposing({ to: em.from.match(/<(.+)>/)?.[1] || em.from, subject: "Re: " + em.subject, body: "" }); setTab("gmail"); }}
                    className="flex items-start gap-3 p-2.5 bg-blue-950/20 border border-blue-800/30 rounded-lg hover:bg-blue-950/30 cursor-pointer">
                    <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{em.from.split("<")[0].trim()}</span>
                        <span className="text-[10px] text-white/40 flex-shrink-0">{relTime(em.date)}</span>
                      </div>
                      <div className="text-[11px] font-semibold truncate">{em.subject}</div>
                      <div className="text-[10px] text-white/50 truncate">{em.snippet}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Glass>
          )}

          {/* Upcoming events */}
          {calEvents.length > 0 && (
            <Glass className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm flex items-center gap-2"><Calendar size={13} className="text-blue-400" />Upcoming Events</div>
                <button onClick={() => setTab("calendar")} className="text-[10px] text-red-400 hover:text-red-300">View all →</button>
              </div>
              <div className="space-y-2">
                {calEvents.slice(0, 3).map(ev => (
                  <div key={ev.id} className="flex items-start gap-3 p-2.5 bg-black/40 border border-white/5 rounded-lg">
                    <div className="w-1 h-10 rounded-full bg-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{ev.title}</div>
                      <div className="text-[10px] text-white/50">{fmtDate(ev.start)} · {fmtTime(ev.start)}</div>
                      {ev.location && <div className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5"><MapPin size={8} />{ev.location}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Glass>
          )}

          {/* Open tasks */}
          {tasks.filter(t => t.status !== "completed").length > 0 && (
            <Glass className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm flex items-center gap-2"><CheckSquare size={13} className="text-green-400" />Open Tasks</div>
                <button onClick={() => setTab("tasks")} className="text-[10px] text-red-400 hover:text-red-300">View all →</button>
              </div>
              <div className="space-y-1.5">
                {tasks.filter(t => t.status !== "completed").slice(0, 4).map(tk => (
                  <div key={tk.id} onClick={() => doToggleTask(tk)}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <div className="w-4 h-4 rounded border border-white/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">{tk.title}</div>
                      {tk.due && <div className="text-[10px] text-white/40">{tk.due}</div>}
                    </div>
                    {tk.listTitle && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{tk.listTitle}</span>}
                  </div>
                ))}
              </div>
            </Glass>
          )}
        </div>
      )}

      {/* ── GMAIL ── */}
      {tab === "gmail" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold flex items-center gap-2"><Mail size={14} className="text-red-400" />{gmailMsgs.length} messages · {unread} unread</div>
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={loadGmail} className="!text-xs"><RefreshCw size={11} className="inline mr-1.5" />Refresh</GBtn>
              <GBtn onClick={() => setComposing({ to: "", subject: "", body: "" })} className="!text-xs"><Plus size={12} className="inline mr-1.5" />Compose</GBtn>
            </div>
          </div>

          {composing && (
            <Glass className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm">New Email</div>
                <button onClick={() => setComposing(null)} className="text-white/40 hover:text-white"><X size={14} /></button>
              </div>
              <div className="space-y-2">
                <GInput placeholder="To" value={composing.to} onChange={e => setComposing({ ...composing, to: e.target.value })} className="!text-xs" />
                <GInput placeholder="Subject" value={composing.subject} onChange={e => setComposing({ ...composing, subject: e.target.value })} className="!text-xs" />
                <GTxt rows={5} placeholder="Body…" value={composing.body} onChange={e => setComposing({ ...composing, body: e.target.value })} className="!text-xs" />
                <div className="flex gap-2 justify-end">
                  <GBtn variant="ghost" onClick={() => setComposing(null)} className="!text-xs">Cancel</GBtn>
                  <GBtn onClick={doSendEmail} disabled={!composing.to || !composing.subject || sendingMail} className="!text-xs">
                    {sendingMail ? <Loader size={11} className="inline mr-1.5 animate-spin" /> : <Send size={11} className="inline mr-1.5" />}
                    {sendingMail ? "Sending…" : "Send"}
                  </GBtn>
                </div>
              </div>
            </Glass>
          )}

          <Glass className="overflow-hidden">
            {gmailLoad && <LoadingState label="Gmail" />}
            {gmailErr && <ErrorState message={gmailErr} onRetry={loadGmail} />}
            {!gmailLoad && !gmailErr && gmailMsgs.length === 0 && <EmptyState label="No emails in inbox" action={loadGmail} />}
            {!gmailLoad && !gmailErr && gmailMsgs.map(em => {
              const senderName = em.from.split("<")[0].trim() || em.from;
              const senderEmail = em.from.match(/<(.+)>/)?.[1] || em.from;
              const inCRM = customers.some((c: any) => c.email === senderEmail);
              return (
                <div key={em.id} onClick={() => doMarkRead(em.id)}
                  className={"flex items-start gap-3 p-3.5 border-b border-white/5 hover:bg-white/5 cursor-pointer " + (!em.read ? "bg-blue-950/10" : "")}>
                  <div className={"w-2 h-2 rounded-full flex-shrink-0 mt-2 " + (!em.read ? "bg-blue-400" : "bg-white/20")} />
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
                  <button onClick={e => { e.stopPropagation(); setComposing({ to: senderEmail, subject: "Re: " + em.subject, body: "" }); }}
                    className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white flex-shrink-0" title="Reply">
                    <Send size={11} className="rotate-180" />
                  </button>
                </div>
              );
            })}
          </Glass>
        </div>
      )}

      {/* ── CALENDAR ── */}
      {tab === "calendar" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold flex items-center gap-2"><Calendar size={14} className="text-blue-400" />{calEvents.length} upcoming events</div>
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={loadCalendar} className="!text-xs"><RefreshCw size={11} className="inline mr-1.5" />Refresh</GBtn>
              <GBtn onClick={() => setAddingEvent(!addingEvent)} className="!text-xs"><Plus size={12} className="inline mr-1.5" />New Event</GBtn>
            </div>
          </div>

          {addingEvent && (
            <Glass className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm">New Calendar Event</div>
                <button onClick={() => setAddingEvent(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
              </div>
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
                  <GBtn onClick={doAddEvent} disabled={!newEvent.title.trim()} className="!text-xs"><Calendar size={11} className="inline mr-1.5" />Create</GBtn>
                </div>
              </div>
            </Glass>
          )}

          {calLoad && <LoadingState label="Calendar" />}
          {calErr && <ErrorState message={calErr} onRetry={loadCalendar} />}
          {!calLoad && !calErr && calEvents.length === 0 && <EmptyState label="No upcoming events in the next 60 days" />}
          {!calLoad && !calErr && (
            <div className="space-y-2">
              {calEvents.map(ev => (
                <Glass key={ev.id} className="p-4 hover:border-blue-500/30 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0 bg-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{ev.title}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-white/60 mt-1">
                        <Clock size={11} />{fmtDate(ev.start)} · {fmtTime(ev.start)} – {fmtTime(ev.end)}
                        {ev.location && <><span>·</span><MapPin size={10} />{ev.location}</>}
                      </div>
                      {ev.description && <div className="text-[10px] text-white/50 mt-1">{ev.description}</div>}
                      {ev.attendees.length > 0 && <div className="text-[10px] text-white/50 mt-1 flex items-center gap-1"><Users size={10} />{ev.attendees.join(", ")}</div>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {ev.htmlLink && <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white"><ExternalLink size={11} /></a>}
                      <button onClick={() => doDeleteEvent(ev.id)} className="p-1.5 rounded hover:bg-red-900/30 text-white/30 hover:text-red-400"><X size={11} /></button>
                    </div>
                  </div>
                </Glass>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TASKS ── */}
      {tab === "tasks" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="font-semibold flex items-center gap-2"><CheckSquare size={14} className="text-green-400" />Tasks</div>
              <div className="flex gap-1">
                {(["active", "completed", "all"] as const).map(f => (
                  <button key={f} onClick={() => setTaskFilter(f)}
                    className={"text-[11px] px-2.5 py-1 rounded-lg border transition capitalize " + (taskFilter === f ? "bg-green-900/40 border-green-500/50 text-white" : "bg-black/40 border-white/10 text-white/60")}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={loadTasks} className="!text-xs"><RefreshCw size={11} className="inline mr-1.5" />Refresh</GBtn>
              <GBtn onClick={() => setAddingTask(!addingTask)} className="!text-xs"><Plus size={12} className="inline mr-1.5" />New Task</GBtn>
            </div>
          </div>

          {addingTask && (
            <Glass className="p-4">
              <div className="space-y-2">
                <GInput autoFocus placeholder="Task title" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} onKeyDown={e => e.key === "Enter" && doAddTask()} className="!text-xs" />
                <GInput type="date" value={newTask.due} onChange={e => setNewTask({ ...newTask, due: e.target.value })} className="!text-xs" />
                <GTxt rows={2} placeholder="Notes (optional)" value={newTask.notes} onChange={e => setNewTask({ ...newTask, notes: e.target.value })} className="!text-xs" />
                <div className="flex gap-2 justify-end">
                  <GBtn variant="ghost" onClick={() => setAddingTask(false)} className="!text-xs">Cancel</GBtn>
                  <GBtn onClick={doAddTask} disabled={!newTask.title.trim()} className="!text-xs">Add Task</GBtn>
                </div>
              </div>
            </Glass>
          )}

          <Glass className="overflow-hidden">
            {tasksLoad && <LoadingState label="Tasks" />}
            {tasksErr && <ErrorState message={tasksErr} onRetry={loadTasks} />}
            {!tasksLoad && !tasksErr && tasks.length === 0 && <EmptyState label="No tasks found" action={loadTasks} />}
            {!tasksLoad && !tasksErr && tasks
              .filter(t => taskFilter === "all" || (taskFilter === "active" ? t.status !== "completed" : t.status === "completed"))
              .map(tk => (
                <div key={tk.id} onClick={() => doToggleTask(tk)}
                  className={"flex items-start gap-3 p-3.5 border-b border-white/5 hover:bg-white/5 cursor-pointer group " + (tk.status === "completed" ? "opacity-60" : "")}>
                  <div className={"w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition " + (tk.status === "completed" ? "bg-green-600 border-green-500" : "border-white/30 group-hover:border-green-400")}>
                    {tk.status === "completed" && <CheckSquare size={11} className="text-white" />}
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
          </Glass>
        </div>
      )}

      {/* ── CONTACTS ── */}
      {tab === "contacts" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold flex items-center gap-2"><Users size={14} className="text-purple-400" />{contacts.length} contacts</div>
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={loadContacts} className="!text-xs"><RefreshCw size={11} className="inline mr-1.5" />Refresh</GBtn>
              <div className="text-[10px] text-white/50 self-center">Click "Import" to add to CRM</div>
            </div>
          </div>
          <Glass className="overflow-hidden">
            {contLoad && <LoadingState label="Contacts" />}
            {contErr && <ErrorState message={contErr} onRetry={loadContacts} />}
            {!contLoad && !contErr && contacts.length === 0 && <EmptyState label="No contacts found" action={loadContacts} />}
            {!contLoad && !contErr && contacts.map(ct => {
              const inCRM = customers.some((c: any) => c.email === ct.email);
              return (
                <div key={ct.id} className="flex items-center gap-3 p-3.5 border-b border-white/5 hover:bg-white/5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center text-sm font-bold flex-shrink-0">{ct.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{ct.name}</div>
                    <div className="text-[11px] text-white/60 flex flex-wrap gap-2 mt-0.5">
                      {ct.email && <span className="flex items-center gap-1"><Mail size={9} />{ct.email}</span>}
                      {ct.phone && <span className="flex items-center gap-1"><Phone size={9} />{ct.phone}</span>}
                    </div>
                    {ct.company && <div className="text-[10px] text-white/40 mt-0.5">{ct.company}</div>}
                  </div>
                  {inCRM
                    ? <Badge tone="green">In CRM</Badge>
                    : <button onClick={() => doImportContact(ct)} className="px-2.5 py-1 rounded-lg text-[11px] bg-purple-900/30 border border-purple-700/40 text-purple-300 hover:bg-purple-900/50 whitespace-nowrap">Import</button>
                  }
                </div>
              );
            })}
          </Glass>
        </div>
      )}

      {/* ── DRIVE ── */}
      {tab === "drive" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold flex items-center gap-2"><Cloud size={14} className="text-green-400" />{driveFiles.length} files</div>
            <GBtn variant="ghost" onClick={loadDrive} className="!text-xs"><RefreshCw size={11} className="inline mr-1.5" />Refresh</GBtn>
          </div>
          <Glass className="overflow-hidden">
            {driveLoad && <LoadingState label="Drive" />}
            {driveErr && <ErrorState message={driveErr} onRetry={loadDrive} />}
            {!driveLoad && !driveErr && driveFiles.length === 0 && <EmptyState label="No files found in Drive" action={loadDrive} />}
            {!driveLoad && !driveErr && driveFiles.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-3.5 border-b border-white/5 hover:bg-white/5">
                <div className="text-2xl flex-shrink-0">{fileIcon(f.mimeType)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-[10px] text-white/50 mt-0.5 flex items-center gap-2">
                    {f.size ? <span>{fmtSize(f.size)}</span> : null}
                    {f.size && f.modifiedTime ? <span>·</span> : null}
                    {f.modifiedTime && <span>Modified {fmtDateLib(f.modifiedTime)}</span>}
                  </div>
                </div>
                {f.webViewLink && (
                  <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white">
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </Glass>
        </div>
      )}
    </div>
  );
}

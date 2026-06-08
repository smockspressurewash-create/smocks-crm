import React, { useState, useEffect, useCallback } from "react";
import {
  Mail, Calendar, CheckSquare, Users, Cloud, Globe,
  Loader, RefreshCw, Plus, Send, X, AlertCircle,
  ExternalLink, Activity, UserPlus, CheckCircle, Reply,
} from "lucide-react";
import type { AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { supabase } from "../../lib/supabase";
import {
  fetchGmailMessages, sendGmailMessage, markGmailRead,
  fetchCalendarEvents, fetchGTasks, createGTask, patchGTask,
  fetchGContacts, fetchGDriveFiles,
  type GmailMessage, type GCalEvent, type GTask, type GContact, type GDriveFile,
} from "../../lib/googleApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const fmtTime = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

// ─── Shared sub-components ────────────────────────────────────────────────────
const Spinner = () => (
  <div className="flex justify-center py-10">
    <Loader size={20} className="text-blue-400 animate-spin" />
  </div>
);

const ApiError = ({ msg, onRetry }: { msg: string; onRetry?: () => void }) => (
  <Glass className="p-4 !bg-red-950/20 !border-red-700/30">
    <div className="flex items-start gap-3">
      <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-red-300">{msg}</div>
        {msg.includes("401") && (
          <div className="text-xs text-white/50 mt-1">
            Your Google token has expired. Disconnect Google then reconnect to get a fresh token.
          </div>
        )}
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-white/30 hover:text-white transition flex-shrink-0">
          <RefreshCw size={12} />
        </button>
      )}
    </div>
  </Glass>
);

// ─── Gmail tab ────────────────────────────────────────────────────────────────
function GmailTab({ token, toast }: { token: string; toast?: any }) {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setMessages(await fetchGmailMessages(token)); }
    catch (e: any) { setError(e.message || "Failed to load Gmail"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!to || !subject || !body) return;
    setSending(true);
    try {
      await sendGmailMessage(token, to, subject, body);
      toast?.("Email sent!", "green");
      setComposing(false); setTo(""); setSubject(""); setBody("");
    } catch (e: any) { toast?.(e.message || "Send failed", "red"); }
    finally { setSending(false); }
  };

  const toggle = async (m: GmailMessage) => {
    setExpanded(expanded === m.id ? null : m.id);
    if (!m.read) {
      await markGmailRead(token, m.id).catch(() => {});
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, read: true } : x));
    }
  };

  const inputCls = "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <span className="text-xs text-white/30">{messages.length} messages</span>
        <div className="flex-1" />
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 rounded-xl text-xs font-medium text-white transition"
        >
          <Plus size={12} />Compose
        </button>
      </div>

      {error && <ApiError msg={error} onRetry={load} />}
      {loading ? <Spinner /> : messages.length === 0 ? (
        <Glass className="p-8 text-center text-sm text-white/40">Inbox is empty</Glass>
      ) : (
        <div className="space-y-1">
          {messages.map(m => (
            <button
              key={m.id}
              onClick={() => toggle(m)}
              className={"w-full text-left p-3 rounded-xl border transition " +
                (expanded === m.id
                  ? "bg-blue-950/30 border-blue-700/30"
                  : "bg-black/40 border-white/5 hover:border-white/10")}
            >
              <div className="flex items-start gap-3">
                <div className={"w-2 h-2 rounded-full mt-1.5 flex-shrink-0 " + (m.read ? "bg-white/15" : "bg-blue-400")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={"text-sm truncate " + (m.read ? "text-white/60" : "text-white font-medium")}>
                      {m.from.replace(/<[^>]+>/, "").trim() || m.from}
                    </span>
                    <span className="text-[11px] text-white/30 flex-shrink-0 ml-auto">{fmtDate(m.date)}</span>
                  </div>
                  <div className={"text-xs truncate " + (m.read ? "text-white/40" : "text-white/70")}>{m.subject}</div>
                  {expanded !== m.id && (
                    <div className="text-xs text-white/25 truncate">{m.snippet}</div>
                  )}
                  {expanded === m.id && (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs text-white/60 bg-black/40 rounded-lg p-3 leading-relaxed">
                        {m.snippet}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setComposing(true);
                            setTo(m.from);
                            setSubject("Re: " + m.subject);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                        >
                          <Reply size={11} />Reply
                        </button>
                        <a
                          href={`https://mail.google.com/mail/#inbox/${m.threadId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-white/30 hover:text-white flex items-center gap-1 transition"
                        >
                          <ExternalLink size={11} />Open in Gmail
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Compose modal */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setComposing(false)} />
          <Glass className="relative w-full max-w-md p-4 space-y-3 z-10 !border-blue-700/30">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">New Message</div>
              <button onClick={() => setComposing(false)} className="text-white/40 hover:text-white transition">
                <X size={15} />
              </button>
            </div>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="To" className={inputCls} />
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className={inputCls} />
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Message…" rows={6}
              className={inputCls + " resize-none"}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setComposing(false)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white transition">
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || !to || !subject || !body}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl text-xs font-medium text-white transition"
              >
                {sending ? <Loader size={11} className="animate-spin" /> : <Send size={11} />}
                Send
              </button>
            </div>
          </Glass>
        </div>
      )}
    </div>
  );
}

// ─── Calendar tab ─────────────────────────────────────────────────────────────
function GCalTab({ token }: { token: string }) {
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setEvents(await fetchCalendarEvents(token)); }
    catch (e: any) { setError(e.message || "Failed to load calendar"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <div className="flex-1" />
        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
        >
          <ExternalLink size={11} />Open Google Calendar
        </a>
      </div>
      {error && <ApiError msg={error} onRetry={load} />}
      {loading ? <Spinner /> : events.length === 0 ? (
        <Glass className="p-8 text-center text-sm text-white/40">No upcoming events in the next 60 days</Glass>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <Glass key={ev.id} className="p-3 !bg-blue-950/20 !border-blue-700/20">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{ev.title}</div>
                  <div className="text-xs text-blue-300/70 mt-0.5">
                    {fmtDate(ev.start)} · {fmtTime(ev.start)}{ev.end ? " – " + fmtTime(ev.end) : ""}
                  </div>
                  {ev.location && (
                    <div className="text-xs text-white/40 mt-0.5 truncate">📍 {ev.location}</div>
                  )}
                  {ev.description && (
                    <div className="text-xs text-white/30 mt-0.5 truncate">{ev.description}</div>
                  )}
                </div>
                {ev.htmlLink && (
                  <a
                    href={ev.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/20 hover:text-blue-400 flex-shrink-0 transition"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </Glass>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tasks tab ────────────────────────────────────────────────────────────────
function GTasksTab({ token, toast }: { token: string; toast?: any }) {
  const [tasks, setTasks] = useState<GTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTasks(await fetchGTasks(token)); }
    catch (e: any) { setError(e.message || "Failed to load tasks"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const addTask = async () => {
    const listId = tasks.find(t => t.listId)?.listId;
    if (!newTitle.trim() || !listId) { toast?.("No task list found", "red"); return; }
    try {
      const t = await createGTask(token, listId, { title: newTitle, due: newDue || undefined });
      setTasks(prev => [t, ...prev]);
      setNewTitle(""); setNewDue(""); setAdding(false);
      toast?.("Task created", "green");
    } catch (e: any) { toast?.(e.message, "red"); }
  };

  const toggle = async (t: GTask) => {
    const next = t.status === "completed" ? "needsAction" : "completed";
    try {
      await patchGTask(token, t.listId, t.id, { status: next });
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
    } catch (e: any) { toast?.(e.message, "red"); }
  };

  const pending = tasks.filter(t => t.status === "needsAction");
  const done = tasks.filter(t => t.status === "completed");
  const inputCls = "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <span className="text-xs text-white/30">{pending.length} pending</span>
        <div className="flex-1" />
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 rounded-xl text-xs font-medium text-white transition"
        >
          <Plus size={12} />New Task
        </button>
      </div>

      {adding && (
        <Glass className="p-3 space-y-2 !border-blue-700/30">
          <input
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Task title…" autoFocus className={inputCls}
          />
          <div className="flex gap-2">
            <input
              type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
              className={inputCls + " flex-1"}
            />
            <button
              onClick={addTask}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs text-white transition"
            >
              Add
            </button>
            <button
              onClick={() => { setAdding(false); setNewTitle(""); setNewDue(""); }}
              className="px-3 py-1.5 text-xs text-white/40 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </Glass>
      )}

      {error && <ApiError msg={error} onRetry={load} />}
      {loading ? <Spinner /> : (
        <div className="space-y-1">
          {pending.map(t => (
            <button
              key={t.id} onClick={() => toggle(t)}
              className="w-full flex items-center gap-3 p-3 bg-black/40 border border-white/5 hover:border-white/10 rounded-xl text-left transition group"
            >
              <div className="w-4 h-4 rounded-full border-2 border-blue-500/50 group-hover:border-blue-400 flex-shrink-0 transition" />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white">{t.title}</div>
                {t.due && <div className="text-xs text-white/40">{fmtDate(t.due)}</div>}
              </div>
              {t.listTitle && (
                <span className="text-[10px] text-blue-400/60 bg-blue-950/30 px-2 py-0.5 rounded-full flex-shrink-0">
                  {t.listTitle}
                </span>
              )}
            </button>
          ))}

          {done.length > 0 && (
            <>
              <div className="text-[10px] text-white/25 uppercase tracking-wider pt-2 pb-1 px-1">Completed</div>
              {done.slice(0, 5).map(t => (
                <button
                  key={t.id} onClick={() => toggle(t)}
                  className="w-full flex items-center gap-3 p-3 bg-black/20 border border-white/5 rounded-xl text-left opacity-40 hover:opacity-60 transition"
                >
                  <div className="w-4 h-4 rounded-full bg-blue-500/40 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  </div>
                  <div className="text-sm text-white line-through">{t.title}</div>
                </button>
              ))}
            </>
          )}

          {tasks.length === 0 && (
            <Glass className="p-8 text-center text-sm text-white/40">No tasks found</Glass>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Contacts tab ─────────────────────────────────────────────────────────────
function GContactsTab({
  token, customers, setCustomers, toast,
}: {
  token: string; customers: any[]; setCustomers: any; toast?: any;
}) {
  const [contacts, setContacts] = useState<GContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [imported, setImported] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setContacts(await fetchGContacts(token)); }
    catch (e: any) { setError(e.message || "Failed to load contacts"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const importContact = (c: GContact) => {
    const parts = c.name.split(" ");
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");
    setCustomers?.((prev: any[]) => [
      ...prev,
      {
        id: "c_" + Math.random().toString(36).slice(2, 9),
        firstName, lastName,
        email: c.email || "",
        phone: c.phone || "",
        address: "", city: "", state: "", zip: "",
        notes: c.company ? `Company: ${c.company}` : "",
        source: "google_contacts",
        createdAt: new Date().toISOString().slice(0, 10),
        tags: [],
      },
    ]);
    setImported(prev => new Set([...prev, c.id]));
    toast?.(`Imported ${c.name}`, "green");
  };

  const q = search.toLowerCase();
  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.email || "").toLowerCase().includes(q) ||
    (c.phone || "").includes(search)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts…"
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
        />
      </div>
      {error && <ApiError msg={error} onRetry={load} />}
      {loading ? <Spinner /> : (
        <div className="space-y-1">
          {filtered.slice(0, 60).map(c => {
            const inCrm = imported.has(c.id) ||
              (!!c.email && customers.some(cu => cu.email === c.email));
            return (
              <Glass key={c.id} className="p-3 flex items-center gap-3 !bg-black/40">
                <div className="w-8 h-8 rounded-full bg-blue-950/50 border border-blue-700/30 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-white/40 truncate">
                    {[c.email, c.phone, c.company].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {inCrm ? (
                  <span className="text-[11px] text-green-400/70 flex items-center gap-1 flex-shrink-0">
                    <CheckCircle size={11} />In CRM
                  </span>
                ) : (
                  <button
                    onClick={() => importContact(c)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 flex-shrink-0 transition"
                  >
                    <UserPlus size={11} />Import
                  </button>
                )}
              </Glass>
            );
          })}
          {filtered.length === 0 && (
            <Glass className="p-8 text-center text-sm text-white/40">No contacts found</Glass>
          )}
          {filtered.length > 60 && (
            <div className="text-xs text-center text-white/30 py-2">
              Showing 60 of {filtered.length} — use search to narrow results
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Drive tab ────────────────────────────────────────────────────────────────
function GDriveTab({ token }: { token: string }) {
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setFiles(await fetchGDriveFiles(token)); }
    catch (e: any) { setError(e.message || "Failed to load Drive"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const fileIcon = (mime: string) => {
    if (mime.includes("folder")) return "📁";
    if (mime.includes("pdf")) return "📄";
    if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
    if (mime.includes("document") || mime.includes("word")) return "📝";
    if (mime.includes("presentation") || mime.includes("powerpoint")) return "📑";
    if (mime.includes("image")) return "🖼️";
    if (mime.includes("video")) return "🎬";
    return "📎";
  };

  const fmtSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes > 1_048_576) return (bytes / 1_048_576).toFixed(1) + " MB";
    if (bytes > 1_024) return Math.round(bytes / 1_024) + " KB";
    return bytes + " B";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <span className="text-xs text-white/30">{files.length} files</span>
        <div className="flex-1" />
        <a
          href="https://drive.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
        >
          <ExternalLink size={11} />Open Drive
        </a>
      </div>
      {error && <ApiError msg={error} onRetry={load} />}
      {loading ? <Spinner /> : files.length === 0 ? (
        <Glass className="p-8 text-center text-sm text-white/40">No files found</Glass>
      ) : (
        <div className="space-y-1">
          {files.map(f => (
            <Glass key={f.id} className="p-3 flex items-center gap-3 !bg-black/40">
              <span className="text-lg flex-shrink-0">{fileIcon(f.mimeType)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{f.name}</div>
                <div className="text-xs text-white/30">
                  {[fmtSize(f.size), f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ""].filter(Boolean).join(" · ")}
                </div>
              </div>
              {f.webViewLink && f.webViewLink !== "#" && (
                <a
                  href={f.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/20 hover:text-blue-400 flex-shrink-0 transition"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </Glass>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connect prompt ───────────────────────────────────────────────────────────
const GoogleLogo = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 48 48" width={size} height={size}>
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
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

  const s = settings as any;
  const isConnected = !!s.googleConnected;
  const googleEmail: string = s.googleEmail || "";
  const token: string = s.googleProviderToken || "";
  const hasToken = !!token;

  const doConnect = async () => {
    const SCOPES = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/tasks",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/contacts",
    ].join(" ");
    const opts = {
      queryParams: { access_type: "offline", prompt: "consent" },
      scopes: SCOPES,
      redirectTo: window.location.origin + window.location.pathname,
    };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let error: any;
      if (user) {
        ({ error } = await supabase.auth.linkIdentity({ provider: "google", options: opts }));
      } else {
        ({ error } = await supabase.auth.signInWithOAuth({ provider: "google", options: opts }));
      }
      if (error) toast?.("Google connect failed: " + error.message, "red");
    } catch (e: any) {
      toast?.("Google connect failed: " + e.message, "red");
    }
  };

  const doDisconnect = async () => {
    setSettings?.((prev: any) => ({
      ...prev,
      googleConnected: false,
      googleEmail: "",
      googleProviderToken: "",
      googleScopes: {},
    }));
    toast?.("Google disconnected", "green");
  };

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
            <GoogleLogo />
          </div>
          <div>
            <div className="font-bold">Google Workspace</div>
            <div className="text-[11px] text-red-400">Not connected</div>
          </div>
        </div>
        <Glass className="p-8 text-center space-y-4 !border-blue-700/30 !bg-blue-950/10">
          <div className="flex justify-center"><GoogleLogo size={40} /></div>
          <div>
            <div className="font-semibold text-white">Connect Google Account</div>
            <div className="text-sm text-white/50 mt-1">
              Link Gmail, Calendar, Tasks, Drive, and Contacts directly in the CRM.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-white/50">
            {["📅 Calendar", "✅ Tasks", "📧 Gmail", "💾 Drive", "👥 Contacts", "🔒 Secure OAuth"].map(s => (
              <div key={s} className="p-2 bg-black/40 border border-white/5 rounded-xl">{s}</div>
            ))}
          </div>
          <button
            onClick={doConnect}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
          >
            <GoogleLogo size={18} />Sign in with Google
          </button>
        </Glass>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-green-500/20 border border-white/10">
            <GoogleLogo />
          </div>
          <div>
            <div className="font-bold">Google Workspace</div>
            <div className="text-[11px] text-green-400">✓ Connected as {googleEmail}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!hasToken && (
            <button
              onClick={doConnect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 rounded-xl text-xs text-white transition"
            >
              <RefreshCw size={11} />Refresh Token
            </button>
          )}
          <button
            onClick={doDisconnect}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/30 rounded-xl transition"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Token status */}
      {isConnected && !hasToken && (
        <Glass className="p-3 !bg-yellow-950/20 !border-yellow-700/20 flex items-center gap-3">
          <AlertCircle size={14} className="text-yellow-400 flex-shrink-0" />
          <div className="text-xs text-yellow-300/80">
            Google token not available in this session. Click <strong>Refresh Token</strong> to re-authorize and enable live data.
          </div>
        </Glass>
      )}

      {/* Scopes */}
      <Glass className="p-3 !bg-black/40">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Authorized scopes</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "📅 Calendar", k: "calendar" },
            { label: "📧 Gmail",    k: "gmail"    },
            { label: "✅ Tasks",    k: "tasks"    },
            { label: "💾 Drive",    k: "drive"    },
            { label: "👥 Contacts", k: "contacts" },
          ].map(sc => (
            <span key={sc.k} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-green-950/30 border border-green-700/30 text-green-300">
              {sc.label}
            </span>
          ))}
        </div>
      </Glass>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition whitespace-nowrap " +
                (tab === t.k
                  ? "bg-blue-900/40 border-blue-500/50 text-white"
                  : "bg-black/40 border-white/10 text-white/60 hover:text-white")}
            >
              <Icon size={12} />{t.l}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: Mail,        label: "Gmail",     desc: hasToken ? "Live inbox" : "Token needed", active: hasToken },
            { icon: Calendar,    label: "Calendar",  desc: hasToken ? "Live events" : "Token needed", active: hasToken },
            { icon: CheckSquare, label: "Tasks",     desc: hasToken ? "Live tasks" : "Token needed",  active: hasToken },
            { icon: Users,       label: "Contacts",  desc: hasToken ? "Live contacts" : "Token needed", active: hasToken },
            { icon: Cloud,       label: "Drive",     desc: hasToken ? "Live files" : "Token needed",  active: hasToken },
            { icon: Activity,    label: "Status",    desc: "Identity verified ✓", active: true },
          ].map(sc => (
            <Glass key={sc.label} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <sc.icon size={14} className={sc.active ? "text-green-400" : "text-yellow-400"} />
                <span className="text-[10px] text-white/50 uppercase tracking-wider">{sc.label}</span>
              </div>
              <div className="text-sm font-medium text-white/70">{sc.desc}</div>
            </Glass>
          ))}
        </div>
      )}

      {/* Tabs that need a token */}
      {tab !== "overview" && !hasToken && (
        <Glass className="p-6 text-center space-y-3 !bg-yellow-950/10 !border-yellow-700/20">
          <AlertCircle size={20} className="text-yellow-400 mx-auto" />
          <div className="text-sm text-white/70">
            A Google OAuth token is required to load live data. It's captured only during the OAuth redirect.
          </div>
          <button
            onClick={doConnect}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition"
          >
            <GoogleLogo size={16} />Re-authorize Google
          </button>
        </Glass>
      )}

      {tab === "gmail"    && hasToken && <GmailTab    token={token} toast={toast} />}
      {tab === "calendar" && hasToken && <GCalTab     token={token} />}
      {tab === "tasks"    && hasToken && <GTasksTab   token={token} toast={toast} />}
      {tab === "contacts" && hasToken && <GContactsTab token={token} customers={customers} setCustomers={setCustomers} toast={toast} />}
      {tab === "drive"    && hasToken && <GDriveTab   token={token} />}
    </div>
  );
}

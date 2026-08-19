// ─── Direct Google API calls ──────────────────────────────────────────────────
// All Google REST APIs support CORS for browser clients with a valid Bearer token.
// Token comes from Supabase OAuth (supabase.auth.signInWithOAuth with Google provider).

import { supabase } from "./supabase";

// Module-level token refresher — set by GoogleWorkspacePage when mounted.
// When a 401 is received, gFetch calls this to get a fresh access token before retrying.
let _tokenRefresher: (() => Promise<string>) | null = null;

export const setGoogleTokenRefresher = (fn: (() => Promise<string>) | null): void => {
  _tokenRefresher = fn;
};

const gFetch = async (url: string, token: string, opts: RequestInit = {}): Promise<unknown> => {
  const doReq = async (tok: string) => {
    const res = await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    if (res.status === 204) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`Google API ${res.status}: ${text.slice(0, 200)}`);
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  };

  try {
    return await doReq(token);
  } catch (e: any) {
    if (e.status === 401 && _tokenRefresher) {
      try {
        const newToken = await _tokenRefresher();
        return await doReq(newToken);
      } catch {
        throw new Error("Google API 401: Token expired and refresh failed. Please disconnect and reconnect Google.");
      }
    }
    throw e;
  }
};

// ─── Gmail ────────────────────────────────────────────────────────────────────

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  read: boolean;
}

// ISSUE 2 (round 9) — Gmail's `snippet` field comes back from the API
// pre-escaped as HTML entities (e.g. "Smock's" -> "Smock&#39;s") since Google
// generates it to be safely droppable straight into an HTML page. InboxPage
// renders message bodies as plain React text (`{m.body}`), which does NOT
// interpret entities — so they showed up completely literally instead of as
// the apostrophe/quote/etc. they represent. Decode the handful of entities
// Gmail actually emits in snippets before storing it as the message body.
const decodeHtmlEntities = (s: string): string =>
  (s || "")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

export const fetchGmailMessages = async (token: string): Promise<GmailMessage[]> => {
  const list = await gFetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX",
    token
  ) as { messages?: { id: string; threadId: string }[] };

  if (!list?.messages?.length) return [];

  const details = await Promise.all(
    list.messages.slice(0, 15).map(async m => {
      const msg = await gFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        token
      ) as { payload?: { headers?: { name: string; value: string }[] }; snippet?: string; labelIds?: string[] };
      const headers = msg.payload?.headers || [];
      const get = (name: string) => headers.find(h => h.name === name)?.value || "";
      return {
        id: m.id,
        threadId: m.threadId,
        from: get("From"),
        subject: get("Subject") || "(No subject)",
        snippet: decodeHtmlEntities(msg.snippet || ""),
        date: get("Date"),
        read: !(msg.labelIds || []).includes("UNREAD"),
      };
    })
  );
  return details;
};

// BUG FIX — see the matching encodeMimeSubject comment in lib/messaging.ts:
// a raw non-ASCII Subject (e.g. an em-dash) placed directly in an RFC 2822
// header without RFC 2047 encoding gets mangled by receiving mail clients.
const encodeMimeSubject = (subject: string): string => {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
};

// BUG FIX — same "sender shows whatever the connected Google account's own
// profile name is" issue as lib/messaging.ts's sendGmailRaw (see
// EMAIL_FROM_NAME there) — this path (GoogleWorkspacePage compose, InboxPage
// reply) had no From header at all. Duplicated rather than imported to avoid
// coupling this module to messaging.ts's import graph.
const EMAIL_FROM_NAME = "Crew Boss";
const formatFromHeader = (email: string, name: string): string => {
  if (!email) return "";
  const safeName = name.replace(/"/g, "");
  const encoded = /^[\x00-\x7F]*$/.test(safeName) ? safeName : encodeMimeSubject(safeName); // eslint-disable-line no-control-regex
  return `"${encoded}" <${email}>`;
};

export const sendGmailMessage = async (
  token: string,
  to: string,
  subject: string,
  body: string,
  fromEmail?: string
): Promise<void> => {
  // fromEmail is optional (callers don't always have it handy) — Gmail's
  // send API fills in the authenticated account's real address regardless
  // of what this header says, so omitting it entirely when unknown is safe;
  // a bare display name with no <email> would be a malformed header.
  const fromHeader = fromEmail ? formatFromHeader(fromEmail, EMAIL_FROM_NAME) : "";
  const message = `${fromHeader ? `From: ${fromHeader}\r\n` : ""}To: ${to}\r\nSubject: ${encodeMimeSubject(subject)}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
  const raw = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  await gFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", token, {
    method: "POST",
    body: JSON.stringify({ raw }),
  });
};

export const markGmailRead = async (token: string, messageId: string): Promise<void> => {
  await gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, token, {
    method: "POST",
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
};

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface GCalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  attendees: string[];
  color?: string;
  htmlLink?: string;
}

export const fetchCalendarEvents = async (token: string, calendarId = "primary"): Promise<GCalEvent[]> => {
  const now = new Date().toISOString();
  const maxDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const data = await gFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${now}&timeMax=${maxDate}&maxResults=25&singleEvents=true&orderBy=startTime`,
    token
  ) as { items?: any[] };

  return (data?.items || []).map((ev: any) => ({
    id: ev.id,
    title: ev.summary || "(No title)",
    start: ev.start?.dateTime || ev.start?.date || "",
    end: ev.end?.dateTime || ev.end?.date || "",
    location: ev.location || "",
    description: ev.description || "",
    attendees: (ev.attendees || []).map((a: any) => a.email as string),
    color: ev.colorId || "blue",
    htmlLink: ev.htmlLink || "",
  }));
};

export const createGCalEvent = async (
  token: string,
  event: { title: string; start: string; end: string; location?: string; description?: string },
  calendarId = "primary"
): Promise<string> => {
  const data = await gFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        summary: event.title,
        location: event.location || "",
        description: event.description || "",
        start: { dateTime: event.start },
        end: { dateTime: event.end },
      }),
    }
  ) as { id: string };
  return data.id;
};

export const updateGCalEvent = async (
  token: string,
  eventId: string,
  patch: Partial<{ title: string; start: string; end: string; location: string; description: string }>,
  calendarId = "primary"
): Promise<void> => {
  const body: Record<string, unknown> = {};
  if (patch.title) body.summary = patch.title;
  if (patch.location !== undefined) body.location = patch.location;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.start) body.start = { dateTime: patch.start };
  if (patch.end) body.end = { dateTime: patch.end };
  await gFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    token,
    { method: "PATCH", body: JSON.stringify(body) }
  );
};

export const deleteGCalEvent = async (token: string, eventId: string, calendarId = "primary"): Promise<void> => {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface GTask {
  id: string;
  listId: string;
  title: string;
  notes?: string;
  due?: string;
  status: "needsAction" | "completed";
  listTitle?: string;
  completed?: string;
}

export const fetchGTasks = async (token: string): Promise<GTask[]> => {
  const lists = await gFetch(
    "https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=10",
    token
  ) as { items?: { id: string; title: string }[] };

  const allTasks: GTask[] = [];
  for (const list of (lists?.items || []).slice(0, 5)) {
    const data = await gFetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=true&maxResults=25`,
      token
    ) as { items?: any[] };
    (data?.items || []).forEach((t: any) => {
      allTasks.push({
        id: t.id,
        listId: list.id,
        title: t.title || "(No title)",
        notes: t.notes || "",
        due: t.due ? (t.due as string).slice(0, 10) : "",
        status: t.status || "needsAction",
        listTitle: list.title,
        completed: t.completed || "",
      });
    });
  }
  return allTasks;
};

export const createGTask = async (
  token: string,
  listId: string,
  task: { title: string; notes?: string; due?: string }
): Promise<GTask> => {
  const body: Record<string, unknown> = { title: task.title };
  if (task.notes) body.notes = task.notes;
  if (task.due) body.due = task.due + "T00:00:00.000Z";
  const data = await gFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`,
    token,
    { method: "POST", body: JSON.stringify(body) }
  ) as any;
  return { id: data.id, listId, title: data.title, notes: data.notes, due: data.due?.slice(0, 10), status: data.status };
};

export const patchGTask = async (
  token: string,
  listId: string,
  taskId: string,
  patch: { status?: "needsAction" | "completed" }
): Promise<void> => {
  await gFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    token,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
};

export const deleteGTask = async (token: string, listId: string, taskId: string): Promise<void> => {
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google API ${res.status}: ${text.slice(0, 200)}`);
  }
};

// ─── Contacts ────────────────────────────────────────────────────────────────

export interface GContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

export const fetchGContacts = async (token: string): Promise<GContact[]> => {
  const data = await gFetch(
    "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=100&sortOrder=LAST_MODIFIED_DESCENDING",
    token
  ) as { connections?: any[] };

  return (data?.connections || [])
    .map((p: any) => ({
      id: p.resourceName as string,
      name: (p.names?.[0]?.displayName as string) || "Unknown",
      email: p.emailAddresses?.[0]?.value as string | undefined,
      phone: p.phoneNumbers?.[0]?.value as string | undefined,
      company: p.organizations?.[0]?.name as string | undefined,
    }))
    .filter(c => c.name !== "Unknown");
};

// ─── Per-employee Google token persistence ────────────────────────────────────
// Employee OAuth tokens are stored in localStorage keyed by the employee's own
// Supabase user ID, so each employee's browser only ever sees their own token.

export interface EmpGoogleToken {
  token: string;
  refreshToken?: string;
  email: string;
  expiresAt: number;
}

const empGoogleKey = (userId: string) => `smocks.empGoogle.${userId}`;

export const saveEmpGoogleToken = (userId: string, data: EmpGoogleToken): void => {
  try { localStorage.setItem(empGoogleKey(userId), JSON.stringify(data)); } catch { /* ignore */ }
};

export const getEmpGoogleToken = (userId: string): EmpGoogleToken | null => {
  try {
    const raw = localStorage.getItem(empGoogleKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const clearEmpGoogleToken = (userId: string): void => {
  try { localStorage.removeItem(empGoogleKey(userId)); } catch { /* ignore */ }
};

export const isEmpGoogleTokenValid = (t: EmpGoogleToken | null): boolean =>
  !!t && !!t.token && t.expiresAt > Date.now();

// ─── Token refresh ──────────────────────────────────────────────────────────
// ITEM 10 — Google access tokens last ~1hr; refreshing requires the OAuth
// client secret, which never belongs in frontend code. This used to call
// `${backendUrl}/google/refresh`, but backendUrl was never configurable
// anywhere (no Settings field existed for it) — meaning this always
// silently returned null and every employee's Google link effectively could
// never self-heal after the first hour. Defaults to this project's own
// same-origin Cloudflare Pages Function (functions/api/google-refresh.ts,
// holding GOOGLE_CLIENT_ID/SECRET as env vars) unless an explicit
// self-hosted backendUrl override is given.
// FIX 2 (Gmail/Google infinite-retry loop) — same Cloudflare Function as
// lib/messaging.ts's refreshGoogleAccessToken; it returns a recognizable error
// when GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET simply haven't been set in the
// Cloudflare Pages dashboard yet. That's a permanent config gap (every call
// fails identically until it's fixed), not a transient one — tag it so callers
// (the periodic refresh interval in EmployeePortal, GoogleWorkspacePage, etc.)
// can show a clear "reconnect isn't configured yet" message instead of
// silently retrying forever on their own timers.
export const refreshEmpGoogleToken = async (
  backendUrl: string | undefined,
  refreshToken: string
): Promise<{ token: string; expiresAt: number; configMissing: boolean } | null> => {
  if (!refreshToken) return null;
  const endpoint = backendUrl ? `${backendUrl}/google/refresh` : "/api/google-refresh";
  console.log("[GoogleConnect] calling Cloudflare Function:", endpoint);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || !data?.access_token) {
      const errMsg = String(data?.error || res.status);
      const configMissing = /GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET/i.test(errMsg);
      console.warn("[GoogleToken] employee token refresh failed:", errMsg, configMissing ? "— Cloudflare env vars not set" : "");
      return configMissing ? { token: "", expiresAt: 0, configMissing: true } : null;
    }
    console.log("[GoogleConnect] Cloudflare Function responded with a fresh access_token, expires_in:", data.expires_in);
    return { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3300) * 1000, configMissing: false };
  } catch (e: any) {
    console.warn("[GoogleToken] employee token refresh threw:", e?.message);
    return null;
  }
};

// Point-of-use guard: returns a valid access token, transparently refreshing
// first if the stored one has expired. The 5-minute background interval that
// calls refreshEmpGoogleToken proactively still exists, but relying on that
// alone leaves a gap right after expiry and before the next tick — any
// feature that actually needs the token (calendar sync, reminder emails)
// should call this instead of just checking isEmpGoogleTokenValid and giving
// up, so a stale token only blocks the user if a real refresh attempt fails.
export const getValidEmpGoogleToken = async (
  userId: string,
  backendUrl?: string
): Promise<EmpGoogleToken | null> => {
  const existing = getEmpGoogleToken(userId);
  if (isEmpGoogleTokenValid(existing)) return existing;
  if (!existing?.refreshToken) return null;
  const refreshed = await refreshEmpGoogleToken(backendUrl, existing.refreshToken);
  if (!refreshed?.token) return null;
  const updated: EmpGoogleToken = { ...existing, token: refreshed.token, expiresAt: refreshed.expiresAt };
  saveEmpGoogleToken(userId, updated);
  // FIX 10 (mobile round 6) — this used to only persist to localStorage. If
  // that browser's storage was cleared (or a second device was used) before
  // the separate 5-minute background interval's next tick ran, this
  // successful on-demand refresh was lost even though it worked — the
  // employees row never learned about it. Mirror it to Supabase too, same
  // columns/shape the background interval writes.
  (supabase as any).from("employees")
    .update({ google_token: refreshed.token, google_token_expires_at: new Date(refreshed.expiresAt).toISOString() })
    .eq("user_id", userId)
    .catch(() => {});
  return updated;
};

// ─── Drive ───────────────────────────────────────────────────────────────────

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
}

export const fetchGDriveFiles = async (token: string): Promise<GDriveFile[]> => {
  const data = await gFetch(
    "https://www.googleapis.com/drive/v3/files?pageSize=30&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&orderBy=modifiedTime+desc",
    token
  ) as { files?: GDriveFile[] };
  return data?.files || [];
};

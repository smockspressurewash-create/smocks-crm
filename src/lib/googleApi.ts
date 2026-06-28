// ─── Direct Google API calls ──────────────────────────────────────────────────
// All Google REST APIs support CORS for browser clients with a valid Bearer token.
// Token comes from Supabase OAuth (supabase.auth.signInWithOAuth with Google provider).

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
        snippet: msg.snippet || "",
        date: get("Date"),
        read: !(msg.labelIds || []).includes("UNREAD"),
      };
    })
  );
  return details;
};

export const sendGmailMessage = async (
  token: string,
  to: string,
  subject: string,
  body: string
): Promise<void> => {
  const message = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
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
// Google access tokens last ~1hr; refreshing requires the OAuth client secret,
// which never belongs in frontend code, so this calls an optional self-hosted
// backend (the same googleBackendUrl already used for Calendar/Drive/Gmail
// proxying) that holds the secret server-side. Without a backend configured,
// there's no way to refresh client-side — the caller should fall back to
// asking the user to reconnect, but only after this returns null.
export const refreshEmpGoogleToken = async (
  backendUrl: string,
  refreshToken: string
): Promise<{ token: string; expiresAt: number } | null> => {
  if (!backendUrl || !refreshToken) return null;
  try {
    const res = await fetch(`${backendUrl}/google/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data?.access_token) return null;
    return { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3300) * 1000 };
  } catch {
    return null;
  }
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

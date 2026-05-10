// ===== GOOGLE WORKSPACE API LAYER =====
import { today } from './utils';

// Authenticated fetch through backend proxy
export const googleFetch = async (backendUrl: string, token: string, endpoint: string, opts: any = {}) => {
  if (!backendUrl || !token) throw new Error("Google not connected. Set backend URL and token in Settings → Integrations.");
  const url = backendUrl.replace(/\/$/, "") + "/api/google" + endpoint;
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, ...(opts.headers || {}) } });
  if (!res.ok) { const err = await res.text().catch(() => ""); throw new Error("Google API " + res.status + (err ? ": " + err.slice(0, 200) : "")); }
  return res.json();
};

export const fetchGmailInbox = async (backendUrl: string, token: string, maxResults = 20) =>
  googleFetch(backendUrl, token, `/gmail/messages?maxResults=${maxResults}`);

export const sendGmailEmail = async (backendUrl: string, token: string, { to, subject, body, cc, bcc, replyToMessageId }: any) =>
  googleFetch(backendUrl, token, "/gmail/send", { method: "POST", body: JSON.stringify({ to, subject, body, cc, bcc, replyToMessageId }) });

export const fetchCalendarEvents = async (backendUrl: string, token: string, days = 14) =>
  googleFetch(backendUrl, token, `/calendar/events?days=${days}`);

export const createCalendarEvent = async (backendUrl: string, token: string, { title, start, end, description, location, attendees }: any) =>
  googleFetch(backendUrl, token, "/calendar/events", { method: "POST", body: JSON.stringify({ title, start, end, description, location, attendees }) });

export const fetchTasks = async (backendUrl: string, token: string, showCompleted = false) =>
  googleFetch(backendUrl, token, `/tasks?completed=${showCompleted}`);

export const createTask = async (backendUrl: string, token: string, { title, notes, due, listId }: any) =>
  googleFetch(backendUrl, token, "/tasks", { method: "POST", body: JSON.stringify({ title, notes, due, listId }) });

export const completeTask = async (backendUrl: string, token: string, taskId: string) =>
  googleFetch(backendUrl, token, `/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });

export const fetchContacts = async (backendUrl: string, token: string, pageSize = 50) =>
  googleFetch(backendUrl, token, `/contacts?pageSize=${pageSize}`);

export const createContact = async (backendUrl: string, token: string, { firstName, lastName, email, phone, company, notes }: any) =>
  googleFetch(backendUrl, token, "/contacts", { method: "POST", body: JSON.stringify({ firstName, lastName, email, phone, company, notes }) });

export const fetchDriveFiles = async (backendUrl: string, token: string, query = "", folderId = "") => {
  const params = new URLSearchParams({ ...(query && { q: query }), ...(folderId && { folderId }) });
  return googleFetch(backendUrl, token, `/drive/files?${params}`);
};

export const uploadToDrive = async (backendUrl: string, token: string, { filename, content, mimeType, folderId }: any) =>
  googleFetch(backendUrl, token, "/drive/upload", { method: "POST", body: JSON.stringify({ filename, content, mimeType, folderId }) });

export const createGoogleCalendarEvent = async (settings: any, job: any, customer: any) => {
  const { googleBackendUrl: url, googleToken: token, googleScopes: scopes } = settings;
  if (!url || !token || !scopes?.calendar) return null;
  const startDate = job.scheduledDate || today();
  const event = {
    summary: (customer ? customer.firstName + " " + customer.lastName + " — " : "") + (job.address?.split(",")[0] || "Pressure Wash"),
    description: "Job: " + (job.address || "") + "\nAmount: $" + (job.amount || 0) + "\nService notes: " + (job.notes || "—"),
    location: job.address || "",
    start: { date: startDate },
    end: { date: startDate },
    colorId: "11"
  };
  try {
    const calId = settings.googleCalendarId || "primary";
    const res = await fetch(url + "/calendar/events?calendarId=" + encodeURIComponent(calId), { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }, body: JSON.stringify(event) });
    if (!res.ok) throw new Error("Calendar sync failed");
    return await res.json();
  } catch { return null; }
};

export const syncAllGoogle = async (settings: any, setGoogleData: any) => {
  const { googleBackendUrl: url, googleToken: token, googleScopes: scopes } = settings;
  if (!url || !token) throw new Error("Backend URL and token required");
  const results: any = {};
  const errors: string[] = [];
  const tryFetch = async (key: string, fn: () => Promise<any>) => {
    try { results[key] = await fn(); } catch (e: any) { errors.push(key + ": " + e.message); }
  };
  await Promise.all([
    scopes?.gmail && tryFetch("emails", () => fetchGmailInbox(url, token, 30)),
    scopes?.calendar && tryFetch("events", () => fetchCalendarEvents(url, token, 14)),
    scopes?.tasks && tryFetch("tasks", () => fetchTasks(url, token)),
    scopes?.contacts && tryFetch("contacts", () => fetchContacts(url, token, 100)),
    scopes?.drive && tryFetch("files", () => fetchDriveFiles(url, token))
  ].filter(Boolean));
  setGoogleData((prev: any) => ({ ...prev, ...results, lastSync: new Date().toISOString(), syncErrors: errors }));
  return { synced: Object.keys(results), errors };
};

export const MOCK_GOOGLE_DATA = {
  emails: [
    { id: "em1", threadId: "th1", snippet: "Hi! Just wanted to confirm the appointment for next Tuesday at 9am...", from: "Jennifer Walsh <jwalsh@email.com>", subject: "Re: Pressure wash appointment", date: "2026-04-24T10:32:00Z", read: false, labels: ["INBOX"] },
    { id: "em2", threadId: "th2", snippet: "Your invoice #J4 for $1,674.80 is attached. Please remit by...", from: "billing@quickbooks.com", subject: "Invoice Ready", date: "2026-04-23T14:12:00Z", read: true, labels: ["INBOX"] },
    { id: "em3", threadId: "th3", snippet: "Thanks for the great work on our driveway! The neighbors already...", from: "Mike Harrison <mharrison@gmail.com>", subject: "Excellent service!", date: "2026-04-22T09:05:00Z", read: false, labels: ["INBOX"] },
    { id: "em4", threadId: "th4", snippet: "We'd like to get a quote for our HOA community — 24 homes...", from: "hoa@springgrove.org", subject: "HOA Community Quote Request", date: "2026-04-21T16:45:00Z", read: false, labels: ["INBOX"] },
    { id: "em5", threadId: "th5", snippet: "Your supply order has shipped. Tracking: 1Z999AA10123456784...", from: "noreply@pressuretek.com", subject: "Order Shipped - SH 12.5%", date: "2026-04-20T11:30:00Z", read: true, labels: ["INBOX"] }
  ],
  events: [
    { id: "ev1", title: "Pressure Wash - Harrison Residence", start: "2026-04-26T09:00:00", end: "2026-04-26T12:00:00", location: "412 Oak Ridge Ln, York PA", description: "Full house soft wash + driveway", attendees: ["tyler@smocks.com"], color: "blue" },
    { id: "ev2", title: "HOA Quote - Spring Grove", start: "2026-04-27T14:00:00", end: "2026-04-27T15:00:00", location: "923 Birch Ave, Spring Grove PA", description: "Walk-through for community quote", attendees: ["sam@smocks.com"], color: "green" },
    { id: "ev3", title: "Equipment Maintenance - Red Rig", start: "2026-04-28T08:00:00", end: "2026-04-28T09:30:00", location: "Shop", description: "Oil change + pressure check", attendees: [], color: "red" },
    { id: "ev4", title: "Crew Training - Roof Soft Wash", start: "2026-04-29T07:30:00", end: "2026-04-29T09:00:00", location: "Shop", description: "Safety + technique refresher", attendees: ["tyler@smocks.com", "sam@smocks.com"], color: "purple" }
  ],
  tasks: [
    { id: "tk1", title: "Follow up — Walsh quote ($742)", due: "2026-04-26", status: "needsAction", notes: "Sent 4 days ago, no response", listTitle: "Work" },
    { id: "tk2", title: "Order more SH 12.5% — stock low", due: "2026-04-25", status: "needsAction", notes: "Down to 35 gal, need 55 gal drum", listTitle: "Supplies" },
    { id: "tk3", title: "Send Harrison invoice", due: "2026-04-24", status: "completed", notes: "", listTitle: "Billing" },
    { id: "tk4", title: "Renew General Liability insurance", due: "2026-05-01", status: "needsAction", notes: "Expires May 15", listTitle: "Admin" },
    { id: "tk5", title: "Respond to HOA email", due: "2026-04-25", status: "needsAction", notes: "24-home community, big opportunity", listTitle: "Sales" }
  ],
  contacts: [
    { id: "ct1", name: "Jennifer Walsh", email: "jwalsh@email.com", phone: "(717) 555-0201", company: "", notes: "Recurring quarterly" },
    { id: "ct2", name: "Mike Harrison", email: "mharrison@gmail.com", phone: "(717) 555-0301", company: "", notes: "Referred 2 neighbors" },
    { id: "ct3", name: "Springfield HOA", email: "hoa@springgrove.org", phone: "(717) 555-0401", company: "Spring Grove HOA", notes: "24 homes, big opportunity" },
    { id: "ct4", name: "Tyler Brooks", email: "tyler@smocks.com", phone: "(717) 555-0501", company: "Smock's", notes: "Lead Technician" }
  ],
  files: [
    { id: "fl1", name: "Invoice_J4_SpringGrove.pdf", mimeType: "application/pdf", size: 48200, modifiedTime: "2026-04-22T14:00:00Z", webViewLink: "#" },
    { id: "fl2", name: "COI_2026.pdf", mimeType: "application/pdf", size: 128000, modifiedTime: "2026-01-15T09:00:00Z", webViewLink: "#" },
    { id: "fl3", name: "Before_After_Harrison.jpg", mimeType: "image/jpeg", size: 3200000, modifiedTime: "2026-04-22T13:30:00Z", webViewLink: "#" },
    { id: "fl4", name: "Crew_Schedule_April.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 24000, modifiedTime: "2026-04-18T10:00:00Z", webViewLink: "#" }
  ],
  lastSync: null
};

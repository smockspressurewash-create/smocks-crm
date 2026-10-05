// Alfred Cockpit ↔ Claude Code bridge.
//
// The owner (smockspressurewash@gmail.com) files bugs / ideas / questions on
// the in-app "Alfred Cockpit" board (CockpitPage.tsx → cockpit_items).
// Claude Code — run by .github/workflows/cockpit.yml, or by hand with
// /cockpit — reads open items here, works them, and writes status, notes,
// progress and a preview link back. Claude Code runs on a Claude
// subscription, not paid API credits.
//
// Auth: a shared secret in the `x-cockpit-key` header, matching the
// COCKPIT_SYNC_KEY Cloudflare env var. Reads/writes use the service role.
//
// GET  /api/cockpit-sync            → open items (backlog + in_progress), oldest first
// GET  /api/cockpit-sync?all=1      → every item
// POST /api/cockpit-sync  { id, status?, note?, progress?, progressLabel?, previewUrl? }
//      status: "backlog" | "in_progress" | "done"; note is appended to
//      claude_notes with a timestamp; progress 0–100 (null clears);
//      previewUrl "" clears. progress/progressLabel/previewUrl need
//      migration 0100 — without it they're skipped and the rest still saves.
// POST /api/cockpit-sync?wake=1     → (owner's Supabase session) start the GitHub run now

import { sendWebPush } from "./_lib/webPush";

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const VAPID_PUBLIC_KEY = "BFqKy2PtHrcVhocXAUh9rCTn6C1PEXIk0X_jyY7xwWBeH6r8w7ybe7lQEtNdtA8luYVn2s0j77XPYJiTCyTfAYA";
const COCKPIT_OWNER_EMAIL = "smockspressurewash@gmail.com";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const sameSecret = (a: string, b: string) => {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const authorize = (context: { request: Request; env: Record<string, string> }): Response | null => {
  const expected = context.env.COCKPIT_SYNC_KEY || "";
  if (!expected) return json({ error: "COCKPIT_SYNC_KEY isn't set in Cloudflare Pages → Settings → Variables." }, 503);
  if (!context.env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "SUPABASE_SERVICE_ROLE_KEY isn't set." }, 503);
  if (!sameSecret(context.request.headers.get("x-cockpit-key") || "", expected)) return json({ error: "Unauthorized" }, 401);
  return null;
};

const db = (serviceRoleKey: string, path: string, init?: RequestInit) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });

export const onRequestGet = async (context: { request: Request; env: Record<string, string> }) => {
  const denied = authorize(context); if (denied) return denied;
  const all = new URL(context.request.url).searchParams.get("all") === "1";
  const filter = all ? "" : "&status=in.(backlog,in_progress)";
  const res = await db(context.env.SUPABASE_SERVICE_ROLE_KEY, `cockpit_items?select=*${filter}&order=created_at.asc`);
  const rows = await res.json().catch(() => null);
  if (!res.ok) return json({ error: "Couldn't read cockpit_items", detail: rows }, 502);
  return json({ items: rows });
};

// The signed-in owner's email (from the request's Supabase session), or null.
const ownerFromSession = async (context: { request: Request; env: Record<string, string> }): Promise<string | null> => {
  const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) return null;
  const anonKey = context.env.SUPABASE_ANON_KEY || "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
  const user = who.ok ? await who.json().catch(() => null) as any : null;
  const email = String(user?.email || "").toLowerCase();
  return email === COCKPIT_OWNER_EMAIL ? email : null;
};

// POST /api/cockpit-sync?previewLogin=1 { previewUrl } (owner session) →
// { url }: a one-time link that opens the preview already signed in.
// A preview lives on its own web address, so it can't see the owner's
// sign-in from the live app. This creates a fresh, separate session for the
// same account (a Supabase magic link generated server-side — no email is
// sent), leaving the live app's session untouched. Supabase must allow
// https://*.smocks-crm.pages.dev/** as a redirect URL, otherwise the link
// lands on the live site instead.
const previewLogin = async (context: { request: Request; env: Record<string, string> }) => {
  const email = await ownerFromSession(context);
  if (!email) return json({ error: "Unauthorized" }, 401);
  const body = await context.request.json().catch(() => ({})) as { previewUrl?: string };
  const previewUrl = String(body.previewUrl || "").replace(/\/?$/, "/");
  if (!/^https:\/\/[a-z0-9-]+\.smocks-crm\.pages\.dev\/$/.test(previewUrl)) return json({ error: "Not a CrewBoss preview link" }, 400);
  const key = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return json({ error: "SUPABASE_SERVICE_ROLE_KEY isn't set." }, 503);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email, redirect_to: previewUrl }),
  });
  const data = await res.json().catch(() => null) as any;
  const url = data?.action_link || data?.properties?.action_link;
  if (!res.ok || !url) return json({ error: "Couldn't create a sign-in link for the preview", detail: data?.msg || data?.error_description || res.status }, 502);
  return json({ url });
};

// Start the GitHub Actions run right away instead of waiting for the next
// scheduled check. Needs GITHUB_DISPATCH_TOKEN in Cloudflare: a fine-grained
// GitHub token for this repo with "Actions: Read and write". Without it,
// items still get picked up by the schedule.
const wake = async (context: { request: Request; env: Record<string, string> }) => {
  const token = context.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return json({ woke: false, reason: "GITHUB_DISPATCH_TOKEN not set — the next scheduled check will pick it up." });
  if (!(await ownerFromSession(context))) return json({ error: "Unauthorized" }, 401);
  const gh = await fetch("https://api.github.com/repos/smockspressurewash-create/smocks-crm/actions/workflows/cockpit.yml/dispatches", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "crewboss-cockpit", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "master" }),
  });
  if (!gh.ok) return json({ woke: false, reason: `GitHub refused (${gh.status}) — check GITHUB_DISPATCH_TOKEN.` }, 502);
  return json({ woke: true });
};

const OPTIONAL_COLUMNS = ["progress", "progress_label", "preview_url"];

// Phone notification to the owner when Claude needs them or finishes —
// the same Web Push the CRM already uses (push_subscriptions, owner rows).
// On iPhone this only arrives when CrewBoss is added to the Home Screen and
// notifications are turned on there (iOS 16.4+).
const notifyOwner = async (env: Record<string, string>, ownerId: string, itemTitle: string, note: string, status?: string) => {
  const text = note.trim();
  const marker = (text.match(/^(APPROVAL NEEDED|PREVIEW READY|QUESTION|LIVE):/) || [])[1];
  const asksQuestion = !marker && /\?[\s)\]"']*$/.test(text);
  let title = "";
  if (marker === "APPROVAL NEEDED") title = "Claude needs your OK";
  else if (marker === "PREVIEW READY") title = "Ready to try";
  else if (marker === "QUESTION" || asksQuestion) title = "Claude has a question";
  else if (marker === "LIVE") title = "Live for everyone";
  else if (status === "done") title = "Done";
  else return;
  const vapidPrivate = env.VAPID_PRIVATE_KEY;
  if (!vapidPrivate || !ownerId) return;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await db(key, `push_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&employee_id=is.null&select=id,endpoint,p256dh,auth`);
  const subs = await res.json().catch(() => []);
  if (!Array.isArray(subs) || subs.length === 0) return;
  const body = `${itemTitle} — ${text.replace(/^(APPROVAL NEEDED|PREVIEW READY|QUESTION|LIVE):\s*/, "")}`.slice(0, 220);
  const payload = { title: `Alfred Cockpit · ${title}`, body, url: "/#/cockpit", tag: "cockpit-" + ownerId };
  const stale: string[] = [];
  for (const sub of subs) {
    const r = await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload, VAPID_PUBLIC_KEY, vapidPrivate, env.VAPID_SUBJECT || "mailto:support@crewboss.app").catch(() => null);
    if (r?.gone) stale.push(sub.id);
  }
  if (stale.length) await db(key, `push_subscriptions?id=in.(${stale.map(encodeURIComponent).join(",")})`, { method: "DELETE" }).catch(() => {});
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const q = new URL(context.request.url).searchParams;
  if (q.get("wake") === "1") return wake(context);
  if (q.get("previewLogin") === "1") return previewLogin(context);
  const denied = authorize(context); if (denied) return denied;
  const body = await context.request.json().catch(() => ({})) as { id?: string; status?: string; note?: string; progress?: number | null; progressLabel?: string; previewUrl?: string };
  if (!body.id) return json({ error: "Missing id" }, 400);
  if (body.status && !["backlog", "in_progress", "done"].includes(body.status)) return json({ error: "status must be backlog, in_progress or done" }, 400);
  const key = context.env.SUPABASE_SERVICE_ROLE_KEY;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) patch.status = body.status;
  if (body.progress !== undefined) patch.progress = body.progress === null ? null : Math.max(0, Math.min(100, Math.round(Number(body.progress) || 0)));
  if (body.progressLabel !== undefined) patch.progress_label = String(body.progressLabel).slice(0, 80);
  if (body.previewUrl !== undefined) patch.preview_url = body.previewUrl ? String(body.previewUrl).slice(0, 300) : null;
  if (body.note) {
    const cur = await db(key, `cockpit_items?id=eq.${encodeURIComponent(body.id)}&select=claude_notes`);
    const rows = await cur.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "Item not found" }, 404);
    const stamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const prev = String(rows[0].claude_notes || "").trim();
    patch.claude_notes = (prev ? prev + "\n\n" : "") + `[${stamp}] ${String(body.note).slice(0, 4000)}`;
  }
  const send = (p: Record<string, unknown>) => db(key, `cockpit_items?id=eq.${encodeURIComponent(body.id!)}&select=id,status,owner_id,title`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(p) });
  let res = await send(patch);
  let rows = await res.json().catch(() => null);
  let skipped: string[] = [];
  // Migration 0100 not run yet → PostgREST rejects the whole patch over the
  // unknown column; save everything else instead.
  if (!res.ok && OPTIONAL_COLUMNS.some(c => c in patch)) {
    skipped = OPTIONAL_COLUMNS.filter(c => c in patch);
    const core = Object.fromEntries(Object.entries(patch).filter(([k]) => !OPTIONAL_COLUMNS.includes(k)));
    res = await send(core);
    rows = await res.json().catch(() => null);
  }
  if (!res.ok) return json({ error: "Update failed", detail: rows }, 502);
  if (!Array.isArray(rows) || rows.length === 0) return json({ error: "Item not found" }, 404);
  if (body.note || body.status === "done") {
    try { await notifyOwner(context.env, rows[0].owner_id, rows[0].title || "Cockpit item", String(body.note || ""), body.status); }
    catch (e: any) { console.error("[cockpit-sync] push failed:", e?.message); }
  }
  return json({ success: true, item: { id: rows[0].id, status: rows[0].status }, ...(skipped.length ? { skipped, hint: "Run supabase/migrations/0100_cockpit_progress_preview.sql" } : {}) });
};

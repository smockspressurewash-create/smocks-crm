// Alfred Cockpit ↔ Claude Code bridge.
//
// The owner (smockspressurewash@gmail.com) files bugs / ideas / questions on
// the in-app "Alfred Cockpit" board (CockpitPage.tsx → cockpit_items). A
// Claude Code session on the developer's machine polls this endpoint (see
// .claude/commands/cockpit.md, run with `/loop`), picks up new items, fixes
// them, and writes progress back — status and notes show on the owner's
// board. Claude Code runs on whatever Claude account it's signed in to, so
// this uses that subscription, not paid API credits.
//
// Auth: a shared secret in the `x-cockpit-key` header, matching the
// COCKPIT_SYNC_KEY Cloudflare env var. Reads/writes use the service role.
//
// GET  /api/cockpit-sync            → open items (backlog + in_progress), oldest first
// GET  /api/cockpit-sync?all=1      → every item
// POST /api/cockpit-sync  { id, status?, note? }
//      status: "backlog" | "in_progress" | "done"; note is appended to claude_notes with a timestamp.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

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
  const res = await db(context.env.SUPABASE_SERVICE_ROLE_KEY, `cockpit_items?select=id,title,description,type,status,claude_notes,created_at,updated_at${filter}&order=created_at.asc`);
  const rows = await res.json().catch(() => null);
  if (!res.ok) return json({ error: "Couldn't read cockpit_items", detail: rows }, 502);
  return json({ items: rows });
};

// POST /api/cockpit-sync?wake=1 (from the Cockpit page, with the owner's
// Supabase session) — starts the GitHub Actions run right away instead of
// waiting for the next scheduled check. Needs GITHUB_DISPATCH_TOKEN in
// Cloudflare: a fine-grained GitHub token for this repo with
// "Actions: Read and write". Without it, items still get picked up by the
// schedule.
const COCKPIT_OWNER_EMAIL = "smockspressurewash@gmail.com";
const wake = async (context: { request: Request; env: Record<string, string> }) => {
  const token = context.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return json({ woke: false, reason: "GITHUB_DISPATCH_TOKEN not set — the next scheduled check will pick it up." });
  const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearers+/i, "");
  const anonKey = context.env.SUPABASE_ANON_KEY || "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
  const user = who.ok ? await who.json().catch(() => null) as any : null;
  if (String(user?.email || "").toLowerCase() !== COCKPIT_OWNER_EMAIL) return json({ error: "Unauthorized" }, 401);
  const gh = await fetch("https://api.github.com/repos/smockspressurewash-create/smocks-crm/actions/workflows/cockpit.yml/dispatches", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "crewboss-cockpit", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "master" }),
  });
  if (!gh.ok) return json({ woke: false, reason: `GitHub refused (${gh.status}) — check GITHUB_DISPATCH_TOKEN.` }, 502);
  return json({ woke: true });
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  if (new URL(context.request.url).searchParams.get("wake") === "1") return wake(context);
  const denied = authorize(context); if (denied) return denied;
  const body = await context.request.json().catch(() => ({})) as { id?: string; status?: string; note?: string };
  if (!body.id) return json({ error: "Missing id" }, 400);
  if (body.status && !["backlog", "in_progress", "done"].includes(body.status)) return json({ error: "status must be backlog, in_progress or done" }, 400);
  const key = context.env.SUPABASE_SERVICE_ROLE_KEY;
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.status) patch.status = body.status;
  if (body.note) {
    const cur = await db(key, `cockpit_items?id=eq.${encodeURIComponent(body.id)}&select=claude_notes`);
    const rows = await cur.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "Item not found" }, 404);
    const stamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const prev = String(rows[0].claude_notes || "").trim();
    patch.claude_notes = (prev ? prev + "\n\n" : "") + `[${stamp}] ${String(body.note).slice(0, 4000)}`;
  }
  const res = await db(key, `cockpit_items?id=eq.${encodeURIComponent(body.id)}&select=id,status`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
  const rows = await res.json().catch(() => null);
  if (!res.ok) return json({ error: "Update failed", detail: rows }, 502);
  if (!Array.isArray(rows) || rows.length === 0) return json({ error: "Item not found" }, 404);
  return json({ success: true, item: rows[0] });
};

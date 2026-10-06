// Shared helpers for the Alfred Cockpit workflow (.github/workflows/cockpit.yml).
// Talks to /api/cockpit-sync with COCKPIT_SYNC_KEY (env or .secrets/cockpit-key).
import { readFileSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";

export const API = process.env.COCKPIT_API || "https://smocks-crm.pages.dev/api/cockpit-sync";
export const SITE = "https://smocks-crm.pages.dev/";
const KEY = (process.env.COCKPIT_SYNC_KEY || (() => { try { return readFileSync(".secrets/cockpit-key", "utf8"); } catch { return ""; } })()).trim();
if (!KEY) { console.error("COCKPIT_SYNC_KEY missing"); process.exit(1); }

export const REPLIES = {
  approve: "Yes, go ahead.",
  cancel: "Cancel — don't make this change.",
  makeLive: "Make it live for everyone.",
  discard: "Discard this change.",
  undo: "Undo this change.",
};

export const getItems = async (all = false) => {
  const res = await fetch(API + (all ? "?all=1" : ""), { headers: { "x-cockpit-key": KEY } });
  if (!res.ok) throw new Error(`cockpit-sync GET ${res.status}: ${await res.text()}`);
  return (await res.json()).items || [];
};

export const update = async (id, patch) => {
  const res = await fetch(API, { method: "POST", headers: { "x-cockpit-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) console.error(`[cockpit] update ${id} failed:`, res.status, JSON.stringify(out));
  return out;
};

const notesOf = (item) => String(item.claude_notes || "").trim();
export const lastNote = (item) => notesOf(item).split("\n\n").filter(Boolean).slice(-1)[0] || "";
export const lastReply = (item) => { const m = lastNote(item).match(/^\[[^\]]*\]\s*You:\s*([\s\S]*)$/); return m ? m[1].trim() : null; };

// What the item needs next:
//   "make-live" | "discard" | "undo"  → handled by fast-actions.mjs (no Claude)
//   "claude"                           → Claude Code (new item or a free-text reply)
//   null                               → waiting on the owner, or finished
export const classify = (item) => {
  if (item.status === "backlog") return "claude";
  if (item.status !== "in_progress" && item.status !== "done") return null;
  const reply = lastReply(item);
  if (reply === null) {
    // In progress with no notes at all = a run died before saying anything.
    return item.status === "in_progress" && !notesOf(item) ? "claude" : null;
  }
  if (reply === REPLIES.makeLive) return "make-live";
  if (reply === REPLIES.discard) return "discard";
  if (reply === REPLIES.undo) return "undo";
  return "claude";
};

export const branchFor = (item) => "cockpit-" + item.id.slice(0, 8);
export const sh = (cmd, opts = {}) => execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts }).trim();
export const output = (name, value) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`); console.log(`${name}=${value}`); };

// Wait until the live site serves a build that contains `sha`.
export const waitUntilLive = async (sha, { minutes = 12, onTick } = {}) => {
  const deadline = Date.now() + minutes * 60_000;
  let n = 0;
  while (Date.now() < deadline) {
    const html = await fetch(SITE, { cache: "no-store" }).then(r => r.text()).catch(() => "");
    const live = (html.match(/name="build-sha" content="([0-9a-f]{7,40})"/) || [])[1];
    if (live) {
      try { sh(`git fetch -q origin ${live}`); } catch { /* not fetchable yet */ }
      try { sh(`git merge-base --is-ancestor ${sha} ${live}`); return true; } catch { /* not yet */ }
    }
    onTick?.(++n);
    await new Promise(r => setTimeout(r, 10_000));
  }
  return false;
};

// Last step of the Cockpit workflow (always runs, even after a failure):
// no card is ever left spinning with nothing happening.
//  - If Claude stopped because the Claude subscription hit its usage limit,
//    every waiting card says exactly that (and when it resets, if Claude
//    said), instead of a generic "something went wrong". No instant re-run —
//    it would just hit the same limit; the 15-minute schedule picks the
//    cards up again, and they keep the message until then.
//  - If the run failed or was cancelled for another reason, every card still
//    waiting on Claude says so and that it will retry.
//  - Cards still waiting (the run ended before getting to them) are re-queued
//    by dispatching the workflow again, at most once per run.
import { readFileSync, existsSync } from "node:fs";
import { getItems, classify, update } from "./lib.mjs";

const failed = ["failure", "cancelled"].includes(process.env.JOB_STATUS || "");

// Claude Code's own log of the run (claude-code-action writes it; the path
// is passed in, with the action's default location as a fallback).
const readClaudeLog = () => {
  for (const p of [process.env.CLAUDE_EXECUTION_FILE, process.env.RUNNER_TEMP && `${process.env.RUNNER_TEMP}/claude-execution-output.json`].filter(Boolean)) {
    try { if (existsSync(p)) return readFileSync(p, "utf8"); } catch { /* unreadable */ }
  }
  return "";
};

// "Claude AI usage limit reached|1729712345", "5-hour limit reached ∙ resets 3pm",
// "You've hit your limit · resets 6pm (America/New_York)", rate_limit_error, 429 …
export const usageLimitInfo = (log) => {
  const text = String(log || "");
  if (!/usage limit|limit reached|hit your (usage )?limit|rate[_ ]limit|weekly limit|out of (extra )?usage|\b429\b/i.test(text)) return null;
  let resetAt = null;
  const epoch = text.match(/limit reached\|(\d{10})/i);
  if (epoch) resetAt = new Date(Number(epoch[1]) * 1000);
  const fmt = (d) => d.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }) + " ET";
  if (resetAt) return { resetLabel: fmt(resetAt) };
  const words = text.match(/resets?(?: at)?\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)(?:\s*\([^)]+\))?|[A-Z][a-z]{2,8},? [A-Z][a-z]{2} \d{1,2}[^"\n]{0,20})/i);
  return { resetLabel: words ? words[1].trim() : null };
};

// Only the run's own errors count — the log also holds every file Claude
// read, and CRM code mentions "429" and "limit" all over the place.
const errorTextOf = (raw) => {
  if (!raw) return "";
  try {
    const msgs = JSON.parse(raw);
    const list = Array.isArray(msgs) ? msgs : [msgs];
    const out = [];
    for (const m of list) {
      if (m?.type === "result" && (m.is_error || (m.subtype && m.subtype !== "success"))) out.push(String(m.result || m.error || m.subtype || ""));
      if (m?.type === "assistant") {
        for (const c of m.message?.content || []) {
          const t = String(c?.text || "");
          if (/^(API Error|Claude AI usage limit|5-hour limit|Weekly limit|You've hit your)/i.test(t.trim())) out.push(t);
        }
      }
    }
    return out.join("\n");
  } catch {
    return raw.slice(-1500); // not JSON — only the very end
  }
};
const errorText = errorTextOf(readClaudeLog());
const limit = usageLimitInfo(errorText);
// Claude's saved sign-in for the Cockpit (CLAUDE_CODE_OAUTH_TOKEN) expired or
// was revoked — retrying won't help until it's replaced.
const signInProblem = !limit && /invalid api key|please run \/login|oauth|not logged in|authentication|unauthorized|\b401\b|token (has )?expired|credit balance/i.test(errorText);
const items = (await getItems()).filter(i => classify(i));
const label = limit
  ? `Claude hit its usage limit${limit.resetLabel ? ` — resets ${limit.resetLabel}` : ""}. Your request is saved and will start automatically after that.`
  : signInProblem ? "Claude can't sign in to work on this (its Cockpit sign-in expired). The developer needs to run `claude setup-token` and update the CLAUDE_CODE_OAUTH_TOKEN secret on GitHub. Your request is saved."
  : failed ? `Something went wrong on our side${errorText ? ` (${errorText.replace(/\s+/g, " ").trim().slice(0, 140)})` : ""} — retrying automatically` : "In line — starting again shortly";
for (const item of items) await update(item.id, { progress: null, progressLabel: label });
console.log(`${items.length} item(s) still waiting${limit ? " (usage limit" + (limit.resetLabel ? ", resets " + limit.resetLabel : "") + ")" : signInProblem ? " (Claude sign-in expired)" : failed ? " (run failed)" : ""}`, errorText ? "— Claude said: " + errorText.slice(0, 300) : "");

// Kick off another run for leftovers (GITHUB_TOKEN may dispatch workflows) —
// but not when the limit is the reason; that would just fail again.
if (!limit && !signInProblem && items.length && process.env.GH_TOKEN && process.env.GITHUB_REPOSITORY && process.env.RUN_ATTEMPT_CHAIN !== "stop") {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/cockpit.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "master", inputs: { chained: "1" } }),
  });
  console.log("re-dispatch:", res.status);
}

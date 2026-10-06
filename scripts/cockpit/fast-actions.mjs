// Step 2 of the Cockpit workflow: the owner's button taps that don't need
// any thinking — Make it live / Discard / Undo — done directly with git,
// with real progress on the card. Much faster than starting Claude, and it
// only calls something live once the live site is actually serving it.
// Anything that goes wrong (merge conflict, failed build) is handed to
// Claude with the reason in .cockpit-handoff.md, and the card says so.
import { appendFileSync } from "node:fs";
import { getItems, classify, update, branchFor, sh, output, waitUntilLive, lastNote } from "./lib.mjs";

const handoffs = [];
const handOff = async (item, reason, label) => {
  handoffs.push(`## ${item.id} — ${item.title}\n\n${reason}\n`);
  await update(item.id, { progress: null, progressLabel: label });
  console.log(`  ↳ handed to Claude: ${label}`);
};

const exists = (ref) => { try { sh(`git rev-parse --verify -q ${ref}`); return true; } catch { return false; } };
const tail = (s, n = 40) => String(s || "").split("\n").slice(-n).join("\n");
const build = () => { try { sh("npx tsc -b && npm run build"); return null; } catch (e) { return tail(e.stdout) + "\n" + tail(e.stderr); } };
const testHint = (item) => {
  const preview = String(item.claude_notes || "").split("\n\n").reverse().find(n => /PREVIEW READY:/.test(n)) || "";
  const m = preview.match(/To test:\s*([^]*?)(?:Only (?:someone|people) with|$)/i);
  return m ? m[1].trim().replace(/\s+/g, " ") : "";
};

// Push master, merging in anything that landed meanwhile (once).
const pushMaster = () => {
  try { sh("git push origin HEAD:master"); return null; } catch { /* someone else pushed */ }
  try {
    sh("git fetch -q origin master && git merge --no-edit origin/master");
    const err = build(); if (err) return "Build failed after merging the latest changes:\n" + err;
    sh("git push origin HEAD:master");
    return null;
  } catch (e) { return "Couldn't push to master: " + tail(e.stderr || e.message); }
};

const goLive = async (item, sha, verbLabel) => {
  await update(item.id, { progress: 90, progressLabel: "Waiting for the live site to update" });
  const live = await waitUntilLive(sha, { minutes: 15, onTick: (n) => { if (n % 3 === 0) update(item.id, { progress: Math.min(98, 90 + Math.floor(n / 3)), progressLabel: `Waiting for the live site to update (${Math.round(n / 6)} min)` }); } });
  return live;
};

const items = (await getItems()).filter(i => ["make-live", "discard", "undo"].includes(classify(i)));
sh("git fetch -q --prune origin");

for (const item of items) {
  const kind = classify(item);
  const B = branchFor(item);
  console.log(`${item.id.slice(0, 8)} ${kind}: ${item.title}`);

  if (kind === "discard") {
    try { if (exists(`origin/${B}`)) sh(`git push origin --delete ${B}`); } catch { /* already gone */ }
    await update(item.id, { status: "done", progress: null, progressLabel: "", previewUrl: "", note: "Discarded — nothing changed for anyone." });
    continue;
  }

  if (kind === "make-live") {
    if (!exists(`origin/${B}`)) {
      await update(item.id, { progress: null, progressLabel: "", note: "QUESTION: I can't find the preview for this anymore (it may have been discarded or already published). Want me to make the change again?" });
      continue;
    }
    await update(item.id, { progress: 15, progressLabel: "Merging the change" });
    sh("git checkout -q -B master origin/master");
    try { sh(`git merge --no-ff origin/${B} -m "Cockpit: ${item.title.replace(/"/g, "'")}"`); }
    catch (e) { sh("git merge --abort || true"); await handOff(item, `Merging origin/${B} into master conflicted:\n${tail(e.stdout)}`, "Fixing a conflict before publishing"); continue; }
    await update(item.id, { progress: 40, progressLabel: "Checking it builds" });
    const err = build();
    if (err) { sh("git reset -q --hard origin/master"); await handOff(item, `Build failed after merging origin/${B}:\n${err}`, "Fixing a build problem before publishing"); continue; }
    await update(item.id, { progress: 70, progressLabel: "Publishing to everyone" });
    const pushErr = pushMaster();
    if (pushErr) { sh("git reset -q --hard origin/master"); await handOff(item, pushErr, "Fixing a problem before publishing"); continue; }
    const sha = sh("git rev-parse HEAD");
    try { sh(`git push origin --delete ${B}`); } catch { /* fine */ }
    const live = await goLive(item, sha);
    const test = testHint(item);
    await update(item.id, {
      status: "done", progress: null, progressLabel: "", previewUrl: "",
      note: `LIVE: "${item.title}" is live for everyone${live ? "" : " (the live site is still updating — give it a few more minutes)"}.${test ? " To test: " + test : ""} If the app still looks old, close it fully and reopen it. Tap Undo on this card to put it back the way it was. (merge ${sha.slice(0, 7)})`,
    });
    continue;
  }

  if (kind === "undo") {
    const liveNote = String(item.claude_notes || "").split("\n\n").reverse().find(n => /\]\s*LIVE:/.test(n)) || "";
    const merge = (liveNote.match(/\(merge ([0-9a-f]{7,40})\)/) || [])[1];
    if (!merge || !exists(merge)) { await handOff(item, `Undo requested but no merge sha found in the LIVE note (${merge || "none"}).`, "Working out how to undo it"); continue; }
    await update(item.id, { progress: 15, progressLabel: "Undoing the change" });
    sh("git checkout -q -B master origin/master");
    let parents = 1; try { parents = sh(`git rev-list --parents -n 1 ${merge}`).split(" ").length - 1; } catch { /* */ }
    try { sh(`git revert --no-edit ${parents > 1 ? "-m 1 " : ""}${merge}`); }
    catch (e) { sh("git revert --abort || true"); await handOff(item, `git revert ${merge} conflicted:\n${tail(e.stdout)}`, "Fixing a conflict while undoing"); continue; }
    await update(item.id, { progress: 40, progressLabel: "Checking it builds" });
    const err = build();
    if (err) { sh("git reset -q --hard origin/master"); await handOff(item, `Build failed after reverting ${merge}:\n${err}`, "Fixing a build problem while undoing"); continue; }
    await update(item.id, { progress: 70, progressLabel: "Publishing to everyone" });
    const pushErr = pushMaster();
    if (pushErr) { sh("git reset -q --hard origin/master"); await handOff(item, pushErr, "Fixing a problem while undoing"); continue; }
    const sha = sh("git rev-parse HEAD");
    const live = await goLive(item, sha);
    await update(item.id, { status: "done", progress: null, progressLabel: "", note: `Undone — it's back the way it was for everyone${live ? "" : " (the live site is still updating — give it a few more minutes)"}. If the app still looks old, close it fully and reopen it. (revert ${sha.slice(0, 7)})` });
  }
}

if (handoffs.length) appendFileSync(".cockpit-handoff.md", "# Handed over by fast-actions.mjs\n\n" + handoffs.join("\n"));
output("handoffs", handoffs.length);
void lastNote;

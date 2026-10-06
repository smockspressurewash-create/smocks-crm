// Last step of the Cockpit workflow (always runs, even after a failure):
// no card is ever left spinning with nothing happening.
//  - If the run failed or was cancelled, every card still waiting on Claude
//    says so and that it will retry.
//  - Cards still waiting (the run ended before getting to them) are re-queued
//    by dispatching the workflow again, at most once per run.
import { getItems, classify, update } from "./lib.mjs";

const failed = ["failure", "cancelled"].includes(process.env.JOB_STATUS || "");
const items = (await getItems()).filter(i => classify(i));
for (const item of items) {
  await update(item.id, {
    progress: null,
    progressLabel: failed ? "Something went wrong on our side — retrying automatically" : "In line — starting again shortly",
  });
}
console.log(`${items.length} item(s) still waiting${failed ? " (run failed)" : ""}`);

// Kick off another run for leftovers (GITHUB_TOKEN may dispatch workflows).
if (items.length && process.env.GH_TOKEN && process.env.GITHUB_REPOSITORY && process.env.RUN_ATTEMPT_CHAIN !== "stop") {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/cockpit.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "master", inputs: { chained: "1" } }),
  });
  console.log("re-dispatch:", res.status);
}

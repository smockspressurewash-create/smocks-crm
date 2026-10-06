// Step 1 of the Cockpit workflow: look at the board, tell the owner right
// away that work is starting (so the card shows a real percentage instead
// of an endless spinner), and report what the rest of the run needs to do.
import { getItems, classify, update, output } from "./lib.mjs";

const items = await getItems();
let fast = 0, claude = 0;
for (const item of items) {
  const kind = classify(item);
  if (!kind) continue;
  if (kind === "claude") claude++; else fast++;
  const label = kind === "make-live" ? "Making it live — getting ready"
    : kind === "discard" ? "Discarding the preview"
    : kind === "undo" ? "Undoing the change — getting ready"
    : item.status === "backlog" ? "Claude is starting on it" : "Claude is reading your reply";
  await update(item.id, { progress: 5, progressLabel: label, ...(item.status === "backlog" ? { status: "in_progress" } : {}) });
  console.log(`${item.id.slice(0, 8)} → ${kind}: ${item.title}`);
}
output("fast", fast);
output("claude", claude);
output("any", fast + claude > 0 ? 1 : 0);

import { useState, useEffect } from "react";
import { Plus, Bug, Lightbulb, HelpCircle, ArrowRight, ArrowLeft, Trash2, AlertTriangle, Eye, Rocket, Undo2, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uid } from "../../lib/utils";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GTxt } from "../ui/GTxt";
import { GSel } from "../ui/GSel";
import { Modal } from "../ui/Modal";
import { PushNotificationButton } from "../ui/PushNotificationButton";

// Alfred Cockpit — the owner's private board for bugs, ideas and questions.
// Claude Code works the board (functions/api/cockpit-sync.ts, run by
// .github/workflows/cockpit.yml with .claude/commands/cockpit.md) and talks
// back through the card's notes. Claude starts each note it needs an answer
// on with a marker, which turns into buttons here:
//   APPROVAL NEEDED: risky change — "Yes, go ahead" / "Cancel"
//   QUESTION:        needs an answer — reply box highlighted
//   PREVIEW READY:   change is on a private preview link — "Make it live for
//                    everyone" / "Discard"
//   LIVE:            change is live — "Undo this change"
// The owner's answers are appended to the notes as "You: …" and wake Claude.
type CockpitItem = {
  id: string; title: string; description: string; type: "bug" | "idea" | "question";
  status: "backlog" | "in_progress" | "done"; claude_notes: string; created_at: string; updated_at: string;
  progress?: number | null; progress_label?: string | null; preview_url?: string | null;
};

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  bug: { icon: Bug, color: "text-red-400", label: "Bug" },
  idea: { icon: Lightbulb, color: "text-yellow-400", label: "Idea" },
  question: { icon: HelpCircle, color: "text-blue-400", label: "Question" },
};

const COLUMNS: { key: CockpitItem["status"]; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

// Exact replies the /cockpit procedure listens for.
const REPLIES = {
  approve: "Yes, go ahead.",
  cancel: "Cancel — don't make this change.",
  makeLive: "Make it live for everyone.",
  discard: "Discard this change.",
  undo: "Undo this change.",
};

type CardState = "approval" | "question" | "preview" | "live" | "working" | "replied" | null;

const NL = String.fromCharCode(10);
const lastNote = (notes: string) => (notes || "").trim().split(NL + NL).filter(Boolean).slice(-1)[0] || "";
const stripStamp = (note: string) => note.replace(/^\[[^\]]*\]\s*/, "");

const cardState = (item: CockpitItem): CardState => {
  const last = lastNote(item.claude_notes);
  const ownerSpokeLast = /^\[[^\]]*\]\s*You:/.test(last);
  if (item.status === "done") return /(^|\n\n)\[[^\]]*\]\s*LIVE:/.test(item.claude_notes || "") && !/You: Undo this change/.test(last) ? "live" : null;
  if (item.status !== "in_progress") return null;
  if (ownerSpokeLast) return "replied";
  const body = stripStamp(last);
  if (body.startsWith("APPROVAL NEEDED:")) return "approval";
  if (body.startsWith("PREVIEW READY:")) return "preview";
  if (body.startsWith("QUESTION:")) return "question";
  // Older notes asked questions without the marker.
  if (/\?[\s)\]"']*$/.test(body)) return "question";
  return "working";
};

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  approval: { label: "Needs your OK", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  question: { label: "Waiting for your answer", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  preview: { label: "Preview ready — try it", cls: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  live: { label: "Live", cls: "bg-green-500/15 text-green-300 border-green-500/30" },
  replied: { label: "Claude will pick this up", cls: "bg-white/10 text-white/60 border-white/15" },
};

// Progress bar while Claude works. Shows the real % when Claude reports it
// (migration 0100), otherwise an indeterminate sliding bar.
function ProgressBar({ item }: { item: CockpitItem }) {
  const pct = typeof item.progress === "number" ? item.progress : null;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
        <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" />{item.progress_label || "Claude is working on it"}</span>
        {pct !== null && <span className="tabular-nums">{pct}%</span>}
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden relative">
        {pct !== null
          ? <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-700 ease-out" style={{ width: `${Math.max(4, pct)}%` }} />
          : <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-red-500 to-transparent animate-[cockpitSlide_1.4s_ease-in-out_infinite]" />}
      </div>
      <style>{`@keyframes cockpitSlide { 0% { left: -33% } 100% { left: 100% } }`}</style>
    </div>
  );
}

export function CockpitPage({ ownerId, toast }: { ownerId: string; toast?: (msg: string, tone?: string) => void }) {
  const [items, setItems] = useState<CockpitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"bug" | "idea" | "question">("bug");
  const [saving, setSaving] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [openingPreview, setOpeningPreview] = useState(false);

  // A preview is a separate web address, so it doesn't share this app's
  // sign-in. Ask the server for a one-time link that opens it signed in to
  // this same account. The tab is opened right away (inside the tap) so
  // iPhone doesn't block it as a pop-up, then pointed at the link.
  const openPreview = async (previewUrl: string) => {
    const tab = window.open("about:blank", "_blank");
    setOpeningPreview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/cockpit-sync?previewLogin=1", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ previewUrl }) });
      const out = await res.json().catch(() => ({}));
      const target = out?.url || previewUrl;
      if (!out?.url) toast?.("Opening the preview — sign in there with your usual email and password (" + (out?.error || "auto sign-in unavailable") + ")", "red");
      if (tab) tab.location.href = target; else window.location.href = target;
    } catch (e: any) {
      toast?.("Couldn't sign you in to the preview automatically — " + (e?.message || "network error"), "red");
      if (tab) tab.location.href = previewUrl; else window.location.href = previewUrl;
    } finally {
      setOpeningPreview(false);
    }
  };
  const viewing = items.find(i => i.id === viewingId) || null;

  const load = async () => {
    try {
      const { data, error } = await (supabase as any).from("cockpit_items").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false });
      if (error) { console.warn("[Cockpit] load failed:", error.message); return; }
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };
  // Poll faster while Claude is actively working so the progress bar moves.
  const anyWorking = items.some(i => cardState(i) === "working" || cardState(i) === "replied");
  useEffect(() => { load(); const h = setInterval(load, anyWorking ? 5000 : 15000); return () => clearInterval(h); }, [ownerId, anyWorking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start Claude now instead of waiting for the next scheduled check.
  const wakeClaude = async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/cockpit-sync?wake=1", { method: "POST", headers: { Authorization: `Bearer ${session?.access_token || ""}` } });
      const out = await res.json().catch(() => ({}));
      return !!out?.woke;
    } catch { return false; }
  };

  const addItem = async () => {
    if (!newTitle.trim()) { toast?.("Give it a short title first", "red"); return; }
    setSaving(true);
    const row = { id: uid(), owner_id: ownerId, title: newTitle.trim(), description: newDesc.trim(), type: newType, status: "backlog" as const, claude_notes: "" };
    const { error } = await (supabase as any).from("cockpit_items").insert(row);
    setSaving(false);
    if (error) { toast?.("Couldn't save — " + error.message, "red"); return; }
    setItems(prev => [{ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any, ...prev]);
    setNewTitle(""); setNewDesc(""); setNewType("bug"); setAddOpen(false);
    const woke = await wakeClaude();
    toast?.(woke ? "Added ✓ — Claude is starting on it now" : "Added ✓ — Claude will pick it up on the next check (within ~15 min)", "green");
  };

  // Answer Claude (typed reply or one of the buttons). Appended to the notes
  // as "You: …"; the card goes back to In Progress so Claude picks it up.
  const sendReply = async (text?: string) => {
    const msg = (text ?? reply).trim();
    if (!viewing || !msg) return;
    setReplying(true);
    const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const notes = ((viewing.claude_notes || "").trim() ? viewing.claude_notes.trim() + NL + NL : "") + `[${stamp}] You: ${msg}`;
    const { error, data } = await (supabase as any).from("cockpit_items").update({ claude_notes: notes, status: "in_progress", updated_at: new Date().toISOString() }).eq("id", viewing.id).select("id");
    setReplying(false);
    if (error || !data?.length) { toast?.("Couldn't send — " + (error?.message || "no matching item"), "red"); return; }
    setItems(prev => prev.map(i => i.id === viewing.id ? { ...i, claude_notes: notes, status: "in_progress" } : i));
    if (!text) setReply("");
    const woke = await wakeClaude();
    toast?.(woke ? "Sent ✓ — Claude is starting on it now" : "Sent ✓ — Claude will see it on the next check", "green");
  };

  const moveItem = async (item: CockpitItem, dir: 1 | -1) => {
    const idx = COLUMNS.findIndex(c => c.key === item.status);
    const next = COLUMNS[idx + dir];
    if (!next) return;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next.key } : i));
    const { error, data } = await (supabase as any).from("cockpit_items").update({ status: next.key, updated_at: new Date().toISOString() }).eq("id", item.id).select("id");
    if (error || !data?.length) toast?.("Failed to move — " + (error?.message || "no matching item"), "red");
  };

  const deleteItem = async (item: CockpitItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setItems(prev => prev.filter(i => i.id !== item.id));
    setViewingId(null);
    const { error, data } = await (supabase as any).from("cockpit_items").delete().eq("id", item.id).select("id");
    if (error || !data?.length) toast?.("Failed to delete — " + (error?.message || "no matching item"), "red");
    else toast?.("Deleted", "green");
  };

  const state = viewing ? cardState(viewing) : null;
  useEffect(() => { setReopening(false); setReply(""); }, [viewingId]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Alfred Cockpit</h1>
          <p className="text-sm text-white/50 mt-1">Report a bug, drop an idea, or ask a question from anywhere.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Phone notifications when Claude needs you or finishes. iPhone:
              add CrewBoss to the Home Screen first (the button explains). */}
          <PushNotificationButton ownerId={ownerId} label="Notify my phone" className="!py-2" />
          <GBtn onClick={() => setAddOpen(true)}><Plus size={14} className="inline mr-1.5" />New Item</GBtn>
        </div>
      </div>

      <Glass className="p-3 mb-5 text-xs text-white/70 leading-relaxed space-y-1">
        <div>Claude picks up new cards automatically and shows its progress on the card.</div>
        <div><b>Before anything risky</b> Claude asks for your OK first. <b>Changes go to a private preview</b> you can try on your account first — then tap <b>Make it live for everyone</b> or <b>Discard</b>. A live change can be <b>undone</b> from its card.</div>
      </Glass>

      {loading ? (
        <div className="text-center py-16 text-white/40 text-sm">Loading…</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {COLUMNS.map(col => {
            const colItems = items.filter(i => i.status === col.key);
            return (
              <div key={col.key}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-xs uppercase tracking-wider font-semibold text-white/50">{col.label}</div>
                  <div className="text-xs text-white/30">{colItems.length}</div>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {colItems.map(item => {
                    const meta = TYPE_META[item.type] || TYPE_META.bug;
                    const Icon = meta.icon;
                    const st = cardState(item);
                    const last = lastNote(item.claude_notes);
                    return (
                      <Glass key={item.id} className="p-3 cursor-pointer hover:border-red-700/30 transition" onClick={() => setViewingId(item.id)}>
                        <div className="flex items-start gap-2">
                          <Icon size={13} className={meta.color + " mt-0.5 flex-shrink-0"} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.title}</div>
                            {item.description && <div className="text-xs text-white/40 mt-0.5 line-clamp-2">{item.description}</div>}
                            {st && STATE_BADGE[st] && <span className={"inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border " + STATE_BADGE[st].cls}>{STATE_BADGE[st].label}</span>}
                            {last && <div className="text-[11px] text-green-300/80 mt-1 line-clamp-2">💬 {stripStamp(last).replace(/^(APPROVAL NEEDED|PREVIEW READY|QUESTION|LIVE):s*/, "")}</div>}
                            {(st === "working" || st === "replied") && <ProgressBar item={item} />}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex gap-1">
                            {col.key !== "backlog" && (
                              <button onClick={e => { e.stopPropagation(); moveItem(item, -1); }} aria-label="Move left" className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white"><ArrowLeft size={12} /></button>
                            )}
                            {col.key !== "done" && (
                              <button onClick={e => { e.stopPropagation(); moveItem(item, 1); }} aria-label="Move right" className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white"><ArrowRight size={12} /></button>
                            )}
                          </div>
                          <span className="text-[10px] text-white/25">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </Glass>
                    );
                  })}
                  {colItems.length === 0 && <div className="text-xs text-white/20 text-center py-6 border border-dashed border-white/10 rounded-xl">Nothing here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Cockpit Item">
        <div className="space-y-3">
          <GSel label="Type" value={newType} onChange={(e: any) => setNewType(e.target.value)}>
            <option value="bug">Bug</option>
            <option value="idea">Idea</option>
            <option value="question">Question</option>
          </GSel>
          <GInput label="Title" value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} placeholder="Short summary…" autoFocus />
          <GTxt label="Details (optional)" value={newDesc} onChange={(e: any) => setNewDesc(e.target.value)} rows={4} placeholder="Whatever context helps — screenshots aren't uploadable here, but describe what you saw." />
          <GBtn onClick={addItem} disabled={saving} className="w-full">{saving ? "Saving…" : "Add to Backlog"}</GBtn>
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewingId(null)} title={viewing?.title || ""}>
        {viewing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span className="capitalize">{viewing.type}</span>·<span>{new Date(viewing.created_at).toLocaleString()}</span>
            </div>
            {viewing.description && <div className="text-sm text-white/70 whitespace-pre-wrap">{viewing.description}</div>}

            {(state === "working" || state === "replied") && <ProgressBar item={viewing} />}

            {state === "approval" && (
              <div className="p-3 rounded-xl bg-yellow-950/30 border border-yellow-600/40 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-yellow-300"><AlertTriangle size={15} />Are you sure?</div>
                <div className="text-sm text-white/80 whitespace-pre-wrap">{stripStamp(lastNote(viewing.claude_notes)).replace(/^APPROVAL NEEDED:\s*/, "")}</div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <GBtn onClick={() => sendReply(REPLIES.approve)} disabled={replying} className="!justify-center">Yes, go ahead</GBtn>
                  <GBtn variant="ghost" onClick={() => sendReply(REPLIES.cancel)} disabled={replying} className="!justify-center">Cancel</GBtn>
                </div>
              </div>
            )}

            {state === "preview" && (
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-600/40 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-300"><Eye size={15} />Try it before anyone else sees it</div>
                <div className="text-sm text-white/80 whitespace-pre-wrap">{stripStamp(lastNote(viewing.claude_notes)).replace(/^PREVIEW READY:\s*/, "")}</div>
                {viewing.preview_url && (
                  <button type="button" onClick={() => openPreview(viewing.preview_url!)} disabled={openingPreview} className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-purple-500/40 text-purple-200 text-sm font-semibold hover:bg-purple-900/30 disabled:opacity-60">
                    {openingPreview ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}{openingPreview ? "Signing you in…" : "Open the preview"}
                  </button>
                )}
                <div className="text-[11px] text-white/45">Opens signed in to your account (real data). Nobody else sees it unless you share the link.</div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <GBtn onClick={() => sendReply(REPLIES.makeLive)} disabled={replying} className="!justify-center"><Rocket size={13} className="inline mr-1" />Make it live for everyone</GBtn>
                  <GBtn variant="ghost" onClick={() => sendReply(REPLIES.discard)} disabled={replying} className="!justify-center">Discard</GBtn>
                </div>
              </div>
            )}

            {state === "question" && (
              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-600/40">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-300 mb-1"><MessageCircle size={15} />Claude has a question</div>
                <div className="text-sm text-white/80 whitespace-pre-wrap">{stripStamp(lastNote(viewing.claude_notes)).replace(/^QUESTION:\s*/, "")}</div>
                <div className="text-[11px] text-white/45 mt-1">Answer in the box below.</div>
              </div>
            )}

            {state === "live" && (
              <div className="p-3 rounded-xl bg-green-950/20 border border-green-700/40 space-y-2">
                <div className="text-sm text-green-300 font-semibold">This change is live for everyone.</div>
                <GBtn variant="ghost" onClick={() => { if (window.confirm("Undo this change for everyone? Claude will put back how it was before.")) sendReply(REPLIES.undo); }} disabled={replying} className="w-full !justify-center"><Undo2 size={13} className="inline mr-1" />Undo this change</GBtn>
              </div>
            )}

            {viewing.status === "done" && !reopening && (
              <GBtn variant="ghost" onClick={() => setReopening(true)} className="w-full !justify-center">This isn't fixed / not quite right</GBtn>
            )}

            {viewing.claude_notes && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Conversation</div>
                <div className="text-sm text-white/70 whitespace-pre-wrap max-h-64 overflow-y-auto">{viewing.claude_notes}</div>
              </div>
            )}
            <div className="space-y-2">
              <GTxt label={reopening ? "What's still wrong?" : state === "question" ? "Your answer" : "Reply to Claude"} value={reply} onChange={(e: any) => setReply(e.target.value)} rows={3} placeholder={reopening ? "Describe what you see and what you expected — Claude will reopen it and fix it." : state === "question" ? "Type your answer…" : "Add more detail, ask for a change, or answer a question…"} />
              <GBtn onClick={async () => { if (reopening) { await sendReply("Not fixed yet: " + reply.trim()); setReply(""); setReopening(false); } else sendReply(); }} disabled={replying || !reply.trim()} className="w-full">{replying ? "Sending…" : reopening ? "Reopen and send to Claude" : "Send reply"}</GBtn>
            </div>
            <div className="flex gap-2 pt-2">
              <GBtn variant="danger" onClick={() => deleteItem(viewing)} className="flex-1"><Trash2 size={13} className="inline mr-1.5" />Delete</GBtn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

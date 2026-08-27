// FEATURE — public product feedback/roadmap board. Any signed-in CrewBoss
// user (owner or employee, any business) can submit a bug/feature request
// and upvote/downvote others' — cross-tenant by design, this is feedback
// about the PRODUCT, not any one business's data. Only the platform admin
// (smockspressurewash@gmail.com) can move an item's status — that change
// is what makes it show up on the public roadmap (see RoadmapPage.tsx,
// the logged-out landing-page equivalent that only shows planned/
// in_progress/done items, no submit/vote).
import React, { useEffect, useRef, useState } from "react";
import { Bug, Lightbulb, ChevronUp, ChevronDown, Plus, Trash2, Clock, CheckCircle, Rocket, LayoutGrid, List } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uid } from "../../lib/utils";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GTxt } from "../ui/GTxt";
import { GSel } from "../ui/GSel";
import { Badge } from "../ui/Badge";
import { useConfirm } from "../ui/ConfirmModal";

type FeedbackItem = {
  id: string; title: string; description: string; type: "bug" | "feature";
  status: "submitted" | "planned" | "in_progress" | "done" | "declined";
  submitted_by_email: string; submitted_by_name: string; admin_note: string;
  created_at: string; updated_at: string;
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  submitted: { label: "New", color: "text-white/50", icon: Clock },
  planned: { label: "Planned", color: "text-blue-400", icon: Clock },
  in_progress: { label: "In Progress", color: "text-yellow-400", icon: Rocket },
  done: { label: "Done", color: "text-green-400", icon: CheckCircle },
  declined: { label: "Not Planned", color: "text-white/30", icon: Clock },
};

export function FeedbackPage({ userEmail, userName, isAdmin, toast, publicMode = false }: {
  userEmail?: string; userName?: string; isAdmin?: boolean; toast?: (msg: string, tone?: any) => void;
  // Read-only public roadmap mode (logged-out landing-page visitors) — no
  // submit form, no voting, only shows items the admin has actually
  // scheduled/shipped (planned/in_progress/done), never raw unfiltered
  // submissions.
  publicMode?: boolean;
}) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [votes, setVotes] = useState<Record<string, { total: number; mine: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"bug" | "feature">("feature");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [myUid, setMyUid] = useState<string | null>(null);
  const { confirmAsync, ConfirmDialog } = useConfirm();
  // FEATURE — "have the kanban style board to see what you're doing." Admin
  // (you) gets a real drag-between-columns board; everyone else still gets
  // the simple upvote/downvote list — they can't change status anyway, so
  // columns would just be read-only clutter for them.
  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await (supabase as any).auth.getUser();
      setMyUid(user?.id || null);
      const [itemsRes, votesRes] = await Promise.all([
        (supabase as any).from("feedback_items").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("feedback_votes").select("feedback_id,voter_id,value"),
      ]);
      setItems(itemsRes.data || []);
      const tally: Record<string, { total: number; mine: number }> = {};
      (votesRes.data || []).forEach((v: any) => {
        if (!tally[v.feedback_id]) tally[v.feedback_id] = { total: 0, mine: 0 };
        tally[v.feedback_id].total += v.value;
        if (v.voter_id === user?.id) tally[v.feedback_id].mine = v.value;
      });
      setVotes(tally);
    } catch (e: any) {
      console.warn("[Feedback] load failed:", e?.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!newTitle.trim()) { toast?.("Give it a title first", "red"); return; }
    setSubmitting(true);
    try {
      const row = { id: uid(), title: newTitle.trim(), description: newDesc.trim(), type: newType, status: "submitted", submitted_by_email: userEmail || "", submitted_by_name: userName || "" };
      const { error } = await (supabase as any).from("feedback_items").insert(row);
      if (error) throw new Error(error.message);
      toast?.("Submitted ✓", "green");
      setNewTitle(""); setNewDesc(""); setShowNew(false);
      await load();
    } catch (e: any) {
      toast?.("Couldn't submit — " + (e?.message || "unknown error"), "red");
    } finally {
      setSubmitting(false);
    }
  };

  const vote = async (itemId: string, value: 1 | -1) => {
    if (!myUid) { toast?.("Sign in to vote", "red"); return; }
    const current = votes[itemId]?.mine || 0;
    const next = current === value ? 0 : value;
    // Optimistic
    setVotes(prev => ({ ...prev, [itemId]: { total: (prev[itemId]?.total || 0) - current + next, mine: next } }));
    try {
      if (next === 0) {
        await (supabase as any).from("feedback_votes").delete().eq("feedback_id", itemId).eq("voter_id", myUid);
      } else {
        await (supabase as any).from("feedback_votes").upsert({ feedback_id: itemId, voter_id: myUid, value: next }, { onConflict: "feedback_id,voter_id" });
      }
    } catch (e: any) {
      toast?.("Vote failed to save — " + (e?.message || ""), "red");
      load();
    }
  };

  const setStatus = async (itemId: string, status: string) => {
    const { error } = await (supabase as any).from("feedback_items").update({ status, updated_at: new Date().toISOString() }).eq("id", itemId).select("id");
    if (error) { toast?.("Couldn't update status — " + error.message, "red"); return; }
    toast?.("Status updated ✓", "green");
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: status as any } : it));
  };
  const deleteItem = async (itemId: string) => {
    if (!(await confirmAsync({ message: "Delete this feedback item? This can't be undone.", confirmLabel: "Delete" }))) return;
    const { error } = await (supabase as any).from("feedback_items").delete().eq("id", itemId);
    if (error) { toast?.("Couldn't delete — " + error.message, "red"); return; }
    setItems(prev => prev.filter(it => it.id !== itemId));
  };

  // FEATURE — kanban drag-to-change-status. Pointer events work uniformly
  // for touch and mouse (same technique as the video editor's timeline
  // drag) — press a card, drag it over a column, release to commit.
  const handleCardPointerDown = (e: React.PointerEvent, id: string) => {
    if (!isAdmin || view !== "kanban") return;
    setDraggingId(id);
  };
  useEffect(() => {
    if (!draggingId) return;
    let hoverColumn: string | null = null;
    const onMove = (e: PointerEvent) => {
      const board = boardRef.current;
      if (!board) return;
      const cols = Array.from(board.querySelectorAll<HTMLElement>("[data-kanban-col]"));
      const under = cols.find(col => {
        const r = col.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      hoverColumn = under?.dataset.kanbanCol || null;
      cols.forEach(col => col.classList.toggle("kanban-col-hover", col === under));
    };
    const onUp = () => {
      boardRef.current?.querySelectorAll("[data-kanban-col]").forEach(col => col.classList.remove("kanban-col-hover"));
      if (hoverColumn) {
        const item = items.find(it => it.id === draggingId);
        if (item && item.status !== hoverColumn) setStatus(draggingId, hoverColumn);
      }
      setDraggingId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [draggingId, items]);

  const filtered = items
    .filter(it => publicMode ? ["planned", "in_progress", "done"].includes(it.status) : (statusFilter === "all" || it.status === statusFilter))
    .sort((a, b) => (votes[b.id]?.total || 0) - (votes[a.id]?.total || 0));

  const showKanban = isAdmin && !publicMode && view === "kanban";

  return (
    <div className={showKanban ? "p-4 space-y-4" : "max-w-3xl mx-auto p-4 space-y-4"}>
      {ConfirmDialog}
      <style>{`.kanban-col-hover { background: rgba(220,38,38,0.08) !important; border-color: rgba(220,38,38,0.4) !important; }`}</style>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">{publicMode ? "Roadmap" : "Feedback & Roadmap"}</h2>
          <div className="text-xs text-white/50">{publicMode ? "What's planned, in progress, and shipped." : isAdmin ? "Report bugs, request features, vote — and drag cards between columns to update status." : "Report bugs, request features, and vote on what matters most."}</div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !publicMode && (
            <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
              <button onClick={() => setView("kanban")} title="Kanban board" className={"p-1.5 rounded-md transition " + (view === "kanban" ? "bg-red-900/40 text-red-300" : "text-white/40 hover:text-white")}><LayoutGrid size={14} /></button>
              <button onClick={() => setView("list")} title="List" className={"p-1.5 rounded-md transition " + (view === "list" ? "bg-red-900/40 text-red-300" : "text-white/40 hover:text-white")}><List size={14} /></button>
            </div>
          )}
          {!publicMode && <GBtn onClick={() => setShowNew(s => !s)} className="!text-xs"><Plus size={12} className="inline mr-1" />New</GBtn>}
        </div>
      </div>

      {!publicMode && showNew && (
        <Glass className="p-4 space-y-2.5">
          <div className="flex gap-2">
            <button onClick={() => setNewType("feature")} className={"flex-1 py-2 rounded-lg text-xs font-semibold border transition " + (newType === "feature" ? "border-yellow-500/50 bg-yellow-950/30 text-yellow-300" : "border-white/10 text-white/50")}><Lightbulb size={12} className="inline mr-1" />Feature Request</button>
            <button onClick={() => setNewType("bug")} className={"flex-1 py-2 rounded-lg text-xs font-semibold border transition " + (newType === "bug" ? "border-red-500/50 bg-red-950/30 text-red-300" : "border-white/10 text-white/50")}><Bug size={12} className="inline mr-1" />Bug Report</button>
          </div>
          <GInput value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} placeholder="Short title" className="!text-sm" />
          <GTxt value={newDesc} onChange={(e: any) => setNewDesc(e.target.value)} rows={3} placeholder="Details (optional)" className="!text-sm" />
          <GBtn onClick={submit} disabled={submitting} className="w-full">{submitting ? "Submitting…" : "Submit"}</GBtn>
        </Glass>
      )}

      {!publicMode && !showKanban && (
        <div className="flex gap-1.5 flex-wrap">
          {["all", "submitted", "planned", "in_progress", "done"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={"px-2.5 py-1 rounded-full text-[11px] font-medium border transition " + (statusFilter === s ? "border-red-500/50 bg-red-950/30 text-red-300" : "border-white/10 text-white/50 hover:text-white")}>
              {s === "all" ? "All" : STATUS_META[s].label}
            </button>
          ))}
        </div>
      )}

      {showKanban ? (
        loading ? (
          <div className="text-center py-10 text-white/30 text-sm">Loading…</div>
        ) : (
          <div ref={boardRef} className="flex gap-3 overflow-x-auto pb-2">
            {Object.entries(STATUS_META).map(([statusKey, meta]) => {
              const colItems = items.filter(it => it.status === statusKey).sort((a, b) => (votes[b.id]?.total || 0) - (votes[a.id]?.total || 0));
              return (
                <div key={statusKey} data-kanban-col={statusKey} className="flex-shrink-0 w-72 rounded-xl border border-white/10 bg-black/20 transition-colors">
                  <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black/40 backdrop-blur rounded-t-xl">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5"><meta.icon size={12} className={meta.color} />{meta.label}</div>
                    <div className="text-[10px] text-white/40 font-mono">{colItems.length}</div>
                  </div>
                  <div className="p-2 space-y-2 min-h-[80px]">
                    {colItems.length === 0 && <div className="text-center py-4 text-white/20 text-[11px]">Empty</div>}
                    {colItems.map(it => {
                      const v = votes[it.id] || { total: 0, mine: 0 };
                      const TypeIcon = it.type === "bug" ? Bug : Lightbulb;
                      return (
                        <div
                          key={it.id}
                          onPointerDown={e => handleCardPointerDown(e, it.id)}
                          className={"p-2.5 rounded-lg bg-white/5 border border-white/10 cursor-grab active:cursor-grabbing select-none " + (draggingId === it.id ? "opacity-40" : "")}
                          style={{ touchAction: "none" }}
                        >
                          <div className="flex items-center gap-1.5">
                            <TypeIcon size={11} className={it.type === "bug" ? "text-red-400 flex-shrink-0" : "text-yellow-400 flex-shrink-0"} />
                            <div className="text-xs font-semibold text-white leading-snug">{it.title}</div>
                          </div>
                          {it.description && <div className="text-[10px] text-white/40 mt-1 line-clamp-3">{it.description}</div>}
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                            <div className="text-[10px] text-white/30 truncate">{it.submitted_by_name || it.submitted_by_email || "Anonymous"}</div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] text-white/40 font-mono">{v.total > 0 ? `+${v.total}` : v.total}</span>
                              <button onPointerDown={e => e.stopPropagation()} onClick={() => deleteItem(it.id)} className="text-red-400/50 hover:text-red-400"><Trash2 size={11} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : loading ? (
        <div className="text-center py-10 text-white/30 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-white/30 text-sm">Nothing here yet — be the first to submit something.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(it => {
            const meta = STATUS_META[it.status];
            const v = votes[it.id] || { total: 0, mine: 0 };
            const TypeIcon = it.type === "bug" ? Bug : Lightbulb;
            return (
              <Glass key={it.id} className="p-3 flex gap-3">
                {!publicMode && (
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5">
                    <button onClick={() => vote(it.id, 1)} className={"w-7 h-7 flex items-center justify-center rounded-lg " + (v.mine === 1 ? "text-green-400 bg-green-950/30" : "text-white/30 hover:text-white/60")}><ChevronUp size={16} /></button>
                    <div className="text-xs font-bold text-white">{v.total}</div>
                    <button onClick={() => vote(it.id, -1)} className={"w-7 h-7 flex items-center justify-center rounded-lg " + (v.mine === -1 ? "text-red-400 bg-red-950/30" : "text-white/30 hover:text-white/60")}><ChevronDown size={16} /></button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <TypeIcon size={12} className={it.type === "bug" ? "text-red-400" : "text-yellow-400"} />
                    <div className="text-sm font-semibold text-white">{it.title}</div>
                    <Badge tone={it.status === "done" ? "green" : it.status === "in_progress" ? "yellow" : it.status === "planned" ? "blue" : "gray"}>{meta.label}</Badge>
                  </div>
                  {it.description && <div className="text-xs text-white/50 mt-1 whitespace-pre-wrap">{it.description}</div>}
                  <div className="text-[10px] text-white/30 mt-1">{it.submitted_by_name || it.submitted_by_email || "Anonymous"} · {new Date(it.created_at).toLocaleDateString()}</div>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/10">
                      <GSel value={it.status} onChange={(e: any) => setStatus(it.id, e.target.value)} className="!text-[11px] !py-1">
                        {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k} className="bg-black">{m.label}</option>)}
                      </GSel>
                      <button onClick={() => deleteItem(it.id)} className="text-red-400/60 hover:text-red-400 p-1"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </Glass>
            );
          })}
        </div>
      )}
    </div>
  );
}

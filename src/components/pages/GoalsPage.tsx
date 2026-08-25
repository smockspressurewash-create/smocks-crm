// GoalsPage.tsx — dedicated CRM section for viewing goal progress,
// deadlines, and rewards. Goals themselves are still added/checked-off from
// Accountability's "Goals" tab (goalsList/setGoalsList in App.tsx) — this
// page is a read-focused dashboard over that same shared state, not a
// second parallel goals store.
import React from "react";
import { Target, Clock, Gift, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { Badge } from "../ui/Badge";
import { PageFade } from "../ui/PageFade";
import { today } from "../../lib/utils";

const CAT_ICON: Record<string, string> = { revenue: "💰", fitness: "💪", learning: "📚", family: "👨‍👩‍👧" };

export function GoalsPage({ goals = [], setPage }: { goals?: any[]; setPage?: (p: string) => void }) {
  const tKey = today();

  const withMeta = goals.map((g: any) => {
    const numericProgress = typeof g.current === "number" && typeof g.target === "number" && g.target > 0;
    const pct = g.done ? 100 : numericProgress ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline + "T00:00:00").getTime() - new Date(tKey + "T00:00:00").getTime()) / 86400000) : null;
    const overdue = !g.done && daysLeft !== null && daysLeft < 0;
    const hasReward = !!(g.rewardAmount || g.rewardDescription);
    return { ...g, pct, daysLeft, overdue, hasReward };
  });

  const activeGoals = withMeta.filter((g: any) => !g.done);
  const doneGoals = withMeta.filter((g: any) => g.done);
  const overdueCount = withMeta.filter((g: any) => g.overdue).length;
  const rewardsEarned = doneGoals.filter((g: any) => g.hasReward && g.metByDeadline).length;

  const GoalCard = ({ g }: { g: any }) => (
    <Glass className={"p-4 " + (g.done ? "opacity-80" : g.overdue ? "border-red-800/50" : "")}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{CAT_ICON[g.category] || "🎯"}</span>
          <div className={"font-semibold text-sm truncate " + (g.done ? "line-through text-white/50" : "")}>{g.text || g.label}</div>
        </div>
        {g.done
          ? <Badge tone="green"><CheckCircle2 size={11} className="inline mr-1" />Done</Badge>
          : g.overdue
            ? <Badge tone="red"><AlertTriangle size={11} className="inline mr-1" />Overdue</Badge>
            : g.deadline
              ? <Badge tone="blue"><Clock size={11} className="inline mr-1" />{g.daysLeft}d left</Badge>
              : null}
      </div>
      <div className="h-2 bg-black/40 rounded-full overflow-hidden mb-2">
        <div className={"h-full rounded-full transition-all duration-500 " + (g.done ? "bg-green-500" : g.overdue ? "bg-red-600" : "bg-gradient-to-r from-red-600 to-red-400")} style={{ width: g.pct + "%" }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
        {g.deadline && <span>Deadline: {g.deadline}</span>}
        {g.done && g.deadline && <span className={g.metByDeadline ? "text-green-400" : "text-amber-400"}>{g.metByDeadline ? "Hit deadline ✓" : "Completed late"}</span>}
        {g.hasReward && (
          <span className={"flex items-center gap-1 " + (g.done && !g.metByDeadline ? "text-white/30 line-through" : "text-yellow-400")}>
            <Gift size={11} />{g.rewardDescription || ("$" + g.rewardAmount)}
          </span>
        )}
      </div>
    </Glass>
  );

  return (
    <PageFade>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xl font-black flex items-center gap-2"><Target size={20} className="text-red-500" />Goals</div>
            <div className="text-sm text-white/40">Progress, deadlines, and rewards across every goal you've set</div>
          </div>
          <GBtn variant="ghost" onClick={() => setPage?.("accountability")}>
            Manage Goals <ArrowRight size={14} className="inline ml-1" />
          </GBtn>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Glass className="p-4 text-center">
            <div className="text-2xl font-black">{goals.length}</div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Total Goals</div>
          </Glass>
          <Glass className="p-4 text-center">
            <div className="text-2xl font-black text-green-400">{doneGoals.length}</div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Completed</div>
          </Glass>
          <Glass className={"p-4 text-center " + (overdueCount > 0 ? "border-red-800/50" : "")}>
            <div className={"text-2xl font-black " + (overdueCount > 0 ? "text-red-400" : "")}>{overdueCount}</div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Overdue</div>
          </Glass>
          <Glass className="p-4 text-center">
            <div className="text-2xl font-black text-yellow-400">{rewardsEarned}</div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Rewards Earned</div>
          </Glass>
        </div>

        {activeGoals.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">In Progress</div>
            <div className="grid md:grid-cols-2 gap-3">
              {activeGoals.map((g: any) => <GoalCard key={g.id} g={g} />)}
            </div>
          </div>
        )}

        {doneGoals.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Completed</div>
            <div className="grid md:grid-cols-2 gap-3">
              {doneGoals.map((g: any) => <GoalCard key={g.id} g={g} />)}
            </div>
          </div>
        )}

        {goals.length === 0 && (
          <Glass className="p-8 text-center">
            <Target size={32} className="mx-auto text-white/20 mb-3" />
            <div className="text-white/60 font-semibold mb-1">No goals yet</div>
            <div className="text-sm text-white/40 mb-4">Set a goal — with an optional deadline and reward — from Accountability's Goals tab.</div>
            <GBtn onClick={() => setPage?.("accountability")}>Add Your First Goal</GBtn>
          </Glass>
        )}
      </div>
    </PageFade>
  );
}

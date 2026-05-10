import React, { useState, useEffect, useRef } from 'react';
import { Flame, Target, Trophy, Heart, Smile, Moon, Droplet, Activity, Dumbbell, FileText, Save, Plus, Trash2, Zap, Mic, RefreshCw, X } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GTxt } from '../ui/GTxt';
import { GSel } from '../ui/GSel';
import { Badge } from '../ui/Badge';
import { Stat } from '../ui/Stat';
import { usePersistent } from '../../hooks/usePersistent';
import { uid, today, fmt, daysSince, daysFromNow } from '../../lib/utils';

export function AccountabilityPage({ entries = [], setEntries, goals = [], setGoals, wins = [], setWins, toast }: any) {
  const [tab, setTab] = useState("today");
  const [f, setF] = useState<any>({ sleep: 7, water: 0, gymMinutes: 0, meditationMinutes: 0, steps: 0, mood: 3, notes: "" });
  const [gText, setGText] = useState("");
  const [wText, setWText] = useState("");

  const tKey = today();
  const todayEntry = entries.find((e: any) => e.date === tKey);
  const hour = new Date().getHours();

  useEffect(() => {
    if (todayEntry) setF({ sleep: todayEntry.sleep, water: todayEntry.water, gymMinutes: todayEntry.gymMinutes || (todayEntry.gym ? 60 : 0), meditationMinutes: todayEntry.meditationMinutes || 0, steps: todayEntry.steps, mood: todayEntry.mood, notes: todayEntry.notes || "" });
  }, [todayEntry]);

  const save = () => {
    const payload = { id: todayEntry?.id || uid(), date: tKey, ...f, sleep: Number(f.sleep), water: Number(f.water), gymMinutes: Number(f.gymMinutes), meditationMinutes: Number(f.meditationMinutes), steps: Number(f.steps), mood: Number(f.mood) };
    if (todayEntry) setEntries(entries.map((e: any) => e.id === todayEntry.id ? payload : e));
    else setEntries([...entries, payload]);
    if (toast) toast("Check-in logged");
  };

  const [reminders, setReminders] = usePersistent("smocks.reminders", [
    { id: "r1", text: "Call Mom", frequency: "weekly", emoji: "📞", lastDone: null },
    { id: "r2", text: "Review business goals", frequency: "weekly", emoji: "🎯", lastDone: null },
    { id: "r3", text: "Send invoices", frequency: "daily", emoji: "💰", lastDone: null },
  ]);

  const addGoal = () => {
    if (!gText.trim()) return;
    setGoals([...goals, { id: uid(), text: gText.trim(), done: false, createdAt: today() }]);
    setGText("");
    if (toast) toast("Goal added");
  };

  const addWin = () => {
    if (!wText.trim()) return;
    setWins([...wins, { id: uid(), text: wText.trim(), date: today() }]);
    setWText("");
    if (toast) toast("Win logged");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Flame} label="Check-ins" value={entries.length} />
        <Stat icon={Target} label="Active Goals" value={goals.filter((g: any) => !g.done).length} />
        <Stat icon={Trophy} label="Wins" value={wins.length} />
        <Stat icon={Heart} label="Mood Avg" value={entries.length ? (entries.reduce((s: any, e: any) => s + e.mood, 0) / entries.length).toFixed(1) : "—"} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {["today", "history", "goals", "wins", "reminders", "reflect"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={"px-4 py-2 rounded-xl text-sm font-medium transition border capitalize " + (tab === t ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>
            {t === "reflect" ? "✨ Reflect" : t}
          </button>
        ))}
      </div>

      {tab === "today" && (
        <Glass className="p-5">
          <div className="flex items-center gap-2 mb-4"><Heart size={16} className="text-red-400" /><h3 className="font-semibold">Daily Check-in · {tKey}</h3>{todayEntry && <Badge tone="green">Logged</Badge>}</div>
          <div className="space-y-4">
            <div><label className="text-xs text-white/60 mb-2 flex items-center gap-1"><Moon size={10} />Sleep (hrs): <span className="text-red-400 font-bold ml-1">{f.sleep}</span></label><input type="range" min="0" max="12" step="0.5" value={f.sleep} onChange={e => setF({ ...f, sleep: e.target.value })} className="w-full accent-red-600" /></div>
            <div><label className="text-xs text-white/60 mb-2 flex items-center gap-1"><Droplet size={10} />Water (oz): <span className="text-red-400 font-bold ml-1">{f.water}</span></label><input type="range" min="0" max="128" step="8" value={f.water} onChange={e => setF({ ...f, water: e.target.value })} className="w-full accent-red-600" /></div>
            <div><label className="text-xs text-white/60 mb-2 flex items-center gap-1"><Activity size={10} />Steps: <span className="text-red-400 font-bold ml-1">{Number(f.steps).toLocaleString()}</span></label><input type="range" min="0" max="20000" step="500" value={f.steps} onChange={e => setF({ ...f, steps: e.target.value })} className="w-full accent-red-600" /></div>
            <div><label className="text-xs text-white/60 mb-2 flex items-center gap-1"><Smile size={10} />Mood:</label><div className="flex gap-2">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setF({ ...f, mood: n })} className={"flex-1 py-2 rounded-lg text-xl transition " + (f.mood === n ? "bg-red-900/40 border border-red-500/50" : "bg-white/5 border border-white/10")}>{["😞", "😕", "😐", "🙂", "🔥"][n - 1]}</button>)}</div></div>
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
              <Dumbbell size={16} className={Number(f.gymMinutes) > 0 ? "text-red-400" : "text-white/50"} />
              <span className={Number(f.gymMinutes) > 0 ? "font-semibold flex-1" : "text-white/60 flex-1"}>Workout</span>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="300" step="5" value={f.gymMinutes} onChange={e => setF({ ...f, gymMinutes: Number(e.target.value) })} className="w-16 bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-red-500/50" />
                <span className="text-xs text-white/50">min</span>
              </div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt rows={2} value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} placeholder="What happened today?" /></div>
            <GBtn onClick={save} className="w-full"><Save size={14} className="inline mr-1.5" />{todayEntry ? "Update" : "Log"} Check-in</GBtn>
          </div>
        </Glass>
      )}

      {tab === "history" && (
        <Glass className="p-5">
          <h3 className="font-semibold mb-4">Check-in History</h3>
          <div className="space-y-2">
            {entries.slice().sort((a: any, b: any) => b.date.localeCompare(a.date)).map((e: any) => (
              <div key={e.id} className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">{e.date}</div>
                  <div className="text-lg">{["😞", "😕", "😐", "🙂", "🔥"][e.mood - 1]}</div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs text-center">
                  <div><div className="text-white/50">Sleep</div><div className="font-bold">{e.sleep}h</div></div>
                  <div><div className="text-white/50">Water</div><div className="font-bold">{e.water}oz</div></div>
                  <div><div className="text-white/50">Steps</div><div className="font-bold">{Number(e.steps || 0).toLocaleString()}</div></div>
                </div>
              </div>
            ))}
          </div>
        </Glass>
      )}

      {tab === "goals" && (
        <div className="space-y-4">
          <Glass className="p-5">
            <div className="flex gap-2 mb-3">
              <GInput placeholder="Add a goal..." value={gText} onChange={(e: any) => setGText(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && addGoal()} className="flex-1" />
              <GBtn onClick={addGoal}><Plus size={14} /></GBtn>
            </div>
            <div className="space-y-2">
              {goals.map((g: any) => (
                <div key={g.id} className={"flex items-center gap-3 p-3 rounded-xl border transition " + (g.done ? "bg-green-900/20 border-green-700/40" : "bg-white/5 border-white/10")}>
                  <input type="checkbox" checked={g.done} onChange={() => setGoals(goals.map((x: any) => x.id === g.id ? { ...x, done: !x.done } : x))} className="w-5 h-5 accent-red-600" />
                  <div className="flex-1 min-w-0">
                    <div className={"text-sm " + (g.done ? "line-through text-white/40" : "")}>{g.text}</div>
                  </div>
                  <button onClick={() => setGoals(goals.filter((x: any) => x.id !== g.id))} className="p-1 text-white/40 hover:text-red-400"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </Glass>
        </div>
      )}
    </div>
  );
}

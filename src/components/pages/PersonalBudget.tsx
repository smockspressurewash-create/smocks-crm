// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { uid, today, daysSince, fmt, daysFromNow } from '../../lib/utils';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GSel } from '../ui/GSel';
import { Modal } from '../ui/Modal';
import { Glass } from '../ui/Glass';
import { PageFade } from '../ui/PageFade';
import { VoiceMicButton } from '../ui/VoiceMicButton';
import { MODELS, callModel, parseRateLimitError } from '../../lib/ai';
import { twilioSend, sendEmail } from '../../lib/messaging';
import { sendGmailEmail, createCalendarEvent, uploadToDrive } from '../../lib/google';
import { personalities } from '../../lib/constants';

// Destructure common icons to avoid rewriting component code
const { 
  Bot, Settings, X, Plus, Search, Edit, Trash2, Send, Activity, Users,
  MessageSquare, Mic, Play, Volume2, Cloud, FileImage, Link, ArrowRight,
  CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Menu, Zap, Clock, GripVertical, RefreshCw, Copy, Paperclip, Target, Workflow, BarChart2,
  Lock, Key, Image: ImageIcon, MapPin, Map, Sun, Wind, Umbrella, CheckSquare, Save, XCircle
} = LucideIcons;

export function PersonalBudgetPage({ toast }) {
  const [transactions, setTransactions] = usePersistent("smocks.personal.transactions", []);
  const [budgets, setBudgets] = usePersistent("smocks.personal.budgets", {
    housing: 1200, food: 600, transport: 400, entertainment: 200, health: 150, savings: 500, other: 300
  });
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ date: today(), description: "", amount: "", category: "Food & Dining", type: "expense", account: "Checking" });
  const [timeframe, setTimeframe] = useState("30d");
  const [editBudget, setEditBudget] = useState(null);

  const categories = ["Housing", "Food & Dining", "Transportation", "Entertainment", "Health & Fitness", "Savings", "Clothing", "Phone", "Subscriptions", "Family", "Other"];
  const accounts = ["Checking", "Savings", "Credit Card", "Cash"];
  const catKey = c => c.toLowerCase().split(" ")[0];

  const tfTx = filterByTimeframe(transactions, "date", timeframe);
  const income = tfTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const spent = tfTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const net = income - spent;

  const saveTx = () => {
    if (!f.description.trim() || !f.amount) return;
    setTransactions(prev => [{ ...f, id: uid(), amount: Number(f.amount) }, ...prev]);
    setF({ date: today(), description: "", amount: "", category: "Food & Dining", type: "expense", account: "Checking" });
    setModal(false);
    toast("Transaction added");
  };

  const spentByCategory = categories.reduce((acc, cat) => {
    acc[cat] = tfTx.filter(t => t.type === "expense" && t.category === cat).reduce((s, t) => s + Number(t.amount), 0);
    return acc;
  }, {});

  const totalBudgeted = Object.values(budgets).reduce((s, v) => s + Number(v), 0);

  const exportPersonalPDF = () => {
    const rows = tfTx.map(t => `<tr><td>${t.date}</td><td>${t.category}</td><td>${t.description}</td><td>${t.account}</td><td class="${t.type === "income" ? "inc" : "exp"}">${t.type === "income" ? "+" : "−"}$${Number(t.amount).toFixed(2)}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Personal Budget</title><style>body{font-family:Arial,sans-serif;padding:32px;max-width:800px;margin:auto}h1{color:#333}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f0f0f0;padding:8px;text-align:left;border-bottom:2px solid #ccc;text-transform:uppercase;font-size:10px}td{padding:7px;border-bottom:1px solid #eee}.inc{color:green;font-weight:bold}.exp{color:#dc2626;font-weight:bold}.sum{margin:16px 0;padding:12px;background:#f9f9f9;border-radius:8px;display:flex;gap:32px}.sk{font-size:11px;color:#666}.sv{font-size:18px;font-weight:bold}</style></head><body><h1>Personal Budget</h1><p style="color:#666">${TIMEFRAMES.find(t => t.key === timeframe)?.label || "All"} · ${today()}</p><div class="sum"><div><div class="sk">Income</div><div class="sv" style="color:green">$${income.toFixed(2)}</div></div><div><div class="sk">Spent</div><div class="sv" style="color:#dc2626">$${spent.toFixed(2)}</div></div><div><div class="sk">Net</div><div class="sv" style="color:${net>=0?"green":"#dc2626"}">${net>=0?"+":"−"}$${Math.abs(net).toFixed(2)}</div></div></div><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Account</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>setTimeout(window.print,300)</script></body></html>`;
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2"><Heart size={18} className="text-pink-400" />Personal Budget</h2>
          <div className="text-xs text-white/50 mt-0.5">Track personal income & spending — separate from the business</div>
        </div>
        <div className="flex items-center gap-2">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} options={["7d","30d","90d","6m","1y","all"]} compact />
          <GBtn variant="ghost" onClick={exportPersonalPDF} className="!text-xs"><Download size={12} className="inline mr-1" />PDF</GBtn>
          <GBtn onClick={() => setModal(true)} className="!text-xs"><Plus size={12} className="inline mr-1" />Add</GBtn>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-green-950/20 border border-green-700/30 rounded-2xl">
          <div className="text-[10px] text-green-400 uppercase tracking-wider mb-1">💵 Income</div>
          <div className="text-2xl font-bold text-green-400">{fmt(income)}</div>
        </div>
        <div className="p-4 bg-red-950/20 border border-red-700/30 rounded-2xl">
          <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1">💳 Spent</div>
          <div className="text-2xl font-bold text-red-400">{fmt(spent)}</div>
        </div>
        <div className={"p-4 border rounded-2xl " + (net >= 0 ? "bg-green-950/20 border-green-700/30" : "bg-red-950/20 border-red-700/30")}>
          <div className={"text-[10px] uppercase tracking-wider mb-1 " + (net >= 0 ? "text-green-400" : "text-red-400")}>{net >= 0 ? "✅ Surplus" : "⚠️ Deficit"}</div>
          <div className={"text-2xl font-bold " + (net >= 0 ? "text-green-400" : "text-red-400")}>{net >= 0 ? "+" : ""}{fmt(net)}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Budget vs Actual */}
        <Glass className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Budget vs Actual</h3>
            <div className="text-xs text-white/40">Budgeted: {fmt(totalBudgeted)}/mo</div>
          </div>
          <div className="space-y-3">
            {categories.filter(cat => (budgets[catKey(cat)] || 0) > 0 || spentByCategory[cat] > 0).map(cat => {
              const budget = budgets[catKey(cat)] || 0;
              const actual = spentByCategory[cat] || 0;
              const pct = budget > 0 ? Math.min(100, (actual / budget * 100)) : 0;
              const over = actual > budget && budget > 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/70">{cat}</span>
                    <div className="flex items-center gap-2">
                      <span className={over ? "text-red-400 font-bold" : "text-white/60"}>{fmt(actual)}</span>
                      <button onClick={() => setEditBudget({ key: catKey(cat), label: cat, value: budget })} className="text-white/30 hover:text-white/60 text-[10px]">/{fmt(budget)} ✏️</button>
                    </div>
                  </div>
                  <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                    <div className={"h-full rounded-full transition-all " + (over ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-gradient-to-r from-green-500 to-green-600")} style={{ width: pct + "%" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Glass>

        {/* Recent transactions */}
        <Glass className="p-5">
          <h3 className="font-semibold text-sm mb-4">Transactions</h3>
          {tfTx.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">No transactions yet — add your first one</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {tfTx.slice(0, 30).map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: t.type === "income" ? "rgba(16,185,129,0.15)" : "rgba(220,38,38,0.15)" }}>
                    {t.type === "income" ? "💵" : { "Food & Dining": "🍔", Housing: "🏠", Transportation: "🚗", Entertainment: "🎮", "Health & Fitness": "💪", Savings: "🏦", Clothing: "👕", Phone: "📱", Subscriptions: "📺", Family: "👨‍👩‍👧", Other: "💸" }[t.category] || "💸"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.description}</div>
                    <div className="text-xs text-white/40">{t.category} · {t.date}</div>
                  </div>
                  <div className={"font-bold text-sm flex-shrink-0 " + (t.type === "income" ? "text-green-400" : "text-red-400")}>
                    {t.type === "income" ? "+" : "−"}{fmt(Number(t.amount))}
                  </div>
                  <button onClick={() => setTransactions(prev => prev.filter(x => x.id !== t.id))} className="p-1 rounded hover:bg-red-900/30 text-white/30 hover:text-red-400"><Trash2 size={10} /></button>
                </div>
              ))}
            </div>
          )}
        </Glass>
      </div>

      {/* Add Transaction Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Transaction" maxW="max-w-sm">
        <div className="space-y-3">
          <div className="flex gap-2">
            {["expense","income"].map(t => (
              <button key={t} onClick={() => setF({ ...f, type: t })} className={"flex-1 py-2 rounded-xl border text-xs font-semibold uppercase transition " + (f.type === t ? (t === "income" ? "bg-green-900/40 border-green-500/50 text-green-200" : "bg-red-900/40 border-red-500/50 text-red-200") : "bg-black/40 border-white/10 text-white/50 hover:text-white")}>
                {t === "income" ? "💵 Income" : "💳 Expense"}
              </button>
            ))}
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Date</label><GDate value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Description</label><GInput value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Groceries, rent, paycheck..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Amount ($)</label><GInput type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="0.00" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Account</label><GSel value={f.account} onChange={e => setF({ ...f, account: e.target.value })} className="!text-xs">{accounts.map(a => <option key={a} value={a} className="bg-black">{a}</option>)}</GSel></div>
          </div>
          {f.type === "expense" && <div><label className="text-xs text-white/60 mb-1 block">Category</label><GSel value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className="!text-xs">{categories.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel></div>}
          <div className="flex gap-2 justify-end pt-1">
            <GBtn variant="ghost" onClick={() => setModal(false)}>Cancel</GBtn>
            <GBtn onClick={saveTx} disabled={!f.description.trim() || !f.amount}>Add</GBtn>
          </div>
        </div>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal open={!!editBudget} onClose={() => setEditBudget(null)} title="Set Monthly Budget" maxW="max-w-xs">
        {editBudget && <div className="space-y-3">
          <div className="text-sm text-white/70">{editBudget.label}</div>
          <div><label className="text-xs text-white/60 mb-1 block">Monthly limit ($)</label>
            <GInput type="number" autoFocus value={editBudget.value} onChange={e => setEditBudget({ ...editBudget, value: Number(e.target.value) })} onKeyDown={e => { if (e.key === "Enter") { setBudgets(prev => ({ ...prev, [editBudget.key]: Number(editBudget.value) })); setEditBudget(null); toast("Budget updated"); }}} />
          </div>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setEditBudget(null)}>Cancel</GBtn>
            <GBtn onClick={() => { setBudgets(prev => ({ ...prev, [editBudget.key]: Number(editBudget.value) })); setEditBudget(null); toast("Budget updated"); }}>Save</GBtn>
          </div>
        </div>}
      </Modal>
    </div>
  );
}

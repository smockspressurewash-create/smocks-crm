import React, { useState, useEffect } from 'react';
import { Play, Save, X, Zap, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { GBtn } from './GBtn';
import { GInput } from './GInput';
import { GTxt } from './GTxt';
import { GSel } from './GSel';
import { uid, today } from '../../lib/utils';
import { checkCondition } from '../../hooks/useAutomationEngine';

const MERGE_TAGS = ["{{first_name}}", "{{last_name}}", "{{amount}}", "{{date}}", "{{address}}", "{{review_link}}", "{{portal_link}}", "{{company_phone}}"];

const NODE_STYLES: any = {
  trigger: { bg: "bg-blue-600", border: "border-blue-500", glow: "rgba(59,130,246,0.4)", icon: "▶", label: "TRIGGER", ring: "ring-blue-500" },
  condition: { bg: "bg-amber-600", border: "border-amber-500", glow: "rgba(245,158,11,0.4)", icon: "⬡", label: "IF", ring: "ring-amber-500" },
  delay: { bg: "bg-violet-600", border: "border-violet-500", glow: "rgba(139,92,246,0.4)", icon: "⏳", label: "WAIT", ring: "ring-violet-500" },
  action: { bg: "bg-emerald-600", border: "border-emerald-500", glow: "rgba(16,185,129,0.4)", icon: "⚡", label: "ACTION", ring: "ring-emerald-500" },
  branch: { bg: "bg-rose-600", border: "border-rose-500", glow: "rgba(244,63,94,0.4)", icon: "⑂", label: "BRANCH", ring: "ring-rose-500" },
};

const CONDITION_OPTIONS = [
  { k: "estimate_pending", l: "Estimate is still pending" },
  { k: "estimate_accepted", l: "Estimate was accepted" },
  { k: "estimate_unsigned", l: "Estimate not yet signed" },
  { k: "invoice_unpaid", l: "Invoice is unpaid" },
  { k: "invoice_paid", l: "Invoice has been paid" },
  { k: "quote_not_viewed", l: "Quote hasn't been opened" },
  { k: "rated_5", l: "Customer rated 5 stars" },
  { k: "rated_low", l: "Customer rated ≤3 stars" },
  { k: "stale_customer", l: "No service in 180+ days" },
  { k: "no_response_24h", l: "No response in 24 hours" },
  { k: "no_new_job", l: "No new job booked" },
  { k: "no_recent_job", l: "No job in 30 days" },
  { k: "zero_referrals", l: "Customer has 0 referrals" },
  { k: "has_dog", l: "Property has dog on file" },
];

const TRIGGER_PRESETS = [
  { group: "🔨 Jobs", items: ["Job scheduled", "24h before scheduled job", "Job day morning", "Crew starts job", "Job complete", "Job complete + 2h", "Job complete + 48h"] },
  { group: "📋 Estimates", items: ["Estimate sent", "Estimate viewed", "Estimate accepted", "Quote unviewed 24h", "Quote unviewed 5 days", "Estimate expires in 3 days", "Estimate signed"] },
  { group: "💸 Payments", items: ["Payment received", "Invoice unpaid 3 days", "Invoice unpaid 7 days", "Invoice unpaid 14 days", "Invoice overdue"] },
  { group: "👤 Customers", items: ["New customer added", "New inquiry submitted", "6 months since last wash", "Customer birthday", "1 year anniversary", "Re-engagement (inactive 90d)"] },
  { group: "⭐ Reviews", items: ["Post-job review request", "Review submitted (5 star)", "Negative review (≤3 stars)"] },
  { group: "📅 Scheduled", items: ["March 1st annually", "October 1st annually", "Manual trigger", "Every Monday 8am"] },
];

const ACTION_CONFIGS: any = {
  sms: { presets: ["Thank you for choosing Smock's!", "Reminder: service tomorrow at {{date}}", "We're on our way! ETA 15 min", "Review request: {{review_link}}", "Invoice due: {{portal_link}}", "Promo: 15% off this month"], subject: false },
  email: { presets: ["Welcome to Smock's — here's what to expect", "Your estimate is ready", "Service complete — how'd we do?", "Invoice ready for review", "Seasonal maintenance reminder", "Thank you for your business"], subject: true },
  task: { presets: ["Call customer to follow up", "Leave door hanger at property", "Send handwritten thank-you", "Schedule follow-up estimate", "Review negative feedback", "Flag for VIP upgrade"], subject: false },
  internal: { presets: ["Log contact to timeline", "Add note to customer record", "Notify Will via SMS", "Create CRM task", "Flag as high priority"], subject: false },
  webhook: { presets: [], subject: false },
  calendar: { presets: ["Create reminder event", "Block follow-up time", "Add to content calendar"], subject: false }
};

export function VisualWorkflowBuilder({ open, data, onClose, onSave }: any) {
  const [w, setW] = useState<any>({ name: "", category: "other", icon: "📋", description: "", steps: [] });
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showNodePicker, setShowNodePicker] = useState<number | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testLog, setTestLog] = useState<any[]>([]);
  const [aiDrafting, setAiDrafting] = useState(false);

  useEffect(() => {
    if (open && data) {
      setW({ id: data.id, name: data.name || "Untitled Workflow", category: data.category || "other", icon: data.icon || "📋", description: data.description || "", steps: data.steps?.length ? data.steps : [{ id: uid(), type: "trigger", label: "Choose a trigger…" }] });
      setSelectedIdx(0);
      setShowNodePicker(null);
      setTestLog([]);
    }
  }, [open, data]);

  const updateStep = (idx: number, patch: any) => setW((prev: any) => ({ ...prev, steps: prev.steps.map((s: any, i: number) => i === idx ? { ...s, ...patch } : s) }));
  
  const insertStep = (afterIdx: number, type: string) => {
    const defaults: any = {
      trigger: { label: "Choose a trigger…" },
      condition: { label: "Check condition", check: "estimate_pending" },
      delay: { label: "Wait 1 day", duration: 1, unit: "day" },
      action: { label: "Send message", channel: "sms", messageBody: "Hi {{first_name}}, " },
      branch: { label: "If 5 stars → Google, else → feedback", branches: ["5 stars", "≤4 stars"] }
    };
    const newStep = { id: uid(), type, ...defaults[type] };
    const next = [...w.steps];
    next.splice(afterIdx + 1, 0, newStep);
    setW((prev: any) => ({ ...prev, steps: next }));
    setSelectedIdx(afterIdx + 1);
    setShowNodePicker(null);
  };

  const deleteStep = (idx: number) => {
    if (w.steps.length <= 1) return;
    setW((prev: any) => ({ ...prev, steps: prev.steps.filter((_: any, i: number) => i !== idx) }));
    setSelectedIdx(Math.max(0, idx - 1));
  };

  const moveStep = (idx: number, dir: number) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= w.steps.length) return;
    const next = [...w.steps];
    [next[idx], next[ni]] = [next[ni], next[idx]];
    setW((prev: any) => ({ ...prev, steps: next }));
    setSelectedIdx(ni);
  };

  const duplicateStep = (idx: number) => {
    const copy = { ...w.steps[idx], id: uid() };
    const next = [...w.steps];
    next.splice(idx + 1, 0, copy);
    setW((prev: any) => ({ ...prev, steps: next }));
    setSelectedIdx(idx + 1);
  };

  const runTest = async () => {
    setTestRunning(true);
    setTestLog([{ ts: Date.now(), message: "🚀 Starting test run…", status: "running" }]);
    const sampleCtx = { type: "manual", job: { id: "test", amount: 742, scheduledDate: today(), status: "completed", address: "412 Oak Ridge Ln, York PA" }, customer: { id: "test", firstName: "Jennifer", lastName: "Walsh", email: "jennifer@test.com", phone: "+17175550201" }, estimate: { total: 742, status: "pending" }, daysSinceInvoiced: 8, daysSinceLast: 200, rating: 5, isNegative: false };
    const logs: any[] = [];
    for (const step of w.steps) {
      await new Promise(r => setTimeout(r, 300));
      if (step.type === "trigger") {
        logs.push({ ts: Date.now(), message: "▶ TRIGGER: " + step.label, status: "ok" });
      } else if (step.type === "delay") {
        logs.push({ ts: Date.now(), message: "⏳ DELAY: " + step.label + " (skipped in test)", status: "skipped" });
      } else if (step.type === "condition") {
        const pass = checkCondition(step.check, sampleCtx);
        logs.push({ ts: Date.now(), message: (pass ? "✅" : "⛔") + " CONDITION: " + step.label + " → " + (pass ? "PASS" : "FAIL"), status: pass ? "ok" : "skipped" });
      } else if (step.type === "action") {
        const ch = step.channel || "sms";
        const body = (step.messageBody || step.label || "").replace(/{{first_name}}/g, "Jennifer");
        const icon: any = { sms: "💬", email: "📧", task: "✅", webhook: "🔗", calendar: "📅", internal: "🔔" };
        logs.push({ ts: Date.now(), message: (icon[ch] || "⚡") + " ACTION [" + ch.toUpperCase() + "]: " + body.slice(0, 80), status: "sent" });
      }
      setTestLog([...logs]);
    }
    logs.push({ ts: Date.now(), message: "✅ Test complete", status: "done" });
    setTestLog([...logs]);
    setTestRunning(false);
  };

  const selected = selectedIdx !== null ? w.steps[selectedIdx] : null;
  const ns = selected ? (NODE_STYLES[selected.type] || NODE_STYLES.action) : null;

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="" maxW="max-w-[96vw]">
      <div className="-mx-5 -mt-5 -mb-5 flex flex-col" style={{ height: "min(90vh, 880px)" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-red-900/30 bg-black/80 backdrop-blur flex-shrink-0">
          <input value={w.name} onChange={(e: any) => setW({ ...w, name: e.target.value })} placeholder="Workflow name…" className="flex-1 bg-transparent font-bold text-base focus:outline-none border-b border-transparent focus:border-red-500/50 pb-0.5 transition-colors" />
          <GBtn variant="ghost" onClick={runTest} disabled={testRunning} className="!text-xs !py-1.5">
            {testRunning ? "Testing…" : "Test Run"}
          </GBtn>
          <GBtn onClick={() => onSave(w)} disabled={!w.name.trim()} className="!py-1.5 !text-sm"><Save size={13} className="inline mr-1.5" />Save</GBtn>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto bg-[#080808] relative">
            <div className="flex flex-col items-center py-8 px-4 gap-0 min-w-[320px]">
              {w.steps.map((step: any, idx: number) => {
                const style = NODE_STYLES[step.type] || NODE_STYLES.action;
                const isSel = selectedIdx === idx;
                return (
                  <div key={step.id} className="flex flex-col items-center w-full max-w-[380px]">
                    <div onClick={() => setSelectedIdx(idx)} className={"w-full rounded-2xl border-2 cursor-pointer transition-all " + (isSel ? style.border : "border-white/10")}>
                      <div className={"px-4 py-2.5 flex items-center gap-2.5 rounded-t-xl " + style.bg}>
                        <span className="text-base font-bold">{style.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest flex-1">{style.label}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteStep(idx); }} className="text-white/60 hover:text-white">✕</button>
                      </div>
                      <div className="px-4 py-3 bg-[#101010] rounded-b-xl text-sm font-semibold">{step.label}</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-white/10" />
                      <button onClick={() => setShowNodePicker(idx)} className="w-6 h-6 rounded-full border border-dashed border-white/20 flex items-center justify-center text-white/30 hover:text-white text-sm">+</button>
                      {idx < w.steps.length - 1 && <div className="w-px h-4 bg-white/10" />}
                    </div>
                    {showNodePicker === idx && (
                      <div className="bg-[#0e0e0e] border border-white/15 rounded-2xl p-3 shadow-2xl z-10 w-64 backdrop-blur mt-2">
                         <div className="grid grid-cols-5 gap-1.5">
                            {Object.entries(NODE_STYLES).map(([k, s]: any) => (
                              <button key={k} onClick={() => insertStep(idx, k)} className={"flex flex-col items-center gap-1 p-2 rounded-xl border " + s.bg}>
                                <span className="text-lg">{s.icon}</span>
                              </button>
                            ))}
                         </div>
                         <button onClick={() => setShowNodePicker(null)} className="mt-2 w-full text-[10px] text-white/30 text-center">Cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-80 flex-shrink-0 border-l border-red-900/25 bg-[#0c0c0c] p-4 overflow-y-auto">
            {selected ? (
              <div className="space-y-4">
                <div className="font-bold uppercase tracking-widest text-[10px] text-white/40">{selected.type} settings</div>
                <GInput value={selected.label} onChange={(e: any) => updateStep(selectedIdx!, { label: e.target.value })} />
                {selected.type === "action" && (
                  <GSel value={selected.channel} onChange={(e: any) => updateStep(selectedIdx!, { channel: e.target.value })}>
                    {Object.keys(ACTION_CONFIGS).map(k => <option key={k} value={k} className="bg-black">{k}</option>)}
                  </GSel>
                )}
                {["sms", "email"].includes(selected.channel) && (
                  <GTxt value={selected.messageBody} onChange={(e: any) => updateStep(selectedIdx!, { messageBody: e.target.value })} rows={5} placeholder="Message body..." />
                )}
              </div>
            ) : (
              <div className="text-center text-white/20 mt-20">Click a node to configure</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

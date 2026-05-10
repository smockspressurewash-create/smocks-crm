import React, { useState } from 'react';
import { Workflow, Activity, Layers, Plus, Search, X, Play, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { GBtn } from '../ui/GBtn';
import { Modal } from '../ui/Modal';
import { VisualWorkflowBuilder } from '../ui/VisualWorkflowBuilder';
import { useAutomationEngine, runWorkflow } from '../../hooks/useAutomationEngine';
import { uid, today } from '../../lib/utils';
import { AUTOMATION_TEMPLATES, CATEGORY_META } from '../../lib/constants';

export function AutomationsPage({ automations = [], setAutomations, jobs = [], customers = [], estimates = [], settings = {}, toast }: any) {
  const [builderOpen, setBuilderOpen] = useState<any>({ open: false, data: null });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [logOpen, setLogOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const execLog = useAutomationEngine(automations, setAutomations, jobs, customers, estimates, toast, settings);

  const toggle = (id: string) => setAutomations((prev: any[]) => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  const del = (id: string) => { if (confirm("Delete this workflow?")) setAutomations((prev: any[]) => prev.filter(a => a.id !== id)); };

  const inferCtxType = (a: any) => {
    const t = (a.steps?.[0]?.label || a.trigger || "").toLowerCase();
    if (t.match(/job complete|after job|post.?job/)) return "job_complete";
    if (t.match(/job start|crew start/)) return "job_started";
    if (t.match(/job schedul|24h before/)) return "job_scheduled";
    if (t.match(/estimate sent|quote sent/)) return "estimate_sent";
    if (t.match(/new (customer|inquiry|lead)/)) return "customer_added";
    if (t.match(/invoice|unpaid|overdue/)) return "invoice_unpaid";
    if (t.match(/review|rating/)) return "review_submitted";
    return "manual";
  };

  const testRun = async (a: any) => {
    const mockCustomer = customers[0] || { firstName: "Jennifer", lastName: "Walsh", email: "j@test.com", phone: "+17175550201" };
    const mockJob = jobs.find((j: any) => j.status === "completed") || jobs[0] || { id: "mock", amount: 742, scheduledDate: today(), status: "completed" };
    const result = await runWorkflow(a, { type: inferCtxType(a), job: mockJob, customer: mockCustomer, estimate: estimates[0] || null, daysSinceInvoiced: 8, daysSinceLast: 200, rating: 5 }, toast, settings);
    if (!result.triggered) { if (toast) toast(`Trigger didn't match — click Edit to adjust`, "error"); return; }
    setAutomations((prev: any[]) => prev.map(x => x.id === a.id ? { ...x, count: (x.count || 0) + 1, lastTriggered: today(), runLog: [...(x.runLog || []), ...result.log].slice(0, 50) } : x));
    if (toast) toast(`✅ Test run — ${result.log.length} step${result.log.length !== 1 ? "s" : ""} fired`);
  };

  const openBuilder = (data = null) => setBuilderOpen({ open: true, data: data || { name: "", category: "other", icon: "⚡", steps: [{ id: uid(), type: "trigger", label: "Choose a trigger…" }] } });

  const catOf = (a: any) => {
    const t = (a.trigger || a.steps?.[0]?.label || "").toLowerCase();
    if (t.match(/estimate|quote/)) return "estimates";
    if (t.match(/job|crew|schedule/)) return "jobs";
    if (t.match(/invoice|payment|paid|overdue|unpaid/)) return "payments";
    if (t.match(/review|complete/)) return "reviews";
    if (t.match(/annual|birthday|anniversary|month|seasonal/)) return "lifecycle";
    if (t.match(/referral/)) return "referrals";
    return "other";
  };

  const filtered = automations
    .filter((a: any) => !search || (a.name + (a.trigger || "") + (a.action || "")).toLowerCase().includes(search.toLowerCase()))
    .filter((a: any) => category === "all" || catOf(a) === category);

  const activeCount = automations.filter((a: any) => a.active).length;
  const totalRuns = automations.reduce((s: number, a: any) => s + (a.count || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Workflow size={20} className="text-purple-400" />
            Automation Hub
          </h2>
          <div className="text-xs text-white/50 mt-0.5">{activeCount} active · {totalRuns} total runs · fire automatically</div>
        </div>
        <div className="flex items-center gap-2">
          <GBtn variant="ghost" onClick={() => setTemplatesOpen(true)} className="!text-xs">
            <Layers size={12} className="inline mr-1.5" />Templates
          </GBtn>
          <GBtn onClick={() => openBuilder()} className="!text-sm">
            <Plus size={14} className="inline mr-1.5" />New Workflow
          </GBtn>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Workflow size={48} className="mx-auto mb-4 text-white/20 anim-float" />
          <div className="text-white/50 font-semibold mb-1">No workflows yet</div>
          <div className="flex gap-2 justify-center">
            <GBtn onClick={() => setTemplatesOpen(true)} variant="ghost">Templates</GBtn>
            <GBtn onClick={() => openBuilder()}>New Workflow</GBtn>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map((a: any) => (
            <Glass key={a.id} className="p-4 relative group transition-all hover:border-purple-500/50" onMouseEnter={() => setHoveredId(a.id)} onMouseLeave={() => setHoveredId(null)}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="text-2xl">{a.icon || "⚡"}</div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm leading-tight truncate">{a.name}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{a.steps?.length || 0} steps</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(a.id)}>
                    {a.active ? <ToggleRight size={28} className="text-green-400" /> : <ToggleLeft size={28} className="text-white/25" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="text-[10px] text-white/35">Last ran: {a.lastTriggered || "Never"}</div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => testRun(a)} className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/40 hover:text-green-400"><Play size={11} /></button>
                  <button onClick={() => openBuilder(a)} className="p-1.5 rounded-lg hover:bg-purple-900/30 text-white/40 hover:text-purple-400"><Edit size={11} /></button>
                  <button onClick={() => del(a.id)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-white/40 hover:text-red-400"><Trash2 size={11} /></button>
                </div>
              </div>
            </Glass>
          ))}
        </div>
      )}

      <Modal open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Workflow Templates" maxW="max-w-4xl">
        <div className="grid md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {AUTOMATION_TEMPLATES.map((tpl: any) => (
            <button key={tpl.id} onClick={() => {
              const cloned = { ...tpl, id: uid(), active: false, steps: tpl.steps.map((s: any) => ({ ...s, id: uid() })) };
              openBuilder(cloned);
              setTemplatesOpen(false);
            }} className="text-left p-4 rounded-xl bg-black/40 border border-white/10 hover:border-purple-500/50 transition group">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{tpl.icon}</div>
                <div>
                  <div className="font-semibold text-sm group-hover:text-purple-300 transition">{tpl.name}</div>
                  <div className="text-[10px] text-white/50 mt-0.5">{tpl.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      <VisualWorkflowBuilder open={builderOpen.open} data={builderOpen.data} onClose={() => setBuilderOpen({ open: false, data: null })} onSave={(w: any) => {
        if (w.id) setAutomations((prev: any[]) => prev.map(a => a.id === w.id ? w : a));
        else setAutomations((prev: any[]) => [...prev, { ...w, id: uid(), active: true }]);
        setBuilderOpen({ open: false, data: null });
        if (toast) toast("Workflow saved");
      }} />
    </div>
  );
}

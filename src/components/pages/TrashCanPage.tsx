// TrashCanPage.tsx — owner CRM section for Trash Can Cleaning (round 13,
// items 16-24). Trash-can jobs are ordinary Job rows (serviceCategory:
// "trash_can") so they already appear on the Jobs list/Calendar and get
// checklists/photos/clock-in/Running Late/Complete for free via the existing
// Job infrastructure — this page adds the trash-can-specific pieces: owner
// pricing/timing settings, the filtered job list, a same-day route builder
// (see lib/utils.ts's buildOptimizedRoute), and the public signup link.
import React, { useState, useEffect } from "react";
import { Trash2, Copy, DollarSign, Clock, Route as RouteIcon, Users, Calendar, GripVertical, Send, Plus, X, Check, Edit2, ChevronUp, ChevronDown, CreditCard, AlertTriangle, FileText } from "lucide-react";
import { fmt, uid, today, daysFromNow, buildOptimizedRoute } from "../../lib/utils";
import type { Job, Customer, AppSettings } from "../../types";
import { supabase } from "../../lib/supabase";
import { twilioSend, logOutboundSmsToInbox } from "../../lib/messaging";
import { chargeSavedPaymentMethod } from "../../lib/stripe";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GSel } from "../ui/GSel";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { useIsMobile } from "../../hooks/useIsMobile";

export function TrashCanPage({ jobs = [], customers = [], settings = {} as AppSettings, setSettings, setJobs, toast, ownerId }: { jobs?: Job[]; customers?: Customer[]; settings?: AppSettings; setSettings?: any; setJobs?: any; toast?: any; ownerId?: string }) {
  const trashJobs = jobs.filter((j: any) => j.serviceCategory === "trash_can");
  const upcoming = trashJobs.filter(j => j.status !== "cancelled" && j.status !== "completed").sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
  const [routeDate, setRouteDate] = useState(today());
  const [route, setRoute] = useState<any[] | null>(null);

  const costPerCan = Number((settings as any)?.trashCanCostPerCan) || 5;
  const minutesPerCan = Number((settings as any)?.trashCanMinutesPerCan) || 5;
  // ITEM 10 — `oid` (owner id) lets TrashCanSignupPage.tsx do a live, narrow
  // refetch of just the pricing/schedule fields on load (see that file's
  // comment), so this link keeps working correctly even after the owner
  // changes pricing later — the co/ph/cost/min/freq/pk params below still
  // ride along as an offline fallback for links copied before this fix.
  const signupParams = new URLSearchParams({
    oid: ownerId || "",
    co: (settings as any)?.companyName || "Crew Boss",
    ph: (settings as any)?.companyPhone || "",
    cost: String(costPerCan),
    min: String(minutesPerCan),
    freq: (settings as any)?.trashCanDefaultFrequency || "weekly",
    pk: (settings as any)?.stripePublishableKey || "",
  });
  const signupLink = `${window.location.origin}${window.location.pathname}#/trash-cans?${signupParams.toString()}`;

  const cf = (id?: string) => customers.find((c: any) => c.id === id);

  // ITEMS 11-12 — Planning stage: new/unconfirmed trash-can leads (or any
  // trash-can job the owner hasn't locked in a day for yet) get dragged onto
  // one of the next 14 days, staged locally, then confirmed in a batch —
  // which is also the point an SMS offer goes out to everyone whose day was
  // just set. `dayAssignmentConfirmed` (migration 0032) is what keeps a
  // once-confirmed job out of this planning list on future visits.
  const unassigned = trashJobs.filter((j: any) => !j.dayAssignmentConfirmed && j.status !== "cancelled" && j.status !== "completed");
  const planningDays = Array.from({ length: 14 }, (_, i) => daysFromNow(i));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [staged, setStaged] = useState<Record<string, string>>({}); // jobId -> date
  // BUG FIX (mobile trash-can planning) — same pattern as the mobile
  // pipeline fix in PipelinePage.tsx: native HTML5 drag-and-drop never fires
  // on touch (iOS Safari/Android Chrome), so below the 768px breakpoint the
  // draggable cards + drop-target columns are replaced with an explicit
  // "Move to…" GSel dropdown per card. Desktop drag-and-drop is untouched.
  const isMobile = useIsMobile();
  const [confirming, setConfirming] = useState(false);
  const dayOf = (j: Job) => staged[j.id] || j.scheduledDate || "";

  const stagedCount = Object.keys(staged).length;
  const confirmDayAssignments = async () => {
    if (stagedCount === 0) return;
    setConfirming(true);
    const touched = Object.entries(staged);
    const patchedJobs: Job[] = [];
    for (const [jobId, date] of touched) {
      const patch = { scheduledDate: date, dayAssignmentConfirmed: true };
      setJobs?.((prev: any[]) => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
      const j = trashJobs.find(x => x.id === jobId);
      if (j) patchedJobs.push({ ...j, ...patch } as Job);
      await (supabase as any).from("jobs").update(patch).eq("id", jobId)
        .then((r: any) => { if (r?.error) console.error("[TrashCan] day-assignment save failed:", r.error.message); });
    }
    setStaged({});
    setConfirming(false);
    toast?.(`${touched.length} customer${touched.length !== 1 ? "s" : ""} assigned to their service day ✓`, "green");

    if (window.confirm(`Text all ${touched.length} customer${touched.length !== 1 ? "s" : ""} to let them know their scheduled day?`)) {
      let sent = 0, failed = 0;
      for (const j of patchedJobs) {
        const c = cf(j.customerId);
        if (!c?.phone) { failed++; continue; }
        const msg = `Hi ${c.firstName}! Your trash can cleaning with ${(settings as any)?.companyName || "us"} is scheduled for ${j.scheduledDate}. Reply STOP to opt out.`;
        try {
          await twilioSend(settings as any, c.phone, msg);
          logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
          sent++;
        } catch { failed++; }
      }
      toast?.(`Notified ${sent}${failed ? " · " + failed + " failed" : ""}`, failed ? "yellow" : "green");
    }
  };

  const buildRoute = () => {
    const dayJobs = trashJobs.filter(j => j.scheduledDate === routeDate && j.status !== "cancelled" && j.status !== "completed");
    if (dayJobs.length === 0) { toast?.("No trash-can jobs scheduled that day", "yellow"); return; }
    const entries = buildOptimizedRoute(
      dayJobs.map(j => ({ id: j.id, lat: (j as any).lat, lng: (j as any).lng, scheduledTime: j.scheduledTime, estMinutes: ((j as any).cansCount || 1) * minutesPerCan })),
      { lunchMinutes: Number((settings as any)?.routeLunchMinutes) || 0, lunchEarliestMinutes: 240 }
    );
    setRoute(entries);
    toast?.(`Route built — ${dayJobs.length} stop${dayJobs.length !== 1 ? "s" : ""}`, "green");
  };

  // ── Saved, named Routes (persisted — distinct from the ad-hoc same-day
  // builder above) — supabase.trash_can_routes, migration 0035. ──────────
  const [routes, setRoutes] = useState<any[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [newRouteName, setNewRouteName] = useState("");
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [renamingRouteId, setRenamingRouteId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [managingRouteId, setManagingRouteId] = useState<string | null>(null);
  const [routeDraggedId, setRouteDraggedId] = useState<string | null>(null);
  const [optimizingRouteId, setOptimizingRouteId] = useState<string | null>(null);
  const [lastOptimizeResult, setLastOptimizeResult] = useState<{ routeId: string; entries: any[] } | null>(null);

  useEffect(() => {
    if (!ownerId) { setRoutesLoading(false); return; }
    (supabase as any).from("trash_can_routes").select("*").eq("owner_id", ownerId)
      .then((r: any) => {
        if (r?.error) console.error("[TrashCanRoutes] fetch failed:", r.error.message);
        else setRoutes(r?.data || []);
        setRoutesLoading(false);
      });
  }, [ownerId]);

  // Every trash-can customer, regardless of which day/status their job is
  // in — this is who's eligible to be added to a saved route.
  const trashCanCustomerIds = new Set(trashJobs.map(j => j.customerId));
  const trashCanCustomers = customers.filter((c: any) => trashCanCustomerIds.has(c.id));

  const createRoute = async () => {
    if (!newRouteName.trim()) { toast?.("Name the route first", "yellow"); return; }
    setCreatingRoute(true);
    const row = { id: uid(), owner_id: ownerId, name: newRouteName.trim(), customer_ids: [] as string[], lunch_minutes: Number((settings as any)?.routeLunchMinutes) || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { error } = await (supabase as any).from("trash_can_routes").insert(row);
    setCreatingRoute(false);
    if (error) { toast?.(`Couldn't create route — ${error.message}`, "red"); return; }
    setRoutes(prev => [row, ...prev]);
    setNewRouteName("");
    toast?.("Route created ✓", "green");
  };

  const startRenameRoute = (r: any) => { setRenamingRouteId(r.id); setRenameValue(r.name); };
  const saveRenameRoute = async (routeId: string) => {
    const name = renameValue.trim();
    if (!name) { toast?.("Route name can't be empty", "yellow"); return; }
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, name } : r));
    setRenamingRouteId(null);
    const { error } = await (supabase as any).from("trash_can_routes").update({ name, updated_at: new Date().toISOString() }).eq("id", routeId);
    if (error) toast?.(`Rename didn't save — ${error.message}`, "red");
    else toast?.("Route renamed ✓", "green");
  };

  const deleteRoute = async (r: any) => {
    if (!window.confirm(`Delete route "${r.name}"? This can't be undone.`)) return;
    const prevRoutes = routes;
    setRoutes(prev => prev.filter(x => x.id !== r.id));
    const { error } = await (supabase as any).from("trash_can_routes").delete().eq("id", r.id);
    if (error) {
      setRoutes(prevRoutes);
      toast?.(`Delete failed — ${error.message}`, "red");
      return;
    }
    if (managingRouteId === r.id) setManagingRouteId(null);
    if (expandedRouteId === r.id) setExpandedRouteId(null);
    toast?.("Route deleted ✓", "green");
  };

  const persistRouteCustomerIds = async (routeId: string, customerIds: string[]): Promise<boolean> => {
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, customer_ids: customerIds, updated_at: new Date().toISOString() } : r));
    const { error } = await (supabase as any).from("trash_can_routes").update({ customer_ids: customerIds, updated_at: new Date().toISOString() }).eq("id", routeId);
    if (error) { toast?.(`Couldn't save route change — ${error.message}`, "red"); return false; }
    return true;
  };

  const toggleRouteCustomer = (route: any, customerId: string) => {
    const ids: string[] = route.customer_ids || [];
    const next = ids.includes(customerId) ? ids.filter((id: string) => id !== customerId) : [...ids, customerId];
    persistRouteCustomerIds(route.id, next);
  };

  // Mobile alternative to drag-and-drop reordering, same "Move up/down"
  // pattern as the day-planning board's "Move to…" GSel below.
  const moveRouteClient = (route: any, customerId: string, dir: -1 | 1) => {
    const ids: string[] = [...(route.customer_ids || [])];
    const idx = ids.indexOf(customerId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= ids.length) return;
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    persistRouteCustomerIds(route.id, ids);
  };

  const reorderRouteClient = (route: any, draggedCustomerId: string, targetCustomerId: string) => {
    if (draggedCustomerId === targetCustomerId) return;
    const ids: string[] = [...(route.customer_ids || [])];
    const from = ids.indexOf(draggedCustomerId);
    const to = ids.indexOf(targetCustomerId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedCustomerId);
    persistRouteCustomerIds(route.id, ids);
  };

  // Resolves each assigned customer's trash-can job for lat/lng, runs the
  // SAME nearest-neighbor optimizer the ad-hoc same-day builder uses above,
  // then persists the resulting order back onto the route (not just a
  // preview) — customerId doubles as the entry's `id`/`jobId` here since
  // buildOptimizedRoute is generic over whatever id you hand it.
  const optimizeRoute = async (route: any) => {
    const ids: string[] = route.customer_ids || [];
    const stops = ids
      .map(cid => {
        const j = trashJobs.find(x => x.customerId === cid);
        if (!j) return null;
        return { id: cid, lat: (j as any).lat, lng: (j as any).lng, scheduledTime: j.scheduledTime, estMinutes: ((j as any).cansCount || 1) * minutesPerCan };
      })
      .filter(Boolean) as { id: string; lat?: number; lng?: number; scheduledTime?: string; estMinutes: number }[];
    if (stops.length === 0) { toast?.("No assigned customers with a trash-can job to optimize", "yellow"); return; }
    setOptimizingRouteId(route.id);
    const entries = buildOptimizedRoute(stops, { lunchMinutes: Number(route.lunch_minutes) || 0, lunchEarliestMinutes: 240 });
    const newOrder = entries.filter((e: any) => e.kind === "job").map((e: any) => e.jobId as string);
    const ok = await persistRouteCustomerIds(route.id, newOrder);
    setOptimizingRouteId(null);
    setLastOptimizeResult({ routeId: route.id, entries });
    if (ok) toast?.(`Route optimized — ${newOrder.length} stop${newOrder.length !== 1 ? "s" : ""}`, "green");
  };

  // ── Trash-can inconvenience fees needing collection (round 15) ──────────
  // EmployeePortal.tsx's cans-not-out action auto-charges a saved card when
  // one exists; when it can't (no card, or the charge failed), the job is
  // flagged inconvenienceFeePendingConfirmation and surfaced here instead of
  // the fee silently getting lost.
  const pendingFeeJobs = trashJobs.filter((j: any) => j.inconvenienceFeePendingConfirmation);
  const [chargingPendingId, setChargingPendingId] = useState<string | null>(null);
  const [addingToInvoiceId, setAddingToInvoiceId] = useState<string | null>(null);

  const chargePendingFee = async (job: any) => {
    const cust = cf(job.customerId);
    if (!cust?.stripeCustomerId || !cust?.savedPaymentMethodId) { toast?.("No card on file for this customer yet", "yellow"); return; }
    const feeName = (settings as any)?.trashCanInconvenienceFeeName || "Cans Not Out Fee";
    const feeAmount = Number((settings as any)?.trashCanInconvenienceFeeAmount) || 15;
    setChargingPendingId(job.id);
    try {
      await chargeSavedPaymentMethod(cust.stripeCustomerId, cust.savedPaymentMethodId, Math.round(feeAmount * 100), "usd", feeName, undefined, job.owner_id || ownerId);
      const patch = { inconvenienceFeeCharged: feeAmount, inconvenienceFeeChargedAt: new Date().toISOString(), inconvenienceFeePendingConfirmation: false };
      setJobs?.((prev: any[]) => prev.map(j => j.id === job.id ? { ...j, ...patch } : j));
      const { error } = await (supabase as any).from("jobs").update(patch).eq("id", job.id);
      if (error) throw new Error(error.message);
      toast?.(`Charged ${fmt(feeAmount)} ✓`, "green");
    } catch (e: any) {
      toast?.(`Charge failed — ${e?.message || "unknown error"}`, "red");
    } finally {
      setChargingPendingId(null);
    }
  };

  // Adds the fee as a line item onto the customer's open (invoiced, unpaid)
  // invoice if one exists — same lineItems shape InvoicesPage.tsx already
  // uses (id/description/quantity/unitPrice) — or creates a standalone
  // invoice for just the fee, same shape createStandaloneInvoice there
  // builds, if there's no open invoice to attach to.
  const addFeeToInvoice = async (job: any) => {
    const cust = cf(job.customerId);
    if (!cust) { toast?.("Customer not found", "red"); return; }
    const feeName = (settings as any)?.trashCanInconvenienceFeeName || "Cans Not Out Fee";
    const feeAmount = Number((settings as any)?.trashCanInconvenienceFeeAmount) || 15;
    setAddingToInvoiceId(job.id);
    try {
      const { data: custInvoices, error: findErr } = await (supabase as any).from("estimates").select("*").eq("customerId", cust.id).eq("invoiced", true);
      if (findErr) throw new Error(findErr.message);
      const openInv = (custInvoices || []).find((e: any) => !e.paidAt);
      const lineItem = { id: uid(), description: feeName, quantity: 1, unitPrice: feeAmount };
      if (openInv) {
        const newLineItems = [...(openInv.lineItems || []), lineItem];
        const newTotal = (Number(openInv.total) || 0) + feeAmount;
        const newSubtotal = (Number(openInv.subtotal) || 0) + feeAmount;
        const { error } = await (supabase as any).from("estimates").update({ lineItems: newLineItems, total: newTotal, subtotal: newSubtotal }).eq("id", openInv.id);
        if (error) throw new Error(error.message);
        toast?.(`Added ${fmt(feeAmount)} to invoice ✓`, "green");
      } else {
        const newInv = {
          id: uid(), customerId: cust.id, title: feeName,
          lineItems: [lineItem], subtotal: feeAmount, discount: 0, depositRequired: 0, tax: 0, total: feeAmount,
          status: "approved" as const, createdAt: today(), validUntil: daysFromNow(30),
          invoiced: true, invoicedAt: today(), standalone: true,
        };
        const { error } = await (supabase as any).from("estimates").insert(newInv);
        if (error) throw new Error(error.message);
        toast?.(`Created a new invoice for ${fmt(feeAmount)} ✓`, "green");
      }
      const patch = { inconvenienceFeePendingConfirmation: false };
      setJobs?.((prev: any[]) => prev.map(j => j.id === job.id ? { ...j, ...patch } : j));
      const { error: jobErr } = await (supabase as any).from("jobs").update(patch).eq("id", job.id);
      if (jobErr) console.warn("[TrashCan] couldn't clear pending-fee flag:", jobErr.message);
    } catch (e: any) {
      toast?.(`Couldn't add fee to invoice — ${e?.message || "unknown error"}`, "red");
    } finally {
      setAddingToInvoiceId(null);
    }
  };

  // ── Editing an already-confirmed schedule (round 15) — pencil action on
  // the read-only "Upcoming Trash Can Jobs" list below. ────────────────────
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState<{ scheduledDate: string; recurringFreq: string; cansCount: number }>({ scheduledDate: "", recurringFreq: "weekly", cansCount: 1 });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditJob = (j: Job) => {
    setEditingJob(j);
    setEditForm({ scheduledDate: j.scheduledDate || "", recurringFreq: j.recurringFreq || "weekly", cansCount: (j as any).cansCount || 1 });
  };

  const saveEditJob = async () => {
    if (!editingJob) return;
    setSavingEdit(true);
    const patch: any = { scheduledDate: editForm.scheduledDate, recurringFreq: editForm.recurringFreq, cansCount: Number(editForm.cansCount) || 1 };
    setJobs?.((prev: any[]) => prev.map(j => j.id === editingJob.id ? { ...j, ...patch } : j));
    const { error } = await (supabase as any).from("jobs").update(patch).eq("id", editingJob.id);
    setSavingEdit(false);
    if (error) { toast?.(`Couldn't save changes — ${error.message}`, "red"); return; }
    toast?.("Job updated ✓", "green");
    setEditingJob(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Trash2} label="Active Routes" value={String(upcoming.length)} />
        <Stat icon={DollarSign} label="Cost / Can" value={fmt(costPerCan)} />
        <Stat icon={Clock} label="Est. Min / Can" value={String(minutesPerCan)} />
        <Stat icon={Users} label="Customers" value={String(new Set(trashJobs.map(j => j.customerId)).size)} />
      </div>

      <Glass className="p-4 space-y-3">
        <div className="font-semibold text-sm flex items-center gap-2"><Trash2 size={14} className="text-red-400" />Pricing & Scheduling</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block">Cost per can</label><GInput type="number" step="0.5" value={(settings as any)?.trashCanCostPerCan ?? 5} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanCostPerCan: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Estimated minutes per can</label><GInput type="number" value={(settings as any)?.trashCanMinutesPerCan ?? 5} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanMinutesPerCan: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Default frequency</label>
            <GSel value={(settings as any)?.trashCanDefaultFrequency || "weekly"} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanDefaultFrequency: e.target.value }))} className="!text-xs">
              <option value="weekly" className="bg-black">Weekly</option>
              <option value="monthly" className="bg-black">Monthly</option>
              <option value="quarterly" className="bg-black">Quarterly</option>
            </GSel>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Inconvenience fee name</label><GInput value={(settings as any)?.trashCanInconvenienceFeeName || "Cans Not Out Fee"} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanInconvenienceFeeName: e.target.value }))} className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Inconvenience fee amount</label><GInput type="number" step="0.5" value={(settings as any)?.trashCanInconvenienceFeeAmount ?? 15} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanInconvenienceFeeAmount: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Route lunch break (minutes) <span className="text-white/30">(0 = none)</span></label><GInput type="number" value={(settings as any)?.routeLunchMinutes ?? 30} onChange={(e: any) => setSettings((s: any) => ({ ...s, routeLunchMinutes: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
        </div>
        <div className="pt-2 border-t border-white/10">
          <label className="text-xs text-white/60 mb-1 block">Public signup link — customers enter can count, see price, choose schedule, put a card on file</label>
          <div className="flex gap-2">
            <GInput readOnly value={signupLink} className="!text-xs flex-1" />
            <GBtn variant="ghost" onClick={() => { navigator.clipboard?.writeText(signupLink); toast?.("Link copied ✓"); }} className="!text-xs"><Copy size={12} className="inline mr-1" />Copy</GBtn>
          </div>
        </div>
      </Glass>

      <Glass className="p-4 space-y-3">
        <div className="font-semibold text-sm flex items-center gap-2"><RouteIcon size={14} className="text-blue-400" />Build a Route</div>
        <div className="flex gap-2 items-end flex-wrap">
          <div><label className="text-xs text-white/60 mb-1 block">Date</label><GInput type="date" value={routeDate} onChange={(e: any) => { setRoute(null); setRouteDate(e.target.value); }} className="!text-xs" /></div>
          <GBtn onClick={buildRoute} className="!text-xs">Build Optimized Route</GBtn>
        </div>
        <div className="text-[10px] text-white/40">Nearest-neighbor ordering by property location (jobs without a geocoded address are appended in scheduled-time order). Includes a lunch break if configured above.</div>
        {route && (
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            {route.map((entry: any, i: number) => entry.kind === "lunch" ? (
              <div key={"lunch" + i} className="p-2 rounded-lg bg-yellow-950/20 border border-yellow-700/30 text-xs text-yellow-300 flex items-center gap-2"><Clock size={11} />Lunch break — {entry.durationMinutes} min</div>
            ) : (() => {
              const j = trashJobs.find(x => x.id === entry.jobId);
              const c = j ? cf(j.customerId) : null;
              return <div key={entry.jobId} className="p-2 rounded-lg bg-black/40 border border-white/10 text-xs flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><span className="text-white/40 w-5">{i + 1}.</span>{c ? `${c.firstName} ${c.lastName}` : "Customer"} — {j?.address}</span>
                <span className="text-white/40">{(j as any)?.cansCount || 1} cans · ~{entry.estMinutes}m</span>
              </div>;
            })())}
          </div>
        )}
      </Glass>

      <Glass className="p-4 space-y-3">
        <div className="font-semibold text-sm flex items-center gap-2"><RouteIcon size={14} className="text-purple-400" />Saved Routes</div>
        <div className="text-[10px] text-white/40">Named, reusable routes (e.g. "Tuesday West Side") — unlike the same-day builder above, these persist and can be edited any time.</div>
        <div className="flex gap-2 flex-col sm:flex-row">
          <GInput placeholder="Route name" value={newRouteName} onChange={(e: any) => setNewRouteName(e.target.value)} className="!text-xs flex-1" />
          <GBtn onClick={createRoute} disabled={creatingRoute} className="!text-xs whitespace-nowrap"><Plus size={12} className="inline mr-1" />{creatingRoute ? "Creating…" : "Create Route"}</GBtn>
        </div>
        {routesLoading ? (
          <div className="text-center py-4 text-white/40 text-xs">Loading routes…</div>
        ) : routes.length === 0 ? (
          <div className="text-center py-6 text-white/40 text-xs">No saved routes yet — create one above, then assign customers to it.</div>
        ) : (
          <div className="space-y-2">
            {routes.map(routeRow => {
              const ids: string[] = routeRow.customer_ids || [];
              const isExpanded = expandedRouteId === routeRow.id;
              const isManaging = managingRouteId === routeRow.id;
              return (
                <div key={routeRow.id} className="rounded-xl bg-black/30 border border-white/10 overflow-hidden">
                  <div className="p-2.5 flex items-center gap-2 flex-wrap">
                    {renamingRouteId === routeRow.id ? (
                      <div className="flex-1 flex gap-1.5 min-w-[160px]">
                        <GInput value={renameValue} onChange={(e: any) => setRenameValue(e.target.value)} className="!text-xs flex-1 !py-1.5" autoFocus />
                        <GBtn onClick={() => saveRenameRoute(routeRow.id)} className="!text-xs !py-1.5 !px-2"><Check size={12} /></GBtn>
                        <GBtn variant="ghost" onClick={() => setRenamingRouteId(null)} className="!text-xs !py-1.5 !px-2"><X size={12} /></GBtn>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-[160px]">
                        <div className="text-sm font-medium">{routeRow.name}</div>
                        <div className="text-[10px] text-white/40">{ids.length} customer{ids.length !== 1 ? "s" : ""} · updated {new Date(routeRow.updated_at || routeRow.created_at).toLocaleDateString()}</div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <GBtn variant="ghost" onClick={() => setExpandedRouteId(isExpanded ? null : routeRow.id)} className="!text-[10px] !py-1 !px-2">{isExpanded ? "Hide" : "View"} Clients</GBtn>
                      <GBtn variant="ghost" onClick={() => { setManagingRouteId(isManaging ? null : routeRow.id); setExpandedRouteId(routeRow.id); }} className="!text-[10px] !py-1 !px-2"><Users size={11} className="inline mr-1" />Manage Clients</GBtn>
                      <GBtn variant="ghost" disabled={optimizingRouteId === routeRow.id || ids.length === 0} onClick={() => optimizeRoute(routeRow)} className="!text-[10px] !py-1 !px-2">{optimizingRouteId === routeRow.id ? "Optimizing…" : "Optimize Route"}</GBtn>
                      {renamingRouteId !== routeRow.id && <GBtn variant="ghost" onClick={() => startRenameRoute(routeRow)} className="!text-[10px] !py-1 !px-2" title="Rename"><Edit2 size={11} /></GBtn>}
                      <GBtn variant="danger" onClick={() => deleteRoute(routeRow)} className="!text-[10px] !py-1 !px-2" title="Delete route"><Trash2 size={11} /></GBtn>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-white/10 p-2.5 space-y-3">
                      {isManaging && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Add/Remove Clients</div>
                          <div className="max-h-52 overflow-y-auto space-y-1">
                            {trashCanCustomers.length === 0 ? (
                              <div className="text-[11px] text-white/30 py-2">No trash-can customers yet.</div>
                            ) : trashCanCustomers.map((c: any) => {
                              const on = ids.includes(c.id);
                              return (
                                <label key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 text-[11px] cursor-pointer">
                                  <input type="checkbox" checked={on} onChange={() => toggleRouteCustomer(routeRow, c.id)} />
                                  <span className="flex-1 truncate">{c.firstName} {c.lastName}</span>
                                  <span className="text-white/30 truncate">{c.address}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Client Order{!isMobile && ids.length > 1 ? " (drag to reorder)" : ""}</div>
                        {ids.length === 0 ? (
                          <div className="text-[11px] text-white/30 py-2">No clients assigned — use Manage Clients above.</div>
                        ) : (
                          <div className="space-y-1.5">
                            {ids.map((cid, i) => {
                              const c = cf(cid);
                              const j = trashJobs.find(x => x.customerId === cid);
                              return (
                                <div key={cid}
                                  {...(isMobile ? {} : {
                                    draggable: true,
                                    onDragStart: () => setRouteDraggedId(cid),
                                    onDragOver: (e: any) => e.preventDefault(),
                                    onDrop: () => { if (routeDraggedId) reorderRouteClient(routeRow, routeDraggedId, cid); setRouteDraggedId(null); },
                                    onDragEnd: () => setRouteDraggedId(null),
                                  })}
                                  className={"p-2 rounded-lg bg-black/50 border border-white/10 text-[11px] flex items-center gap-2" + (isMobile ? "" : " cursor-grab active:cursor-grabbing")}>
                                  {!isMobile && <GripVertical size={10} className="text-white/30 flex-shrink-0" />}
                                  <span className="text-white/40 w-4 flex-shrink-0">{i + 1}.</span>
                                  <span className="flex-1 min-w-0 truncate">{c ? `${c.firstName} ${c.lastName}` : "Customer"} — {j?.address || c?.address || ""}</span>
                                  {isMobile && (
                                    <div className="flex gap-1 flex-shrink-0">
                                      <button disabled={i === 0} onClick={() => moveRouteClient(routeRow, cid, -1)} className="p-1 rounded bg-white/5 disabled:opacity-30"><ChevronUp size={11} /></button>
                                      <button disabled={i === ids.length - 1} onClick={() => moveRouteClient(routeRow, cid, 1)} className="p-1 rounded bg-white/5 disabled:opacity-30"><ChevronDown size={11} /></button>
                                    </div>
                                  )}
                                  <button onClick={() => toggleRouteCustomer(routeRow, cid)} className="p-1 rounded bg-white/5 text-white/40 hover:text-red-300 flex-shrink-0" title="Remove from route"><X size={11} /></button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {lastOptimizeResult?.routeId === routeRow.id && (
                        <div className="pt-2 border-t border-white/10 text-[10px] text-white/40">
                          Optimized order saved above{lastOptimizeResult.entries.some((e: any) => e.kind === "lunch") ? " (includes a lunch break)." : "."}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Glass>

      <Glass className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold text-sm flex items-center gap-2"><Calendar size={14} className="text-yellow-400" />Planning — Assign Customers to Days</div>
          {stagedCount > 0 && <GBtn onClick={confirmDayAssignments} disabled={confirming} className="!text-xs !py-1.5"><Send size={11} className="inline mr-1" />{confirming ? "Saving…" : `Confirm ${stagedCount} Assignment${stagedCount !== 1 ? "s" : ""}`}</GBtn>}
        </div>
        <div className="text-[10px] text-white/40">{isMobile ? "Use \"Move to…\" on a customer card to assign their trash-can service day." : "Drag a customer card onto a day to assign their trash-can service day."} Nothing is saved until you hit Confirm — which then offers to text everyone their scheduled day.</div>
        {unassigned.length === 0 ? (
          <div className="text-center py-6 text-white/40 text-xs">No unassigned trash-can customers — new signups will appear here.</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            <div className="flex-shrink-0 w-48">
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Unassigned ({unassigned.filter(j => !staged[j.id]).length})</div>
              <div className="space-y-1.5 min-h-[60px] p-1.5 rounded-xl bg-black/30 border border-dashed border-white/10"
                {...(isMobile ? {} : { onDragOver: (e: any) => e.preventDefault(), onDrop: () => { if (draggedId) setStaged(prev => { const n = { ...prev }; delete n[draggedId]; return n; }); setDraggedId(null); } })}>
                {unassigned.filter(j => !staged[j.id]).map(j => {
                  const c = cf(j.customerId);
                  return (
                    <div key={j.id} {...(isMobile ? {} : { draggable: true, onDragStart: () => setDraggedId(j.id), onDragEnd: () => setDraggedId(null) })}
                      className={"p-2 rounded-lg bg-black/60 border border-white/10 text-[11px] flex items-center gap-1.5" + (isMobile ? "" : " cursor-grab active:cursor-grabbing")}>
                      <GripVertical size={10} className="text-white/30 flex-shrink-0" />
                      <span className={"truncate" + (isMobile ? " flex-1" : "")}>{c ? `${c.firstName} ${c.lastName}` : "Customer"} · {(j as any).cansCount || 1} cans</span>
                      {isMobile && (
                        <GSel
                          value=""
                          onChange={(e: any) => { const dest = e.target.value; if (dest) setStaged(prev => ({ ...prev, [j.id]: dest })); }}
                          className="!py-1 !text-[10px] !w-auto flex-shrink-0"
                        >
                          <option value="" className="bg-black">Move to…</option>
                          {planningDays.map(d => (
                            <option key={d} value={d} className="bg-black">{d}</option>
                          ))}
                        </GSel>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {planningDays.map(d => {
              const dayJobs = unassigned.filter(j => staged[j.id] === d);
              return (
                <div key={d} className="flex-shrink-0 w-40">
                  <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">{d} ({dayJobs.length})</div>
                  <div className="space-y-1.5 min-h-[60px] p-1.5 rounded-xl bg-black/30 border border-dashed border-white/10"
                    {...(isMobile ? {} : { onDragOver: (e: any) => e.preventDefault(), onDrop: () => { if (draggedId) setStaged(prev => ({ ...prev, [draggedId]: d })); setDraggedId(null); } })}>
                    {dayJobs.map(j => {
                      const c = cf(j.customerId);
                      return (
                        <div key={j.id} {...(isMobile ? {} : { draggable: true, onDragStart: () => setDraggedId(j.id), onDragEnd: () => setDraggedId(null) })}
                          className={"p-2 rounded-lg bg-yellow-950/30 border border-yellow-700/30 text-[11px] flex items-center gap-1.5" + (isMobile ? "" : " cursor-grab active:cursor-grabbing")}>
                          <GripVertical size={10} className="text-yellow-500/50 flex-shrink-0" />
                          <span className={"truncate" + (isMobile ? " flex-1" : "")}>{c ? `${c.firstName} ${c.lastName}` : "Customer"}</span>
                          {isMobile && (
                            <GSel
                              value=""
                              onChange={(e: any) => {
                                const dest = e.target.value;
                                if (!dest) return;
                                if (dest === "__unassign__") setStaged(prev => { const n = { ...prev }; delete n[j.id]; return n; });
                                else setStaged(prev => ({ ...prev, [j.id]: dest }));
                              }}
                              className="!py-1 !text-[10px] !w-auto flex-shrink-0"
                            >
                              <option value="" className="bg-black">Move to…</option>
                              <option value="__unassign__" className="bg-black">Unassigned</option>
                              {planningDays.filter(pd => pd !== d).map(pd => (
                                <option key={pd} value={pd} className="bg-black">{pd}</option>
                              ))}
                            </GSel>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Glass>

      {pendingFeeJobs.length > 0 && (
        <Glass className="p-4 space-y-2 !bg-yellow-950/15 !border-yellow-700/30">
          <div className="font-semibold text-sm flex items-center gap-2 text-yellow-300"><AlertTriangle size={14} />Inconvenience Fees Needing Collection ({pendingFeeJobs.length})</div>
          <div className="text-[10px] text-white/40">The crew couldn't auto-charge these — no card on file, or the charge failed. Collect them here.</div>
          <div className="space-y-1.5">
            {pendingFeeJobs.map((j: any) => {
              const c = cf(j.customerId);
              const canCharge = !!(c?.stripeCustomerId && c?.savedPaymentMethodId);
              return (
                <div key={j.id} className="p-2.5 rounded-lg bg-black/40 border border-yellow-800/20 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-medium truncate">{c ? `${c.firstName} ${c.lastName}` : "Customer"}</div>
                    <div className="text-white/40 truncate">{j.address} · {fmt(Number((settings as any)?.trashCanInconvenienceFeeAmount) || 15)} fee</div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                    <GBtn disabled={!canCharge || chargingPendingId === j.id} onClick={() => chargePendingFee(j)} className="!text-[10px] !py-1.5 !px-2.5" title={!canCharge ? "No card on file" : undefined}>
                      <CreditCard size={11} className="inline mr-1" />{chargingPendingId === j.id ? "Charging…" : "Charge Now"}
                    </GBtn>
                    <GBtn variant="ghost" disabled={addingToInvoiceId === j.id} onClick={() => addFeeToInvoice(j)} className="!text-[10px] !py-1.5 !px-2.5">
                      <FileText size={11} className="inline mr-1" />{addingToInvoiceId === j.id ? "Adding…" : "Add to Next Invoice"}
                    </GBtn>
                  </div>
                </div>
              );
            })}
          </div>
        </Glass>
      )}

      <Glass className="overflow-hidden">
        <div className="px-4 py-3 border-b border-red-900/20 font-semibold text-sm">Upcoming Trash Can Jobs ({upcoming.length})</div>
        {upcoming.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">No trash-can jobs yet — share the signup link above to get customers enrolled.</div>
        ) : (
          <div className="divide-y divide-red-900/10">
            {upcoming.map(j => {
              const c = cf(j.customerId);
              return (
                <div key={j.id} className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-xl bg-black/40 border border-red-900/30 flex items-center justify-center flex-shrink-0">🗑️</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c ? `${c.firstName} ${c.lastName}` : "Customer"}</div>
                    <div className="text-xs text-white/40 truncate">{j.address} · {(j as any).cansCount || 1} can{((j as any).cansCount || 1) !== 1 ? "s" : ""} · {j.isRecurring ? (j.recurringFreq || "recurring") : "one-time"}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-white/50">{j.scheduledDate}</div>
                    <Badge tone={j.status === "scheduled" ? "blue" : j.status === "in_progress" ? "yellow" : "gray"}>{j.status}</Badge>
                  </div>
                  <button onClick={() => openEditJob(j)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex-shrink-0" title="Edit schedule/frequency/cans">
                    <Edit2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Glass>

      {/* Edit an already-confirmed schedule (round 15) — the planning board
          above only ever manages `unassigned` jobs; once dayAssignmentConfirmed
          is set a trash-can job has no way back into an editable UI without
          this. Stacked form (not a cramped inline row) so it's usable on
          mobile, matching this session's other flex-col sm:flex-row fixes. */}
      {editingJob && (
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingJob(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-neutral-950 border border-red-900/40 rounded-2xl p-4 space-y-3">
            <div className="font-semibold text-sm flex items-center gap-2"><Trash2 size={14} className="text-red-400" />Edit Trash Can Job</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Scheduled Date</label>
                <GInput type="date" value={editForm.scheduledDate} onChange={(e: any) => setEditForm(f => ({ ...f, scheduledDate: e.target.value }))} className="!text-xs w-full" />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Recurring Frequency</label>
                <GSel value={editForm.recurringFreq} onChange={(e: any) => setEditForm(f => ({ ...f, recurringFreq: e.target.value }))} className="!text-xs">
                  <option value="weekly" className="bg-black">Weekly</option>
                  <option value="monthly" className="bg-black">Monthly</option>
                  <option value="quarterly" className="bg-black">Quarterly</option>
                </GSel>
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Can Count</label>
                <GInput type="number" min={1} value={editForm.cansCount} onChange={(e: any) => setEditForm(f => ({ ...f, cansCount: Number(e.target.value) || 1 }))} className="!text-xs w-full" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <GBtn onClick={saveEditJob} disabled={savingEdit} className="flex-1 !text-xs !justify-center">{savingEdit ? "Saving…" : "Save Changes"}</GBtn>
              <GBtn variant="ghost" onClick={() => setEditingJob(null)} className="flex-1 !text-xs !justify-center">Cancel</GBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

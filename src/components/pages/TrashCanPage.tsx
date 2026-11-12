// TrashCanPage.tsx — owner CRM section for Trash Can Cleaning (round 13,
// items 16-24). Trash-can jobs are ordinary Job rows (serviceCategory:
// "trash_can") so they already appear on the Jobs list/Calendar and get
// checklists/photos/clock-in/Running Late/Complete for free via the existing
// Job infrastructure — this page adds the trash-can-specific pieces: owner
// pricing/timing settings, the filtered job list, a same-day route builder
// (see lib/utils.ts's buildOptimizedRoute), and the public signup link.
import React, { useState, useEffect } from "react";
import { Trash2, Copy, DollarSign, Clock, Route as RouteIcon, Users, Calendar, GripVertical, Send, Plus, X, Check, Edit2, ChevronUp, ChevronDown, CreditCard, AlertTriangle, FileText, MapPin } from "lucide-react";
import { fmt, uid, today, daysFromNow, buildOptimizedRoute, computeNextRecurringDate, computeDiscountsTotal } from "../../lib/utils";
import { SalesTaxControl, defaultTaxRate } from "../ui/SalesTaxControl";
import { jobTaxSplit, taxOf, tolerantJobWrite } from "../../lib/jobWrite";
import type { Job, Customer, AppSettings } from "../../types";
import { supabase } from "../../lib/supabase";
import { deleteByIds } from "../../lib/dbBulk";
import { twilioSend, logOutboundSmsToInbox } from "../../lib/messaging";
import { chargeSavedPaymentMethod } from "../../lib/stripe";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GSel } from "../ui/GSel";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { Modal } from "../ui/Modal";
import { AddressAutocomplete } from "../ui/AddressAutocomplete";
import { BulkJobImportModal } from "../ui/BulkJobImportModal";
import { recurrenceFor } from "../../lib/bulkImportCore";
import { geocodeAddresses } from "../../lib/geocode";
import { useIsMobile } from "../../hooks/useIsMobile";
import { showSendReport, okResult, failResult, skipResult, type SendResult } from "../../lib/sendReport";

const FREQ_OPTIONS = [
  { key: "one_time", label: "One-time" },
  { key: "weekly", label: "Weekly" },
  { key: "biweekly", label: "Every 2 weeks" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
];
const freqLabel = (j: any) => j?.isRecurring ? (FREQ_OPTIONS.find(f => f.key === j.recurringFreq)?.label || "Recurring") : "One-time";
// Repeats are counted from the visit's own weekday, so a quarterly stop
// stays on its route day (the old 90-day preset drifted a day or two every
// time, and saving an edit turned an imported 13-week repeat back into it).
const freqPatch = (freq: string, date?: string) => freq === "one_time"
  ? { isRecurring: false, recurringFreq: null }
  : recurrenceFor(freq, date ? new Date(date + "T12:00:00").getDay() : null);

export function TrashCanPage({ jobs = [], customers = [], setCustomers, employees = [], settings = {} as AppSettings, setSettings, setJobs, toast, ownerId, markRecentlyDeleted }: { jobs?: Job[]; customers?: Customer[]; setCustomers?: any; employees?: any[]; settings?: AppSettings; setSettings?: any; setJobs?: any; toast?: any; ownerId?: string; markRecentlyDeleted?: (table: "jobs" | "customers" | "estimates" | "chemicals", ids: string[]) => void }) {
  const trashJobs = jobs.filter((j: any) => j.serviceCategory === "trash_can");
  const upcoming = trashJobs.filter(j => j.status !== "cancelled" && j.status !== "completed").sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
  const [routeDate, setRouteDate] = useState(today());
  const [route, setRoute] = useState<any[] | null>(null);

  // FEATURE — "add a button inside the trash can job section to add a new
  // customer... include their current location, and a button that says
  // 'Add to route' which automatically finds the best spot, or allows
  // manual addition." Auto-place reuses the SAME server-side least-loaded-
  // day + holiday-skip logic the public signup page already uses
  // (public-data.ts's submit_trashcan_signup) rather than reimplementing
  // it here; manual just inserts unassigned so it lands in the existing
  // Planning board below for a drag-to-day placement.
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const emptyNewCustForm = () => ({ firstName: "", lastName: "", phone: "", email: "", address: "", lat: undefined as number | undefined, lng: undefined as number | undefined, cansCount: "1" as string, price: "" as string, discType: "amount" as "amount" | "percent", discValue: "" as string, freq: ((settings as any)?.trashCanDefaultFrequency || "weekly") as string, firstDate: "" });
  const [newCustForm, setNewCustForm] = useState(emptyNewCustForm());
  const [addingCustomer, setAddingCustomer] = useState(false);
  // "dated" = owner picked an exact first service date, so skip both
  // auto-placement and the Planning board and schedule it right there.
  const addTrashCanCustomer = async (mode: "auto" | "manual" | "dated") => {
    if (!newCustForm.firstName.trim() || !newCustForm.address.trim()) { toast?.("Name and address are required", "red"); return; }
    setAddingCustomer(true);
    try {
      const customerPayload = {
        id: uid(), firstName: newCustForm.firstName.trim(), lastName: newCustForm.lastName.trim(),
        phone: newCustForm.phone.trim(), email: newCustForm.email.trim(), address: newCustForm.address.trim(),
        totalSpent: 0, createdAt: today(), notes: "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "",
      };
      const jobPayload = {
        customerId: customerPayload.id,
        address: newCustForm.address.trim(),
        ...priceJob(newCustForm.price.trim() !== "" ? Number(newCustForm.price) : costPerCan * Math.max(1, parseInt(newCustForm.cansCount) || 1), { type: newCustForm.discType, value: Number(newCustForm.discValue) || 0 }, trashTaxOn, trashTaxRate),
        status: "scheduled", scheduledDate: mode === "dated" ? newCustForm.firstDate : today(), scheduledTime: "", priority: "normal",
        serviceCategory: "trash_can", cansCount: Math.max(1, parseInt(newCustForm.cansCount) || 1),
        crew: [], checklist: [], photos: [], commLog: [], chemicalsUsed: [], equipment: [], tags: [],
        loggedHours: 0, createdAt: today(),
        // BUG FIX — the picked map location went on the customer, but the
        // customers table has no lat/lng columns, so adding a customer with
        // an address picked from the suggestions failed to save. It belongs
        // on the job, which the route builder reads first.
        ...(newCustForm.lat != null ? { lat: newCustForm.lat, lng: newCustForm.lng } : {}),
        ...freqPatch(newCustForm.freq, mode === "dated" ? newCustForm.firstDate : today()),
        dayAssignmentConfirmed: mode === "manual" ? false : mode === "dated" ? true : undefined,
      };
      if (mode === "auto") {
        const res = await fetch("/api/public-data", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit_trashcan_signup", ownerId, customer: customerPayload, job: { id: uid(), ...jobPayload, owner_id: ownerId } }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || data?.error) throw new Error(data?.error || "Couldn't add customer");
        setCustomers?.((prev: any[]) => [...prev, { ...customerPayload, owner_id: ownerId }]);
        toast?.(data?.assignedDay ? `Added ✓ — placed on the ${data.assignedDay} route, first service ${data.scheduledDate}` : "Added — no existing route to auto-place on yet, assign a day in Planning below", data?.assignedDay ? "green" : "yellow");
      } else {
        const { data: savedCust, error: custErr } = await (supabase as any).from("customers").insert({ ...customerPayload, owner_id: ownerId }).select().single();
        if (custErr || !savedCust) throw new Error(custErr?.message || "Couldn't save customer");
        const { data: savedJob, error: jobErr } = await tolerantJobWrite({ id: uid(), ...jobPayload, customerId: savedCust.id, owner_id: ownerId }, row => (supabase as any).from("jobs").insert(row).select().single());
        if (jobErr || !savedJob) throw new Error(jobErr?.message || "Couldn't save job");
        setCustomers?.((prev: any[]) => [...prev, savedCust]);
        setJobs?.((prev: any[]) => [...prev, savedJob]);
        toast?.(mode === "dated" ? `Added ✓ — scheduled ${newCustForm.firstDate}` : "Added ✓ — drag them onto a day on the Planning tab", "green");
      }
      setNewCustOpen(false);
      setNewCustForm(emptyNewCustForm());
    } catch (e: any) {
      toast?.("Couldn't add customer — " + (e?.message || "unknown error"), "red");
    } finally {
      setAddingCustomer(false);
    }
  };

  const costPerCan = Number((settings as any)?.trashCanCostPerCan) || 5;
  const minutesPerCan = Number((settings as any)?.trashCanMinutesPerCan) || 5;
  // FEATURE (owner request) — "I want the option to put the price in there
  // ... add a discount ... make sure it's adding sales tax." A trash can job
  // now has its own price (starts at cans × cost per can), an optional
  // discount ($ or %) and sales tax (on by default, Settings tab). Stored
  // the same way as every other job: `amount` = price + tax, `tax` = the tax
  // part, the discount in `discounts`; what the customer pays is
  // amount − discount, which is what invoices already charge.
  const trashTaxOn = (settings as any)?.trashCanTaxOn !== false;
  const trashTaxRate = defaultTaxRate(settings);
  const priceJob = (price: number, disc: { type: "amount" | "percent"; value: number }, taxOn: boolean, rate: number) => {
    const p = Math.max(0, Math.round((Number(price) || 0) * 100) / 100);
    const v = Math.max(0, Number(disc.value) || 0);
    const discounts = v > 0 ? [{ id: uid(), label: "Discount", type: disc.type, value: v }] : [];
    const base = Math.max(0, p - computeDiscountsTotal(discounts, p));
    const tax = taxOn ? taxOf(base, rate) : 0;
    return { amount: Math.round((p + tax) * 100) / 100, tax, taxRate: taxOn ? Number(rate) || 0 : 0, discounts };
  };
  // What the customer pays for one visit.
  const chargedOf = (j: any) => { const sp = jobTaxSplit(j); return Math.max(0, Math.round((sp.total - computeDiscountsTotal(j?.discounts, sp.subtotal)) * 100) / 100); };
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
    // AUDIT FIX — failures were only console-logged; the success toast and
    // the "text all customers" SMS blast below both fired unconditionally
    // regardless of whether any of these writes actually persisted —
    // customers could get texted a scheduled day that was never saved.
    let failedCount = 0;
    for (const [jobId, date] of touched) {
      const patch = { scheduledDate: date, dayAssignmentConfirmed: true };
      setJobs?.((prev: any[]) => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
      const j = trashJobs.find(x => x.id === jobId);
      const r = await (supabase as any).from("jobs").update(patch).eq("id", jobId).select("id");
      if (r?.error || !Array.isArray(r?.data) || r.data.length === 0) {
        console.error("[TrashCan] day-assignment save failed:", r?.error?.message || "matched 0 rows");
        failedCount++;
        continue;
      }
      if (j) patchedJobs.push({ ...j, ...patch } as Job);
    }
    setStaged({});
    setConfirming(false);
    if (failedCount > 0) {
      toast?.(`${patchedJobs.length} assigned ✓ — ${failedCount} failed to save, try again for those.`, patchedJobs.length > 0 ? "yellow" : "red");
    } else {
      toast?.(`${touched.length} customer${touched.length !== 1 ? "s" : ""} assigned to their service day ✓`, "green");
    }

    if (patchedJobs.length > 0 && window.confirm(`Text all ${patchedJobs.length} customer${patchedJobs.length !== 1 ? "s" : ""} to let them know their scheduled day?`)) {
      let sent = 0, failed = 0;
      for (const j of patchedJobs) {
        const c = cf(j.customerId);
        if (!c?.phone) { failed++; continue; }
        const msg = `Hi ${c.firstName}! Your trash can cleaning with ${(settings as any)?.companyName || "us"} is scheduled for ${j.scheduledDate}. Reply STOP to opt out.`;
        try {
          await twilioSend(settings as any, c.phone, msg);
          logOutboundSmsToInbox({ via: "trash cans", contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
          sent++;
        } catch { failed++; }
      }
      toast?.(`Notified ${sent}${failed ? " · " + failed + " failed" : ""}`, failed ? "yellow" : "green");
    }
  };

  // BUG FIX (audit) — both route optimizers read the map location from the
  // JOB, but it's saved on the CUSTOMER (New Customer's address picker) and
  // imported jobs have none at all, so every route came back in plain
  // time order, never by distance. Now: the job's location, else the
  // customer's, else the address is looked up once and saved on the
  // customer for next time.
  const coordsForJobs = async (list: Job[]): Promise<{ coords: Record<string, { lat: number; lng: number }>; missing: number; error?: string }> => {
    const coords: Record<string, { lat: number; lng: number }> = {};
    const addrOf = (j: any) => (j.address || cf(j.customerId)?.address || "").trim();
    const need: any[] = [];
    for (const j of list as any[]) {
      const c: any = cf(j.customerId);
      if (typeof j.lat === "number" && typeof j.lng === "number") coords[j.id] = { lat: j.lat, lng: j.lng };
      else if (typeof c?.lat === "number" && typeof c?.lng === "number") coords[j.id] = { lat: c.lat, lng: c.lng };
      else if (addrOf(j)) need.push(j);
    }
    let error: string | undefined;
    if (need.length) {
      const key = (settings as any)?.googleGeocodingKey || (settings as any)?.googleMapsKey || (settings as any)?.mapsKey || "";
      const res = await geocodeAddresses(need.map(addrOf), key);
      error = res.error;
      // Saved on the job: the customers table has no lat/lng columns, so
      // saving it on the customer failed every time and each browser had to
      // look the address up again.
      const saved: Record<string, { lat: number; lng: number }> = {};
      for (const j of need) {
        const hit = res.found[addrOf(j)];
        if (!hit) continue;
        coords[j.id] = hit;
        saved[j.id] = hit;
      }
      const jobIds = Object.keys(saved);
      if (jobIds.length) {
        setJobs?.((prev: any[]) => prev.map((x: any) => saved[x.id] ? { ...x, ...saved[x.id] } : x));
        for (const id of jobIds) (supabase as any).from("jobs").update(saved[id]).eq("id", id).then((r: any) => { if (r?.error) console.warn("[TrashCanPage] couldn't save map location:", r.error.message); });
      }
    }
    return { coords, missing: list.length - Object.keys(coords).length, error };
  };
  const hhmmToMin = (t?: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const minToHhmm = (n: number) => `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  const clock = (n: number) => { const h = Math.floor(n / 60) % 24, m = n % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  const [routeStart, setRouteStart] = useState(540);
  const [routeBuilding, setRouteBuilding] = useState(false);
  const [routeNote, setRouteNote] = useState("");
  const [savingRouteTimes, setSavingRouteTimes] = useState(false);
  // The route starts from the owner's shop or home (Settings tab) when set,
  // so the first stop is the one nearest where the crew leaves from.
  const routeStartAddress = String((settings as any)?.routeStartAddress || (settings as any)?.companyAddress || "").trim();
  const startCoords = async (): Promise<{ lat: number; lng: number } | null> => {
    if (!routeStartAddress) return null;
    const key = (settings as any)?.googleGeocodingKey || (settings as any)?.googleMapsKey || (settings as any)?.mapsKey || "";
    const res = await geocodeAddresses([routeStartAddress], key).catch(() => null);
    return res?.found?.[routeStartAddress] || null;
  };
  const buildRoute = async () => {
    const dayJobs = trashJobs.filter(j => j.scheduledDate === routeDate && j.status !== "cancelled" && j.status !== "completed");
    if (dayJobs.length === 0) { toast?.("No trash-can jobs scheduled that day", "yellow"); return; }
    setRouteBuilding(true);
    const [{ coords, missing, error }, start] = await Promise.all([coordsForJobs(dayJobs), startCoords()]);
    setRouteBuilding(false);
    const entries = buildOptimizedRoute(
      dayJobs.map(j => ({ id: j.id, ...(coords[j.id] || {}), scheduledTime: j.scheduledTime, estMinutes: ((j as any).cansCount || 1) * minutesPerCan })),
      { lunchMinutes: Number((settings as any)?.routeLunchMinutes) || 0, lunchEarliestMinutes: 240, start }
    );
    // The day starts at the earliest time already on that day's stops (the
    // owner's own start), else 9:00.
    const times = dayJobs.map(j => hhmmToMin(j.scheduledTime)).filter((n): n is number => n != null);
    setRouteStart(times.length ? Math.min(...times) : 540);
    setRouteNote(missing ? `${missing} stop${missing !== 1 ? "s" : ""} couldn't be placed on the map${error ? " (" + error + ")" : ""} — they're at the end. Check the address on the customer.` : "");
    if (missing) toast?.(`${missing} address${missing !== 1 ? "es" : ""} couldn't be found on the map${error ? " — " + error : ""}`, "yellow");
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
    // AUDIT FIX (audit) — these three route writes only checked `error`,
    // missing the documented RLS 0-row-silent-success case (CLAUDE.md): a
    // stale/foreign routeId matches 0 rows with no error, and the optimistic
    // local mutation above had already shown the change as saved.
    const { error, data } = await (supabase as any).from("trash_can_routes").update({ name, updated_at: new Date().toISOString() }).eq("id", routeId).select("id");
    if (error) toast?.(`Rename didn't save — ${error.message}`, "red");
    else if (!Array.isArray(data) || data.length === 0) toast?.("Rename didn't save — the server didn't confirm the update.", "red");
    else toast?.("Route renamed ✓", "green");
  };

  const deleteRoute = async (r: any) => {
    if (!window.confirm(`Delete route "${r.name}"? This can't be undone.`)) return;
    const prevRoutes = routes;
    setRoutes(prev => prev.filter(x => x.id !== r.id));
    const { error, data } = await (supabase as any).from("trash_can_routes").delete().eq("id", r.id).select("id");
    if (error || !Array.isArray(data) || data.length === 0) {
      setRoutes(prevRoutes);
      toast?.(error ? `Delete failed — ${error.message}` : "Delete failed — the server didn't confirm it.", "red");
      return;
    }
    if (managingRouteId === r.id) setManagingRouteId(null);
    if (expandedRouteId === r.id) setExpandedRouteId(null);
    toast?.("Route deleted ✓", "green");
  };

  const persistRouteCustomerIds = async (routeId: string, customerIds: string[]): Promise<boolean> => {
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, customer_ids: customerIds, updated_at: new Date().toISOString() } : r));
    const { error, data } = await (supabase as any).from("trash_can_routes").update({ customer_ids: customerIds, updated_at: new Date().toISOString() }).eq("id", routeId).select("id");
    if (error) { toast?.(`Couldn't save route change — ${error.message}`, "red"); return false; }
    if (!Array.isArray(data) || data.length === 0) { toast?.("Couldn't save route change — the server didn't confirm the update.", "red"); return false; }
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
    const routeJobs = ids.map(cid => trashJobs.find(x => x.customerId === cid)).filter(Boolean) as Job[];
    if (routeJobs.length === 0) { toast?.("No assigned customers with a trash-can job to optimize", "yellow"); return; }
    setOptimizingRouteId(route.id);
    const [{ coords, missing, error }, start] = await Promise.all([coordsForJobs(routeJobs), startCoords()]);
    if (missing) toast?.(`${missing} address${missing !== 1 ? "es" : ""} couldn't be found on the map${error ? " — " + error : ""}`, "yellow");
    const stops = routeJobs.map(j => ({ id: j.customerId as string, ...(coords[j.id] || {}), scheduledTime: j.scheduledTime, estMinutes: ((j as any).cansCount || 1) * minutesPerCan }));
    const entries = buildOptimizedRoute(stops, { lunchMinutes: Number(route.lunch_minutes) || 0, lunchEarliestMinutes: 240, start });
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
          // BUG FIX — missing owner_id violated the owner_id-scoped RLS
          // policy added by the multi-tenant migration, silently rejecting
          // every trash-can inconvenience-fee invoice insert.
          owner_id: ownerId,
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
  type EditForm = { scheduledDate: string; recurringFreq: string; cansCount: string; price: string; priceAuto: boolean; discType: "amount" | "percent"; discValue: string; taxOn: boolean; taxRate: number | string };
  const [editForm, setEditForm] = useState<EditForm>({ scheduledDate: "", recurringFreq: "weekly", cansCount: "1", price: "", priceAuto: true, discType: "amount", discValue: "", taxOn: true, taxRate: 6 });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditJob = (j: Job) => {
    setEditingJob(j);
    const cans = Number((j as any).cansCount) || 1;
    const sp = jobTaxSplit(j);
    const price = sp.subtotal > 0 ? sp.subtotal : cans * costPerCan;
    const d0: any = ((j as any).discounts || [])[0];
    // Tax stays off only on a job where the owner turned it off (taxRate 0).
    const taxOn = sp.tax > 0 || ((j as any).taxRate !== 0 && trashTaxOn);
    setEditForm({
      scheduledDate: j.scheduledDate && j.status !== "cancelled" ? j.scheduledDate : today(), recurringFreq: j.isRecurring ? (j.recurringFreq || "weekly") : "one_time",
      cansCount: String(cans), price: price.toFixed(2), priceAuto: Math.abs(price - cans * costPerCan) < 0.005,
      discType: d0?.type === "percent" ? "percent" : "amount", discValue: d0 ? String(d0.value) : "",
      taxOn, taxRate: Number((j as any).taxRate) > 0 ? Number((j as any).taxRate) : trashTaxRate,
    });
  };

  // The job a customer card manages: their open one, else their most recent
  // (so an off-schedule customer can be put back on).
  const customerTrashJob = (customerId: string): Job | undefined => {
    const mine = trashJobs.filter(j => j.customerId === customerId);
    return mine.find(j => j.status !== "cancelled" && j.status !== "completed")
      || [...mine].sort((a, b) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""))[0];
  };

  const patchJobs = async (ids: string[], patch: any): Promise<boolean> => {
    setJobs?.((prev: any[]) => prev.map(j => ids.includes(j.id) ? { ...j, ...patch } : j));
    const r = await tolerantJobWrite(patch, row => (supabase as any).from("jobs").update(row).in("id", ids).select("id"),
      cols => toast?.(`Saved, but ${cols.join(", ")} need a database update first (migration 0107) — sales tax won't stick until it runs.`, "yellow"));
    if (r?.error) { toast?.(`Couldn't save — ${r.error.message}`, "red"); return false; }
    if (!Array.isArray(r?.data) || r.data.length === 0) { toast?.("Couldn't save — the server didn't confirm the change.", "red"); return false; }
    return true;
  };

  const saveEditJob = async () => {
    if (!editingJob) return;
    if (!editForm.scheduledDate) { toast?.("Pick a date", "yellow"); return; }
    setSavingEdit(true);
    const reactivating = editingJob.status === "cancelled" || editingJob.status === "completed";
    const patch: any = {
      scheduledDate: editForm.scheduledDate, cansCount: Math.max(1, parseInt(editForm.cansCount) || 1),
      ...priceJob(Number(editForm.price) || 0, { type: editForm.discType, value: Number(editForm.discValue) || 0 }, editForm.taxOn, Number(editForm.taxRate) || 0),
      ...freqPatch(editForm.recurringFreq, editForm.scheduledDate),
      ...(reactivating ? { status: "scheduled", dayAssignmentConfirmed: true, completedAt: null } : {}),
    };
    const ok = await patchJobs([editingJob.id], patch);
    setSavingEdit(false);
    if (!ok) return;
    toast?.(reactivating ? `Back on the schedule — ${editForm.scheduledDate} ✓` : "Job updated ✓", "green");
    setEditingJob(null);
  };

  // Stops service but keeps the customer and their history.
  const takeOffSchedule = async (j: Job) => {
    const c = cf(j.customerId);
    if (!window.confirm(`Take ${c ? c.firstName + " " + c.lastName : "this customer"} off the trash can schedule? Their upcoming cleanings stop; the customer stays in your records and can be put back on later.`)) return;
    const openIds = trashJobs.filter(x => x.customerId === j.customerId && x.status !== "cancelled" && x.status !== "completed").map(x => x.id);
    const ok = await patchJobs(openIds.length ? openIds : [j.id], { status: "cancelled", isRecurring: false, cancelReason: "Removed from trash can schedule" });
    if (ok) { toast?.("Taken off the schedule ✓", "green"); setEditingJob(null); }
  };

  // Deletes the customer's trash-can jobs; optionally the customer too.
  const deleteTrashCustomer = async (customerId: string) => {
    const c = cf(customerId);
    const name = c ? `${c.firstName} ${c.lastName}`.trim() : "this customer";
    if (!window.confirm(`Delete ${name}'s trash can service? This permanently deletes their trash can jobs.`)) return;
    const jobIds = trashJobs.filter(x => x.customerId === customerId).map(x => x.id);
    const hasOtherJobs = jobs.some((x: any) => x.customerId === customerId && x.serviceCategory !== "trash_can");
    const alsoCustomer = !!c && !hasOtherJobs && window.confirm(`Also delete ${name} from your Customers list?\n\nOK = delete the customer too\nCancel = keep them as a customer`);
    setJobs?.((prev: any[]) => prev.filter(x => !jobIds.includes(x.id)));
    markRecentlyDeleted?.("jobs", jobIds);
    if (jobIds.length) {
      const r = await deleteByIds("jobs", jobIds);
      if (r.deleted.length === 0) { toast?.(`Delete failed — ${r.error || "the server didn't confirm it"}`, "red"); return; }
    }
    if (alsoCustomer) {
      setCustomers?.((prev: any[]) => prev.filter(x => x.id !== customerId));
      markRecentlyDeleted?.("customers", [customerId]);
      const r = await (supabase as any).from("customers").delete().eq("id", customerId).select("id");
      if (r?.error || !Array.isArray(r?.data) || r.data.length === 0) { toast?.(`Jobs deleted, but the customer wasn't — ${r?.error?.message || "the server didn't confirm it"}`, "red"); return; }
    }
    toast?.(alsoCustomer ? `${name} deleted ✓` : `${name}'s trash can service deleted ✓`, "green");
    setEditingJob(null);
  };

  // ── Upcoming trash can days — real scheduled stops plus projected repeats
  // of recurring customers, grouped by date. ───────────────────────────────
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  // Far enough ahead to show the next round of quarterly (13-week) visits.
  const HORIZON_DAYS = 112;
  const upcomingDays = (() => {
    const start = today();
    const end = daysFromNow(HORIZON_DAYS);
    const byDate: Record<string, { job: Job; projected: boolean }[]> = {};
    for (const j of trashJobs) {
      if (j.status === "cancelled" || j.status === "completed" || !j.scheduledDate) continue;
      if ((j as any).dayAssignmentConfirmed === false) continue;
      let d = j.scheduledDate;
      let projected = false;
      for (let i = 0; i < 60 && d <= end; i++) {
        if (d >= start) (byDate[d] = byDate[d] || []).push({ job: j, projected });
        if (!j.isRecurring) break;
        const next = computeNextRecurringDate(j as any, d);
        if (next <= d) break;
        d = next; projected = true;
      }
    }
    return Object.keys(byDate).sort().map(date => {
      const seen = new Set<string>();
      const stops = [...byDate[date]].sort((a, b) => Number(a.projected) - Number(b.projected))
        .filter(s => { const k = s.job.customerId || s.job.id; if (seen.has(k)) return false; seen.add(k); return true; });
      return { date, stops };
    });
  })();

  // ── Text customers their scheduled day (owner request: "I need to send
  // out this text pronto so people know when they're scheduled"). The owner
  // picks who gets it, edits the wording, sees each customer's real message,
  // and presses Send; every text is confirmed with Twilio and the result is
  // shown per customer (sent / failed and why). Customers who replied STOP
  // or have no phone are left out and listed.
  type SchedTextRow = { customer: any; job: Job; date: string; on: boolean };
  const [schedText, setSchedText] = useState<{ title: string; rows: SchedTextRow[]; template: string } | null>(null);
  const [schedSending, setSchedSending] = useState<{ done: number; total: number } | null>(null);
  const SCHED_TEMPLATE = "Hi {first}! Your trash can cleaning with {company} is scheduled for {day}{time}{repeat}. Please have your cans out. Reply STOP to opt out.";
  const longDay = (date: string) => new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const fillSchedText = (template: string, r: SchedTextRow) => template
    .replace(/\{first\}/g, r.customer?.firstName || "there")
    .replace(/\{company\}/g, (settings as any)?.companyName || "us")
    .replace(/\{day\}/g, longDay(r.date))
    .replace(/\{time\}/g, r.job.scheduledTime && r.date === r.job.scheduledDate ? ` around ${clock(hhmmToMin(r.job.scheduledTime) ?? 0)}` : "")
    .replace(/\{repeat\}/g, r.job.isRecurring ? `, then ${freqLabel(r.job).toLowerCase()} after that` : "");
  const openSchedText = (title: string, list: { job: Job; date: string }[]) => {
    const seen = new Set<string>();
    const rows: SchedTextRow[] = [];
    for (const { job, date } of list) {
      const c = cf(job.customerId);
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      rows.push({ customer: c, job, date, on: !!c.phone && !c.smsOptOut });
    }
    if (rows.length === 0) { toast?.("Nobody to text on that day", "yellow"); return; }
    setSchedText({ title, rows, template: SCHED_TEMPLATE });
  };
  // Each active customer with their next day.
  const openSchedTextAll = () => {
    const list: { job: Job; date: string }[] = [];
    for (const c of trashCanCustomers as any[]) {
      const next = upcomingDays.find(d => d.stops.some(s => s.job.customerId === c.id));
      const st = next?.stops.find(s => s.job.customerId === c.id);
      if (next && st) list.push({ job: st.job, date: next.date });
    }
    openSchedText("Text everyone their next cleaning day", list);
  };
  const sendSchedTexts = async () => {
    if (!schedText) return;
    const picked = schedText.rows.filter(r => r.on);
    if (picked.length === 0) { toast?.("Tick at least one customer", "yellow"); return; }
    if (!window.confirm(`Send ${picked.length} text${picked.length !== 1 ? "s" : ""} now?`)) return;
    setSchedSending({ done: 0, total: picked.length });
    const results: SendResult[] = [];
    for (const r of schedText.rows.filter(x => !x.on)) {
      const name = `${r.customer.firstName} ${r.customer.lastName}`.trim();
      if (!r.customer.phone) results.push({ ...skipResult("sms", "Not sent: no phone number on file."), to: name });
      else if (r.customer.smsOptOut) results.push({ ...skipResult("sms", "Not sent: this customer replied STOP."), to: name });
    }
    let i = 0;
    for (const r of picked) {
      const name = `${r.customer.firstName} ${r.customer.lastName}`.trim();
      const body = fillSchedText(schedText.template, r);
      try {
        const info = await twilioSend(settings as any, r.customer.phone, body, "sms", { confirm: true });
        results.push({ ...okResult("sms", r.customer.phone, info), to: name + " · " + r.customer.phone });
        if (!info?.testMode) logOutboundSmsToInbox({ via: "trash cans", contactName: name, contactPhone: r.customer.phone, customerId: r.customer.id, body }).catch(() => {});
      } catch (e: any) {
        results.push({ ...failResult("sms", r.customer.phone, e), to: name + " · " + r.customer.phone });
        // Out of credit or bad login fails every text the same way: stop.
        const sum = results[results.length - 1].summary;
        if (/out of credit|rejected your login|suspended|isn't set up/.test(sum)) {
          for (const rest of picked.slice(i + 1)) results.push({ ...skipResult("sms", "Not sent: stopped after the error above."), to: `${rest.customer.firstName} ${rest.customer.lastName}`.trim() });
          break;
        }
      }
      i++;
      setSchedSending({ done: i, total: picked.length });
    }
    setSchedSending(null);
    setSchedText(null);
    const sent = results.filter(r => r.ok).length;
    showSendReport({ title: "Schedule texts", customerName: `${sent} of ${picked.length} sent`, results });
  };

  // ── Page layout: one tab at a time ──────────────────────────────────────
  const [tab, setTab] = useState<"schedule" | "customers" | "routes" | "planning" | "settings">("schedule");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [custSearch, setCustSearch] = useState("");
  const selected = upcomingDays.find(d => d.date === selectedDay) || upcomingDays[0] || null;
  useEffect(() => {
    if (selected && selected.date !== selectedDay) { setSelectedDay(selected.date); setRouteDate(selected.date); }
  }, [selected?.date]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekStart = (date: string) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
  const scheduleWeeks = (() => {
    const out: { key: string; label: string; days: typeof upcomingDays }[] = [];
    for (const day of upcomingDays) {
      const ws = weekStart(day.date);
      const key = ws.toISOString().slice(0, 10);
      let w = out.find(x => x.key === key);
      if (!w) { w = { key, label: "Week of " + ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }), days: [] }; out.push(w); }
      w.days.push(day);
    }
    return out;
  })();
  const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayLabel = (date: string) => date ? new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
  const customerGroups = (() => {
    const q = custSearch.trim().toLowerCase();
    const groups: Record<string, any[]> = {};
    for (const c of trashCanCustomers as any[]) {
      if (q && !`${c.firstName} ${c.lastName} ${c.address}`.toLowerCase().includes(q)) continue;
      const j = customerTrashJob(c.id);
      const active = j && j.status !== "cancelled" && j.status !== "completed";
      const label = !active ? "Off schedule" : (j as any).dayAssignmentConfirmed === false || !j?.scheduledDate ? "Unassigned" : WEEKDAY_NAMES[new Date(j.scheduledDate + "T12:00:00").getDay()];
      (groups[label] = groups[label] || []).push(c);
    }
    const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Unassigned", "Off schedule"];
    return order.filter(l => groups[l]).map(label => ({
      label,
      customers: groups[label].sort((a, b) => (customerTrashJob(a.id)?.scheduledTime || "99").localeCompare(customerTrashJob(b.id)?.scheduledTime || "99")),
    }));
  })();

  return (
    // Extra bottom padding (beyond <main>'s own pb-16) so the last row of
    // "Upcoming Trash Can Jobs" — this page's longest, most-variable-length
    // list — isn't left sitting behind the mobile bottom nav (its min-height
    // 56px + safe-area-inset-bottom on notch phones can exceed main's 64px
    // reservation) with no more scroll room to reveal it.
    <div className="space-y-4 pb-10 md:pb-0">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Trash2} label="Upcoming Visits" value={String(upcoming.length)} />
        <Stat icon={DollarSign} label="Cost / Can" value={fmt(costPerCan)} />
        <Stat icon={Clock} label="Est. Min / Can" value={String(minutesPerCan)} />
        <Stat icon={Users} label="Customers" value={String(trashCanCustomers.length)} />
      </div>

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

      {/* One area at a time (user report: "so much going on … it doesn't
          sort them or organize them into separate days"). */}
      <div className="flex gap-1 p-1 rounded-xl bg-black/40 border border-white/10 overflow-x-auto">
        {([
          ["schedule", "Schedule", null],
          ["customers", "Customers", trashCanCustomers.length],
          ["routes", "Routes", routes.length],
          ["planning", "Planning", unassigned.length || null],
          ["settings", "Settings", null],
        ] as const).map(([k, label, n]) => (
          <button key={k} onClick={() => setTab(k)} className={"px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition " + (tab === k ? "bg-red-600/30 border border-red-500/40 text-white" : "text-white/50 hover:text-white/80 border border-transparent")}>
            {label}{n ? <span className={"ml-1.5 text-[10px] " + (k === "planning" ? "text-yellow-300" : "text-white/40")}>{n}</span> : null}
          </button>
        ))}
      </div>

      {tab === "schedule" && <>
      <Glass className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-semibold text-sm flex items-center gap-2"><Calendar size={14} className="text-green-400" />Schedule</div>
          {upcomingDays.length > 0 && <GBtn onClick={openSchedTextAll} className="!text-xs" data-sched-text-all><Send size={12} className="inline mr-1" />Text everyone their day</GBtn>}
        </div>
        {upcomingDays.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-xs">No trash can days scheduled yet — add customers on the Customers tab.</div>
        ) : (
          <div className="grid md:grid-cols-[230px_1fr] gap-4">
            <div className="space-y-3 md:max-h-[560px] md:overflow-y-auto md:pr-1">
              {scheduleWeeks.map(w => (
                <div key={w.key} className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">{w.label}</div>
                  <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5">
                    {w.days.map(({ date, stops }) => {
                      const d = new Date(date + "T12:00:00");
                      const sel = date === selectedDay;
                      const projected = stops.every(s => s.projected);
                      return (
                        <button key={date} onClick={() => { setSelectedDay(date); setRouteDate(date); setRoute(null); setRouteNote(""); if (isMobile) setTimeout(() => document.getElementById("trash-day-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                          className={"p-2 rounded-lg border text-left transition flex items-center gap-2 " + (sel ? "bg-red-900/30 border-red-500/50" : "bg-black/30 border-white/10 hover:border-white/25")}>
                          <div className="w-10 text-center flex-shrink-0">
                            <div className="text-[9px] uppercase text-white/40">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                            <div className="text-sm font-semibold">{d.getDate()}</div>
                          </div>
                          <div className="min-w-0 text-[11px]">
                            <div className="text-white/80">{stops.length} stop{stops.length !== 1 ? "s" : ""}</div>
                            <div className="text-white/40 truncate">{date === today() ? "Today" : projected ? "Repeat" : d.toLocaleDateString(undefined, { month: "short" })}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {selected ? (() => {
              const { date, stops } = selected;
              const projected = stops.every(s => s.projected);
              const cans = stops.reduce((n, s) => n + ((s.job as any).cansCount || 1), 0);
              const revenue = stops.reduce((n, s) => n + chargedOf(s.job), 0);
              const ordered = [...stops].sort((a, b) => (a.job.scheduledTime || "99").localeCompare(b.job.scheduledTime || "99"));
              const showRoute = route && routeDate === date;
              return (
                <div id="trash-day-detail" className="space-y-3 min-w-0 scroll-mt-20">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-base font-semibold">{new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
                      <div className="text-[11px] text-white/50">{stops.length} stop{stops.length !== 1 ? "s" : ""} · {cans} can{cans !== 1 ? "s" : ""} · {fmt(revenue)} · ~{cans * minutesPerCan} min on site</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <GBtn variant="ghost" onClick={() => openSchedText("Text " + dayLabel(date) + " customers", stops.map(s => ({ job: s.job, date })))} className="!text-xs" data-sched-text-day><Send size={12} className="inline mr-1" />Text these customers</GBtn>
                      {!projected && <GBtn onClick={buildRoute} disabled={routeBuilding} className="!text-xs"><RouteIcon size={12} className="inline mr-1" />{routeBuilding ? "Finding addresses…" : "Optimize this day"}</GBtn>}
                    </div>
                  </div>
                  {projected && <div className="text-[10px] text-white/40">Repeat visits. They become real jobs (and get times) when the visit before them is completed.</div>}
                  {showRoute ? (
                    <div className="space-y-2">
                      <div className="text-[10px] text-white/40">Closest stop next, by address. Times count your minutes per can plus an estimated drive between stops, starting at this day's earliest time. Nothing changes until you tap "Use these times".</div>
        {routeNote && <div className="text-[10px] text-yellow-300/80">{routeNote}</div>}
        {route && (
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            {route.map((entry: any, i: number) => entry.kind === "lunch" ? (
              <div key={"lunch" + i} className="p-2 rounded-lg bg-yellow-950/20 border border-yellow-700/30 text-xs text-yellow-300 flex items-center gap-2"><Clock size={11} />Lunch break — {entry.durationMinutes} min</div>
            ) : (() => {
              const j = trashJobs.find(x => x.id === entry.jobId);
              const c = j ? cf(j.customerId) : null;
              return <div key={entry.jobId} className="p-2 rounded-lg bg-black/40 border border-white/10 text-xs flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><span className="text-white/70 w-16 shrink-0">{clock(routeStart + (entry.startMinutes || 0))}</span>{c ? `${c.firstName} ${c.lastName}` : "Customer"} — {j?.address}</span>
                <span className="text-white/40 shrink-0">{entry.driveMinutes ? `${entry.driveMinutes}m drive · ` : ""}{(j as any)?.cansCount || 1} cans · ~{entry.estMinutes}m</span>
              </div>;
            })())}
            <GBtn variant="ghost" disabled={savingRouteTimes} className="!text-xs w-full !justify-center" onClick={async () => {
              const stops = route.filter((e: any) => e.kind === "job");
              setSavingRouteTimes(true);
              let saved = 0;
              for (const e of stops) {
                const t = minToHhmm(routeStart + (e.startMinutes || 0));
                const j = trashJobs.find(x => x.id === e.jobId);
                if (!j || j.scheduledTime === t) { saved++; continue; }
                if (await patchJobs([e.jobId], { scheduledTime: t })) saved++;
              }
              setSavingRouteTimes(false);
              toast?.(saved === stops.length ? `Saved ${saved} stop time${saved !== 1 ? "s" : ""} — Google Calendar updates in a few seconds ✓` : `Saved ${saved} of ${stops.length} stop times`, saved === stops.length ? "green" : "yellow");
            }}><Clock size={11} className="inline mr-1" />{savingRouteTimes ? "Saving…" : "Use these times for the day"}</GBtn>
          </div>
        )}
                      <button onClick={() => setRoute(null)} className="text-[11px] text-white/40 hover:text-white/70">← Back to the day's list</button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {ordered.map(({ job, projected: rep }, i) => {
                        const c = cf(job.customerId);
                        return (
                          <div key={job.id + date} className="flex items-center gap-3 p-2.5 rounded-lg bg-black/30 border border-white/10 text-xs">
                            <div className="w-16 flex-shrink-0 text-white/70">{job.scheduledTime ? clock(hhmmToMin(job.scheduledTime) ?? 0) : <span className="text-white/30">{i + 1}.</span>}</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{c ? `${c.firstName} ${c.lastName}` : "Customer"}</div>
                              <div className="text-[10px] text-white/40 truncate">{job.address}</div>
                            </div>
                            <div className="text-right flex-shrink-0 text-[10px] text-white/50">
                              <div data-stop-price>{fmt(chargedOf(job))}{Number((job as any).tax) > 0 ? <span className="text-white/30"> incl. tax</span> : null}</div>
                              <div>{(job as any).cansCount || 1} can{((job as any).cansCount || 1) !== 1 ? "s" : ""}{rep ? " · repeat" : ""}</div>
                            </div>
                            <button onClick={() => openEditJob(job)} className="p-1.5 rounded bg-white/5 text-white/50 hover:text-white flex-shrink-0" title="Edit"><Edit2 size={11} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })() : <div className="text-xs text-white/40">Pick a day.</div>}
          </div>
        )}
      </Glass>
      </>}

      {tab === "customers" && <>
      <Glass className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold text-sm flex items-center gap-2"><Users size={14} className="text-red-400" />Trash Can Customers</div>
          <div className="flex items-center gap-2">
            <GBtn variant="ghost" onClick={() => setBulkImportOpen(true)} className="!text-xs">📋 Bulk Import</GBtn>
            <GBtn onClick={() => setNewCustOpen(true)} className="!text-xs"><Plus size={12} className="inline mr-1" />New Customer</GBtn>
          </div>
        </div>
        <div className="text-[10px] text-white/40">Only customers with a trash-can service on file — they also appear in the normal Customers page like anyone else.</div>
        {trashCanCustomers.length > 0 && <GInput placeholder="Search name or address" value={custSearch} onChange={(e: any) => setCustSearch(e.target.value)} className="!text-xs" />}
        {trashCanCustomers.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-xs">No trash-can customers yet.</div>
        ) : customerGroups.map(group => (
          <div key={group.label} className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-white/40 pt-1">{group.label} · {group.customers.length}</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {group.customers.map(c => {
              const custJob = customerTrashJob(c.id);
              const active = custJob && custJob.status !== "cancelled" && custJob.status !== "completed";
              return (
                <div key={c.id} className={"p-2.5 rounded-lg border text-xs flex items-start gap-2 " + (active ? "bg-black/30 border-white/10" : "bg-black/20 border-white/5 opacity-70")}>
                  <button onClick={() => custJob && openEditJob(custJob)} className="flex-1 min-w-0 text-left" title="Edit schedule">
                    <div className="font-medium text-white/80 truncate flex items-center gap-1.5">
                      {c.firstName} {c.lastName}
                      <span className={"text-[9px] px-1.5 py-0.5 rounded-full border flex-shrink-0 " + (!active ? "text-white/40 border-white/10" : custJob?.isRecurring ? "text-blue-300 border-blue-800/40 bg-blue-950/30" : "text-amber-300 border-amber-800/40 bg-amber-950/30")}>
                        {!active ? "Off schedule" : freqLabel(custJob)}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/40 flex items-center gap-1 truncate"><MapPin size={9} className="flex-shrink-0" />{c.address || "No address"}</div>
                    {custJob && <div className="text-[10px] text-white/30 mt-0.5">{!active ? "Tap to put back on the schedule" : (custJob as any).dayAssignmentConfirmed === false ? "Unassigned — see Planning" : `Next: ${dayLabel(custJob.scheduledDate || "")}${custJob.scheduledTime ? " · " + clock(hhmmToMin(custJob.scheduledTime) ?? 0) : ""}`}</div>}
                  </button>
                  <div className="flex gap-1 flex-shrink-0">
                    {custJob && <button onClick={() => openEditJob(custJob)} className="p-1.5 rounded bg-white/5 text-white/50 hover:text-white" title="Edit"><Edit2 size={11} /></button>}
                    <button onClick={() => deleteTrashCustomer(c.id)} className="p-1.5 rounded bg-white/5 text-white/40 hover:text-red-300" title="Delete"><Trash2 size={11} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        ))}
      </Glass>
      </>}

      {tab === "routes" && <>
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
      </>}

      {tab === "planning" && <>
      <Glass className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold text-sm flex items-center gap-2"><Calendar size={14} className="text-yellow-400" />Planning — Assign Customers to Days</div>
          {stagedCount > 0 && <GBtn onClick={confirmDayAssignments} disabled={confirming} className="!text-xs !py-1.5"><Send size={11} className="inline mr-1" />{confirming ? "Saving…" : `Confirm ${stagedCount} Assignment${stagedCount !== 1 ? "s" : ""}`}</GBtn>}
        </div>
        <div className="text-[10px] text-white/40">{isMobile ? "Use \"Move to…\" on a customer card to assign their trash-can service day." : "Drag a customer card onto a day to assign their trash-can service day."} Nothing is saved until you hit Confirm — which then offers to text everyone their scheduled day.</div>

        {/* FEATURE — "don't schedule trash-can routes on a holiday week."
            Owner-configured list of holiday dates; new-signup auto-assignment
            (see public-data.ts's submit_trashcan_signup) already skips these
            automatically. For this MANUAL planning board, a silent auto-shift
            behind the owner's own drag choice would be surprising — instead,
            warn below when a staged day lands in a holiday week so the owner
            can pick a different day themselves. */}
        <details className="text-[11px]">
          <summary className="cursor-pointer text-white/40 hover:text-white/60 select-none">Holiday dates to avoid ({(settings as any)?.trashCanHolidayDates?.length || 0})</summary>
          <div className="mt-2 space-y-1.5 pl-1">
            {((settings as any)?.trashCanHolidayDates || []).map((hd: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-white/60">{hd}</span>
                <button onClick={() => setSettings?.((prev: any) => ({ ...prev, trashCanHolidayDates: (prev.trashCanHolidayDates || []).filter((_: any, idx: number) => idx !== i) }))} className="text-red-400/70 hover:text-red-300"><X size={11} /></button>
              </div>
            ))}
            <input
              type="date"
              onChange={e => {
                const v = e.target.value;
                if (!v) return;
                setSettings?.((prev: any) => ({ ...prev, trashCanHolidayDates: [...new Set([...(prev.trashCanHolidayDates || []), v])].sort() }));
                e.target.value = "";
              }}
              className="bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white"
            />
          </div>
        </details>
        {(() => {
          const holidayDates: string[] = (settings as any)?.trashCanHolidayDates || [];
          if (holidayDates.length === 0) return null;
          const inSameWeek = (a: string, b: string) => {
            const startOfWeek = (s: string) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d.getTime(); };
            return startOfWeek(a) === startOfWeek(b);
          };
          const conflicts = Object.entries(staged).filter(([, date]) => holidayDates.some(hd => inSameWeek(date, hd)));
          if (conflicts.length === 0) return null;
          return (
            <div className="text-[11px] text-yellow-400 bg-yellow-950/20 border border-yellow-700/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
              <AlertTriangle size={11} className="flex-shrink-0" />
              {conflicts.length} staged assignment{conflicts.length !== 1 ? "s" : ""} land in a holiday week — pick a different day for {conflicts.length !== 1 ? "them" : "it"} before confirming.
            </div>
          );
        })()}

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
      </>}

      {tab === "settings" && <>
      <Glass className="p-4 space-y-3">
        <div className="font-semibold text-sm flex items-center gap-2"><Trash2 size={14} className="text-red-400" />Pricing & Scheduling</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block">Cost per can</label><GInput type="number" step="0.5" value={(settings as any)?.trashCanCostPerCan ?? 5} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanCostPerCan: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Estimated minutes per can</label><GInput type="number" value={(settings as any)?.trashCanMinutesPerCan ?? 5} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanMinutesPerCan: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Default frequency</label>
            <GSel value={(settings as any)?.trashCanDefaultFrequency || "weekly"} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanDefaultFrequency: e.target.value }))} className="!text-xs">
              {FREQ_OPTIONS.filter(o => o.key !== "one_time").map(o => <option key={o.key} value={o.key} className="bg-black">{o.label}</option>)}
            </GSel>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Inconvenience fee name</label><GInput value={(settings as any)?.trashCanInconvenienceFeeName || "Cans Not Out Fee"} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanInconvenienceFeeName: e.target.value }))} className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Inconvenience fee amount</label><GInput type="number" step="0.5" value={(settings as any)?.trashCanInconvenienceFeeAmount ?? 15} onChange={(e: any) => setSettings((s: any) => ({ ...s, trashCanInconvenienceFeeAmount: Number(e.target.value) || 0 }))} className="!text-xs" /></div>
          <div className="sm:col-span-2"><label className="text-xs text-white/60 mb-1 block">Route start address <span className="text-white/30">(your shop or home — routes start nearest here)</span></label><GInput value={(settings as any)?.routeStartAddress ?? ""} placeholder={(settings as any)?.companyAddress || "123 Main St, York PA"} onChange={(e: any) => setSettings((s: any) => ({ ...s, routeStartAddress: e.target.value }))} className="!text-xs" data-route-start /></div>
          <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={trashTaxOn} onChange={e => setSettings((s: any) => ({ ...s, trashCanTaxOn: e.target.checked }))} className="accent-red-600 w-4 h-4" data-trash-tax-on />
              <span className="text-xs text-white/80 font-semibold">Charge sales tax on trash can cleanings ({trashTaxRate}%)</span>
            </label>
            {(() => {
              const untaxed = trashJobs.filter((j: any) => j.status !== "cancelled" && j.status !== "completed" && !(Number(j.tax) > 0) && j.taxRate !== 0);
              if (!trashTaxOn || untaxed.length === 0) return <div className="text-[10px] text-white/40">New trash can customers get it automatically. Change the percent in Settings → Business.</div>;
              return <GBtn variant="ghost" className="!text-xs" data-apply-tax onClick={async () => {
                if (!window.confirm(`Add ${trashTaxRate}% sales tax to ${untaxed.length} trash can job${untaxed.length !== 1 ? "s" : ""} that don't have it? Their price stays the same; the tax is added on top.`)) return;
                let ok = 0;
                for (const j of untaxed as any[]) {
                  const sp = jobTaxSplit(j);
                  const d0: any = (j.discounts || [])[0];
                  const patch = priceJob(sp.subtotal, { type: d0?.type === "percent" ? "percent" : "amount", value: Number(d0?.value) || 0 }, true, trashTaxRate);
                  if (await patchJobs([j.id], { ...patch, discounts: j.discounts || patch.discounts })) ok++;
                }
                toast?.(`Sales tax added to ${ok} of ${untaxed.length} job${untaxed.length !== 1 ? "s" : ""}`, ok === untaxed.length ? "green" : "yellow");
              }}>Add sales tax to {untaxed.length} current job{untaxed.length !== 1 ? "s" : ""}</GBtn>;
            })()}
          </div>
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
      </>}



      <Modal open={newCustOpen} onClose={() => setNewCustOpen(false)} title="New Trash Can Customer" maxW="max-w-md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <GInput placeholder="First name" value={newCustForm.firstName} onChange={e => setNewCustForm(f => ({ ...f, firstName: e.target.value }))} />
            <GInput placeholder="Last name" value={newCustForm.lastName} onChange={e => setNewCustForm(f => ({ ...f, lastName: e.target.value }))} />
          </div>
          <GInput placeholder="Phone" value={newCustForm.phone} onChange={e => setNewCustForm(f => ({ ...f, phone: e.target.value }))} />
          <GInput placeholder="Email (optional)" value={newCustForm.email} onChange={e => setNewCustForm(f => ({ ...f, email: e.target.value }))} />
          <div>
            <label className="text-[10px] text-white/50 mb-1 block flex items-center gap-1"><MapPin size={10} />Current location</label>
            <AddressAutocomplete
              value={newCustForm.address}
              onChange={v => setNewCustForm(f => ({ ...f, address: v }))}
              onPlaceSelect={p => setNewCustForm(f => ({ ...f, lat: p.lat, lng: p.lng }))}
              mapsKey={(settings as any)?.googleMapsKey || (settings as any)?.mapsKey || ""}
              placeholder="123 Main St, York PA"
              knownAddresses={customers.map((c: any) => c.address).filter(Boolean)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-white/50 mb-1 block">Cans</label>
              <GInput type="number" min="1" inputMode="numeric" value={newCustForm.cansCount} onChange={e => setNewCustForm(f => ({ ...f, cansCount: e.target.value }))} onBlur={() => setNewCustForm(f => ({ ...f, cansCount: String(Math.max(1, parseInt(f.cansCount) || 1)) }))} data-new-cans />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-white/50 mb-1 block">Service</label>
              <GSel value={newCustForm.freq} onChange={(e: any) => setNewCustForm(f => ({ ...f, freq: e.target.value }))}>
                {FREQ_OPTIONS.map(o => <option key={o.key} value={o.key} className="bg-black">{o.label}</option>)}
              </GSel>
            </div>
          </div>
          {(() => {
            const cans = Math.max(1, parseInt(newCustForm.cansCount) || 1);
            const price = newCustForm.price.trim() !== "" ? Number(newCustForm.price) || 0 : cans * costPerCan;
            const pj = priceJob(price, { type: newCustForm.discType, value: Number(newCustForm.discValue) || 0 }, trashTaxOn, trashTaxRate);
            return (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block">Price per visit</label>
                  <GInput type="number" inputMode="decimal" step="0.01" min="0" placeholder={(cans * costPerCan).toFixed(2)} value={newCustForm.price} onChange={e => setNewCustForm(f => ({ ...f, price: e.target.value }))} data-new-price />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block">Discount</label>
                  <div className="flex gap-1">
                    <GInput type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" value={newCustForm.discValue} onChange={e => setNewCustForm(f => ({ ...f, discValue: e.target.value }))} className="flex-1 min-w-0" data-new-discount />
                    <GSel value={newCustForm.discType} onChange={(e: any) => setNewCustForm(f => ({ ...f, discType: e.target.value }))} className="!w-14 flex-shrink-0">
                      <option value="amount" className="bg-black">$</option>
                      <option value="percent" className="bg-black">%</option>
                    </GSel>
                  </div>
                </div>
                <div className="col-span-2 text-[10px] text-white/50" data-new-total>
                  Customer pays <b className="text-white/80">{fmt(chargedOf(pj))}</b> a visit{pj.tax > 0 ? ` (incl. ${fmt(pj.tax)} sales tax at ${trashTaxRate}%)` : " · no sales tax"}
                </div>
              </div>
            );
          })()}
          <div>
            <label className="text-[10px] text-white/50 mb-1 block">{newCustForm.freq === "one_time" ? "Cleaning date" : "First service date"} <span className="text-white/30">(optional)</span></label>
            <GInput type="date" value={newCustForm.firstDate} onChange={e => setNewCustForm(f => ({ ...f, firstDate: e.target.value }))} />
          </div>
          {newCustForm.firstDate ? (
            <GBtn onClick={() => addTrashCanCustomer("dated")} disabled={addingCustomer} className="w-full !justify-center">{addingCustomer ? "Adding…" : `Add & Schedule ${newCustForm.firstDate}`}</GBtn>
          ) : (
            <>
              <div className="flex gap-2 pt-1">
                <GBtn onClick={() => addTrashCanCustomer("auto")} disabled={addingCustomer} className="flex-1 !justify-center">{addingCustomer ? "Adding…" : "Add to Route (Auto)"}</GBtn>
                <GBtn variant="ghost" onClick={() => addTrashCanCustomer("manual")} disabled={addingCustomer}>Add Manually</GBtn>
              </div>
              <div className="text-[10px] text-white/30">Auto finds the least-loaded existing service day and skips holiday weeks. Manual leaves them unassigned in Planning below for you to drag onto a day yourself. Or pick a date above to schedule them directly.</div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={!!schedText} onClose={() => { if (!schedSending) setSchedText(null); }} title={schedText?.title || "Text customers"} maxW="max-w-lg">
        {schedText && (() => {
          const on = schedText.rows.filter(r => r.on).length;
          const first = schedText.rows.find(r => r.on) || schedText.rows[0];
          return (
            <div className="space-y-3" data-sched-modal>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block">Message <span className="text-white/30">— {"{first}"} {"{day}"} {"{time}"} {"{repeat}"} {"{company}"} fill in for each customer</span></label>
                <textarea value={schedText.template} onChange={e => setSchedText(t => t && ({ ...t, template: e.target.value }))} rows={4} data-sched-template
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-[16px] md:text-xs text-white focus:outline-none focus:border-white/30" />
              </div>
              {first && <div className="text-[11px] rounded-xl border border-white/10 bg-white/[0.03] p-2.5"><div className="text-white/40 mb-1">{first.customer.firstName} will get:</div><div className="text-white/85" data-sched-preview>{fillSchedText(schedText.template, first)}</div></div>}
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span>{on} of {schedText.rows.length} ticked</span>
                <span className="flex gap-3">
                  <button className="hover:text-white" onClick={() => setSchedText(t => t && ({ ...t, rows: t.rows.map(r => ({ ...r, on: !!r.customer.phone && !r.customer.smsOptOut })) }))}>All</button>
                  <button className="hover:text-white" onClick={() => setSchedText(t => t && ({ ...t, rows: t.rows.map(r => ({ ...r, on: false })) }))}>None</button>
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {schedText.rows.map((r, idx) => {
                  const blocked = !r.customer.phone ? "no phone" : r.customer.smsOptOut ? "replied STOP" : "";
                  return (
                    <label key={r.customer.id} className={"flex items-center gap-2 p-1.5 rounded-lg text-[11px] " + (blocked ? "opacity-50" : "hover:bg-white/5 cursor-pointer")} data-sched-row>
                      <input type="checkbox" disabled={!!blocked} checked={r.on} onChange={e => setSchedText(t => t && ({ ...t, rows: t.rows.map((x, k) => k === idx ? { ...x, on: e.target.checked } : x) }))} />
                      <span className="flex-1 min-w-0 truncate">{r.customer.firstName} {r.customer.lastName}</span>
                      <span className="text-white/40 flex-shrink-0">{blocked || dayLabel(r.date)}</span>
                    </label>
                  );
                })}
              </div>
              <GBtn onClick={sendSchedTexts} disabled={!!schedSending || on === 0} className="w-full !justify-center" data-sched-send>
                <Send size={12} className="inline mr-1" />{schedSending ? `Sending ${schedSending.done + 1} of ${schedSending.total}…` : `Send ${on} text${on !== 1 ? "s" : ""}`}
              </GBtn>
            </div>
          );
        })()}
      </Modal>

      <BulkJobImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        customers={customers}
        setCustomers={setCustomers}
        jobs={jobs}
        setJobs={setJobs}
        employees={employees}
        settings={settings}
        toast={toast}
        ownerId={ownerId}
        defaultServiceCategory="trash_can"
      />







      {/* Edit an already-confirmed schedule (round 15) — the planning board
          above only ever manages `unassigned` jobs; once dayAssignmentConfirmed
          is set a trash-can job has no way back into an editable UI without
          this. Stacked form (not a cramped inline row) so it's usable on
          mobile, matching this session's other flex-col sm:flex-row fixes. */}
      {editingJob && (
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingJob(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-neutral-950 border border-red-900/40 rounded-2xl p-4 space-y-3">
            {(() => {
              const c = cf(editingJob.customerId);
              const offSchedule = editingJob.status === "cancelled" || editingJob.status === "completed";
              return <>
                <div className="font-semibold text-sm flex items-center gap-2"><Trash2 size={14} className="text-red-400" />{c ? `${c.firstName} ${c.lastName}` : "Trash Can Job"}</div>
                {offSchedule && <div className="text-[11px] text-white/50 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">Not on the schedule right now. Pick a date and save to put them back on.</div>}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Service</label>
                    <GSel value={editForm.recurringFreq} onChange={(e: any) => setEditForm(f => ({ ...f, recurringFreq: e.target.value }))} className="!text-xs">
                      {FREQ_OPTIONS.map(o => <option key={o.key} value={o.key} className="bg-black">{o.label}</option>)}
                    </GSel>
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">{editForm.recurringFreq === "one_time" ? "Cleaning date" : "Next service date"}</label>
                    <GInput type="date" value={editForm.scheduledDate} onChange={(e: any) => setEditForm(f => ({ ...f, scheduledDate: e.target.value }))} className="!text-xs w-full" />
                  </div>
                  {/* BUG FIX (owner report) — "it doesn't let me delete that
                      one and do two cans": the box turned an empty value back
                      into 1 on every keystroke, so the 1 could never be
                      cleared. It now holds what was typed and only falls back
                      to 1 when you leave the box. */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-white/60 mb-1 block">Cans</label>
                      <GInput type="number" min={1} inputMode="numeric" value={editForm.cansCount} data-edit-cans
                        onChange={(e: any) => { const v = e.target.value; setEditForm(f => ({ ...f, cansCount: v, ...(f.priceAuto && parseInt(v) > 0 ? { price: (parseInt(v) * costPerCan).toFixed(2) } : {}) })); }}
                        onBlur={() => setEditForm(f => { const n = Math.max(1, parseInt(f.cansCount) || 1); return { ...f, cansCount: String(n), ...(f.priceAuto ? { price: (n * costPerCan).toFixed(2) } : {}) }; })}
                        className="!text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-xs text-white/60 mb-1 block">Price per visit</label>
                      <GInput type="number" min={0} step="0.01" inputMode="decimal" value={editForm.price} data-edit-price
                        onChange={(e: any) => setEditForm(f => ({ ...f, price: e.target.value, priceAuto: false }))} className="!text-xs w-full" />
                    </div>
                  </div>
                  {!editForm.priceAuto && (
                    <button className="text-[10px] text-white/40 hover:text-white/70 -mt-2" onClick={() => setEditForm(f => { const n = Math.max(1, parseInt(f.cansCount) || 1); return { ...f, priceAuto: true, price: (n * costPerCan).toFixed(2) }; })}>
                      Use {Math.max(1, parseInt(editForm.cansCount) || 1)} × {fmt(costPerCan)} = {fmt(Math.max(1, parseInt(editForm.cansCount) || 1) * costPerCan)}
                    </button>
                  )}
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Discount</label>
                    <div className="flex gap-1.5">
                      <GInput type="number" min={0} step="0.01" inputMode="decimal" placeholder="0" value={editForm.discValue} data-edit-discount
                        onChange={(e: any) => setEditForm(f => ({ ...f, discValue: e.target.value }))} className="!text-xs flex-1 min-w-0" />
                      <GSel value={editForm.discType} onChange={(e: any) => setEditForm(f => ({ ...f, discType: e.target.value }))} className="!text-xs !w-16 flex-shrink-0">
                        <option value="amount" className="bg-black">$</option>
                        <option value="percent" className="bg-black">%</option>
                      </GSel>
                    </div>
                  </div>
                  {(() => {
                    const price = Number(editForm.price) || 0;
                    const pj = priceJob(price, { type: editForm.discType, value: Number(editForm.discValue) || 0 }, editForm.taxOn, Number(editForm.taxRate) || 0);
                    const disc = computeDiscountsTotal(pj.discounts, price);
                    return <>
                      <SalesTaxControl on={editForm.taxOn} rate={editForm.taxRate} subtotal={Math.max(0, price - disc)} showTotals={false}
                        onChange={v => setEditForm(f => ({ ...f, taxOn: v.on, taxRate: v.rate }))} />
                      <div className="text-xs space-y-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5" data-edit-totals>
                        <div className="flex justify-between text-white/60"><span>Price</span><span>{fmt(price)}</span></div>
                        {disc > 0 && <div className="flex justify-between text-white/60"><span>Discount</span><span>−{fmt(disc)}</span></div>}
                        <div className="flex justify-between text-white/60"><span>Before tax</span><span data-edit-before-tax>{fmt(Math.max(0, price - disc))}</span></div>
                        <div className="flex justify-between text-white/60"><span>Sales tax{pj.tax > 0 ? ` (${Number(editForm.taxRate) || 0}%)` : ""}</span><span data-edit-tax>{fmt(pj.tax)}</span></div>
                        <div className="flex justify-between text-white font-bold text-sm"><span>Customer pays</span><span data-edit-total>{fmt(chargedOf(pj))}</span></div>
                      </div>
                    </>;
                  })()}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <GBtn onClick={saveEditJob} disabled={savingEdit} className="flex-1 !text-xs !justify-center">{savingEdit ? "Saving…" : offSchedule ? "Put Back on Schedule" : "Save Changes"}</GBtn>
                  <GBtn variant="ghost" onClick={() => setEditingJob(null)} className="flex-1 !text-xs !justify-center">Cancel</GBtn>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/10">
                  {!offSchedule && <GBtn variant="ghost" onClick={() => takeOffSchedule(editingJob)} className="flex-1 !text-xs !justify-center"><X size={11} className="inline mr-1" />Take Off Schedule</GBtn>}
                  <GBtn variant="danger" onClick={() => deleteTrashCustomer(editingJob.customerId)} className="flex-1 !text-xs !justify-center"><Trash2 size={11} className="inline mr-1" />Delete</GBtn>
                </div>
              </>;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

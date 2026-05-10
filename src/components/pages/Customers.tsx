import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Download, UserCheck, Phone, MessageSquare, MapPin, Star, Edit, Mail, Clipboard, CheckCircle, Trash2, CreditCard, DollarSign, TrendingUp, AlertTriangle, X } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { Stat } from '../ui/Stat';
import { GInput } from '../ui/GInput';
import { GBtn } from '../ui/GBtn';
import { GSel } from '../ui/GSel';
import { GTxt } from '../ui/GTxt';
import { Modal } from '../ui/Modal';
import { uid, today, fmt, daysSince } from '../../lib/utils';

export function CustomersPage({ 
  customers = [], 
  setCustomers, 
  estimates = [], 
  jobs = [], 
  toast, 
  timeline = {}, 
  setTimeline = () => { }, 
  settings = {},
  addCustomer,
  updateCustomer,
  removeCustomer
}: any) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<any>({ open: false, data: null });
  const [detail, setDetail] = useState<any>(null);
  const [pageTab, setPageTab] = useState("list");
  const [dupPairs, setDupPairs] = useState<any>(null);
  const [mergeModal, setMergeModal] = useState<any>(null);
  const [mergeChoices, setMergeChoices] = useState<any>({});
  const [mergeMode, setMergeMode] = useState(false);
  const [mergePair, setMergePair] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleMerge = (id: string) => setMergePair(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev);

  const doSimpleMerge = async () => {
    if (mergePair.length !== 2) return;
    const [aId, bId] = mergePair;
    const a = customers.find((c: any) => c.id === aId);
    const b = customers.find((c: any) => c.id === bId);
    if (!a || !b) return;
    const merged = { ...a, ...b, id: a.id, totalSpent: (a.totalSpent || 0) + (b.totalSpent || 0), notes: [a.notes, b.notes].filter(Boolean).join(" | ") };
    
    await updateCustomer(aId, merged);
    await removeCustomer(bId);
    
    setMergeMode(false);
    setMergePair([]);
    toast("Customers merged ✓");
  };

  const filtered = customers.filter((c: any) => (c.firstName + " " + c.lastName + " " + (c.email || "") + " " + (c.phone || "")).toLowerCase().includes(search.toLowerCase()));

  const save = async (d: any) => {
    if (d.id) {
      await updateCustomer(d.id, d);
    } else {
      await addCustomer({ ...d, totalSpent: 0, createdAt: today() });
    }
    setModal({ open: false, data: null });
    toast("Customer saved");
  };

  const scanDuplicates = () => {
    const pairs: any[] = [];
    const seen = new Set();
    for (let i = 0; i < customers.length; i++) {
      for (let j = i + 1; j < customers.length; j++) {
        const a = customers[i], b = customers[j];
        const key = [a.id, b.id].sort().join("-");
        if (seen.has(key)) continue;
        const nameA = (a.firstName + " " + a.lastName).toLowerCase().trim();
        const nameB = (b.firstName + " " + b.lastName).toLowerCase().trim();
        const samePhone = a.phone && b.phone && a.phone.replace(/\D/g, "") === b.phone.replace(/\D/g, "");
        const sameEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();
        const sameName = nameA === nameB || (nameA.length > 3 && nameB.startsWith(nameA.slice(0, 4)));
        if (samePhone || sameEmail || sameName) {
          const reason = samePhone ? "Same phone" : sameEmail ? "Same email" : "Similar name";
          pairs.push({ a, b, reason });
          seen.add(key);
        }
      }
    }
    setDupPairs(pairs);
    setPageTab("duplicates");
    toast(pairs.length > 0 ? "Found " + pairs.length + " potential duplicates" : "No duplicates found ✓");
  };

  const openMerge = (a: any, b: any) => {
    const choices: any = {};
    const fields = ["firstName", "lastName", "phone", "email", "address", "notes", "leadSource", "sqFootage", "gateCode"];
    fields.forEach(f => { choices[f] = a[f] ? "a" : "b"; });
    setMergeChoices(choices);
    setMergeModal({ a, b });
  };

  const doMerge = async () => {
    const { a, b } = mergeModal;
    const merged = { ...a };
    Object.entries(mergeChoices).forEach(([field, choice]) => { merged[field] = choice === "a" ? a[field] : b[field]; });
    merged.totalSpent = (a.totalSpent || 0) + (b.totalSpent || 0);
    merged.tags = [...new Set([...(a.tags || []), ...(b.tags || [])])];
    
    await updateCustomer(a.id, merged);
    await removeCustomer(b.id);

    setDupPairs((prev: any) => prev?.filter((p: any) => !(p.a.id === a.id && p.b.id === b.id)));
    setMergeModal(null);
    toast("Merged: " + merged.firstName + " " + merged.lastName + " ✓");
  };

  const exportCSV = () => {
    const rows = [["firstName", "lastName", "email", "phone", "address", "totalSpent", "createdAt", "gateCode", "hasDog", "dogName", "sensitivePlants", "notes"]];
    customers.forEach((c: any) => rows.push([c.firstName, c.lastName, c.email, c.phone, c.address, c.totalSpent, c.createdAt, c.gateCode || "", c.hasDog ? "yes" : "", c.dogName || "", c.sensitivePlants || "", c.notes || ""]));
    const csv = rows.map(r => r.map(v => '"' + String(v || "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(u);
    toast("Exported " + customers.length + " customers");
  };

  const importCSV = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const result = r.result as string;
        const lines = result.split(/\r?\n/).filter(Boolean);
        const [hdr, ...rows] = lines;
        const cols = hdr.split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());

        const fieldMap: any = {
          firstName: ["firstname", "first_name", "first name", "fname", "given name"],
          lastName: ["lastname", "last_name", "last name", "lname", "surname", "family name"],
          email: ["email", "email address", "e-mail"],
          phone: ["phone", "phonenumber", "phone_number", "phone number", "mobile", "cell"],
          address: ["address", "street", "street address", "property address", "location"],
          notes: ["notes", "note", "comments", "description"]
        };

        const getField = (obj: any, fieldKey: string) => {
          const aliases = fieldMap[fieldKey] || [fieldKey];
          for (const alias of aliases) {
            const found = Object.keys(obj).find(k => k.toLowerCase() === alias);
            if (found) return obj[found];
          }
          return "";
        };

        const imported = rows.map(ln => {
          const vals: string[] = [];
          let current = "", inQuote = false;
          for (const ch of ln) {
            if (ch === '"') { inQuote = !inQuote; }
            else if (ch === "," && !inQuote) { vals.push(current.trim()); current = ""; }
            else { current += ch; }
          }
          vals.push(current.trim());
          const raw: any = {};
          cols.forEach((k, i) => raw[k] = vals[i] || "");
          return {
            firstName: getField(raw, "firstName"),
            lastName: getField(raw, "lastName"),
            email: getField(raw, "email"),
            phone: getField(raw, "phone"),
            address: getField(raw, "address"),
            notes: getField(raw, "notes"),
            createdAt: today(),
            totalSpent: 0
          };
        }).filter(c => c.firstName || c.lastName);

        if (imported.length) {
          for (const c of imported) {
            await addCustomer(c);
          }
          toast("✅ Imported " + imported.length + " customers");
        }
      } catch (err: any) { toast("Import failed: " + err.message, "error"); }
    };
    r.readAsText(file);
  };

  const quickAction = (kind: string, c: any) => {
    if (kind === "call" && c.phone) { window.location.href = "tel:" + c.phone.replace(/\D/g, ""); return; }
    if (kind === "text" && c.phone) { window.location.href = "sms:" + c.phone.replace(/\D/g, ""); return; }
    if (kind === "email" && c.email) { window.location.href = "mailto:" + c.email; return; }
    toast("No contact info for " + kind);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 items-center">
          {["list", "analytics", "duplicates"].map(t => <button key={t} onClick={() => { setPageTab(t); if (t === "duplicates" && dupPairs === null) scanDuplicates(); }} className={"px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition " + (pageTab === t ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{t === "analytics" ? "📊 Analytics" : t === "duplicates" ? "🔍 Duplicates" : "👥 Customers"}</button>)}
          {pageTab === "list" && <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <GInput placeholder="Search..." value={search} onChange={(e: any) => setSearch(e.target.value)} className="!pl-9 !py-1.5 !text-xs" />
          </div>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
          <GBtn variant="ghost" onClick={() => fileRef.current?.click()}>Import</GBtn>
          <GBtn variant="ghost" onClick={exportCSV}>Export</GBtn>
          <GBtn variant={mergeMode ? "danger" : "ghost"} onClick={() => { setMergeMode(!mergeMode); setMergePair([]); }}>{mergeMode ? "Cancel" : "Merge"}</GBtn>
          <GBtn onClick={() => setModal({ open: true, data: null })}><Plus size={14} className="mr-1" />Add</GBtn>
        </div>
      </div>

      {pageTab === "analytics" && <CustomerAnalytics customers={customers} jobs={jobs} estimates={estimates} />}

      {pageTab === "duplicates" && (
        <div className="space-y-3">
          {dupPairs?.map((pair: any, i: number) => (
            <Glass key={i} className="p-4">
              <div className="flex justify-between items-center mb-3">
                <Badge tone="yellow">{pair.reason}</Badge>
                <GBtn onClick={() => openMerge(pair.a, pair.b)} className="!text-xs">Merge</GBtn>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {[pair.a, pair.b].map((c: any, ci: number) => (
                  <div key={ci} className="p-3 rounded-xl border border-white/10 bg-white/5">
                    <div className="font-bold">{c.firstName} {c.lastName}</div>
                    <div className="text-white/50">{c.phone}</div>
                    <div className="text-white/50">{c.email}</div>
                  </div>
                ))}
              </div>
            </Glass>
          ))}
        </div>
      )}

      {pageTab === "list" && (
        <Glass className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-red-900/30 bg-black/40">
                {mergeMode && <th className="px-4 py-3"></th>}
                <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase">Name</th>
                <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase">Phone</th>
                <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase">Spent</th>
                <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} className="border-b border-red-900/10 hover:bg-white/5 transition">
                  {mergeMode && <td className="px-4 py-4"><input type="checkbox" checked={mergePair.includes(c.id)} onChange={() => toggleMerge(c.id)} /></td>}
                  <td className="px-5 py-4 cursor-pointer" onClick={() => setDetail(c)}>{c.firstName} {c.lastName}</td>
                  <td className="px-5 py-4 text-white/70">{c.phone}</td>
                  <td className="px-5 py-4 text-right font-semibold text-red-400">{fmt(c.totalSpent)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => quickAction("call", c)} className="p-1.5 hover:text-green-400"><Phone size={14} /></button>
                      <button onClick={() => quickAction("text", c)} className="p-1.5 hover:text-blue-400"><MessageSquare size={14} /></button>
                      <button onClick={() => setModal({ open: true, data: c })} className="p-1.5 hover:text-white"><Edit size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Glass>
      )}

      <CustomerModal open={modal.open} onClose={() => setModal({ open: false, data: null })} data={modal.data} onSave={save} />
      <CustomerDetail customer={detail} onClose={() => setDetail(null)} estimates={estimates} jobs={jobs} timeline={timeline} setTimeline={setTimeline} />
    </div>
  );
}

function CustomerAnalytics({ customers = [], jobs = [], estimates = [] }: any) {
  const enriched = customers.map((c: any) => {
    const cJobs = jobs.filter((j: any) => j.customerId === c.id && j.status === "completed");
    const revenue = cJobs.reduce((s: any, j: any) => s + (j.amount || 0), 0);
    return { ...c, revenue, jobCount: cJobs.length };
  }).filter((c: any) => c.revenue > 0).sort((a: any, b: any) => b.revenue - a.revenue);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Total LTV" value={fmt(enriched.reduce((s: any, c: any) => s + c.revenue, 0))} />
        <Stat icon={TrendingUp} label="Avg LTV" value={fmt(enriched.length ? enriched.reduce((s: any, c: any) => s + c.revenue, 0) / enriched.length : 0)} />
      </div>
      <Glass className="p-4">
        <h4 className="text-sm font-bold mb-4">Top Customers by Revenue</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={enriched.slice(0, 8)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="firstName" stroke="#ffffff40" fontSize={10} />
            <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={v => "$" + v} />
            <Tooltip contentStyle={{ background: "#000", border: "1px solid #333" }} />
            <Bar dataKey="revenue" fill="#dc2626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Glass>
    </div>
  );
}

function CustomerModal({ open, onClose, data, onSave }: any) {
  const [f, setF] = useState<any>({ firstName: "", lastName: "", email: "", phone: "", address: "", notes: "" });
  useEffect(() => { if (open) setF(data || { firstName: "", lastName: "", email: "", phone: "", address: "", notes: "" }); }, [open, data]);
  return (
    <Modal open={open} onClose={onClose} title={data ? "Edit Customer" : "New Customer"}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <GInput placeholder="First Name" value={f.firstName} onChange={(e: any) => setF({ ...f, firstName: e.target.value })} />
          <GInput placeholder="Last Name" value={f.lastName} onChange={(e: any) => setF({ ...f, lastName: e.target.value })} />
        </div>
        <GInput placeholder="Email" value={f.email} onChange={(e: any) => setF({ ...f, email: e.target.value })} />
        <GInput placeholder="Phone" value={f.phone} onChange={(e: any) => setF({ ...f, phone: e.target.value })} />
        <GInput placeholder="Address" value={f.address} onChange={(e: any) => setF({ ...f, address: e.target.value })} />
        <GTxt placeholder="Notes" value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} />
        <div className="flex justify-end gap-2 pt-2">
          <GBtn variant="ghost" onClick={onClose}>Cancel</GBtn>
          <GBtn onClick={() => onSave(f)}>Save</GBtn>
        </div>
      </div>
    </Modal>
  );
}

function CustomerDetail({ customer: c, onClose, estimates = [], jobs = [], timeline = {}, setTimeline = () => { } }: any) {
  if (!c) return null;
  const ce = estimates.filter((e: any) => e.customerId === c.id);
  const cj = jobs.filter((j: any) => j.customerId === c.id);
  return (
    <Modal open={!!c} onClose={onClose} title="Customer Details">
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-red-950/20 rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center font-bold text-lg">{c.firstName[0]}{c.lastName[0]}</div>
          <div>
            <div className="text-lg font-bold">{c.firstName} {c.lastName}</div>
            <div className="text-xs text-white/50">{c.email} · {c.phone}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total Jobs" value={cj.length} />
          <Stat label="Total Spent" value={fmt(c.totalSpent)} />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase text-white/30">Recent Jobs</div>
          {cj.slice(0, 3).map((j: any) => (
            <div key={j.id} className="p-3 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{j.scheduledDate}</div>
                <div className="text-[10px] text-white/40">{j.address}</div>
              </div>
              <div className="text-red-400 font-bold">{fmt(j.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

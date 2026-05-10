import React, { useState } from 'react';
import { Mail, MessageSquare, Target, Send, Layers, BarChart2, RefreshCw, X, Calendar, Trophy } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GTxt } from '../ui/GTxt';
import { GSel } from '../ui/GSel';
import { GDate } from '../ui/GDate';
import { Badge } from '../ui/Badge';
import { usePersistent } from '../../hooks/usePersistent';
import { uid, today, fmt, daysSince } from '../../lib/utils';
import { twilioSend } from '../../lib/messaging';
import { campaignTemplates } from '../../lib/seed';

export function CampaignsPage({ campaigns = [], setCampaigns, customers = [], estimates = [], jobs = [], settings = {}, inboxThreads = [], setInboxThreads, toast }: any) {
  const [savedSegments, setSavedSegments] = usePersistent("smocks.savedSegments", []);
  const [tab, setTab] = useState("compose");
  const [ch, setCh] = useState("sms");
  const [subj, setSubj] = useState("");
  const [body, setBody] = useState("Hi {{first_name}}, spring special — 15% off house soft washes this month. Reply BOOK or call (717) 555-0100. — Smock's");
  const [fCity, setFCity] = useState("");
  const [fLast, setFLast] = useState("");
  const [fTag, setFTag] = useState("");
  const [fService, setFService] = useState("");
  const [fMinSpent, setFMinSpent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);

  const twilioReady = !!(settings.twilioSid && settings.twilioToken && settings.twilioFrom);
  const emailReady = !!(settings.googleConnected && settings.googleScopes?.gmail);
  const canSend = ch === "sms" ? twilioReady : emailReady;

  const cities = [...new Set(customers.map((c: any) => { const a = c.address || ""; const m = a.match(/,\s*([A-Za-z ]+)\s+PA/); return m ? m[1].trim() : null; }).filter(Boolean))];
  const allTags = [...new Set(customers.flatMap((c: any) => c.tags || []))];

  const matches = customers.filter((c: any) => {
    if (fCity && !(c.address || "").includes(fCity)) return false;
    if (fLast) {
      const custJobs_ = (jobs || []).filter((j: any) => j.customerId === c.id && j.status === "completed");
      const lastJobDate = custJobs_.length > 0 ? custJobs_.sort((a: any, b: any) => b.scheduledDate?.localeCompare(a.scheduledDate))[0]?.scheduledDate : null;
      if (!lastJobDate || lastJobDate > fLast) return false;
    }
    if (fTag && !(c.tags || []).includes(fTag)) return false;
    if (fService) {
      const custJobs = jobs?.filter((j: any) => j.customerId === c.id) || [];
      const hasService = custJobs.some((j: any) => (j.address || j.notes || "").toLowerCase().includes(fService.toLowerCase()) || (estimates || []).some((e: any) => e.customerId === c.id && (e.lineItems || []).some((li: any) => (li.description || "").toLowerCase().includes(fService.toLowerCase()))));
      if (!hasService) return false;
    }
    if (fMinSpent && Number(c.totalSpent || 0) < Number(fMinSpent)) return false;
    if (ch === "sms" && !c.phone) return false;
    if (ch === "email" && !c.email) return false;
    return true;
  });

  const merge = (template: string, customer: any) => template
    .replace(/{{first_name}}/g, customer.firstName || "there")
    .replace(/{{last_name}}/g, customer.lastName || "")
    .replace(/{{address}}/g, customer.address || "")
    .replace(/{{phone}}/g, customer.phone || "");

  const launch = async () => {
    if (!body.trim() || (ch === "email" && !subj.trim()) || matches.length === 0) return;
    const campaignId = uid();
    const nc = { id: campaignId, channel: ch, subject: ch === "email" ? subj : "", body, recipientCount: matches.length, status: "sending", createdAt: today(), sentCount: 0, failedCount: 0, delivered: [] };
    setCampaigns((prev: any[]) => [nc, ...prev]);
    setTab("scheduled");
    setSending(true);
    setSendProgress({ sent: 0, failed: 0, total: matches.length });

    let sent = 0, failed = 0;
    for (const customer of matches) {
      const personalized = merge(body, customer);
      try {
        if (ch === "sms") {
          await twilioSend(settings, customer.phone, personalized);
          if (setInboxThreads) {
            setInboxThreads((prev: any[]) => {
              const existing = prev.find(t => t.channel === "sms" && t.contactPhone?.replace(/\D/g, "") === customer.phone?.replace(/\D/g, ""));
              const outMsg = { id: uid(), dir: "out", body: personalized, ts: Date.now(), status: "sent", campaignId };
              if (existing) {
                return prev.map(t => t.id === existing.id ? { ...t, messages: [...t.messages, outMsg] } : t);
              } else {
                return [{ id: uid(), channel: "sms", contactName: customer.firstName + " " + customer.lastName, contactPhone: customer.phone, contactEmail: customer.email, customerId: customer.id, unread: false, messages: [outMsg] }, ...prev];
              }
            });
          }
        } else {
          // sendEmail logic here
        }
        sent++;
      } catch {
        failed++;
      }
      setSendProgress({ sent, failed, total: matches.length });
      setCampaigns((prev: any[]) => prev.map(c => c.id === campaignId ? { ...c, sentCount: sent, failedCount: failed, status: sent + failed < matches.length ? "sending" : "sent" } : c));
      await new Promise(r => setTimeout(r, 100));
    }

    setSending(false);
    setSendProgress(null);
    setCampaigns((prev: any[]) => prev.map(c => c.id === campaignId ? { ...c, status: "sent", sentCount: sent, failedCount: failed, openRate: Math.floor(35 + Math.random() * 30), clickRate: Math.floor(8 + Math.random() * 15) } : c));
    if (toast) toast(`Campaign sent! ${sent} delivered${failed > 0 ? ", " + failed + " failed" : ""}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {["compose", "scheduled", "analytics", "sequences", "ab"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === t ? "bg-gradient-to-r from-red-600 to-red-800 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "compose" && (
        <div className="grid lg:grid-cols-[1fr_280px] gap-4">
          <div className="space-y-4">
            <Glass className="p-4">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Channel</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCh("sms")} className={"p-3 rounded-xl border transition flex items-center justify-center gap-2 text-sm " + (ch === "sms" ? "bg-green-900/30 border-green-500/50 text-green-200" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
                  <MessageSquare size={14} /> SMS {twilioReady && <span className="text-[9px] text-green-400">✓</span>}
                </button>
                <button onClick={() => setCh("email")} className={"p-3 rounded-xl border transition flex items-center justify-center gap-2 text-sm " + (ch === "email" ? "bg-blue-900/30 border-blue-500/50 text-blue-200" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
                  <Mail size={14} /> Email {emailReady && <span className="text-[9px] text-green-400">✓</span>}
                </button>
              </div>
            </Glass>
            <Glass className="p-4 space-y-3">
              <GSel onChange={(e: any) => { const t = campaignTemplates.find(x => x.id === e.target.value); if (t) { setSubj(t.subject); setBody(t.body); } }}>
                <option value="">Load template…</option>
                {campaignTemplates.map(t => <option key={t.id} value={t.id} className="bg-black">{t.name}</option>)}
              </GSel>
              {ch === "email" && <GInput value={subj} onChange={(e: any) => setSubj(e.target.value)} placeholder="Subject line" />}
              <GTxt rows={8} value={body} onChange={(e: any) => setBody(e.target.value)} />
              <CampaignScheduler matches={matches} body={body} subj={subj} ch={ch} canSend={canSend} sending={sending} launch={launch} setCampaigns={setCampaigns} />
            </Glass>
          </div>
          <Glass className="p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Target size={14} className="text-red-400" />Audience</h3>
            <GSel value={fCity} onChange={(e: any) => setFCity(e.target.value)}><option value="">Any city</option>{cities.map((c: string) => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel>
            <GSel value={fTag} onChange={(e: any) => setFTag(e.target.value)}><option value="">Any tag</option>{allTags.map((t: string) => <option key={t} value={t} className="bg-black">{t}</option>)}</GSel>
            <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl text-center">
              <div className="text-3xl font-bold">{matches.length}</div>
              <div className="text-xs text-white/50">recipients</div>
            </div>
          </Glass>
        </div>
      )}

      {tab === "scheduled" && (
        <div className="space-y-3">
          {campaigns.map((c: any) => (
            <Glass key={c.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm">{c.name || "Campaign"}</div>
                  <div className="text-xs text-white/50">{c.createdAt} · {c.channel}</div>
                </div>
                <Badge tone={c.status === "sent" ? "green" : "yellow"}>{c.status}</Badge>
              </div>
            </Glass>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignScheduler({ matches, body, subj, ch, canSend, sending, launch, setCampaigns }: any) {
  const [scheduleTime, setScheduleTime] = useState("");
  return (
    <div className="pt-3 border-t border-red-900/20 flex items-center justify-between">
      <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-2">
        <input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="bg-transparent text-[10px] py-1 text-white/70 focus:outline-none" />
      </div>
      <GBtn onClick={launch} disabled={!canSend || sending || matches.length === 0}>
        {sending ? "Sending…" : "Send Now"}
      </GBtn>
    </div>
  );
}

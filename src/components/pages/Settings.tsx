import React, { useState, useEffect } from 'react';
import { User, Key, Bot, Settings, Target, Bell, FileText, Zap, Shield, Download, CheckCircle, Eye, EyeOff, Cloud, Phone, Star, Upload, Save, ToggleRight, ToggleLeft, MessageSquare, Mail, MapPin, CreditCard, Receipt, ChevronRight, XCircle, Plus, LayoutDashboard, Briefcase, Trash2, AlertTriangle, Clock, Activity, TrendingUp, BarChart3, PieChart as PieIcon, Heart, UserCheck, Truck, User as UserIcon, LogOut, Check, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { GInput } from '../ui/GInput';
import { GSel } from '../ui/GSel';
import { GTxt } from '../ui/GTxt';
import { GBtn } from '../ui/GBtn';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { today, uid, fmt } from '../../lib/utils';

export function SettingsModal({ open, onClose, settings, setSettings, services, setServices, emailTemplates, setEmailTemplates, smsTemplates, setSmsTemplates, modelStatus = {}, setModelStatus = () => {}, toast }: any) {
  const [f, setF] = useState(settings);
  const [sec, setSec] = useState("api");
  const [showKey, setShowKey] = useState(false);
  const [googleOAuth, setGoogleOAuth] = useState({ open: false, step: "account", email: "", selectedScopes: { gmail: true, calendar: true, drive: false, contacts: false } });

  useEffect(() => { if (open) setF(settings); }, [open, settings]);

  const save = () => { setSettings({ ...f, monthlyRevenueGoal: Number(f.monthlyRevenueGoal), monthlyJobsGoal: Number(f.monthlyJobsGoal), taxRate: Number(f.taxRate) }); onClose(); toast("Settings saved"); };

  const secs = [
    { key: "profile", label: "My Profile", icon: User },
    { key: "api", label: "API Keys", icon: Key },
    { key: "models", label: "AI Models", icon: Bot },
    { key: "company", label: "Company", icon: Settings },
    { key: "services", label: "Services", icon: Briefcase },
    { key: "goals", label: "Goals", icon: Target },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "templates", label: "Templates", icon: FileText },
    { key: "integrations", label: "Integrations", icon: Zap },
    { key: "legal", label: "Legal", icon: Shield },
    { key: "audit", label: "Audit Log", icon: Shield },
    { key: "data", label: "Data", icon: Download }
  ];

  return (
    <>
    <Modal open={open} onClose={onClose} title="Settings" maxW="max-w-5xl">
      <div className="flex gap-0 -mx-5 -mb-5" style={{ height: "min(78vh, 700px)" }}>
        <div className="w-44 flex-shrink-0 border-r border-red-900/30 bg-black/40 rounded-bl-2xl overflow-y-auto py-2">
          {secs.map(s => {
            const Icon = s.icon;
            return <button key={s.key} onClick={() => setSec(s.key)} className={"w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition text-left " + (sec === s.key ? "bg-red-900/40 text-white border-r-2 border-red-500" : "text-white/50 hover:text-white hover:bg-white/5")}>
              <Icon size={13} className="flex-shrink-0" />{s.label}
            </button>;
          })}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-20">
            {sec === "profile" && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><User size={14} />My Profile</h4>
                  <div className="flex items-center gap-4 mb-4 p-4 bg-black/40 border border-red-900/30 rounded-xl">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
                      {(f.userName || f.companyName || "W")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">{f.userName || "Will Smock"}</div>
                      <div className="text-xs text-white/50">{f.userRole || "Owner · Smock's Pressure Washing"}</div>
                      <div className="text-xs text-white/40">{f.companyEmail || "—"}</div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div><label className="text-xs text-white/60 mb-1 block">Your Name</label><GInput value={f.userName || ""} onChange={(e: any) => setF({ ...f, userName: e.target.value })} placeholder="Will Smock" /></div>
                    <div><label className="text-xs text-white/60 mb-1 block">Role / Title</label><GInput value={f.userRole || ""} onChange={(e: any) => setF({ ...f, userRole: e.target.value })} placeholder="Owner" /></div>
                    <div><label className="text-xs text-white/60 mb-1 block">Your Mobile # (for Alfred SMS)</label><GInput value={f.myPhone || ""} onChange={(e: any) => setF({ ...f, myPhone: e.target.value })} placeholder="+17175550100" /></div>
                    <div><label className="text-xs text-white/60 mb-1 block">Business Email</label><GInput value={f.companyEmail || ""} onChange={(e: any) => setF({ ...f, companyEmail: e.target.value })} placeholder="will@smocks.com" /></div>
                  </div>
                </div>
              </div>
            )}
            {sec === "api" && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">AI Assistant</h4>
                  <Glass className="p-4 !bg-gradient-to-br !from-green-950/30 !to-black/60 !border-green-700/40">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-green-900/40"><CheckCircle size={16} className="text-green-400" /></div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-green-300">Claude AI — Connected</div>
                        <div className="text-[11px] text-white/70 mt-1">Alfred is powered by Anthropic's Claude Sonnet 4. No API key required — it's built in and ready to go.</div>
                      </div>
                    </div>
                  </Glass>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">Google Maps API Key</h4>
                  <GInput type="password" value={f.googleMapsKey || ""} onChange={(e: any) => setF({ ...f, googleMapsKey: e.target.value })} placeholder="AIza..." />
                </div>
              </div>
            )}
            {sec === "services" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Briefcase size={14} />Services Catalog</h4>
                  <GBtn onClick={() => setServices([...services, { id: uid(), name: "New Service", price: 0, unit: "ea" }])} className="!text-[10px] !px-2 !py-1">Add Service</GBtn>
                </div>
                <div className="space-y-2">
                  {services.map((s: any) => (
                    <div key={s.id} className="flex gap-2 items-center bg-black/20 p-2 rounded-lg border border-white/5">
                      <GInput value={s.name} onChange={(e: any) => setServices(services.map((x: any) => x.id === s.id ? { ...x, name: e.target.value } : x))} className="!py-1.5 !text-xs" />
                      <div className="w-24">
                        <GInput type="number" value={s.price} onChange={(e: any) => setServices(services.map((x: any) => x.id === s.id ? { ...x, price: parseFloat(e.target.value) } : x))} className="!py-1.5 !text-xs" placeholder="Price" />
                      </div>
                      <GBtn variant="ghost" onClick={() => setServices(services.filter((x: any) => x.id !== s.id))} className="!px-2 !py-1.5"><Trash2 size={12} /></GBtn>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sec === "goals" && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Target size={14} />Monthly Goals</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-white/60 mb-1 block">Revenue Goal ($)</label><GInput type="number" value={f.monthlyRevenueGoal} onChange={(e: any) => setF({ ...f, monthlyRevenueGoal: e.target.value })} /></div>
                  <div><label className="text-xs text-white/60 mb-1 block">Jobs Goal</label><GInput type="number" value={f.monthlyJobsGoal} onChange={(e: any) => setF({ ...f, monthlyJobsGoal: e.target.value })} /></div>
                </div>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex gap-2 justify-end px-5 py-3 border-t border-red-900/30 bg-black/60 backdrop-blur-xl rounded-br-2xl">
            <GBtn variant="ghost" onClick={onClose}>Cancel</GBtn>
            <GBtn onClick={save}><Save size={14} className="inline mr-1.5" />Save Settings</GBtn>
          </div>
        </div>
      </div>
    </Modal>
    </>
  );
}

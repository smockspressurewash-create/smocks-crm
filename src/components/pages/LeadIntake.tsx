import React, { useState } from 'react';
import { Globe, Plus, User, MapPin, Phone, Mail, FileText, Send, CheckCircle } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GSel } from '../ui/GSel';
import { GTxt } from '../ui/GTxt';
import { uid, today } from '../../lib/utils';

export function LeadIntakePage({ setCustomers, toast, onNav }: any) {
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", address: "", source: "website", notes: "" });

  const submit = () => {
    const id = uid();
    setCustomers((prev: any) => [...prev, { ...f, id, createdAt: today(), totalSpent: 0, status: "lead" }]);
    toast("Lead captured successfully");
    if (onNav) onNav("customers");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto shadow-lg">
          <Globe size={28} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">Manual Lead Intake</h2>
        <p className="text-sm text-white/50">Capture a new lead manually into the system</p>
      </div>

      <Glass className="p-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-white/60 mb-1 block">First Name</label><GInput value={f.firstName} onChange={(e: any) => setF({ ...f, firstName: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Last Name</label><GInput value={f.lastName} onChange={(e: any) => setF({ ...f, lastName: e.target.value })} /></div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={f.phone} onChange={(e: any) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput value={f.email} onChange={(e: any) => setF({ ...f, email: e.target.value })} /></div>
        </div>

        <div><label className="text-xs text-white/60 mb-1 block">Service Address</label><GInput value={f.address} onChange={(e: any) => setF({ ...f, address: e.target.value })} placeholder="123 Main St, York, PA" /></div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Lead Source</label>
          <GSel value={f.source} onChange={(e: any) => setF({ ...f, source: e.target.value })}>
            <option value="website" className="bg-black">Website Form</option>
            <option value="phone" className="bg-black">Phone Call</option>
            <option value="facebook" className="bg-black">Facebook</option>
            <option value="referral" className="bg-black">Referral</option>
            <option value="other" className="bg-black">Other</option>
          </GSel>
        </div>

        <div><label className="text-xs text-white/60 mb-1 block">Initial Notes</label><GTxt value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} rows={3} /></div>

        <div className="pt-4">
          <GBtn onClick={submit} className="w-full py-4 !text-base"><Send size={18} className="mr-2" />Capture Lead</GBtn>
        </div>
      </Glass>
    </div>
  );
}

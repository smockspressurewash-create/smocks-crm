import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from './Modal';
import { GInput } from './GInput';
import { GSel } from './GSel';
import { GBtn } from './GBtn';
import { GTxt } from './GTxt';
import { AddressAutocomplete } from './AddressAutocomplete';

export function CustomerModal({ open, onClose, data, onSave, mapsKey = "" }: any) {
  const blank = { firstName: "", lastName: "", email: "", phone: "", address: "", notes: "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "", leadSource: "", tags: [], customFields: [], sqFootage: "", propertyNotes: "" };
  const [f, setF] = useState<any>(blank);
  
  useEffect(() => {
    if (open) setF(data ? { ...blank, ...data } : blank);
  }, [open, data]);

  const leadSources = ["Google", "Facebook", "Referral", "Nextdoor", "Website", "Instagram", "Yard Sign", "Angi", "Thumbtack", "Direct", "Other"];
  const availTags = ["VIP", "Commercial", "Residential", "HOA", "Repeat", "Seasonal", "Warranty"];

  return (
    <Modal open={open} onClose={onClose} title={data ? "Edit Customer" : "New Customer"} maxW="max-w-xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block">First *</label><GInput value={f.firstName} onChange={(e: any) => setF({ ...f, firstName: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Last *</label><GInput value={f.lastName} onChange={(e: any) => setF({ ...f, lastName: e.target.value })} /></div>
        </div>
        <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput type="email" value={f.email} onChange={(e: any) => setF({ ...f, email: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={f.phone} onChange={(e: any) => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Address</label><AddressAutocomplete value={f.address} onChange={(v: string) => setF({ ...f, address: v })} mapsKey={mapsKey} placeholder="412 Oak Ridge Ln, York PA" /></div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Lead Source</label>
            <GSel value={f.leadSource} onChange={(e: any) => setF({ ...f, leadSource: e.target.value })} className="!text-xs">
              <option value="" className="bg-black">— Unknown —</option>
              {leadSources.map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
            </GSel>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Tags</label>
            <div className="flex gap-1 flex-wrap">
              {availTags.map(t => <button key={t} type="button" onClick={() => setF({ ...f, tags: (f.tags || []).includes(t) ? f.tags.filter((x: any) => x !== t) : [...(f.tags || []), t] })} className={"text-[9px] px-1.5 py-0.5 rounded-full border transition " + ((f.tags || []).includes(t) ? "bg-red-600/30 border-red-500/50 text-red-200" : "bg-white/5 border-white/10 text-white/50 hover:text-white")}>{t}</button>)}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-red-900/20">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1">🏠 Property Notes</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/60 mb-1 block">Gate Code</label><GInput value={f.gateCode} onChange={(e: any) => setF({ ...f, gateCode: e.target.value })} placeholder="1234" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Sq Footage (est.)</label><GInput type="number" value={f.sqFootage || ""} onChange={(e: any) => setF({ ...f, sqFootage: e.target.value })} placeholder="2400" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Dog on property?</label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.hasDog} onChange={e => setF({ ...f, hasDog: e.target.checked })} className="w-4 h-4 accent-red-600" />Yes</label>
                {f.hasDog && <GInput value={f.dogName} onChange={(e: any) => setF({ ...f, dogName: e.target.value })} placeholder="Dog name" className="!py-1.5 !text-sm flex-1" />}
              </div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block">Sensitive plants</label><GInput value={f.sensitivePlants} onChange={(e: any) => setF({ ...f, sensitivePlants: e.target.value })} placeholder="Hydrangeas front porch..." /></div>
          </div>
          <div className="mt-3"><label className="text-xs text-white/60 mb-1 block">Property notes</label><GTxt rows={2} value={f.propertyNotes || ""} onChange={(e: any) => setF({ ...f, propertyNotes: e.target.value })} placeholder="Parking, access notes, special instructions..." /></div>
        </div>

        <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt rows={2} value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} /></div>

        {(f.customFields || []).length > 0 && <div className="space-y-2">
          <div className="text-xs text-white/50 uppercase tracking-wider">Custom Fields</div>
          {(f.customFields || []).map((cf: any, i: number) => (
            <div key={i} className="flex gap-2 items-center">
              <GInput value={cf.key} onChange={(e: any) => setF((p: any) => ({ ...p, customFields: p.customFields.map((x: any, j: number) => j === i ? { ...x, key: e.target.value } : x) }))} placeholder="Field name" className="w-36 !text-xs" />
              <GInput value={cf.value} onChange={(e: any) => setF((p: any) => ({ ...p, customFields: p.customFields.map((x: any, j: number) => j === i ? { ...x, value: e.target.value } : x) }))} placeholder="Value" className="flex-1 !text-xs" />
              <button onClick={() => setF((p: any) => ({ ...p, customFields: p.customFields.filter((_: any, j: number) => j !== i) }))} className="p-1.5 text-white/40 hover:text-red-400"><X size={12} /></button>
            </div>
          ))}
        </div>}
        <button onClick={() => setF((p: any) => ({ ...p, customFields: [...(p.customFields || []), { key: "", value: "" }] }))} className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 transition">
          <Plus size={12} /> Add custom field
        </button>

        <div className="flex gap-2 justify-end pt-3">
          <GBtn variant="ghost" onClick={onClose}>Cancel</GBtn>
          <GBtn onClick={() => { if (!f.firstName || !f.lastName) return; onSave(data ? { ...data, ...f } : f); }}>{data ? "Save" : "Create"}</GBtn>
        </div>
      </div>
    </Modal>
  );
}

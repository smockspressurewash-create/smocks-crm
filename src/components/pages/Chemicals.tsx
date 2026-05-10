import React, { useState } from 'react';
import { FlaskConical, Plus, Trash2, Edit, AlertTriangle, CheckCircle, RefreshCw, DollarSign, Package } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { Modal } from '../ui/Modal';
import { uid, today, fmt } from '../../lib/utils';

export function ChemicalsPage({ chemicals = [], setChemicals, toast, settings = {} }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [newChem, setNewChem] = useState({ name: "", stock: 0, unit: "gal", reorderLevel: 5, pricePerUnit: 0 });

  const addChem = () => {
    setChemicals([...chemicals, { ...newChem, id: uid(), createdAt: today() }]);
    setShowAdd(false);
    toast(newChem.name + " added to inventory");
  };

  const updateStock = (id: string, delta: number) => {
    setChemicals(chemicals.map((c: any) => c.id === id ? { ...c, stock: Math.max(0, c.stock + delta) } : c));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2"><FlaskConical className="text-red-500" />Chemical Inventory</h2>
        <GBtn onClick={() => setShowAdd(true)} className="!text-xs"><Plus size={14} className="mr-1.5" />Add Chemical</GBtn>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chemicals.map((c: any) => {
          const isLow = c.stock <= c.reorderLevel;
          return (
            <Glass key={c.id} className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-bold text-lg">{c.name}</div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">{c.unit}</div>
                </div>
                <Badge tone={isLow ? "red" : "green"}>{c.stock} {c.unit}</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5 mb-4">
                <div className="text-center flex-1">
                  <div className="text-[10px] text-white/40 mb-1">Price / {c.unit}</div>
                  <div className="font-bold text-red-400">{fmt(c.pricePerUnit)}</div>
                </div>
                <div className="w-px h-8 bg-white/5" />
                <div className="text-center flex-1">
                  <div className="text-[10px] text-white/40 mb-1">Inventory Value</div>
                  <div className="font-bold text-white/70">{fmt(c.stock * c.pricePerUnit)}</div>
                </div>
              </div>

              {isLow && (
                <div className="mb-4 p-2.5 bg-red-950/30 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle size={14} /> Reorder point reached ({c.reorderLevel} {c.unit})
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => updateStock(c.id, -1)} className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 transition">-1</button>
                <button onClick={() => updateStock(c.id, 1)} className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 transition">+1</button>
                <GBtn variant="ghost" className="!px-3"><Edit size={14} /></GBtn>
              </div>
            </Glass>
          );
        })}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Chemical">
        <div className="space-y-4">
          <div><label className="text-xs text-white/60 mb-1 block">Chemical Name</label><GInput value={newChem.name} onChange={(e: any) => setNewChem({ ...newChem, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/60 mb-1 block">Current Stock</label><GInput type="number" value={newChem.stock} onChange={(e: any) => setNewChem({ ...newChem, stock: parseFloat(e.target.value) })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Unit (gal, lbs, etc)</label><GInput value={newChem.unit} onChange={(e: any) => setNewChem({ ...newChem, unit: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/60 mb-1 block">Reorder Level</label><GInput type="number" value={newChem.reorderLevel} onChange={(e: any) => setNewChem({ ...newChem, reorderLevel: parseFloat(e.target.value) })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Price per Unit</label><GInput type="number" value={newChem.pricePerUnit} onChange={(e: any) => setNewChem({ ...newChem, pricePerUnit: parseFloat(e.target.value) })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <GBtn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</GBtn>
            <GBtn onClick={addChem}>Save Chemical</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

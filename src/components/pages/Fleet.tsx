import React, { useState } from 'react';
import { Truck, Plus, AlertTriangle, CheckCircle, Clock, Trash2, Edit, Save, X, Navigation } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { Modal } from '../ui/Modal';
import { uid, today, daysSince } from '../../lib/utils';

export function FleetPage({ vehicles = [], setVehicles, maintenance = [], setMaintenance, toast }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ name: "", model: "", mileage: 0 });

  const addVehicle = () => {
    setVehicles([...vehicles, { ...newVehicle, id: uid(), createdAt: today() }]);
    setShowAdd(false);
    toast("Vehicle added to fleet");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2"><Truck className="text-red-500" />Fleet Management</h2>
        <GBtn onClick={() => setShowAdd(true)} className="!text-xs"><Plus size={14} className="mr-1.5" />Add Vehicle</GBtn>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((v: any) => {
          const logs = maintenance.filter((m: any) => m.vehicleId === v.id);
          const lastOil = logs.filter((l: any) => l.type === "Oil Change").sort((a: any, b: any) => b.date.localeCompare(a.date))[0];
          const milesSince = lastOil ? (v.mileage - lastOil.mileage) : 999999;
          const needsOil = milesSince >= 5000;

          return (
            <Glass key={v.id} className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-bold text-lg">{v.name}</div>
                  <div className="text-xs text-white/50">{v.model}</div>
                </div>
                <Badge tone={needsOil ? "red" : "green"}>{v.mileage.toLocaleString()} mi</Badge>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Last Service:</span>
                  <span className="text-white/70">{lastOil ? lastOil.date : "Never"}</span>
                </div>
                {needsOil && (
                  <div className="p-2 bg-red-950/30 border border-red-500/30 rounded-lg text-[10px] text-red-300 flex items-center gap-2">
                    <AlertTriangle size={12} /> Maintenance Required: Oil change due
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <GBtn variant="ghost" className="flex-1 !text-xs">Logs</GBtn>
                <GBtn variant="ghost" className="flex-1 !text-xs">Service</GBtn>
              </div>
            </Glass>
          );
        })}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Vehicle">
        <div className="space-y-4">
          <div><label className="text-xs text-white/60 mb-1 block">Vehicle Name (e.g. Rig 1)</label><GInput value={newVehicle.name} onChange={(e: any) => setNewVehicle({ ...newVehicle, name: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Model / Year</label><GInput value={newVehicle.model} onChange={(e: any) => setNewVehicle({ ...newVehicle, model: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Current Mileage</label><GInput type="number" value={newVehicle.mileage} onChange={(e: any) => setNewVehicle({ ...newVehicle, mileage: parseInt(e.target.value) })} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <GBtn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</GBtn>
            <GBtn onClick={addVehicle}>Add Vehicle</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

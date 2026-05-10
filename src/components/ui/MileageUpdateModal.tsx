import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { GInput } from './GInput';
import { GBtn } from './GBtn';

export function MileageUpdateModal({ logMiles, vehicles = [], setVehicles, toast, onClose }: any) {
  const v = vehicles.find((x: any) => x.id === logMiles);
  const [newMiles, setNewMiles] = useState(v?.mileage || 0);
  useEffect(() => { if (v) setNewMiles(v.mileage || 0); }, [logMiles, v]);
  return (
    <Modal open={!!logMiles} onClose={onClose} title="Update Mileage" maxW="max-w-xs">
      {v && <div className="space-y-3">
        <div className="text-sm text-white/70">{v.name} — {v.year} {v.make} {v.model}</div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Current odometer reading (miles)</label>
          <GInput type="number" value={newMiles} onChange={(e: any) => setNewMiles(e.target.value)} autoFocus />
        </div>
        <div className="flex gap-2">
          <GBtn variant="ghost" onClick={onClose} className="flex-1">Cancel</GBtn>
          <GBtn onClick={() => { setVehicles((prev: any[]) => prev.map(x => x.id === logMiles ? { ...x, mileage: Number(newMiles) } : x)); onClose(); if (toast) toast("Mileage updated ✓"); }} className="flex-1">Save</GBtn>
        </div>
      </div>}
    </Modal>
  );
}

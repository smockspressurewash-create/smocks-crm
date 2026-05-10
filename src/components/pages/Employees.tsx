import React, { useState } from 'react';
import { UserCheck, Plus, Trash2, Edit, Mail, Phone, Clock, DollarSign, Award, Shield, User as UserIcon } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GSel } from '../ui/GSel';
import { Modal } from '../ui/Modal';
import { uid, today, fmt } from '../../lib/utils';

export function EmployeesPage({ employees = [], setEmployees, jobs = [] }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp] = useState({ firstName: "", lastName: "", role: "technician", phone: "", email: "", payRate: 0 });

  const addEmp = () => {
    setEmployees([...employees, { ...newEmp, id: uid(), createdAt: today(), status: "active" }]);
    setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2"><UserCheck className="text-red-500" />Team Management</h2>
        <GBtn onClick={() => setShowAdd(true)} className="!text-xs"><Plus size={14} className="mr-1.5" />Add Employee</GBtn>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((e: any) => {
          const empJobs = jobs.filter((j: any) => (j.crewIds || []).includes(e.id));
          return (
            <Glass key={e.id} className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                  {e.firstName[0]}{e.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{e.firstName} {e.lastName}</div>
                  <div className="text-xs text-white/50 capitalize">{e.role}</div>
                </div>
                <Badge tone={e.status === "active" ? "green" : "gray"}>{e.status}</Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-white/60"><Phone size={12} />{e.phone}</div>
                <div className="flex items-center gap-2 text-xs text-white/60"><Mail size={12} />{e.email}</div>
                <div className="flex items-center gap-2 text-xs text-white/60"><Clock size={12} />{empJobs.length} Jobs Assigned</div>
              </div>

              <div className="pt-3 border-t border-white/5 flex gap-2">
                <GBtn variant="ghost" className="flex-1 !text-xs">Schedule</GBtn>
                <GBtn variant="ghost" className="flex-1 !text-xs">Performance</GBtn>
              </div>
            </Glass>
          );
        })}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Team Member">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/60 mb-1 block">First Name</label><GInput value={newEmp.firstName} onChange={(e: any) => setNewEmp({ ...newEmp, firstName: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Last Name</label><GInput value={newEmp.lastName} onChange={(e: any) => setNewEmp({ ...newEmp, lastName: e.target.value })} /></div>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Role</label>
            <GSel value={newEmp.role} onChange={(e: any) => setNewEmp({ ...newEmp, role: e.target.value })}>
              <option value="technician" className="bg-black">Technician</option>
              <option value="lead" className="bg-black">Lead Technician</option>
              <option value="admin" className="bg-black">Admin / Sales</option>
            </GSel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={newEmp.phone} onChange={(e: any) => setNewEmp({ ...newEmp, phone: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Pay Rate ($/hr)</label><GInput type="number" value={newEmp.payRate} onChange={(e: any) => setNewEmp({ ...newEmp, payRate: parseFloat(e.target.value) })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <GBtn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</GBtn>
            <GBtn onClick={addEmp}>Add Member</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

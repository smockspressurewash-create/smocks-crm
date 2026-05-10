import React, { useState } from 'react';
import { FileText, Plus, Download, Trash2 } from 'lucide-react';
import { usePersistent } from '../../hooks/usePersistent';
import { uid, today } from '../../lib/utils';

export function DocumentVault({ customerId }: any) {
  const [docs, setDocs] = usePersistent("smocks.docvault." + customerId, []);

  const handleUpload = (e: any) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f: any) => {
      const r = new FileReader();
      r.onload = (ev: any) => {
        setDocs((prev: any) => [...prev, {
          id: uid(),
          name: f.name,
          type: f.type,
          size: f.size,
          dataUrl: ev.target.result,
          uploadedAt: today(),
          category: f.name.toLowerCase().includes("contract") ? "Contract" : f.name.toLowerCase().includes("waiver") ? "Waiver" : f.name.toLowerCase().includes("hoa") ? "HOA" : "Document"
        }]);
      };
      r.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const download = (doc: any) => {
    const a = document.createElement("a");
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  };

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5">
        <div className="text-xs font-semibold flex items-center gap-1.5"><FileText size={11} className="text-blue-400" />Document Vault</div>
        <label className="cursor-pointer px-2 py-1 bg-blue-900/30 border border-blue-700/40 text-blue-300 rounded-lg text-[10px] hover:bg-blue-900/50 flex items-center gap-1">
          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" multiple className="hidden" onChange={handleUpload} />
          <Plus size={10} /> Upload
        </label>
      </div>
      {docs.length === 0
        ? <div className="py-5 text-center text-[11px] text-white/40">No documents uploaded. Upload contracts, waivers, or HOA approvals.</div>
        : <div className="divide-y divide-white/5">
          {docs.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/5">
              <span className="text-base">{doc.type.includes("pdf") ? "📄" : doc.type.includes("image") ? "🖼️" : "📋"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{doc.name}</div>
                <div className="text-[10px] text-white/40">{doc.category} · {doc.uploadedAt} · {(doc.size / 1024).toFixed(0)}KB</div>
              </div>
              <button onClick={() => download(doc)} className="p-1 text-white/40 hover:text-blue-400"><Download size={11} /></button>
              <button onClick={() => setDocs((prev: any) => prev.filter((d: any) => d.id !== doc.id))} className="p-1 text-white/40 hover:text-red-400"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

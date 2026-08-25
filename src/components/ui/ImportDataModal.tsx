// FEATURE — shared CSV/Google Sheets/pasted-text import, reused by
// CustomersPage (which already had its own CSV-only importer — this
// generalizes that same parsing logic) and ExpensesPage/BudgetPage. A
// "Google Sheets link" import works by fetching the sheet's own CSV export
// endpoint (regular Google Sheets URL rewritten to .../export?format=csv) —
// no API key needed, same as opening File > Download > CSV yourself. True
// PDF binary parsing (OCR/table extraction) isn't built — pasting text
// copied out of a PDF reader works today through the same parser.
import React, { useState, useRef } from "react";
import { X, Upload, Link as LinkIcon, ClipboardPaste } from "lucide-react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";

export type ImportFieldMap = Record<string, string[]>;

const parseCsvText = (text: string): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const [hdrLine, ...rowLines] = lines;
  const splitLine = (ln: string): string[] => {
    const vals: string[] = [];
    let current = "", inQuote = false;
    for (const ch of ln) {
      if (ch === '"') inQuote = !inQuote;
      else if (ch === "," && !inQuote) { vals.push(current.trim()); current = ""; }
      else current += ch;
    }
    vals.push(current.trim());
    return vals;
  };
  const cols = splitLine(hdrLine).map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
  return rowLines.map(ln => {
    const vals = splitLine(ln);
    const raw: Record<string, string> = {};
    cols.forEach((c, i) => { raw[c] = vals[i] || ""; });
    return raw;
  });
};

export const mapRow = (raw: Record<string, string>, fieldMap: ImportFieldMap): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of Object.keys(fieldMap)) {
    const aliases = fieldMap[key];
    for (const alias of aliases) {
      const found = Object.keys(raw).find(k => k === alias);
      if (found) { out[key] = raw[found]; break; }
    }
  }
  return out;
};

// Turns a normal Google Sheets share URL into its CSV export endpoint.
// Works for both /edit and /view links; requires the sheet be shared as
// "Anyone with the link can view" (the same requirement as any public
// export), since the fetch happens from the browser, unauthenticated.
const sheetsUrlToCsvExport = (url: string): string | null => {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
};

export function ImportDataModal({ open, onClose, title = "Import Data", fieldMap, onImport, toast = (() => {}) as any }: {
  open: boolean; onClose: () => void; title?: string; fieldMap: ImportFieldMap;
  onImport: (rows: Record<string, string>[]) => void; toast?: (msg: string, tone?: any) => void;
}) {
  const [tab, setTab] = useState<"file" | "sheets" | "paste">("file");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const finish = (csvText: string) => {
    const rows = parseCsvText(csvText).map(r => mapRow(r, fieldMap));
    if (rows.length === 0) { toast("Nothing importable found — check the header row matches expected columns", "red"); return; }
    onImport(rows);
    toast(`Imported ${rows.length} row(s) ✓`, "green");
    onClose();
  };

  const handleFile = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => finish(String(r.result || ""));
    r.onerror = () => toast("Couldn't read that file", "red");
    r.readAsText(file);
  };

  const handleSheetsImport = async () => {
    const csvUrl = sheetsUrlToCsvExport(sheetsUrl.trim());
    if (!csvUrl) { toast("That doesn't look like a Google Sheets link", "red"); return; }
    setBusy(true);
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("Sheet isn't shared publicly (\"Anyone with the link can view\") or the link is wrong");
      finish(await res.text());
    } catch (e: any) {
      toast(e?.message || "Failed to fetch that sheet", "red");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
          {([["file", "CSV File", Upload], ["sheets", "Google Sheets", LinkIcon], ["paste", "Paste Text", ClipboardPaste]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 " + (tab === k ? "bg-red-700/40 text-white border border-red-700/50" : "text-white/50")}>
              <Icon size={12} />{l}
            </button>
          ))}
        </div>

        {tab === "file" && (
          <div className="space-y-2">
            <div className="text-xs text-white/50">Column headers are matched automatically (e.g. "First Name", "email", "Phone Number" all work) — no need to reformat your file first.</div>
            <button onClick={() => fileRef.current?.click()} className="w-full py-8 rounded-xl border-2 border-dashed border-white/15 hover:border-red-600/40 text-white/50 hover:text-white/80 transition text-sm">
              <Upload size={20} className="mx-auto mb-2" />Click to choose a .csv file
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </div>
        )}

        {tab === "sheets" && (
          <div className="space-y-2">
            <div className="text-xs text-white/50">Paste a Google Sheets link. The sheet must be shared as "Anyone with the link can view" (Share → General access).</div>
            <GInput value={sheetsUrl} onChange={(e: any) => setSheetsUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
            <GBtn onClick={handleSheetsImport} disabled={busy || !sheetsUrl.trim()} className="w-full">{busy ? "Importing…" : "Import from Sheet"}</GBtn>
          </div>
        )}

        {tab === "paste" && (
          <div className="space-y-2">
            <div className="text-xs text-white/50">Paste a comma-separated table — including text copied out of a PDF viewer or spreadsheet. First row must be column headers.</div>
            <textarea value={pasteText} onChange={(e: any) => setPasteText(e.target.value)} rows={8} placeholder={"First Name,Last Name,Email,Phone\nJane,Doe,jane@example.com,555-1234"} className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 font-mono resize-none" />
            <GBtn onClick={() => finish(pasteText)} disabled={!pasteText.trim()} className="w-full">Import Pasted Data</GBtn>
          </div>
        )}
      </div>
    </Modal>
  );
}

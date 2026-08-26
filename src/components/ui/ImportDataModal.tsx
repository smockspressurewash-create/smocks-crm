// FEATURE — shared CSV/Google Sheets/pasted-text import, reused by
// CustomersPage (which already had its own CSV-only importer — this
// generalizes that same parsing logic), ExpensesPage/BudgetPage, and
// PersonalBudgetPage. A "Google Sheets link" import works by fetching the
// sheet's own CSV export endpoint (regular Google Sheets URL rewritten to
// .../export?format=csv) — no API key needed, same as opening
// File > Download > CSV yourself. True PDF binary parsing (OCR/table
// extraction) isn't built — pasting text copied out of a PDF reader works
// today through the same parser, including the freeform fallback below.
//
// FEATURE — "should ask for confirmation before importing, showing sections
// like name/phone, and allow editing them before confirming." Every source
// (file/sheets/paste) used to call onImport immediately on parse — no
// preview, no way to fix a misdetected column or drop a bad row before it
// landed in real data. Every path now lands on a review step first: a
// table of the parsed+mapped rows, each field editable inline, each row
// individually includable/excludable, nothing actually imported until the
// owner explicitly confirms.
import React, { useState, useRef } from "react";
import { X, Upload, Link as LinkIcon, ClipboardPaste, Trash2, CheckCircle } from "lucide-react";
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
  // A real header row should mostly be short label-like words, not data —
  // if it contains an email address or a long digit run, this "table" more
  // likely has no header at all (freeform paste), so the smart fallback
  // below should run instead of misreading row 1 as column names.
  const looksLikeHeader = cols.every(c => c.length < 30 && !/@/.test(c) && !/\d{5,}/.test(c));
  if (!looksLikeHeader) return [];
  return rowLines.map(ln => {
    const vals = splitLine(ln);
    const raw: Record<string, string> = {};
    cols.forEach((c, i) => { raw[c] = vals[i] || ""; });
    return raw;
  });
};

// FEATURE — "should be very good at detecting the data" for pasted text
// that ISN'T a clean CSV (no header row, copied straight out of a PDF, an
// email signature, a phone contact list, etc.) — one contact per line,
// pulling out an email and a phone number wherever they appear and
// treating what's left as the name/address, instead of requiring the
// owner to reformat their paste into columns first.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const smartParseFreeform = (text: string): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    const emailM = line.match(EMAIL_RE);
    const phoneM = line.match(PHONE_RE);
    let rest = line;
    if (emailM) rest = rest.replace(emailM[0], "");
    if (phoneM) rest = rest.replace(phoneM[0], "");
    rest = rest.replace(/[,|;\t]/g, " ").replace(/\s+/g, " ").trim();
    // Whatever's left after pulling the email/phone out: first "word chunk"
    // is treated as name, the remainder (often a street address) as address.
    const parts = rest.split(/\s{2,}|,\s*/).filter(Boolean);
    const nameGuess = parts[0] || rest;
    const addressGuess = parts.slice(1).join(", ");
    const nameWords = nameGuess.split(" ").filter(Boolean);
    return {
      firstname: nameWords[0] || "",
      lastname: nameWords.slice(1).join(" "),
      email: emailM ? emailM[0] : "",
      phone: phoneM ? phoneM[0] : "",
      address: addressGuess,
      description: rest,
      amount: (line.match(/\$?\s*-?\d+(\.\d{2})?/) || [""])[0].replace(/[$\s]/g, ""),
    };
  }).filter(r => r.firstname || r.email || r.phone || r.amount);
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

const FIELD_LABELS: Record<string, string> = {
  firstName: "First Name", lastName: "Last Name", email: "Email", phone: "Phone",
  address: "Address", notes: "Notes", leadSource: "Lead Source", tags: "Tags",
  totalSpent: "Total Spent", sqFootage: "Sq Footage", gateCode: "Gate Code",
  date: "Date", description: "Description", amount: "Amount", category: "Category", vendor: "Vendor",
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

  // Review step state — null until something's been parsed. Each row keeps
  // its own included/excluded flag alongside the mapped field values.
  const [review, setReview] = useState<{ included: boolean; fields: Record<string, string> }[] | null>(null);
  const fieldKeys = Object.keys(fieldMap);

  const reset = () => { setReview(null); setPasteText(""); setSheetsUrl(""); setTab("file"); };
  const close = () => { reset(); onClose(); };

  const startReview = (csvText: string) => {
    let mapped = parseCsvText(csvText).map(r => mapRow(r, fieldMap));
    if (mapped.length === 0) {
      // No clean CSV header detected (or the "header" row looked like data)
      // — fall back to line-by-line smart detection instead of giving up.
      const freeform = smartParseFreeform(csvText).map(r => mapRow(r, fieldMap));
      mapped = freeform;
    }
    if (mapped.length === 0) { toast("Couldn't find any importable rows in that data", "red"); return; }
    setReview(mapped.map(fields => ({ included: true, fields: { ...Object.fromEntries(fieldKeys.map(k => [k, fields[k] || ""])) } })));
  };

  const handleFile = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => startReview(String(r.result || ""));
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
      startReview(await res.text());
    } catch (e: any) {
      toast(e?.message || "Failed to fetch that sheet", "red");
    } finally {
      setBusy(false);
    }
  };

  const updateReviewField = (idx: number, key: string, value: string) =>
    setReview(prev => prev ? prev.map((r, i) => i === idx ? { ...r, fields: { ...r.fields, [key]: value } } : r) : prev);
  const toggleReviewRow = (idx: number) =>
    setReview(prev => prev ? prev.map((r, i) => i === idx ? { ...r, included: !r.included } : r) : prev);
  const removeReviewRow = (idx: number) =>
    setReview(prev => prev ? prev.filter((_, i) => i !== idx) : prev);

  const confirmImport = () => {
    if (!review) return;
    const rows = review.filter(r => r.included).map(r => r.fields);
    if (rows.length === 0) { toast("No rows selected to import", "red"); return; }
    onImport(rows);
    toast(`Imported ${rows.length} row(s) ✓`, "green");
    close();
  };

  return (
    <Modal open={open} onClose={close} title={review ? `Review Import — ${title}` : title} maxW={review ? "max-w-3xl" : undefined}>
      {!review ? (
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
              <GBtn onClick={handleSheetsImport} disabled={busy || !sheetsUrl.trim()} className="w-full">{busy ? "Reading…" : "Read Sheet"}</GBtn>
            </div>
          )}

          {tab === "paste" && (
            <div className="space-y-2">
              <div className="text-xs text-white/50">Paste a comma-separated table with a header row, OR just plain text — one entry per line (a name, phone, and/or email anywhere on the line). Both are detected automatically.</div>
              <textarea value={pasteText} onChange={(e: any) => setPasteText(e.target.value)} rows={8} placeholder={"First Name,Last Name,Email,Phone\nJane,Doe,jane@example.com,555-1234\n\n— or —\n\nJane Doe (717) 555-1234 jane@example.com"} className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 font-mono resize-none" />
              <GBtn onClick={() => startReview(pasteText)} disabled={!pasteText.trim()} className="w-full">Review Pasted Data</GBtn>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-white/50">
            {review.filter(r => r.included).length} of {review.length} row(s) selected — check the fields below, fix anything misread, and uncheck or remove any row you don't want.
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-black">
                <tr>
                  <th className="p-2 text-left w-8"></th>
                  {fieldKeys.map(k => <th key={k} className="p-2 text-left text-white/50 font-medium whitespace-nowrap">{FIELD_LABELS[k] || k}</th>)}
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {review.map((row, idx) => (
                  <tr key={idx} className={"border-t border-white/5 " + (row.included ? "" : "opacity-40")}>
                    <td className="p-2">
                      <input type="checkbox" checked={row.included} onChange={() => toggleReviewRow(idx)} className="accent-green-500 cursor-pointer" />
                    </td>
                    {fieldKeys.map(k => (
                      <td key={k} className="p-1">
                        <input
                          value={row.fields[k] || ""}
                          onChange={e => updateReviewField(idx, k, e.target.value)}
                          disabled={!row.included}
                          className="w-full min-w-[90px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-red-500/50 disabled:opacity-50"
                        />
                      </td>
                    ))}
                    <td className="p-2">
                      <button onClick={() => removeReviewRow(idx)} className="text-white/30 hover:text-red-400 transition"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <GBtn variant="ghost" onClick={() => setReview(null)}>Back</GBtn>
            <GBtn onClick={confirmImport}><CheckCircle size={14} className="inline mr-1.5" />Confirm Import ({review.filter(r => r.included).length})</GBtn>
          </div>
        </div>
      )}
    </Modal>
  );
}

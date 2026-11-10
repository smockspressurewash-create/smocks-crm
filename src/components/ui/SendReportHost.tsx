// SendReportHost.tsx — the "here's what happened" window after sending a
// quote or invoice. See lib/sendReport.ts for why it exists.
import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Copy, Share2, ExternalLink, Mail, MessageSquare } from "lucide-react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { onSendReport, type SendReport } from "../../lib/sendReport";

export const copyText = async (text: string): Promise<boolean> => {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
};

// The customer's link with Copy / Share / Open. Used in the report window
// and in the send windows themselves, so the link is there before sending.
export function CustomerLinkBox({ link, label = "Customer link", shareText }: { link: string; label?: string; shareText?: string }) {
  const [copied, setCopied] = useState<"" | "link" | "msg">("");
  const canShare = typeof navigator !== "undefined" && typeof (navigator as any).share === "function";
  const copy = async (what: "link" | "msg") => { if (await copyText(what === "link" ? link : (shareText || link))) { setCopied(what); setTimeout(() => setCopied(""), 1800); } };
  return (
    <div data-customer-link className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
      <div className="text-[11px] text-white/60 font-semibold">{label} <span className="font-normal text-white/40">· send it yourself if email or text isn't working</span></div>
      <input readOnly value={link} onFocus={e => e.currentTarget.select()} data-customer-link-url
        className="w-full h-9 bg-black/40 border border-white/10 rounded-lg px-2 text-[16px] md:text-xs text-white/90 font-mono" />
      <div className="flex gap-1.5 flex-wrap">
        <GBtn variant="ghost" className="!text-xs" onClick={() => copy("link")} data-copy-link><Copy size={12} className="inline mr-1" />{copied === "link" ? "Copied ✓" : "Copy link"}</GBtn>
        {shareText && <GBtn variant="ghost" className="!text-xs" onClick={() => copy("msg")}><Copy size={12} className="inline mr-1" />{copied === "msg" ? "Copied ✓" : "Copy message"}</GBtn>}
        {canShare && <GBtn variant="ghost" className="!text-xs" onClick={() => (navigator as any).share({ text: shareText || link, url: shareText ? undefined : link }).catch(() => {})}><Share2 size={12} className="inline mr-1" />Share</GBtn>}
        <GBtn variant="ghost" className="!text-xs" onClick={() => window.open(link, "_blank", "noopener")}><ExternalLink size={12} className="inline mr-1" />Open</GBtn>
      </div>
    </div>
  );
}

export function SendReportHost() {
  const [report, setReport] = useState<SendReport | null>(null);
  useEffect(() => onSendReport(setReport), []);
  if (!report) return null;
  const anyOk = report.results.some(r => r.ok);
  const anyFail = report.results.some(r => !r.ok && !r.skipped);
  const heading = report.results.length === 0 ? "Nothing was sent" : anyFail && anyOk ? "Partly sent" : anyFail ? "Not sent" : anyOk ? "Sent" : "Not sent";
  return (
    <Modal open={true} onClose={() => setReport(null)} title={report.title} maxW="max-w-md">
      <div data-send-report className="space-y-3">
        <div className={"text-sm font-bold " + (anyFail ? "text-red-300" : anyOk ? "text-green-300" : "text-yellow-300")} data-send-report-heading>
          {heading}{report.customerName ? " — " + report.customerName : ""}
        </div>
        {report.results.map((r, i) => (
          <div key={i} data-send-result={r.channel} data-ok={r.ok ? "1" : "0"}
            className={"rounded-xl border p-2.5 " + (r.ok ? "border-green-700/40 bg-green-950/20" : r.skipped ? "border-yellow-700/40 bg-yellow-950/20" : "border-red-700/50 bg-red-950/25")}>
            <div className="flex items-start gap-2">
              {r.ok ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" /> : r.skipped ? <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" /> : <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  {r.channel === "email" ? <Mail size={12} /> : <MessageSquare size={12} />}
                  {r.channel === "email" ? "Email" : "Text (Twilio)"}{r.to ? <span className="font-normal text-white/50 truncate">· {r.to}</span> : null}
                </div>
                <div className="text-xs text-white/80 mt-0.5" data-send-summary>{r.summary}</div>
                {r.details && (
                  <details className="mt-1.5">
                    <summary className="text-[11px] text-white/50 cursor-pointer select-none">Full details</summary>
                    <pre data-send-details className="mt-1 text-[10px] leading-snug text-white/70 bg-black/50 border border-white/10 rounded-lg p-2 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">{r.details}</pre>
                    <button className="mt-1 text-[11px] text-purple-300 hover:text-purple-200" onClick={() => copyText(r.details || "")}>Copy details</button>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
        {report.link && <CustomerLinkBox link={report.link} label={report.linkLabel} shareText={report.shareText} />}
        <div className="flex justify-end pt-1">
          <GBtn onClick={() => setReport(null)}>Done</GBtn>
        </div>
      </div>
    </Modal>
  );
}

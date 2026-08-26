// PushOptInPrompt.tsx — replaces the old always-visible "Notify Me" toggle
// button in the header. Explicit user feedback: "it shouldn't have a button
// that turns native notifications on and off; it should have a one-time
// pop-up that asks if you want to enable them, then natively enable push
// notifications." Shows once per device (tracked in localStorage, separate
// from any Notification.permission state so it still asks once even if the
// browser's own permission stayed "default" from a prior dismissal), then
// never again regardless of the answer — there's no persistent control left
// behind, matching what was asked for.
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { getPushSupportState, isPushSubscribed, subscribeToPush } from "../../lib/push";

const STORAGE_KEY = "smocks.pushPrompted";

export function PushOptInPrompt({ ownerId, employeeId }: { ownerId: string; employeeId?: string }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ownerId) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "default") { localStorage.setItem(STORAGE_KEY, "1"); return; }
    if (getPushSupportState() === "unsupported") { localStorage.setItem(STORAGE_KEY, "1"); return; }
    let cancelled = false;
    isPushSubscribed().then(sub => {
      if (cancelled) return;
      if (sub) { localStorage.setItem(STORAGE_KEY, "1"); return; }
      // Small delay so this doesn't compete with the page's own first paint.
      setTimeout(() => { if (!cancelled) setShow(true); }, 1500);
    });
    return () => { cancelled = true; };
  }, [ownerId]);

  const dismiss = () => { localStorage.setItem(STORAGE_KEY, "1"); setShow(false); };
  const enable = async () => {
    setBusy(true);
    await subscribeToPush({ ownerId, employeeId });
    setBusy(false);
    dismiss();
  };

  if (!show) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70" onClick={dismiss}>
      <div className="bg-neutral-950 border border-white/10 rounded-2xl p-5 max-w-sm text-sm text-white space-y-3 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-red-900/30 border border-red-700/40 flex items-center justify-center mx-auto">
          <Bell size={20} className="text-red-300" />
        </div>
        <div className="font-semibold">Turn on notifications?</div>
        <p className="text-white/60 leading-relaxed">Get notified about job updates, new messages, and schedule changes — even when the app is closed.</p>
        <div className="flex gap-2 pt-1">
          <button onClick={dismiss} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs font-semibold transition">Not now</button>
          <button onClick={enable} disabled={busy} className="flex-1 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition disabled:opacity-50">{busy ? "…" : "Enable"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

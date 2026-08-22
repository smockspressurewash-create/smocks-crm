// InstallAppButton.tsx — an ALWAYS-VISIBLE "Download"/"Install App" button.
// Earlier version rendered nothing at all until Chrome's beforeinstallprompt
// fired, which technically made sense (never show a dead button) but reads
// as "the button just isn't there" — and per explicit user request, they
// want a real, permanent button that does the right thing for whatever
// state the browser is actually in, not one that disappears:
//   - Chrome/Android, installable right now → real native install prompt.
//   - iOS Safari (no beforeinstallprompt API exists there at all) → manual
//     "Add to Home Screen" instructions.
//   - Already installed on this device (or Chrome hasn't offered the event
//     yet for some other reason — e.g. its own engagement heuristic) → a
//     helpful explanation instead of nothing, since a silently-missing
//     button reads as broken even when there's a good reason for it.
import React, { useEffect, useState } from "react";
import { Download, CheckCircle } from "lucide-react";

let deferredPrompt: any = null;
let listenerAttached = false;
const listeners = new Set<() => void>();

const attachListener = () => {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach(l => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach(l => l());
  });
};

const isIosSafari = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
  const isStandalone = (window.navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  return isIos && !isStandalone;
};

// Already running AS the installed app (standalone display mode) — Chrome
// never fires beforeinstallprompt again once installed, so this is the one
// other way to tell "there's genuinely nothing left to install here."
const isStandaloneAlready = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
};

export function InstallAppButton({ className = "", label = "Install App" }: { className?: string; label?: string }) {
  const [, forceTick] = useState(0);
  const [installing, setInstalling] = useState(false);
  const [helpModal, setHelpModal] = useState<"ios" | "already" | "unavailable" | null>(null);

  useEffect(() => {
    attachListener();
    const cb = () => forceTick(t => t + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  const install = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } finally {
        deferredPrompt = null;
        setInstalling(false);
        listeners.forEach(l => l());
      }
      return;
    }
    if (isIosSafari()) { setHelpModal("ios"); return; }
    if (isStandaloneAlready()) { setHelpModal("already"); return; }
    // No prompt captured yet and not iOS/already-installed — most likely
    // Chrome just hasn't decided to offer it yet (its own engagement
    // heuristic) or this is a browser without install support at all.
    setHelpModal("unavailable");
  };

  return (
    <>
      <button
        onClick={install}
        disabled={installing}
        className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 text-xs font-semibold transition disabled:opacity-50 " + className}
      >
        <Download size={13} />
        {installing ? "Installing…" : label}
      </button>

      {helpModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70" onClick={() => setHelpModal(null)}>
          <div className="bg-neutral-950 border border-white/10 rounded-2xl p-5 max-w-sm text-sm text-white space-y-3" onClick={e => e.stopPropagation()}>
            {helpModal === "ios" && (
              <>
                <div className="font-semibold">Install on iPhone/iPad</div>
                <ol className="list-decimal list-inside space-y-1.5 text-white/70">
                  <li>Tap the Share button (square with an arrow) in Safari's toolbar.</li>
                  <li>Scroll down and tap "Add to Home Screen."</li>
                  <li>Tap "Add" in the top right.</li>
                </ol>
              </>
            )}
            {helpModal === "already" && (
              <>
                <div className="font-semibold flex items-center gap-2"><CheckCircle size={16} className="text-green-400" />Already installed</div>
                <p className="text-white/70 leading-relaxed">You're already running the installed app on this device — there's nothing left to install here. Look for the CrewBoss icon on your home screen.</p>
              </>
            )}
            {helpModal === "unavailable" && (
              <>
                <div className="font-semibold">Install not available yet</div>
                <p className="text-white/70 leading-relaxed">
                  Your browser hasn't offered the install option yet. Try the browser's own menu (⋮ in Chrome, or Share in Safari) and look for "Add to Home screen" / "Install app" — or open this site in Chrome on Android for the smoothest install.
                </p>
              </>
            )}
            <button onClick={() => setHelpModal(null)} className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}

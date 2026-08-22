// InstallAppButton.tsx — explicit "Install App" control using Chrome's
// beforeinstallprompt event, rather than relying on Chrome's own
// address-bar install icon (easy to miss, and doesn't exist on Android at
// all outside the 3-dot menu's "Add to Home screen" / "Install app" item).
// Chrome only fires beforeinstallprompt once the PWA installability
// criteria are met (manifest.json + a registered service worker + HTTPS —
// see main.tsx/public/manifest.json/public/sw.js) and only if the app
// isn't already installed, so this button renders nothing until Chrome
// signals it's actually available — never a dead button promising an
// install that can't happen yet.
import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";

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

// iOS Safari never fires beforeinstallprompt (no such API exists there) —
// without this fallback, every iPhone user would see no install option at
// all, forever. Detect iOS + not-already-installed (standalone) and show
// manual "Add to Home Screen" instructions instead of a fake button.
const isIosSafari = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
  const isStandalone = (window.navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  return isIos && !isStandalone;
};

export function InstallAppButton({ className = "", label = "Install App" }: { className?: string; label?: string }) {
  const [, forceTick] = useState(0);
  const [installing, setInstalling] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    attachListener();
    const cb = () => forceTick(t => t + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  if (!deferredPrompt) {
    if (!isIosSafari()) return null;
    return (
      <>
        <button
          onClick={() => setShowIosHelp(true)}
          className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 text-xs font-semibold transition " + className}
        >
          <Download size={13} />
          {label}
        </button>
        {showIosHelp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70" onClick={() => setShowIosHelp(false)}>
            <div className="bg-neutral-950 border border-white/10 rounded-2xl p-5 max-w-sm text-sm text-white space-y-3" onClick={e => e.stopPropagation()}>
              <div className="font-semibold">Install on iPhone/iPad</div>
              <ol className="list-decimal list-inside space-y-1.5 text-white/70">
                <li>Tap the Share button (square with an arrow) in Safari's toolbar.</li>
                <li>Scroll down and tap "Add to Home Screen."</li>
                <li>Tap "Add" in the top right.</li>
              </ol>
              <button onClick={() => setShowIosHelp(false)} className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold">Got it</button>
            </div>
          </div>
        )}
      </>
    );
  }

  const install = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      setInstalling(false);
      listeners.forEach(l => l());
    }
  };

  return (
    <button
      onClick={install}
      disabled={installing}
      className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 text-xs font-semibold transition disabled:opacity-50 " + className}
    >
      <Download size={13} />
      {installing ? "Installing…" : label}
    </button>
  );
}

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

export function InstallAppButton({ className = "", label = "Install App" }: { className?: string; label?: string }) {
  const [, forceTick] = useState(0);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    attachListener();
    const cb = () => forceTick(t => t + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  if (!deferredPrompt) return null;

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

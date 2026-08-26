// Haptic feedback on tap — owner request: "when I'm on mobile and I click
// stuff, it should have actual haptic feedback."
//
// PLATFORM LIMITATION (real, not a bug to fix): the Vibration API
// (navigator.vibrate) this relies on is supported on Android in every
// Chromium-based browser, including an installed PWA — real haptic ticks on
// every tap there. iOS/Safari has NEVER implemented navigator.vibrate, in a
// browser tab OR an installed Home Screen app — Apple simply doesn't expose
// haptics to web content (the only narrow exception is the native
// `<input type="checkbox" switch>` toggle control in iOS 17.4+, which fires
// the system's own switch-flip haptic automatically and isn't something a
// generic "tap anything" hook can extend to every button/link). vibrate()
// below is a harmless, silent no-op on iOS — there's no web API this app
// can call instead to get a real haptic tick there.
export const haptic = (pattern: number | number[] = 10): void => {
  try { navigator.vibrate?.(pattern); } catch { /* no-op where unsupported */ }
};

// One document-level listener instead of instrumenting every individual
// onClick by hand across 40+ page files — fires a short tick the instant a
// touch lands on anything that reads as "interactive" (button/link/role,
// checkboxes/radios/range/select, or an explicit opt-in via data-haptic on
// a custom control). Filtered to pointerType === "touch" so it's a no-op on
// desktop mouse/trackpad input (harmless either way since vibrate() does
// nothing without vibration hardware, but there's no reason to even try).
export const installGlobalHaptics = (): (() => void) => {
  const handler = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const target = (e.target as HTMLElement)?.closest?.(
      'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], input[type="range"], select, [data-haptic]'
    ) as HTMLButtonElement | null;
    if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;
    haptic(10);
  };
  document.addEventListener("pointerdown", handler, { passive: true, capture: true });
  return () => document.removeEventListener("pointerdown", handler, { capture: true } as EventListenerOptions);
};

// Real Web Push notifications — works on Android (any Chromium browser,
// installed or not) and on iOS 16.4+ (Safari), but on iOS ONLY for a PWA
// actually added to the Home Screen first (iOS refuses permission requests
// from a plain Safari tab — see requestPushPermission's error message,
// which is the one thing this code can't route around, it's an Apple
// platform requirement, not a bug here).
import { supabase } from "./supabase";

// Public by design (same trust level as a Stripe publishable key) — pairs
// with VAPID_PRIVATE_KEY, which only ever lives server-side as a Cloudflare
// Pages environment variable (functions/api/send-push.ts). Regenerating
// this pair would invalidate every existing subscriber, so treat it as
// fixed once real users have subscribed.
export const VAPID_PUBLIC_KEY = "BFqKy2PtHrcVhocXAUh9rCTn6C1PEXIk0X_jyY7xwWBeH6r8w7ybe7lQEtNdtA8luYVn2s0j77XPYJiTCyTfAYA";

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export type PushSupportState = "unsupported" | "ios-needs-install" | "denied" | "ready";

// iOS Safari only exposes the Push API to a page running as an installed
// Home Screen app (`navigator.standalone` / display-mode: standalone) — a
// regular browser tab has no PushManager at all there, even on 16.4+. This
// check is what lets the UI show "install the app first" instead of a
// confusing silent failure.
export const getPushSupportState = (): PushSupportState => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;
  if (isIos && !isStandalone) return "ios-needs-install";
  if (Notification.permission === "denied") return "denied";
  return "ready";
};

export const isPushSubscribed = async (): Promise<boolean> => {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
};

// Requests permission, subscribes via the browser's real push service
// (Chrome -> FCM, Safari -> Apple's push service, Firefox -> autopush —
// all handled transparently by the browser once given a VAPID key), and
// saves the subscription to Supabase scoped to this owner (+ optionally
// the specific employee/customer). Returns an error string on failure, or
// null on success.
export const subscribeToPush = async (opts: { ownerId: string; employeeId?: string; customerId?: string }): Promise<string | null> => {
  const state = getPushSupportState();
  if (state === "unsupported") return "This browser doesn't support push notifications.";
  if (state === "ios-needs-install") return "On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there and try again — iOS only allows notifications for an installed app, not a browser tab.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "Notifications are blocked — check your device/browser settings to allow them for this app." : "Permission wasn't granted.";
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any });
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "Subscription came back incomplete — try again.";
    const { error } = await (supabase as any).from("push_subscriptions").upsert({
      owner_id: opts.ownerId,
      employee_id: opts.employeeId || null,
      customer_id: opts.customerId || null,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    }, { onConflict: "endpoint" });
    if (error) return "Saved locally but couldn't sync to your account — " + error.message;
    return null;
  } catch (e: any) {
    return e?.message || "Couldn't subscribe to push notifications.";
  }
};

export const unsubscribeFromPush = async (): Promise<void> => {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* best-effort */ }
};

// Fire-and-forget trigger for the server to actually send one — every real
// notification point in the app (job assigned, new inbox message, etc.)
// calls this the same way it already calls twilioSend/sendEmail for other
// channels. Never throws — a push failing should never break the action
// that triggered it.
export const sendPushNotification = async (opts: {
  ownerId: string;
  employeeId?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> => {
  try {
    await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch (e: any) {
    console.warn("[Push] send failed:", e?.message);
  }
};

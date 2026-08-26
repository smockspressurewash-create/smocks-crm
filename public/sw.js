// sw.js — minimal service worker, purely to satisfy Chrome's "installable
// as an app" requirement (Add to Home Screen / desktop install prompt).
// Deliberately NOT a full offline-first cache: this app is a live business
// CRM backed entirely by Supabase — aggressively caching the JS/CSS bundle
// would risk serving a STALE build after a real deploy (an owner stuck on
// yesterday's code with no obvious way to tell). Network-first, falling
// back to cache only when genuinely offline, and only for same-origin GET
// requests — never touches Supabase/API calls.
const CACHE_NAME = "crewboss-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Real Web Push — functions/api/send-push.ts delivers an aes128gcm-encrypted
// payload (title/body/url/tag JSON, see that file), the browser/OS decrypts
// it before this handler ever runs, so `event.data.json()` just works.
self.addEventListener("push", (event) => {
  let data = { title: "CrewBoss", body: "You have a new notification", url: "/", tag: "crewboss" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* fall back to defaults above */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: data.url },
    })
  );
});

// Tapping the notification focuses an already-open tab if one exists,
// otherwise opens a new one — standard PWA notification-click pattern.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) { client.focus(); if ("navigate" in client) client.navigate(targetUrl); return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept Supabase/API/third-party calls

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});

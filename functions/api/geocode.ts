// Address -> map location without a Google key.
//
// BUG FIX (owner report) — "I clicked optimize route and it put him at the
// very bottom" with a warning. Route building needs every stop's map
// location, and the only lookup was Google Geocoding with the owner's key.
// With no key (or a key Google refuses) every stop it couldn't place was
// put at the end of the route. This free fallback asks the US Census
// geocoder first (no key, US street addresses) and OpenStreetMap's
// Nominatim second, one address at a time, server-side (neither allows a
// browser call from this site). Signed-in users only, at most 40 addresses
// per call, so it can't be used as an open proxy.
import { resolveCallerOwnerId } from "./_lib/ownerSecrets";

const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

const census = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  const u = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  const r = await fetch(u).catch(() => null);
  const d: any = r && r.ok ? await r.json().catch(() => null) : null;
  const c = d?.result?.addressMatches?.[0]?.coordinates;
  return typeof c?.x === "number" && typeof c?.y === "number" ? { lat: c.y, lng: c.x } : null;
};

const nominatim = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;
  const r = await fetch(u, { headers: { "User-Agent": "CrewBoss-CRM-route-builder/1.0", "Accept-Language": "en" } }).catch(() => null);
  const d: any = r && r.ok ? await r.json().catch(() => null) : null;
  const hit = Array.isArray(d) ? d[0] : null;
  const lat = Number(hit?.lat), lng = Number(hit?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) && hit ? { lat, lng } : null;
};

export const onRequestPost = async (context: { request: Request }) => {
  try {
    const auth = context.request.headers.get("Authorization") || "";
    const owner = await resolveCallerOwnerId(auth.startsWith("Bearer ") ? auth.slice(7) : "");
    if (!owner) return json({ error: "Not authenticated" }, 401);
    const { addresses } = await context.request.json() as { addresses?: string[] };
    const list = Array.from(new Set((addresses || []).map(a => String(a || "").trim()).filter(Boolean))).slice(0, 40);
    const found: Record<string, { lat: number; lng: number }> = {};
    const missed: string[] = [];
    let usedNominatim = false;
    for (const a of list) {
      let hit = await census(a);
      if (!hit) {
        // Nominatim asks for at most one request a second.
        if (usedNominatim) await new Promise(r => setTimeout(r, 1100));
        usedNominatim = true;
        hit = await nominatim(a);
      }
      if (hit) found[a] = hit; else missed.push(a);
    }
    return json({ found, missed });
  } catch (e: any) {
    return json({ error: e?.message || "Lookup failed" }, 500);
  }
};

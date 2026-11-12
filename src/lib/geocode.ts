// Address -> map location, shared by the customer map and the trash-can
// route builder. Results are cached on this device under the same key the
// customer map has always used, so an address is only looked up once.
//
// Uses the Geocoding REST endpoint with the owner's geocoding key (Google
// refuses referrer-restricted keys for geocoding — see CustomerMapView).
import { supabase } from "./supabase";

const GEOCODE_CACHE_KEY = "smocks.geocodeCache";
type LatLng = { lat: number; lng: number };

export const readGeocodeCache = (): Record<string, LatLng> => {
  try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}"); } catch { return {}; }
};
const writeGeocodeCache = (cache: Record<string, LatLng>) => {
  try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch { /* storage full — just won't persist */ }
};

// Looks up every address not already cached. Returns what it found (cached
// or new) and the first error Google gave, if any.
export async function geocodeAddresses(addresses: string[], key: string, cap = 80): Promise<{ found: Record<string, LatLng>; error?: string }> {
  const cache = readGeocodeCache();
  const found: Record<string, LatLng> = {};
  const todo: string[] = [];
  for (const a of Array.from(new Set(addresses.map(x => (x || "").trim()).filter(Boolean)))) {
    if (cache[a]) found[a] = cache[a]; else todo.push(a);
  }
  let error: string | undefined;
  const left: string[] = [];
  if (key) for (const a of todo.slice(0, cap)) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(a)}&key=${encodeURIComponent(key)}`);
      const data = await res.json();
      const loc = data?.results?.[0]?.geometry?.location;
      if (data?.status === "OK" && typeof loc?.lat === "number") { cache[a] = { lat: loc.lat, lng: loc.lng }; found[a] = cache[a]; }
      else { left.push(a); if (!error) error = "Google: " + (data?.error_message || data?.status || "lookup failed"); }
    } catch (e: any) { left.push(a); if (!error) error = "Google: " + (e?.message || "lookup failed"); }
    await new Promise(r => setTimeout(r, 60));
  }
  else left.push(...todo.slice(0, cap));
  // BUG FIX (owner report — optimize route put a stop "at the very bottom"
  // with a warning) — whatever Google couldn't place (no key, key refused)
  // now goes to the free lookup on our own server (functions/api/geocode.ts)
  // instead of being left off the map.
  if (left.length) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      for (let i = 0; i < left.length; i += 40) {
        const r = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ addresses: left.slice(i, i + 40) }) });
        const d: any = await r.json().catch(() => null);
        if (!r.ok) { error = (error ? error + "; " : "") + "backup lookup: " + (d?.error || r.status); break; }
        for (const [a, loc] of Object.entries(d?.found || {}) as [string, LatLng][]) { cache[a] = loc; found[a] = loc; }
      }
    } catch (e: any) { error = (error ? error + "; " : "") + "backup lookup: " + (e?.message || "failed"); }
    const still = left.filter(a => !found[a]);
    // Only report a problem when an address is still unplaced.
    error = still.length ? (error || "address not found") : undefined;
  }
  writeGeocodeCache(cache);
  return { found, error };
}

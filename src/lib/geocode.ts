// Address -> map location, shared by the customer map and the trash-can
// route builder. Results are cached on this device under the same key the
// customer map has always used, so an address is only looked up once.
//
// Uses the Geocoding REST endpoint with the owner's geocoding key (Google
// refuses referrer-restricted keys for geocoding — see CustomerMapView).
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
  if (todo.length && !key) error = "No Google geocoding key in Settings → Integrations";
  else for (const a of todo.slice(0, cap)) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(a)}&key=${encodeURIComponent(key)}`);
      const data = await res.json();
      const loc = data?.results?.[0]?.geometry?.location;
      if (data?.status === "OK" && typeof loc?.lat === "number") { cache[a] = { lat: loc.lat, lng: loc.lng }; found[a] = cache[a]; }
      else if (!error) error = data?.error_message || data?.status || "lookup failed";
    } catch (e: any) { if (!error) error = e?.message || "lookup failed"; }
    await new Promise(r => setTimeout(r, 60));
  }
  writeGeocodeCache(cache);
  return { found, error };
}

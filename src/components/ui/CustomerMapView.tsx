import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { loadMapsScript } from "./AddressAutocomplete";
import { LiveMap, LiveMapPin } from "./LiveMap";

// FEATURE — "add a view that shows a globe/map, zoom in and out, with a
// pin for each customer, similar to a satellite view." Reuses LiveMap
// (already built for Crew View's employee/job pins — same dark/satellite/
// street-view toggles, same real Google Map, not a stock illustration).
// Customers don't have stored lat/lng today (only jobs do, captured when
// an address is picked via AddressAutocomplete), so this geocodes each
// customer's address client-side via the Google Geocoder — cached in
// localStorage keyed by the exact address string, so a given address is
// only ever geocoded once across the account's whole lifetime, not once
// per page visit.
const GEOCODE_CACHE_KEY = "smocks.geocodeCache";
const readCache = (): Record<string, { lat: number; lng: number }> => {
  try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}"); } catch { return {}; }
};
const writeCache = (cache: Record<string, { lat: number; lng: number }>) => {
  try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch { /* storage full/unavailable — cache just won't persist */ }
};

export function CustomerMapView({ customers = [], apiKey }: { customers?: any[]; apiKey: string }) {
  const [pins, setPins] = useState<LiveMapPin[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // BUG FIX — "the customer map view does not show pins." Every geocode
  // failure was silently swallowed with no visible error at all — a customer
  // list where EVERY address fails (the actual live cause: the Google Maps
  // key has the Geocoding API disabled in Cloud Console, confirmed by the
  // "This API key is not authorized" errors already showing for Distance
  // Matrix on the same key) rendered a map with zero pins and zero
  // explanation. Tracks the failure reason so a systemic key/API problem is
  // surfaced clearly instead of looking like "customers have no location."
  const [lastErrorStatus, setLastErrorStatus] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, { lat: number; lng: number }>>(readCache());

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    const withAddress = customers.filter((c: any) => c.address && c.address.trim());
    (async () => {
      try {
        await loadMapsScript(apiKey);
      } catch {
        return;
      }
      if (cancelled) return;
      const g = (window as any).google;
      const geocoder = new g.maps.Geocoder();
      const cache = cacheRef.current;

      // Anything already cached (by address) shows instantly.
      const initialPins: LiveMapPin[] = [];
      const toGeocode: any[] = [];
      for (const c of withAddress) {
        const hit = cache[c.address];
        if (hit) initialPins.push({ id: c.id, label: `${c.firstName} ${c.lastName}`.trim() || c.address, lat: hit.lat, lng: hit.lng, updatedAt: Date.now() });
        else toGeocode.push(c);
      }
      setPins(initialPins);

      if (toGeocode.length === 0) return;
      setGeocoding(true);
      setProgress({ done: 0, total: toGeocode.length });

      // Sequential with a small delay — the Geocoder has an unpublished
      // per-second rate limit; a tight Promise.all loop over hundreds of
      // addresses reliably starts returning OVER_QUERY_LIMIT partway
      // through. A cap keeps a first-ever map view (every address a cache
      // miss) from taking minutes on a large customer list.
      const CAP = 300;
      let done = 0;
      let consecutiveFailures = 0;
      for (const c of toGeocode.slice(0, CAP)) {
        if (cancelled) return;
        try {
          const result: any = await new Promise((resolve, reject) => {
            geocoder.geocode({ address: c.address }, (results: any, status: string) => {
              if (status === "OK" && results?.[0]) resolve(results[0]);
              else reject(new Error(status));
            });
          });
          const loc = result.geometry.location;
          const lat = loc.lat(), lng = loc.lng();
          cache[c.address] = { lat, lng };
          setPins(prev => [...prev, { id: c.id, label: `${c.firstName} ${c.lastName}`.trim() || c.address, lat, lng, updatedAt: Date.now() }]);
          consecutiveFailures = 0;
        } catch (e: any) {
          // Bad/unresolvable address is normal and expected sometimes — skip
          // it, don't block the rest. But the SAME failure reason on every
          // single address in a row (especially REQUEST_DENIED/
          // OVER_QUERY_LIMIT) means the key/API itself is the problem, not
          // any individual address — worth surfacing once that's clearly
          // what's happening rather than staying silent.
          consecutiveFailures++;
          setLastErrorStatus(e?.message || "UNKNOWN_ERROR");
          if (consecutiveFailures >= 5 && (e?.message === "REQUEST_DENIED" || e?.message === "OVER_QUERY_LIMIT")) break;
        }
        done++;
        setProgress({ done, total: toGeocode.length });
        await new Promise(r => setTimeout(r, 120));
      }
      writeCache(cache);
      if (!cancelled) setGeocoding(false);
    })();
    return () => { cancelled = true; };
  }, [apiKey, customers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!apiKey) {
    return <div className="h-64 rounded-xl bg-black/30 border border-white/10 flex flex-col items-center justify-center gap-2 text-xs text-white/40 p-4 text-center"><MapPin size={20} className="opacity-40" />Add a Google Maps API key in Settings → Integrations to see customers on a map</div>;
  }

  return (
    <div className="space-y-2">
      {geocoding && (
        <div className="text-[11px] text-white/40 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
          Locating customers on the map… {progress.done}/{progress.total}
        </div>
      )}
      {!geocoding && pins.length === 0 && (lastErrorStatus === "REQUEST_DENIED" || lastErrorStatus === "OVER_QUERY_LIMIT") && (
        <div className="text-xs text-yellow-200 bg-yellow-950/20 border border-yellow-700/40 rounded-xl p-3">
          {lastErrorStatus === "REQUEST_DENIED"
            ? "No pins loaded because Google rejected every geocode request (REQUEST_DENIED) — the Maps API key in Settings → Integrations most likely doesn't have the Geocoding API enabled. Enable it for this key in the Google Cloud Console, under APIs & Services."
            : "No pins loaded — Google's geocoding rate limit was hit immediately (OVER_QUERY_LIMIT). Check the API key's quota/billing in the Google Cloud Console."}
        </div>
      )}
      <LiveMap apiKey={apiKey} pins={pins} heightClassName="h-[70vh] min-h-[420px]" />
      <div className="text-[11px] text-white/40">{pins.length} of {customers.filter((c: any) => c.address).length} customers with an address plotted.</div>
    </div>
  );
}

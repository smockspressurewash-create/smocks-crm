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
        } catch {
          // Bad/unresolvable address — skip it, don't block the rest.
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
      <LiveMap apiKey={apiKey} pins={pins} heightClassName="h-[70vh] min-h-[420px]" />
      <div className="text-[11px] text-white/40">{pins.length} of {customers.filter((c: any) => c.address).length} customers with an address plotted.</div>
    </div>
  );
}

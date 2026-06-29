import React, { useState, useRef, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import { GInput } from "./GInput";

// Singleton Google Maps JS loader — loads once per page, queues callbacks.
// Rejects (rather than always resolving) on failure so callers can tell a
// real load error apart from success, retries once automatically, and logs
// the exact failure — a script tag can fail to load for reasons that have
// nothing to do with the key being invalid (e.g. the key's HTTP referrer
// restrictions not including the current origin, which only affects the
// Maps JavaScript API loader — Street View Static <img> requests and some
// other API calls are checked differently, which is why "the key works for
// other Maps features" and the JS loader failing aren't contradictory).
let _ready = false;
let _loading = false;
let _failed: Error | null = null;
const _queue: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];
const GMAPS_CALLBACK = "__smocksGMapsLoaded";

function injectScript(key: string, onDone: (err: Error | null) => void) {
  const cbName = GMAPS_CALLBACK + Date.now();
  (window as any)[cbName] = () => { delete (window as any)[cbName]; onDone(null); };
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async&callback=${cbName}`;
  s.async = true;
  s.onerror = (ev) => {
    console.error("Google Maps script failed to load — check the key's API restrictions include \"Maps JavaScript API\" and its HTTP referrer restrictions include this origin:", window.location.origin, ev);
    s.remove();
    onDone(new Error(`Google Maps script failed to load from ${s.src.split("?")[0]} (origin: ${window.location.origin})`));
  };
  document.head.appendChild(s);
}

export function loadMapsScript(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (_ready) { resolve(); return; }
    if ((window as any).google?.maps?.importLibrary) { _ready = true; resolve(); return; }
    _queue.push({ resolve, reject });
    if (_loading) return;
    _loading = true;
    _failed = null;
    const settle = (err: Error | null) => {
      _loading = false;
      if (err) { _ready = false; _failed = err; }
      else { _ready = true; _failed = null; }
      const q = _queue.splice(0, _queue.length);
      q.forEach(p => err ? p.reject(err) : p.resolve());
    };
    injectScript(key, (err) => {
      if (!err) { settle(null); return; }
      console.warn("Google Maps script load failed — retrying once in 800ms:", err.message);
      setTimeout(() => injectScript(key, (err2) => {
        if (err2) console.error("Google Maps script load failed again on retry:", err2.message);
        settle(err2);
      }), 800);
    });
  });
}

export interface PlaceResult {
  street: string;
  city: string;
  state: string;
  zip: string;
}

// Parse "456 Pine St, York, PA 17401, USA" into components
function parseDesc(desc: string): PlaceResult {
  const clean = desc.replace(/, USA$/, "").replace(/, United States$/, "");
  const parts = clean.split(",").map(p => p.trim());
  const street = parts[0] || "";
  const city = parts[1] || "";
  const stateZip = parts[2] || "";
  const m = stateZip.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
  return {
    street,
    city,
    state: m ? m[1] : stateZip,
    zip: m?.[2] || "",
  };
}

// Local fallback — string-match against addresses already in the CRM so the
// user always gets SOME suggestions even when every Google address API is
// blocked by key restrictions.
function matchKnownAddresses(q: string, knownAddresses: string[]): string[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const addr of knownAddresses) {
    if (!addr) continue;
    if (addr.toLowerCase().includes(needle) && !seen.has(addr)) {
      seen.add(addr);
      out.push(addr);
      if (out.length >= 5) break;
    }
  }
  return out;
}

// Fallback when Places (New) Autocomplete is blocked (key API-restrictions
// commonly allow "Maps JavaScript API" but not "Places API (New)") — the
// plain Geocoding API is a separate REST endpoint with its own restriction
// check, so it often still works even when Places does not.
async function geocodeFallback(q: string, key: string): Promise<string[]> {
  if (!key) return [];
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK") {
    console.warn("Geocoding fallback failed:", data.status, data.error_message);
    return [];
  }
  return (data.results || []).slice(0, 5).map((r: any) => r.formatted_address).filter(Boolean);
}

export function AddressAutocomplete({
  value = "",
  onChange,
  onPlaceSelect,
  placeholder = "Start typing an address...",
  mapsKey = "",
  className = "",
  knownAddresses = [],
}: {
  value?: string;
  onChange: (v: string) => void;
  onPlaceSelect?: (place: PlaceResult) => void;
  placeholder?: string;
  mapsKey?: string;
  className?: string;
  knownAddresses?: string[];
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usingFallback, setUsingFallback] = useState(false);
  // New Places API: AutocompleteService is retired for new Cloud projects in
  // favor of AutocompleteSuggestion (static, Promise-based). It lives in the
  // "places" library loaded via google.maps.importLibrary, which is present
  // on the global `google.maps` namespace once the base bootstrap script has
  // loaded — no separate script URL change needed beyond loading=async above.
  const placesLibRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const timer = useRef<any>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!mapsKey) { setError("No Google Maps API key set in Settings → Integrations."); return; }
    setError("");
    loadMapsScript(mapsKey)
      .then(async () => {
        const g = (window as any).google;
        if (!g?.maps?.importLibrary) {
          setError("Google Maps loaded but google.maps.importLibrary is missing — check the Maps JavaScript API is enabled for this key.");
          return;
        }
        try {
          const lib = await g.maps.importLibrary("places");
          if (!lib?.AutocompleteSuggestion) {
            setError("Places API (New) isn't available for this key — enable \"Places API (New)\" in Google Cloud Console.");
            return;
          }
          placesLibRef.current = lib;
          sessionTokenRef.current = new lib.AutocompleteSessionToken();
        } catch (e: any) {
          console.warn("Failed to load Places library:", e);
          setError("Couldn't load the Places library — check your Maps API key and enabled APIs.");
        }
      })
      .catch((e: Error) => {
        console.error("AddressAutocomplete: Maps script load failed after retry —", e.message);
        setError(`Google Maps script failed to load (${e.message}). This usually means the key's "Application restrictions → HTTP referrers" in Google Cloud Console doesn't include ${window.location.origin}, or "Maps JavaScript API" isn't enabled for this key — both checked separately from Street View/Places.`);
      });
  }, [mapsKey]);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 3) { setSuggestions([]); return; }
    const myReqId = ++reqIdRef.current;
    const localMatches = matchKnownAddresses(q, knownAddresses);
    const lib = placesLibRef.current;
    if (!lib?.AutocompleteSuggestion) {
      setSuggestions(localMatches);
      setUsingFallback(localMatches.length > 0);
      if (!localMatches.length && !error) setError("Address autocomplete isn't ready yet — check your Google Maps API key in Settings.");
      return;
    }
    setLoading(true);
    try {
      const { suggestions: results } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        includedRegionCodes: ["us"],
        includedPrimaryTypes: ["street_address", "premise", "subpremise"],
        sessionToken: sessionTokenRef.current,
      });
      if (myReqId !== reqIdRef.current) return; // a newer keystroke superseded this request
      const apiResults = (results || []).slice(0, 5).map((s: any) => s.placePrediction?.text?.toString() || "").filter(Boolean);
      if (apiResults.length) {
        setSuggestions(apiResults);
        setUsingFallback(false);
        setError("");
      } else {
        setSuggestions(localMatches);
        setUsingFallback(localMatches.length > 0);
      }
    } catch (e: any) {
      if (myReqId !== reqIdRef.current) return;
      console.error("Places (New) autocomplete blocked/failed — falling back to Geocoding API and local matches:", e);
      const geo = await geocodeFallback(q, mapsKey).catch((ge) => { console.warn("Geocoding fallback also failed:", ge); return []; });
      if (myReqId !== reqIdRef.current) return;
      const combined = Array.from(new Set([...geo, ...localMatches])).slice(0, 5);
      setSuggestions(combined);
      setUsingFallback(combined.length > 0);
      if (!combined.length) {
        const msg = e?.message || String(e);
        const consoleUrl = "https://console.cloud.google.com/google/maps-apis/api-list";
        setError(/denied|enable|permission|blocked/i.test(msg)
          ? `Google blocked this request (Places API (New) likely isn't checked under this API key's "API restrictions" in Google Cloud Console — ${consoleUrl}). Type the full address manually for now.`
          : `Address lookup failed: ${msg}. Type the full address manually.`);
      } else {
        setError("");
      }
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  }, [error, knownAddresses, mapsKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 250);
  };

  const handleSelect = (s: string) => {
    if (onPlaceSelect) {
      const place = parseDesc(s);
      onChange(place.street);
      onPlaceSelect(place);
    } else {
      onChange(s);
    }
    setSuggestions([]);
    setOpen(false);
    // A session ends once a selection is made (billing boundary for the new
    // Places API) — start a fresh token for the next autocomplete session.
    if (placesLibRef.current) sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
  };

  return (
    <div className="relative">
      <div className="relative">
        <GInput
          value={value}
          onChange={handleChange}
          onFocus={() => value.length > 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className={className}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl overflow-hidden">
          {usingFallback && (
            <div className="px-3 py-1.5 text-[9px] text-amber-300/80 bg-amber-950/40 border-b border-amber-900/30">
              Google address lookup unavailable — showing matches from saved addresses
            </div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-3 py-2.5 text-xs text-white/80 hover:bg-red-900/30 hover:text-white transition flex items-center gap-2 border-b border-red-900/10 last:border-0"
            >
              <MapPin size={11} className="text-red-400 flex-shrink-0" />
              {s}
            </button>
          ))}
        </div>
      )}
      {open && suggestions.length === 0 && !loading && error && value.length >= 3 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 px-3 py-2 bg-amber-950/90 border border-amber-700/40 rounded-xl text-[10px] text-amber-200 leading-relaxed">
          {error}
        </div>
      )}
    </div>
  );
}

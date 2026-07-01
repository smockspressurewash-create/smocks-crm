import React, { useState, useRef } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { GInput } from "./GInput";

// Singleton Google Maps JS loader — loads once per page, queues callbacks.
// Rejects (rather than always resolving) on failure so callers can tell a
// real load error apart from success, retries once automatically. Still used
// by LiveMap (employee location pins) and the ETA/distance-matrix features —
// NOT by AddressAutocomplete below, which no longer touches any Google
// address API at all (see note further down).
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

// Local fallback — string-match against addresses already in the CRM.
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

// Both the Places (New) Autocomplete API and the Geocoding API fallback kept
// failing with key-restriction errors (403 "not authorized to use this
// service") regardless of which Google address API was tried — the key's API
// restrictions in Cloud Console don't reliably cover every address-lookup
// product. Rather than keep chasing which specific API is allowed, this
// component no longer calls ANY Google address API: it's a plain text input
// using the browser's own address autofill (autoComplete="street-address",
// works in Chrome/Safari/Edge without any API key), plus suggestions matched
// locally against addresses already saved in the CRM, plus a button that
// opens Google Maps in a new tab so the address can be visually verified —
// none of which can ever be blocked by a Cloud Console key restriction.
export function AddressAutocomplete({
  value = "",
  onChange,
  onPlaceSelect: _onPlaceSelect,
  placeholder = "Start typing an address...",
  mapsKey: _mapsKey = "",
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
  const [open, setOpen] = useState(false);
  const timer = useRef<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSuggestions(v.length >= 3 ? matchKnownAddresses(v, knownAddresses) : []), 120);
  };

  const handleSelect = (s: string) => {
    onChange(s);
    setSuggestions([]);
    setOpen(false);
  };

  const verifyOnMaps = () => {
    if (!value.trim()) return;
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(value.trim())}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative">
      <div className="relative flex gap-1.5">
        <div className="relative flex-1">
          <GInput
            value={value}
            onChange={handleChange}
            onFocus={() => value.length > 2 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            className={className}
            name="address"
            autoComplete="street-address"
          />
        </div>
        <button
          type="button"
          onClick={verifyOnMaps}
          disabled={!value.trim()}
          title="Open this address in Google Maps to verify it"
          className="flex-shrink-0 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 transition flex items-center gap-1.5 text-xs"
        >
          <ExternalLink size={13} />
          Verify
        </button>
      </div>
      {!open && !value && (
        <div className="text-[9px] text-white/30 mt-1 pl-1">
          Browser address autofill active · type 3+ chars to see saved CRM matches
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-1.5 text-[9px] text-white/40 bg-white/5 border-b border-white/10">
            Matches from saved addresses
          </div>
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
    </div>
  );
}

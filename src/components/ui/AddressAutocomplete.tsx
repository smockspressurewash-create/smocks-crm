import React, { useState } from "react";
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
// Substring OR per-word prefix match, so "2780" matches "2780 Prospect Ave"
// and "prospect" matches it too. Case-insensitive, de-duped, capped at 6.
function matchKnownAddresses(q: string, knownAddresses: string[]): string[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const addr of knownAddresses) {
    if (!addr) continue;
    const lower = addr.toLowerCase();
    const words = lower.split(/[\s,]+/);
    const matches = lower.includes(needle) || words.some(w => w.startsWith(needle));
    if (matches && !seen.has(addr)) {
      seen.add(addr);
      out.push(addr);
      if (out.length >= 6) break;
    }
  }
  return out;
}

// FIX 9 — after 10+ rounds of chasing which specific Google address API a
// given key was/wasn't restricted to (Places (New), AutocompleteService,
// Geocoding — every one eventually hit a 403 "not authorized"/"blocked" error
// for this key), the Google Places dependency is removed entirely rather than
// patched again. This component now makes NO Google address API call of any
// kind: it's a plain text input using the browser's own address autofill
// (autoComplete="street-address", works in Chrome/Safari/Edge with no API
// key), suggestions matched locally against addresses already saved in the
// CRM (the ONLY suggestion source now), plus a button that opens Google Maps
// in a new tab so the address can be visually verified — a plain link, not
// an API call, so it can never be blocked by a Cloud Console key restriction.
// With no API call left to fail, there is also nothing left to show a
// "blocked" banner about — mapsKey is accepted for API compatibility with
// existing callers but is otherwise unused here.
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
  // Local CRM matches — instant, synchronous, always available, and now the
  // only suggestion source.
  const suggestions = value.trim().length >= 2 ? matchKnownAddresses(value, knownAddresses) : [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    setOpen(true);
  };

  const handleSelect = (s: string) => {
    onChange(s);
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
          Browser address autofill active · type 2+ chars to see saved CRM matches
        </div>
      )}
      {open && suggestions.length === 0 && value.trim().length >= 3 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-black/95 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white/40">
          No matches yet — keep typing, or just finish the address manually.
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-1.5 text-[9px] text-white/40 bg-white/5 border-b border-white/10">
            From your customers
          </div>
          {suggestions.slice(0, 6).map((s, i) => (
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

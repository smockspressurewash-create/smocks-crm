import React, { useState, useRef, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import { GInput } from "./GInput";

// Singleton Google Maps JS loader — loads once per page, queues callbacks
let _ready = false;
let _loading = false;
const _queue: Array<() => void> = [];

export function loadMapsScript(key: string): Promise<void> {
  return new Promise(resolve => {
    if (_ready) { resolve(); return; }
    _queue.push(resolve);
    if (_loading) return;
    _loading = true;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    s.async = true;
    s.onload = () => { _ready = true; _queue.forEach(cb => cb()); _queue.length = 0; };
    s.onerror = () => { _loading = false; _queue.forEach(cb => cb()); _queue.length = 0; };
    document.head.appendChild(s);
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

export function AddressAutocomplete({
  value = "",
  onChange,
  onPlaceSelect,
  placeholder = "Start typing an address...",
  mapsKey = "",
  className = "",
}: {
  value?: string;
  onChange: (v: string) => void;
  onPlaceSelect?: (place: PlaceResult) => void;
  placeholder?: string;
  mapsKey?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const svcRef = useRef<any>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (!mapsKey) return;
    loadMapsScript(mapsKey).then(() => {
      const g = (window as any).google;
      if (g?.maps?.places?.AutocompleteService) {
        svcRef.current = new g.maps.places.AutocompleteService();
      }
    });
  }, [mapsKey]);

  const search = useCallback((q: string) => {
    if (!q || q.length < 3) { setSuggestions([]); return; }
    if (!svcRef.current) { setSuggestions([]); return; }
    setLoading(true);
    svcRef.current.getPlacePredictions(
      { input: q, componentRestrictions: { country: "us" }, types: ["address"] },
      (preds: any[] | null, status: string) => {
        setLoading(false);
        if (status === "OK" && preds) {
          setSuggestions(preds.slice(0, 5).map((p: any) => p.description));
        } else {
          setSuggestions([]);
        }
      }
    );
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 350);
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

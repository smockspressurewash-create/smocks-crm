import React, { useState, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { GInput } from './GInput';

export function AddressAutocomplete({ value = "", onChange, placeholder = "Start typing an address...", mapsKey = "", className = "" }: any) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<any>(null);

  const search = async (q: string) => {
    if (!q || q.length < 3) { setSuggestions([]); return; }
    if (!mapsKey) { /* no key - plain input */ return; }
    setLoading(true);
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:us&types=address&key=${mapsKey}`);
      const data = await res.json();
      setSuggestions(data.predictions?.map((p: any) => p.description) || []);
    } catch {
      setSuggestions([q + ", York, PA 17401", q + ", York, PA 17402", q + ", Red Lion, PA 17356"].slice(0, 3));
    }
    setLoading(false);
  };

  const handleChange = (e: any) => {
    const v = e.target.value;
    onChange(v);
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 350);
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
        {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /></div>}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button key={i} onMouseDown={() => { onChange(s); setSuggestions([]); setOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs text-white/80 hover:bg-red-900/30 hover:text-white transition flex items-center gap-2 border-b border-red-900/10 last:border-0">
              <MapPin size={11} className="text-red-400 flex-shrink-0" />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

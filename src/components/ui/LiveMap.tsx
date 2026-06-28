import React, { useEffect, useRef, useState } from "react";
import { Moon, Sun, Satellite, Eye } from "lucide-react";
import { loadMapsScript } from "./AddressAutocomplete";

export interface LiveMapPin {
  id: string;
  label: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#262626" }] },
];

// Real Google Map for Crew View → Live Now — plots one pin per employee
// currently sharing their location, with dark/satellite/street-view toggles
// and a "last updated" readout per pin (via marker title + an inline list).
export function LiveMap({ apiKey, pins }: { apiKey: string; pins: LiveMapPin[] }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const streetViewRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(true);
  const [satellite, setSatellite] = useState(false);
  const [streetViewOn, setStreetViewOn] = useState(false);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;
    loadMapsScript(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current || !(window as any).google) return;
        const g = (window as any).google;
        const center = pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 39.9626, lng: -76.7277 };
        mapObjRef.current = new g.maps.Map(mapRef.current, {
          center, zoom: 11, disableDefaultUI: true, zoomControl: true,
          mapTypeId: satellite ? "satellite" : "roadmap",
          styles: dark && !satellite ? DARK_STYLE : [],
        });
        streetViewRef.current = mapObjRef.current.getStreetView();
        setReady(true);
      })
      .catch((e: Error) => setError(e.message));
    return () => { cancelled = true; };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply map type / style without re-creating the map instance
  useEffect(() => {
    if (!mapObjRef.current) return;
    mapObjRef.current.setMapTypeId(satellite ? "satellite" : "roadmap");
    mapObjRef.current.setOptions({ styles: dark && !satellite ? DARK_STYLE : [] });
  }, [dark, satellite]);

  useEffect(() => {
    if (!streetViewRef.current) return;
    streetViewRef.current.setVisible(streetViewOn);
    if (streetViewOn && pins[0]) streetViewRef.current.setPosition({ lat: pins[0].lat, lng: pins[0].lng });
  }, [streetViewOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-plot pins whenever they change (e.g. the 10s owner-side refresh)
  useEffect(() => {
    if (!ready || !mapObjRef.current) return;
    const g = (window as any).google;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = pins.map(p => new g.maps.Marker({
      position: { lat: p.lat, lng: p.lng },
      map: mapObjRef.current,
      label: { text: p.label[0]?.toUpperCase() || "?", color: "#fff" },
      title: `${p.label} — updated ${new Date(p.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
    }));
    if (pins.length > 1) {
      const bounds = new g.maps.LatLngBounds();
      pins.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapObjRef.current.fitBounds(bounds);
    } else if (pins.length === 1) {
      mapObjRef.current.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
    }
  }, [ready, pins]);

  if (!apiKey) {
    return <div className="h-48 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center text-xs text-white/30">Add a Google Maps API key in Settings to see live locations on a map</div>;
  }
  if (error) {
    return <div className="h-48 rounded-xl bg-black/30 border border-yellow-700/40 flex items-center justify-center text-xs text-yellow-200 p-3 text-center">{error}</div>;
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <div ref={mapRef} className="h-56 rounded-xl overflow-hidden border border-white/10" />
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={() => setDark(d => !d)} title="Toggle dark mode" className={"w-7 h-7 rounded-lg flex items-center justify-center border " + (dark ? "bg-blue-600/80 border-blue-400/50 text-white" : "bg-black/60 border-white/20 text-white/70")}>
            {dark ? <Moon size={13} /> : <Sun size={13} />}
          </button>
          <button onClick={() => setSatellite(s => !s)} title="Toggle satellite view" className={"w-7 h-7 rounded-lg flex items-center justify-center border " + (satellite ? "bg-blue-600/80 border-blue-400/50 text-white" : "bg-black/60 border-white/20 text-white/70")}>
            <Satellite size={13} />
          </button>
          <button onClick={() => setStreetViewOn(s => !s)} title="Toggle Street View" disabled={pins.length === 0} className={"w-7 h-7 rounded-lg flex items-center justify-center border disabled:opacity-30 " + (streetViewOn ? "bg-blue-600/80 border-blue-400/50 text-white" : "bg-black/60 border-white/20 text-white/70")}>
            <Eye size={13} />
          </button>
        </div>
      </div>
      {pins.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pins.map(p => (
            <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-white/50">
              {p.label} · {new Date(p.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

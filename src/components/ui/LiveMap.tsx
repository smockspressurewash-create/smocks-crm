import React, { useEffect, useRef } from "react";
import { loadMapsScript } from "./AddressAutocomplete";

export interface LiveMapPin {
  id: string;
  label: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

// Lightweight map for Crew View → Live Now — plots one pin per employee
// currently sharing their location. Reuses the same Maps JS loader as
// AddressAutocomplete so the script is only ever loaded once per page.
export function LiveMap({ apiKey, pins }: { apiKey: string; pins: LiveMapPin[] }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;
    loadMapsScript(apiKey).then(() => {
      if (cancelled || !mapRef.current || !(window as any).google) return;
      const g = (window as any).google;
      if (!mapObjRef.current) {
        const center = pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 39.9626, lng: -76.7277 };
        mapObjRef.current = new g.maps.Map(mapRef.current, { center, zoom: 11, disableDefaultUI: true, zoomControl: true });
      }
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = pins.map(p => {
        const marker = new g.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map: mapObjRef.current,
          label: { text: p.label[0]?.toUpperCase() || "?", color: "#fff" },
          title: `${p.label} — updated ${new Date(p.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        });
        return marker;
      });
      if (pins.length > 1) {
        const bounds = new g.maps.LatLngBounds();
        pins.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
        mapObjRef.current.fitBounds(bounds);
      } else if (pins.length === 1) {
        mapObjRef.current.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
      }
    });
    return () => { cancelled = true; };
  }, [apiKey, pins]);

  if (!apiKey) {
    return <div className="h-48 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center text-xs text-white/30">Add a Google Maps API key in Settings to see live locations on a map</div>;
  }
  return <div ref={mapRef} className="h-48 rounded-xl overflow-hidden border border-white/10" />;
}

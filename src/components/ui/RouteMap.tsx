// Map of a built route (owner request: "can we see a visual on the map for
// each route ... and you can move them from there and visually see it move").
//
// Numbered pins in route order joined by a line, starting from the shop when
// there is a start address. To change the order on the map, drag a pin onto
// another pin (it takes that stop's place) or tap a pin and use Earlier /
// Later. The line and the numbers redraw at once and the moved pin pulses.
// Free OpenStreetMap tiles, no key. Loaded only when a route is shown.
import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type RouteMapStop = { id: string; name: string; lat?: number; lng?: number; time?: string };

const pin = (n: number, moved: boolean) => L.divIcon({
  className: "",
  html: `<div class="crew-route-pin${moved ? " crew-route-pin-moved" : ""}">${n}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});
const homePin = L.divIcon({ className: "", html: `<div class="crew-route-home">⌂</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));

export default function RouteMap({ stops, start, onMove, movedId }: {
  stops: RouteMapStop[];
  start?: { lat: number; lng: number } | null;
  onMove: (from: number, to: number) => void;
  movedId?: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fittedFor = useRef("");
  const fitTo = useRef<L.LatLngBounds | null>(null);
  const userMoved = useRef(false);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const dragging = useRef(false);
  // Redraw only when the stops, their order or the highlight really change
  // (the parent rebuilds the list on every render), and never mid-drag.
  const sig = JSON.stringify([stops.map(s => [s.id, s.lat, s.lng, s.time, s.name]), start, movedId]);

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true, tap: true } as any);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m);
    m.setView([40.2, -76.9], 9);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // The box can be laid out after the map is made (tabs, modals).
    // Zoom to the stops again once the box has its real size, unless the
    // owner already panned or zoomed.
    m.on("dragstart zoomstart", (e: any) => { if (e?.originalEvent || (m as any)._zooming) userMoved.current = true; });
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      if (fitTo.current && !userMoved.current) m.fitBounds(fitTo.current, { padding: [30, 30], animate: false });
    });
    ro.observe(box.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g || dragging.current) return;
    g.clearLayers();
    const placed = stops.map((s, i) => ({ s, i })).filter(({ s }) => typeof s.lat === "number" && typeof s.lng === "number");
    const pts: L.LatLngExpression[] = [];
    if (start) { pts.push([start.lat, start.lng]); L.marker([start.lat, start.lng], { icon: homePin, keyboard: false, title: "Start" }).addTo(g); }
    for (const { s } of placed) pts.push([s.lat!, s.lng!]);
    if (pts.length > 1) {
      L.polyline(pts, { color: "#000", weight: 7, opacity: 0.45 }).addTo(g);
      L.polyline(pts, { color: "#ef4444", weight: 4, opacity: 0.95, className: "crew-route-line" }).addTo(g);
    }
    const markers: { m: L.Marker; i: number }[] = [];
    for (const { s, i } of placed) {
      const mk = L.marker([s.lat!, s.lng!], { icon: pin(i + 1, s.id === movedId), draggable: true, autoPan: true, title: s.name, zIndexOffset: s.id === movedId ? 1000 : 0 }).addTo(g);
      const html = document.createElement("div");
      html.className = "text-xs";
      html.innerHTML = `<div style="font-weight:600">${i + 1}. ${esc(s.name)}</div>${s.time ? `<div style="opacity:.7">${esc(s.time)}</div>` : ""}<div style="display:flex;gap:6px;margin-top:6px"><button data-dir="-1" ${i === 0 ? "disabled" : ""} class="crew-route-btn">◀ Earlier</button><button data-dir="1" ${i === stops.length - 1 ? "disabled" : ""} class="crew-route-btn">Later ▶</button></div><div style="opacity:.55;margin-top:4px">Or drag this pin onto another stop.</div>`;
      html.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
        const dir = Number((b as HTMLButtonElement).dataset.dir);
        m.closePopup();
        moveRef.current(i, Math.max(0, Math.min(stops.length - 1, i + dir)));
      }));
      mk.bindPopup(html);
      mk.on("dragstart", () => { dragging.current = true; m.closePopup(); });
      mk.on("dragend", () => {
        dragging.current = false;
        const here = m.latLngToContainerPoint(mk.getLatLng());
        let best = -1, bestPx = 48;
        for (const o of markers) {
          if (o.i === i) continue;
          const px = here.distanceTo(m.latLngToContainerPoint(o.m.getLatLng()));
          if (px < bestPx) { bestPx = px; best = o.i; }
        }
        mk.setLatLng([s.lat!, s.lng!]);
        // Let Leaflet finish the drag before the pins are redrawn.
        if (best >= 0) window.setTimeout(() => moveRef.current(i, best), 0);
      });
      markers.push({ m: mk, i });
    }
    // Zoom to the stops when the set of stops changes, not on a reorder.
    const key = placed.map(p => p.s.id).sort().join(",") + (start ? "|s" : "");
    if (key !== fittedFor.current && pts.length) {
      fittedFor.current = key;
      userMoved.current = false;
      fitTo.current = L.latLngBounds(pts).pad(pts.length === 1 ? 0.02 : 0);
      m.invalidateSize();
      m.fitBounds(fitTo.current, { padding: [30, 30], maxZoom: 15, animate: false });
    }
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10" data-route-map>
      <style>{`
        .crew-route-map .leaflet-tile{filter:invert(1) hue-rotate(180deg) brightness(.85) contrast(.9) saturate(.6)}
        .crew-route-map{background:#111}
        .crew-route-pin{width:28px;height:28px;border-radius:9999px;background:#dc2626;color:#fff;font:700 12px/28px system-ui,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.6);cursor:grab;transition:transform .2s}
        .crew-route-pin-moved{animation:crewPinPulse 1.1s ease-out 2;background:#16a34a}
        @keyframes crewPinPulse{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(22,163,74,.8)}50%{transform:scale(1.35)}100%{transform:scale(1);box-shadow:0 0 0 18px rgba(22,163,74,0)}}
        .crew-route-home{width:26px;height:26px;border-radius:8px;background:#111;color:#fff;border:2px solid #ef4444;font:700 15px/22px system-ui;text-align:center}
        .crew-route-line{stroke-dasharray:10 8;animation:crewDash 1.2s linear infinite}
        @keyframes crewDash{to{stroke-dashoffset:-18}}
        .crew-route-btn{padding:3px 8px;border-radius:8px;background:#dc2626;color:#fff;font-weight:600}
        .crew-route-btn:disabled{opacity:.3}
        @media (prefers-reduced-motion: reduce){.crew-route-line,.crew-route-pin-moved{animation:none}}
      `}</style>
      <div ref={box} className="crew-route-map h-72 md:h-96 w-full" />
    </div>
  );
}

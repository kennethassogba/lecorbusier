import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Place, Proposal } from "../types";
import "leaflet/dist/leaflet.css";
type Props = {
  places: Place[];
  proposals: Proposal[];
  selected: string;
  onSelect: (id: string) => void;
  onProposal: (p: Proposal) => void;
};
export function ParisMap({
  places,
  proposals,
  selected,
  onSelect,
  onProposal,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null),
    lastSelected = useRef(selected);
  const callbacks = useRef({ onSelect, onProposal });
  callbacks.current = { onSelect, onProposal };
  useEffect(() => {
    if (!container.current) return;
    const m = L.map(container.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 11,
      maxZoom: 19,
      keyboard: true,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([48.858, 2.344], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    const sheet =
      container.current.parentElement?.querySelector(".location-sheet");
    const observer = new ResizeObserver(() => {
      m.invalidateSize();
      if (sheet)
        container.current?.style.setProperty(
          "--sheet-height",
          `${sheet.getBoundingClientRect().height}px`,
        );
    });
    observer.observe(container.current);
    if (sheet) observer.observe(sheet);
    return () => {
      observer.disconnect();
      m.stop();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    for (const place of places) {
      const contributions = proposals.filter((p) => p.place_id === place.id);
      const isSelected = place.id === selected;
      const icon = L.divIcon({
        className: "map-pin-wrap",
        html: contributions.length
          ? `<span class="map-pin photo-pin ${isSelected ? "selected" : ""}"><img src="/lecorbusier/media/${contributions[0].id}.jpg" alt=""><span class="pin-count">${contributions.length}</span></span>`
          : `<span class="map-pin ${isSelected ? "selected" : ""}"><span class="pin-dot"></span></span>`,
        iconSize: contributions.length ? [48, 54] : [36, 44],
        iconAnchor: contributions.length ? [24, 48] : [18, 34],
      });
      const marker = L.marker([place.lat, place.lng], {
        icon,
        title: place.name,
        alt: place.name,
        keyboard: true,
      }).addTo(layer.current);
      marker.on("click", () => callbacks.current.onSelect(place.id));
      marker.bindTooltip(place.name, { direction: "top", offset: [0, -30] });
    }
  }, [places, proposals, selected]);
  useEffect(() => {
    if (lastSelected.current === selected) return;
    const place = places.find((p) => p.id === selected);
    if (place && map.current) {
      lastSelected.current = selected;
      const point = map.current.project([place.lat, place.lng], 14);
      point.y += 90;
      map.current.setView(map.current.unproject(point, 14), 14, {
        animate: false,
      });
    }
  }, [selected, places]);
  return (
    <div
      ref={container}
      className="paris-map"
      aria-label="Carte de Paris et des lieux de construction"
    />
  );
}

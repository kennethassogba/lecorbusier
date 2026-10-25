import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Map,
  Marker,
  AttributionControl,
  setWorkerUrl,
  type Map as MapInstance,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { LocateFixed, Minus, Plus } from "lucide-react";
import type { Place, Proposal } from "../types";
import { BASE } from "../api";
import "maplibre-gl/dist/maplibre-gl.css";
setWorkerUrl(workerUrl);
export type MapControl = { home: () => void; focus: (place: Place) => void };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export function ParisMap({
  places,
  proposals,
  selected,
  building,
  onSelect,
  onProposal,
  onBlank,
  control,
}: {
  places: Place[];
  proposals: Proposal[];
  selected: string | null;
  building: boolean;
  onSelect: (id: string) => void;
  onProposal: (p: Proposal) => void;
  onBlank: () => void;
  control: RefObject<MapControl | null>;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<MapInstance | null>(null);
  const markers = useRef<
    Record<string, { marker: Marker; el: HTMLButtonElement; key: string }>
  >({});
  const latestSelected = useRef(selected);
  latestSelected.current = selected;
  const callbacks = useRef({ onSelect, onProposal, onBlank });
  callbacks.current = { onSelect, onProposal, onBlank };
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [threeD, setThreeD] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!container.current) return;
    let m: MapInstance;
    try {
      m = new Map({
        container: container.current,
        style: BASE + "/paris-map.json",
        center: [2.342, 48.858],
        zoom: 12.5,
        minZoom: 11,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        maxZoom: 19,
        maxBounds: [
          [2.15, 48.75],
          [2.51, 48.99],
        ],
        attributionControl: false,
        locale: {
          "AttributionControl.ToggleAttribution": "Crédits de la carte",
        },
        pitch: 0,
        maxPitch: 65,
        fadeDuration: 0,
        canvasContextAttributes: { antialias: true },
      });
    } catch {
      setFailed(true);
      return;
    }
    map.current = m;
    m.addControl(new AttributionControl({ compact: true }), "bottom-left");
    m.on("load", () => {
      const attribution = container.current?.querySelector<HTMLDetailsElement>(
        ".maplibregl-ctrl-attrib",
      );
      if (attribution?.open)
        attribution.querySelector<HTMLElement>("summary")?.click();
      setReady(true);
      setFailed(false);
      m.addSource("paris-places", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: places.map((p) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: { name: p.name },
          })),
        },
      });
      m.addLayer({
        id: "paris-place-labels",
        type: "symbol",
        source: "paris-places",
        minzoom: 12.7,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-max-width": 12,
          "text-padding": 8,
        },
        paint: {
          "text-color": "#34486b",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    });
    m.on("error", (e) => {
      if (!m.isStyleLoaded() && /style|fetch|network/i.test(e.error.message))
        setFailed(true);
    });
    m.on("idle", () => container.current?.setAttribute("data-ready", "true"));
    m.on("movestart", () =>
      container.current?.setAttribute("data-ready", "false"),
    );
    m.on("pitchend", () => setThreeD(m.getPitch() > 10));
    m.on("click", () => callbacks.current.onBlank());
    m.getCanvas().setAttribute(
      "aria-label",
      "Carte de Paris. Flèches pour déplacer, plus et moins pour zoomer.",
    );
    const focus = (p: Place) =>
      requestAnimationFrame(() => {
        if (map.current !== m) return;
        const mobile = window.innerWidth < 800;
        m.flyTo({
          center: [p.lng, p.lat],
          zoom: 16.2,
          pitch: 48,
          bearing: -15,
          duration: reduced() ? 0 : 850,
          padding: mobile
            ? {
                top: 120,
                bottom: Math.min(
                  window.innerHeight * 0.72,
                  (document.querySelector(".map-sheet")?.getBoundingClientRect()
                    .height || 220) + 24,
                ),
                left: 30,
                right: 50,
              }
            : { left: 460, right: 60, top: 70, bottom: 40 },
        });
      });
    const home = () =>
      m.fitBounds(
        [
          [2.283, 48.827],
          [2.38, 48.888],
        ],
        {
          padding:
            window.innerWidth < 800
              ? { top: 145, bottom: 210, left: 40, right: 40 }
              : { top: 80, bottom: 100, left: 470, right: 100 },
          pitch: 0,
          bearing: 0,
          duration: reduced() ? 0 : 650,
          maxZoom: 13,
        },
      );
    control.current = { focus, home };
    m.once("load", () => {
      if (!latestSelected.current && !location.pathname.includes("/p/")) home();
    });
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      control.current = null;
      map.current = null;
      markers.current = {};
      setReady(false);
      m.remove();
    };
  }, [retry, control]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.setFilter("paris-place-labels", [
      "!",
      [
        "in",
        ["get", "name"],
        [
          "literal",
          places
            .filter(
              (p) =>
                p.id === selected || proposals.some((c) => c.place_id === p.id),
            )
            .map((p) => p.name),
        ],
      ],
    ]);
    for (const place of places) {
      const items = proposals.filter((p) => p.place_id === place.id);
      const active = selected === place.id;
      const key = JSON.stringify([
        active,
        building,
        items.map((p) => [p.id, p.title]),
      ]);
      const cached = markers.current[place.id];
      if (cached?.key === key) continue;
      const el = cached?.el || document.createElement("button");
      el.type = "button";
      el.replaceChildren();
      el.className = `city-pin ${items.length && !building ? "has-photo" : ""} ${active ? "selected" : ""} ${building ? "build-pin" : ""}`;
      el.setAttribute(
        "aria-label",
        items.length && !building
          ? `${items[0].title}, ${place.name}${items.length > 1 ? `, ${items.length} créations` : ""}`
          : `Construire à ${place.name}`,
      );
      el.title = place.name;
      const face = document.createElement("span");
      face.className = "pin-face";
      if (items.length && !building) {
        const img = document.createElement("img");
        img.src = items[0].image || place.image;
        img.alt = "";
        face.append(img);
        if (items.length > 1) {
          const count = document.createElement("b");
          count.textContent = String(items.length);
          face.append(count);
        }
      } else {
        face.textContent = building ? "+" : "•";
      }
      el.append(face);
      if (active || items.length || building) {
        const label = document.createElement("span");
        label.className = "pin-label";
        label.textContent = place.name;
        el.append(label);
      }
      el.onclick = (e) => {
        e.stopPropagation();
        if (items.length === 1 && !building)
          callbacks.current.onProposal(items[0]);
        else callbacks.current.onSelect(place.id);
      };
      markers.current[place.id] = {
        el,
        key,
        marker:
          cached?.marker ||
          new Marker({
            element: el,
            anchor: "bottom",
            pitchAlignment: "viewport",
          })
            .setLngLat([place.lng, place.lat])
            .addTo(m),
      };
    }
    for (const [id, item] of Object.entries(markers.current))
      if (!places.some((p) => p.id === id)) {
        item.marker.remove();
        delete markers.current[id];
      }
  }, [places, proposals, selected, building, ready]);
  return (
    <>
      <div
        ref={container}
        className="paris-map"
        role="region"
        aria-label="Carte commune de Paris"
      />
      {failed && (
        <button
          className="map-retry"
          onClick={() => {
            setFailed(false);
            setRetry((n) => n + 1);
          }}
        >
          Recharger la carte
        </button>
      )}
      <div className="map-tools" aria-label="Commandes de la carte">
        <button
          className="map-tool"
          aria-label={threeD ? "Vue 2D" : "Vue 3D"}
          aria-pressed={threeD}
          onClick={() =>
            map.current?.easeTo({
              pitch: threeD ? 0 : 55,
              zoom: threeD
                ? map.current.getZoom()
                : Math.max(map.current.getZoom(), 15),
              duration: reduced() ? 0 : 500,
            })
          }
        >
          {threeD ? "2D" : "3D"}
        </button>
        <button
          className="map-tool"
          aria-label="Recentrer sur Paris"
          onClick={() => {
            control.current?.home();
            callbacks.current.onBlank();
          }}
        >
          <LocateFixed size={21} />
        </button>
        <div className="zoom-controls">
          <button
            className="map-tool"
            aria-label="Zoomer"
            onClick={() =>
              map.current?.zoomIn({ duration: reduced() ? 0 : 200 })
            }
          >
            <Plus size={19} />
          </button>
          <button
            className="map-tool"
            aria-label="Dézoomer"
            onClick={() =>
              map.current?.zoomOut({ duration: reduced() ? 0 : 200 })
            }
          >
            <Minus size={19} />
          </button>
        </div>
      </div>
    </>
  );
}

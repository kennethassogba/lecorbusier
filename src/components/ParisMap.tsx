import { t, useLanguage } from "../i18n";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Map,
  Marker,
  AttributionControl,
  setWorkerUrl,
  type Map as MapInstance,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Box, Rotate3d, LocateFixed, Minus, Plus } from "lucide-react";
import type { Place, Proposal, Design, Coordinate } from "../types";
import type { VolumeTool, VolumeEngine } from "../volume/MapVolume";
const MapVolume = lazy(() =>
  import("../volume/MapVolume").then((m) => ({ default: m.MapVolume })),
);
import { centerOf, toLocal } from "../../worker/volume.js";
import { BASE } from "../api";
import { reduceMotion } from "../motion";
import "maplibre-gl/dist/maplibre-gl.css";
setWorkerUrl(workerUrl);
export type MapControl = {
  home: () => void;
  uncover: (design?: Design) => void;
  focus: (place: Place) => void;
  center: () => { lng: number; lat: number };
  volume: (design: Design, plan?: boolean) => void;
  orbit: (delta: number) => void;
  capture: () => Promise<string>;
};
const reduced = reduceMotion;
export function ParisMap({
  places,
  proposals,
  constructions,
  selected,
  building,
  onSelect,
  onProposal,
  onBlank,
  control,
  design,
  styleId = "haussmannien",
  volumeTool = "orbit",
  sketch = null,
  onDesignChange = () => {},
  onSketchPoint = () => {},
}: {
  places: Place[];
  proposals: Proposal[];
  constructions: Proposal[];
  selected: string | null;
  building: boolean;
  onSelect: (id: string) => void;
  onProposal: (p: Proposal) => void;
  onBlank: (point?: { lng: number; lat: number }) => void;
  control: RefObject<MapControl | null>;
  design?: Design;
  styleId?: string;
  volumeTool?: VolumeTool;
  sketch?: Coordinate[] | null;
  onDesignChange?: (design: Design, commit?: boolean) => void;
  onSketchPoint?: (point: Coordinate) => void;
}) {
  const language = useLanguage();
  const volumeEngine = useRef<VolumeEngine | null>(null);
  const published = useRef(constructions);
  published.current = constructions;
  const container = useRef<HTMLDivElement>(null),
    map = useRef<MapInstance | null>(null);
  const compass = useRef<HTMLSpanElement>(null);
  const markers = useRef<
    Record<string, { marker: Marker; el: HTMLButtonElement; key: string }>
  >({});
  const currentPlace = useRef(places.find((p) => p.id === selected));
  currentPlace.current = places.find((p) => p.id === selected);
  const latestSelected = useRef(selected);
  latestSelected.current = selected;
  const editor = useRef({ volumeTool, onSketchPoint, building });
  editor.current = { volumeTool, onSketchPoint, building };
  const currentDesign = useRef(design);
  currentDesign.current = design;
  const callbacks = useRef({ onSelect, onProposal, onBlank });
  callbacks.current = { onSelect, onProposal, onBlank };
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [threeD, setThreeD] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!container.current) return;
    setReady(false);
    let m: MapInstance;
    try {
      m = new Map({
        container: container.current,
        style: BASE + "/paris-map.json",
        center: [2.342, 48.858],
        zoom: 12.5,
        minZoom: 11,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        maxZoom: 20,
        maxBounds: [
          [2.15, 48.75],
          [2.51, 48.99],
        ],
        attributionControl: false,
        locale: {
          "AttributionControl.ToggleAttribution": t("Crédits de la carte"),
        },
        pitch: 42,
        bearing: -18,
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
      if (compass.current)
        compass.current.style.transform = `rotate(${-m.getBearing()}deg)`;
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
    const detail = () =>
      container.current?.setAttribute(
        "data-detail",
        String(m.getZoom() >= 15 && m.getPitch() > 10),
      );
    m.on("move", detail);
    m.on("idle", () => {
      detail();
      container.current?.setAttribute("data-ready", "true");
    });
    m.on("movestart", () =>
      container.current?.setAttribute("data-ready", "false"),
    );
    m.on("pitchend", () => setThreeD(m.getPitch() > 10));
    m.on("rotate", () => {
      if (compass.current)
        compass.current.style.transform = `rotate(${-m.getBearing()}deg)`;
    });
    m.on("click", (e) => {
      if (editor.current.volumeTool !== "orbit") return;
      const id = editor.current.building
        ? undefined
        : volumeEngine.current?.pick(e.point);
      const proposal = published.current.find((p) => p.id === id);
      if (proposal) callbacks.current.onProposal(proposal);
      else callbacks.current.onBlank({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
    const centre = () =>
      m.unproject([
        m.getContainer().clientWidth / 2,
        m.getContainer().clientHeight / 2,
      ]);
    m.getCanvas().addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const p = centre();
        if (editor.current.volumeTool === "draw")
          editor.current.onSketchPoint([p.lng, p.lat]);
        else callbacks.current.onBlank(p);
      }
    });
    m.getCanvas().setAttribute(
      "aria-label",
      t(
        "Carte de Paris. Flèches pour déplacer, plus et moins pour zoomer, Entrée pour choisir le point central.",
      ),
    );
    let cameraPlaced = false;
    const focus = (p: Place) => {
      cameraPlaced = true;
      return requestAnimationFrame(() => {
        if (map.current !== m) return;
        const mobile = window.innerWidth < 800;
        const height = m.getContainer().clientHeight;
        const top = Math.min(120, height * 0.2);
        m.flyTo({
          center: [p.lng, p.lat],
          zoom: 15.7,
          pitch: 54,
          bearing: -15,
          duration: reduced() ? 0 : 680,
          padding: mobile
            ? {
                top,
                bottom: Math.min(
                  Math.max(0, height - top - 80),
                  (document
                    .querySelector(".map-sheet:not([data-exiting])")
                    ?.getBoundingClientRect().height || 220) + 24,
                ),
                left: 30,
                right: 50,
              }
            : { left: 460, right: 60, top: 70, bottom: 40 },
        });
      });
    };
    const home = () =>
      m.flyTo({
        center: [2.344, 48.863],
        zoom: window.innerWidth < 800 ? 13.4 : 13.3,
        pitch: 42,
        bearing: -18,
        duration: reduced() ? 0 : 650,
        padding:
          window.innerWidth < 800
            ? {
                top: Math.min(120, m.getContainer().clientHeight * 0.18),
                bottom: Math.min(170, m.getContainer().clientHeight * 0.2),
                left: 0,
                right: 0,
              }
            : { top: 80, bottom: 100, left: 420, right: 50 },
      });
    const fittedZoom = (d: Design, plan = false) => {
      const origin = centerOf(d.footprint);
      const span =
        Math.max(...d.footprint.map((p) => Math.hypot(...toLocal(p, origin)))) *
        2;
      return (
        (plan ? 18.2 : 17.4) -
        Math.log2(Math.max(1, span / 70, plan ? 1 : d.height / 45))
      );
    };
    const volume = (d: Design, plan = false) => {
      cameraPlaced = true;
      const mobile = innerWidth < 800;
      const height = m.getContainer().clientHeight;
      const landmark = currentPlace.current;
      const direction = landmark
        ? toLocal([landmark.lng, landmark.lat], centerOf(d.footprint))
        : [0, 0];
      const bearing =
        Math.hypot(...direction) > 15
          ? (Math.atan2(direction[0], direction[1]) * 180) / Math.PI
          : m.getBearing();
      m.easeTo({
        center: centerOf(d.footprint),
        zoom: fittedZoom(d, plan),
        pitch: plan ? 0 : 58,
        bearing: plan ? 0 : bearing,
        padding: mobile
          ? {
              top: 70,
              bottom: Math.min(height * 0.48, 340),
              left: 20,
              right: 20,
            }
          : { top: 80, bottom: 60, left: 450, right: 60 },
        duration: reduced() ? 0 : 280,
      });
    };
    const capture = async () => {
      const d = currentDesign.current;
      if (!d) throw new Error(t("La maquette n'est pas prête. Réessaie."));
      const saved = {
        center: m.getCenter(),
        zoom: m.getZoom(),
        pitch: m.getPitch(),
        bearing: m.getBearing(),
        padding: m.getPadding(),
      };
      m.stop();
      // Finish the final geometry rebuild before sampling the shared WebGL canvas.
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (!m.getLayer("corbs-volume"))
        throw new Error(t("La maquette n'est pas prête. Réessaie."));
      try {
        volumeEngine.current?.capture(true);
        return await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => {
            m.off("render", render);
            reject(new Error(t("La maquette n'est pas prête. Réessaie.")));
          }, 12000);
          const render = () => {
            if (!m.areTilesLoaded()) return;
            m.off("render", render);
            clearTimeout(timer);
            try {
              const source = m.getCanvas(),
                size = Math.min(source.width, source.height);
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 768;
              canvas
                .getContext("2d")!
                .drawImage(
                  source,
                  (source.width - size) / 2,
                  (source.height - size) / 2,
                  size,
                  size,
                  0,
                  0,
                  768,
                  768,
                );
              resolve(canvas.toDataURL("image/jpeg", 0.85));
            } catch (error) {
              reject(error);
            }
          };
          m.on("render", render);
          m.jumpTo({
            center: centerOf(d.footprint),
            zoom: fittedZoom(d) - 0.35,
            pitch: 55,
            padding: { top: 0, bottom: 0, left: 0, right: 0 },
          });
          m.triggerRepaint();
        });
      } finally {
        volumeEngine.current?.capture(false);
        m.jumpTo(saved);
      }
    };
    control.current = {
      uncover: (design) => {
        cameraPlaced = true;
        return m.easeTo({
          center: design ? centerOf(design.footprint) : m.getCenter(),
          zoom: design
            ? Math.max(m.getZoom(), Math.min(fittedZoom(design), 16.4))
            : m.getZoom(),
          padding:
            innerWidth < 800
              ? { top: 140, bottom: 170, left: 20, right: 40 }
              : { top: 100, bottom: 170, left: 40, right: 60 },
          duration: reduced() ? 0 : 280,
        });
      },
      focus,
      home,
      center: centre,
      volume,
      capture,
      orbit: (delta) =>
        m.easeTo({
          bearing: m.getBearing() + delta,
          duration: reduced() ? 0 : 280,
        }),
    };
    m.once("load", () => {
      if (
        !cameraPlaced &&
        !latestSelected.current &&
        !location.pathname.includes("/p/")
      )
        home();
    });
    const observer = new ResizeObserver(() => {
      m.resize();
      const { width, height } = m.getContainer().getBoundingClientRect();
      const { top = 0, bottom = 0, left = 0, right = 0 } = m.getPadding();
      if (left + right > width - 100 || top + bottom > height - 100)
        m.setPadding({
          left: Math.min(left, width * 0.2),
          right: Math.min(right, width * 0.2),
          top: Math.min(top, height * 0.2),
          bottom: Math.min(bottom, height * 0.4),
        });
    });
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
    if (!m || !ready || !m.getLayer("paris-place-labels")) return;
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
    m.getCanvas().setAttribute(
      "aria-label",
      t(
        "Carte de Paris. Flèches pour déplacer, plus et moins pour zoomer, Entrée pour choisir le point central.",
      ),
    );
    container.current
      ?.querySelector(".maplibregl-ctrl-attrib summary")
      ?.setAttribute("aria-label", t("Crédits de la carte"));
    for (const place of places) {
      const items = proposals.filter((p) => p.place_id === place.id);
      const active = selected === place.id;
      const key = JSON.stringify([
        active,
        building,
        language,
        items.map((p) => [p.id, p.title, p.image, !!p.design]),
      ]);
      const cached = markers.current[place.id];
      if (cached?.key === key) continue;
      const el = cached?.el || document.createElement("button");
      el.type = "button";
      el.replaceChildren();
      // Preserve MapLibre's positioning classes on every render.
      el.classList.add("city-pin");
      el.classList.toggle("has-photo", !!items.length && !building);
      el.classList.toggle(
        "has-volume",
        items.some((p) => p.design) && !building,
      );
      el.classList.toggle("selected", active);
      el.classList.toggle("build-pin", building);
      el.dataset.lng = String(place.lng);
      el.dataset.lat = String(place.lat);
      el.setAttribute(
        "aria-label",
        items.length && !building
          ? `${items[0].title}, ${t(place.name)}${items.length > 1 ? `, ${t("{n} créations", { n: items.length })}` : ""}`
          : t("Construire à {lieu}", { lieu: t(place.name) }),
      );
      el.title = t(place.name);
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
        label.textContent = t(place.name);
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
            anchor: "center",
            pitchAlignment: "viewport",
          })
            .setLngLat([place.lng, place.lat])
            .addTo(m),
      };
      markers.current[place.id].marker
        .setOffset([0, items.length && !building ? -35 : 0])
        .setLngLat([place.lng, place.lat]);
    }
    for (const [id, item] of Object.entries(markers.current))
      if (!places.some((p) => p.id === id)) {
        item.marker.remove();
        delete markers.current[id];
      }
  }, [places, proposals, selected, building, ready, language]);
  return (
    <>
      <div
        ref={container}
        className="paris-map"
        role="region"
        aria-label={t("Carte commune de Paris")}
      />
      {ready &&
        map.current &&
        (design ||
          constructions.some(
            (p) => p.published_at && p.design && p.status === "ready",
          )) && (
          <Suspense fallback={null}>
            <MapVolume
              map={map.current}
              constructions={constructions}
              onEngine={(engine) => {
                volumeEngine.current = engine;
              }}
              design={design}
              styleId={styleId}
              tool={volumeTool}
              sketch={sketch}
              onChange={onDesignChange}
              onPoint={onSketchPoint}
            />
          </Suspense>
        )}
      {failed && (
        <button
          className="map-retry"
          onClick={() => {
            setFailed(false);
            setRetry((n) => n + 1);
          }}
        >
          {t("Recharger la carte")}
        </button>
      )}
      <div className="map-tools" aria-label={t("Commandes de la carte")}>
        <button
          className="map-tool view-mode"
          aria-label={threeD ? t("Vue 2D") : t("Vue 3D")}
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
          <Box size={20} strokeWidth={1.6} />
          <span>{threeD ? "2D" : "3D"}</span>
        </button>
        <button
          className="map-tool map-compass"
          aria-label={t("Orienter au nord")}
          onClick={() =>
            map.current?.easeTo({ bearing: 0, duration: reduced() ? 0 : 350 })
          }
        >
          <span ref={compass} className="compass-needle" aria-hidden="true" />
        </button>
        {selected && threeD && (
          <button
            className="map-tool"
            aria-label={t("Tourner autour du lieu")}
            onClick={() => {
              const m = map.current;
              if (m)
                m.easeTo({
                  bearing: m.getBearing() + 60,
                  duration: reduced() ? 0 : 650,
                });
            }}
          >
            <Rotate3d size={21} strokeWidth={1.7} />
          </button>
        )}
        <button
          className="map-tool"
          aria-label={t("Recentrer sur Paris")}
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
            aria-label={t("Zoomer")}
            onClick={() =>
              map.current?.zoomIn({ duration: reduced() ? 0 : 200 })
            }
          >
            <Plus size={19} />
          </button>
          <button
            className="map-tool"
            aria-label={t("Dézoomer")}
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

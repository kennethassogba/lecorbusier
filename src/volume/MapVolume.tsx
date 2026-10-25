import { useEffect, useRef } from "react";
import {
  Marker,
  type Map,
  type GeoJSONSource,
  type FilterSpecification,
} from "maplibre-gl";
import type { Coordinate, Design } from "../types";
import {
  centerOf,
  toLocal,
  toLngLat,
  transformDesign,
} from "../../worker/volume.js";
import { volumeLayer } from "./layer";
import { t, useLanguage } from "../i18n";

export type VolumeTool = "orbit" | "edit" | "draw";
export function MapVolume({
  map,
  design,
  styleId,
  tool,
  sketch,
  onChange,
  onPoint,
}: {
  map: Map;
  design?: Design;
  styleId: string;
  tool: VolumeTool;
  sketch: Coordinate[] | null;
  onChange: (design: Design, commit?: boolean) => void;
  onPoint: (point: Coordinate) => void;
}) {
  const language = useLanguage();
  const footprintKey = JSON.stringify(design?.footprint);
  const markers = useRef<{ marker: Marker; index: number }[]>([]);
  const dragging = useRef<Marker | null>(null);
  const originalCityFilter = useRef<FilterSpecification | undefined>(undefined);
  const engine = useRef<ReturnType<typeof volumeLayer> | null>(null);
  const latest = useRef({ design, tool, sketch, onChange, onPoint });
  latest.current = { design, tool, sketch, onChange, onPoint };
  useEffect(() => {
    if (!map.getStyle()) return;
    originalCityFilter.current = map.getFilter("paris-buildings") || undefined;
    const volume = volumeLayer();
    engine.current = volume;
    map.addLayer(volume.layer);
    map.addSource("corbs-plan", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "corbs-plan-fill",
      type: "fill",
      source: "corbs-plan",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": "#0759f9", "fill-opacity": 0.12 },
    });
    map.addLayer({
      id: "corbs-plan-line",
      type: "line",
      source: "corbs-plan",
      paint: {
        "line-color": "#0759f9",
        "line-width": 2.5,
        "line-dasharray": [2, 1],
      },
    });
    const click = (event: { lngLat: { lng: number; lat: number } }) => {
      if (latest.current.tool === "draw")
        latest.current.onPoint([event.lngLat.lng, event.lngLat.lat]);
    };
    map.on("click", click);
    return () => {
      map.off("click", click);
      if (!map.getStyle()) return;
      if (map.getLayer("paris-buildings"))
        map.setFilter("paris-buildings", originalCityFilter.current);
      for (const id of ["corbs-volume", "corbs-plan-fill", "corbs-plan-line"])
        if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource("corbs-plan")) map.removeSource("corbs-plan");
      engine.current = null;
    };
  }, [map]);
  useEffect(() => {
    if (!engine.current) return;
    engine.current.update(tool === "draw" ? undefined : design, styleId);
  }, [map, design, styleId, tool]);
  useEffect(() => {
    if (!engine.current) return;
    // Changing the height must not reparse the city vector tiles.
    // The proposed footprint replaces intersecting context blocks instead of occupying their interiors.
    if (map.getLayer("paris-buildings")) {
      const footprint = design
        ? {
            type: "Polygon",
            coordinates: [[...design.footprint, design.footprint[0]]],
          }
        : null;
      map.setFilter(
        "paris-buildings",
        footprint
          ? ([
              "all",
              ...(originalCityFilter.current
                ? [originalCityFilter.current]
                : []),
              [">", ["distance", footprint], 0],
            ] as FilterSpecification)
          : originalCityFilter.current,
      );
    }
  }, [map, footprintKey]);
  useEffect(() => {
    if (!engine.current) return;
    const points = sketch || design?.footprint || [];
    const geometry =
      points.length >= 3
        ? { type: "Polygon" as const, coordinates: [[...points, points[0]]] }
        : points.length >= 2
          ? { type: "LineString" as const, coordinates: points }
          : null;
    (map.getSource("corbs-plan") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: geometry ? [{ type: "Feature", geometry, properties: {} }] : [],
    });
    map.setLayoutProperty(
      "corbs-plan-line",
      "visibility",
      tool === "orbit" ? "none" : "visible",
    );
    map.setLayoutProperty(
      "corbs-plan-fill",
      "visibility",
      tool === "orbit" ? "none" : "visible",
    );
  }, [map, footprintKey, tool, sketch]);
  useEffect(() => {
    if (!design || tool === "orbit") return;
    const handles: Marker[] = [];
    const points = sketch || design.footprint;
    points.forEach((point, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "volume-vertex";
      button.textContent = String(index + 1);
      button.setAttribute(
        "aria-label",
        t("Angle {n}. Flèches pour déplacer.", { n: index + 1 }),
      );
      const marker = new Marker({
        element: button,
        draggable: tool === "edit",
        anchor: "center",
      })
        .setLngLat(point)
        .addTo(map);
      handles.push(marker);
      markers.current.push({ marker, index });
      marker.on("dragstart", () => {
        dragging.current = marker;
      });
      button.onclick = (e) => e.stopPropagation();
      const change = (p: Coordinate, commit: boolean) => {
        const current = latest.current.design;
        if (!current) return;
        latest.current.onChange(
          {
            ...current,
            footprint: current.footprint.map((v, i) => (i === index ? p : v)),
          },
          commit,
        );
      };
      marker.on("drag", () => {
        const p = marker.getLngLat();
        change([p.lng, p.lat], false);
      });
      marker.on("dragend", () => {
        dragging.current = null;
        const p = marker.getLngLat();
        change([p.lng, p.lat], true);
        requestAnimationFrame(() => {
          const saved = latest.current.design?.footprint[index];
          if (saved) marker.setLngLat(saved);
        });
      });
      button.onkeydown = (e) => {
        if (
          tool !== "edit" ||
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        const p = latest.current.design!.footprint[index],
          step = e.shiftKey ? 5 : 1;
        change(
          toLngLat(
            [
              e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
              e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0,
            ],
            p,
          ),
          true,
        );
      };
    });
    if (tool === "edit") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "volume-move";
      button.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3"/></svg>';
      button.setAttribute("aria-label", t("Déplacer le bâtiment"));
      const marker = new Marker({ element: button, draggable: true })
        .setLngLat(centerOf(design.footprint))
        .addTo(map);
      handles.push(marker);
      markers.current.push({ marker, index: -1 });
      let start = design;
      marker.on("dragstart", () => {
        dragging.current = marker;
        start = latest.current.design!;
      });
      const move = (commit: boolean) => {
        const p = marker.getLngLat(),
          [east, north] = toLocal([p.lng, p.lat], centerOf(start.footprint));
        latest.current.onChange(
          transformDesign(start, { east, north }),
          commit,
        );
      };
      marker.on("drag", () => move(false));
      marker.on("dragend", () => {
        dragging.current = null;
        move(true);
        requestAnimationFrame(() => {
          if (latest.current.design)
            marker.setLngLat(centerOf(latest.current.design.footprint));
        });
      });
      button.onclick = (e) => e.stopPropagation();
      button.onkeydown = (e) => {
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? 5 : 1;
        latest.current.onChange(
          transformDesign(latest.current.design!, {
            east:
              e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
            north:
              e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0,
          }),
          true,
        );
      };
    }
    return () => {
      handles.forEach((m) => m.remove());
      markers.current = [];
      dragging.current = null;
    };
    // Keep pointer capture and marker instances while vertices are being dragged.
  }, [map, tool, sketch?.length, design?.footprint.length, language]);
  useEffect(() => {
    if (tool !== "edit" || !design) return;
    markers.current.forEach(({ marker, index }) => {
      if (marker !== dragging.current)
        marker.setLngLat(
          index < 0 ? centerOf(design.footprint) : design.footprint[index],
        );
    });
  }, [map, design, tool]);
  return null;
}

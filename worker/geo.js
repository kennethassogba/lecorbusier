import boundary from "../data/paris-boundary.json" with { type: "json" };
import { clean } from "./domain.js";
const BASE = "/corbs";
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i],
      [xx, yy] = ring[j];
    if (y > lat !== yy > lat && lng < ((xx - x) * (lat - y)) / (yy - y) + x)
      inside = !inside;
  }
  return inside;
}
export function inParis(lng, lat) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const polygons =
    boundary.type === "Polygon" ? [boundary.coordinates] : boundary.coordinates;
  return polygons.some(
    (rings) =>
      inRing(lng, lat, rings[0]) &&
      !rings.slice(1).some((ring) => inRing(lng, lat, ring)),
  );
}
export function customPlace(location) {
  if (
    !location ||
    typeof location.lat !== "number" ||
    typeof location.lng !== "number" ||
    !inParis(location.lng, location.lat)
  )
    throw new Error("Choisis un point dans Paris.");
  const lat = Number(location.lat.toFixed(5)),
    lng = Number(location.lng.toFixed(5));
  if (!inParis(lng, lat)) throw new Error("Choisis un point dans Paris.");
  const id = `point-${lat.toFixed(5)}-${lng.toFixed(5)}`;
  return {
    id,
    lat,
    lng,
    name: clean(location.name, 100) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    arrondissement: "Vue aérienne",
    referenceKind: "aerial",
    image: `${BASE}/api/reference/${id}.jpg`,
    sourceUrl: "https://geoservices.ign.fr/bdortho",
    author: "IGN · BD ORTHO",
    license: "Licence ouverte 2.0",
    licenseUrl: "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
    context: `Actual IGN aerial photograph centred exactly at ${lat}, ${lng}. The chosen site is at the exact centre. Preserve the surrounding street network, blocks, trees and existing landmarks. Build at the centre of the photograph; do not move the project to another site. This is an aerial view, not a street photograph.`,
  };
}
export function placeFromId(id) {
  const match = /^point-(\d{2}\.\d{5})-(\d\.\d{5})$/.exec(id);
  if (!match)
    throw new Error("Lieu introuvable. Choisis un point sur la carte.");
  return customPlace({ lat: Number(match[1]), lng: Number(match[2]) });
}
export function aerialUrl(place) {
  // 380 × 570 metres, portrait 1024 × 1536. WMS 1.3 EPSG:4326 axis order is latitude, longitude.
  const dy = 285 / 111320,
    dx = 190 / (111320 * Math.cos((place.lat * Math.PI) / 180));
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    LAYERS: "ORTHOIMAGERY.ORTHOPHOTOS",
    STYLES: "",
    CRS: "EPSG:4326",
    BBOX: [place.lat - dy, place.lng - dx, place.lat + dy, place.lng + dx].join(
      ",",
    ),
    WIDTH: "1024",
    HEIGHT: "1536",
    FORMAT: "image/jpeg",
  });
  return "https://data.geopf.fr/wms-r?" + params;
}
export async function aerialPhoto(place) {
  const r = await fetch(aerialUrl(place), {
    signal: AbortSignal.timeout(25000),
    cf: { cacheTtl: 86400, cacheEverything: true },
  });
  if (!r.ok || !r.headers.get("content-type")?.includes("image/"))
    throw new Error("Vue aérienne indisponible. Réessaie.");
  return r;
}
const first = (value) => (Array.isArray(value) ? value[0] : value);
export async function searchPlaces(query) {
  const params = new URLSearchParams({
    q: clean(query, 180),
    index: "address,poi",
    limit: "20",
    lat: "48.86",
    lon: "2.34",
    returntruegeometry: "false",
  });
  const r = await fetch("https://data.geopf.fr/geocodage/search?" + params, {
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error("Recherche indisponible. Choisis sur la carte.");
  const data = await r.json(),
    results = new Map();
  for (const f of data.features || []) {
    const [lng, lat] = f.geometry?.coordinates || [];
    if (!inParis(lng, lat)) continue;
    const name =
      f.properties.toponym || f.properties.label || first(f.properties.name);
    const p = customPlace({ lng, lat, name });
    results.set(p.id, p);
  }
  return [...results.values()].slice(0, 8);
}
export async function reversePlace(lng, lat) {
  const place = customPlace({ lng, lat });
  try {
    const r = await fetch(
      "https://data.geopf.fr/geocodage/reverse?" +
        new URLSearchParams({
          lon: String(lng),
          lat: String(lat),
          index: "address",
          limit: "1",
        }),
      { signal: AbortSignal.timeout(5000) },
    );
    if (r.ok) {
      const f = (await r.json()).features?.[0];
      // Keep the selected coordinates, even when the nearest address is across the street.
      if (f && (f.properties.distance ?? 0) < 180)
        place.name = clean(f.properties.label, 100) || place.name;
    }
  } catch {
    /* Coordinates remain usable when reverse lookup is unavailable. */
  }
  return place;
}

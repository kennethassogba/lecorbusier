import { inParis } from "./geo.js";
const METRES = 111320;
export const SITE_STARTS = {
  "gare-de-lyon": [-85, 45, 42, 28, -25, 28],
  "tour-eiffel": [85, -80, 48, 30, 40, 32],
  louvre: [-70, -5, 42, 30, 0, 26],
  "musee-orsay": [-55, -35, 36, 22, 0, 24],
  "opera-garnier": [20, -75, 38, 26, -15, 30],
  pantheon: [-75, 0, 35, 25, 0, 26],
  "notre-dame": [-100, -10, 42, 26, 18, 28],
  "hotel-de-ville": [-75, 0, 42, 28, -15, 28],
  "sacre-coeur": [0, -65, 32, 22, 0, 24],
  "arc-de-triomphe": [90, -25, 36, 24, 25, 30],
  bastille: [30, -45, 38, 25, 0, 32],
  concorde: [10, 60, 44, 30, 0, 30],
  republique: [0, 20, 40, 28, 35, 30],
  pompidou: [-65, -5, 38, 26, 0, 32],
  "grand-palais": [110, 0, 40, 28, -10, 28],
  invalides: [0, 120, 48, 30, 0, 30],
  "bibliotheque-france": [0, 0, 48, 32, -30, 36],
  "palais-royal": [0, -60, 34, 24, 0, 24],
  trocadero: [45, -45, 42, 28, 35, 28],
  conciergerie: [-55, -35, 32, 22, 0, 26],
};
export function toLocal(point, origin) {
  return [
    (point[0] - origin[0]) * METRES * Math.cos((origin[1] * Math.PI) / 180),
    (point[1] - origin[1]) * METRES,
  ];
}
export function toLngLat(point, origin) {
  return [
    origin[0] + point[0] / (METRES * Math.cos((origin[1] * Math.PI) / 180)),
    origin[1] + point[1] / METRES,
  ];
}
export function centerOf(points) {
  return [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length,
  ];
}
export function areaOf(points) {
  if (points.length < 3) return 0;
  const xy = points.map((p) => toLocal(p, points[0]));
  return (
    Math.abs(
      xy.reduce((sum, p, i) => {
        const q = xy[(i + 1) % xy.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ) / 2
  );
}
export function templateAt(
  origin,
  width = 42,
  depth = 28,
  kind = "rectangle",
  bearing = 0,
) {
  let points =
    kind === "l"
      ? [
          [-1, -1],
          [1, -1],
          [1, -0.1],
          [-0.1, -0.1],
          [-0.1, 1],
          [-1, 1],
        ]
      : kind === "u"
        ? [
            [-1, -1],
            [1, -1],
            [1, 1],
            [0.35, 1],
            [0.35, -0.25],
            [-0.35, -0.25],
            [-0.35, 1],
            [-1, 1],
          ]
        : [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ];
  const angle = (-bearing * Math.PI) / 180;
  return points.map(([x, y]) => {
    x *= width / 2;
    y *= depth / 2;
    return toLngLat(
      [
        x * Math.cos(angle) - y * Math.sin(angle),
        x * Math.sin(angle) + y * Math.cos(angle),
      ],
      origin,
    );
  });
}
export function defaultDesign(place) {
  const [east, north, width, depth, bearing, height] = SITE_STARTS[
    place.id
  ] || [0, 0, 36, 26, 0, 28];
  const origin = toLngLat([east, north], [place.lng, place.lat]);
  const candidate = (point, scale = 1) => ({
    version: 1,
    footprint: templateAt(
      point,
      width * scale,
      depth * scale,
      "rectangle",
      bearing,
    ),
    height,
  });
  // Near the city boundary, keep the whole starting footprint inside Paris.
  for (const radius of [0, 20, 40, 70, 100]) {
    for (let direction = 0; direction < (radius ? 8 : 1); direction++) {
      const angle = (direction * Math.PI) / 4;
      const point = toLngLat(
        [Math.cos(angle) * radius, Math.sin(angle) * radius],
        origin,
      );
      for (const scale of [1, 0.7, 0.4]) {
        try {
          return validateDesign(candidate(point, scale), place);
        } catch {}
      }
    }
  }
  return candidate(origin);
}
export function transformDesign(
  design,
  { scale = 1, angle = 0, east = 0, north = 0 },
) {
  const center = centerOf(design.footprint),
    rad = (-angle * Math.PI) / 180;
  return {
    ...design,
    footprint: design.footprint.map((p) => {
      const [x, y] = toLocal(p, center);
      return toLngLat(
        [
          scale * (x * Math.cos(rad) - y * Math.sin(rad)) + east,
          scale * (x * Math.sin(rad) + y * Math.cos(rad)) + north,
        ],
        center,
      );
    }),
  };
}
function crosses(a, b, c, d) {
  const cross = (p, q, r) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const on = (p, q, r) =>
    Math.min(p[0], q[0]) - 1e-8 <= r[0] &&
    r[0] <= Math.max(p[0], q[0]) + 1e-8 &&
    Math.min(p[1], q[1]) - 1e-8 <= r[1] &&
    r[1] <= Math.max(p[1], q[1]) + 1e-8;
  const x = cross(a, b, c),
    y = cross(a, b, d),
    z = cross(c, d, a),
    w = cross(c, d, b);
  return (
    (x * y < 0 && z * w < 0) ||
    (Math.abs(x) < 1e-8 && on(a, b, c)) ||
    (Math.abs(y) < 1e-8 && on(a, b, d)) ||
    (Math.abs(z) < 1e-8 && on(c, d, a)) ||
    (Math.abs(w) < 1e-8 && on(c, d, b))
  );
}
export function validateDesign(input, place) {
  const fail = () => {
    throw new Error(
      "Choisis un contour sans croisement, près du lieu, dans Paris.",
    );
  };
  if (
    !input ||
    input.version !== 1 ||
    !Array.isArray(input.footprint) ||
    input.footprint.length < 3 ||
    input.footprint.length > 20
  )
    fail();
  if (
    typeof input.height !== "number" ||
    !Number.isFinite(input.height) ||
    input.height < 6 ||
    input.height > 160
  )
    throw new Error("Choisis une hauteur entre 6 et 160 m.");
  const points = input.footprint.map((p) => {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      p.some((v) => typeof v !== "number" || !Number.isFinite(v)) ||
      !inParis(p[0], p[1])
    )
      fail();
    const xy = toLocal(p, [place.lng, place.lat]);
    if (Math.hypot(...xy) > 250) fail();
    return p.map((v) => Number(v.toFixed(7)));
  });
  const xy = points.map((p) => toLocal(p, points[0]));
  for (let i = 0; i < xy.length; i++) {
    const next = (i + 1) % xy.length;
    if (Math.hypot(xy[i][0] - xy[next][0], xy[i][1] - xy[next][1]) < 2) fail();
    // A segment may not cross a concave section of the city boundary.
    for (let k = 1; k < 10; k++)
      if (
        !inParis(
          points[i][0] + ((points[next][0] - points[i][0]) * k) / 10,
          points[i][1] + ((points[next][1] - points[i][1]) * k) / 10,
        )
      )
        fail();
    for (let j = i + 1; j < xy.length; j++)
      if (
        j !== next &&
        (j + 1) % xy.length !== i &&
        crosses(xy[i], xy[next], xy[j], xy[(j + 1) % xy.length])
      )
        fail();
  }
  const area = areaOf(points);
  if (area < 60 || area > 40000)
    throw new Error("Choisis une surface entre 60 et 40 000 m².");
  return { version: 1, footprint: points, height: Math.round(input.height) };
}
export function designSummary(design) {
  if (!design) return "";
  return `Authoritative player design: footprint WGS84 [longitude,latitude] ${JSON.stringify(design.footprint)}; total architectural height ${design.height} metres, footprint area ${Math.round(areaOf(design.footprint))} square metres. Match this footprint, height, silhouette, roof and facade rhythm. The FIRST reference image is the exact player's 3D model in its real map location and is the camera/composition reference. The SECOND reference is a photograph used ONLY for the real landmark identity and materials, never its camera. Keep the surroundings and monument identifiable. Turn the model view into a photograph; remove map labels and drawing handles. Do not invent another volume or substitute a generic tower.`;
}

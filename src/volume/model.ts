import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { areaOf, centerOf, toLocal } from "../../worker/volume.js";
import type { Coordinate, Design } from "../types";

export function buildModel(design: Design, style: string) {
  const origin = centerOf(design.footprint);
  const points = design.footprint.map((p) => toLocal(p, origin));
  const group = new THREE.Group();
  const materials = {
    stone: new THREE.MeshStandardMaterial({
      color: style === "brutaliste" ? 0xbfc5cd : 0xe6e9ed,
      roughness: 0.83,
    }),
    trim: new THREE.MeshStandardMaterial({ color: 0xf6f8fb, roughness: 0.7 }),
    zinc: new THREE.MeshStandardMaterial({
      color: 0x4b596b,
      metalness: 0.45,
      roughness: 0.5,
    }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b293b, roughness: 0.55 }),
    window: new THREE.MeshStandardMaterial({
      color: 0x52738c,
      metalness: 0.25,
      roughness: 0.24,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x9ac8e8,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      roughness: 0.15,
      side: THREE.DoubleSide,
    }),
    blue: new THREE.MeshStandardMaterial({ color: 0x0860f7, roughness: 0.4 }),
  };
  type MaterialKey = keyof typeof materials;
  const batches: Partial<Record<MaterialKey, THREE.BufferGeometry[]>> = {};
  const add = (geometry: THREE.BufferGeometry, material: MaterialKey) => {
    const safe = geometry.index ? geometry.toNonIndexed() : geometry;
    if (safe !== geometry) geometry.dispose();
    safe.deleteAttribute("uv");
    (batches[material] ||= []).push(safe);
  };
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    material: MaterialKey,
    angle = 0,
  ) => {
    const geometry = new THREE.BoxGeometry(w, d, h);
    geometry.rotateZ(angle);
    geometry.translate(x, y, z + h / 2);
    add(geometry, material);
  };
  const shape = (polygon: Coordinate[]) =>
    new THREE.Shape(polygon.map((p) => new THREE.Vector2(...p)));
  const solid = (
    polygon: Coordinate[],
    base: number,
    height: number,
    material: MaterialKey,
  ) => {
    const geometry = new THREE.ExtrudeGeometry(shape(polygon), {
      depth: height,
      bevelEnabled: false,
      steps: 1,
    });
    geometry.translate(0, 0, base);
    add(geometry, material);
  };
  const ring = (scale: number) =>
    points.map(([x, y]) => [x * scale, y * scale] as Coordinate);
  const inside = (x: number, y: number, poly = points) => {
    let value = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i],
        b = poly[j];
      if (
        a[1] > y !== b[1] > y &&
        x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
      )
        value = !value;
    }
    return value;
  };
  const cylinder = (
    x: number,
    y: number,
    z: number,
    r: number,
    height: number,
    material: MaterialKey,
    top = r,
  ) => {
    const geometry = new THREE.CylinderGeometry(top, r, height, 16);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(x, y, z + height / 2);
    add(geometry, material);
  };
  const height = design.height;
  const roofFraction =
    style === "gothique"
      ? 0.23
      : ["haussmannien", "baroque", "rococo", "art-deco"].includes(style)
        ? 0.2
        : 0.1;
  const body = Math.min(height - 2.5, height * (1 - roofFraction)),
    gallery = Math.min(5.5, body * 0.3);
  solid(points, 0, 0.7, "stone");
  solid(ring(0.98), gallery, body - gallery, "stone");
  solid(ring(1.015), gallery, 0.35, "trim");
  solid(ring(1.015), body - 0.5, 0.5, "trim");
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  // Actual server cabinets in a glazed ground-floor gallery.
  const rackSpacing = Math.max(4, Math.sqrt(areaOf(design.footprint) / 160));
  for (let x = minX + 3; x < maxX - 2; x += rackSpacing)
    for (let y = minY + 3; y < maxY - 2; y += rackSpacing) {
      if (!inside(x, y) || !inside(x + 1, y + 0.7) || !inside(x - 1, y - 0.7))
        continue;
      box(x, y, 0.7, 1.2, 2, Math.max(1.2, gallery - 1.2), "dark");
      for (let z = 1; z < gallery - 0.5; z += 0.45)
        box(x, y - 1.015, z, 0.85, 0.06, 0.05, "trim");
      box(x + 0.42, y - 1.04, 1.3, 0.05, 0.05, 0.08, "blue");
    }
  let signed = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    signed += p[0] * q[1] - q[0] * p[1];
  });
  const floors = Math.max(1, Math.round((body - gallery) / 4));
  const floorHeight = (body - gallery) / floors;
  let longest = 0,
    front = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length],
      dx = q[0] - p[0],
      dy = q[1] - p[1],
      length = Math.hypot(dx, dy),
      angle = Math.atan2(dy, dx);
    if (length > longest) {
      longest = length;
      front = i;
    }
    const outward: Coordinate =
      signed > 0 ? [dy / length, -dx / length] : [-dy / length, dx / length];
    const along = (distance: number, offset = 0): Coordinate => [
      p[0] + (dx * distance) / length + outward[0] * offset,
      p[1] + (dy * distance) / length + outward[1] * offset,
    ];
    const count = Math.max(1, Math.min(30, Math.round(length / 3.6))),
      bay = length / count;
    const mid = along(length / 2);
    box(...mid, 0.7, length, 0.1, gallery - 0.7, "glass", angle);
    for (let i = 0; i <= count; i++) {
      const at = along(Math.min(i * bay, length), 0.07);
      box(...at, 0.7, 0.24, 0.42, gallery - 0.7, "zinc", angle);
    }
    for (let floor = 0; floor < floors; floor++) {
      const z = gallery + floor * floorHeight + 0.65;
      for (let i = 0; i < count; i++) {
        const at = along((i + 0.5) * bay, 0.055);
        const glassWidth =
          bay *
          (style === "brutaliste"
            ? 0.45
            : style === "contemporain"
              ? 0.92
              : 0.62);
        box(
          ...at,
          z,
          glassWidth,
          0.12,
          Math.max(0.6, floorHeight - 1.1),
          "window",
          angle,
        );
        if (style !== "contemporain") {
          box(...at, z - 0.12, glassWidth + 0.28, 0.42, 0.2, "trim", angle);
          box(
            ...at,
            z + floorHeight - 1,
            glassWidth + 0.28,
            0.3,
            0.15,
            "trim",
            angle,
          );
        }
        if (style === "gothique") {
          const cap = new THREE.ConeGeometry(
            glassWidth * 0.6,
            Math.min(1, floorHeight * 0.25),
            3,
          );
          cap.rotateX(Math.PI / 2);
          cap.rotateZ(angle);
          cap.translate(at[0], at[1], z + floorHeight - 0.8);
          add(cap, "trim");
        }
        if (style === "brutaliste") {
          const edge = along(i * bay, 0.3);
          box(...edge, z - 0.5, 0.6, 1.2, floorHeight, "stone", angle);
        }
      }
      if (style === "haussmannien" && (floor === 1 || floor === floors - 1)) {
        const at = along(length / 2, 0.4);
        box(...at, z - 0.5, length, 1.1, 0.22, "stone", angle);
        box(...at, z + 0.4, length, 0.08, 0.08, "dark", angle);
        for (let n = 0; n < length; n += 0.75) {
          const post = along(n, 0.9);
          box(...post, z - 0.4, 0.05, 0.05, 0.9, "dark");
        }
      }
    }
    if (
      [
        "classique",
        "neoclassique",
        "baroque",
        "rococo",
        "art-deco",
        "art-nouveau",
      ].includes(style)
    ) {
      for (let i = 0; i <= count; i++) {
        const at = along(i * bay, 0.16);
        if (style === "art-deco")
          box(...at, gallery, 0.45, 0.65, body - gallery, "trim", angle);
        else
          cylinder(
            ...at,
            gallery,
            style === "neoclassique" ? 0.38 : 0.22,
            body - gallery - 0.4,
            "trim",
          );
      }
    }
  });
  // All roof variations fit within the player's total height.
  const roofTop = height - 2.5;
  if (["haussmannien", "gothique", "art-nouveau"].includes(style)) {
    const top = ring(style === "gothique" ? 0.25 : 0.78),
      vertices: number[] = [];
    points.forEach((a, i) => {
      const j = (i + 1) % points.length,
        b = points[j],
        c = top[j],
        d = top[i];
      vertices.push(
        ...a,
        body,
        ...b,
        body,
        ...c,
        roofTop,
        ...a,
        body,
        ...c,
        roofTop,
        ...d,
        roofTop,
      );
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.computeVertexNormals();
    add(geometry, "zinc");
    solid(top, roofTop, 0.2, "zinc");
    if (style === "gothique")
      points.forEach(([x, y]) =>
        cylinder(x * 0.95, y * 0.95, body, 0.9, height - body, "zinc", 0),
      );
  } else if (style === "art-deco") {
    for (let tier = 0; tier < 4; tier++)
      solid(
        ring(1 - tier * 0.14),
        body + ((height - body - 2) * tier) / 4,
        (height - body - 2) / 4,
        "stone",
      );
  } else if (["baroque", "rococo"].includes(style) && inside(0, 0)) {
    solid(points, body, 0.5, "zinc");
    const r = Math.max(2, Math.min(maxX - minX, maxY - minY) * 0.23);
    const dome = new THREE.SphereGeometry(
      r,
      24,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    dome.rotateX(Math.PI / 2);
    dome.scale(1, 1, (height - body - 1) / r);
    dome.translate(0, 0, body);
    add(dome, "zinc");
    cylinder(0, 0, height - 1, 0.35, 1, "trim", 0.15);
  } else {
    solid(points, body, 0.6, "zinc");
  }
  // Cooling plant remains a visible part of every style, including heritage roofs.
  const plantBase = ["haussmannien", "gothique", "art-nouveau"].includes(style)
    ? roofTop + 0.2
    : body + 0.6;
  const roofPoints = ring(
    ["haussmannien", "gothique", "art-nouveau"].includes(style) ? 0.65 : 0.85,
  );
  let plants = 0;
  for (let x = minX + 4; x < maxX - 3; x += 6)
    for (let y = minY + 4; y < maxY - 3; y += 6) {
      if (
        plants >= 10 ||
        !inside(x, y, roofPoints) ||
        !inside(x + 1.5, y + 1.5, roofPoints) ||
        !inside(x - 1.5, y - 1.5, roofPoints)
      )
        continue;
      if (
        ["baroque", "rococo"].includes(style) &&
        Math.hypot(x, y) < Math.min(maxX - minX, maxY - minY) * 0.28
      )
        continue;
      box(x, y, plantBase, 3.4, 2.5, 1.1, "trim");
      for (const offset of [-0.85, 0.85]) {
        cylinder(x + offset, y, plantBase + 1.1, 0.72, 0.15, "dark");
        for (let a = 0; a < 3; a++)
          box(
            x + offset,
            y,
            plantBase + 1.26,
            1.15,
            0.18,
            0.035,
            "zinc",
            (a * Math.PI) / 3,
          );
      }
      plants++;
    }
  // A compact sign identifies the industrial use without a billboard.
  const a = points[front],
    b = points[(front + 1) % points.length],
    angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const textureCanvas =
    typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (textureCanvas) {
    textureCanvas.width = 512;
    textureCanvas.height = 80;
    const ctx = textureCanvas.getContext("2d")!;
    ctx.fillStyle = "#17283c";
    ctx.fillRect(0, 0, 512, 80);
    ctx.fillStyle = "#fff";
    ctx.font = "600 38px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DATA CENTER", 256, 55);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(12, longest * 0.6), 1.8),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    sign.rotation.set(Math.PI / 2, 0, angle, "ZXY");
    sign.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, gallery - 0.8);
    group.add(sign);
  }
  for (const [key, parts] of Object.entries(batches)) {
    const geometry = mergeGeometries(parts!);
    parts!.forEach((g) => g.dispose());
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, materials[key as MaterialKey]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  group.userData = { origin, height, style, vertices: points.length };
  return group;
}
export function disposeModel(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (Array.isArray(object.material)
        ? object.material
        : [object.material]
      ).forEach((m) => materials.add(m));
    }
  });
  materials.forEach((material) => {
    const map = (material as THREE.MeshBasicMaterial).map;
    map?.dispose();
    material.dispose();
  });
}

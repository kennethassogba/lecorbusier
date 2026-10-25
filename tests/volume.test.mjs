import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import {
  defaultDesign,
  validateDesign,
  templateAt,
  toLngLat,
  toLocal,
  areaOf,
  centerOf,
  transformDesign,
  designSummary,
} from "../worker/volume.js";
import { buildModel, disposeModel } from "../src/volume/model.ts";
import { STYLES } from "../worker/domain.js";
const places = JSON.parse(
  await readFile(new URL("../data/places.json", import.meta.url)),
);

test("Every monument starts with a valid, metre-scale footprint near its actual coordinates", () => {
  assert.equal(places.length, 20);
  for (const place of places) {
    const design = validateDesign(defaultDesign(place), place);
    assert.ok(areaOf(design.footprint) > 500, place.id);
    assert.ok(
      Math.hypot(
        ...toLocal(centerOf(design.footprint), [place.lng, place.lat]),
      ) < 150,
      place.id,
    );
  }
});
test("Footprints preserve dimensions through conversion, rotation and translation; L and U remain valid", () => {
  const place = places[2],
    origin = [place.lng, place.lat];
  const d = { version: 1, height: 32, footprint: templateAt(origin, 40, 30) };
  assert.ok(Math.abs(areaOf(d.footprint) - 1200) < 0.02);
  const changed = validateDesign(
    transformDesign(d, { scale: 1.2, angle: 35, east: 18, north: 8 }),
    place,
  );
  assert.ok(Math.abs(areaOf(changed.footprint) - 1728) < 1);
  const back = toLocal(toLngLat([45, 33], origin), origin);
  assert.ok(Math.abs(back[0] - 45) < 0.001 && Math.abs(back[1] - 33) < 0.001);
  for (const shape of ["l", "u"])
    assert.ok(
      validateDesign(
        { ...d, footprint: templateAt(origin, 40, 30, shape) },
        place,
      ),
    );
});
test("Invalid, crossing, remote and unbounded geometry is rejected before generation", () => {
  const place = places[0],
    d = defaultDesign(place),
    p = d.footprint;
  for (const design of [
    { ...d, footprint: [p[0], p[2], p[1], p[3]] },
    { ...d, height: 0 },
    { ...d, height: Infinity },
    { ...d, footprint: [p[0], p[0], p[1]] },
    { ...d, footprint: templateAt([2.35, 48.7]) },
    transformDesign(d, { east: 400 }),
    { ...d, footprint: templateAt([place.lng, place.lat], 2, 3) },
  ])
    assert.throws(() => validateDesign(design, place));
});
test("Every monument and style produces finite 3D meshes within the chosen total height", () => {
  const signatures = new Set();
  for (const place of places)
    for (const style of STYLES) {
      const d = defaultDesign(place),
        model = buildModel(d, style.id);
      const bounds = new THREE.Box3().setFromObject(model);
      assert.ok(
        bounds.max.z <= d.height + 0.5,
        `${place.id}/${style.id}: ${bounds.max.z}`,
      );
      assert.ok(bounds.min.z >= -0.001);
      assert.ok(model.children.length > 3);
      let vertices = 0;
      model.traverse((o) => {
        if (o.isMesh) {
          const positions = o.geometry.getAttribute("position");
          vertices += positions.count;
          assert.ok([...positions.array].every(Number.isFinite));
        }
      });
      if (place === places[0]) signatures.add(vertices);
      disposeModel(model);
    }
  assert.ok(signatures.size >= 7, "Styles must change actual geometry");
  for (const height of [6, 160])
    for (const style of STYLES) {
      const d = { ...defaultDesign(places[0]), height };
      const model = buildModel(d, style.id),
        bounds = new THREE.Box3().setFromObject(model);
      assert.ok(
        bounds.max.z <= height + 0.5,
        `${style.id} at ${height}: ${bounds.max.z}`,
      );
      disposeModel(model);
    }
});
test("Image guidance explicitly uses the saved model, footprint, height and original landmark", () => {
  const design = defaultDesign(places[0]);
  const prompt = designSummary(design);
  assert.match(prompt, /FIRST reference image/);
  assert.match(prompt, /SECOND reference/);
  assert.ok(prompt.includes(`${design.height} metres`));
  assert.ok(prompt.includes(JSON.stringify(design.footprint)));
});

test("Palette choices survive validation and transforms and colour real mesh materials", async () => {
  const { PALETTES } = await import("../worker/palettes.js");
  for (const palette of PALETTES) {
    const design = validateDesign(
      { ...defaultDesign(places[0]), palette: palette.id },
      places[0],
    );
    assert.equal(transformDesign(design, { east: 1 }).palette, palette.id);
    const model = buildModel(design, "haussmannien");
    const colours = new Set();
    model.traverse((mesh) => {
      if (mesh.isMesh) colours.add("#" + mesh.material.color.getHexString());
    });
    assert.ok(colours.has(palette.facade));
    assert.ok(colours.has(palette.roof));
    assert.match(designSummary(design), new RegExp(palette.facade));
    disposeModel(model);
  }
  assert.throws(() =>
    validateDesign(
      { ...defaultDesign(places[0]), palette: "not-a-palette" },
      places[0],
    ),
  );
  assert.equal(
    validateDesign(defaultDesign(places[0]), places[0]).palette,
    undefined,
    "Existing saved models remain compatible",
  );
});

test("The shared scene retains published geometry across refreshes and excludes private designs", async () => {
  const { sharedModels } = await import("../src/volume/layer.ts");
  const { MercatorCoordinate } = await import("maplibre-gl");
  const shared = sharedModels();
  const a = {
    id: "one",
    design: defaultDesign(places[0]),
    style_id: "gothique",
    status: "ready",
    published_at: 100,
  };
  const b = { ...a, id: "two", design: defaultDesign(places[1]) };
  const privateProposal = { ...a, id: "private", published_at: null };
  shared.update([
    a,
    b,
    privateProposal,
    { ...b, id: "unfinished", status: "generating", published_at: null },
  ]);
  assert.equal(shared.entries.size, 2);
  const model = shared.entries.get(a.id).model;
  shared.update([{ ...a, status: "failed" }, b]);
  assert.equal(
    shared.entries.get(a.id).model,
    model,
    "An already published image remains on the map after a later generation failure",
  );
  let disposed = false;
  model.children
    .find((mesh) => mesh.isMesh)
    .geometry.addEventListener("dispose", () => {
      disposed = true;
    });
  shared.update([
    { ...a, votes: 42 },
    { ...b, votes: 22 },
  ]);
  assert.equal(
    shared.entries.get(a.id).model,
    model,
    "Votes do not rebuild meshes",
  );
  const origin = MercatorCoordinate.fromLngLat([2.34, 48.86]);
  const unit = origin.meterInMercatorCoordinateUnits();
  const actual = new MercatorCoordinate(
    origin.x + model.position.x * unit,
    origin.y - model.position.y * unit,
  ).toLngLat();
  const expected = centerOf(a.design.footprint);
  assert.ok(
    Math.abs(actual.lng - expected[0]) < 1e-8 &&
      Math.abs(actual.lat - expected[1]) < 1e-8,
  );
  shared.visibility(a.design);
  assert.equal(
    model.visible,
    false,
    "An active editor must not double-render its published footprint",
  );
  assert.equal(shared.entries.get(b.id).model.visible, true);
  shared.visibility(undefined, true);
  assert.ok(
    [...shared.entries.values()].every((e) => !e.model.visible),
    "Generation captures only the active design",
  );
  shared.visibility();
  assert.ok(
    [...shared.entries.values()].every((e) => e.model.visible),
    "Closing a proposal restores the entire shared scene",
  );
  shared.update([{ ...a, design: { ...a.design, palette: "terracotta" } }, b]);
  assert.equal(disposed, true);
  assert.notEqual(shared.entries.get(a.id).model, model);
  shared.update([a]);
  assert.equal(shared.entries.size, 1);
  shared.dispose();
  assert.equal(shared.group.children.length, 0);
  assert.equal(shared.entries.size, 0);
});

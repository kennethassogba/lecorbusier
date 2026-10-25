import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import {
  clean,
  validateCreation,
  imagePrompt,
  escapeHtml,
  STYLES,
} from "../worker/domain.js";
const places = JSON.parse(
  await readFile(new URL("../data/places.json", import.meta.url), "utf8"),
);
const input = {
  requestId: "019a1b00-1a00-4000-8000-123456789abc",
  placeId: "gare-de-lyon",
  styleId: "haussmannien",
  instructions: "Des serveurs visibles.",
  author: "Camille",
  title: "Le Quai des GPU",
};
test("20 real places have unique valid coordinates, local photographs and source licenses", async () => {
  assert.equal(places.length, 20);
  assert.equal(new Set(places.map((p) => p.id)).size, 20);
  for (const place of places) {
    assert.ok(place.lat > 48.8 && place.lat < 48.91);
    assert.ok(place.lng > 2.2 && place.lng < 2.45);
    assert.ok(place.sourceUrl.startsWith("https://commons.wikimedia.org/"));
    assert.ok(place.author && place.license && place.context);
    assert.ok(
      (
        await stat(
          new URL(
            "../public" + place.image.replace("/lecorbusier", ""),
            import.meta.url,
          ),
        )
      ).size > 10000,
    );
  }
});
test("creation cannot spoof a source image or arbitrary architectural style", () => {
  assert.equal(validateCreation(input, places).placeId, "gare-de-lyon");
  assert.throws(() =>
    validateCreation({ ...input, placeId: "https://evil.test" }, places),
  );
  assert.throws(() =>
    validateCreation({ ...input, styleId: "unknown" }, places),
  );
  assert.throws(() => validateCreation({ ...input, author: "   " }, places));
  assert.throws(() =>
    validateCreation({ ...input, requestId: "not-a-uuid" }, places),
  );
});
test("creation bounds and normalizes user content without losing French text", () => {
  assert.equal(
    clean("  “GPU”\u00a0à\u200b Paris—oui  ", 100),
    '"GPU" à Paris-oui',
  );
  assert.equal(
    validateCreation({ ...input, title: "a".repeat(400) }, places).title.length,
    90,
  );
  assert.equal(clean(null, 10), "");
});
test("image instructions preserve the actual landmark and require functional infrastructure", () => {
  const p = imagePrompt(places[0], STYLES[0], "Béton", "Un bâtiment adjacent");
  assert.match(p, /Gare de Lyon/);
  assert.match(p, /landmark MUST remain clearly identifiable/);
  assert.match(p, /server racks/);
  assert.match(p, /cooling/);
  assert.match(p, /Béton/);
  assert.match(p, /original camera position/);
});
test("social metadata cannot inject markup", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="x">'),
    "&lt;img src=x onerror=&quot;x&quot;&gt;",
  );
});
test("PWA is scoped to the supplied subpath and has real install icons", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../public/manifest.webmanifest", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.scope, "/lecorbusier/");
  assert.equal(manifest.start_url, manifest.scope);
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons)
    assert.ok(
      (
        await stat(
          new URL(
            "../public" + icon.src.replace("/lecorbusier", ""),
            import.meta.url,
          ),
        )
      ).size > 100,
    );
});

test("built PWA precaches its map worker and exposes scoped system shortcuts", async () => {
  const root = new URL(
    "../.cloudflare/output/v0/workers/default/assets/",
    import.meta.url,
  );
  const sw = await readFile(new URL("sw.js", root), "utf8");
  assert.doesNotMatch(sw, /__BUILD__/);
  const assets = JSON.parse(sw.match(/const PRECACHE = (\[[^\n]+\]);/)[1]);
  assert.ok(assets.some((p) => /maplibre-gl-worker-.*\.js$/.test(p)));
  assert.ok(assets.some((p) => p.endsWith(".css")));
  for (const path of assets) {
    assert.ok(path.startsWith("/lecorbusier/assets/"));
    assert.ok(
      (await stat(new URL(path.replace("/lecorbusier/", ""), root))).size > 0,
    );
  }
  const manifest = JSON.parse(
    await readFile(new URL("manifest.webmanifest", root), "utf8"),
  );
  for (const shortcut of manifest.shortcuts)
    assert.ok(shortcut.url.startsWith(manifest.scope));
  assert.equal(manifest.screenshots.length, 2);
});

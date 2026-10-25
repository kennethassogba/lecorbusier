import test from "node:test";
import assert from "node:assert/strict";
import { inParis, customPlace, placeFromId, aerialUrl } from "../worker/geo.js";
import { imagePrompt, STYLES } from "../worker/domain.js";
test("free building uses the Paris boundary, including both woods, and rejects suburbs and invalid input", () => {
  for (const point of [
    [2.3313, 48.86914],
    [2.398, 48.864],
    [2.252, 48.864],
    [2.442, 48.831],
  ])
    assert.ok(inParis(...point));
  for (const point of [
    [2.333, 48.802],
    [2.34, 48.746],
    [2.35, 48.922],
    [NaN, 48.8],
    [2.3, Infinity],
  ])
    assert.equal(inParis(...point), false);
  assert.throws(() => customPlace({ lat: "48.86", lng: 2.34 }));
  assert.throws(() => customPlace({ lat: 48.75, lng: 2.34 }));
});
test("reference location is immutable, source URLs are server-owned, WMS axes and aspect ratio are correct", () => {
  const place = customPlace({
    lat: 48.869141,
    lng: 2.331303,
    name: "12 Rue de la Paix",
    image: "https://evil.test",
    sourceUrl: "https://evil.test",
  });
  assert.equal(place.lat, 48.86914);
  assert.equal(place.lng, 2.3313);
  assert.ok(place.image.startsWith("/corbs/api/reference/point-"));
  assert.equal(placeFromId(place.id).lat, place.lat);
  assert.throws(() => placeFromId("https://evil.test"));
  const url = new URL(aerialUrl(place));
  const box = url.searchParams.get("BBOX").split(",").map(Number);
  assert.equal(url.host, "data.geopf.fr");
  assert.ok(
    box[0] < place.lat &&
      box[2] > place.lat &&
      box[1] < place.lng &&
      box[3] > place.lng,
  );
  assert.equal(url.searchParams.get("WIDTH"), "1024");
  assert.equal(url.searchParams.get("HEIGHT"), "1536");
  const prompt = imagePrompt(place, STYLES[0], "", "");
  assert.match(prompt, /EXACT CENTRE/);
  assert.match(prompt, /Do not invent a ground-level/);
});

test("Paris address search excludes suburban homonyms before results are limited", async () => {
  const { searchPlaces } = await import("../worker/geo.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    // IGN applies limit before the client's boundary filter: the city constraint must be upstream.
    const constrained = url.searchParams.get("depcode") === "75";
    return Response.json({
      features: constrained
        ? [
            {
              geometry: { coordinates: [2.3313, 48.86914] },
              properties: { label: "12 Rue de la Paix 75002 Paris" },
            },
            {
              geometry: { coordinates: [2.433287, 48.849957] },
              properties: { label: "12 Rue de la Paix 94300 Vincennes" },
            },
          ]
        : Array.from({ length: 20 }, () => ({
            geometry: { coordinates: [2.433287, 48.849957] },
            properties: { label: "12 Rue de la Paix 94300 Vincennes" },
          })),
    });
  };
  try {
    const results = await searchPlaces("12 rue de la paix");
    assert.equal(results.length, 1);
    assert.match(results[0].name, /75002 Paris/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

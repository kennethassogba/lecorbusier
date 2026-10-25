import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
const bundle = new URL(
  "../.cloudflare/output/v0/workers/default/bundle/index.js",
  import.meta.url,
).pathname;
let built = true;
try {
  await access(bundle);
} catch {
  built = false;
}
test(
  "Worker: private drafts, publication, live broadcast, vote idempotency, share metadata",
  { skip: !built },
  async () => {
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        scriptPath: bundle,
        compatibilityDate: "2026-10-25",
        d1Databases: ["DB"],
        durableObjects: { LIVE: { className: "ParisLive", useSQLite: true } },
        workflows: {
          GENERATE: { name: "test-generate", className: "GenerateProposal" },
        },
        bindings: {
          TEXT_MODEL: "gpt-5.4-mini",
          IMAGE_MODEL: "gpt-image-2.5-sunburst",
        },
        serviceBindings: {
          ASSETS: async (request) =>
            new Response(
              await readFile(new URL("../index.html", import.meta.url)),
              { headers: { "Content-Type": "text/html" } },
            ),
        },
      }),
    );
    try {
      const db = await mf.getD1Database("DB");
      const schema = (
        await Promise.all(
          [
            "0001_initial.sql",
            "0002_free_places_and_demo.sql",
            "0003_image_revision.sql",
            "0004_language.sql",
          ].map((name) =>
            readFile(new URL("../migrations/" + name, import.meta.url), "utf8"),
          ),
        )
      ).join("\n");
      for (const sql of schema
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await db.prepare(sql).run();
      const id = "019a1b00-1a00-4000-8000-123456789abc",
        owner = "019a1b00-1a00-4000-8000-123456789aaa",
        other = "019a1b00-1a00-4000-8000-123456789bbb";
      const request = (path, visitor = owner, body) =>
        mf.dispatchFetch("https://example.test/lecorbusier" + path, {
          headers: {
            Cookie: "lc_visitor=" + visitor,
            ...(body !== undefined
              ? {
                  "Content-Type": "application/json",
                  Origin: "https://example.test",
                }
              : {}),
          },
          ...(body !== undefined
            ? { method: "POST", body: JSON.stringify(body) }
            : {}),
        });
      await db
        .prepare(
          "INSERT INTO proposals(id,owner,place_id,style_id,author,title,status,caption,created_at,image_key) VALUES(?,?,?,?,?,?,'ready',?,?,?)",
        )
        .bind(
          id,
          owner,
          "gare-de-lyon",
          "haussmannien",
          "Camille",
          "<GPU>",
          "Un train peut en cacher un prompt.",
          1,
          id + ".jpg",
        )
        .run();
      await db
        .prepare("INSERT INTO image_parts VALUES(?,?,?)")
        .bind(id, 0, new Uint8Array([255, 216, 255, 217]).buffer)
        .run();
      assert.equal((await request("/api/proposals/" + id, other)).status, 404);
      assert.equal((await request("/media/" + id + ".jpg", other)).status, 404);
      const own = await (await request("/api/proposals/" + id)).json();
      assert.equal(own.title, "<GPU>");
      assert.ok(!("owner" in own));
      assert.equal(
        (await request("/api/proposals/" + id + "/publish", other, {})).status,
        404,
      );
      const socketResponse = await mf.dispatchFetch(
        "https://example.test/lecorbusier/api/live",
        { headers: { Upgrade: "websocket", Origin: "https://example.test" } },
      );
      assert.equal(socketResponse.status, 101);
      const ws = socketResponse.webSocket;
      ws.accept();
      const changed = new Promise((resolve) =>
        ws.addEventListener("message", (e) => {
          if (JSON.parse(e.data).type === "changed") resolve(true);
        }),
      );
      assert.equal(
        (await request("/api/proposals/" + id + "/publish", owner, {})).status,
        200,
      );
      await changed;
      const publicProposal = await (
        await request("/api/proposals/" + id, other)
      ).json();
      assert.ok(publicProposal.published_at);
      assert.ok(!("owner" in publicProposal));
      await db
        .prepare("UPDATE proposals SET is_demo=1,demo_votes=1234 WHERE id=?")
        .bind(id)
        .run();
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request("/api/proposals/" + id + "/vote", other, { voted: true }),
        ),
      );
      assert.ok(results.every((r) => r.status === 200));
      const demo = await (await request("/api/proposals/" + id, other)).json();
      assert.equal(demo.demo_votes, 1234);
      assert.equal(demo.is_demo, 1);
      assert.equal(demo.votes, 1);
      assert.equal(
        (
          await db
            .prepare("SELECT votes FROM proposals WHERE id=?")
            .bind(id)
            .first()
        ).votes,
        1,
      );
      assert.equal(
        (
          await (
            await request("/api/proposals/" + id + "/vote", other, {
              voted: false,
            })
          ).json()
        ).votes,
        0,
      );
      assert.equal((await request("/media/" + id + ".jpg", other)).status, 200);
      const share = await request("/p/" + id, other);
      const html = await share.text();
      assert.match(html, /&lt;GPU&gt;/);
      assert.match(html, /og:image/);
      assert.doesNotMatch(html, /<title><GPU>/);
      const cross = await mf.dispatchFetch(
        "https://example.test/lecorbusier/api/proposals/" + id + "/vote",
        {
          method: "POST",
          headers: {
            Origin: "https://evil.test",
            "Content-Type": "application/json",
          },
          body: '{"voted":true}',
        },
      );
      assert.equal(cross.status, 403);
      assert.equal((await request("/api/generate", owner, {})).status, 503);
      ws.close();
    } finally {
      await mf.dispose();
    }
  },
);
test(
  "Free-place generation requests are idempotent and persist the location and structured brief (mocked OpenAI)",
  { skip: !built },
  async () => {
    const photo = await readFile(
      new URL("../public/places/gare-de-lyon.jpg", import.meta.url),
    );
    const calls = [];
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        scriptPath: bundle,
        compatibilityDate: "2026-10-25",
        d1Databases: ["DB"],
        durableObjects: { LIVE: { className: "ParisLive", useSQLite: true } },
        workflows: {
          GENERATE: {
            name: "test-generation-pipeline",
            className: "GenerateProposal",
          },
        },
        bindings: {
          OPENAI_API_KEY: "test-only",
          TEXT_MODEL: "text-test",
          IMAGE_MODEL: "image-test",
        },
        serviceBindings: {
          ASSETS: () =>
            new Response(photo, { headers: { "Content-Type": "image/jpeg" } }),
        },
        outboundService: async (request) => {
          const path = new URL(request.url).pathname;
          calls.push(path);
          if (path === "/wms-r")
            return new Response(photo, {
              headers: { "Content-Type": "image/jpeg" },
            });
          if (path === "/v1/moderations")
            return Response.json({ results: [{ flagged: false }] });
          if (path === "/v1/responses") {
            const body = await request.json();
            assert.match(body.instructions, /in English/);
            return Response.json({
              output: [
                {
                  content: [
                    {
                      type: "output_text",
                      text: JSON.stringify({
                        brief: "Un data center bas, la gare visible.",
                        caption: "Le quai du cloud.",
                      }),
                    },
                  ],
                },
              ],
            });
          }
          if (path === "/v1/images/edits") {
            const form = await request.formData();
            assert.equal(form.get("model"), "image-test");
            assert.ok(form.get("image[]").size > 10000);
            assert.match(form.get("prompt"), /server racks/);
            assert.match(form.get("prompt"), /EXACT CENTRE/);
            return Response.json({
              data: [{ b64_json: photo.toString("base64") }],
            });
          }
          throw new Error("Unexpected outbound call: " + path);
        },
      }),
    );
    try {
      const db = await mf.getD1Database("DB");
      const schema = (
        await Promise.all(
          [
            "0001_initial.sql",
            "0002_free_places_and_demo.sql",
            "0003_image_revision.sql",
            "0004_language.sql",
          ].map((name) =>
            readFile(new URL("../migrations/" + name, import.meta.url), "utf8"),
          ),
        )
      ).join("\n");
      for (const sql of schema
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await db.prepare(sql).run();
      const owner = "019a1b00-1a00-4000-8000-123456789fff",
        id = "019a1b00-1a00-4000-8000-123456789eee";
      const input = {
        requestId: id,
        placeId: "point-48.86914-2.33130",
        location: {
          lat: 48.869141,
          lng: 2.331303,
          name: "12 Rue de la Paix",
          image: "https://evil.test",
        },
        styleId: "haussmannien",
        author: "Test",
        title: "Pipeline test",
        language: "en",
        instructions: "Serveurs visibles.",
      };
      const init = {
        method: "POST",
        headers: {
          Origin: "https://example.test",
          "Content-Type": "application/json",
          Cookie: "lc_visitor=" + owner,
        },
        body: JSON.stringify(input),
      };
      assert.equal(
        (
          await mf.dispatchFetch(
            "https://example.test/lecorbusier/api/generate",
            init,
          )
        ).status,
        202,
      );
      assert.equal(
        (
          await mf.dispatchFetch(
            "https://example.test/lecorbusier/api/generate",
            init,
          )
        ).status,
        200,
      );
      let row;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        row = await db
          .prepare(
            "SELECT status,error,brief,caption,place_json FROM proposals WHERE id=?",
          )
          .bind(id)
          .first();
        if (["generating", "ready", "failed"].includes(row.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      assert.ok(
        ["generating", "ready"].includes(row.status),
        row.error || JSON.stringify(calls),
      );
      assert.equal(JSON.parse(row.place_json).lat, 48.86914);
      assert.ok(
        JSON.parse(row.place_json).image.startsWith(
          "/lecorbusier/api/reference/",
        ),
      );
      assert.equal(row.brief, "Un data center bas, la gare visible.");
      assert.equal(row.caption, "Le quai du cloud.");
      assert.equal(calls.filter((p) => p === "/v1/responses").length, 1);
      assert.equal(
        (
          await db
            .prepare("SELECT count(*) AS n FROM proposals WHERE id=?")
            .bind(id)
            .first()
        ).n,
        1,
      );
    } finally {
      await mf.dispose();
    }
  },
);

test(
  "Name suggestions use the selected monument or address, language and previous names",
  { skip: !built },
  async () => {
    const calls = [];
    let malformed = false;
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        scriptPath: bundle,
        compatibilityDate: "2026-10-25",
        durableObjects: { LIVE: { className: "ParisLive", useSQLite: true } },
        workflows: {
          GENERATE: { name: "test-names", className: "GenerateProposal" },
        },
        bindings: { OPENAI_API_KEY: "test-only", TEXT_MODEL: "text-test" },
        outboundService: async (request) => {
          assert.equal(new URL(request.url).pathname, "/v1/responses");
          const body = await request.json();
          calls.push(body);
          return Response.json({
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: malformed
                      ? '{"names":["Same","Same","Same"]}'
                      : JSON.stringify({
                          names: body.instructions.includes(
                            "Write the names in English",
                          )
                            ? [
                                "Peace of Cache",
                                "12 Processing Cores",
                                "Rue de la RAM",
                              ]
                            : [
                                "Terminus Tensor",
                                "Les Racks de Lyon",
                                "Le Train des Données",
                              ],
                        }),
                  },
                ],
              },
            ],
          });
        },
      }),
    );
    const suggest = (body) =>
      mf.dispatchFetch("https://example.test/lecorbusier/api/suggest", {
        method: "POST",
        headers: {
          Origin: "https://example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kind: "names", styleId: "art-deco", ...body }),
      });
    try {
      const monument = await suggest({
        placeId: "gare-de-lyon",
        language: "fr",
        instructions: "Des serveurs sous l'horloge",
        title: "Premier nom",
        previous: ["Ancien nom"],
      });
      assert.equal(monument.status, 200);
      assert.equal((await monument.json()).names.length, 3);
      const first = JSON.parse(calls[0].input);
      assert.equal(first.lieu, "Gare de Lyon");
      assert.equal(first.style, "Art déco");
      assert.equal(first.projet, "Des serveurs sous l'horloge");
      assert.deepEqual(first.noms_precedents, ["Premier nom", "Ancien nom"]);
      assert.match(calls[0].instructions, /français/);
      assert.equal(calls[0].text.format.strict, true);
      const address = await suggest({
        placeId: "point-48.86914-2.33130",
        location: {
          name: "12 Rue de la Paix",
          lat: 48.86914,
          lng: 2.3313,
          context: "FAKE MONUMENT",
        },
        language: "en",
      });
      assert.equal(address.status, 200);
      assert.equal((await address.json()).names[0], "Peace of Cache");
      assert.equal(JSON.parse(calls[1].input).lieu, "12 Rue de la Paix");
      assert.ok(!calls[1].input.includes("FAKE MONUMENT"));
      assert.match(calls[1].instructions, /in English/);
      const bad = await suggest({
        placeId: "gare-de-lyon",
        styleId: "not-a-style",
      });
      assert.equal(bad.status, 400);
      assert.equal(calls.length, 2);
      malformed = true;
      const failed = await suggest({ placeId: "gare-de-lyon" });
      assert.equal(failed.status, 502);
      assert.match((await failed.json()).error, /Réessaie/);
    } finally {
      await mf.dispose();
    }
  },
);

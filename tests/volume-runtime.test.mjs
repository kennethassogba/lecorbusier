import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { defaultDesign, validateDesign } from "../worker/volume.js";
const root = new URL("../", import.meta.url);
const places = JSON.parse(await readFile(new URL("data/places.json", root)));
test("A private volume survives generation and publication; OpenAI receives the real photo and exact saved model reference", async () => {
  const photo = await readFile(new URL("public/places/gare-de-lyon.jpg", root));
  const modelImage = await readFile(new URL("public/places/louvre.jpg", root));
  const design = validateDesign(defaultDesign(places[0]), places[0]);
  const calls = [];
  let providerError;
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      scriptPath: new URL(
        ".cloudflare/output/v0/workers/default/bundle/index.js",
        root,
      ).pathname,
      compatibilityDate: "2026-10-25",
      d1Databases: ["DB"],
      durableObjects: { LIVE: { className: "ParisLive", useSQLite: true } },
      workflows: {
        GENERATE: { name: "test-volume", className: "GenerateProposal" },
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
        try {
          if (path === "/v1/moderations")
            return Response.json({ results: [{ flagged: false }] });
          if (path === "/v1/responses") {
            const data = await request.json();
            assert.match(
              data.input[0].content[0].text,
              /Authoritative player design/,
            );
            return Response.json({
              output: [
                {
                  content: [
                    {
                      type: "output_text",
                      text: JSON.stringify({
                        brief: "Glazed server gallery under a zinc roof.",
                        caption: "Le quai du calcul.",
                      }),
                    },
                  ],
                },
              ],
            });
          }
          if (path === "/v1/images/edits") {
            const form = await request.formData(),
              images = form.getAll("image[]");
            assert.equal(images.length, 2);
            assert.deepEqual(Buffer.from(await images[0].arrayBuffer()), modelImage);
            assert.deepEqual(Buffer.from(await images[1].arrayBuffer()), photo);
            assert.match(form.get("prompt"), /FIRST reference image/);
            assert.match(form.get("prompt"), /28 metres/);
            assert.ok(
              !form.get("prompt").includes("Keep the original camera position"),
            );
            return Response.json({
              data: [{ b64_json: photo.toString("base64") }],
            });
          }
          throw new Error("Unexpected request " + path);
        } catch (error) {
          providerError = error;
          throw error;
        }
      },
    }),
  );
  try {
    const db = await mf.getD1Database("DB");
    for (const file of [
      "0001_initial.sql",
      "0002_free_places_and_demo.sql",
      "0003_image_revision.sql",
      "0004_language.sql",
      "0006_volume_design.sql",
    ]) {
      for (const sql of (
        await readFile(new URL("migrations/" + file, root), "utf8")
      )
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean))
        await db.prepare(sql).run();
    }
    const owner = "019a1b00-1a00-4000-8000-123456789fff",
      id = "019a1b00-1a00-4000-8000-123456789def";
    const request = (path, body, visitor = owner) =>
      mf.dispatchFetch("https://example.test/corbs/api" + path, {
        headers: {
          Cookie: "lc_visitor=" + visitor,
          Origin: "https://example.test",
          "Content-Type": "application/json",
        },
        ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
      });
    const input = {
      requestId: id,
      placeId: places[0].id,
      styleId: "haussmannien",
      title: "Volume test",
      author: "Cam",
      instructions: "",
      design,
      designImage: "data:image/jpeg;base64," + modelImage.toString("base64"),
    };
    const invalid = await request("/generate", {
      ...input,
      design: { ...design, height: 800 },
    });
    assert.equal(invalid.status, 400);
    assert.equal(
      (
        await request("/generate", {
          ...input,
          designImage: "https://example.com/private",
        })
      ).status,
      400,
    );
    assert.equal((await request("/generate", input)).status, 202);
    assert.equal((await request("/generate", input)).status, 200);
    let row;
    for (let n = 0; n < 100; n++) {
      row = await db
        .prepare("SELECT status,error,design_json FROM proposals WHERE id=?")
        .bind(id)
        .first();
      if (["ready", "failed"].includes(row.status)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ifError(providerError);
    assert.equal(row.status, "ready", row.error);
    assert.deepEqual(JSON.parse(row.design_json), design);
    assert.equal(calls.filter((p) => p === "/v1/images/edits").length, 1);
    const privateResult = await (await request("/proposals/" + id)).json();
    assert.deepEqual(privateResult.design, design);
    assert.ok(!("design_json" in privateResult));
    assert.ok(!("bytes" in privateResult));
    assert.equal(
      (
        await request(
          "/proposals/" + id,
          undefined,
          "019a1b00-1a00-4000-8000-123456789aaa",
        )
      ).status,
      404,
    );
    assert.equal(
      (await request("/proposals/" + id + "/publish", {})).status,
      200,
    );
    const list = await (await request("/proposals")).json();
    assert.deepEqual(list.proposals[0].design, design);
    assert.deepEqual(
      Buffer.from(
        (
          await db
            .prepare("SELECT bytes FROM design_references WHERE proposal_id=?")
            .bind(id)
            .first()
        ).bytes,
      ),
      modelImage,
    );
  } finally {
    await mf.dispose();
  }
});

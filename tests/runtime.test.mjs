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
      const schema = await readFile(
        new URL("../migrations/0001_initial.sql", import.meta.url),
        "utf8",
      );
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
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request("/api/proposals/" + id + "/vote", other, { voted: true }),
        ),
      );
      assert.ok(results.every((r) => r.status === 200));
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
  "Generation requests are idempotent and persist the structured brief with mocked OpenAI",
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
          if (path === "/v1/moderations")
            return Response.json({ results: [{ flagged: false }] });
          if (path === "/v1/responses")
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
          if (path === "/v1/images/edits") {
            const form = await request.formData();
            assert.equal(form.get("model"), "image-test");
            assert.ok(form.get("image[]").size > 10000);
            assert.match(form.get("prompt"), /server racks/);
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
      const schema = await readFile(
        new URL("../migrations/0001_initial.sql", import.meta.url),
        "utf8",
      );
      for (const sql of schema
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await db.prepare(sql).run();
      const owner = "019a1b00-1a00-4000-8000-123456789fff",
        id = "019a1b00-1a00-4000-8000-123456789eee";
      const input = {
        requestId: id,
        placeId: "gare-de-lyon",
        styleId: "haussmannien",
        author: "Test",
        title: "Pipeline test",
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
            "SELECT status,error,brief,caption FROM proposals WHERE id=?",
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

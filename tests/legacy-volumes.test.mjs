import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { validateDesign, areaOf } from "../worker/volume.js";
import {
  arrangeCards,
  CARD_WIDTH,
  CARD_HEIGHT,
} from "../src/volume/card-layout.ts";
const places = JSON.parse(
  await readFile(new URL("../data/places.json", import.meta.url)),
);
const legacy = JSON.parse(
  await readFile(new URL("../data/legacy-volumes.json", import.meta.url)),
);

test("Every legacy leaderboard creation has a valid site-specific volume, including the custom address", () => {
  assert.equal(legacy.length, 22);
  assert.equal(new Set(legacy.map((p) => p.id)).size, 22);
  const heights = new Set(),
    shapes = new Set();
  for (const item of legacy) {
    const design = validateDesign(
      item.design,
      item.location || places.find((p) => p.id === item.placeId),
    );
    assert.deepEqual(design, item.design);
    heights.add(design.height);
    shapes.add(design.footprint.length);
    assert.ok(areaOf(design.footprint) > 300);
  }
  assert.ok(heights.size >= 6);
  assert.ok(shapes.size >= 4);
});

test("Backfill is idempotent and preserves existing designs, private drafts, images, authors and votes", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ["DB"],
      compatibilityDate: "2026-10-25",
    }),
  );
  try {
    const db = await mf.getD1Database("DB");
    await db.exec(
      "CREATE TABLE proposals(id TEXT PRIMARY KEY, status TEXT, published_at INTEGER, design_json TEXT, author TEXT, votes INTEGER, image_key TEXT)",
    );
    const existing = JSON.stringify({
      version: 1,
      height: 81,
      footprint: [
        [2.35, 48.85],
        [2.351, 48.85],
        [2.351, 48.851],
      ],
    });
    await db.batch(
      legacy.map((p, i) =>
        db
          .prepare("INSERT INTO proposals VALUES(?,?,?,?,?,?,?)")
          .bind(
            p.id,
            i === 2 ? "failed" : "ready",
            i === 1 ? null : 100,
            i === 0 ? existing : null,
            "Builder " + i,
            10 + i,
            "photo-" + i + ".jpg",
          ),
      ),
    );
    const before = (
      await db
        .prepare(
          "SELECT id,author,votes,image_key,status FROM proposals ORDER BY id",
        )
        .all()
    ).results;
    const sql = await readFile(
      new URL("../migrations/0007_leaderboard_volumes.sql", import.meta.url),
      "utf8",
    );
    const statements = sql
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (let repeat = 0; repeat < 2; repeat++)
      await db.batch(statements.map((s) => db.prepare(s)));
    assert.deepEqual(
      (
        await db
          .prepare(
            "SELECT id,author,votes,image_key,status FROM proposals ORDER BY id",
          )
          .all()
      ).results,
      before,
    );
    const rows = (
      await db.prepare("SELECT id,design_json FROM proposals").all()
    ).results;
    for (const [i, p] of legacy.entries()) {
      const result = rows.find((r) => r.id === p.id).design_json;
      assert.equal(
        result,
        i === 0 ? existing : i === 1 ? null : JSON.stringify(p.design),
      );
    }
  } finally {
    await mf.dispose();
  }
});

test("Roof cards fit narrow screens, stay above their building and do not collide", () => {
  const points = [
    { id: "first", x: 160, y: 380 },
    { id: "selected", x: 170, y: 380, selected: true },
    { id: "third", x: 180, y: 390 },
    { id: "outside", x: -10, y: 400 },
  ];
  for (const width of [320, 390, 788, 1440]) {
    const bounds = { left: 12, right: width - 12, top: 128, bottom: 700 };
    const cards = arrangeCards(points, bounds);
    assert.ok(cards.some((c) => c.id === "selected"));
    assert.ok(!cards.some((c) => c.id === "outside"));
    for (const [i, c] of cards.entries()) {
      assert.ok(c.y < c.roofY && c.y - CARD_HEIGHT >= bounds.top);
      assert.ok(
        c.x - CARD_WIDTH / 2 >= bounds.left &&
          c.x + CARD_WIDTH / 2 <= bounds.right,
      );
      for (const other of cards.slice(i + 1))
        assert.ok(
          Math.abs(c.x - other.x) >= CARD_WIDTH + 8 ||
            Math.abs(c.y - other.y) >= CARD_HEIGHT + 8,
        );
    }
  }
});

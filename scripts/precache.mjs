import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = ".cloudflare/output/v0/workers/default/assets";
const assets = (await readdir(root + "/assets"))
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => "/lecorbusier/assets/" + f);
const metadata = await Promise.all(
  ["index.html", "manifest.webmanifest", "paris-map.json", "sw.js"].map((f) =>
    readFile(root + "/" + f, "utf8"),
  ),
);
const version = createHash("sha256")
  .update(assets.join("|") + metadata.join("|"))
  .digest("hex")
  .slice(0, 12);
const sw = await readFile(root + "/sw.js", "utf8");
await writeFile(
  root + "/sw.js",
  sw
    .replace("__BUILD__", version)
    .replace(
      "const PRECACHE = [];",
      `const PRECACHE = ${JSON.stringify(assets)};`,
    ),
);
console.log(`Offline shell: ${assets.length} assets, ${version}`);

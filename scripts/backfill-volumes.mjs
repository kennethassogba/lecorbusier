// Rebuild the guarded migration from the reviewed legacy-volume manifest.
// This command writes SQL locally. It does not contact or mutate the database.
import { readFile, writeFile } from "node:fs/promises";
import { validateDesign } from "../worker/volume.js";
const items = JSON.parse(
  await readFile(new URL("../data/legacy-volumes.json", import.meta.url)),
);
const places = JSON.parse(
  await readFile(new URL("../data/places.json", import.meta.url)),
);
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const statements = items.map((item) => {
  const place = item.location || places.find((p) => p.id === item.placeId);
  const design = validateDesign(item.design, place);
  return `UPDATE proposals SET design_json=${quote(JSON.stringify(design))} WHERE id=${quote(item.id)} AND design_json IS NULL AND published_at IS NOT NULL;`;
});
await writeFile(
  new URL("../migrations/0007_leaderboard_volumes.sql", import.meta.url),
  "-- Volumes for the published legacy creations. Existing designs, private drafts and all image/vote data are preserved.\n" +
    statements.join("\n") +
    "\n",
);
console.log(`Prepared ${statements.length} guarded volume updates.`);

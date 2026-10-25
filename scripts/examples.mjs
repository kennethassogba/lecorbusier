// Generates real examples through the app's normal OpenAI workflow. Nothing is published automatically.
// Usage: node scripts/examples.mjs generate | publish
// Session data stays in ignored output/ and is never committed.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = "https://keff.uk/lecorbusier";
const examples = JSON.parse(await readFile("data/examples.json", "utf8"));
await mkdir("output/examples", { recursive: true });
const stateFile = "output/examples/session.json";
let state;
try {
  state = JSON.parse(await readFile(stateFile, "utf8"));
} catch {
  state = { cookie: "", jobs: {} };
}
let writes = Promise.resolve();
const save = () => {
  const snapshot = JSON.stringify(state, null, 2);
  writes = writes.then(() => writeFile(stateFile, snapshot, { mode: 0o600 }));
  return writes;
};
async function request(path, body) {
  const r = await fetch(root + "/api" + path, {
    headers: {
      Cookie: state.cookie,
      ...(body
        ? { "Content-Type": "application/json", Origin: "https://keff.uk" }
        : {}),
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  const cookie = r.headers.get("set-cookie");
  if (cookie) {
    state.cookie = cookie.split(";")[0];
    await save();
  }
  const data = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${data.error}`);
  return data;
}
if (!state.cookie) await request("/config");
if (process.argv[2] === "generate") {
  const queue = [...examples];
  async function work() {
    while (queue.length) {
      const example = queue.shift(),
        name = example.placeId;
      let job = state.jobs[name];
      if (!job) {
        job = state.jobs[name] = {
          id: crypto.randomUUID(),
          title: example.title,
        };
        await save();
      }
      if (job.status === "ready") continue;
      try {
        await request("/generate", { ...example, requestId: job.id });
        console.log("Started:", example.title);
        let p;
        do {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          p = await request("/proposals/" + job.id);
        } while (!["ready", "failed"].includes(p.status));
        job.status = p.status;
        job.error = p.error;
        if (p.status === "ready") {
          const r = await fetch("https://keff.uk" + p.image, {
            headers: { Cookie: state.cookie },
          });
          if (!r.ok) throw new Error("Image download failed");
          await writeFile(
            `output/examples/${name}.jpg`,
            Buffer.from(await r.arrayBuffer()),
          );
        }
        await save();
        console.log(p.status + ":", example.title, p.error || "");
      } catch (e) {
        job.error = e.message;
        await save();
        console.log("Failed:", name, e.message);
      }
    }
  }
  await Promise.all([work(), work(), work()]);
} else if (process.argv[2] === "publish") {
  // Run only after reviewing the generated images and marking demo scores in D1.
  for (const example of examples) {
    const job = state.jobs[example.placeId];
    if (job?.status !== "ready") continue;
    const p = await request("/proposals/" + job.id);
    if (!p.is_demo)
      throw new Error("Mark this example as demo before publishing: " + job.id);
    await request("/proposals/" + job.id + "/publish", {});
    console.log("Published:", example.title);
  }
} else console.log("Choose generate or publish.");

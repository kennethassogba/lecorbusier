export const STYLES = [
  {
    id: "haussmannien",
    name: "Haussmannien",
    detail: "Pierre de taille, balcons filants, zinc.",
    prompt:
      "Haussmannian dressed limestone, regular facade rhythm, iron balconies, zinc mansard roof",
  },
  {
    id: "art-deco",
    name: "Art déco",
    detail: "Géométrie, métal, lignes franches.",
    prompt:
      "Parisian Art Deco, geometric stepped volumes, stone and bronze, strong vertical rhythm",
  },
  {
    id: "classique",
    name: "Classique",
    detail: "Symétrie et proportions.",
    prompt:
      "French classical architecture, symmetrical composition, restrained stone columns",
  },
  {
    id: "neoclassique",
    name: "Néoclassique",
    detail: "Colonnes et monumentalité.",
    prompt:
      "Parisian neoclassical architecture, stone colonnades, clear monumental proportions",
  },
  {
    id: "art-nouveau",
    name: "Art nouveau",
    detail: "Courbes, ferronneries, céramique.",
    prompt:
      "Parisian Art Nouveau, organic ironwork, curved stone detailing, ceramic accents",
  },
  {
    id: "baroque",
    name: "Baroque",
    detail: "Reliefs, courbes, mise en scène.",
    prompt:
      "French Baroque, sculpted limestone, dramatic curved facades and ornamental reliefs",
  },
  {
    id: "rococo",
    name: "Rococo",
    detail: "Ornements et excès assumés.",
    prompt:
      "playful French Rococo, intricate asymmetrical shell ornaments, cream stone",
  },
  {
    id: "brutaliste",
    name: "Brutaliste",
    detail: "Le béton a aussi son avis.",
    prompt:
      "Le Corbusier influenced brutalism, exposed concrete, pilotis, deep sun breakers, bold sculptural form",
  },
  {
    id: "gothique",
    name: "Néogothique",
    detail: "Arcs, verticalité et serveurs.",
    prompt:
      "Parisian Gothic Revival, pointed arches, tracery reinterpreted as industrial ventilation screens",
  },
  {
    id: "contemporain",
    name: "Contemporain",
    detail: "Verre, métal, infrastructure visible.",
    prompt:
      "precise contemporary Parisian architecture, glass, aluminum, honest visible industrial equipment",
  },
];
export function clean(value, max) {
  return typeof value === "string"
    ? value
        .normalize("NFKC")
        .replace(
          /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,
          "",
        )
        .replace(/\u00a0/g, " ")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/—/g, "-")
        .trim()
        .slice(0, max)
    : "";
}
export function validateCreation(input, places) {
  if (!input || typeof input !== "object")
    throw new Error("La proposition est vide.");
  const place = places.find((p) => p.id === input.placeId),
    style = STYLES.find((s) => s.id === input.styleId);
  if (!place || !style) throw new Error("Choisis un lieu et un style.");
  const instructions = clean(input.instructions, 1800),
    author = clean(input.author, 48),
    title = clean(input.title, 90);
  if (!author || !title)
    throw new Error("Ajoute ton nom et celui de ta création.");
  if (!/^[a-f0-9-]{36}$/i.test(input.requestId || ""))
    throw new Error("Recharge la page avant de réessayer.");
  return {
    placeId: place.id,
    styleId: style.id,
    instructions,
    author,
    title,
    id: input.requestId,
  };
}
export const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function imagePrompt(place, style, instructions, brief) {
  const view =
    place.referenceKind === "aerial"
      ? "Keep the reference aerial camera and EXACT street grid, roof footprints and urban context. The new data center sits at the EXACT CENTRE of the reference photograph. Render a photorealistic aerial architectural intervention, with a dramatically sculptural roof, visible cooling plant, roof openings revealing server halls. Do not invent a ground-level street view from this overhead reference."
      : "The actual named landmark MUST remain clearly identifiable and prominently visible. Retain its facade, silhouette, tower, roof geometry and recognisable details. Keep the original camera position, street geometry, skyline, surrounding buildings. Do not substitute a generic Paris street or label a different place.";
  return `Create an exceptional photorealistic architectural photograph using the supplied ORIGINAL photograph of ${place.name}, Paris, as the immutable geographical reference. ${place.context}
CRITICAL GEOGRAPHY: ${view}
Architecture: ${style.prompt}. Design one bold, coherent, site-specific DATA CENTER with an unforgettable silhouette and ambitious engineering. This should feel like an extraordinary built architectural commission photographed for an architecture magazine. Avoid an ordinary small glass box, a generic office building or a decorative shed. Use depth, layered structure, enormous finely detailed louvers, dramatic structural spans and painstakingly crafted materials. Scale the intervention to the actual site while preserving recognizable surroundings.
Immediately recognizable data center: real rows of server racks visible across substantial glazed server halls; monumental cooling heat-exchanger banks, cable trays, pipes, maintenance gantries and service access integrated into the architecture. One discreet French sign "DATA CENTER". Functional infrastructure should define the composition, not just a tiny sign.
Photographic realism: correct contact shadows and ambient occlusion, perspective and lens matching the reference, natural atmospheric depth, irregular stone grain and patina, realistic glass reflections and visible interiors, believable metal connections, street-level details and human scale. No smooth CGI, plastic surfaces, fantasy city, spaceship, neon glow, decorative green/lime lighting. Color and light are mandatory: clean neutral daylight, balanced whites, cool neutral stone and metal, realistic restrained contrast. No yellow or amber color cast, no golden-hour light, no orange sunset, no sepia, no warm cinematic grading. Server-hall LEDs are neutral white 5000K, never yellow. Correct any warm tint in the reference while preserving its real geometry and materials. For a night reference keep a neutral cool night with white interior lights. Actual gold architectural details may remain gold; the entire photograph must never look yellow. Portrait composition. No caption, watermark or interface.
Architectural brief: ${brief}
Additional user wishes (subject to geographic constraints above): ${instructions || "Create a daring architectural intervention with unmistakable infrastructure."}`;
}

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
  return `Create a photorealistic architectural photomontage using the supplied ORIGINAL photograph of ${place.name}, Paris, as the immutable geographical reference. ${place.context}
CRITICAL: The actual named landmark MUST remain clearly identifiable and prominently visible. Retain its facade, silhouette, tower, roof geometry and recognisable details. Keep the original camera position, street geometry, skyline, surrounding buildings, and daylight. Do not substitute a generic Paris street or label a different place. Add a new, imaginative but plausible DATA CENTER in the designated foreground or adjoining space; retain the monument itself. New data center architecture: ${style.prompt}.
Make its use immediately recognisable: glazed portions revealing illuminated rows of server racks, substantial integrated ventilation louvers, industrial cooling heat-exchanger equipment and service access, one discreet readable French sign "DATA CENTER". These functional elements occupy a meaningful area of the proposed structure, not just a tiny sign. This is playful speculative architecture with serious photographic integration. No science-fiction spaceship. No green/lime colored lighting or decorative palette. Preserve natural colors of reference. Portrait composition, architectural photography, believable scale and shadows. No caption, no watermark, no interface.
Architectural brief: ${brief}
Additional user wishes (subject to geographic constraints above): ${instructions || "Integrate with neighboring buildings while keeping infrastructure legible."}`;
}

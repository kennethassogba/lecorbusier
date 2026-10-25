// Material colours are part of the saved design and the image-generation reference.
export const PALETTES = [
  {
    id: "stone",
    name: "Pierre",
    facade: "#d5dae2",
    roof: "#42618d",
    accent: "#1764df",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    facade: "#709be0",
    roof: "#254a91",
    accent: "#1555d0",
  },
  {
    id: "terracotta",
    name: "Terre cuite",
    facade: "#cc806d",
    roof: "#693d55",
    accent: "#a54138",
  },
  {
    id: "rose",
    name: "Rose",
    facade: "#d494b4",
    roof: "#764969",
    accent: "#ac417b",
  },
  {
    id: "lavender",
    name: "Lavande",
    facade: "#a79ada",
    roof: "#514d8c",
    accent: "#6952c4",
  },
  {
    id: "slate",
    name: "Ardoise",
    facade: "#71849e",
    roof: "#35465f",
    accent: "#568be2",
  },
];
const defaults = {
  "art-deco": "terracotta",
  "art-nouveau": "rose",
  baroque: "rose",
  rococo: "lavender",
  gothique: "cobalt",
  brutaliste: "slate",
  contemporain: "cobalt",
};
export function paletteFor(design, style = "") {
  return (
    PALETTES.find((p) => p.id === (design?.palette || defaults[style])) ||
    PALETTES[0]
  );
}

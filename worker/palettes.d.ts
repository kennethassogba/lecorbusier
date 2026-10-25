import type { Design } from "../src/types";
export type PaletteId =
  | "stone"
  | "cobalt"
  | "terracotta"
  | "rose"
  | "lavender"
  | "slate";
export const PALETTES: {
  id: PaletteId;
  name: string;
  facade: string;
  roof: string;
  accent: string;
}[];
export function paletteFor(
  design?: Design,
  style?: string,
): (typeof PALETTES)[number];

import type { CSSProperties } from "react";
import "./architecture-model.css";

type Part = [
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  material: string,
];
const plinth: Part = [2, 7, 0, 96, 68, 4, "plinth"];
const columns = (height = 27, z = 4): Part[] =>
  [14, 27, 40, 53, 66, 79].map((x) => [x, 59, z, 5, 6, height, "column"]);
const vents = (z: number): Part[] =>
  [27, 44, 61].map((x) => [x, 31, z, 10, 11, 7, "vent"]);
const models: Record<string, Part[]> = {
  haussmannien: [
    [13, 19, 4, 74, 43, 35, "stone"],
    [10, 17, 39, 80, 47, 3, "cornice"],
    [14, 20, 42, 72, 41, 9, "roof"],
    [20, 25, 51, 60, 30, 3, "roof"],
    ...vents(54),
  ],
  "art-deco": [
    [12, 20, 4, 76, 43, 22, "stone"],
    [20, 23, 26, 60, 37, 20, "glass"],
    [31, 27, 46, 38, 29, 13, "stone"],
    [39, 30, 59, 22, 23, 7, "roof"],
  ],
  classique: [
    [12, 17, 4, 76, 43, 29, "glass"],
    ...columns(),
    [9, 15, 33, 82, 51, 5, "cornice"],
    [20, 22, 38, 60, 37, 5, "stone"],
    [31, 28, 43, 38, 25, 5, "stone"],
    ...vents(48),
  ],
  neoclassique: [
    [9, 16, 4, 82, 48, 29, "stone"],
    ...columns(),
    [7, 14, 33, 86, 54, 5, "cornice"],
    [30, 26, 38, 40, 28, 15, "glass"],
    [28, 24, 53, 44, 32, 3, "roof"],
  ],
  "art-nouveau": [
    [14, 21, 4, 72, 40, 34, "curve"],
    [11, 18, 38, 78, 46, 5, "cornice"],
    [21, 24, 43, 58, 34, 8, "glass"],
    [30, 28, 51, 40, 26, 6, "roof"],
    ...vents(57),
  ],
  baroque: [
    [9, 20, 4, 24, 43, 31, "stone"],
    [67, 20, 4, 24, 43, 31, "stone"],
    [30, 17, 4, 40, 49, 39, "stone"],
    [27, 14, 43, 46, 55, 4, "cornice"],
    [36, 26, 47, 28, 28, 9, "dome"],
    [41, 31, 56, 18, 18, 8, "dome"],
    [47, 37, 64, 6, 6, 8, "roof"],
  ],
  rococo: [
    [10, 18, 4, 80, 44, 30, "curve"],
    [7, 15, 34, 86, 50, 4, "cornice"],
    [14, 23, 38, 22, 30, 8, "dome"],
    [64, 23, 38, 22, 30, 8, "dome"],
    [37, 24, 38, 26, 28, 16, "stone"],
    [33, 20, 54, 34, 36, 5, "dome"],
    [41, 28, 59, 18, 20, 7, "dome"],
  ],
  brutaliste: [
    [19, 22, 4, 62, 38, 15, "glass"],
    [8, 14, 19, 80, 30, 20, "concrete"],
    [25, 37, 19, 66, 29, 20, "concrete"],
    [17, 19, 39, 38, 39, 18, "concrete"],
    [59, 21, 39, 17, 20, 8, "vent"],
  ],
  gothique: [
    [23, 23, 4, 54, 37, 32, "glass"],
    [11, 21, 4, 18, 42, 47, "stone"],
    [71, 21, 4, 18, 42, 47, "stone"],
    [13, 24, 51, 14, 36, 8, "roof"],
    [73, 24, 51, 14, 36, 8, "roof"],
    [17, 32, 59, 6, 20, 10, "roof"],
    [77, 32, 59, 6, 20, 10, "roof"],
    [34, 29, 36, 32, 25, 12, "roof"],
  ],
  contemporain: [
    [17, 19, 4, 66, 43, 14, "glass"],
    [9, 15, 18, 80, 43, 3, "cornice"],
    [10, 16, 21, 74, 39, 18, "glass"],
    [23, 23, 39, 66, 41, 3, "cornice"],
    [25, 25, 42, 62, 37, 15, "glass"],
    ...vents(57),
  ],
};
function Block({ part }: { part: Part }) {
  const [x, y, z, w, d, h, material] = part;
  return (
    <span
      className={`model-block material-${material}`}
      style={
        {
          left: x,
          top: y,
          width: w,
          height: d,
          transform: `translateZ(${z}px)`,
          "--w": `${w}px`,
          "--d": `${d}px`,
          "--h": `${h}px`,
        } as CSSProperties
      }
    >
      <i className="model-face face-top" />
      <i className="model-face face-front" />
      <i className="model-face face-back" />
      <i className="model-face face-left" />
      <i className="model-face face-right" />
    </span>
  );
}
/** Geometric architectural miniatures, not reconstructions of generated images. */
export function ArchitectureModel({ styleId }: { styleId: string }) {
  return (
    <span className={`architecture-model model-${styleId}`} aria-hidden="true">
      <span className="model-world">
        <span className="model-ground" />
        {[plinth, ...(models[styleId] || models.haussmannien)].map(
          (part, i) => (
            <Block key={i} part={part} />
          ),
        )}
      </span>
    </span>
  );
}

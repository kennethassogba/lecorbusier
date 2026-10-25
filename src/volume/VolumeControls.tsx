import { useEffect, useState } from "react";
import {
  Box,
  Check,
  CornerDownLeft,
  Move,
  Pencil,
  RotateCcw,
  RotateCw,
  Undo2,
  X,
  Plus,
  Minus,
} from "lucide-react";
import type { Coordinate, Design, Place } from "../types";
import type { VolumeTool } from "./MapVolume";
import {
  areaOf,
  centerOf,
  templateAt,
  transformDesign,
  validateDesign,
} from "../../worker/volume.js";
import { t, useLanguage } from "../i18n";

export function VolumeControls({
  design,
  place,
  tool,
  sketch,
  onChange,
  onTool,
  onSketch,
  onUndo,
  canUndo,
  onOrbit,
  onCenter,
  error,
}: {
  design: Design;
  place: Place;
  tool: VolumeTool;
  sketch: Coordinate[] | null;
  onChange: (d: Design, commit?: boolean) => void;
  onTool: (tool: VolumeTool) => void;
  onSketch: (points: Coordinate[] | null) => void;
  onUndo: () => void;
  canUndo: boolean;
  onOrbit: (delta: number) => void;
  onCenter: () => void;
  error: string;
}) {
  const language = useLanguage();
  const [heightText, setHeightText] = useState(String(design.height));
  useEffect(() => setHeightText(String(design.height)), [design.height]);
  const commitHeight = () => {
    const height = Number(heightText);
    onChange({ ...design, height });
    if (!heightText || height < 6 || height > 160)
      setHeightText(String(design.height));
  };
  const surface = new Intl.NumberFormat(language).format(
    Math.round(areaOf(sketch || design.footprint)),
  );
  const finish = () => {
    try {
      onChange(validateDesign({ ...design, footprint: sketch }, place));
      onSketch(null);
      onTool("orbit");
    } catch {
      onChange({ ...design, footprint: sketch || [] });
    }
  };
  return (
    <div className="volume-controls">
      <div
        className="volume-toolbar"
        role="group"
        aria-label={t("Dessin du bâtiment")}
      >
        <button
          type="button"
          aria-pressed={tool === "draw"}
          onClick={() => {
            onSketch([]);
            onTool("draw");
          }}
        >
          <Pencil size={18} />
          {t("Tracer")}
        </button>
        <button
          type="button"
          aria-pressed={tool === "edit"}
          onClick={() => {
            onSketch(null);
            onTool(tool === "edit" ? "orbit" : "edit");
          }}
        >
          <Move size={18} />
          {t("Ajuster")}
        </button>
        <button
          type="button"
          aria-pressed={tool === "orbit"}
          onClick={() => {
            onSketch(null);
            onTool("orbit");
          }}
        >
          <Box size={18} />
          3D
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Annuler la modification")}
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={19} />
        </button>
      </div>
      {tool === "draw" ? (
        <>
          <div className="draw-status" role="status">
            {t("Place les angles sur la carte")}
            <span>{sketch?.length || 0}/20</span>
          </div>
          <div className="draw-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={!sketch?.length}
              onClick={() => onSketch(sketch!.slice(0, -1))}
              aria-label={t("Retirer le dernier angle")}
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onCenter}
            >
              <Plus size={18} />
              {t("Point au centre")}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                onSketch(null);
                onTool("orbit");
              }}
              aria-label={t("Annuler le tracé")}
            >
              <X size={18} />
            </button>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={finish}
            disabled={(sketch?.length || 0) < 3}
          >
            <Check size={18} />
            {t("Fermer le contour")}
          </button>
        </>
      ) : (
        <>
          <div className="dimension-heading">
            <label htmlFor="volume-height">{t("Hauteur")}</label>
            <span className="height-value">
              <input
                id="volume-height"
                aria-label={t("Hauteur en mètres")}
                type="number"
                inputMode="numeric"
                min={6}
                max={160}
                value={heightText}
                onChange={(e) => setHeightText(e.currentTarget.value)}
                onBlur={commitHeight}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
              <span>m</span>
            </span>
          </div>
          <input
            className="height-range"
            aria-label={t("Régler la hauteur")}
            type="range"
            min={6}
            max={160}
            value={design.height}
            onChange={(e) =>
              onChange({ ...design, height: +e.target.value }, false)
            }
            onPointerUp={() => onChange(design, true)}
            onKeyUp={() => onChange(design, true)}
            onBlur={() => onChange(design, true)}
          />
          <div className="volume-measures">
            <span>{surface} m²</span>
            <span>
              {t("{n} niveaux", {
                n: Math.max(1, Math.round(design.height / 4)),
              })}
            </span>
          </div>
          {tool === "edit" ? (
            <div
              className="volume-adjustments"
              role="group"
              aria-label={t("Dimensions du bâtiment")}
            >
              <button
                type="button"
                aria-label={t("Réduire la surface")}
                onClick={() =>
                  onChange(transformDesign(design, { scale: 0.9 }))
                }
              >
                <Minus size={18} />
              </button>
              <span>{t("Surface")}</span>
              <button
                type="button"
                aria-label={t("Agrandir la surface")}
                onClick={() =>
                  onChange(transformDesign(design, { scale: 1.1 }))
                }
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                aria-label={t("Tourner le bâtiment à gauche")}
                onClick={() =>
                  onChange(transformDesign(design, { angle: -15 }))
                }
              >
                <RotateCcw size={18} />
              </button>
              <button
                type="button"
                aria-label={t("Tourner le bâtiment à droite")}
                onClick={() => onChange(transformDesign(design, { angle: 15 }))}
              >
                <RotateCw size={18} />
              </button>
            </div>
          ) : (
            <div
              className="shape-options"
              role="group"
              aria-label={t("Forme de départ")}
            >
              {["rectangle", "l", "u"].map((shape, index) => (
                <button
                  type="button"
                  key={shape}
                  onClick={() =>
                    onChange({
                      ...design,
                      footprint: templateAt(
                        centerOf(design.footprint),
                        42,
                        30,
                        shape,
                      ),
                    })
                  }
                >
                  <svg
                    viewBox="0 0 32 24"
                    width="30"
                    height="24"
                    aria-hidden="true"
                  >
                    <path
                      d={
                        index === 0
                          ? "M4 3h24v18H4z"
                          : index === 1
                            ? "M4 3h24v8H14v10H4z"
                            : "M4 3h8v10h8V3h8v18H4z"
                      }
                    />
                  </svg>
                  {t(["Bloc", "En L", "En U"][index])}
                </button>
              ))}
              <button
                type="button"
                className="orbit-button"
                onClick={() => onOrbit(60)}
                aria-label={t("Tourner autour du bâtiment")}
              >
                <RotateCw size={20} />
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <div className="error-message" role="alert">
          {t(error)}
        </div>
      )}
    </div>
  );
}

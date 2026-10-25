import { ArrowRight, MapPin, X } from "lucide-react";
import { useState } from "react";
import { t } from "../i18n";
import { BASE } from "../api";
import type { Place } from "../types";
import examples from "../../data/published-examples.json";

import { PhotoCredit } from "./PhotoCredit";
const example = examples.find((p) => p.placeId === "louvre")!;

export function Welcome({
  place,
  showHeader = true,
  onBuild,
  onClose,
}: {
  place: Place;
  showHeader?: boolean;
  onBuild: () => void;
  onClose: () => void;
}) {
  const [showComparison, setShowComparison] = useState(true);
  return (
    <>
      {showHeader && (
        <header className="sheet-header">
          <span className="welcome-brand">Le Corbusier</span>
          <button
            className="icon-button"
            aria-label={t("Explorer la carte")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
      )}
      <div className="sheet-scroll">
        {showComparison && (
          <div className="welcome-comparison">
            <figure>
              <img
                src={place.image}
                alt={t("Le Louvre aujourd'hui")}
                onError={() => setShowComparison(false)}
              />
              <figcaption>{t("Avant")}</figcaption>
            </figure>
            <ArrowRight size={22} aria-hidden="true" />
            <figure>
              <img
                src={`${BASE}/media/${example.id}.jpg?v=${example.imageRevision || 1}`}
                alt={t("Le Louvre transformé en data center")}
                onError={() => setShowComparison(false)}
              />
              <figcaption>{t("Après")}</figcaption>
            </figure>
          </div>
        )}
        <div className="welcome-copy">
          <h1>{t("Reconstruis Paris à l'ère de l'IA")}</h1>
          <p>
            {t(
              "Tu es Le Corbusier. Transforme un vrai lieu en data center et partage ta création sur la carte.",
            )}
          </p>
        </div>
        {showComparison && <PhotoCredit place={place} adapted />}
      </div>
      <footer className="sheet-footer">
        <button className="primary-button" onClick={onBuild}>
          <MapPin size={20} />
          {t("Choisir un lieu")}
        </button>
      </footer>
    </>
  );
}

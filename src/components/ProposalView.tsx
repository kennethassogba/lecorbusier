import { t, getLanguage } from "../i18n";
import { useState } from "react";
import {
  ArrowLeft,
  Heart,
  Share2,
  RotateCcw,
  LoaderCircle,
  Maximize2,
  X,
  ArrowUpRight,
} from "lucide-react";
import type { Place, Proposal } from "../types";
import { PhotoCredit } from "./PhotoCredit";
import { areaOf } from "../../worker/volume.js";
import { Modal } from "./Modal";
import { SharePanel } from "./SharePanel";
export function ProposalView({
  proposal: p,
  place,
  voted,
  onBack,
  onVote,
  onPublish,
  onRemix,
  error,
  showModel,
  onShowModel,
  onOrbit,
}: {
  proposal: Proposal;
  place: Place;
  voted: boolean;
  onBack: () => void;
  onVote: (p: Proposal) => Promise<void>;
  onPublish: () => Promise<void>;
  onRemix: () => void;
  error: string;
  showModel: boolean;
  onShowModel: (v: boolean) => void;
  onOrbit: (delta: number) => void;
}) {
  const [before, setBefore] = useState(false),
    [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState(""),
    [sharing, setSharing] = useState(false),
    [fullscreen, setFullscreen] = useState(false);
  const generating = ["queued", "planning", "generating"].includes(p.status);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setLocalError("");
    try {
      await fn();
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const img = (
    <img
      src={before || !p.image ? place.image : p.image}
      alt={before || !p.image ? t(place.name) : p.title}
      draggable={false}
    />
  );
  return (
    <>
      <>
        <header className="sheet-header">
          <button
            className="icon-button"
            aria-label={t("Retour à la carte")}
            onClick={onBack}
          >
            <ArrowLeft size={21} />
          </button>
          <div className="sheet-heading">
            <h1>{p.title}</h1>
            <span>
              {p.author} · {t(place.name)}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label={t("Fermer la création")}
            onClick={onBack}
          >
            <X size={20} />
          </button>
        </header>
        {p.design && (
          <div
            className="view-switch"
            role="group"
            aria-label={t("Vue de la création")}
          >
            <button aria-pressed={showModel} onClick={() => onShowModel(true)}>
              {t("Maquette 3D")}
            </button>
            <button
              aria-pressed={!showModel}
              onClick={() => onShowModel(false)}
            >
              {t("Image")}
            </button>
          </div>
        )}
        <div
          className={`sheet-scroll result-scroll ${showModel ? "model-result" : ""}`}
        >
          {showModel && p.design ? (
            <div className="model-summary">
              <span>
                <strong>{p.design.height} m</strong>
                {t("Hauteur")}
              </span>
              <span>
                <strong>
                  {Math.round(areaOf(p.design.footprint)).toLocaleString(
                    getLanguage(),
                  )}{" "}
                  m²
                </strong>
                {t("Emprise")}
              </span>
              <button
                className="secondary-button"
                onClick={() => onOrbit(60)}
                aria-label={t("Tourner autour du bâtiment")}
              >
                <RotateCcw size={20} />
              </button>
              {generating && (
                <span className="model-progress" role="status">
                  <LoaderCircle size={17} className="spin" />
                  {t("Génération de l’image...")}
                </span>
              )}
            </div>
          ) : (
            <>
              <div className={`result-photo ${generating ? "building" : ""}`}>
                <button
                  className="photo-open"
                  disabled={!p.image}
                  onClick={() => setFullscreen(true)}
                  aria-label={t("Agrandir la création")}
                >
                  {p.image ? (
                    <span className="photo-stage" data-before={before}>
                      <img
                        className="photo-after"
                        src={p.image}
                        alt={before ? "" : p.title}
                        draggable={false}
                      />
                      <img
                        className="photo-before"
                        src={place.image}
                        alt={before ? t(place.name) : ""}
                        draggable={false}
                      />
                    </span>
                  ) : (
                    img
                  )}
                </button>
                {p.image && (
                  <>
                    <button
                      className="photo-expand"
                      aria-label={t("Agrandir la création")}
                      onClick={() => setFullscreen(true)}
                    >
                      <Maximize2 size={18} />
                    </button>
                    <div
                      className="comparison"
                      data-before={before}
                      role="group"
                      aria-label={t("Avant et après")}
                    >
                      <button
                        aria-pressed={before}
                        onClick={() => setBefore(true)}
                      >
                        {t("Avant")}
                      </button>
                      <button
                        aria-pressed={!before}
                        onClick={() => setBefore(false)}
                      >
                        {t("Après")}
                      </button>
                    </div>
                  </>
                )}
                {generating && (
                  <div className="generation-status" role="status">
                    <LoaderCircle className="spin" size={24} />
                    <span>
                      {p.status === "generating"
                        ? t("Construction...")
                        : p.status === "planning"
                          ? t("Préparation...")
                          : t("En attente...")}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
          {p.status === "failed" && (
            <div className="error-message" role="alert">
              {t(p.error || "Création interrompue.")}
              <button className="text-button" onClick={onRemix}>
                {t("Réessayer")}
              </button>
            </div>
          )}
          {(error || localError) && (
            <div className="error-message" role="alert">
              {t(localError || error)}
            </div>
          )}
          {!showModel && <PhotoCredit place={place} adapted={!!p.image} />}
        </div>
        <footer className="sheet-footer result-actions">
          {p.published_at && (
            <button
              className={`vote-button ${voted ? "voted" : ""}`}
              aria-label={voted ? t("Retirer mon vote") : t("Voter")}
              aria-pressed={voted}
              disabled={busy}
              onClick={() => void action(() => onVote(p))}
            >
              <Heart size={21} fill={voted ? "currentColor" : "none"} />
              <span>
                {(p.votes + (p.demo_votes || 0))
                  .toLocaleString(getLanguage() === "fr" ? "fr-FR" : "en-GB")
                  .replace(/\u202f|\u00a0/g, " ")}
              </span>
            </button>
          )}
          {generating ? (
            <button className="secondary-button" onClick={onBack}>
              {t("Explorer Paris")}
              <ArrowUpRight size={18} />
            </button>
          ) : p.status === "ready" ? (
            <>
              <button
                className="icon-button remix-button"
                aria-label={t("Créer une variante")}
                onClick={onRemix}
              >
                <RotateCcw size={21} />
              </button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() =>
                  p.published_at ? setSharing(true) : void action(onPublish)
                }
              >
                {busy ? (
                  <LoaderCircle className="spin" size={19} />
                ) : p.published_at ? (
                  <Share2 size={19} />
                ) : (
                  <ArrowUpRight size={19} />
                )}{" "}
                {p.published_at ? t("Partager") : t("Ajouter à Paris")}
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={onRemix}>
              {t("Réessayer")}
            </button>
          )}
        </footer>
      </>
      {sharing && (
        <SharePanel
          proposal={p}
          place={place}
          onClose={() => setSharing(false)}
        />
      )}
      {fullscreen && (
        <Modal
          title={p.title}
          onClose={() => setFullscreen(false)}
          className="image-viewer"
        >
          {img}
          <div className="viewer-controls">
            <button
              className="secondary-button"
              onClick={() => setBefore(!before)}
            >
              {before ? t("Après") : t("Avant")}
            </button>
            {p.published_at && (
              <button
                className="primary-button"
                onClick={() => {
                  setFullscreen(false);
                  setSharing(true);
                }}
              >
                <Share2 size={18} />
                {t("Partager")}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

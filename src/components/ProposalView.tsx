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
import { Sheet } from "./Sheet";
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
}: {
  proposal: Proposal;
  place: Place;
  voted: boolean;
  onBack: () => void;
  onVote: (p: Proposal) => Promise<void>;
  onPublish: () => Promise<void>;
  onRemix: () => void;
  error: string;
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
      alt={before || !p.image ? place.name : p.title}
      draggable={false}
    />
  );
  return (
    <>
      <Sheet label={p.title} kind="result-sheet" onClose={onBack}>
        <header className="sheet-header">
          <button
            className="icon-button"
            aria-label="Retour à la carte"
            onClick={onBack}
          >
            <ArrowLeft size={21} />
          </button>
          <div className="sheet-heading">
            <h1>{p.title}</h1>
            <span>
              {p.author} · {place.name}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label="Fermer la création"
            onClick={onBack}
          >
            <X size={20} />
          </button>
        </header>
        <div className="sheet-scroll result-scroll">
          <div className={`result-photo ${generating ? "building" : ""}`}>
            <button
              className="photo-open"
              disabled={!p.image}
              onClick={() => setFullscreen(true)}
              aria-label="Agrandir la création"
            >
              {img}
            </button>
            {p.image && (
              <>
                <button
                  className="photo-expand"
                  aria-label="Agrandir la création"
                  onClick={() => setFullscreen(true)}
                >
                  <Maximize2 size={18} />
                </button>
                <div
                  className="comparison"
                  role="group"
                  aria-label="Avant et après"
                >
                  <button aria-pressed={before} onClick={() => setBefore(true)}>
                    Avant
                  </button>
                  <button
                    aria-pressed={!before}
                    onClick={() => setBefore(false)}
                  >
                    Après
                  </button>
                </div>
              </>
            )}
            {generating && (
              <div className="generation-status" role="status">
                <LoaderCircle className="spin" size={24} />
                <span>
                  {p.status === "generating"
                    ? "Construction..."
                    : p.status === "planning"
                      ? "Préparation..."
                      : "En attente..."}
                </span>
              </div>
            )}
          </div>
          {p.status === "failed" && (
            <div className="error-message" role="alert">
              {p.error || "Création interrompue."}
              <button className="text-button" onClick={onRemix}>
                Réessayer
              </button>
            </div>
          )}
          {(error || localError) && (
            <div className="error-message" role="alert">
              {localError || error}
            </div>
          )}
          <PhotoCredit place={place} adapted={!!p.image} />
        </div>
        <footer className="sheet-footer result-actions">
          {p.published_at && (
            <button
              className={`vote-button ${voted ? "voted" : ""}`}
              aria-label={voted ? "Retirer mon vote" : "Voter"}
              aria-pressed={voted}
              disabled={busy}
              onClick={() => void action(() => onVote(p))}
            >
              <Heart size={21} fill={voted ? "currentColor" : "none"} />
              <span>
                {(p.votes + (p.demo_votes || 0))
                  .toLocaleString("fr-FR")
                  .replace(/\u202f|\u00a0/g, " ")}
                {!!p.is_demo && (
                  <small
                    className="demo-score"
                    title={`${p.demo_votes || 0} votes de démonstration · ${p.votes} votes réels`}
                  >
                    démo
                  </small>
                )}
              </span>
            </button>
          )}
          {generating ? (
            <button className="secondary-button" onClick={onBack}>
              Explorer Paris
              <ArrowUpRight size={18} />
            </button>
          ) : p.status === "ready" ? (
            <>
              <button
                className="icon-button remix-button"
                aria-label="Créer une variante"
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
                {p.published_at ? "Partager" : "Ajouter à Paris"}
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={onRemix}>
              Réessayer
            </button>
          )}
        </footer>
      </Sheet>
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
              {before ? "Après" : "Avant"}
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
                Partager
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

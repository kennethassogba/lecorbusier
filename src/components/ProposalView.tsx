import { useState } from "react";
import {
  ArrowLeft,
  Heart,
  Share2,
  Download,
  RotateCcw,
  Check,
  ExternalLink,
} from "lucide-react";
import type { Place, Proposal, Style } from "../types";
import { PhotoCredit } from "./PhotoCredit";
import { sharePostcard } from "../postcard";
export function ProposalView({
  proposal: p,
  place,
  style,
  voted,
  onBack,
  onVote,
  onPublish,
  onRemix,
  onRefresh,
  error,
}: {
  proposal: Proposal;
  place: Place;
  style?: Style;
  voted: boolean;
  onBack: () => void;
  onVote: (p: Proposal) => Promise<void>;
  onPublish: () => Promise<void>;
  onRemix: () => void;
  onRefresh: () => void;
  error: string;
}) {
  const [before, setBefore] = useState(false),
    [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState(""),
    [copied, setCopied] = useState(false),
    [caption, setCaption] = useState(p.caption || ""),
    [meme, setMeme] = useState(false);
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
  async function share() {
    const url = `${location.origin}/lecorbusier/p/${p.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: p.title,
          text: caption || p.caption,
          url,
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") throw e;
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }
  return (
    <section className="proposal-view page-surface">
      <header className="page-header">
        <button
          className="icon-button"
          onClick={onBack}
          aria-label="Retour à la carte"
        >
          <ArrowLeft />
        </button>
        <h1>
          {generating
            ? "Chantier en cours"
            : p.published_at
              ? "La proposition"
              : "Votre proposition"}
        </h1>
        <button
          className="icon-button"
          onClick={onRemix}
          aria-label="Créer une variante"
        >
          <RotateCcw size={19} />
        </button>
      </header>
      <div className="proposal-scroll">
        <div className={`result-photo ${generating ? "building" : ""}`}>
          <img
            src={before || !p.image ? place.image : p.image}
            alt={
              before || !p.image
                ? `Photographie réelle de ${place.name}`
                : `${p.title}, data center imaginaire intégré à ${place.name}`
            }
          />
          {generating ? (
            <div className="generation-panel" role="status" aria-live="polite">
              <span className="generation-mark" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <h2>
                {p.status === "planning"
                  ? "Lecture du quartier"
                  : p.status === "generating"
                    ? "Les serveurs emménagent."
                    : "Ouverture du chantier"}
              </h2>
              <p>
                {p.status === "generating"
                  ? "Le monument reste. Le calcul arrive."
                  : "Préparation de ton projet."}
              </p>
              <p className="quiet-note">
                Cela peut prendre quelques minutes. Tu peux revenir plus tard
                dans Mes plans.
              </p>
            </div>
          ) : p.image ? (
            <div
              className="comparison"
              role="group"
              aria-label="Comparer la photographie et la proposition"
            >
              <button aria-pressed={before} onClick={() => setBefore(true)}>
                Avant
              </button>
              <button aria-pressed={!before} onClick={() => setBefore(false)}>
                Après
              </button>
            </div>
          ) : null}
        </div>
        <div className="result-info">
          <div className="result-title-row">
            <h2>{p.title}</h2>
            {p.published_at && (
              <button
                className={`vote-button ${voted ? "voted" : ""}`}
                aria-label={
                  voted ? "Retirer mon vote" : "Voter pour cette création"
                }
                aria-pressed={voted}
                disabled={busy}
                onClick={() => action(() => onVote(p))}
              >
                <Heart size={19} fill={voted ? "currentColor" : "none"} />
                <span>{p.votes}</span>
              </button>
            )}
          </div>
          <p className="byline">
            Par {p.author} · {place.name}
          </p>
          <p className="result-caption">{p.caption}</p>
          {p.status === "failed" && (
            <div className="error-message" role="alert">
              <p>{p.error || "La génération a échoué."}</p>
              <button className="secondary-button" onClick={onRemix}>
                Modifier et réessayer
              </button>
            </div>
          )}
          {p.brief && (
            <details className="brief">
              <summary>Les plans · {style?.name}</summary>
              <p>{p.brief}</p>
            </details>
          )}
          {!generating && p.image && (
            <>
              <button
                className="text-button meme-toggle"
                aria-expanded={meme}
                onClick={() => setMeme(!meme)}
              >
                Version mème
                <ExternalLink size={14} />
              </button>
              {meme && (
                <div className="meme-editor">
                  <label htmlFor="meme-caption">La légende</label>
                  <textarea
                    id="meme-caption"
                    rows={2}
                    maxLength={160}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() =>
                      action(() => sharePostcard(p, place, caption, true))
                    }
                  >
                    <Download size={16} />
                    Exporter la story
                  </button>
                </div>
              )}
              <PhotoCredit place={place} adapted />
              <p className="speculative">
                Architecture fictive. Monument réel.
              </p>
            </>
          )}
          {(error || localError) && (
            <p className="error-message" role="alert">
              {localError || error}
            </p>
          )}
        </div>
      </div>
      <footer className="action-footer two-actions">
        {generating ? (
          <>
            <button className="secondary-button" onClick={onBack}>
              Retour à Paris
            </button>
            <button className="text-button" onClick={onRefresh}>
              Actualiser
            </button>
          </>
        ) : p.status === "ready" ? (
          <>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                action(() => sharePostcard(p, place, caption, false))
              }
            >
              <Download size={18} />
              <span>Image</span>
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => action(p.published_at ? share : onPublish)}
            >
              {p.published_at ? (
                <>
                  {copied ? <Check size={18} /> : <Share2 size={18} />}{" "}
                  {copied ? "Lien copié" : "Partager"}
                </>
              ) : busy ? (
                "Publication..."
              ) : (
                "Publier sur la carte"
              )}
            </button>
          </>
        ) : (
          <button className="primary-button" onClick={onRemix}>
            Reprendre les plans
          </button>
        )}
      </footer>
    </section>
  );
}

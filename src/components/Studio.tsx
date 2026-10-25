import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Shuffle,
  ArrowRight,
} from "lucide-react";
import type { Config, Draft, Place } from "../types";
import { PhotoCredit } from "./PhotoCredit";
import { api } from "../api";
const names = [
  "Le Cloud de Paris",
  "Notre-Dame du GPU",
  "Palais des calculs",
  "La Maison des prompts",
  "Le Brutalisme artificiel",
  "Les Halles du serveur",
];
export function Studio({
  config,
  place,
  draft,
  setDraft,
  onBack,
  onGenerate,
  busy,
  error,
}: {
  config: Config;
  place: Place;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onBack: () => void;
  onGenerate: () => void;
  busy: boolean;
  error: string;
}) {
  const [step, setStep] = useState(2),
    [all, setAll] = useState(false),
    [suggesting, setSuggesting] = useState(false),
    [suggestionError, setSuggestionError] = useState("");
  const change = (key: keyof Draft, value: string) =>
    setDraft({ ...draft, [key]: value });
  async function suggest() {
    setSuggesting(true);
    setSuggestionError("");
    try {
      const r = await api<{ instructions: string }>("/suggest", {
        placeId: place.id,
        styleId: draft.styleId,
        instructions: draft.instructions,
      });
      change("instructions", r.instructions);
    } catch (e) {
      setSuggestionError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }
  return (
    <section
      className="studio page-surface"
      aria-label="Création d'un data center"
    >
      <header className="page-header">
        <button
          className="icon-button"
          onClick={() => (step === 3 ? setStep(2) : onBack())}
          aria-label="Retour"
        >
          <ArrowLeft />
        </button>
        <h1>{step === 2 ? "Architecture" : "Signer les plans"}</h1>
        <span className="step">{step} / 3</span>
      </header>
      <div className="studio-scroll">
        <div className="reference-photo">
          <img src={place.image} alt={`Photographie réelle : ${place.name}`} />
          <span className="photo-label">{place.name}</span>
        </div>
        <div className="studio-fields">
          {step === 2 ? (
            <>
              <div className="section-heading">
                <h2>À ta façon.</h2>
                <button
                  className="text-button"
                  onClick={() => setAll(!all)}
                  aria-expanded={all}
                >
                  {all ? "Réduire" : "Tous les styles"}
                  <ChevronDown size={15} />
                </button>
              </div>
              <div
                className={`style-options ${all ? "expanded" : ""}`}
                role="group"
                aria-label="Style architectural"
              >
                {config.styles.slice(0, all ? undefined : 3).map((s) => (
                  <button
                    key={s.id}
                    className={`style-option ${draft.styleId === s.id ? "active" : ""}`}
                    aria-pressed={draft.styleId === s.id}
                    onClick={() => change("styleId", s.id)}
                  >
                    <span
                      className={`facade facade-${s.id}`}
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      {draft.styleId === s.id && (
                        <span className="style-check">
                          <Check size={12} />
                        </span>
                      )}
                    </span>
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
              <p className="style-description">
                {config.styles.find((s) => s.id === draft.styleId)?.detail}
              </p>
              <div className="field-label">
                <label htmlFor="instructions">Tes instructions</label>
                <button
                  className="text-button"
                  disabled={suggesting}
                  onClick={() => void suggest()}
                >
                  <Shuffle size={14} />
                  {suggesting
                    ? "Recherche..."
                    : draft.instructions
                      ? "Préciser mon idée"
                      : "Une idée"}
                </button>
              </div>
              <textarea
                id="instructions"
                rows={3}
                maxLength={1800}
                value={draft.instructions}
                onChange={(e) => change("instructions", e.target.value)}
                placeholder="Des baies vitrées sur les serveurs ? Un toit qui refroidit tout le quartier ?"
              />
              {suggestionError && (
                <p className="error-message" role="alert">
                  {suggestionError}
                </p>
              )}
              <PhotoCredit place={place} />
            </>
          ) : (
            <>
              <h2>Un nom pour ce chantier.</h2>
              <div className="field-label">
                <label htmlFor="creation-title">Nom de ta création</label>
                <button
                  className="text-button"
                  onClick={() =>
                    change(
                      "title",
                      names[Math.floor(Math.random() * names.length)],
                    )
                  }
                  aria-label="Proposer un nom"
                >
                  <Shuffle size={16} />
                </button>
              </div>
              <input
                autoFocus
                id="creation-title"
                maxLength={90}
                required
                value={draft.title}
                onChange={(e) => change("title", e.target.value)}
                placeholder="Le Palais du GPU"
                autoComplete="off"
              />
              <label htmlFor="author-name">Ton nom ou pseudo</label>
              <input
                id="author-name"
                required
                maxLength={48}
                autoComplete="nickname"
                value={draft.author}
                onChange={(e) => change("author", e.target.value)}
                placeholder="Le Corbusier du dimanche"
              />
              <div className="creation-recap">
                <span>{place.name}</span>
                <span>
                  {config.styles.find((s) => s.id === draft.styleId)?.name}
                </span>
              </div>
              <p className="quiet-note">
                Ton nom et ta création seront publics après publication. Aucun
                compte.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
        </div>
      </div>
      <footer className="action-footer">
        <button
          className="primary-button"
          disabled={
            busy ||
            (step === 3 && (!draft.author.trim() || !draft.title.trim()))
          }
          onClick={() => (step === 2 ? setStep(3) : onGenerate())}
        >
          {busy
            ? "Démarrage..."
            : step === 2
              ? "Continuer"
              : "Dessiner mon data center"}
          <ArrowRight size={18} />
        </button>
      </footer>
    </section>
  );
}

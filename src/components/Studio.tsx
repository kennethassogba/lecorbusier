import { ArchitectureModel } from "./ArchitectureModel";
import { t, getLanguage } from "../i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Shuffle,
  X,
} from "lucide-react";
import type { Config, Draft, Place } from "../types";
import { api } from "../api";
import { Sheet } from "./Sheet";
const names = [
  "Notre-Dame du GPU",
  "Le Palais du GPU",
  "Le Cloud de Paris",
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
  const [step, setStep] = useState(history.state?.studioStep || 0),
    [suggesting, setSuggesting] = useState(false),
    [suggestionError, setSuggestionError] = useState("");
  const styles = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const list = styles.current;
    const active = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (list && active) {
      list.scrollLeft +=
        active.getBoundingClientRect().left -
        list.getBoundingClientRect().left -
        (list.clientWidth - active.offsetWidth) / 2;
    }
  }, [step]);
  useEffect(() => {
    const restore = () => setStep(history.state?.studioStep || 0);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const change = (key: keyof Draft, value: string) =>
    setDraft({ ...draft, [key]: value });
  async function suggest() {
    setSuggesting(true);
    setSuggestionError("");
    try {
      const r = await api<{ instructions: string }>("/suggest", {
        placeId: place.id,
        location: draft.location,
        language: getLanguage(),
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
    <Sheet
      label={step === 0 ? t("Architecture") : t("Nommer la création")}
      kind="studio-sheet"
      onClose={onBack}
    >
      <header className="sheet-header">
        <button
          className="icon-button"
          aria-label={t("Retour")}
          onClick={() => (step ? history.back() : onBack())}
        >
          <ArrowLeft size={21} />
        </button>
        <div className="sheet-heading">
          <h1>{step === 0 ? t("Architecture") : t("Nommer")}</h1>
          <span>{t(place.name)}</span>
        </div>
        <span
          role="img"
          className="step-dots"
          aria-label={t("Étape {n} sur 2", { n: step + 1 })}
        >
          <i className="done" />
          <i className={step ? "done" : ""} />
        </span>
        <button
          className="icon-button"
          aria-label={t("Fermer la création")}
          onClick={onBack}
        >
          <X size={20} />
        </button>
      </header>
      <form
        className="studio-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!step) {
            history.pushState(
              {
                ...history.state,
                lc: {
                  ...history.state?.lc,
                  depth: (history.state?.lc?.depth || 0) + 1,
                },
                studioStep: 1,
              },
              "",
            );
            setStep(1);
          } else onGenerate();
        }}
      >
        <div className="sheet-scroll">
          {step === 0 ? (
            <>
              <div
                ref={styles}
                className="style-options"
                role="group"
                aria-label={t("Style architectural")}
              >
                {config.styles.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`style-option ${s.id === draft.styleId ? "active" : ""}`}
                    aria-pressed={s.id === draft.styleId}
                    onClick={(e) => {
                      change("styleId", s.id);
                      e.currentTarget.scrollIntoView({
                        behavior: "auto",
                        block: "nearest",
                        inline: "nearest",
                      });
                    }}
                  >
                    <span className="style-drawing">
                      <ArchitectureModel styleId={s.id} />
                      {s.id === draft.styleId && (
                        <Check size={14} className="style-check" />
                      )}
                    </span>
                    <span>{t(s.name)}</span>
                  </button>
                ))}
              </div>
              <div className="field-label">
                <label htmlFor="instructions">{t("Une idée ?")}</label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void suggest()}
                  disabled={suggesting}
                  aria-label={t("Proposer une idée")}
                >
                  {suggesting ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Shuffle size={18} />
                  )}
                </button>
              </div>
              <textarea
                id="instructions"
                name="instructions"
                rows={2}
                maxLength={1800}
                value={draft.instructions}
                onChange={(e) => change("instructions", e.target.value)}
                placeholder={t("Serveurs sous verre, toit en zinc...")}
              />
              {suggestionError && (
                <div className="error-message" role="alert">
                  {t(suggestionError)}
                </div>
              )}
            </>
          ) : (
            <div className="signature-fields">
              <div className="signature-place">
                <img src={place.image} alt="" />
                <span>
                  {t(
                    config.styles.find((s) => s.id === draft.styleId)?.name ||
                      "",
                  )}
                </span>
              </div>
              <div className="field-label">
                <label htmlFor="creation-title">
                  {t("Nom du data center")}
                </label>
                <button
                  type="button"
                  className="text-button"
                  aria-label={t("Proposer un nom")}
                  onClick={() =>
                    change(
                      "title",
                      t(names[Math.floor(Math.random() * names.length)]),
                    )
                  }
                >
                  <Shuffle size={18} />
                </button>
              </div>
              <input
                id="creation-title"
                name="title"
                autoComplete="off"
                enterKeyHint="next"
                required
                maxLength={90}
                value={draft.title}
                onChange={(e) => change("title", e.target.value)}
                placeholder={t("Notre-Dame du GPU")}
              />
              <label htmlFor="author-name">{t("Ton pseudo")}</label>
              <input
                id="author-name"
                name="nickname"
                autoComplete="nickname"
                enterKeyHint="go"
                required
                maxLength={48}
                value={draft.author}
                onChange={(e) => change("author", e.target.value)}
                placeholder="Camille"
              />
            </div>
          )}
          {error && (
            <div className="error-message" role="alert">
              {t(error)}
            </div>
          )}
        </div>
        <footer className="sheet-footer">
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? (
              <LoaderCircle size={19} className="spin" />
            ) : step ? (
              <PlusMark />
            ) : (
              <ArrowRight size={19} />
            )}{" "}
            {busy ? t("Création...") : step ? t("Construire") : t("Continuer")}
          </button>
        </footer>
      </form>
    </Sheet>
  );
}
function PlusMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M10 3v14M3 10h14" />
    </svg>
  );
}

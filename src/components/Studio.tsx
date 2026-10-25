import { useEffect, useState } from "react";
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
function Facade({ id }: { id: string }) {
  const modern = ["brutaliste", "contemporain", "art-deco"].includes(id);
  return (
    <svg
      className={`facade facade-${id}`}
      viewBox="0 0 96 72"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M10 65h76M19 65V26h58v39" />
      {id === "art-deco" ? (
        <path d="M19 26h10V18h12V10h14v8h12v8" />
      ) : modern ? (
        <path d="M19 26V14h58v12M19 40h58M48 14v51" />
      ) : (
        <path d="M16 26 48 9l32 17ZM23 23h50" />
      )}
      {[29, 44, 59].map((x) => (
        <g key={x}>
          {["classique", "neoclassique", "neo-classique"].includes(id) ? (
            <path d={`M${x} 30v28m-3-28h9m-9 28h9`} />
          ) : (
            <>
              <path d={`M${x} 42V32h8v10zM${x} 59V49h8v10z`} />
              {!modern && <path d={`M${x - 2} 44h12M${x - 2} 61h12`} />}
            </>
          )}
        </g>
      ))}
      {["baroque", "rococo", "art-nouveau"].includes(id) && (
        <path d="M24 26q-8-12 0-10t10 0M72 26q8-12 0-10t-10 0M39 22q9-16 18 0" />
      )}
      {id === "haussmannien" && (
        <path d="M19 25 26 12h44l7 13M33 12V8h5v4M60 12V8h5v4M19 46h58" />
      )}
      {id === "gothique" && (
        <path d="m20 26 7-18 7 18m28 0 7-18 7 18M40 26l8-22 8 22" />
      )}
    </svg>
  );
}
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
      label={step === 0 ? "Architecture" : "Nommer la création"}
      kind="studio-sheet"
      onClose={onBack}
    >
      <header className="sheet-header">
        <button
          className="icon-button"
          aria-label="Retour"
          onClick={() => (step ? history.back() : onBack())}
        >
          <ArrowLeft size={21} />
        </button>
        <div className="sheet-heading">
          <h1>{step === 0 ? "Architecture" : "Nommer"}</h1>
          <span>{place.name}</span>
        </div>
        <span
          role="img"
          className="step-dots"
          aria-label={`Étape ${step + 1} sur 2`}
        >
          <i className="done" />
          <i className={step ? "done" : ""} />
        </span>
        <button
          className="icon-button"
          aria-label="Fermer la création"
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
                className="style-options"
                role="group"
                aria-label="Style architectural"
              >
                {config.styles.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`style-option ${s.id === draft.styleId ? "active" : ""}`}
                    aria-pressed={s.id === draft.styleId}
                    onClick={() => change("styleId", s.id)}
                  >
                    <span className="style-drawing">
                      <Facade id={s.id} />
                      {s.id === draft.styleId && (
                        <Check size={14} className="style-check" />
                      )}
                    </span>
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
              <div className="field-label">
                <label htmlFor="instructions">Une idée ?</label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void suggest()}
                  disabled={suggesting}
                  aria-label="Proposer une idée"
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
                placeholder="Serveurs sous verre, toit en zinc..."
              />
              {suggestionError && (
                <div className="error-message" role="alert">
                  {suggestionError}
                </div>
              )}
            </>
          ) : (
            <div className="signature-fields">
              <div className="signature-place">
                <img src={place.image} alt="" />
                <span>
                  {config.styles.find((s) => s.id === draft.styleId)?.name}
                </span>
              </div>
              <div className="field-label">
                <label htmlFor="creation-title">Nom du data center</label>
                <button
                  type="button"
                  className="text-button"
                  aria-label="Proposer un nom"
                  onClick={() =>
                    change(
                      "title",
                      names[Math.floor(Math.random() * names.length)],
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
                placeholder="Notre-Dame du GPU"
              />
              <label htmlFor="author-name">Ton pseudo</label>
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
              {error}
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
            {busy ? "Création..." : step ? "Construire" : "Continuer"}
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

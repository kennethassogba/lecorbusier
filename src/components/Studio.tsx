import { useIsPresent } from "motion/react";
import { VolumeControls } from "../volume/VolumeControls";
import type { VolumeTool } from "../volume/MapVolume";
import { t, getLanguage, useLanguage } from "../i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Shuffle,
  X,
} from "lucide-react";
import type { Config, Draft, Place, Design, Coordinate } from "../types";
import { api } from "../api";
import { PALETTES, paletteFor } from "../../worker/palettes.js";

export function Studio({
  config,
  place,
  draft,
  setDraft,
  onBack,
  onClose,
  onGenerate,
  busy,
  error,
  volumeTool,
  sketch,
  onSketch,
  onTool,
  onDesign,
  onUndo,
  canUndo,
  volumeError,
  onOrbit,
  onCenter,
}: {
  config: Config;
  place: Place;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onBack: () => void;
  onClose: () => void;
  onGenerate: () => void;
  busy: boolean;
  error: string;
  volumeTool: VolumeTool;
  sketch: Coordinate[] | null;
  onSketch: (points: Coordinate[] | null) => void;
  onTool: (tool: VolumeTool) => void;
  onDesign: (design: Design, commit?: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
  volumeError: string;
  onOrbit: (delta: number) => void;
  onCenter: () => void;
}) {
  const [step, setStep] = useState(history.state?.studioStep || 0),
    [suggesting, setSuggesting] = useState(false),
    [suggestionError, setSuggestionError] = useState("");
  const language = useLanguage();
  const present = useIsPresent();
  const [names, setNames] = useState<string[]>([]);
  const [naming, setNaming] = useState(false);
  const [nameError, setNameError] = useState("");
  const nameRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!present) nameRequest.current?.abort();
  }, [present]);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  useEffect(() => {
    setNames([]);
    setNameError("");
    setNaming(false);
    return () => nameRequest.current?.abort();
  }, [place.id, draft.styleId, draft.instructions, language]);
  async function suggestNames() {
    nameRequest.current?.abort();
    const controller = new AbortController();
    nameRequest.current = controller;
    setNaming(true);
    setNameError("");
    try {
      const result = await api<{ names: string[] }>(
        "/suggest",
        {
          kind: "names",
          placeId: place.id,
          location: draft.location,
          language,
          styleId: draft.styleId,
          instructions: draft.instructions,
          title: draft.title,
          previous: names,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setNames(result.names);
      // Do not replace a title the player edited while the request was running.
      if (latestDraft.current.title === draft.title)
        change("title", result.names[0]);
    } catch (e) {
      if (!controller.signal.aborted) setNameError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setNaming(false);
    }
  }
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
    setDraft({ ...latestDraft.current, [key]: value });
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
    <>
      <header className="sheet-header">
        <button
          className="icon-button"
          aria-label={t("Retour")}
          onClick={() => (step ? history.back() : onBack())}
        >
          <ArrowLeft size={21} />
        </button>
        <div className="sheet-heading">
          <h1>{t(["Volume", "Architecture", "Nommer"][step])}</h1>
          <span>{t(place.name)}</span>
        </div>
        <span
          role="img"
          className="step-dots"
          aria-label={t("Étape {n} sur 3", { n: step + 1 })}
        >
          <i className="done" />
          <i className={step >= 1 ? "done" : ""} />
          <i className={step >= 2 ? "done" : ""} />
        </span>
        <button
          className="icon-button"
          aria-label={t("Fermer la création")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <form
        inert={busy}
        className="studio-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 2) {
            history.pushState(
              {
                ...history.state,
                lc: {
                  ...history.state?.lc,
                  depth: (history.state?.lc?.depth || 0) + 1,
                },
                studioStep: step + 1,
              },
              "",
            );
            setStep(step + 1);
            onTool("orbit");
          } else onGenerate();
        }}
      >
        <div className="sheet-scroll">
          {step === 0 && draft.design ? (
            <VolumeControls
              design={draft.design}
              place={place}
              tool={volumeTool}
              sketch={sketch}
              onChange={onDesign}
              onTool={onTool}
              onSketch={onSketch}
              onUndo={onUndo}
              canUndo={canUndo}
              onOrbit={onOrbit}
              onCenter={onCenter}
              error={volumeError}
            />
          ) : step === 1 ? (
            <>
              <div
                ref={styles}
                className="style-options volume-style-options"
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
                    {s.id === draft.styleId && <Check size={15} />}
                    <span>{t(s.name)}</span>
                  </button>
                ))}
              </div>
              {draft.design && (
                <div
                  className="material-swatches"
                  role="group"
                  aria-label={t("Couleur")}
                >
                  {PALETTES.map((p) => {
                    const active =
                      paletteFor(draft.design, draft.styleId).id === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        aria-label={t(p.name)}
                        title={t(p.name)}
                        aria-pressed={active}
                        onClick={() =>
                          onDesign({ ...draft.design!, palette: p.id })
                        }
                      >
                        <span style={{ backgroundColor: p.facade }}>
                          {active && <Check size={19} strokeWidth={2.5} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
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
                  onClick={() => void suggestNames()}
                  disabled={naming}
                >
                  {naming ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <Shuffle size={18} />
                  )}
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
                placeholder={t("Un nom pour {lieu}", { lieu: t(place.name) })}
              />
              {names.length > 0 && (
                <div
                  className="name-suggestions"
                  role="group"
                  aria-label={t("Noms proposés")}
                >
                  {names.map((name) => (
                    <button
                      type="button"
                      key={name}
                      aria-pressed={draft.title === name}
                      onClick={() => change("title", name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              {nameError && (
                <div className="error-message" role="alert">
                  {t(nameError)}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void suggestNames()}
                  >
                    {t("Réessayer")}
                  </button>
                </div>
              )}
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
          <button
            type="submit"
            className="primary-button"
            disabled={
              busy ||
              (step === 0 && !!sketch) ||
              (step === 2 && !config.generationAvailable)
            }
          >
            {busy ? (
              <LoaderCircle size={19} className="spin" />
            ) : step === 2 ? (
              <PlusMark />
            ) : (
              <ArrowRight size={19} />
            )}{" "}
            {busy
              ? t("Création...")
              : step === 2
                ? t("Générer l’image")
                : t("Continuer")}
          </button>
        </footer>
      </form>
    </>
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

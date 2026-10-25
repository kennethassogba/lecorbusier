import { t, useLanguage } from "../i18n";
import { useEffect, useState } from "react";
import { Check, Copy, Download, LoaderCircle, Share2 } from "lucide-react";
import { Modal } from "./Modal";
import { preparePostcard } from "../postcard";
import type { Place, Proposal } from "../types";
import { BASE } from "../api";
export function SharePanel({
  proposal,
  place,
  onClose,
}: {
  proposal?: Proposal;
  place?: Place;
  onClose: () => void;
}) {
  const language = useLanguage();
  const [format, setFormat] = useState<"image" | "story">("image"),
    [caption, setCaption] = useState(proposal?.caption || ""),
    [prepared, setPrepared] = useState<{ file: File; credit: string } | null>(
      null,
    ),
    [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const url =
    location.origin +
    BASE +
    (proposal?.published_at ? "/p/" + proposal.id : "/");
  useEffect(() => {
    if (!proposal || !place) return;
    let cancelled = false;
    let objectUrl = "";
    setPrepared(null);
    setError("");
    const timer = setTimeout(
      () =>
        void preparePostcard(proposal, place, caption, format === "story")
          .then((data) => {
            if (cancelled) return;
            setPrepared(data);
            objectUrl = URL.createObjectURL(data.file);
            setPreview(objectUrl);
          })
          .catch(() => {
            if (!cancelled) setError(t("Image indisponible. Réessaie."));
          }),
      180,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proposal?.id, proposal?.image, place?.id, caption, format, language]);
  async function share() {
    setError("");
    try {
      if (navigator.share) {
        // File is prepared before this tap to preserve Web Share's transient user activation.
        const data: ShareData = {
          title: proposal?.title || "Le Corbusier",
          url,
        };
        if (prepared && navigator.canShare?.({ files: [prepared.file] })) {
          data.files = [prepared.file];
          data.text = `${proposal?.author} · ${t(place?.name || "")}\n${url}\n${prepared.credit}`;
          delete data.url;
        }
        await navigator.share(data);
      } else await copy();
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError(t("Partage indisponible. Copie le lien."));
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(t("Copie impossible. Utilise un bouton de partage."));
    }
  }
  function save() {
    if (!prepared) return;
    const u = URL.createObjectURL(prepared.file),
      a = document.createElement("a");
    a.href = u;
    a.download = prepared.file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 10000);
  }
  return (
    <Modal
      title={proposal ? t("Partager la création") : t("Partager l'app")}
      onClose={onClose}
      className="share-modal"
    >
      {proposal && (
        <>
          <div
            className="segmented"
            role="group"
            aria-label={t("Format de partage")}
          >
            <button
              aria-pressed={format === "image"}
              onClick={() => setFormat("image")}
            >
              {t("Image")}
            </button>
            <button
              aria-pressed={format === "story"}
              onClick={() => setFormat("story")}
            >
              {t("Story")}
            </button>
          </div>
          <div className="share-preview">
            {preview ? (
              <img src={preview} alt={proposal.title} />
            ) : (
              <LoaderCircle size={25} className="spin" />
            )}
          </div>
          {format === "story" && (
            <textarea
              aria-label={t("Légende de la story")}
              rows={2}
              maxLength={160}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("Ta légende")}
            />
          )}
        </>
      )}
      {error && (
        <div className="error-message" role="alert">
          {t(error)}
        </div>
      )}
      <div className="share-actions">
        <button
          className="primary-button"
          disabled={!!proposal && !prepared && !error}
          onClick={() => void share()}
        >
          <Share2 size={19} />
          {typeof navigator.share === "function"
            ? t("Partager")
            : t("Copier le lien")}
        </button>
        <div className="share-links">
          <button
            aria-label={copied ? t("Lien copié") : t("Copier le lien")}
            onClick={() => void copy()}
          >
            <span>{copied ? <Check size={21} /> : <Copy size={21} />}</span>
            {copied ? t("Copié") : t("Lien")}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent((proposal?.title || "Le Corbusier") + " " + url)}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="social-letter" aria-hidden="true">
              W
            </span>
            WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(proposal?.title || "Le Corbusier")}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="social-letter" aria-hidden="true">
              X
            </span>
            X
          </a>
          {prepared && (
            <button aria-label={t("Enregistrer l’image")} onClick={save}>
              <span>
                <Download size={21} />
              </span>
              {t("Enregistrer")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

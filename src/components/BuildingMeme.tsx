import { useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { BASE, readLocal, saveLocal } from "../api";
import { t } from "../i18n";

const memes = [
  { id: "waiting", name: "Waiting Skeleton", caption: "Le permis de construire" },
  { id: "disaster", name: "Disaster Girl", caption: "Moi, urbaniste" },
  { id: "fine", name: "This Is Fine", caption: "Le refroidissement" },
];

export function BuildingMeme({ proposalId }: { proposalId: string }) {
  const [variant] = useState(() => {
    const last = readLocal<{ id: string; variant: string } | null>(
      "corbs-building-meme",
      null,
    );
    const saved = memes.find((meme) => meme.id === last?.variant);
    if (last?.id === proposalId && saved) return saved;
    const next = memes.filter((meme) => meme.id !== last?.variant);
    const variant = next[Math.floor(Math.random() * next.length)];
    saveLocal("corbs-building-meme", { id: proposalId, variant: variant.id });
    return variant;
  });
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className={`building-interlude ${dismissed ? "dismissed" : ""}`}>
      <span className="building-status" role="status">
        <LoaderCircle size={18} className="spin" aria-hidden="true" />
        Building...
      </span>
      {!dismissed && (
        <>
          <div className="building-meme">
            <p className="building-caption">{t(variant.caption)}</p>
            <img
              src={`${BASE}/memes/${variant.id}.webp`}
              alt={variant.name}
              draggable={false}
              onError={() => setDismissed(true)}
            />
          </div>
          <button
            className="icon-button building-meme-close"
            aria-label={t("Masquer le mème")}
            onClick={() => setDismissed(true)}
          >
            <X size={18} />
          </button>
        </>
      )}
    </div>
  );
}

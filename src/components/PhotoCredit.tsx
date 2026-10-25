import type { Place } from "../types";
export function PhotoCredit({
  place,
  adapted = false,
}: {
  place: Place;
  adapted?: boolean;
}) {
  return (
    <details className="photo-credit">
      <summary>Crédit photo{adapted ? " et image modifiée" : ""}</summary>
      <p>
        <a href={place.sourceUrl} target="_blank" rel="noreferrer">
          {place.author}
        </a>{" "}
        ·{" "}
        <a
          href={place.licenseUrl || place.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {place.license}
        </a>
        {adapted
          ? " · Transformation générée avec OpenAI. Les conditions de la photographie source restent applicables."
          : ""}
      </p>
    </details>
  );
}

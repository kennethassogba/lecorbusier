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
      <summary>Crédits</summary>
      <div>
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
        {adapted ? " · Image modifiée" : ""}
      </div>
    </details>
  );
}

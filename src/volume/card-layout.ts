export type RoofPoint = {
  id: string;
  x: number;
  y: number;
  selected?: boolean;
};
export const CARD_WIDTH = 184;
export const CARD_HEIGHT = 62;
export function arrangeCards(
  points: RoofPoint[],
  bounds: { left: number; right: number; top: number; bottom: number },
  cardHeight = CARD_HEIGHT,
) {
  const placed: {
    id: string;
    x: number;
    y: number;
    roofX: number;
    roofY: number;
  }[] = [];
  const middle = (bounds.left + bounds.right) / 2;
  const ordered = [...points].sort(
    (a, b) =>
      Number(!!b.selected) - Number(!!a.selected) ||
      Math.abs(a.x - middle) - Math.abs(b.x - middle) ||
      a.id.localeCompare(b.id),
  );
  for (const p of ordered) {
    if (
      p.x < bounds.left ||
      p.x > bounds.right ||
      p.y < bounds.top ||
      p.y > bounds.bottom
    )
      continue;
    const center = Math.max(
      bounds.left + CARD_WIDTH / 2,
      Math.min(bounds.right - CARD_WIDTH / 2, p.x),
    );
    let fit = false;
    for (const rise of [12, cardHeight + 24]) {
      for (const shift of [0, -(CARD_WIDTH / 2 + 6), CARD_WIDTH / 2 + 6]) {
        const x = center + shift,
          y = p.y - rise;
        if (
          x - CARD_WIDTH / 2 < bounds.left ||
          x + CARD_WIDTH / 2 > bounds.right ||
          y - cardHeight < bounds.top
        )
          continue;
        if (
          placed.some(
            (q) =>
              Math.abs(q.x - x) < CARD_WIDTH + 8 &&
              Math.abs(q.y - y) < cardHeight + 8,
          )
        )
          continue;
        placed.push({ id: p.id, x, y, roofX: p.x, roofY: p.y });
        fit = true;
        break;
      }
      if (fit) break;
    }
  }
  return placed;
}

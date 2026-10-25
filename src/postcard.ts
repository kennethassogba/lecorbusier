import type { Place, Proposal } from "./types";
export async function preparePostcard(
  p: Proposal,
  place: Place,
  caption: string,
  meme: boolean,
) {
  if (!p.image) throw new Error("L’image est encore en cours de création.");
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = p.image;
  await image.decode();
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = meme
    ? 1920
    : Math.round((image.height * 1080) / image.width) + 230;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Image indisponible. Réessaie.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#111111";
  const wrap = (text: string, y: number, size: number, maxLines = 3) => {
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    const words = text.split(/\s+/);
    let line = "",
      lines = 0;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > 964 && line) {
        ctx.fillText(line, 58, y);
        y += size * 1.22;
        line = word;
        if (++lines >= maxLines - 1) break;
      } else line = test;
    }
    ctx.fillText(line, 58, y);
    return y;
  };
  let top = 0;
  if (meme) {
    top = 300;
    wrap(caption || p.caption || p.title, 80, 46, 4);
  }
  const photoHeight = meme ? 1310 : c.height - 230;
  const ratio = Math.min(1080 / image.width, photoHeight / image.height);
  ctx.drawImage(
    image,
    (1080 - image.width * ratio) / 2,
    top + (photoHeight - image.height * ratio) / 2,
    image.width * ratio,
    image.height * ratio,
  );
  const y = c.height - 170;
  wrap(p.title, y, 38, 2);
  ctx.font = "25px system-ui, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText(`${p.author} · ${place.name}`, 58, c.height - 85);
  ctx.font = "21px system-ui, sans-serif";
  ctx.fillText("keff.uk/lecorbusier", 58, c.height - 43);
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(
    `Photo : ${place.author} · ${place.license} · image modifiée`,
    58,
    c.height - 25,
    964,
  );
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText(place.sourceUrl.replace("https://", ""), 58, c.height - 7, 964);
  const blob = await new Promise<Blob | null>((resolve) =>
    c.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("L’image n’a pas pu être exportée.");
  const credit = `${place.author}, ${place.license}. Photo source : ${place.sourceUrl}. Transformation OpenAI.`;
  const file = new File(
    [blob],
    `${p.title.replace(/[^a-z0-9àâéèêëîïôùûüç-]/gi, "-").slice(0, 70)}.png`,
    { type: "image/png" },
  );
  return { file, credit };
}

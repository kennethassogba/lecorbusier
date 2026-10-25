import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Heart } from "lucide-react";
import type { Map as ParisMap } from "maplibre-gl";
import type { Proposal } from "../types";
import type { volumeLayer } from "./layer";
import { t, useLanguage } from "../i18n";
import { arrangeCards, CARD_HEIGHT, type RoofPoint } from "./card-layout";

export function ConstructionCards({
  map,
  engine,
  proposals,
  selectedId,
  hidden,
  onOpen,
}: {
  map: ParisMap;
  engine: RefObject<ReturnType<typeof volumeLayer> | null>;
  proposals: Proposal[];
  selectedId?: string;
  hidden: boolean;
  onOpen: (p: Proposal) => void;
}) {
  const language = useLanguage();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const lines = useRef(new Map<string, HTMLSpanElement>());
  const buildings = useMemo(
    () => proposals.filter((p) => p.published_at && p.design),
    [proposals],
  );
  const latest = useRef({ buildings, selectedId, hidden });
  latest.current = { buildings, selectedId, hidden };
  const update = useRef(() => {});
  useEffect(() => {
    const container = map.getContainer();
    const root = container.closest(".app-shell");
    update.current = () => {
      const { buildings, selectedId, hidden } = latest.current;
      const points: RoofPoint[] = [];
      if (!hidden)
        for (const p of buildings) {
          const at = engine.current?.projectRoof(p.id);
          if (at)
            points.push({ id: p.id, ...at, selected: p.id === selectedId });
        }
      const panelHeight = root
        ? parseFloat(
            getComputedStyle(root).getPropertyValue("--panel-height"),
          ) || 0
        : 0;
      const desktop = container.clientWidth >= 800;
      const first = buttons.current.values().next().value;
      const cardHeight = first
        ? parseFloat(getComputedStyle(first).height) || CARD_HEIGHT
        : CARD_HEIGHT;
      const layout = arrangeCards(
        points,
        {
          left: desktop && panelHeight > 0 ? 450 : 12,
          right: container.clientWidth - 12,
          top: 128,
          bottom:
            container.clientHeight -
            (desktop ? 145 : Math.max(145, panelHeight + 12)),
        },
        cardHeight,
      );
      const positions = new Map(layout.map((p) => [p.id, p]));
      for (const [id, button] of buttons.current) {
        const pos = positions.get(id),
          line = lines.current.get(id);
        button.hidden = !pos;
        if (line) line.hidden = !pos;
        if (!pos) continue;
        button.style.transform = `translate(${pos.x}px,${pos.y}px) translate(-50%,-100%)`;
        button.style.zIndex = id === selectedId ? "2" : "1";
        if (line) {
          const dx = pos.x - pos.roofX,
            dy = pos.y - pos.roofY;
          line.style.height = `${Math.hypot(dx, dy)}px`;
          line.style.transform = `translate(${pos.roofX}px,${pos.roofY}px) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI - 90}deg)`;
        }
      }
    };
    map.on("render", update.current);
    const observer = new MutationObserver(() => update.current());
    if (root)
      observer.observe(root, { attributes: true, attributeFilter: ["style"] });
    update.current();
    return () => {
      map.off("render", update.current);
      observer.disconnect();
    };
  }, [map, engine]);
  useLayoutEffect(
    () => update.current(),
    [buildings, selectedId, hidden, language],
  );
  return createPortal(
    <div
      className="construction-cards"
      role="group"
      aria-label={t("Constructions sur la carte")}
    >
      {buildings.map((p) => {
        const count = p.votes + (p.demo_votes || 0);
        return (
          <div key={p.id}>
            <span
              hidden
              className="construction-tether"
              aria-hidden="true"
              ref={(node) => {
                if (node) lines.current.set(p.id, node);
                else lines.current.delete(p.id);
              }}
            />
            <button
              hidden
              type="button"
              className="construction-card"
              data-proposal-id={p.id}
              aria-pressed={p.id === selectedId}
              ref={(node) => {
                if (node) buttons.current.set(p.id, node);
                else buttons.current.delete(p.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(p);
              }}
            >
              <strong title={p.title}>{p.title}</strong>
              <span className="construction-meta">
                <span className="construction-author" title={p.author}>
                  {p.author}
                </span>
                <span className="construction-likes">
                  <Heart size={13} aria-hidden="true" />
                  {count
                    .toLocaleString(language === "fr" ? "fr-FR" : "en-GB")
                    .replace(/[\u202f\u00a0]/g, " ")}
                </span>
              </span>
            </button>
          </div>
        );
      })}
    </div>,
    map.getContainer(),
  );
}

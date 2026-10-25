import { t } from "../i18n";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionTemplate,
  usePresence,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { easeDrawer, reduceMotion } from "../motion";

/** Non-modal map sheet. Dragging is isolated to the handle; content and map keep native scrolling. */
export function Sheet({
  children,
  label,
  kind = "",
  onClose,
  autoFocus = true,
}: {
  children: ReactNode;
  label: string;
  kind?: string;
  onClose?: () => void;
  autoFocus?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [present, safeToRemove] = usePresence();
  const panel = useRef<HTMLElement>(null);
  const summary = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; start: number; offset: number } | null>(
    null,
  );
  const dragged = useRef(false);
  const collapsedRef = useRef(false);
  const lastLabel = useRef(label);
  const stillPresent = useRef(present);
  stillPresent.current = present;
  const animation = useRef<{ stop: () => void } | null>(null);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const transform = useMotionTemplate`translate3d(0, ${y}px, 0)`;
  const clipPath = useTransform(y, (value) =>
    value > 0.1
      ? `inset(0px 0px ${value}px 0px round var(--sheet-radius, 26px 26px 0px 0px))`
      : "none",
  );
  const rest = () =>
    Math.max(
      0,
      (panel.current?.offsetHeight || 0) -
        28 -
        (summary.current?.offsetHeight || 56),
    );
  function settle(next: boolean, velocity = 0) {
    animation.current?.stop();
    collapsedRef.current = next;
    setCollapsed(next);
    const target = next ? rest() : 0;
    if (reduceMotion()) y.set(target);
    else
      animation.current = animate(y, target, {
        type: "spring",
        duration: 0.38,
        bounce: 0,
        velocity,
      });
  }
  useMotionValueEvent(y, "change", (value) => {
    if (!present || !panel.current) return;
    panel.current
      .closest<HTMLElement>(".app-shell")
      ?.style.setProperty(
        "--panel-height",
        `${Math.max(0, panel.current.offsetHeight - value)}px`,
      );
  });
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    y.set(reduceMotion() ? 0 : el.offsetHeight);
    opacity.set(0);

    const observer = new ResizeObserver(() => {
      if (!drag.current && collapsedRef.current) y.set(rest());
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      animation.current?.stop();
    };
  }, []);
  useLayoutEffect(() => {
    if (lastLabel.current !== label) {
      settle(false);
      lastLabel.current = label;
    }
    if (autoFocus) panel.current?.focus({ preventScroll: true });
  }, [label, autoFocus]);
  useLayoutEffect(() => {
    animation.current?.stop();
    if (present) {
      const entry = animate(y, collapsedRef.current ? rest() : 0, {
        duration: reduceMotion() ? 0 : 0.28,
        ease: easeDrawer,
      });
      const fade = animate(opacity, 1, { duration: 0.16 });
      animation.current = entry;
      return () => {
        entry.stop();
        fade.stop();
      };
    }
    const exit = animate(
      y,
      reduceMotion() ? y.get() : panel.current?.offsetHeight || 80,
      { duration: reduceMotion() ? 0 : 0.18, ease: easeDrawer },
    );
    const fade = animate(opacity, 0, { duration: 0.14 });
    void Promise.all([exit, fade]).then(() => {
      if (!stillPresent.current) safeToRemove?.();
    });
    return () => {
      exit.stop();
      fade.stop();
    };
  }, [present]);
  function finish(e: PointerEvent<HTMLButtonElement>, cancel = false) {
    if (drag.current?.id !== e.pointerId) return;
    const delta = e.clientY - drag.current.start;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (!dragged.current) {
      settle(collapsedRef.current);
      return;
    }
    const velocity = y.getVelocity();
    if (cancel) dragged.current = false;
    if (reduceMotion()) {
      settle(
        cancel
          ? collapsedRef.current
          : delta > 30
            ? true
            : delta < -30
              ? false
              : collapsedRef.current,
      );
      return;
    }
    settle(
      cancel
        ? collapsedRef.current
        : velocity > 450
          ? true
          : velocity < -450
            ? false
            : y.get() > rest() * 0.45,
      velocity,
    );
  }
  return (
    <motion.section
      ref={panel}
      tabIndex={-1}
      aria-label={label}
      inert={!present}
      data-exiting={!present || undefined}
      className={`map-sheet ${kind} ${collapsed ? "collapsed" : ""}`}
      style={{ transform, opacity, clipPath }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose?.();
      }}
    >
      <button
        className="sheet-handle"
        aria-label={
          collapsed ? t("Déplier le panneau") : t("Réduire le panneau")
        }
        aria-expanded={!collapsed}
        onPointerDown={(e) => {
          if (drag.current || !e.isPrimary || e.button !== 0) return;
          animation.current?.stop();
          dragged.current = false;
          drag.current = { id: e.pointerId, start: e.clientY, offset: y.get() };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const delta = e.clientY - d.start;
          if (Math.abs(delta) > 4) dragged.current = true;
          if (!dragged.current || reduceMotion()) return;
          const distance = d.offset + delta,
            limit = rest();
          y.set(
            distance < 0
              ? distance * 0.15
              : distance > limit
                ? limit + (distance - limit) * 0.15
                : distance,
          );
        }}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onClick={() => {
          if (!dragged.current) settle(!collapsedRef.current);
          dragged.current = false;
        }}
      >
        <span aria-hidden="true" />
        {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <button
        ref={summary}
        className="collapsed-title"
        aria-hidden={!collapsed}
        tabIndex={collapsed ? 0 : -1}
        onClick={() => settle(false)}
      >
        {label}
        <ChevronUp size={18} />
      </button>
      <div className="sheet-body" inert={collapsed || !present}>
        {children}
      </div>
    </motion.section>
  );
}

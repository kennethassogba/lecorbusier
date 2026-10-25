import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** A non-modal map panel. Only its handle owns dragging; map gestures remain native. */
export function Sheet({
  children,
  label,
  kind = "",
  onClose,
}: {
  children: ReactNode;
  label: string;
  kind?: string;
  onClose?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const start = useRef<number | null>(null);
  const dragged = useRef(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    setCollapsed(false);
    panel.current?.focus({ preventScroll: true });
  }, [label]);
  return (
    <section
      ref={panel}
      tabIndex={-1}
      aria-label={label}
      className={`map-sheet ${kind} ${collapsed ? "collapsed" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose?.();
      }}
    >
      <button
        className="sheet-handle"
        aria-label={collapsed ? "Déplier le panneau" : "Réduire le panneau"}
        aria-expanded={!collapsed}
        onPointerDown={(e) => {
          start.current = e.clientY;
          dragged.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (
            start.current !== null &&
            Math.abs(e.clientY - start.current) > 30
          ) {
            dragged.current = true;
            setCollapsed(e.clientY > start.current);
          }
          start.current = null;
        }}
        onClick={() => {
          if (!dragged.current) setCollapsed((c) => !c);
          dragged.current = false;
        }}
      >
        <span aria-hidden="true" />
        {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {collapsed ? (
        <button className="collapsed-title" onClick={() => setCollapsed(false)}>
          {label}
          <ChevronUp size={18} />
        </button>
      ) : (
        children
      )}
    </section>
  );
}

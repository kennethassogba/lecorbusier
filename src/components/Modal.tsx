import { t } from "../i18n";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { reduceMotion } from "../motion";
export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const entry = useRef<Animation | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  function dismiss() {
    const el = ref.current;
    if (!el || closing.current) return;
    closing.current = true;
    el.dataset.closing = "true";
    const current = getComputedStyle(el);
    const start = { opacity: current.opacity, transform: current.transform };
    entry.current?.cancel();
    const exit = el.animate(
      [
        start,
        {
          opacity: 0,
          transform: reduceMotion()
            ? start.transform
            : "translate3d(0, 20px, 0) scale(0.98)",
        },
      ],
      {
        duration: reduceMotion() ? 100 : 170,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
        fill: "forwards",
      },
    );
    entry.current = exit;
    void exit.finished.then(() => closeRef.current()).catch(() => {});
  }
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const token = crypto.randomUUID();
    if (history.state?.modal)
      history.replaceState({ ...history.state, modal: token }, "");
    else history.pushState({ ...history.state, modal: token }, "");
    const back = () => {
      if (history.state?.modal !== token) dismiss();
    };
    window.addEventListener("popstate", back);
    const el = ref.current;
    el?.showModal();
    if (el)
      entry.current = el.animate(
        reduceMotion()
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: "translate3d(0, 24px, 0) scale(0.98)" },
              { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
            ],
        {
          duration: reduceMotion() ? 100 : 240,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        },
      );
    return () => {
      entry.current?.cancel();
      window.removeEventListener("popstate", back);
      ref.current?.close();
      queueMicrotask(() => {
        if (history.state?.modal === token) history.back();
      });
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <header className="sheet-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={t("Fermer")}
          onClick={dismiss}
        >
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

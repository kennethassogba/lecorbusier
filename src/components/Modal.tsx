import { t } from "../i18n";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
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
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const token = crypto.randomUUID();
    if (history.state?.modal)
      history.replaceState({ ...history.state, modal: token }, "");
    else history.pushState({ ...history.state, modal: token }, "");
    const back = () => {
      if (history.state?.modal !== token) onClose();
    };
    window.addEventListener("popstate", back);
    ref.current?.showModal();
    return () => {
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
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="sheet-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={t("Fermer")}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

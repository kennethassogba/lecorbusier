import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
document.addEventListener(
  "keydown",
  () => {
    document.documentElement.dataset.input = "keyboard";
  },
  { capture: true },
);
document.addEventListener(
  "pointerdown",
  () => {
    document.documentElement.dataset.input = "pointer";
  },
  { capture: true },
);
createRoot(document.getElementById("root")!).render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const controlled = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controlled && !reloading) {
      reloading = true;
      location.reload();
    }
  });
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/corbs/sw.js", { scope: "/corbs/" })
      .catch(() => {});
  });
}

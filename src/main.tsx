import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
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
      .register("/lecorbusier/sw.js", { scope: "/lecorbusier/" })
      .catch(() => {});
  });
}

import { useSyncExternalStore } from "react";
import english from "./translations.json";
export type Language = "fr" | "en";
let language: Language = navigator.language.toLowerCase().startsWith("fr")
  ? "fr"
  : "en";
try {
  const saved = localStorage.getItem("lc-language");
  if (saved === "fr" || saved === "en") language = saved;
} catch {}
const listeners = new Set<() => void>();
function updateDocument() {
  document.documentElement.lang = language;
  document
    .querySelector<HTMLLinkElement>('link[rel="manifest"]')
    ?.setAttribute(
      "href",
      `${import.meta.env.BASE_URL}manifest${language === "en" ? "-en" : ""}.webmanifest`,
    );
}
updateDocument();
export const getLanguage = () => language;
export function setLanguage(value: Language) {
  language = value;
  updateDocument();
  try {
    localStorage.setItem("lc-language", value);
  } catch {}
  listeners.forEach((fn) => fn());
}
export function useLanguage() {
  return useSyncExternalStore((callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, getLanguage);
}
export function t(key: string, params?: Record<string, string | number>) {
  const value =
    language === "en" ? (english as Record<string, string>)[key] || key : key;
  return params
    ? value.replace(/\{(\w+)\}/g, (match, name) =>
        String(params[name] ?? match),
      )
    : value;
}

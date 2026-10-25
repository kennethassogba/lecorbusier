import { t } from "./i18n";
export const BASE = "/corbs";
let sessionMigration: Promise<void> | undefined;
function migrateSession() {
  if (readLocal("lc-corbs-session-v1", false)) return Promise.resolve();
  return sessionMigration ??= fetch("/lecorbusier/api/migrate-session", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).then((response) => {
    if (!response.ok) throw new Error(t("Le serveur ne répond pas. Réessaie."));
    saveLocal("lc-corbs-session-v1", true);
  }).catch((error) => {
    sessionMigration = undefined;
    throw error;
  });
}
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  await migrateSession();
  signal?.throwIfAborted();
  const response = await fetch(BASE + "/api" + path, {
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    signal,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response
    .json()
    .catch(() => ({ error: t("Le serveur ne répond pas. Réessaie.") }));
  if (!response.ok)
    throw new Error(data.error || t("Une erreur est survenue. Réessaie."));
  return data;
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null", (key, value) =>
      key === "image" && typeof value === "string"
        ? value.replace(/^\/lecorbusier\//, BASE + "/")
        : value,
    ) ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Browsing remains available without local storage. */
  }
}

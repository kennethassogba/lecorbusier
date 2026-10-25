export const BASE = "/lecorbusier";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(BASE + "/api" + path, {
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Le serveur ne répond pas. Réessaie." }));
  if (!response.ok)
    throw new Error(data.error || "Une erreur est survenue. Réessaie.");
  return data;
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
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

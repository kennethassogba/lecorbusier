const CACHE = "lecorbusier-v3-__BUILD__";
const MAP_CACHE = "lecorbusier-map-v1";
const PUBLIC_CACHE = "lecorbusier-public-v1";
const BASE = "/lecorbusier/";
const PRECACHE = [];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          BASE,
          BASE + "manifest.webmanifest",
          BASE + "manifest-en.webmanifest",
          BASE + "icon-192.png",
          BASE + "paris-map.json",
          BASE + "places/gare-de-lyon.jpg",
          ...PRECACHE,
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (k) =>
                  k.startsWith("lecorbusier-") &&
                  k !== CACHE &&
                  k !== MAP_CACHE &&
                  k !== PUBLIC_CACHE,
              )
              .map((k) => caches.delete(k)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
let mapWrites = Promise.resolve();
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  // Only tiles already viewed. No bulk download; bounded below 40 MiB.
  if (url.origin === "https://tiles.openfreemap.org") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type !== "opaque") {
            const copy = response.clone();
            const write = async () => {
              const body = await copy.blob();
              if (body.size > 512 * 1024) return;
              const cache = await caches.open(MAP_CACHE);
              const headers = new Headers(copy.headers);
              headers.delete("Content-Encoding");
              headers.delete("Content-Length");
              await cache.put(
                event.request,
                new Response(body, { status: 200, headers }),
              );
              const keys = await cache.keys();
              const isMetadata = (key) =>
                /\/(planet|fonts|sprites)(\/|$)/.test(
                  new URL(key.url).pathname,
                );
              const candidates = [
                ...keys.filter((k) => !isMetadata(k)),
                ...keys.filter(isMetadata),
              ];
              for (const key of candidates.slice(
                0,
                Math.max(0, keys.length - 80),
              ))
                await cache.delete(key);
            };
            mapWrites = mapWrites.then(write).catch(() => {});
            event.waitUntil(mapWrites);
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((r) => r || Response.error()),
        ),
    );
    return;
  }
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith(BASE + "media/") ||
      url.pathname.startsWith(BASE + "api/reference/"))
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            response.ok &&
            response.headers.get("Cache-Control")?.startsWith("public")
          ) {
            const copy = response.clone();
            event.waitUntil(
              (async () => {
                const blob = await copy.blob();
                if (blob.size > 2 * 1024 * 1024) return;
                const cache = await caches.open(PUBLIC_CACHE);
                const headers = new Headers(copy.headers);
                headers.delete("Content-Encoding");
                headers.delete("Content-Length");
                await cache.put(event.request, new Response(blob, { headers }));
                const keys = await cache.keys();
                for (const key of keys.slice(0, Math.max(0, keys.length - 10)))
                  await cache.delete(key);
              })().catch(() => {}),
            );
          }
          return response;
        })
        .catch(() =>
          caches
            .open(PUBLIC_CACHE)
            .then((cache) => cache.match(event.request))
            .then((r) => r || Response.error()),
        ),
    );
    return;
  }
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE) ||
    url.pathname.includes("/api/") ||
    url.pathname.includes("/media/")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches
          .match(BASE)
          .then((r) => r || new Response("Connexion requise", { status: 503 })),
      ),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE).then((c) => c.put(event.request, copy)),
            );
          }
          return response;
        }),
    ),
  );
});

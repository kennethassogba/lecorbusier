const CACHE = "lecorbusier-v2";
const BASE = "/lecorbusier/";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll([
        BASE,
        BASE + "manifest.webmanifest",
        BASE + "icon-192.png",
        BASE + "places/gare-de-lyon.jpg",
      ]);
      const shell = await cache.match(BASE);
      const html = await shell.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g)]
        .map((match) => match[1])
        .filter((path) => path.startsWith(BASE));
      await cache.addAll(assets);
    }),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("lecorbusier-") && k !== CACHE)
              .map((k) => caches.delete(k)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE) ||
    url.pathname.includes("/api/") ||
    url.pathname.includes("/media/")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok && url.pathname === BASE) {
            const cache = await caches.open(CACHE);
            await cache.put(BASE, response.clone());
          }
          return response;
        })
        .catch(() =>
          caches.match(BASE).then(
            (r) =>
              r ||
              new Response("Ouvre l’app une fois avec une connexion.", {
                status: 503,
              }),
          ),
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
            const clone = response.clone();
            event.waitUntil(
              caches
                .open(CACHE)
                .then((cache) => cache.put(event.request, clone)),
            );
          }
          return response;
        }),
    ),
  );
});

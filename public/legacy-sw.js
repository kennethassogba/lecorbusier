// Retire the old app shell so an installed shortcut follows the new address.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window" });
    await Promise.all(clients.map(async (client) => {
      const url = new URL(client.url);
      if (url.origin === self.location.origin && url.pathname.startsWith("/lecorbusier/")) {
        url.pathname = url.pathname.replace(/^\/lecorbusier\//, "/corbs/");
        await client.navigate(url.href);
      }
    }));
    await self.registration.unregister();
  })());
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/lecorbusier/")) return;
  url.pathname = url.pathname.replace(/^\/lecorbusier\//, "/corbs/");
  event.respondWith(Response.redirect(url.href, 308));
});

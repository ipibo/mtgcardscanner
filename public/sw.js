const CACHE_NAME = "mtg-v1";
const IMAGE_CACHE = "scryfall-images-v1";

// Static assets to precache on install
const STATIC_ASSETS = ["/", "/collection", "/scan", "/decklist", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache Scryfall card images (CacheFirst, 30 days)
  if (url.hostname === "cards.scryfall.io") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // API routes — network only (always fresh data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation — network first, fall back to cache, then offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
        .catch(() => caches.match("/offline") ?? new Response("Offline"))
    );
    return;
  }

  // Other static assets — cache first
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request))
  );
});

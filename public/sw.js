/// <reference lib="webworker" />
// Hand-written service worker (no Workbox). Versioned caches; bump CACHE_VERSION
// whenever the caching strategy or precache list changes so old caches are purged.
const CACHE_VERSION = "v1";
const PRECACHE = `precache-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;

// App-shell URLs to precache so the app boots offline. Keep this minimal:
// the offline fallback page plus the icons. Hashed Next.js assets are cached
// at runtime instead (their URLs change on every build).
const PRECACHE_URLS = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  // Note: we deliberately do NOT call skipWaiting() here. A new worker waits
  // until the user accepts the "new version available" prompt (which posts
  // SKIP_WAITING), so an update never disrupts an in-progress edit.
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Allow the page to tell a waiting worker to activate immediately.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GETs. Never intercept GitHub API, auth, or
  // Server Action POSTs — those must hit the network and fail loudly offline.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Don't cache Next.js data/RSC or API/auth routes.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.searchParams.has("_rsc")
  ) {
    return;
  }

  // Navigations: network-first with an offline fallback. Keeps notes fresh
  // online; serves a cached shell when the connection is gone.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/offline"));
        }),
    );
    return;
  }

  // Static assets: cache-first (they're content-hashed, so safe to keep).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});

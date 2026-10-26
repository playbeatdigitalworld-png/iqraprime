/* IQRAPRIME Service Worker
 * - App shell precache + offline fallback
 * - Static assets: cache-first
 * - Artwork (posters/backdrops/icons): stale-while-revalidate
 * - Navigations: network-first with cache + /offline fallback
 * - NEVER caches: API calls, HLS streams (.m3u8/.ts/.mp4), query-string media
 */
const VERSION = "iqraprime-v2.0.0";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const ART_CACHE = `${VERSION}-art`;

const SHELL_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/favicon-32.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const isArt = (url) =>
  url.pathname.startsWith("/posters/") ||
  url.pathname.startsWith("/backdrops/") ||
  url.pathname.startsWith("/art/") ||
  url.pathname.startsWith("/icons/");

const isStatic = (url) => url.pathname.startsWith("/_next/static/");

const isMedia = (url) =>
  /\.(m3u8|ts|mp4|m4s|mpd)(\?|$)/.test(url.pathname + url.search) ||
  url.search.includes("xtream");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // skip cross-origin (streams etc.)
  if (isMedia(url)) return; // never cache media streams

  // Navigations: network-first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached =
            (await caches.match(request)) ||
            (await caches.match(url.pathname)) ||
            (await caches.match("/"));
          return cached || caches.match("/offline").then((r) => r || Response.error());
        }
      })()
    );
    return;
  }

  // Artwork: stale-while-revalidate
  if (isArt(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ART_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      })()
    );
    return;
  }

  // Static assets: cache-first
  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, res.clone()).catch(() => {});
        }
        return res;
      })()
    );
    return;
  }

  // Everything else: network with runtime cache fallback (webmanifest etc.)
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        if (res.ok && request.url.startsWith(self.location.origin)) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return Response.error();
      }
    })()
  );
});

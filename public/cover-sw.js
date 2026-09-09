// Cover-art cache service worker.
//
// Cover CDNs rate-limit aggressively (HTTP 429), so every cover is cached and,
// crucially, de-duplicated: the mini player, fullscreen cover, blurred
// background and the WebGL layer can all request the same URL in the same
// frame and only one network fetch is made.
//
// Cache entries are keyed by URL string with `ignoreVary`, so a cover is
// stored once regardless of request mode or `Origin`/`Vary` differences. The
// previous version keyed by full Request, which stored the CORS and no-CORS
// variants of one cover separately and never coalesced them.

const CACHE_NAME = "liner-covers-v2";

const COVER_HOSTS = [
  "yt3.googleusercontent.com",
  "lh3.googleusercontent.com",
  "covers.tryliner.fun",
  "i1.sndcdn.com",
  "i.pinimg.com",
  "images.genius.com",
  "yandex-images.clstorage.net",
];

// URL -> in-flight network Response promise. Coalesces concurrent misses for
// the same cover into a single upstream request.
const inFlight = new Map();

function isCoverRequest(url) {
  try {
    const { hostname } = new URL(url);
    return COVER_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function fetchAndCache(request, cache, cacheKey) {
  let pending = inFlight.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(request);
      // A 429 (or any non-2xx) is never cached, so a later attempt can succeed
      // once the CDN cools down. Opaque responses (status 0) are skipped too:
      // now that every layer requests covers with CORS they shouldn't occur,
      // and caching one would poison the entry for pixel-reading consumers.
      if (response.ok && response.type !== "opaque") {
        await cache.put(cacheKey, response.clone());
      }
      return response;
    })().finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, pending);
  }
  // Each consumer needs its own body; the shared promise's response is cloned.
  return (await pending).clone();
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !isCoverRequest(event.request.url)) {
    return;
  }

  const cacheKey = event.request.url;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(cacheKey, { ignoreVary: true });
      if (cached) return cached;

      try {
        return await fetchAndCache(event.request, cache, cacheKey);
      } catch (err) {
        const stale = await cache.match(cacheKey, { ignoreVary: true });
        if (stale) return stale;
        throw err;
      }
    }),
  );
});

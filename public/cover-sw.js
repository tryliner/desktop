const CACHE_NAME = "liner-covers-v2";
const MAX_ENTRIES = 600;

const COVER_HOSTS = [
  "yt3.googleusercontent.com",
  "lh3.googleusercontent.com",
  "covers.tryliner.fun",
  "i1.sndcdn.com",
  "i.pinimg.com",
  "images.genius.com",
  "yandex-images.clstorage.net",
];

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

async function enforceQuota(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_ENTRIES) {
      const toDelete = keys.slice(0, keys.length - MAX_ENTRIES);
      await Promise.all(toDelete.map((req) => cache.delete(req)));
    }
  } catch {
  }
}

async function fetchAndCache(request, cache, cacheKey) {
  let pending = inFlight.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(request);
      if (response.ok && response.type !== "opaque") {
        await cache.put(cacheKey, response.clone());
        void enforceQuota(cache);
      }
      return response;
    })().finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, pending);
  }
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

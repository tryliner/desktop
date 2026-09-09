// client-side cover proxy url minting and signing
// derives covers.tryliner.fun fallback url directly from track raw cover url
// hmac token is computed in-memory via rust wasm module

const COVER_PROXY_BASE = "https://covers.tryliner.fun";
const COVER_PROXY_SIZE = 512;

// Must mirror ALLOWED_HOSTS in apps/workers/covers: a token for any other host
// is rejected there, so minting one would only produce a broken fallback.
const COVER_PROXY_HOSTS: ReadonlySet<string> = new Set([
  "i.ytimg.com",
  "yt3.ggpht.com",
  "lh3.googleusercontent.com",
  "yt3.googleusercontent.com",
]);

// Raw cover URL -> resolved fallback URL (or undefined when not proxyable).
const resolved = new Map<string, string | undefined>();
const inflight = new Map<string, Promise<string | undefined>>();

function isElectron(): boolean {
  return typeof window !== "undefined" && typeof window.linerElectron?.signCoverUrl === "function";
}

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Drop the trailing size options (`=w…-h…` / `=s…`) so one cover yields one
 * stable token regardless of the size captured — the Worker reapplies the
 * requested size. Mirrors the Worker's `applySize`: `i.ytimg.com` encodes size
 * in the path filename (no options segment), so it passes through untouched.
 */
function sizeAgnosticUrl(rawUrl: string, host: string): string {
  if (host === "i.ytimg.com") return rawUrl;
  const eq = rawUrl.indexOf("=");
  return eq === -1 ? rawUrl : rawUrl.slice(0, eq);
}

export async function signCoverUrl(payload: string): Promise<string> {
  // Web build / a dev browser tab has no native layer; leave the token unsigned.
  if (!isElectron()) return payload;
  try {
    const signature = await window.linerElectron!.signCoverUrl(payload);
    return signature ? `${payload}.${signature}` : payload;
  } catch {
    // IPC unavailable/failed: fall back to unsigned so a Worker with
    // enforcement off still serves the cover.
    return payload;
  }
}

export function getCoverProxyUrl(token: string, size = COVER_PROXY_SIZE): string {
  return `${COVER_PROXY_BASE}/c/${token}?size=${size}`;
}

async function computeFallback(coverUrl: string): Promise<string | undefined> {
  let parsed: URL;
  try {
    parsed = new URL(coverUrl);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" || !COVER_PROXY_HOSTS.has(parsed.hostname)) {
    return undefined;
  }
  const payload = base64UrlEncode(
    JSON.stringify({ u: sizeAgnosticUrl(coverUrl, parsed.hostname), s: COVER_PROXY_SIZE }),
  );
  const token = await signCoverUrl(payload);
  return getCoverProxyUrl(token, COVER_PROXY_SIZE);
}

/**
 * Resolve the proxy fallback URL for a raw cover URL, or `undefined` when the
 * host is not one the Worker will fetch (or there's no URL). Memoized per URL
 * and safe to call repeatedly/eagerly — the first call per URL does the mint +
 * IPC sign, later calls reuse the cached result.
 */
export function prepareCoverFallback(coverUrl: string | undefined): Promise<string | undefined> {
  if (!coverUrl) return Promise.resolve(undefined);

  if (resolved.has(coverUrl)) return Promise.resolve(resolved.get(coverUrl));

  const existing = inflight.get(coverUrl);
  if (existing) return existing;

  const promise = computeFallback(coverUrl).then((result) => {
    resolved.set(coverUrl, result);
    inflight.delete(coverUrl);
    return result;
  });
  inflight.set(coverUrl, promise);
  return promise;
}

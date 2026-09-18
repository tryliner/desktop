// primary api and polish edge relay fallback
export const DEFAULT_PRIMARY_API = "https://api.tryliner.fun";
export const FALLBACK_EDGE_API = "http://edge.tryliner.fun:10518";

const STORAGE_KEY = "liner_active_api_base";
const HEALTH_TIMEOUT_MS = 2000;

function isExplicitCustomOverride(url?: string): boolean {
  if (!url) return false;
  const clean = url.replace(/\/+$/, "");
  return clean.length > 0 && clean !== DEFAULT_PRIMARY_API && clean !== FALLBACK_EDGE_API;
}

function loadStoredBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (isExplicitCustomOverride(envUrl)) {
    return envUrl!.replace(/\/+$/, "");
  }
  if (typeof window === "undefined") return DEFAULT_PRIMARY_API;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === DEFAULT_PRIMARY_API || saved === FALLBACK_EDGE_API) {
      return saved;
    }
  } catch {}
  return DEFAULT_PRIMARY_API;
}

function persistBaseUrl(url: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, url);
  } catch {}
}

let currentBaseUrl = loadStoredBaseUrl();
let probePromise: Promise<string> | null = null;

export function getApiBaseUrl(): string {
  return currentBaseUrl;
}

export function setApiBaseUrl(url: string): void {
  currentBaseUrl = url.replace(/\/+$/, "");
  persistBaseUrl(currentBaseUrl);
}

// fast failover to edge relay if cloudflare is throttled by tspu
export function switchToFallbackEdge(): boolean {
  if (currentBaseUrl === DEFAULT_PRIMARY_API) {
    currentBaseUrl = FALLBACK_EDGE_API;
    persistBaseUrl(currentBaseUrl);
    return true;
  }
  return false;
}

// eagerly probes primary health on launch and switches to edge if cloudflare is unreachable
export function initApiEndpointProbe(timeoutMs = HEALTH_TIMEOUT_MS): Promise<string> {
  if (probePromise) return probePromise;
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (isExplicitCustomOverride(envUrl)) {
    return Promise.resolve(currentBaseUrl);
  }

  probePromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${DEFAULT_PRIMARY_API}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        currentBaseUrl = DEFAULT_PRIMARY_API;
        persistBaseUrl(DEFAULT_PRIMARY_API);
        return DEFAULT_PRIMARY_API;
      }
    } catch {}

    clearTimeout(timer);
    currentBaseUrl = FALLBACK_EDGE_API;
    persistBaseUrl(FALLBACK_EDGE_API);
    return FALLBACK_EDGE_API;
  })();

  return probePromise;
}

// reset probe promise (useful for tests and manual retry)
export function resetEndpointProbe(): void {
  probePromise = null;
}

// trigger health probe eagerly on startup in production/dev runtime
if (typeof window !== "undefined" && !import.meta.env.TEST) {
  initApiEndpointProbe().catch(() => {});
}

// api base url: the https primary api, unless VITE_API_URL or setApiBaseUrl points to another https (or loopback) server
export const DEFAULT_PRIMARY_API = "https://api.tryliner.fun";

const STORAGE_KEY = "liner_active_api_base";
const HEALTH_TIMEOUT_MS = 6000;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// https only: plain http would carry tokens and passwords unencrypted, except to a local dev server
function isSecureBaseUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" || (protocol === "http:" && LOOPBACK_HOSTS.has(hostname));
  } catch {
    return false;
  }
}

function isExplicitCustomOverride(url?: string): boolean {
  if (!url) return false;
  const clean = url.replace(/\/+$/, "");
  return clean.length > 0 && clean !== DEFAULT_PRIMARY_API && isSecureBaseUrl(clean);
}

function loadStoredBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (isExplicitCustomOverride(envUrl)) {
    return envUrl!.replace(/\/+$/, "");
  }
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

// returns false and keeps the current base url when the url is not https (or http to loopback)
export function setApiBaseUrl(url: string): boolean {
  const clean = url.replace(/\/+$/, "");
  if (!isSecureBaseUrl(clean)) {
    console.warn("[API] refusing insecure api base url:", clean);
    return false;
  }
  currentBaseUrl = clean;
  persistBaseUrl(currentBaseUrl);
  return true;
}

export function switchToPrimaryApi(): void {
  currentBaseUrl = DEFAULT_PRIMARY_API;
  persistBaseUrl(DEFAULT_PRIMARY_API);
}

// probes the primary api health on launch; the client stays on the https primary api whatever the result
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
    return DEFAULT_PRIMARY_API;
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

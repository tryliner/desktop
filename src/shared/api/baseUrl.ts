// primary api and polish edge relay fallback
export const DEFAULT_PRIMARY_API = "https://api.tryliner.fun";
export const FALLBACK_EDGE_API = "http://edge.tryliner.fun:10518";

let currentBaseUrl =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  DEFAULT_PRIMARY_API;

export function getApiBaseUrl(): string {
  return currentBaseUrl;
}

export function setApiBaseUrl(url: string): void {
  currentBaseUrl = url.replace(/\/+$/, "");
}

// fast failover to edge relay if cloudflare is throttled by tspu
export function switchToFallbackEdge(): boolean {
  if (currentBaseUrl === DEFAULT_PRIMARY_API) {
    currentBaseUrl = FALLBACK_EDGE_API;
    return true;
  }
  return false;
}

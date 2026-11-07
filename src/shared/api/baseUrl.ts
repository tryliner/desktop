export const DEFAULT_PRIMARY_API = "https://api.tryliner.fun";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isSecureBaseUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" ||
      (protocol === "http:" && LOOPBACK_HOSTS.has(hostname))
    );
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl(envUrl: string | undefined): string {
  const clean = envUrl?.trim().replace(/\/+$/, "");
  return clean && isSecureBaseUrl(clean) ? clean : DEFAULT_PRIMARY_API;
}

const baseUrl = resolveApiBaseUrl(
  import.meta.env.VITE_API_URL as string | undefined,
);

export function getApiBaseUrl(): string {
  // When testing in browser dev mode (e.g. localhost:5173 without Electron or Capacitor native),
  // route through Vite's local proxy to avoid browser CORS restrictions
  if (
    typeof window !== "undefined" &&
    !window.linerElectron &&
    !(window as any).Capacitor?.isNativePlatform?.() &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") &&
    window.location.port === "5173"
  ) {
    return "";
  }
  return baseUrl;
}

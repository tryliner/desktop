import type { AuthTokens, AuthUser } from "../contracts";
import { signApiRequest } from "./requestSigner";

export type { AuthTokens, AuthUser };

const STORAGE_KEY = "liner_auth_session";
const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://api.tryliner.fun";

let session: AuthTokens | null = null;
let refreshPromise: Promise<AuthTokens | null> | null = null;

function load(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as AuthTokens) : null;
  } catch {
    return null;
  }
}

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:changed"));
  }
}

export function getAuthSession(): AuthTokens | null {
  if (!session) session = load();
  return session;
}

export function setAuthSession(next: AuthTokens | null): void {
  session = next;
  if (typeof window !== "undefined") {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }
  emit();
}

export function getAccessToken(): string | null {
  return getAuthSession()?.accessToken ?? null;
}

/**
 * Returns the timestamp in milliseconds when the access token expires,
 * or null if unknown.
 */
export function getSessionExpiryMs(s: AuthTokens | null): number | null {
  if (!s) return null;
  if (s.accessTokenExpiresAt) {
    const t =
      typeof s.accessTokenExpiresAt === "number"
        ? s.accessTokenExpiresAt
        : new Date(s.accessTokenExpiresAt).getTime();
    if (!isNaN(t) && t > 0) {
      // If t is in seconds (e.g. 10-digit unix timestamp), convert to ms
      return t < 10_000_000_000 ? t * 1000 : t;
    }
  }
  if (s.expiresAt) {
    const t =
      typeof s.expiresAt === "number"
        ? s.expiresAt < 10_000_000_000
          ? s.expiresAt * 1000
          : s.expiresAt
        : new Date(s.expiresAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return null;
}

/**
 * Returns a valid access token. If a refresh is already in progress, awaits it.
 * If the current access token is about to expire (< 120s) or already expired,
 * proactively triggers a single atomic session refresh and returns the fresh access token.
 */
export async function getValidAccessToken(): Promise<string | null> {
  // If a refresh is ALREADY in flight, await it to prevent concurrent requests from using stale tokens
  if (refreshPromise) {
    const refreshed = await refreshPromise;
    return refreshed?.accessToken ?? getAuthSession()?.accessToken ?? null;
  }

  const current = getAuthSession();
  if (!current?.accessToken) return null;

  const expiresAtMs = getSessionExpiryMs(current);
  // If token expiry is known and expires in less than 2 minutes (120s), proactively refresh
  if (expiresAtMs !== null && expiresAtMs - Date.now() < 120_000) {
    const refreshed = await refreshAuthSession();
    if (refreshed?.accessToken) return refreshed.accessToken;
    // If refresh failed (e.g. transient network glitch), but token is still within validity window,
    // fallback to current token rather than failing immediately
    if (expiresAtMs > Date.now()) return current.accessToken;
    return null;
  }

  return current.accessToken;
}

/**
 * Performs a mutex-locked atomic refresh of the auth session.
 * Guaranteed to only initiate one in-flight refresh request across all parallel callers.
 */
export function refreshAuthSession(): Promise<AuthTokens | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const current = getAuthSession();
  if (!current?.refreshToken) {
    return Promise.resolve(null);
  }

  // Synchronously assign the promise to immediately lock out any concurrent callers
  refreshPromise = (async () => {
    try {
      const body = JSON.stringify({ refreshToken: current.refreshToken });
      const signedHeaders = await signApiRequest("POST", "/v1/auth/refresh", body);

      const response = await fetch(`${API_BASE}/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...signedHeaders,
        },
        body,
      });

      if (!response.ok) {
        // If the server explicitly rejected the refresh token (401 / 403 / 400),
        // only clear the stored session if it hasn't already been rotated by another process
        if (response.status === 401 || response.status === 403 || response.status === 400) {
          const latest = getAuthSession();
          if (latest?.refreshToken === current.refreshToken) {
            setAuthSession(null);
          }
        }
        return null;
      }

      const next = (await response.json()) as AuthTokens;
      // Preserve existing user info and metadata
      const merged: AuthTokens = {
        ...current,
        ...next,
        user: next.user || current.user,
      };

      setAuthSession(merged);
      return merged;
    } catch (err) {
      console.error("[Auth] refreshAuthSession request failed:", err);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function clearAuthSession(): Promise<void> {
  let current = getAuthSession();
  const expiryMs = getSessionExpiryMs(current);
  if (current && expiryMs !== null && expiryMs <= Date.now()) {
    current = (await refreshAuthSession()) ?? current;
  }
  setAuthSession(null);
  if (!current?.refreshToken) return;
  const body = JSON.stringify({ refreshToken: current.refreshToken });
  const signedHeaders = await signApiRequest("POST", "/v1/auth/logout", body);
  await fetch(`${API_BASE}/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${current.accessToken}`,
      ...signedHeaders,
    },
    body,
  }).catch(() => undefined);
}

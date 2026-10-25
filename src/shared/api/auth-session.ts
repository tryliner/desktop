import type { AuthTokens, AuthUser } from "../contracts";
import { signApiRequest, syncServerTime } from "./requestSigner";

export type { AuthTokens, AuthUser };

import { getApiBaseUrl } from "./baseUrl";
 
const STORAGE_KEY = "liner_auth_session";
const DEAD_REFRESH_CODES = new Set(["INVALID_REFRESH_TOKEN", "REFRESH_SESSION_EXPIRED"]);
const REFRESH_ATTEMPTS = 2;

type MainAuthBridge = NonNullable<NonNullable<Window["linerElectron"]>["authSession"]>;

let session: AuthTokens | null = null;
let loadedFromMain = false;
let unsubscribeMain: (() => void) | null = null;
let refreshPromise: Promise<AuthTokens | null> | null = null;

function mainBridge(): MainAuthBridge | null {
  if (typeof window === "undefined") return null;
  return window.linerElectron?.authSession ?? null;
}

function readLocal(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as AuthTokens) : null;
  } catch {
    return null;
  }
}

function dropLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:changed"));
  }
}

function adopt(next: AuthTokens | null): void {
  const changed =
    session?.refreshToken !== next?.refreshToken || session?.accessToken !== next?.accessToken;
  session = next;
  if (changed) emit();
}

function followMain(bridge: MainAuthBridge): void {
  if (!unsubscribeMain) {
    unsubscribeMain = bridge.onChange((next) => adopt(next as AuthTokens | null));
  }
}

function loadFromMain(bridge: MainAuthBridge): AuthTokens | null {
  followMain(bridge);
  let stored: AuthTokens | null = null;
  try {
    stored = bridge.get() as AuthTokens | null;
  } catch (err) {
    console.error("[Auth] reading the stored session failed:", err);
  }
  const legacy = readLocal();
  if (legacy) {
    dropLocal();
    if (!stored && legacy.refreshToken) {
      void bridge.set(legacy);
      stored = legacy;
    }
  }
  loadedFromMain = true;
  return stored;
}

export function getAuthSession(): AuthTokens | null {
  if (session) return session;
  const bridge = mainBridge();
  if (bridge) {
    if (!loadedFromMain) session = loadFromMain(bridge);
    return session;
  }
  session = readLocal();
  return session;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || mainBridge()) return;
    session = readLocal();
    emit();
  });
}

export function setAuthSession(next: AuthTokens | null): void {
  session = next;
  const bridge = mainBridge();
  if (bridge) {
    followMain(bridge);
    loadedFromMain = true;
    dropLocal();
    void bridge.set(next).catch((err) => console.error("[Auth] saving the session failed:", err));
  } else if (typeof window !== "undefined") {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else dropLocal();
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

export function refreshAuthSession(): Promise<AuthTokens | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const current = getAuthSession();
  if (!current?.refreshToken) {
    return Promise.resolve(null);
  }

  refreshPromise = (async () => {
    try {
      const bridge = mainBridge();
      return bridge ? await refreshInMain(bridge, current) : await refreshHere(current);
    } catch (err) {
      console.error("[Auth] refreshAuthSession request failed:", err);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function refreshInMain(bridge: MainAuthBridge, current: AuthTokens): Promise<AuthTokens | null> {
  const result = await bridge.refresh({
    apiBaseUrl: getApiBaseUrl(),
    refreshToken: current.refreshToken,
  });
  adopt(result.session as AuthTokens | null);
  if (result.outcome === "signed_out") {
    console.warn(`[Auth] signed out: refresh token rejected (${result.reason ?? "unknown"})`);
  } else if (result.outcome === "transient") {
    console.warn(`[Auth] refresh failed (${result.reason ?? "unknown"}), keeping the session`);
  }
  return result.outcome === "refreshed" || result.outcome === "rotated"
    ? (result.session as AuthTokens | null)
    : null;
}

async function refreshHere(current: AuthTokens): Promise<AuthTokens | null> {
  let reason = "";
  for (let attempt = 0; attempt < REFRESH_ATTEMPTS; attempt++) {
    const response = await postRefresh(current.refreshToken);

    if (response.ok) {
      const next = (await response.json()) as AuthTokens;
      const merged: AuthTokens = {
        ...current,
        ...next,
        user: next.user || current.user,
      };
      setAuthSession(merged);
      return merged;
    }

    if (response.status !== 401 && response.status !== 403) {
      console.warn(`[Auth] refresh failed with ${response.status}, keeping the session`);
      return null;
    }

    const rotated = rotatedElsewhere(current.refreshToken);
    if (rotated) return rotated;

    const code = await rejectionCode(response);
    reason = [String(response.status), code].filter(Boolean).join(" ");
    if (DEAD_REFRESH_CODES.has(code)) {
      console.warn(`[Auth] signed out: refresh token rejected (${reason})`);
      if (getAuthSession()?.refreshToken === current.refreshToken) {
        setAuthSession(null);
      }
      return null;
    }
  }
  console.warn(`[Auth] refresh rejected (${reason}), keeping the session`);
  return null;
}

async function postRefresh(refreshToken: string): Promise<Response> {
  const body = JSON.stringify({ refreshToken });
  const signedHeaders = await signApiRequest("POST", "/v1/auth/refresh", body);
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...signedHeaders,
    },
    body,
  });
  const dateHeader = response.headers?.get?.("date");
  if (dateHeader) {
    syncServerTime(dateHeader);
  }
  return response;
}

function rotatedElsewhere(usedRefreshToken: string): AuthTokens | null {
  const stored = readLocal();
  if (stored?.refreshToken && stored.refreshToken !== usedRefreshToken) {
    session = stored;
    emit();
    return stored;
  }
  return null;
}

async function rejectionCode(response: Response): Promise<string> {
  try {
    const data = (await response.clone?.().json?.()) as Record<string, unknown> | undefined;
    return typeof data?.code === "string" ? data.code : "";
  } catch {
    return "";
  }
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
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${current.accessToken}`,
      ...signedHeaders,
    },
    body,
  }).catch(() => undefined);
  if (response?.headers) {
    const logoutDate = response.headers?.get?.("date");
    if (logoutDate) syncServerTime(logoutDate);
  }
}

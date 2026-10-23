import { create } from "zustand";
import {
  exchangeCode,
  fetchUserPlaylists,
  generateAuthorizeUrl,
  refreshTokens,
  type SpotifyOAuthTokens,
  type SpotifyUserPlaylistSummary,
  type SpotifyOAuthError,
} from "../services/import/sources/spotify/spotifyOAuth";
import { validateAndExtractCallback } from "../services/import/sources/spotify/spotifyCallback";

export const STORAGE_KEY_TOKENS = "liner_spotify_oauth_tokens";
export const STORAGE_KEY_PENDING_PKCE = "liner_spotify_pkce_pending";
export const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export interface SpotifyPendingPkce {
  codeVerifier: string;
  state: string;
  createdAt: number;
}

export type SpotifyConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface SpotifyAuthState {
  tokens: SpotifyOAuthTokens | null;
  pendingPkce: SpotifyPendingPkce | null;
  status: SpotifyConnectionStatus;
  error: string | null;
  playlists: SpotifyUserPlaylistSummary[];
  loadingPlaylists: boolean;

  initiateAuth: () => Promise<string>;
  handleCallback: (callbackUrl: string) => Promise<SpotifyOAuthTokens>;
  getValidAccessToken: (signal?: AbortSignal) => Promise<string>;
  disconnect: () => void;
  loadUserPlaylists: (signal?: AbortSignal) => Promise<SpotifyUserPlaylistSummary[]>;
  setTokens: (tokens: SpotifyOAuthTokens | null) => void;
  setError: (error: string | null) => void;
}

function loadInitialTokens(): SpotifyOAuthTokens | null {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY_TOKENS);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return null;
}

function loadInitialPendingPkce(): SpotifyPendingPkce | null {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY_PENDING_PKCE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.createdAt < 15 * 60 * 1000) {
          return parsed;
        }
      }
    }
  } catch {}
  return null;
}

function saveTokens(tokens: SpotifyOAuthTokens | null): void {
  try {
    if (typeof localStorage !== "undefined") {
      if (tokens) {
        localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKENS);
      }
    }
  } catch {}
}

function savePendingPkce(pkce: SpotifyPendingPkce | null): void {
  try {
    if (typeof localStorage !== "undefined") {
      if (pkce) {
        localStorage.setItem(STORAGE_KEY_PENDING_PKCE, JSON.stringify(pkce));
      } else {
        localStorage.removeItem(STORAGE_KEY_PENDING_PKCE);
      }
    }
  } catch {}
}

const initialTokens = loadInitialTokens();
const initialPkce = loadInitialPendingPkce();

function raceWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
    };
    const onResolve = (value: T) => {
      cleanup();
      resolve(value);
    };
    const onReject = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(onResolve, onReject);
  });
}

export function isSpotifyRevocationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; error?: string; code?: string; message?: string };
  if (e.status === 401) return true;
  if (e.error === "invalid_grant" || e.code === "invalid_grant") return true;
  const msg = String(e.message || "").toLowerCase();
  if (msg.includes("invalid_grant")) return true;
  if (msg.includes("invalid refresh token")) return true;
  if (msg.includes("refresh token revoked")) return true;
  if (msg.includes("token revoked")) return true;
  if (e.status === 400 && (e.error === "invalid_grant" || msg.includes("invalid") || msg.includes("revoked"))) {
    return true;
  }
  return false;
}

let inFlightRefreshPromise: Promise<string> | null = null;

export const useSpotifyAuthStore = create<SpotifyAuthState>((set, get) => ({
  tokens: initialTokens,
  pendingPkce: initialPkce,
  status: initialTokens ? "connected" : "disconnected",
  error: null,
  playlists: [],
  loadingPlaylists: false,

  initiateAuth: async () => {
    set({ status: "connecting", error: null });
    const { url, codeVerifier, state } = await generateAuthorizeUrl();
    const pending: SpotifyPendingPkce = {
      codeVerifier,
      state,
      createdAt: Date.now(),
    };
    savePendingPkce(pending);
    set({ pendingPkce: pending });
    return url;
  },

  handleCallback: async (callbackUrl: string) => {
    const pending = get().pendingPkce || loadInitialPendingPkce();
    const { code } = validateAndExtractCallback(callbackUrl, pending?.state);
    if (!pending?.codeVerifier) {
      throw new Error("Missing PKCE code verifier for Spotify authorization");
    }

    try {
      const tokens = await exchangeCode(code, pending.codeVerifier);
      saveTokens(tokens);
      savePendingPkce(null);
      set({
        tokens,
        pendingPkce: null,
        status: "connected",
        error: null,
      });
      return tokens;
    } catch (err: any) {
      const message = err?.message || "Failed to exchange authorization code";
      set({ status: "error", error: message });
      throw err;
    }
  },

  getValidAccessToken: async (signal?: AbortSignal) => {
    const currentTokens = get().tokens;
    if (!currentTokens) {
      throw new Error("Not connected to Spotify");
    }

    // 1. If a refresh is already in-flight, coalesce onto it
    if (inFlightRefreshPromise) {
      return raceWithSignal(inFlightRefreshPromise, signal);
    }

    const now = Date.now();
    // 2. If token is still valid (>60s remaining), return immediately
    if (now < currentTokens.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
      return currentTokens.accessToken;
    }

    // 3. Initiate single-flight refresh
    inFlightRefreshPromise = (async () => {
      try {
        const refreshed = await refreshTokens(currentTokens.refreshToken);
        // Only update store if disconnect() was not called while refresh was in flight
        if (get().status !== "disconnected" && get().tokens !== null) {
          saveTokens(refreshed);
          set({ tokens: refreshed, status: "connected", error: null });
        }
        return refreshed.accessToken;
      } catch (err: unknown) {
        if (isSpotifyRevocationError(err)) {
          get().disconnect();
        }
        throw err;
      } finally {
        inFlightRefreshPromise = null;
      }
    })();

    return raceWithSignal(inFlightRefreshPromise, signal);
  },

  disconnect: () => {
    inFlightRefreshPromise = null;
    saveTokens(null);
    savePendingPkce(null);
    set({
      tokens: null,
      pendingPkce: null,
      status: "disconnected",
      error: null,
      playlists: [],
      loadingPlaylists: false,
    });
  },

  loadUserPlaylists: async (signal?: AbortSignal) => {
    set({ loadingPlaylists: true, error: null });
    try {
      const accessToken = await get().getValidAccessToken(signal);
      const playlists = await fetchUserPlaylists(accessToken, signal);
      set({ playlists, loadingPlaylists: false });
      return playlists;
    } catch (err: any) {
      set({ loadingPlaylists: false, error: err?.message || "Failed to load playlists" });
      throw err;
    }
  },

  setTokens: (tokens) => {
    inFlightRefreshPromise = null;
    saveTokens(tokens);
    set({ tokens, status: tokens ? "connected" : "disconnected" });
  },

  setError: (error) => set({ error }),
}));

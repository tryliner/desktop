import type { ClientImportedPlaylist, ClientImportedTrack } from "../../importTypes";
import type { Track } from "@/shared/types";
import { delay } from "../../shared/http";

export interface SpotifyOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

export interface SpotifyOAuthError extends Error {
  status?: number;
  error?: string;
  error_description?: string;
}

export interface SpotifyUserPlaylistSummary {
  id: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  tracksCount: number;
  isPublic: boolean;
  ownerName: string;
  spotifyUrl: string;
}

export interface RawSpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id?: string }>;
  album?: {
    name: string;
    images?: Array<{ url: string; width?: number; height?: number }>;
  };
  duration_ms: number;
  external_ids?: { isrc?: string };
  uri?: string;
}

export interface SpotifyOAuthClient {
  generateAuthorizeUrl(): Promise<{ url: string; codeVerifier: string; state: string }>;
  exchangeCode(code: string, codeVerifier: string): Promise<SpotifyOAuthTokens>;
  refreshTokens(refreshToken: string): Promise<SpotifyOAuthTokens>;
  getUserPlaylists(accessToken: string, signal?: AbortSignal): Promise<SpotifyUserPlaylistSummary[]>;
}

export const SPOTIFY_DEFAULT_REDIRECT_URI = "liner://spotify-callback";
export const SPOTIFY_DEFAULT_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
];

export function getSpotifyClientId(): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_SPOTIFY_CLIENT_ID) {
      return import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    }
  } catch {}
  return "liner_mock_id";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateCodeVerifier(length = 64): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let verifier = "";
  for (let i = 0; i < length; i++) {
    verifier += possible[randomBytes[i] % possible.length];
  }
  return verifier;
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64Url(new Uint8Array(digest));
}

export function generateState(length = 16): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let state = "";
  for (let i = 0; i < length; i++) {
    state += possible[randomBytes[i] % possible.length];
  }
  return state;
}

export async function generateAuthorizeUrl(options: {
  clientId?: string;
  redirectUri?: string;
  scopes?: string[];
  state?: string;
  codeVerifier?: string;
} = {}): Promise<{ url: string; codeVerifier: string; state: string }> {
  const clientId = options.clientId || getSpotifyClientId();
  const redirectUri = options.redirectUri || SPOTIFY_DEFAULT_REDIRECT_URI;
  const scopes = options.scopes || SPOTIFY_DEFAULT_SCOPES;
  const state = options.state || generateState();
  const codeVerifier = options.codeVerifier || generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: scopes.join(" "),
  });

  const url = `https://accounts.spotify.com/authorize?${params.toString()}`;
  return { url, codeVerifier, state };
}

export function parseRetryAfterHeader(
  header: string | null | undefined,
  defaultDelayMs = 1000,
  minDelayMs = 100,
  maxDelayMs = 10000,
  now: () => number = Date.now
): number {
  if (!header || typeof header !== "string") {
    return defaultDelayMs;
  }
  const trimmed = header.trim();
  if (!trimmed) {
    return defaultDelayMs;
  }

  // 1. Numeric delta-seconds (integer or decimal float)
  const numericSeconds = Number(trimmed);
  if (!Number.isNaN(numericSeconds) && Number.isFinite(numericSeconds)) {
    const rawMs = numericSeconds * 1000;
    return Math.min(Math.max(rawMs, minDelayMs), maxDelayMs);
  }

  // 2. RFC 7231 IMF-fixdate HTTP-date (e.g. "Wed, 21 Oct 2026 07:28:00 GMT")
  const dateEpochMs = Date.parse(trimmed);
  if (!Number.isNaN(dateEpochMs) && Number.isFinite(dateEpochMs)) {
    const diffMs = dateEpochMs - now();
    return Math.min(Math.max(diffMs, minDelayMs), maxDelayMs);
  }

  // 3. Fallback for unparseable strings
  return defaultDelayMs;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let attempt = 0;
  while (true) {
    attempt++;
    const response = await fetch(url, init);
    if (response.status === 429 && attempt <= maxRetries) {
      const retryAfterHeader = response.headers.get("retry-after");
      const delayMs = parseRetryAfterHeader(retryAfterHeader);
      await delay(delayMs, init.signal ?? undefined);
      continue;
    }
    return response;
  }
}

export async function exchangeCode(
  code: string,
  codeVerifier: string,
  options: { clientId?: string; redirectUri?: string; signal?: AbortSignal } = {}
): Promise<SpotifyOAuthTokens> {
  if (!code || !codeVerifier) {
    const err = new Error("invalid_grant: Invalid authorization code or verifier") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const clientId = options.clientId || getSpotifyClientId();
  const redirectUri = options.redirectUri || SPOTIFY_DEFAULT_REDIRECT_URI;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetchWithRetry("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `Token exchange failed with status ${response.status}`;
    let errorCode: string | undefined;
    let errorDescription: string | undefined;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error) errorCode = String(parsed.error);
      if (parsed.error_description) errorDescription = String(parsed.error_description);
      if (errorCode && errorDescription) {
        message = `${errorCode}: ${errorDescription}`;
      } else if (errorDescription) {
        message = errorDescription;
      } else if (errorCode) {
        message = errorCode;
      }
    } catch {}
    const err = new Error(message) as SpotifyOAuthError;
    err.status = response.status;
    if (errorCode) err.error = errorCode;
    if (errorDescription) err.error_description = errorDescription;
    throw err;
  }

  const data = (await response.json()) as Record<string, any>;
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    scope: String(data.scope || "playlist-read-private playlist-read-collaborative"),
    tokenType: String(data.token_type || "Bearer"),
  };
}

export async function refreshTokens(
  refreshToken: string,
  options: { clientId?: string; signal?: AbortSignal } = {}
): Promise<SpotifyOAuthTokens> {
  if (!refreshToken) {
    const err = new Error("invalid_grant: Invalid refresh token") as SpotifyOAuthError;
    err.status = 400;
    err.error = "invalid_grant";
    err.error_description = "Invalid refresh token";
    throw err;
  }

  const clientId = options.clientId || getSpotifyClientId();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const response = await fetchWithRetry("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `Token refresh failed with status ${response.status}`;
    let errorCode: string | undefined;
    let errorDescription: string | undefined;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error) errorCode = String(parsed.error);
      if (parsed.error_description) errorDescription = String(parsed.error_description);
      if (errorCode && errorDescription) {
        message = `${errorCode}: ${errorDescription}`;
      } else if (errorDescription) {
        message = errorDescription;
      } else if (errorCode) {
        message = errorCode;
      }
    } catch {}
    const err = new Error(message) as SpotifyOAuthError;
    err.status = response.status;
    if (errorCode) err.error = errorCode;
    if (errorDescription) err.error_description = errorDescription;
    throw err;
  }

  const data = (await response.json()) as Record<string, any>;
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token || refreshToken), // Retain existing if rotation omitted
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    scope: String(data.scope || "playlist-read-private playlist-read-collaborative"),
    tokenType: String(data.token_type || "Bearer"),
  };
}

export async function fetchUserPlaylists(
  accessToken: string,
  signal?: AbortSignal
): Promise<SpotifyUserPlaylistSummary[]> {
  if (!accessToken) {
    const err = new Error("The access token expired") as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  const summaries: SpotifyUserPlaylistSummary[] = [];
  const limit = 50;
  let offset = 0;
  let total: number | null = null;

  while (total === null || offset < total) {
    signal?.throwIfAborted();
    const url = `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`;
    const response = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal,
    });

    if (response.status === 401) {
      const err = new Error("The access token expired") as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    if (!response.ok) {
      const err = new Error(`Failed to fetch playlists: HTTP ${response.status}`) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    const data = (await response.json()) as Record<string, any>;
    total = typeof data.total === "number" ? data.total : 0;
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) break;

    for (const item of items) {
      if (!item || !item.id) continue;
      summaries.push({
        id: String(item.id),
        name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Untitled Playlist",
        description: typeof item.description === "string" ? item.description : null,
        images: Array.isArray(item.images)
          ? item.images
              .filter((img: any) => img && typeof img.url === "string")
              .map((img: any) => ({ url: String(img.url) }))
          : [],
        tracksCount: typeof item.tracks?.total === "number" ? item.tracks.total : 0,
        isPublic: Boolean(item.public),
        ownerName: String(item.owner?.display_name || item.owner?.id || "Unknown"),
        spotifyUrl: String(item.external_urls?.spotify || `https://open.spotify.com/playlist/${item.id}`),
      });
    }

    offset += items.length;
    if (data.next === null) break;
    if (offset >= total) break;
  }

  return summaries;
}

export async function fetchSpotifyUserPlaylistTracks(
  playlistId: string,
  accessToken: string,
  signal?: AbortSignal
): Promise<ClientImportedTrack[]> {
  if (!accessToken) {
    const err = new Error("The access token expired") as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  const tracks: ClientImportedTrack[] = [];
  const limit = 100;
  let offset = 0;
  let total: number | null = null;

  while (total === null || offset < total) {
    signal?.throwIfAborted();
    const url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}&offset=${offset}&additional_types=track`;
    const response = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal,
    });

    if (response.status === 401) {
      const err = new Error("The access token expired") as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    if (!response.ok) {
      const err = new Error(`Failed to fetch playlist tracks: HTTP ${response.status}`) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    const data = (await response.json()) as Record<string, any>;
    total = typeof data.total === "number" ? data.total : 0;
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) break;

    for (const item of items) {
      const rawTrack = item?.track;
      if (!rawTrack) continue;
      if (item.is_local || rawTrack.is_local) continue;
      if (rawTrack.type === "episode") continue;
      const title = typeof rawTrack.name === "string" ? rawTrack.name.trim() : "";
      if (!title) continue;

      const artists = Array.isArray(rawTrack.artists)
        ? rawTrack.artists.map((a: any) => typeof a?.name === "string" ? a.name.trim() : "").filter(Boolean)
        : [];
      const artistIds = Array.isArray(rawTrack.artists)
        ? rawTrack.artists.map((a: any) => typeof a?.id === "string" ? a.id : undefined)
        : [];

      const album = rawTrack.album;
      const albumName = typeof album?.name === "string" ? album.name.trim() : undefined;
      const albumId = typeof album?.id === "string" ? album.id : undefined;
      const coverUrl = Array.isArray(album?.images) && album.images[0]?.url ? String(album.images[0].url) : undefined;
      const durationMs = typeof rawTrack.duration_ms === "number" ? rawTrack.duration_ms : undefined;
      const sourceId = typeof rawTrack.id === "string" && rawTrack.id ? rawTrack.id : (rawTrack.uri?.split(":").pop() || "");

      tracks.push({
        sourceId,
        title,
        artists: artists.length > 0 ? artists : ["Spotify Artist"],
        ...(artistIds.length > 0 ? { artistIds } : {}),
        ...(albumName ? { album: albumName } : {}),
        ...(albumId ? { albumId } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(coverUrl ? { coverUrl } : {}),
      });
    }

    offset += items.length;
    if (data.next === null) break;
    if (offset >= total) break;
  }

  return tracks;
}

export function normalizeSpotifyUserPlaylist(
  summary: SpotifyUserPlaylistSummary,
  tracks: ClientImportedTrack[]
): ClientImportedPlaylist {
  return {
    source: "spotify",
    sourceUrl: summary.spotifyUrl || `https://open.spotify.com/playlist/${summary.id}`,
    title: summary.name,
    ...(summary.description ? { description: summary.description } : {}),
    tracks,
  };
}

export interface SpotifyNormalizedTrack {
  id: string;
  title: string;
  artists: string;
  album?: string;
  durationMs: number;
  coverUrl: string;
  isrc?: string;
  playCount: number;
}

export function normalizeSpotifyTrack(raw: RawSpotifyTrack): SpotifyNormalizedTrack {
  return {
    id: `spotify:${raw.id}`,
    title: raw.name || "Untitled Track",
    artists: raw.artists?.map((a) => a.name).join(", ") || "Unknown Artist",
    album: raw.album?.name,
    durationMs: raw.duration_ms || 0,
    coverUrl: raw.album?.images?.[0]?.url || "",
    isrc: raw.external_ids?.isrc,
    playCount: 0,
  };
}

export class SpotifyOAuthClientImpl implements SpotifyOAuthClient {
  private clientId?: string;
  private redirectUri?: string;

  constructor(options?: { clientId?: string; redirectUri?: string }) {
    this.clientId = options?.clientId;
    this.redirectUri = options?.redirectUri;
  }

  generateAuthorizeUrl(): Promise<{ url: string; codeVerifier: string; state: string }> {
    return generateAuthorizeUrl({ clientId: this.clientId, redirectUri: this.redirectUri });
  }

  exchangeCode(code: string, codeVerifier: string): Promise<SpotifyOAuthTokens> {
    return exchangeCode(code, codeVerifier, { clientId: this.clientId, redirectUri: this.redirectUri });
  }

  refreshTokens(refreshToken: string): Promise<SpotifyOAuthTokens> {
    return refreshTokens(refreshToken, { clientId: this.clientId });
  }

  getUserPlaylists(accessToken: string, signal?: AbortSignal): Promise<SpotifyUserPlaylistSummary[]> {
    return fetchUserPlaylists(accessToken, signal);
  }

  getPlaylistTracks(playlistId: string, accessToken: string, signal?: AbortSignal): Promise<ClientImportedTrack[]> {
    return fetchSpotifyUserPlaylistTracks(playlistId, accessToken, signal);
  }

  normalizeUserPlaylist(summary: SpotifyUserPlaylistSummary, tracks: ClientImportedTrack[]): ClientImportedPlaylist {
    return normalizeSpotifyUserPlaylist(summary, tracks);
  }

  normalizeTrack(raw: RawSpotifyTrack): SpotifyNormalizedTrack {
    return normalizeSpotifyTrack(raw);
  }
}

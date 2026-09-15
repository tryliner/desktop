import {
  getAccessToken,
  getAuthSession,
  getValidAccessToken,
  refreshAuthSession,
  setAuthSession,
  type AuthTokens,
  type AuthUser,
} from "./auth-session";
import { signApiRequest } from "./requestSigner";
import { telemetry } from "@/shared/telemetry";
import type {
  PublicUser,
  UpdateProfileInput,
  UserProfile,
  LeaderboardResponse,
} from "@/shared/contracts";

import { usePlayerStore } from "@/features/player/store/playerStore";
import { showToast } from "@/shared/ui/Toast";
import { createTranslatorSync, getStoredLocale } from "@/languages";
import {
  isConnectivityFailure,
  recordConnectivityFailure,
  statusOf,
  stripQuery,
} from "@/features/connectivity";

function translate(key: string, vars?: Record<string, string | number>) {
  try {
    return createTranslatorSync(getStoredLocale())(key, vars);
  } catch {
    return key;
  }
}

const BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://api.tryliner.fun";

const CLIENT_VERSION =
  (import.meta.env.VITE_CLIENT_VERSION as string | undefined) || "1.0.4-desktop";

const DEFAULT_TIMEOUT_MS = 15000;

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const userSignal = init?.signal;
  let didTimeout = false;

  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  let onUserAbort: (() => void) | null = null;
  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(timer);
      controller.abort(userSignal.reason);
    } else {
      onUserAbort = () => {
        clearTimeout(timer);
        controller.abort(userSignal.reason);
      };
      userSignal.addEventListener("abort", onUserAbort);
    }
  }

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } catch (err: any) {
    if (didTimeout) {
      showToast(translate("common.error_timeout_title"), "error", {
        id: "network-timeout-toast",
        description: translate("common.error_network"),
      });
      throw new ApiError(
        0,
        "Request timed out. Please check your network connection.",
        "TIMEOUT_ERROR",
      );
    }
    if (userSignal?.aborted) {
      throw err;
    }
    showToast(translate("common.error_network_title"), "error", {
      id: "network-error-toast",
      description: translate("common.error_network"),
    });
    throw new ApiError(
      0,
      "Network error. Unable to reach server.",
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
    if (userSignal && onUserAbort) {
      userSignal.removeEventListener("abort", onUserAbort);
    }
  }
}

function getPlatform(): string {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "desktop";
}

function getActiveSessionId(): string | undefined {
  try {
    const state = usePlayerStore.getState();
    return state.currentTrack?.id || undefined;
  } catch {
    return undefined;
  }
}

export function mediaUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return BASE + (path.startsWith("/") ? path : "/" + path);
}

// upgrades youtube/google avatar artwork to maximum native resolution (=s0)
export function toMaxQualityAvatarUrl(url: string | undefined): string {
  if (!url) return "";
  if (!/(?:[a-zA-Z0-9_-]+\.googleusercontent\.com|[a-zA-Z0-9_-]+\.ggpht\.com)/i.test(url)) {
    return url;
  }
  if (/=w\d+-h\d+/.test(url)) {
    return url.replace(/=w\d+-h\d+(?:-[a-zA-Z0-9_-]+)*/, "=s0");
  }
  if (/=s\d+/.test(url)) {
    return url.replace(/=s\d+(?:-[a-zA-Z0-9_-]+)*/, "=s0");
  }
  return `${url}=s0`;
}

const inFlightGetRequests = new Map<string, Promise<unknown>>();

async function executeRequest<T>(
  path: string,
  init?: RequestInit,
  allowRefresh = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const startTime = performance.now();
  const method = (init?.method ?? "GET").toUpperCase();
  const rawBody = typeof init?.body === "string" ? init.body : null;
  const signedHeaders = await signApiRequest(method, path, rawBody);
  const accessToken = allowRefresh ? await getValidAccessToken() : null;
  const hasBody = init?.body != null;
  const extraHeaders = (init?.headers as Record<string, string>) ?? {};
  const { Authorization: _ignoredAuth, ...restHeaders } = extraHeaders;

  const requestId =
    extraHeaders["x-request-id"] ||
    extraHeaders["X-Request-Id"] ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

  const currentSession = getAuthSession();
  const correlationHeaders: Record<string, string> = {
    "x-request-id": requestId,
    "x-client-version": CLIENT_VERSION,
    "x-platform": getPlatform(),
  };

  if (currentSession?.user?.id) {
    correlationHeaders["x-user-id"] = currentSession.user.id;
  }
  if (currentSession?.user?.username) {
    correlationHeaders["x-user-name"] = currentSession.user.username;
  }

  const activeSessionId = getActiveSessionId();
  if (activeSessionId) {
    correlationHeaders["x-session-id"] = activeSessionId;
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      BASE + path,
      {
        ...init,
        headers: {
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...correlationHeaders,
          ...signedHeaders,
          ...restHeaders,
        },
      },
      timeoutMs,
    );
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    telemetry.trackNetwork(method, path, 0, durationMs, requestId);
    if (isConnectivityFailure(err)) {
      recordConnectivityFailure({
        method,
        path: stripQuery(path),
        status: statusOf(err),
        latencyMs: durationMs,
      });
    }
    throw err;
  }

  if (res.status === 401 && allowRefresh && !path.startsWith("/v1/auth/")) {
    const currentSession = getAuthSession();
    // If the token in session store was already rotated by another parallel request,
    // retry immediately with the rotated token without firing duplicate refresh requests
    let nextToken =
      currentSession?.accessToken && currentSession.accessToken !== accessToken
        ? currentSession.accessToken
        : null;

    if (!nextToken) {
      const refreshed = await refreshAuthSession();
      nextToken = refreshed?.accessToken ?? null;
    }

    if (nextToken) {
      const refreshedSignedHeaders = await signApiRequest(
        method,
        path,
        rawBody,
      );
      try {
        res = await fetchWithTimeout(
          BASE + path,
          {
            ...init,
            headers: {
              ...(hasBody ? { "Content-Type": "application/json" } : {}),
              ...correlationHeaders,
              ...restHeaders,
              ...refreshedSignedHeaders,
              Authorization: `Bearer ${nextToken}`,
            },
          },
          timeoutMs,
        );
      } catch (err) {
        const durationMs = Math.round(performance.now() - startTime);
        telemetry.trackNetwork(method, path, 0, durationMs, requestId);
        if (isConnectivityFailure(err)) {
          recordConnectivityFailure({
            method,
            path: stripQuery(path),
            status: statusOf(err),
            latencyMs: durationMs,
          });
        }
        throw err;
      }
    }
  }

  const durationMs = Math.round(performance.now() - startTime);
  telemetry.trackNetwork(method, path, res.status, durationMs, requestId);

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const resRequestId =
      res.headers.get("x-request-id") ||
      (typeof body.reqId === "string"
        ? body.reqId
        : typeof body.requestId === "string"
        ? body.requestId
        : undefined);

    if (res.status >= 500) {
      showToast(translate("common.error_server_title"), "error", {
        id: `server-error-${res.status}`,
        description: translate("common.error_server"),
        requestId: resRequestId,
      });
    }

    const apiErr = new ApiError(
      res.status,
      typeof body.message === "string" ? body.message : res.statusText,
      typeof body.code === "string" ? body.code : undefined,
      resRequestId,
    );
    if (isConnectivityFailure(apiErr)) {
      recordConnectivityFailure({
        method,
        path: stripQuery(path),
        status: res.status,
        ...(apiErr.code ? { code: apiErr.code } : {}),
        latencyMs: durationMs,
      });
    }
    throw apiErr;
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  allowRefresh = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  // deduplicate identical concurrent in-flight get requests
  if (method === "GET" && !init?.signal) {
    const key = `${path}::${allowRefresh}`;
    const inFlight = inFlightGetRequests.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
    const promise = executeRequest<T>(path, init, allowRefresh, timeoutMs).finally(() => {
      inFlightGetRequests.delete(key);
    });
    inFlightGetRequests.set(key, promise);
    return promise;
  }
  return executeRequest<T>(path, init, allowRefresh, timeoutMs);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get traceInfo(): string | undefined {
    return this.requestId ? `[reqId: ${this.requestId}]` : undefined;
  }
}

// maps any thrown error to a localized human-friendly message.
// never surfaces raw api bodies, statuses, or technical jargon.
export function resolveApiErrorMessage(
  err: unknown,
  t: (key: string) => string,
  fallbackKey: string,
): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return t("common.error_network");
    if (err.status === 401 || err.status === 403)
      return t("common.error_session_expired");
    if (err.status === 404) return t("common.error_not_found");
    if (err.status === 429) return t("common.error_too_many");
    if (err.status >= 500) return t("common.error_server");
    return t(fallbackKey);
  }
  return t(fallbackKey);
}

// ---- Types from @liner/contracts --------------------------------------------

export type {
  SearchType,
  Cover,
  ApiCover,
  TrackArtist as ApiTrackArtist,
  TrackAlbum as ApiTrackAlbum,
  Track as ApiTrackBase,
  ApiTrack,
  TrackDetails as ApiTrackDetails,
  SearchArtistItem as ApiArtist,
  SearchAlbumItem as ApiAlbum,
  SearchPlaylistItem as ApiPlaylist,
  SearchResult as ApiSearchItem,
  SearchResponse,
  ArtistAlbum as ApiArtistAlbum,
  ArtistRelease as ApiArtistRelease,
  ArtistDetails as ApiArtistDetails,
  AlbumDetails as ApiAlbumDetails,
  CatalogPlaylistDetails as ApiCatalogPlaylistDetails,
  RadioTrack as ApiRadioTrack,
  RadioResponse,
  PlaylistSummary as ApiPlaylistSummary,
  PlaylistDetails as ApiPlaylistDetails,
  UserPlaylist as ApiUserPlaylist,
  UserPlaylistItem as ApiUserPlaylistItem,
  LikedTracksPage as ApiLikedTracksPage,
  PlaybackSessionResponse as PlaybackSession,
  PlaybackSessionResponse as ApiPlaybackSession,
  Codec,
  CodecPreference,
  LyricsFormat,
  LyricsContentKind,
  LyricsSyncLevel,
  LyricsQuality,
  RawLyricsCandidate,
  LyricsCandidate,
  LyricsStreamEvent,
  ImportReviewReason,
  ImportReview,
  ImportReviewDecision,
  ImportSource,
  ImportJobStatus,
  ImportResult,
  ImportJob,
  ImportedTrack,
  ImportedPlaylist,
  PublicUser,
  UserProfile,
  UpdateProfileInput,
  UserPrivacySettings,
  LeaderboardResponse,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardType,
  AuthTokens,
  AuthResult,
  PlaybackContextType,
  PlaybackContext,
  RecordPlaybackEventRequest,
  PlaybackHistoryItem,
  PlaybackHistoryResponse,
  PopularTimeWindow,
  PopularTrackItem,
  PopularTracksResponse,
} from "../contracts";

import type {
  SearchType,
  SearchResponse,
  ApiTrackDetails,
  RadioResponse,
  ApiAlbumDetails,
  ApiArtistDetails,
  ApiCatalogPlaylistDetails,
  ApiLikedTracksPage,
  ApiUserPlaylist,
  ApiUserPlaylistItem,
  PlaybackSessionResponse as PlaybackSession,
  LyricsStreamEvent,
  ImportJob,
  ImportReview,
  ImportReviewDecision,
  RecordPlaybackEventRequest,
  PlaybackHistoryResponse,
  PopularTimeWindow,
  PopularTracksResponse,
} from "../contracts";

// ---- Endpoints --------------------------------------------------------------

export const api = {
  async login(email: string, password: string): Promise<AuthTokens> {
    const result = await request<AuthTokens>(
      "/v1/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false,
    );
    setAuthSession(result);
    return result;
  },

  async register(
    email: string,
    password: string,
    username: string,
    displayName: string,
  ): Promise<AuthTokens> {
    const result = await request<AuthTokens>(
      "/v1/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          username: username.trim().toLowerCase(),
          displayName: displayName.trim(),
        }),
      },
      false,
    );
    setAuthSession(result);
    return result;
  },

  getMe(): Promise<AuthUser> {
    return request<AuthUser>("/v1/me");
  },

  updateProfile(data: UpdateProfileInput): Promise<PublicUser> {
    return request<PublicUser>("/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  getUserProfile(idOrUsername: string): Promise<UserProfile> {
    return request<UserProfile>(`/v1/users/${encodeURIComponent(idOrUsername)}`);
  },

  searchUsers(query: string): Promise<UserProfile[]> {
    const params = new URLSearchParams({ q: query });
    return request<UserProfile[]>(`/v1/users/search?${params}`);
  },

  followUser(idOrUsername: string): Promise<void> {
    return request<void>(`/v1/users/${encodeURIComponent(idOrUsername)}/follow`, {
      method: "POST",
    });
  },

  unfollowUser(idOrUsername: string): Promise<void> {
    return request<void>(`/v1/users/${encodeURIComponent(idOrUsername)}/follow`, {
      method: "DELETE",
    });
  },

  getUserFollowers(idOrUsername: string): Promise<UserProfile[]> {
    return request<UserProfile[]>(`/v1/users/${encodeURIComponent(idOrUsername)}/followers`);
  },

  getUserFollowing(idOrUsername: string): Promise<UserProfile[]> {
    return request<UserProfile[]>(`/v1/users/${encodeURIComponent(idOrUsername)}/following`);
  },

  getUserPlaylists(idOrUsername: string): Promise<{ items: ApiUserPlaylist[] }> {
    return request<{ items: ApiUserPlaylist[] }>(`/v1/users/${encodeURIComponent(idOrUsername)}/playlists`);
  },

  getUserHistory(idOrUsername: string, cursor?: string, limit?: string): Promise<PlaybackHistoryResponse> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (limit) params.set("limit", limit);
    return request<PlaybackHistoryResponse>(`/v1/users/${encodeURIComponent(idOrUsername)}/history?${params}`);
  },

  getArtistLeaderboard(artistId: string, period = "monthly", limit = 10): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({ period, limit: String(limit) });
    return request<LeaderboardResponse>(`/v1/leaderboards/artist/${encodeURIComponent(artistId)}?${params}`);
  },

  getGlobalLeaderboard(period = "weekly", limit = 20): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({ period, limit: String(limit) });
    return request<LeaderboardResponse>(`/v1/leaderboards/global?${params}`);
  },
  search(q: string, type: SearchType = "all"): Promise<SearchResponse> {
    const params = new URLSearchParams({ q, type });
    return request<SearchResponse>(`/v1/search?${params}`);
  },

  getTrack(id: string): Promise<ApiTrackDetails> {
    return request<ApiTrackDetails>(`/v1/tracks/${encodeURIComponent(id)}`);
  },

  getRadio(
    id: string,
    options?: {
      history?: string[];
      k?: number;
      drift_rate?: number;
      temperature?: number;
      wave_id?: string;
    },
  ): Promise<RadioResponse> {
    if (options?.history && options.history.length > 0) {
      return request<RadioResponse>(
        `/v1/tracks/${encodeURIComponent(id)}/radio`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        },
      );
    }
    const params = new URLSearchParams();
    if (options?.k) params.set("k", String(options.k));
    if (options?.drift_rate) params.set("drift_rate", String(options.drift_rate));
    if (options?.temperature) params.set("temperature", String(options.temperature));
    if (options?.wave_id) params.set("wave_id", options.wave_id);
    const qs = params.toString();
    return request<RadioResponse>(
      `/v1/tracks/${encodeURIComponent(id)}/radio${qs ? `?${qs}` : ""}`,
    );
  },

  getAlbum(id: string): Promise<ApiAlbumDetails> {
    return request<ApiAlbumDetails>(`/v1/albums/${encodeURIComponent(id)}`);
  },

  getArtist(id: string): Promise<ApiArtistDetails> {
    return request<ApiArtistDetails>(`/v1/artists/${encodeURIComponent(id)}`);
  },

  getPlaylist(id: string): Promise<ApiCatalogPlaylistDetails> {
    return request<ApiCatalogPlaylistDetails>(
      `/v1/playlists/${encodeURIComponent(id)}`,
    );
  },

  listLikedTracks(limit = 100, cursor?: string): Promise<ApiLikedTracksPage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return request<ApiLikedTracksPage>(`/v1/me/library/tracks?${params}`);
  },

  likeTrack(id: string): Promise<void> {
    return request<void>(
      `/v1/me/library/tracks/${encodeURIComponent(id)}`,
      { method: "PUT" },
    );
  },

  unlikeTrack(id: string): Promise<void> {
    return request<void>(
      `/v1/me/library/tracks/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  listSavedCollections(
    type: "albums" | "artists",
  ): Promise<{ items: unknown[] }> {
    return request<{ items: unknown[] }>(`/v1/me/library/${type}`);
  },

  saveCollection(type: "albums" | "artists", id: string): Promise<void> {
    return request<void>(
      `/v1/me/library/${type}/${encodeURIComponent(id)}`,
      { method: "PUT" },
    );
  },

  removeCollection(type: "albums" | "artists", id: string): Promise<void> {
    return request<void>(
      `/v1/me/library/${type}/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  listPlaylists(): Promise<{ items: ApiUserPlaylist[] }> {
    return request<{ items: ApiUserPlaylist[] }>("/v1/me/playlists");
  },

  getUserPlaylist(
    id: string,
  ): Promise<{ playlist: ApiUserPlaylist; items: ApiUserPlaylistItem[] }> {
    return request<{
      playlist: ApiUserPlaylist;
      items: ApiUserPlaylistItem[];
    }>(`/v1/me/playlists/${encodeURIComponent(id)}`);
  },

  createPlaylist(input: {
    title: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<ApiUserPlaylist> {
    return request<ApiUserPlaylist>("/v1/me/playlists", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updatePlaylist(
    id: string,
    input: { title?: string; description?: string | null; isPublic?: boolean },
  ): Promise<ApiUserPlaylist> {
    return request<ApiUserPlaylist>(
      `/v1/me/playlists/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
  },

  deletePlaylist(id: string): Promise<void> {
    return request<void>(`/v1/me/playlists/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  addPlaylistTrack(
    playlistId: string,
    trackId: string,
  ): Promise<ApiUserPlaylistItem> {
    return request<ApiUserPlaylistItem>(
      `/v1/me/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`,
      { method: "POST" },
    );
  },

  removePlaylistItem(playlistId: string, itemId: string): Promise<void> {
    return request<void>(
      `/v1/me/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    );
  },

  movePlaylistItem(
    playlistId: string,
    itemId: string,
    beforeItemId: string | null,
    revision: number,
  ): Promise<{ playlist: ApiUserPlaylist; items: ApiUserPlaylistItem[] }> {
    return request<{
      playlist: ApiUserPlaylist;
      items: ApiUserPlaylistItem[];
    }>(
      `/v1/me/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(itemId)}/move`,
      {
        method: "POST",
        body: JSON.stringify({ beforeItemId, revision }),
      },
    );
  },

  createPlaylistImport(
    url: string,
  ): Promise<ImportJob> {
    return request<ImportJob>(
      "/v1/me/playlist-imports",
      {
        method: "POST",
        body: JSON.stringify({ url }),
      },
    );
  },

  getPlaylistImport(
    importId: string,
  ): Promise<ImportJob> {
    return request<ImportJob>(
      `/v1/me/playlist-imports/${encodeURIComponent(importId)}`,
    );
  },

  getPlaylistImportReview(
    importId: string,
  ): Promise<{ items: ImportReview[] }> {
    return request<{ items: ImportReview[] }>(
      `/v1/me/playlist-imports/${encodeURIComponent(importId)}/review`,
    );
  },

  decidePlaylistImportReview(
    importId: string,
    decisions: ImportReviewDecision[],
  ): Promise<{ approved: string[]; denied: string[]; finalized?: boolean }> {
    return request<{ approved: string[]; denied: string[]; finalized?: boolean }>(
      `/v1/me/playlist-imports/${encodeURIComponent(importId)}/review`,
      {
        method: "POST",
        body: JSON.stringify({ decisions }),
      },
    );
  },

  skipPlaylistImportReview(
    importId: string,
  ): Promise<{ denied: "all"; finalized: boolean }> {
    return request<{ denied: "all"; finalized: boolean }>(
      `/v1/me/playlist-imports/${encodeURIComponent(importId)}/review`,
      {
        method: "POST",
        body: JSON.stringify({ action: "skip" }),
      },
    );
  },

  createPlaybackSession(
    id: string,
    preferredCodec?: "opus" | "aac",
    signal?: AbortSignal,
  ): Promise<PlaybackSession> {
    return request<PlaybackSession>(
      `/v1/tracks/${encodeURIComponent(id)}/playback`,
      {
        method: "POST",
        signal,
        body: JSON.stringify({
          transport: "proxy",
          ...(preferredCodec ? { preferredCodec } : {}),
        }),
      },
    );
  },

  async *streamLyrics(
    id: string,
    signal?: AbortSignal,
  ): AsyncGenerator<LyricsStreamEvent> {
    const path = `/v1/tracks/${encodeURIComponent(id)}/lyrics`;
    const signedHeaders = await signApiRequest("GET", path);
    const accessToken = await getValidAccessToken();
    const requestId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const correlationHeaders: Record<string, string> = {
      "x-request-id": requestId,
      "x-client-version": CLIENT_VERSION,
      "x-platform": getPlatform(),
      "x-session-id": id,
    };

    const res = await fetch(
      `${BASE}${path}`,
      {
        signal,
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...correlationHeaders,
          ...signedHeaders,
        },
      },
    );

    if (!res.ok || !res.body) {
      const respReqId = res.headers.get("x-request-id") || requestId;
      throw new ApiError(res.status, res.statusText, undefined, respReqId);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const flushEvent = (): LyricsStreamEvent | null => {
      const sep = buffer.indexOf("\n\n");
      if (sep === -1) return null;
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      const dataLines: string[] = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length === 0) return null;
      try {
        return JSON.parse(dataLines.join("\n")) as LyricsStreamEvent;
      } catch {
        return null;
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let event = flushEvent();
        while (event) {
          yield event;
          event = flushEvent();
        }
      }

      buffer += decoder.decode();
      let event = flushEvent();
      while (event) {
        yield event;
        event = flushEvent();
      }
    } finally {
      reader.releaseLock();
    }
  },

  async *streamPlaylistImport(
    importId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<ImportJob> {
    const path = `/v1/me/playlist-imports/${encodeURIComponent(importId)}/events`;
    const signedHeaders = await signApiRequest("GET", path);
    const accessToken = await getValidAccessToken();
    const res = await fetch(`${BASE}${path}`, {
      signal,
      headers: {
        Accept: "text/event-stream",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...signedHeaders,
      },
    });

    if (!res.ok || !res.body) {
      throw new ApiError(res.status, res.statusText);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const flushEvent = (): ImportJob | null => {
      const sep = buffer.indexOf("\n\n");
      if (sep === -1) return null;
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      const dataLines: string[] = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length === 0) return null;
      try {
        return JSON.parse(dataLines.join("\n")) as ImportJob;
      } catch {
        return null;
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let event = flushEvent();
        while (event) {
          yield event;
          event = flushEvent();
        }
      }

      buffer += decoder.decode();
      let event = flushEvent();
      while (event) {
        yield event;
        event = flushEvent();
      }
    } finally {
      reader.releaseLock();
    }
  },

  recordPlaybackEvent(payload: RecordPlaybackEventRequest): Promise<void> {
    return request<void>("/v1/me/playback/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getHistory(cursor?: string, limit = 30): Promise<PlaybackHistoryResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return request<PlaybackHistoryResponse>(`/v1/me/history?${params}`);
  },

  getPopularTracks(
    window: PopularTimeWindow = "7d",
    limit = 50,
  ): Promise<PopularTracksResponse> {
    const params = new URLSearchParams({ window, limit: String(limit) });
    return request<PopularTracksResponse>(`/v1/explore/popular?${params}`);
  },
};

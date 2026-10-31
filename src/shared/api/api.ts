import {
  getAuthSession,
  getSessionExpiryMs,
  getValidAccessToken,
  refreshAuthSession,
  setAuthSession,
  type AuthTokens,
  type AuthUser,
} from "./auth-session";
import { signApiRequest, syncServerTime } from "./requestSigner";
import { clientCatalog } from "./clientCatalog";
import { getLocalImportHandler } from "./localImports";
import type { Track } from "@/shared/contracts";
import { telemetry } from "@/shared/telemetry";
import type {
  PublicUser,
  UpdateProfileInput,
  UserProfile,
  LeaderboardResponse,
  DailyMixesResponse,
} from "@/shared/contracts";

import { usePlayerStore } from "@/features/player/store/playerStore";
import { isLocalTrackId } from "@/shared/media/local";
import { showToast } from "@/shared/ui/Toast";
import { createTranslatorSync, getStoredLocale } from "@/languages";
import {
  connectionToastsMuted,
  isConnectivityFailure,
  isPlaybackPath,
  recordConnectivityFailure,
  statusOf,
  stripQuery,
} from "@/features/connectivity";
import { enterOfflineMode } from "@/features/connectivity/engine/offlineController";

function translate(key: string, vars?: Record<string, string | number>) {
  try {
    return createTranslatorSync(getStoredLocale())(key, vars);
  } catch {
    return key;
  }
}

function offlineModeAction() {
  return {
    label: translate("offline.use_offline"),
    onClick: () =>
      enterOfflineMode(
        "auto",
        true,
        typeof navigator !== "undefined" && !navigator.onLine
          ? "offline"
          : "server",
      ),
  };
}

import { getApiBaseUrl } from "./baseUrl";

const CLIENT_VERSION =
  (import.meta.env.VITE_CLIENT_VERSION as string | undefined) ||
  "1.0.4-desktop";

const DEFAULT_TIMEOUT_MS = 15000;
const LYRICS_CONNECT_TIMEOUT_MS = 12000;

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
      if (!connectionToastsMuted())
        showToast(translate("common.error_timeout_title"), "error", {
          id: "network-timeout-toast",
          description: translate("common.error_network"),
          action: offlineModeAction(),
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
    if (!connectionToastsMuted())
      showToast(translate("common.error_network_title"), "error", {
        id: "network-error-toast",
        description: translate("common.error_network"),
        action: offlineModeAction(),
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
    const id = usePlayerStore.getState().currentTrack?.id;
    return id && !isLocalTrackId(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function extractSubFromToken(token: string): string | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const payload = JSON.parse(json);
    return typeof payload.sub === "string" && payload.sub.trim().length > 0
      ? payload.sub.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

export function mediaUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return getApiBaseUrl() + (path.startsWith("/") ? path : "/" + path);
}

// upgrades youtube/google avatar artwork to maximum native resolution (=s0)
export function toMaxQualityAvatarUrl(url: string | undefined): string {
  if (!url) return "";
  if (
    !/(?:[a-zA-Z0-9_-]+\.googleusercontent\.com|[a-zA-Z0-9_-]+\.ggpht\.com)/i.test(
      url,
    )
  ) {
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
  onResponse?: (res: Response) => void,
): Promise<T> {
  const startTime = performance.now();
  const method = (init?.method ?? "GET").toUpperCase();
  const rawBody = typeof init?.body === "string" ? init.body : null;
  const signedHeaders = await signApiRequest(method, path, rawBody);
  const currentSession = getAuthSession();
  let accessToken = allowRefresh ? await getValidAccessToken() : null;

  if (
    allowRefresh &&
    currentSession?.accessToken &&
    !accessToken &&
    !path.startsWith("/v1/auth/")
  ) {
    const expiryMs = getSessionExpiryMs(currentSession);
    if (expiryMs && expiryMs > Date.now()) {
      accessToken = currentSession.accessToken;
    } else {
      recordConnectivityFailure({
        method,
        path: stripQuery(path),
        status: 0,
        latencyMs: Math.round(performance.now() - startTime),
      });
      throw new ApiError(
        0,
        "Network error during token refresh.",
        "NETWORK_ERROR",
      );
    }
  }

  const hasBody = init?.body != null;
  const extraHeaders = (init?.headers as Record<string, string>) ?? {};
  const { Authorization: _ignoredAuth, ...restHeaders } = extraHeaders;

  const requestId =
    extraHeaders["x-request-id"] ||
    extraHeaders["X-Request-Id"] ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const correlationHeaders: Record<string, string> = {
    "x-request-id": requestId,
    "x-client-version": CLIENT_VERSION,
    "x-platform": getPlatform(),
  };

  const userId =
    currentSession?.user?.id ||
    (accessToken ? extractSubFromToken(accessToken) : undefined);
  if (userId) {
    correlationHeaders["x-user-id"] = userId;
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
      getApiBaseUrl() + path,
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
  } catch (err: any) {
    if (init?.signal?.aborted || err?.name === "AbortError") {
      throw err;
    }
    const durationMs = Math.round(performance.now() - startTime);
    telemetry.trackNetwork(method, path, 0, durationMs, requestId);
    if (isConnectivityFailure(err) && !isPlaybackPath(path)) {
      recordConnectivityFailure({
        method,
        path: stripQuery(path),
        status: statusOf(err),
        latencyMs: durationMs,
      });
    }
    throw err;
  }

  // sync server time offset from response Date header
  const dateHeader = res.headers?.get?.("date");
  if (dateHeader) {
    syncServerTime(dateHeader);
  }

  if (res.status === 401 && allowRefresh && !path.startsWith("/v1/auth/")) {
    const currentSession = getAuthSession();
    // If the token in session store was already rotated by another parallel request,
    // retry immediately with the rotated token without firing duplicate refresh requests
    let nextToken =
      currentSession?.accessToken && currentSession.accessToken !== accessToken
        ? currentSession.accessToken
        : null;

    if (!nextToken && currentSession?.refreshToken) {
      const refreshed = await refreshAuthSession();
      nextToken = refreshed?.accessToken ?? null;
      if (!nextToken && getAuthSession()?.refreshToken) {
        throw new ApiError(
          0,
          "Failed to refresh auth session due to network issue",
          "NETWORK_ERROR",
        );
      }
    }

    if (!nextToken) {
      const durationMs = Math.round(performance.now() - startTime);
      telemetry.trackNetwork(method, path, res.status, durationMs, requestId);
      const body = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const code = typeof body?.code === "string" ? body.code : undefined;
      const message =
        typeof body?.message === "string"
          ? body.message
          : typeof body?.error === "string"
            ? body.error
            : "Unauthorized";
      throw new ApiError(res.status, message, code, requestId);
    }

    // Retry request with newly signed headers (synced server clock + fresh token if available)
    const refreshedSignedHeaders = await signApiRequest(method, path, rawBody);
    try {
      res = await fetchWithTimeout(
        getApiBaseUrl() + path,
        {
          ...init,
          headers: {
            ...(hasBody ? { "Content-Type": "application/json" } : {}),
            ...correlationHeaders,
            ...restHeaders,
            ...refreshedSignedHeaders,
            ...(nextToken ? { Authorization: `Bearer ${nextToken}` } : {}),
          },
        },
        timeoutMs,
      );
      const retryDateHeader = res.headers?.get?.("date");
      if (retryDateHeader) {
        syncServerTime(retryDateHeader);
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      telemetry.trackNetwork(method, path, 0, durationMs, requestId);
      if (isConnectivityFailure(err) && !isPlaybackPath(path)) {
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

  const durationMs = Math.round(performance.now() - startTime);
  telemetry.trackNetwork(method, path, res.status, durationMs, requestId);
  onResponse?.(res);
  if (res.status === 304) return undefined as unknown as T;

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const resRequestId =
      res.headers?.get?.("x-request-id") ||
      (typeof body.reqId === "string"
        ? body.reqId
        : typeof body.requestId === "string"
          ? body.requestId
          : undefined);

    if (res.status >= 500 && !connectionToastsMuted()) {
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
    if (isConnectivityFailure(apiErr) && !isPlaybackPath(path)) {
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

export type UserPlaylistRead =
  | { notModified: true }
  | {
      notModified: false;
      etag?: string;
      partial: boolean;
      trackCount: number;
      durationMs: number;
      playlist: ApiUserPlaylist;
      items: ApiUserPlaylistItem[];
    };

async function request<T>(
  path: string,
  init?: RequestInit,
  allowRefresh = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET" && !init?.signal) {
    const key = `${path}::${allowRefresh}`;
    const inFlight = inFlightGetRequests.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
    const promise = executeRequest<T>(
      path,
      init,
      allowRefresh,
      timeoutMs,
    ).finally(() => {
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
  PopularAlbumsResponse,
  MostSavedResponse,
  MostSavedType,
} from "../contracts";

import type {
  SearchType,
  SearchResponse,
  Track as ApiTrackBase,
  ApiTrackDetails,
  RadioResponse,
  ApiAlbumDetails,
  ApiArtistDetails,
  ApiCatalogPlaylistDetails,
  ApiLikedTracksPage,
  ApiUserPlaylist,
  ApiUserPlaylistItem,
  LyricsStreamEvent,
  LyricsSearchResult,
  ImportJob,
  ImportReview,
  ImportReviewDecision,
  RecordPlaybackEventRequest,
  PlaybackHistoryResponse,
  PopularTimeWindow,
  PopularTracksResponse,
  PopularAlbumsResponse,
  MostSavedResponse,
  MostSavedType,
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
    return request<UserProfile>(
      `/v1/users/${encodeURIComponent(idOrUsername)}`,
    );
  },

  searchUsers(query: string): Promise<UserProfile[]> {
    const params = new URLSearchParams({ q: query });
    return request<UserProfile[]>(`/v1/users/search?${params}`);
  },

  followUser(idOrUsername: string): Promise<void> {
    return request<void>(
      `/v1/users/${encodeURIComponent(idOrUsername)}/follow`,
      {
        method: "POST",
      },
    );
  },

  unfollowUser(idOrUsername: string): Promise<void> {
    return request<void>(
      `/v1/users/${encodeURIComponent(idOrUsername)}/follow`,
      {
        method: "DELETE",
      },
    );
  },

  getUserFollowers(idOrUsername: string): Promise<UserProfile[]> {
    return request<UserProfile[]>(
      `/v1/users/${encodeURIComponent(idOrUsername)}/followers`,
    );
  },

  getUserFollowing(idOrUsername: string): Promise<UserProfile[]> {
    return request<UserProfile[]>(
      `/v1/users/${encodeURIComponent(idOrUsername)}/following`,
    );
  },

  getUserPlaylists(
    idOrUsername: string,
  ): Promise<{ items: ApiUserPlaylist[] }> {
    return request<{ items: ApiUserPlaylist[] }>(
      `/v1/users/${encodeURIComponent(idOrUsername)}/playlists`,
    );
  },

  getUserHistory(
    idOrUsername: string,
    cursor?: string,
    limit?: string,
  ): Promise<PlaybackHistoryResponse> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (limit) params.set("limit", limit);
    return request<PlaybackHistoryResponse>(
      `/v1/users/${encodeURIComponent(idOrUsername)}/history?${params}`,
    );
  },

  getArtistLeaderboard(
    artistId: string,
    period = "monthly",
    limit = 10,
  ): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({ period, limit: String(limit) });
    return request<LeaderboardResponse>(
      `/v1/leaderboards/artist/${encodeURIComponent(artistId)}?${params}`,
    );
  },

  getGlobalLeaderboard(
    period = "weekly",
    limit = 20,
  ): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({ period, limit: String(limit) });
    return request<LeaderboardResponse>(`/v1/leaderboards/global?${params}`);
  },
  search(q: string, type: SearchType = "all"): Promise<SearchResponse> {
    const params = new URLSearchParams({ q, type });
    return clientCatalog.search(q, type, () =>
      request<SearchResponse>(`/v1/catalog/search?${params}`),
    );
  },

  getTrack(id: string): Promise<ApiTrackDetails> {
    return clientCatalog.getTrack(id, () =>
      request<ApiTrackDetails>(`/v1/catalog/tracks/${encodeURIComponent(id)}`),
    );
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
    const history = new Set(options?.history ?? []);
    return clientCatalog
      .getRadio(id, options?.k, () => api.getServerRadio(id, options))
      .then((response) => ({
        items: response.items.filter((item) => !history.has(item.id)),
      }));
  },

  getServerRadio(
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
    if (options?.drift_rate)
      params.set("drift_rate", String(options.drift_rate));
    if (options?.temperature)
      params.set("temperature", String(options.temperature));
    if (options?.wave_id) params.set("wave_id", options.wave_id);
    const qs = params.toString();
    return request<RadioResponse>(
      `/v1/tracks/${encodeURIComponent(id)}/radio${qs ? `?${qs}` : ""}`,
    );
  },

  getAlbum(id: string): Promise<ApiAlbumDetails> {
    return clientCatalog.getAlbum(id, () =>
      request<ApiAlbumDetails>(`/v1/catalog/albums/${encodeURIComponent(id)}`),
    );
  },

  getArtistImage(id: string): Promise<string | undefined> {
    return clientCatalog.getArtistImage(id);
  },

  getArtist(id: string): Promise<ApiArtistDetails> {
    return clientCatalog.getArtist(id, () =>
      request<ApiArtistDetails>(
        `/v1/catalog/artists/${encodeURIComponent(id)}`,
      ),
    );
  },

  getPlaylist(id: string): Promise<ApiCatalogPlaylistDetails> {
    return clientCatalog.getPlaylist(id, () =>
      request<ApiCatalogPlaylistDetails>(
        `/v1/catalog/playlists/${encodeURIComponent(id)}`,
      ),
    );
  },

  listLikedTracks(limit = 100, cursor?: string): Promise<ApiLikedTracksPage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return request<ApiLikedTracksPage>(`/v1/me/library/tracks?${params}`);
  },

  async likeTrack(id: string): Promise<void> {
    if (isLocalTrackId(id)) throw new Error("Local tracks stay on this device");
    const track = await clientCatalog.resolveSnapshot(id);
    return request<void>(`/v1/me/library/tracks/${encodeURIComponent(id)}`, {
      method: "PUT",
      ...(track
        ? { body: JSON.stringify({ track, trackSnapshot: track }) }
        : {}),
    });
  },

  unlikeTrack(id: string): Promise<void> {
    return request<void>(`/v1/me/library/tracks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  listSavedCollections(
    type: "albums" | "artists" | "playlists",
  ): Promise<{ items: unknown[] }> {
    return request<{ items: unknown[] }>(`/v1/me/library/${type}`);
  },

  // the catalog lives on the client now, so the server can't look a collection up by
  // id any more: send what we know (name / title, cover) or the library shows a blank tile
  saveCollection(
    type: "albums" | "artists" | "playlists",
    id: string,
    snapshot?: Record<string, unknown>,
  ): Promise<void> {
    return request<void>(`/v1/me/library/${type}/${encodeURIComponent(id)}`, {
      method: "PUT",
      ...(snapshot ? { body: JSON.stringify({ snapshot }) } : {}),
    });
  },

  removeCollection(
    type: "albums" | "artists" | "playlists",
    id: string,
  ): Promise<void> {
    return request<void>(`/v1/me/library/${type}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  listPlaylists(): Promise<{ items: ApiUserPlaylist[] }> {
    return request<{ items: ApiUserPlaylist[] }>("/v1/me/playlists");
  },

  async readUserPlaylist(
    id: string,
    options: { limit?: number; etag?: string } = {},
  ): Promise<UserPlaylistRead> {
    const params = new URLSearchParams({ compact: "true" });
    if (options.limit) params.set("limit", String(options.limit));
    let status = 200;
    let etag: string | undefined;
    const body = await executeRequest<
      | {
          playlist: ApiUserPlaylist;
          items: ApiUserPlaylistItem[];
          trackCount?: number;
          durationMs?: number;
          partial?: boolean;
        }
      | undefined
    >(
      `/v1/me/playlists/${encodeURIComponent(id)}?${params}`,
      options.etag ? { headers: { "If-None-Match": options.etag } } : undefined,
      true,
      DEFAULT_TIMEOUT_MS,
      (res) => {
        status = res.status;
        etag = res.headers?.get?.("etag") ?? undefined;
      },
    );
    if (status === 304 || !body) return { notModified: true };
    return {
      notModified: false,
      etag,
      partial: body.partial === true,
      trackCount: body.trackCount ?? body.items.length,
      durationMs:
        body.durationMs ??
        body.items.reduce(
          (sum, item) => sum + (item.track?.durationMs || 0),
          0,
        ),
      playlist: body.playlist,
      items: body.items,
    };
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

  async addPlaylistTrack(
    playlistId: string,
    trackId: string,
    snapshot?: ApiTrackBase,
  ): Promise<ApiUserPlaylistItem> {
    if (isLocalTrackId(trackId))
      throw new Error("Local tracks stay on this device");
    const track = snapshot ?? (await clientCatalog.resolveSnapshot(trackId));
    return request<ApiUserPlaylistItem>(
      `/v1/me/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`,
      {
        method: "POST",
        ...(track
          ? { body: JSON.stringify({ track, trackSnapshot: track }) }
          : {}),
      },
    );
  },

  addPlaylistTrackSnapshots(
    playlistId: string,
    tracks: ApiTrackBase[],
  ): Promise<{
    items: ApiUserPlaylistItem[];
    added: number;
    rejected: number;
  }> {
    return request<{
      items: ApiUserPlaylistItem[];
      added: number;
      rejected: number;
    }>(
      `/v1/me/playlists/${encodeURIComponent(playlistId)}/tracks`,
      { method: "POST", body: JSON.stringify({ tracks }) },
      true,
      60_000,
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

  getPlaylistImport(importId: string): Promise<ImportJob> {
    const job = getLocalImportHandler().getJob(importId);
    return job
      ? Promise.resolve(job)
      : Promise.reject(new ApiError(404, "Import was not found."));
  },

  getPlaylistImportReview(
    importId: string,
  ): Promise<{ items: ImportReview[] }> {
    return Promise.resolve({
      items: getLocalImportHandler().getReview(importId),
    });
  },

  decidePlaylistImportReview(
    importId: string,
    decisions: ImportReviewDecision[],
    tracks?: Track[],
    title?: string,
    description?: string,
  ): Promise<{ approved: string[]; denied: string[]; finalized?: boolean }> {
    return getLocalImportHandler()
      .finalize(importId, tracks ?? [], title, description)
      .then(({ finalized }) => ({
        approved: decisions
          .filter((d) => d.decision === "approve")
          .map((d) => d.reviewId),
        denied: decisions
          .filter((d) => d.decision === "deny")
          .map((d) => d.reviewId),
        finalized,
      }));
  },

  skipPlaylistImportReview(
    importId: string,
    tracks?: Track[],
    title?: string,
    description?: string,
  ): Promise<{ denied: "all"; finalized: boolean }> {
    return getLocalImportHandler()
      .finalize(importId, tracks ?? [], title, description)
      .then(({ finalized }) => ({ denied: "all" as const, finalized }));
  },

  async searchLyrics(
    hint: { title: string; artist: string; durationMs?: number },
    signal?: AbortSignal,
  ): Promise<LyricsSearchResult | null> {
    const params = new URLSearchParams({
      title: hint.title.trim(),
      artist: hint.artist.trim(),
      ...(hint.durationMs && hint.durationMs > 0
        ? { durationMs: String(Math.round(hint.durationMs)) }
        : {}),
    });
    try {
      return await request<LyricsSearchResult>(
        `/v1/me/lyrics/search?${params.toString()}`,
        { signal },
      );
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 404 &&
        err.code === "LYRICS_NOT_FOUND"
      ) {
        return null;
      }
      throw err;
    }
  },

  async *streamLyrics(
    id: string,
    signal?: AbortSignal,
    hint?: { title: string; artist: string; durationMs?: number },
  ): AsyncGenerator<LyricsStreamEvent> {
    const hintParams =
      hint?.title.trim() && hint.artist.trim()
        ? new URLSearchParams({
            title: hint.title.trim(),
            artist: hint.artist.trim(),
            ...(hint.durationMs && hint.durationMs > 0
              ? { durationMs: String(Math.round(hint.durationMs)) }
              : {}),
          }).toString()
        : "";
    const path = `/v1/tracks/${encodeURIComponent(id)}/lyrics${hintParams ? `?${hintParams}` : ""}`;
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

    let res: Response;
    const connect = new AbortController();
    const connectTimer = setTimeout(
      () => connect.abort(),
      LYRICS_CONNECT_TIMEOUT_MS,
    );
    try {
      res = await fetch(`${getApiBaseUrl()}${path}`, {
        signal: signal
          ? AbortSignal.any([signal, connect.signal])
          : connect.signal,
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...correlationHeaders,
          ...signedHeaders,
        },
      });
    } catch (fetchErr: any) {
      if (signal?.aborted) throw fetchErr;
      if (connect.signal.aborted)
        throw new ApiError(0, "Lyrics request timed out.", "TIMEOUT_ERROR");
      throw fetchErr;
    } finally {
      clearTimeout(connectTimer);
    }

    const lyricsDateHeader = res.headers?.get?.("date");
    if (lyricsDateHeader) {
      syncServerTime(lyricsDateHeader);
    }

    if (!res.ok || !res.body) {
      const respReqId = res.headers?.get?.("x-request-id") || requestId;
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

  getPopularAlbums(
    window: PopularTimeWindow = "7d",
    limit = 20,
  ): Promise<PopularAlbumsResponse> {
    const params = new URLSearchParams({ window, limit: String(limit) });
    return request<PopularAlbumsResponse>(
      `/v1/explore/popular/albums?${params}`,
    );
  },

  getMostSaved(
    type: MostSavedType = "all",
    limit = 20,
  ): Promise<MostSavedResponse> {
    const params = new URLSearchParams({ type, limit: String(limit) });
    return request<MostSavedResponse>(`/v1/explore/most-saved?${params}`);
  },

  getDailyMixes(): Promise<DailyMixesResponse> {
    return request<DailyMixesResponse>("/v1/me/recommendations/daily-mixes");
  },
};

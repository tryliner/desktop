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
import type { DailyMixesResponse, Track } from "@/shared/contracts";
import { telemetry } from "@/shared/telemetry";
import { toApiTrack } from "./apiTrack";

import { isLocalTrackId } from "@/shared/media/local";
import { showToast } from "@/shared/ui/Toast";
import { createTranslatorSync, getStoredLocale } from "@/languages";
import {
  isConnectivityFailure,
  isPlaybackPath,
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

import { getApiBaseUrl } from "./baseUrl";

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

  let res: Response;
  try {
    res = await fetchWithTimeout(
      getApiBaseUrl() + path,
      {
        ...init,
        headers: {
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
    telemetry.trackNetwork(method, path, 0, durationMs);
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
      const requestId = res.headers?.get?.("x-request-id") ?? undefined;
      telemetry.trackNetwork(method, path, res.status, durationMs, requestId);
      const body = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const code = typeof body?.code === "string" ? body.code : undefined;
      const message =
        typeof body?.message === "string" ? body.message : "Unauthorized";
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
      telemetry.trackNetwork(method, path, 0, durationMs);
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
  const requestId = res.headers?.get?.("x-request-id") ?? undefined;
  telemetry.trackNetwork(method, path, res.status, durationMs, requestId);
  onResponse?.(res);
  if (res.status === 304) return undefined as unknown as T;

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (res.status >= 500) {
      showToast(translate("common.error_server_title"), "error", {
        id: `server-error-${res.status}`,
        description: translate("common.error_server"),
        requestId,
      });
    }

    const apiErr = new ApiError(
      res.status,
      typeof body.message === "string" ? body.message : res.statusText,
      typeof body.code === "string" ? body.code : undefined,
      requestId,
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
  | ({ notModified: false; etag?: string } & UserPlaylistDetails);

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

// ---- Types (src/shared/contracts, based on the generated api contract) ----

export type {
  SearchType,
  Cover,
  ApiCover,
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
  UserPlaylist as ApiUserPlaylist,
  UserPlaylistItem as ApiUserPlaylistItem,
  UserPlaylistDetails as ApiUserPlaylistDetails,
  LikedTracksPage as ApiLikedTracksPage,
  LyricsSyncLevel,
  LyricsCandidate,
  LyricsStreamEvent,
  ImportReview,
  ImportReviewDecision,
  ImportJob,
  PublicUser,
  AuthTokens,
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
  AddItemsResult,
  AlbumDetails,
  ApiBody,
  ArtistDetails,
  ArtistSnapshotInput,
  CatalogPlaylistDetails,
  CollectionSnapshotInput,
  ImportJob,
  ImportReview,
  ImportReviewDecision,
  LikedTracksPage,
  LyricsSearchResult,
  LyricsStreamEvent,
  MostSavedResponse,
  MostSavedType,
  PlaybackHistoryResponse,
  PopularAlbumsResponse,
  PopularTimeWindow,
  PopularTracksResponse,
  RadioResponse,
  RecordPlaybackEventRequest,
  SavedArtists,
  SavedCollections,
  SearchResponse,
  SearchType,
  TrackDetails,
  UserPlaylist,
  UserPlaylistDetails,
} from "../contracts";

// ---- Endpoints --------------------------------------------------------------

type CollectionKind = "albums" | "artists" | "playlists";

// POST /v1/playlists/:id/items: 1-5000 tracks (or `{ id }`) appended in order,
// all or nothing; the answer carries the playlist after the append
function addItems(
  playlistId: string,
  tracks: ApiBody<"POST /v1/playlists/:playlistId/items">["tracks"],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<AddItemsResult> {
  const body: ApiBody<"POST /v1/playlists/:playlistId/items"> = { tracks };
  return request<AddItemsResult>(
    `/v1/playlists/${encodeURIComponent(playlistId)}/items`,
    { method: "POST", body: JSON.stringify(body) },
    true,
    timeoutMs,
  );
}

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

  search(q: string, type: SearchType = "all"): Promise<SearchResponse> {
    const params = new URLSearchParams({ q, type });
    return clientCatalog.search(q, type, () =>
      request<SearchResponse>(`/v1/catalog/search?${params}`),
    );
  },

  getTrack(id: string): Promise<TrackDetails> {
    return clientCatalog.getTrack(id, () =>
      request<TrackDetails>(`/v1/catalog/tracks/${encodeURIComponent(id)}`),
    );
  },

  getRadio(
    id: string,
    options?: { history?: string[]; k?: number },
  ): Promise<RadioResponse> {
    const history = new Set(options?.history ?? []);
    return clientCatalog.getRadio(id, options?.k).then((response) => ({
      items: response.items.filter((item) => !history.has(item.id)),
    }));
  },

  getAlbum(id: string): Promise<AlbumDetails> {
    return clientCatalog.getAlbum(id, () =>
      request<AlbumDetails>(`/v1/catalog/albums/${encodeURIComponent(id)}`),
    );
  },

  getArtistImage(id: string): Promise<string | undefined> {
    return clientCatalog.getArtistImage(id);
  },

  getArtist(id: string): Promise<ArtistDetails> {
    return clientCatalog.getArtist(id, () =>
      request<ArtistDetails>(`/v1/catalog/artists/${encodeURIComponent(id)}`),
    );
  },

  getPlaylist(id: string): Promise<CatalogPlaylistDetails> {
    return clientCatalog.getPlaylist(id, () =>
      request<CatalogPlaylistDetails>(
        `/v1/catalog/playlists/${encodeURIComponent(id)}`,
      ),
    );
  },

  listLikedTracks(limit = 100, cursor?: string): Promise<LikedTracksPage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return request<LikedTracksPage>(`/v1/me/likes?${params}`);
  },

  // without a usable track the server falls back to its own catalog, and
  // answers 404 TRACK_UNKNOWN when it has never seen the id either
  async likeTrack(id: string): Promise<void> {
    if (isLocalTrackId(id)) throw new Error("Local tracks stay on this device");
    const track = toApiTrack(await clientCatalog.resolveSnapshot(id));
    const body: ApiBody<"PUT /v1/me/likes/:trackId"> = track ? { track } : null;
    return request<void>(`/v1/me/likes/${encodeURIComponent(id)}`, {
      method: "PUT",
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  },

  unlikeTrack(id: string): Promise<void> {
    return request<void>(`/v1/me/likes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  listSavedCollections<T extends CollectionKind>(
    type: T,
  ): Promise<T extends "artists" ? SavedArtists : SavedCollections> {
    return request(`/v1/me/saved/${type}`);
  },

  // the server can't look a collection up by id: the snapshot is what the
  // library tile shows (an artist has a name, albums and playlists a title)
  saveCollection<T extends CollectionKind>(
    type: T,
    id: string,
    snapshot: T extends "artists"
      ? ArtistSnapshotInput
      : CollectionSnapshotInput,
  ): Promise<void> {
    return request<void>(`/v1/me/saved/${type}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ snapshot }),
    });
  },

  removeCollection(
    type: "albums" | "artists" | "playlists",
    id: string,
  ): Promise<void> {
    return request<void>(`/v1/me/saved/${type}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  listPlaylists(): Promise<{ items: UserPlaylist[] }> {
    return request<{ items: UserPlaylist[] }>("/v1/me/playlists");
  },

  // the owner's view (the token is always sent): a page of `limit` items (no
  // etag), or the whole playlist with an etag the next read can send back for
  // a 304. A stale token is a 401, refreshed and retried like everywhere
  async readUserPlaylist(
    id: string,
    options: { limit?: number; etag?: string } = {},
  ): Promise<UserPlaylistRead> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", String(options.limit));
    const query = params.size > 0 ? `?${params}` : "";
    let status = 200;
    let etag: string | undefined;
    const body = await executeRequest<UserPlaylistDetails | undefined>(
      `/v1/playlists/${encodeURIComponent(id)}${query}`,
      options.etag ? { headers: { "If-None-Match": options.etag } } : undefined,
      true,
      DEFAULT_TIMEOUT_MS,
      (res) => {
        status = res.status;
        etag = res.headers?.get?.("etag") ?? undefined;
      },
    );
    if (status === 304 || !body) return { notModified: true };
    return { notModified: false, etag, ...body };
  },

  // a public user playlist, or one the viewer owns: the same url as
  // readUserPlaylist, the token makes the owner's own link open their view
  getSharedPlaylist(id: string): Promise<UserPlaylistDetails> {
    return request<UserPlaylistDetails>(
      `/v1/playlists/${encodeURIComponent(id)}`,
    );
  },

  createPlaylist(
    input: ApiBody<"POST /v1/me/playlists">,
  ): Promise<UserPlaylist> {
    return request<UserPlaylist>("/v1/me/playlists", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updatePlaylist(
    id: string,
    input: ApiBody<"PATCH /v1/playlists/:playlistId">,
  ): Promise<UserPlaylist> {
    return request<UserPlaylist>(`/v1/playlists/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deletePlaylist(id: string): Promise<void> {
    return request<void>(`/v1/playlists/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // a list of one: the track as the client catalog knows it, or `{ id }` for
  // the server catalog's metadata. Already in the playlist is
  // `duplicates: 1`, a track nobody knows `rejected: 1` (both answer 200)
  async addPlaylistTrack(
    playlistId: string,
    trackId: string,
  ): Promise<AddItemsResult> {
    if (isLocalTrackId(trackId))
      throw new Error("Local tracks stay on this device");
    const track = toApiTrack(await clientCatalog.resolveSnapshot(trackId));
    return addItems(playlistId, [track ?? { id: trackId }]);
  },

  // added + duplicates + rejected = tracks.length; unusable tracks are counted
  // as rejected instead of failing the whole import
  addPlaylistTrackSnapshots(
    playlistId: string,
    tracks: Track[],
  ): Promise<AddItemsResult> {
    return addItems(
      playlistId,
      tracks.map((track) => toApiTrack(track) ?? track),
      60_000,
    );
  },

  // an item that is already gone (removed elsewhere) is 404 ITEM_NOT_FOUND:
  // what the caller wanted, so it counts as removed
  async removePlaylistItem(playlistId: string, itemId: string): Promise<void> {
    try {
      await request<void>(
        `/v1/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(itemId)}`,
        { method: "DELETE" },
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "ITEM_NOT_FOUND") return;
      throw err;
    }
  },

  movePlaylistItem(
    playlistId: string,
    itemId: string,
    beforeItemId: string | null,
    revision: number,
  ): Promise<UserPlaylist> {
    const body: ApiBody<"POST /v1/playlists/:playlistId/items/:itemId/move"> = {
      beforeItemId,
      revision,
    };
    return request<UserPlaylist>(
      `/v1/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(itemId)}/move`,
      { method: "POST", body: JSON.stringify(body) },
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
      if (err instanceof ApiError && err.status === 404) return null;
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

    let res: Response;
    try {
      res = await fetch(`${getApiBaseUrl()}${path}`, {
        signal,
        headers: {
          // a known instrumental comes back as plain json instead of a stream
          Accept: "application/json, text/event-stream",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...signedHeaders,
        },
      });
    } catch (fetchErr: any) {
      if (signal?.aborted || fetchErr?.name === "AbortError") {
        throw fetchErr;
      }
      throw fetchErr;
    }

    const lyricsDateHeader = res.headers?.get?.("date");
    if (lyricsDateHeader) {
      syncServerTime(lyricsDateHeader);
    }

    if (!res.ok || !res.body) {
      const respReqId = res.headers?.get?.("x-request-id") ?? undefined;
      throw new ApiError(res.status, res.statusText, undefined, respReqId);
    }

    if (res.headers.get("content-type")?.includes("application/json")) {
      const body = (await res.json()) as { instrumental?: boolean };
      yield body.instrumental
        ? {
            type: "done",
            cached: true,
            status: "not_found",
            instrumental: true,
          }
        : { type: "done", cached: true, status: "not_found" };
      return;
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
    return request<void>("/v1/me/history", {
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
    return request<PopularTracksResponse>(`/v1/charts/tracks?${params}`);
  },

  getPopularAlbums(
    window: PopularTimeWindow = "7d",
    limit = 20,
  ): Promise<PopularAlbumsResponse> {
    const params = new URLSearchParams({ window, limit: String(limit) });
    return request<PopularAlbumsResponse>(`/v1/charts/albums?${params}`);
  },

  getMostSaved(
    type: MostSavedType = "all",
    limit = 20,
  ): Promise<MostSavedResponse> {
    const params = new URLSearchParams({ type, limit: String(limit) });
    return request<MostSavedResponse>(`/v1/charts/saved?${params}`);
  },

  getDailyMixes(): Promise<DailyMixesResponse> {
    return request<DailyMixesResponse>("/v1/me/mixes");
  },
};

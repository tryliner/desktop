// generated from the api's route schemas, do not edit. Run: pnpm contract:export <desktop>/src/shared/contracts/api.generated.ts (in tryliner/api)
/* eslint-disable */

export type AddItemsResult = {
  added: number;
  duplicates: number;
  rejected: number;
  playlist: Playlist;
};

export type ArtistSnapshot = {
  name: string;
  cover?: Cover;
};

export type ArtistSnapshotInput = {
  name: string;
  cover?: {
    url: string;
    width?: number | null;
    height?: number | null;
  };
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  /** ISO 8601 time */
  accessTokenExpiresAt: string;
  user: AuthUser;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type BundleManifest = {
  bundleVersion: string;
  minAppVersion: string;
  downloadUrl: string;
  sha256: string;
  size: number;
  signature: string;
  /** ISO 8601 time */
  releasedAt: string;
  releaseNotes?: string;
};

export type CatalogAlbumDetails = {
  type: "album";
  id: string;
  title: string;
  artists: {
    id: string | null;
    name: string;
  }[];
  year?: number;
  cover?: Cover;
  trackCount?: number;
  tracks: Track[];
};

export type CatalogArtistDetails = {
  type: "artist";
  id: string;
  name: string;
  cover?: Cover;
  monthlyListeners?: string;
  verified: boolean;
  tracks: Track[];
  albums: {
    id: string;
    title: string;
    year?: number;
    cover?: Cover;
    explicit?: boolean;
  }[];
  singles: {
    id: string;
    title: string;
    year?: number;
    cover?: Cover;
    explicit?: boolean;
    releaseType: "single" | "ep";
  }[];
};

export type CatalogPlaylistDetails = {
  type: "playlist";
  id: string;
  title: string;
  author?: string;
  description?: string;
  year?: number;
  cover?: Cover;
  trackCount?: number;
  tracks: Track[];
};

export type CatalogSearchItem = {
  type: "track";
  /** youtube video id or sc:<soundcloud id> */
  id: string;
  title: string;
  artists: {
    id: string | null;
    name: string;
  }[];
  durationMs: number | null;
  album?: {
    id: string;
    title: string;
  };
  cover?: Cover;
  explicit?: boolean;
} | {
  type: "artist";
  id: string;
  name: string;
  cover?: Cover;
} | {
  type: "album";
  id: string;
  title: string;
  artists: {
    id: string | null;
    name: string;
  }[];
  year?: number;
  cover?: Cover;
} | {
  type: "playlist";
  id: string;
  title: string;
  author?: string;
  cover?: Cover;
};

export type CatalogSearchResponse = {
  items: CatalogSearchItem[];
};

export type CatalogTrackDetails = {
  /** youtube video id or sc:<soundcloud id> */
  id: string;
  title: string;
  artists: {
    id: string | null;
    name: string;
  }[];
  durationMs: number | null;
  album?: {
    id: string;
    title: string;
  };
  cover?: Cover;
  explicit?: boolean;
  /** release year, e.g. 2021 */
  releaseDate?: string;
};

export type ClientPlan = {
  source: "client";
  reason: ClientReason;
  ingest: IngestState | null;
  retryAfterSeconds: number | null;
};

export type ClientReason = "unsupported_provider" | "not_cached" | "budget_exhausted" | "daily_cap" | "ip_cap" | "unavailable";

export type CollectionKind = "album" | "playlist";

export type CollectionSnapshot = {
  title: string;
  author?: string;
  cover?: Cover;
  trackCount?: number;
};

export type CollectionSnapshotInput = {
  title: string;
  author?: string;
  cover?: {
    url: string;
    width?: number | null;
    height?: number | null;
  };
  trackCount?: number;
};

export type Cover = {
  url: string;
  width: number | null;
  height: number | null;
};

export type DailyMix = {
  id: string;
  title: string;
  clusterArtists: string[];
  tracks: Track[];
};

export type DailyMixes = {
  items: DailyMix[];
};

export type ErrorResponse = {
  statusCode: number;
  /** standard status phrase, e.g. Not Found */
  error: string;
  /** stable UPPER_SNAKE code */
  code: string;
  message: string;
  /** only on 429 */
  retryAfterSeconds?: number;
};

export type HealthResponse = {
  status: "ok";
  service: "data-service";
  instance: string;
  /** ISO 8601 time */
  timestamp: string;
};

export type HistoryEntry = {
  bundleVersion: string;
  minAppVersion: string;
  downloadUrl: string;
  sha256: string;
  size: number;
  signature: string;
  /** ISO 8601 time */
  releasedAt: string;
  releaseNotes?: string;
  rollout: number;
  event: "publish" | "rollback";
  /** ISO 8601 time */
  at: string;
};

export type HistoryItem = {
  id: string;
  playbackSessionId: string;
  listeningSessionId: string;
  track: Track;
  playedDurationMs: number;
  completionRate: number;
  completed: boolean;
  skipped: boolean;
  loopCount: number;
  hasSeekBackward: boolean;
  context: PlaybackContext | null;
  /** ISO 8601 time */
  listenedAt: string;
};

export type HistoryPage = {
  items: HistoryItem[];
  nextCursor: string | null;
};

export type HistoryResponse = {
  items: HistoryEntry[];
};

export type IngestState = "queued" | "waiting_demand" | "unfindable" | "skipped";

export type LikedTrack = {
  track: Track;
  /** ISO 8601 time */
  likedAt: string;
};

export type LikedTracksPage = {
  items: LikedTrack[];
  nextCursor: string | null;
};

export type MostSaved = {
  items: MostSavedItem[];
};

export type MostSavedItem = {
  type: CollectionKind;
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  saves: number;
};

export type PlaybackContext = {
  type: string;
  id?: string;
};

export type PlaybackPlan = R2Plan | ClientPlan;

export type Playlist = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  revision: number;
  trackCount: number;
  durationMs: number;
  coverUrls: string[];
  /** ISO 8601 time */
  createdAt: string;
  /** ISO 8601 time */
  updatedAt: string;
};

export type PlaylistDetails = {
  playlist: Playlist;
  owner: PlaylistOwner;
  items: PlaylistItem[];
  nextCursor: string | null;
};

export type PlaylistItem = {
  id: string;
  track: Track;
  /** ISO 8601 time */
  addedAt: string;
};

export type PlaylistList = {
  items: Playlist[];
};

export type PlaylistOwner = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type PopularAlbum = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  year?: number;
  playCount: number;
  uniqueListeners: number;
  trackCount: number;
};

export type PopularAlbums = {
  /** how far back plays are counted */
  window: PopularWindow;
  items: PopularAlbum[];
};

export type PopularTrack = {
  track: Track;
  playCount: number;
  uniqueListeners: number;
};

export type PopularTracks = {
  /** how far back plays are counted */
  window: PopularWindow;
  items: PopularTrack[];
};

export type PopularWindow = "12h" | "24h" | "7d" | "30d" | "all";

export type R2Plan = {
  source: "r2";
  url: string;
  /** ISO 8601 time */
  expiresAt: string;
  mimeType: string;
  codec: string | null;
  size: number;
};

export type Release = {
  bundleVersion: string;
  minAppVersion: string;
  downloadUrl: string;
  sha256: string;
  size: number;
  signature: string;
  /** ISO 8601 time */
  releasedAt: string;
  releaseNotes?: string;
  rollout: number;
};

export type ReleaseResponse = {
  release: Release | null;
};

export type RemoveAmbientResponse = {
  removed: number;
};

export type RolloutState = {
  latest: {
    bundleVersion: string;
    rollout: number;
  } | null;
  stable: {
    bundleVersion: string;
  } | null;
};

export type SaveAmbientResponse = {
  version: string;
  trackIds: string[];
};

export type SavedArtist = {
  id: string;
  snapshot: ArtistSnapshot | null;
  /** ISO 8601 time */
  savedAt: string;
};

export type SavedArtists = {
  items: SavedArtist[];
};

export type SavedCollection = {
  id: string;
  snapshot: CollectionSnapshot | null;
  /** ISO 8601 time */
  savedAt: string;
};

export type SavedCollections = {
  items: SavedCollection[];
};

export type SavedType = "all" | "album" | "playlist";

export type Track = {
  /** youtube video id or sc:<soundcloud id> */
  id: string;
  title: string;
  artists: {
    id: string | null;
    name: string;
  }[];
  durationMs: number | null;
  album?: {
    id: string;
    title: string;
  };
  cover?: Cover;
  explicit?: boolean;
};

export type UpdaterHealth = {
  status: "ok";
};

/**
 * Every route of the api by `METHOD url` as fastify registers it. The link host is served
 * under /link and the updates host under /updater (platform/http/hosts.ts rewrites the path).
 * `never` means the route takes no such input; responses are keyed by status code.
 */
export interface ApiRoutes {
  "GET /health": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: HealthResponse;
      500: ErrorResponse;
    };
  };
  "POST /v1/auth/register": {
    params: never;
    query: never;
    body: {
      email: string;
      password: string;
      username: string;
      displayName: string;
    };
    responses: {
      201: AuthTokens;
      400: ErrorResponse;
      403: ErrorResponse;
      409: ErrorResponse;
      429: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "POST /v1/auth/login": {
    params: never;
    query: never;
    body: {
      email: string;
      password: string;
    };
    responses: {
      200: AuthTokens;
      400: ErrorResponse;
      401: ErrorResponse;
      429: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "POST /v1/auth/refresh": {
    params: never;
    query: never;
    body: {
      refreshToken: string;
    };
    responses: {
      200: AuthTokens;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "POST /v1/auth/logout": {
    params: never;
    query: never;
    body: {
      refreshToken: string;
    };
    responses: {
      204: null;
      400: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/me": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: AuthUser;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/me/playlists": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: PlaylistList;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "POST /v1/me/playlists": {
    params: never;
    query: never;
    body: {
      title: string;
      description?: string | null;
      isPublic?: boolean;
    };
    responses: {
      201: Playlist;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/playlists/:playlistId": {
    params: {
      playlistId: string;
    };
    query: {
      cursor?: string;
      /** default: the whole playlist */
      limit?: number;
    };
    body: never;
    responses: {
      200: PlaylistDetails;
      304: null;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "PATCH /v1/playlists/:playlistId": {
    params: {
      playlistId: string;
    };
    query: never;
    body: {
      title?: string;
      description?: string | null;
      isPublic?: boolean;
    };
    responses: {
      200: Playlist;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "DELETE /v1/playlists/:playlistId": {
    params: {
      playlistId: string;
    };
    query: never;
    body: never;
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "POST /v1/playlists/:playlistId/items": {
    params: {
      playlistId: string;
    };
    query: never;
    body: {
      tracks: unknown[];
    };
    responses: {
      200: AddItemsResult;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      413: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "DELETE /v1/playlists/:playlistId/items/:itemId": {
    params: {
      playlistId: string;
      itemId: string;
    };
    query: never;
    body: never;
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "POST /v1/playlists/:playlistId/items/:itemId/move": {
    params: {
      playlistId: string;
      itemId: string;
    };
    query: never;
    body: {
      beforeItemId?: string | null;
      revision: number;
    };
    responses: {
      200: Playlist;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      409: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/me/likes": {
    params: never;
    query: {
      cursor?: string;
      /** default 30 */
      limit?: number;
    };
    body: never;
    responses: {
      200: LikedTracksPage;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "PUT /v1/me/likes/:trackId": {
    params: {
      /** youtube video id or sc:<soundcloud id> */
      trackId: string;
    };
    query: never;
    body: {
      track?: Track;
    } | null;
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "DELETE /v1/me/likes/:trackId": {
    params: {
      /** youtube video id or sc:<soundcloud id> */
      trackId: string;
    };
    query: never;
    body: never;
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/me/saved/albums": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: SavedCollections;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "PUT /v1/me/saved/albums/:albumId": {
    params: {
      albumId: string;
    };
    query: never;
    body: {
      snapshot: CollectionSnapshotInput;
    };
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "DELETE /v1/me/saved/albums/:albumId": {
    params: {
      albumId: string;
    };
    query: never;
    body: never;
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/me/saved/artists": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: SavedArtists;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "PUT /v1/me/saved/artists/:artistId": {
    params: {
      artistId: string;
    };
    query: never;
    body: {
      snapshot: ArtistSnapshotInput;
    };
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "DELETE /v1/me/saved/artists/:artistId": {
    params: {
      artistId: string;
    };
    query: never;
    body: never;
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/me/saved/playlists": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: SavedCollections;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "PUT /v1/me/saved/playlists/:playlistId": {
    params: {
      playlistId: string;
    };
    query: never;
    body: {
      snapshot: CollectionSnapshotInput;
    };
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "DELETE /v1/me/saved/playlists/:playlistId": {
    params: {
      playlistId: string;
    };
    query: never;
    body: never;
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/me/history": {
    params: never;
    query: {
      cursor?: string;
      /** default 30 */
      limit?: number;
    };
    body: never;
    responses: {
      200: HistoryPage;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "POST /v1/me/history": {
    params: never;
    query: never;
    body: {
      playbackSessionId: string;
      listeningSessionId: string;
      /** youtube video id or sc:<soundcloud id> */
      trackId: string;
      /** a Track; sanitized, unknown fields dropped */
      track?: unknown;
      playedDurationMs: number;
      trackDurationMs?: number;
      completionRate: number;
      completed?: boolean;
      skipped?: boolean;
      loopCount?: number;
      hasSeekBackward?: boolean;
      context?: PlaybackContext;
    };
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/charts/tracks": {
    params: never;
    query: {
      /** how far back plays are counted */
      window?: PopularWindow;
      /** default 50 */
      limit?: number;
    };
    body: never;
    responses: {
      200: PopularTracks;
      400: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/charts/albums": {
    params: never;
    query: {
      /** how far back plays are counted */
      window?: PopularWindow;
      /** default 50 */
      limit?: number;
    };
    body: never;
    responses: {
      200: PopularAlbums;
      400: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/charts/saved": {
    params: never;
    query: {
      /** which saved collections are counted, default all */
      type?: SavedType;
      /** default 50 */
      limit?: number;
    };
    body: never;
    responses: {
      200: MostSaved;
      400: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "POST /v1/tracks/:trackId/playback": {
    params: {
      /** youtube video id or sc:<soundcloud id> */
      trackId: string;
    };
    query: never;
    body: never;
    responses: {
      200: PlaybackPlan;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/catalog/search": {
    params: never;
    query: {
      q: string;
      type?: "all" | "track" | "artist" | "album" | "playlist";
    };
    body: never;
    responses: {
      200: CatalogSearchResponse;
      400: ErrorResponse;
      401: ErrorResponse;
      429: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "GET /v1/catalog/artists/:id": {
    params: {
      id: string;
    };
    query: never;
    body: never;
    responses: {
      200: CatalogArtistDetails;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      429: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "GET /v1/catalog/albums/:id": {
    params: {
      id: string;
    };
    query: never;
    body: never;
    responses: {
      200: CatalogAlbumDetails;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      429: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "GET /v1/catalog/playlists/:id": {
    params: {
      id: string;
    };
    query: never;
    body: never;
    responses: {
      200: CatalogPlaylistDetails;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      429: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "GET /v1/catalog/tracks/:id": {
    params: {
      id: string;
    };
    query: never;
    body: never;
    responses: {
      200: CatalogTrackDetails;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      429: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "POST /v1/me/presence": {
    params: never;
    query: never;
    body: {
      platform?: string;
      clientVersion?: string;
    };
    responses: {
      204: null;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/tracks/:trackId/ambient": {
    params: {
      /** youtube video id or sc:<soundcloud id> */
      trackId: string;
    };
    query: never;
    body: never;
    responses: {
      200: string;
      304: null;
      400: ErrorResponse;
      404: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "PUT /v1/admin/ambient": {
    params: never;
    query: never;
    body: {
      trackIds: string[];
      script: string;
    };
    responses: {
      200: SaveAmbientResponse;
      400: ErrorResponse;
      401: ErrorResponse;
      413: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "DELETE /v1/admin/ambient": {
    params: never;
    query: never;
    body: {
      trackIds: string[];
    };
    responses: {
      200: RemoveAmbientResponse;
      400: ErrorResponse;
      401: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "GET /v1/me/mixes": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: DailyMixes;
      401: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /v1/tracks/:id/lyrics": {
    params: {
      /** youtube video id or sc:<soundcloud id> */
      id: string;
    };
    query: {
      title?: string;
      artist?: string;
      duration?: string;
      durationMs?: string;
    };
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/tracks/:id/lyrics/resolve": {
    params: {
      /** youtube video id or sc:<soundcloud id> */
      id: string;
    };
    query: {
      title?: string;
      artist?: string;
      duration?: string;
      durationMs?: string;
    };
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/me/lyrics/search": {
    params: never;
    query: {
      title?: string;
      artist?: string;
      durationMs?: string;
    };
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/lyrics/search": {
    params: never;
    query: {
      q?: string;
      source?: string;
      title?: string;
      artist?: string;
      album?: string;
      hasWordLevel?: string;
      limit?: string;
      offset?: string;
      page?: string;
    };
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/lyrics/match": {
    params: never;
    query: {
      title?: string;
      artist?: string;
      source?: string;
    };
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/lyrics/:id": {
    params: {
      id: string;
    };
    query: {
      source?: string;
    };
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/lyrics/:id/ttml": {
    params: {
      id: string;
    };
    query: {
      source?: string;
    };
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/:source/lyrics/search": {
    params: {
      source: string;
    };
    query: {
      q?: string;
      title?: string;
      artist?: string;
      album?: string;
      limit?: string;
      offset?: string;
    };
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/:source/lyrics/:id": {
    params: {
      source: string;
      id: string;
    };
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "POST /v1/admin/lyrics": {
    params: never;
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "POST /v1/admin/lyrics/batch": {
    params: never;
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/admin/lyrics": {
    params: never;
    query: {
      source?: string;
      q?: string;
      page?: string;
      limit?: string;
    };
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/admin/lyrics/:id": {
    params: {
      id: string;
    };
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "DELETE /v1/admin/lyrics/:id": {
    params: {
      id: string;
    };
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "POST /v1/admin/lyrics/delete-batch": {
    params: never;
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "POST /v1/admin/api-keys": {
    params: never;
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/stats": {
    params: never;
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /v1/admin/api-keys": {
    params: never;
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "DELETE /v1/admin/api-keys/:id": {
    params: {
      id: string;
    };
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "POST /v1/admin/api-keys/:id/reset": {
    params: {
      id: string;
    };
    query: never;
    body: never;
    responses: Record<number, unknown>;
  };
  "GET /link": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: string;
    };
  };
  "GET /link/health": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: UpdaterHealth;
    };
  };
  "GET /link/artist": {
    params: never;
    query: {
      id: string;
    };
    body: never;
    responses: {
      200: string;
      400: string;
      404: string;
      414: string;
      500: string;
    };
  };
  "GET /link/album": {
    params: never;
    query: {
      id: string;
    };
    body: never;
    responses: {
      200: string;
      400: string;
      404: string;
      414: string;
      500: string;
    };
  };
  "GET /link/playlist": {
    params: never;
    query: {
      id: string;
    };
    body: never;
    responses: {
      200: string;
      400: string;
      404: string;
      414: string;
      500: string;
    };
  };
  "GET /link/track": {
    params: never;
    query: {
      /** youtube video id or sc:<soundcloud id> */
      id: string;
    };
    body: never;
    responses: {
      200: string;
      400: string;
      404: string;
      414: string;
      500: string;
    };
  };
  "GET /updater/health": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: UpdaterHealth;
      500: ErrorResponse;
    };
  };
  "GET /updater/updates/manifest.json": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: BundleManifest;
      404: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "GET /updater/updates/bundles/:file": {
    params: {
      file: string;
    };
    query: never;
    body: never;
    responses: {
      200: string;
      206: string;
      400: ErrorResponse;
      404: ErrorResponse;
      416: ErrorResponse;
      500: ErrorResponse;
    };
  };
  "POST /updater/api/publish": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: ReleaseResponse;
      400: ErrorResponse;
      401: ErrorResponse;
      409: ErrorResponse;
      413: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "GET /updater/api/history": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: HistoryResponse;
      401: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "GET /updater/api/rollout": {
    params: never;
    query: never;
    body: never;
    responses: {
      200: RolloutState;
      401: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "POST /updater/api/rollout": {
    params: never;
    query: never;
    body: {
      percent: number;
    };
    responses: {
      200: RolloutState;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
  "POST /updater/api/rollback": {
    params: never;
    query: never;
    body: {
      version?: string;
      clear?: true;
    };
    responses: {
      200: ReleaseResponse;
      400: ErrorResponse;
      401: ErrorResponse;
      404: ErrorResponse;
      409: ErrorResponse;
      500: ErrorResponse;
      503: ErrorResponse;
    };
  };
}

/** `METHOD url` of a route. */
export type ApiRoute = keyof ApiRoutes;
/** Path parameters of a route. */
export type ApiParams<R extends ApiRoute> = ApiRoutes[R]["params"];
/** Query of a route. */
export type ApiQuery<R extends ApiRoute> = ApiRoutes[R]["query"];
/** Body of a route. */
export type ApiBody<R extends ApiRoute> = ApiRoutes[R]["body"];
/** The answer of a route for one status (200 by default). */
export type ApiResponse<
  R extends ApiRoute,
  S extends keyof ApiRoutes[R]["responses"] = 200 & keyof ApiRoutes[R]["responses"],
> = ApiRoutes[R]["responses"][S];

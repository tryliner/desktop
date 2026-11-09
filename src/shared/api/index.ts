export {
  api,
  mediaUrl,
  toMaxQualityAvatarUrl,
  ApiError,
  planLimitMessage,
  planLimitOf,
  resolveApiErrorMessage,
} from "./api";
export { DEFAULT_PRIMARY_API, getApiBaseUrl } from "./baseUrl";
export { initEdgeKey } from "./edgeKey";
export {
  HumanCheckCancelledError,
  humanCheckOrigin,
  humanCheckPageUrl,
  setHumanCheckPrompt,
  type HumanCheckAction,
  type HumanCheckMode,
  type HumanCheckRequest,
} from "./humanCheck";
export type {
  SearchType,
  ApiCover,
  ApiTrack,
  ApiArtist,
  ApiAlbum,
  ApiPlaylist,
  ApiSearchItem,
  SearchResponse,
  ApiTrackDetails,
  ApiRadioTrack,
  RadioResponse,
  ApiAlbumDetails,
  ApiArtistAlbum,
  ApiArtistRelease,
  ApiArtistDetails,
  ApiCatalogPlaylistDetails,
  ApiUserPlaylist,
  ApiUserPlaylistItem,
  ApiUserPlaylistDetails,
  ApiLikedTracksPage,
  LyricsSyncLevel,
  LyricsCandidate,
  LyricsStreamEvent,
  ImportJob,
  ImportReview,
  ImportReviewDecision,
  PlaybackContextType,
  PlaybackContext,
  RecordPlaybackEventRequest,
  PlaybackHistoryItem,
  PlaybackHistoryResponse,
  PopularTimeWindow,
  PopularTrackItem,
  PopularTracksResponse,
} from "./api";

export type { PublicUser } from "@/shared/contracts";

export {
  getAuthSession,
  setAuthSession,
  getSessionExpiryMs,
  refreshAuthSession,
  clearAuthSession,
  type AuthUser,
  type AuthTokens,
} from "./auth-session";

export { toClientTrack } from "./track";

export {
  registerLocalImportHandler,
  LOCAL_IMPORT_PREFIX,
  type LocalImportHandler,
} from "./localImports";
export { registerSignOutTask, runSignOutTasks } from "./signOutTasks";

export {
  api,
  mediaUrl,
  toMaxQualityAvatarUrl,
  ApiError,
  resolveApiErrorMessage,
} from "./api";
export { DEFAULT_PRIMARY_API, getApiBaseUrl } from "./baseUrl";
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

export type {
  PublicUser,
  UserProfile,
  UserPrivacySettings,
  UpdateProfileInput,
  LeaderboardEntry,
  LeaderboardResponse,
} from "@/shared/contracts";

export {
  getAuthSession,
  setAuthSession,
  getAccessToken,
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

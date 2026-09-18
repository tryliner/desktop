export { api, mediaUrl, toMaxQualityAvatarUrl, ApiError, resolveApiErrorMessage } from "./api";
export {
  DEFAULT_PRIMARY_API,
  FALLBACK_EDGE_API,
  getApiBaseUrl,
  setApiBaseUrl,
  switchToFallbackEdge,
  initApiEndpointProbe,
  resetEndpointProbe,
} from "./baseUrl";
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
  PlaybackSession,
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
  refreshAuthSession,
  clearAuthSession,
  type AuthUser,
  type AuthTokens,
} from "./auth-session";

export { toClientTrack } from "./track";

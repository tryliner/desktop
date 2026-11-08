import { authApi } from "./endpoints/auth";
import { catalogApi } from "./endpoints/catalog";
import { historyApi } from "./endpoints/history";
import { request } from "./http/request";
import type { EdgeKeyAnswer } from "./edgeKey";
import { importsApi } from "./endpoints/imports";
import { libraryApi } from "./endpoints/library";
import { lyricsApi } from "./endpoints/lyrics";
import { playlistsApi } from "./endpoints/playlists";

export {
  ApiError,
  planLimitMessage,
  planLimitOf,
  resolveApiErrorMessage,
} from "./apiError";
export { mediaUrl, toMaxQualityAvatarUrl } from "./media";
export { call, type CallOptions } from "./call";
export type { UserPlaylistRead } from "./endpoints/playlists";

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

export const api = {
  fetchEdgeKey(): Promise<EdgeKeyAnswer> {
    return request({ method: "GET", path: "/v1/edge/key" }) as Promise<EdgeKeyAnswer>;
  },
  ...authApi,
  ...catalogApi,
  ...libraryApi,
  ...playlistsApi,
  ...importsApi,
  ...lyricsApi,
  ...historyApi,
};

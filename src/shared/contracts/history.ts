import type { ApiBody } from "./api.generated";
import type { WireTrack } from "./track";

export type {
  PlaybackContext,
  HistoryItem as PlaybackHistoryItem,
  HistoryPage as PlaybackHistoryResponse,
  PopularWindow as PopularTimeWindow,
  PopularTrack as PopularTrackItem,
  PopularTracks as PopularTracksResponse,
  PopularAlbum as PopularAlbumEntry,
  PopularAlbums as PopularAlbumsResponse,
  SavedType as MostSavedType,
  MostSavedItem as MostSavedEntry,
  MostSaved as MostSavedResponse,
} from "./api.generated";

/** Where the client says a track was played from (`context.type`). */
export type PlaybackContextType =
  "album" | "playlist" | "radio" | "search" | "library" | "explore" | "direct";

/**
 * `POST /v1/me/playback/events`: the server types `track` loosely (it runs
 * it through its sanitizer), the client sends a Track.
 */
export type RecordPlaybackEventRequest = Omit<
  ApiBody<"POST /v1/me/playback/events">,
  "track"
> & { track?: WireTrack };

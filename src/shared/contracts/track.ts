import type {
  CatalogTrackDetails,
  Track as ApiTrackShape,
} from "./api.generated";
import type { Cover } from "./cover";

/** The api Track exactly as it goes over the wire (request bodies). */
export type WireTrack = ApiTrackShape;

/** A credited artist; `id` is null when the source gave none. */
export type TrackArtist = ApiTrackShape["artists"][number];

/** The album of a track, only when both its id and title are known. */
export type TrackAlbum = NonNullable<ApiTrackShape["album"]>;

export type TrackAudioVariant = "music-video" | "premium-only";

/**
 * A track as the app holds it: the api Track (`durationMs` null when unknown)
 * with what only the client catalogs add on top.
 */
export type Track = Omit<ApiTrackShape, "cover"> & {
  cover?: Cover;
  audioVariant?: TrackAudioVariant;
};

/** A track hit of a search (`type` is set on search hits only). */
export type ApiTrack = Track & { type?: "track" };

/** `GET /v1/catalog/tracks/:id` and the client catalogs' track page. */
export type TrackDetails = Track &
  Pick<CatalogTrackDetails, "releaseDate"> & { description?: string };

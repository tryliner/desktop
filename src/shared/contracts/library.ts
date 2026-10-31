import type { ApiBody } from "./api.generated";

export type {
  ArtistSnapshot,
  CollectionSnapshot,
  SavedArtist,
  SavedArtists,
  SavedCollection,
  SavedCollections,
} from "./api.generated";

/** What the library keeps of a saved album or catalog playlist. */
export type CollectionSnapshotInput =
  ApiBody<"PUT /v1/me/saved/albums/:albumId">["snapshot"];

/** What the library keeps of a saved artist. */
export type ArtistSnapshotInput =
  ApiBody<"PUT /v1/me/saved/artists/:artistId">["snapshot"];

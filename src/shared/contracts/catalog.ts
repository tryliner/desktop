import type {
  CatalogAlbumDetails,
  CatalogArtistDetails,
  CatalogPlaylistDetails as ApiCatalogPlaylistDetails,
  CatalogSearchItem,
} from "./api.generated";
import type { Cover } from "./cover";
import type { ApiTrack, Track } from "./track";

// the catalog is read on the client (innertube, soundcloud) with
// /v1/catalog/* as the fallback, so these are the api shapes with the client's
// Cover and Track in place of the api ones, plus what only a client catalog adds

type WithClientCover<T> = Omit<T, "cover"> & { cover?: Cover };

export type SearchType = "all" | "track" | "artist" | "album" | "playlist";

export const SEARCH_TYPES: readonly SearchType[] = [
  "all",
  "track",
  "artist",
  "album",
  "playlist",
];

export type SearchArtistItem = WithClientCover<
  Extract<CatalogSearchItem, { type: "artist" }>
>;
export type SearchAlbumItem = WithClientCover<
  Extract<CatalogSearchItem, { type: "album" }>
>;
export type SearchPlaylistItem = WithClientCover<
  Extract<CatalogSearchItem, { type: "playlist" }>
>;

export type SearchResult =
  | (Track & { type: "track" })
  | SearchArtistItem
  | SearchAlbumItem
  | SearchPlaylistItem;

export type SearchResponse = { items: SearchResult[] };

export type ArtistAlbum = WithClientCover<
  CatalogArtistDetails["albums"][number]
> & {
  // track counts only the soundcloud catalog knows
  totalTracks?: number;
  trackCount?: number;
};

export type ArtistRelease = ArtistAlbum &
  Pick<CatalogArtistDetails["singles"][number], "releaseType">;

export type ArtistDetails = Omit<
  WithClientCover<CatalogArtistDetails>,
  "tracks" | "albums" | "singles"
> & {
  /** soundcloud profiles carry a description */
  bio?: string;
  /** youtube subscribers or soundcloud followers, read on the client */
  followers?: number;
  tracks: ApiTrack[];
  albums: ArtistAlbum[];
  singles: ArtistRelease[];
};

export type AlbumDetails = Omit<
  WithClientCover<CatalogAlbumDetails>,
  "tracks"
> & { tracks: ApiTrack[] };

export type CatalogPlaylistDetails = Omit<
  WithClientCover<ApiCatalogPlaylistDetails>,
  "tracks"
> & { tracks: ApiTrack[] };

/** Radio is client only (innertube, soundcloud related tracks). */
export type RadioTrack = Track;
export type RadioResponse = { items: RadioTrack[] };

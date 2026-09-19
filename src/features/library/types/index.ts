export type LibraryTab = "playlists" | "albums" | "artists";

export type LibraryItemKind = "playlist" | "album" | "artist";

export interface LibraryItemViewModel {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  /** Up to 4 cover URLs for collage rendering (playlists). Falls back to [imageUrl]. */
  coverUrls?: string[];
  kind: LibraryItemKind;
  href: string;
  addedAt: string;
  trackCount?: number;
  isOwned?: boolean;
}
export type LibrarySortOption = "recent" | "title" | "creator";

export type LibraryViewMode = "grid" | "list";

export type PlaylistVariant = "playlist" | "artist";

export interface AddableTrack {
  id: string;
  title: string;
}

export interface AddedItem {
  playlistId: string;
  itemId: string;
  trackId: string;
}

export interface AddToPlaylistsResult {
  playlistsTouched: string[];
  added: number;
  alreadyIn: number;
  failed: number;
  skippedLocal: number;
  items: AddedItem[];
}

export interface UndoResult {
  removed: number;
  failed: AddedItem[];
}

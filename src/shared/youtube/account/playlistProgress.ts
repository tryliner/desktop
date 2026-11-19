import type { CatalogPlaylistDetails } from "@/shared/contracts";

type Listener = (playlist: CatalogPlaylistDetails) => void;

const listeners = new Map<string, Set<Listener>>();

const keyOf = (playlistId: string) => playlistId.replace(/^VL/, "");

export function subscribePlaylistProgress(
  playlistId: string,
  listener: Listener,
): () => void {
  const key = keyOf(playlistId);
  const bucket = listeners.get(key) ?? new Set<Listener>();
  listeners.set(key, bucket);
  bucket.add(listener);
  return () => {
    bucket.delete(listener);
    if (bucket.size === 0 && listeners.get(key) === bucket) {
      listeners.delete(key);
    }
  };
}

export function publishPlaylistProgress(
  playlistId: string,
  playlist: CatalogPlaylistDetails,
): void {
  const bucket = listeners.get(keyOf(playlistId));
  if (!bucket) return;
  for (const listener of bucket) listener(playlist);
}

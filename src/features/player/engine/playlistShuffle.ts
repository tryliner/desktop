import type { Track } from "@/shared/types";

export const PLAYLIST_CONTEXT_PREFIX = "playlist:";
export const SHUFFLE_WINDOW = 100;
export const SHUFFLE_REFILL_AT = 25;
export const SHUFFLE_REFILL_CHUNK = 50;

export function isPlaylistContext(
  context: string | null | undefined,
): context is string {
  return (
    typeof context === "string" && context.startsWith(PLAYLIST_CONTEXT_PREFIX)
  );
}

export class LazyShuffle {
  private pool: Uint32Array;
  private size: number;
  private drawn = 0;

  constructor(size: number, first?: number) {
    this.size = size;
    this.pool = new Uint32Array(Math.max(1, size));
    for (let i = 0; i < size; i++) this.pool[i] = i;
    if (first !== undefined && first >= 0 && first < size) {
      this.pool[first] = 0;
      this.pool[0] = first;
      this.drawn = 1;
    }
  }

  get remaining(): number {
    return this.size - this.drawn;
  }

  draw(count: number, random: () => number = Math.random): number[] {
    const picked: number[] = [];
    const pool = this.pool;
    while (picked.length < count && this.drawn < this.size) {
      const at = this.drawn;
      const swap = at + Math.floor(random() * (this.size - at));
      const value = pool[swap];
      pool[swap] = pool[at];
      pool[at] = value;
      picked.push(value);
      this.drawn += 1;
    }
    return picked;
  }

  grow(extra: number): void {
    if (extra <= 0) return;
    const nextSize = this.size + extra;
    if (nextSize > this.pool.length) {
      const bigger = new Uint32Array(Math.max(nextSize, this.pool.length * 2));
      bigger.set(this.pool.subarray(0, this.size));
      this.pool = bigger;
    }
    for (let i = this.size; i < nextSize; i++) this.pool[i] = i;
    this.size = nextSize;
  }
}

export interface PlaylistSource {
  context: string;
  tracks: Track[];
  shuffle: LazyShuffle | null;
}

export function sourceIndexOf(source: PlaylistSource, track: Track): number {
  const byRef = source.tracks.indexOf(track);
  if (byRef >= 0) return byRef;
  return source.tracks.findIndex((item) => item.id === track.id);
}

export function drawShuffled(source: PlaylistSource, count: number): Track[] {
  if (!source.shuffle) return [];
  return source.shuffle.draw(count).map((index) => source.tracks[index]);
}

export function mergeLoadedTracks(
  source: PlaylistSource,
  loaded: Track[],
): Track[] {
  const known = new Set(source.tracks.map((track) => track.id));
  const added = loaded.filter((track) => !known.has(track.id));
  if (added.length === 0) return added;
  source.tracks = [...source.tracks, ...added];
  source.shuffle?.grow(added.length);
  return added;
}

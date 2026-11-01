import type { Track } from "@/shared/types";

export function mergeOfflineTracks(...sources: Track[][]): Track[] {
  const seen = new Set<string>();
  const merged: Track[] = [];
  for (const source of sources)
    for (const track of source) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      merged.push(track);
    }
  return merged;
}

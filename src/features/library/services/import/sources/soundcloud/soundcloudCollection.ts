import type { JsonRecord } from "@/shared/utils/json";

export interface SoundCloudCollection {
  title: string;
  description?: string;
  /** Set/playlist artwork — per-track fallback when a track has none of its own. */
  artworkUrl?: string;
  rawTracks: JsonRecord[];
}

export function createSoundCloudCollection(): SoundCloudCollection {
  return { title: "Imported SoundCloud playlist", rawTracks: [] };
}

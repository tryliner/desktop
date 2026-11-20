import type { Track } from "@/shared/types";
import type { AccountDownloads, PinnedTrack } from "./downloadsTypes";

export function pinnedTrackList(downloads: AccountDownloads): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  const add = (track: PinnedTrack) => {
    if (seen.has(track.id)) return;
    seen.add(track.id);
    out.push({ ...track, playCount: 0 });
  };
  Object.values(downloads.tracks)
    .sort((a, b) => b.pinnedAt - a.pinnedAt)
    .forEach(add);
  Object.values(downloads.collections)
    .sort((a, b) => b.pinnedAt - a.pinnedAt)
    .forEach((collection) => collection.tracks.forEach(add));
  return out;
}

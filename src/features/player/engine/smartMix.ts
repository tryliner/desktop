import type { Track } from "@/shared/types";

export const SMART_MIX_TRACKS_PER_REC = 2;
export const SMART_MIX_MAX_RECS = 50;
export const SMART_MIX_MAX_SEEDS = 4;

export function smartMixRecCount(listTrackCount: number): number {
  if (listTrackCount <= 0) return 0;
  return Math.min(
    SMART_MIX_MAX_RECS,
    Math.ceil(listTrackCount / SMART_MIX_TRACKS_PER_REC),
  );
}

export function pickRecommendations(
  candidates: Track[],
  knownIds: Iterable<string>,
  needed: number,
): Track[] {
  const seen = new Set(knownIds);
  const picked: Track[] = [];
  for (const track of candidates) {
    if (picked.length >= needed) break;
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    picked.push({ ...track, isRecommended: true });
  }
  return picked;
}

export function interleaveRecommendations(
  upcoming: Track[],
  recs: Track[],
  every: number = SMART_MIX_TRACKS_PER_REC,
): Track[] {
  if (recs.length === 0) return [...upcoming];
  const mixed: Track[] = [];
  let recIndex = 0;
  upcoming.forEach((track, i) => {
    mixed.push(track);
    if ((i + 1) % every === 0 && recIndex < recs.length) {
      mixed.push(recs[recIndex++]);
    }
  });
  if (recIndex === 0) mixed.push(recs[0]);
  return mixed;
}

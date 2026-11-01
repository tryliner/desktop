import type { SearchResult } from "@/shared/contracts";
import { isSameRecording, recordingProfile } from "@/shared/media/matching";
import type { SoundCloudSearchHit } from "@/shared/media/soundcloud";
import { isRelevantSearchHit, searchRelevance } from "./searchRelevance";
import { soundCloudHitScore } from "./soundCloudHitScore";

type TrackResult = Extract<SearchResult, { type: "track" }>;

interface ScoredTrack {
  track: TrackResult;
  score: number;
}

const CROSS_PLATFORM_BONUS = 0.1;

function isTrack(item: SearchResult): item is TrackResult {
  return item.type === "track";
}

function byScore(left: ScoredTrack, right: ScoredTrack): number {
  return right.score - left.score;
}

function uniqueSoundCloud(
  query: string,
  youtube: ScoredTrack[],
  soundcloud: SoundCloudSearchHit[],
): ScoredTrack[] {
  const kept: ScoredTrack[] = [];
  const candidates = soundcloud
    .filter((hit) => isRelevantSearchHit(query, hit.track))
    .map((hit, rank) => ({
      track: hit.track,
      publisherArtists: hit.publisherArtist ? [hit.publisherArtist] : [],
      score: soundCloudHitScore(query, hit, rank),
    }))
    .sort(byScore);
  for (const candidate of candidates) {
    const profile = recordingProfile(
      candidate.track,
      candidate.publisherArtists,
    );
    const twin = youtube.find((hit) => isSameRecording(profile, hit.track));
    if (twin) {
      twin.score += CROSS_PLATFORM_BONUS;
      continue;
    }
    if (kept.some((hit) => isSameRecording(profile, hit.track))) continue;
    kept.push({ track: candidate.track, score: candidate.score });
  }
  return kept;
}

function interleave(
  youtube: ScoredTrack[],
  soundcloud: ScoredTrack[],
): TrackResult[] {
  const merged: TrackResult[] = [];
  let left = 0;
  let right = 0;
  while (left < youtube.length || right < soundcloud.length) {
    const takeYoutube =
      right >= soundcloud.length ||
      (left < youtube.length && youtube[left].score >= soundcloud[right].score);
    merged.push(
      takeYoutube ? youtube[left++].track : soundcloud[right++].track,
    );
  }
  return merged;
}

function placeTracks(
  primary: SearchResult[],
  tracks: TrackResult[],
): SearchResult[] {
  const trackSlots = primary.filter(isTrack).length;
  if (trackSlots === 0) {
    const anchor = Math.min(1, primary.length);
    return [...primary.slice(0, anchor), ...tracks, ...primary.slice(anchor)];
  }
  const queue = [...tracks];
  let seenSlots = 0;
  return primary.flatMap((item): SearchResult[] => {
    if (!isTrack(item)) return [item];
    seenSlots += 1;
    const next = queue.shift() ?? item;
    return seenSlots === trackSlots ? [next, ...queue.splice(0)] : [next];
  });
}

export function mergeSoundCloudTracks(
  query: string,
  primary: SearchResult[],
  soundcloud: SoundCloudSearchHit[],
): SearchResult[] {
  if (soundcloud.length === 0) return primary;
  const youtube = primary.filter(isTrack).map((track, rank) => ({
    track,
    score: searchRelevance(query, track, rank),
  }));
  const extra = uniqueSoundCloud(query, youtube, soundcloud);
  if (extra.length === 0) return primary;
  return placeTracks(primary, interleave(youtube, extra));
}

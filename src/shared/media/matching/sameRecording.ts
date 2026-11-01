import type { Track } from "@/shared/contracts";
import { rankCandidate, type RankedCandidate } from "./rankCandidate";
import { buildSourceProfile, type SourceProfile } from "./sourceProfile";

const ARTIST_CONFIRMED_DELTA_MS = 10_000;
const ARTISTLESS_DELTA_MS = 2_000;

export type RecordingProfile = SourceProfile;

export function recordingProfile(
  track: Track,
  extraArtists: string[] = [],
): RecordingProfile {
  return buildSourceProfile({
    sourceId: track.id,
    title: track.title,
    artists: [...track.artists.map((artist) => artist.name), ...extraArtists],
    durationMs: track.durationMs || undefined,
  });
}

function isConfirmed(ranked: RankedCandidate): boolean {
  if (ranked.isDisqualified || !ranked.versionMatches) return false;
  if (ranked.delta === undefined)
    return ranked.artistExact && ranked.bestTitleRatio >= 90;
  if (ranked.artistExact && ranked.bestTitleRatio >= 85)
    return ranked.delta <= ARTIST_CONFIRMED_DELTA_MS;
  return (
    ranked.bestTitleRatio >= 92 &&
    ranked.titleClean.length >= 4 &&
    ranked.delta <= ARTISTLESS_DELTA_MS
  );
}

export function isSameRecording(
  profile: RecordingProfile,
  candidate: Track,
): boolean {
  return isConfirmed(rankCandidate(profile, candidate));
}

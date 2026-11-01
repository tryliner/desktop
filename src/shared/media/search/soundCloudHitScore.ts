import { artistsMatch, parseArtistAndTitle } from "@/shared/media/matching";
import type { SoundCloudSearchHit } from "@/shared/media/soundcloud";
import { searchRelevance } from "./searchRelevance";

const ORIGINAL_UPLOAD_FACTOR = 1.15;
const POPULARITY_WEIGHT = 0.01;

export function isOriginalUpload(hit: SoundCloudSearchHit): boolean {
  const claimedArtists = [
    hit.publisherArtist,
    parseArtistAndTitle(hit.track.title).artist,
  ].filter((name): name is string => Boolean(name));
  return claimedArtists.every((name) => artistsMatch(name, hit.uploader));
}

export function soundCloudHitScore(
  query: string,
  hit: SoundCloudSearchHit,
  rank: number,
): number {
  const relevance = searchRelevance(query, hit.track, rank);
  const origin = isOriginalUpload(hit) ? ORIGINAL_UPLOAD_FACTOR : 1;
  return relevance * origin + POPULARITY_WEIGHT * Math.log10(hit.plays + 1);
}

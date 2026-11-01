import type { Track } from "@/shared/contracts";
import {
  cleanSearchTitle,
  getVersionTags,
  parseArtistAndTitle,
} from "@/shared/media/matching";
import {
  getQueryTokens,
  isJunkVideo,
  matchesQueryWell,
  normalizeSearchText,
} from "@/shared/youtube";

const RANK_DECAY = 5;
const COVERAGE_WEIGHT = 0.55;
const PRECISION_WEIGHT = 0.25;
const POSITION_WEIGHT = 0.2;
const JUNK_FACTOR = 0.5;
const UNASKED_VERSION_FACTOR = 0.7;
const BRACKETED = /[([{][^)\]}]*[)\]}]/g;
const NON_WORD = /[^\p{L}\p{N}\s]/gu;

function artistNames(track: Track): string[] {
  return track.artists.map((artist) => artist.name);
}

function titleTokens(title: string): string[] {
  const base = cleanSearchTitle(parseArtistAndTitle(title).title)
    .replace(BRACKETED, " ")
    .replace(NON_WORD, " ");
  return getQueryTokens(base).filter((token) => token.length > 1);
}

function hasUnaskedVersion(query: string, title: string): boolean {
  const asked = getVersionTags(query);
  return [...getVersionTags(title)].some((tag) => !asked.has(tag));
}

function share(tokens: string[], haystack: string, empty: number): number {
  if (tokens.length === 0) return empty;
  return (
    tokens.filter((token) => haystack.includes(token)).length / tokens.length
  );
}

export function searchRelevance(
  query: string,
  track: Track,
  rank: number,
): number {
  const haystack = normalizeSearchText(
    `${track.title} ${artistNames(track).join(" ")}`,
  );
  const coverage = share(getQueryTokens(query), haystack, 1);
  const precision = share(
    titleTokens(track.title),
    normalizeSearchText(query),
    0,
  );
  const position = 1 / (1 + rank / RANK_DECAY);
  const score =
    COVERAGE_WEIGHT * coverage +
    PRECISION_WEIGHT * precision +
    POSITION_WEIGHT * position;
  const junk = isJunkVideo(track.title, query) ? JUNK_FACTOR : 1;
  const version = hasUnaskedVersion(query, track.title)
    ? UNASKED_VERSION_FACTOR
    : 1;
  return score * junk * version;
}

export function isRelevantSearchHit(query: string, track: Track): boolean {
  return (
    matchesQueryWell(query, track.title, artistNames(track)) &&
    !isJunkVideo(track.title, query)
  );
}

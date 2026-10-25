import type { ImportedTrack, ImportReviewReason, SearchResult, Track } from "@/shared/contracts";
import { searchRaw, videoThumbnailCover } from "@/shared/youtube";
import { cleanSoundCloudMetadata } from "./artistTitle";
import { evaluateImportedTrack, type MatchDecision } from "./evaluate";

export type TrackMatchOutcome =
  | { status: "approved"; track: Track; score: number }
  | { status: "pending"; reason: ImportReviewReason; score?: number; proposedTrack?: Track };

type SearchFilter = "track" | "all" | "video";

const MATCH_CONFIDENCE_FLOOR = 75;

function toTrack(item: Extract<SearchResult, { type: "track" }>): Track {
  const { type: _type, viewer: _viewer, ...track } = item;
  return track;
}

function extractTracks(results: SearchResult[]): Track[] {
  return results.flatMap((item) => (item.type === "track" ? [toTrack(item)] : []));
}

function isMatch(decision: MatchDecision | undefined): decision is Extract<MatchDecision, { track: Track }> {
  return Boolean(decision && "track" in decision);
}

function mergeCandidates(left: Track[], right: Track[]): Track[] {
  return [...new Map([...left, ...right].map((track) => [track.id, track] as const)).values()];
}

export async function findCatalogMatch(source: ImportedTrack, signal?: AbortSignal): Promise<TrackMatchOutcome> {
  let searchFailed = false;
  const search = async (query: string, filter: SearchFilter) => {
    try {
      return extractTracks(await searchRaw(query, filter === "all" ? undefined : filter, signal));
    } catch (error) {
      if (signal?.aborted) throw error;
      searchFailed = true;
      return [];
    }
  };

  const meta = cleanSoundCloudMetadata(source.title, source.artists[0]);
  let candidates = await search(meta.searchQuery, "track");
  let decision = candidates.length > 0 ? evaluateImportedTrack(source, candidates) : undefined;

  const attempt = async (query: string, filter: SearchFilter) => {
    const extra = await search(query, filter);
    if (extra.length === 0) return;
    const combined = mergeCandidates(candidates, extra);
    const next = evaluateImportedTrack(source, combined);
    if (isMatch(next) || !decision) {
      candidates = combined;
      decision = next;
    }
  };

  if (!isMatch(decision) || decision.score < MATCH_CONFIDENCE_FLOOR) await attempt(meta.searchQuery, "all");
  if (!isMatch(decision) && meta.title && meta.title !== meta.searchQuery) await attempt(meta.title, "track");
  if (!isMatch(decision)) await attempt(meta.searchQuery, "video");

  if (isMatch(decision)) {
    const track = { ...decision.track, cover: decision.track.cover ?? videoThumbnailCover(decision.track.id) };
    return { status: "approved", track, score: decision.score };
  }
  if (decision) {
    return {
      status: "pending",
      reason: decision.reason,
      ...(decision.score !== undefined ? { score: decision.score } : {}),
      ...(decision.proposedTrack ? { proposedTrack: decision.proposedTrack } : {}),
    };
  }
  return { status: "pending", reason: searchFailed ? "catalog_lookup_failed" : "no_catalog_candidates" };
}

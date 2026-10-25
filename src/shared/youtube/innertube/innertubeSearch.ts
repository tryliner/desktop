import type { SearchResult, SearchType } from "@/shared/contracts";
import { postInnertube } from "./innertubeClient";
import { mapSearchResponse } from "./innertubeSearchMapper";
import { isJunkVideo, matchesQueryWell } from "./innertubeSearchRanking";

export type InnertubeSearchFilter = SearchType | "video";

type TrackResult = Extract<SearchResult, { type: "track" }>;

const SEARCH_PARAMS: Partial<Record<InnertubeSearchFilter, string>> = {
  track: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D",
  video: "EgWKAQIQAWoKEAkQBRAKEAMQBA%3D%3D",
  artist: "EgWKAQIgAWoKEAkQBRAKEAMQBA%3D%3D",
  album: "EgWKAQIYAWoKEAkQBRAKEAMQBA%3D%3D",
  playlist: "EgWKAQIoAWoKEAkQBRAKEAMQBA%3D%3D",
};

export async function searchRaw(
  query: string,
  filter?: InnertubeSearchFilter,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const params = filter ? SEARCH_PARAMS[filter] : undefined;
  const body = await postInnertube(
    "search",
    { query, ...(params ? { params } : {}) },
    { signal },
  );
  return mapSearchResponse(body);
}

function onlyTracks(results: SearchResult[]): TrackResult[] {
  return results.filter((item): item is TrackResult => item.type === "track");
}

function settledOrEmpty(
  result: PromiseSettledResult<SearchResult[]>,
): SearchResult[] {
  return result.status === "fulfilled" ? result.value : [];
}

function throwIfAllFailed(
  results: PromiseSettledResult<SearchResult[]>[],
): void {
  const firstFailure = results.find((result) => result.status === "rejected");
  if (firstFailure && results.every((result) => result.status === "rejected")) {
    throw firstFailure.reason;
  }
}

function matches(query: string, track: TrackResult): boolean {
  return matchesQueryWell(
    query,
    track.title,
    track.artists.map((artist) => artist.name),
  );
}

function createCollector(enrichment: Map<string, TrackResult>) {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const add = (item: SearchResult) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (item.type !== "track") {
      results.push(item);
      return;
    }
    const detailed = enrichment.get(item.id);
    results.push(
      detailed && detailed.durationMs > 0 && !item.durationMs
        ? { ...item, ...detailed }
        : item,
    );
  };
  return { results, add };
}

async function searchTracksAndMixed(
  query: string,
  includeMixed: boolean,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const settled = await Promise.allSettled([
    searchRaw(query, undefined, signal),
    searchRaw(query, "track", signal),
    searchRaw(query, "video", signal),
  ]);
  throwIfAllFailed(settled);
  const [mixed, tracks, videos] = [
    settledOrEmpty(settled[0]),
    onlyTracks(settledOrEmpty(settled[1])),
    onlyTracks(settledOrEmpty(settled[2])),
  ];
  const enrichment = new Map(
    [...tracks, ...videos].map((track) => [track.id, track] as const),
  );
  const qualifiedVideos = videos.filter(
    (video) => !isJunkVideo(video.title, query) && matches(query, video),
  );
  const { results, add } = createCollector(enrichment);
  const topResult = mixed[0];

  if (includeMixed && topResult && topResult.type !== "track") add(topResult);
  tracks.filter((track) => matches(query, track)).forEach(add);
  if (includeMixed) {
    mixed.forEach(add);
  } else if (
    topResult?.type === "track" &&
    matches(query, topResult) &&
    !isJunkVideo(topResult.title, query)
  ) {
    add(topResult);
  }
  qualifiedVideos.forEach(add);
  tracks.filter((track) => !matches(query, track)).forEach(add);
  return results;
}

async function searchTyped(
  query: string,
  type: Exclude<SearchType, "all" | "track">,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const settled = await Promise.allSettled([
    searchRaw(query, undefined, signal),
    searchRaw(query, type, signal),
  ]);
  throwIfAllFailed(settled);
  const mixed = settledOrEmpty(settled[0]);
  const typed = settledOrEmpty(settled[1]).filter((item) => item.type === type);
  const { results, add } = createCollector(new Map());
  if (mixed[0]?.type === type) add(mixed[0]);
  typed.forEach(add);
  return results;
}

export function searchCatalog(
  query: string,
  type: SearchType = "all",
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  if (type === "all") return searchTracksAndMixed(query, true, signal);
  if (type === "track") return searchTracksAndMixed(query, false, signal);
  return searchTyped(query, type, signal);
}

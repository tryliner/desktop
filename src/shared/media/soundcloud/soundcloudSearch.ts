import type { SearchType, SourcedSearchResult } from "@/shared/contracts";
import { asArray } from "@/shared/utils/json";
import { getJson } from "./soundcloudCatalogRequest";
import {
  mapSoundCloudSearchArtist,
  mapSoundCloudSearchSet,
  mapSoundCloudSearchTrack,
} from "./soundcloudMappers";

export const SOUNDCLOUD_SEARCH_LIMIT = 20;
const SEARCH_LIMIT = String(SOUNDCLOUD_SEARCH_LIMIT);

async function getSearchCollection(path: string, query: string, signal?: AbortSignal): Promise<unknown[]> {
  const body = await getJson(
    path,
    { q: query, limit: SEARCH_LIMIT, linked_partitioning: "1" },
    signal,
  );
  return asArray(body.collection);
}

function uniqueResults(results: SourcedSearchResult[]): SourcedSearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.type}:${result.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapTracks(records: unknown[]): SourcedSearchResult[] {
  return records.flatMap((record) => mapSoundCloudSearchTrack(record) ?? []);
}

function mapArtists(records: unknown[]): SourcedSearchResult[] {
  return records.flatMap((record) => mapSoundCloudSearchArtist(record) ?? []);
}

function mapSets(records: unknown[], type: "all" | "album" | "playlist"): SourcedSearchResult[] {
  return records
    .flatMap((record) => mapSoundCloudSearchSet(record) ?? [])
    .filter((result) => type === "all" || result.type === type);
}

export async function searchSoundCloud(
  query: string,
  type: SearchType = "all",
  signal?: AbortSignal,
): Promise<SourcedSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let results: SourcedSearchResult[];
  if (type === "track") {
    results = mapTracks(await getSearchCollection("/search/tracks", trimmed, signal));
  } else if (type === "artist") {
    results = mapArtists(await getSearchCollection("/search/users", trimmed, signal));
  } else if (type === "album" || type === "playlist") {
    results = mapSets(await getSearchCollection("/search/playlists", trimmed, signal), type);
  } else {
    const [tracks, users, sets] = await Promise.all([
      getSearchCollection("/search/tracks", trimmed, signal),
      getSearchCollection("/search/users", trimmed, signal),
      getSearchCollection("/search/playlists", trimmed, signal),
    ]);
    const mappedSets = mapSets(sets, "all");
    results = [
      ...mapTracks(tracks).slice(0, 10),
      ...mapArtists(users).slice(0, 5),
      ...mappedSets.filter((result) => result.type === "album").slice(0, 3),
      ...mappedSets.filter((result) => result.type === "playlist").slice(0, 2),
    ];
  }

  return uniqueResults(results).slice(0, SOUNDCLOUD_SEARCH_LIMIT);
}

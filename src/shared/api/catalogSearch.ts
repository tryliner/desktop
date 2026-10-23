import type {
  CatalogSource,
  SearchResponse,
  SearchResult,
  SearchSource,
  SearchType,
  SourcedSearchResult,
} from "@/shared/contracts";
import { innertubeCatalog } from "@/shared/media/innertube";
import {
  isSoundCloudUrl,
  resolveSoundCloudUrl,
  soundcloudCatalog,
} from "@/shared/media/soundcloud";
import { isAbortError } from "@/shared/utils/abort";
import { log } from "@/shared/utils/logger";

export interface RawSearchResponse {
  items: SearchResult[];
}

function annotate(
  items: SearchResult[],
  source: CatalogSource,
): SourcedSearchResult[] {
  return items.map((item) => ({ ...item, source }));
}

async function searchYoutube(
  query: string,
  type: SearchType,
  server: () => Promise<RawSearchResponse>,
  signal?: AbortSignal,
): Promise<SourcedSearchResult[]> {
  try {
    return annotate(await innertubeCatalog.search(query, type, signal), "youtube");
  } catch (error) {
    if (isAbortError(error)) throw error;
    log("yellow", "catalog", "search failed on client, using server fallback", error);
    return annotate((await server()).items, "youtube");
  }
}

async function searchSoundcloud(
  query: string,
  type: SearchType,
  signal?: AbortSignal,
): Promise<SourcedSearchResult[]> {
  if (isSoundCloudUrl(query)) {
    return annotate(await resolveSoundCloudUrl(query, type, signal), "soundcloud");
  }
  return soundcloudCatalog.search(query, type, signal);
}

function unique(items: SourcedSearchResult[]): SourcedSearchResult[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.source}:${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function roundRobin(
  youtube: SourcedSearchResult[],
  soundcloud: SourcedSearchResult[],
): SourcedSearchResult[] {
  const merged: SourcedSearchResult[] = [];
  const length = Math.max(youtube.length, soundcloud.length);
  for (let index = 0; index < length; index += 1) {
    if (youtube[index]) merged.push(youtube[index]);
    if (soundcloud[index]) merged.push(soundcloud[index]);
  }
  return unique(merged);
}

export async function searchCatalogs(
  query: string,
  type: SearchType,
  source: SearchSource,
  server: () => Promise<RawSearchResponse>,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  if (source === "youtube") {
    return { items: unique(await searchYoutube(query, type, server, signal)) };
  }
  if (source === "soundcloud" || isSoundCloudUrl(query)) {
    return { items: unique(await searchSoundcloud(query, type, signal)) };
  }

  const [youtube, soundcloud] = await Promise.allSettled([
    searchYoutube(query, type, server, signal),
    searchSoundcloud(query, type, signal),
  ]);

  if (youtube.status === "rejected" && soundcloud.status === "rejected") {
    throw youtube.reason;
  }
  if (youtube.status === "rejected") {
    return {
      items: unique(soundcloud.status === "fulfilled" ? soundcloud.value : []),
      failedSources: ["youtube"],
    };
  }
  if (soundcloud.status === "rejected") {
    return { items: unique(youtube.value), failedSources: ["soundcloud"] };
  }
  return { items: roundRobin(youtube.value, soundcloud.value) };
}

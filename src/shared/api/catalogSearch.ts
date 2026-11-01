import type { SearchResponse, SearchType } from "@/shared/contracts";
import { searchSoundCloudTracks } from "@/shared/media/soundcloud";
import { mergeSoundCloudTracks } from "@/shared/media/search";
import { isAbortError } from "@/shared/utils/abort";
import { log } from "@/shared/utils/logger";

const SOUNDCLOUD_SEARCH_TIMEOUT_MS = 2_500;

async function soundCloudTracksOrEmpty(query: string) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    SOUNDCLOUD_SEARCH_TIMEOUT_MS,
  );
  try {
    return await searchSoundCloudTracks(query, controller.signal);
  } catch (error) {
    log("yellow", "catalog", "soundcloud search skipped", error);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function includesTracks(type: SearchType): boolean {
  return type === "track" || type === "all";
}

export async function withSoundCloudTracks(
  query: string,
  type: SearchType,
  primary: Promise<SearchResponse>,
): Promise<SearchResponse> {
  if (!includesTracks(type)) return primary;
  const soundcloud = soundCloudTracksOrEmpty(query);
  let items: SearchResponse["items"];
  try {
    items = (await primary).items;
  } catch (error) {
    if (isAbortError(error) || (await soundcloud).length === 0) throw error;
    items = [];
  }
  return { items: mergeSoundCloudTracks(query, items, await soundcloud) };
}

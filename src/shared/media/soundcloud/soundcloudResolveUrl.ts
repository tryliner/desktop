import type { SearchResult, SearchType } from "@/shared/contracts";
import { rethrowIfAborted } from "@/shared/utils/abort";
import { type JsonRecord } from "@/shared/utils/json";
import { getJson } from "./soundcloudCatalogRequest";
import {
  mapSoundCloudSearchArtist,
  mapSoundCloudSearchSet,
  mapSoundCloudSearchTrack,
} from "./soundcloudMappers";

const SOUNDCLOUD_URL = /^(?:https?:\/\/)?(?:www\.|m\.|on\.)?soundcloud\.com\/\S+$/i;
const SHORT_LINK_HOST = "on.soundcloud.com";

export function isSoundCloudUrl(value: string): boolean {
  return SOUNDCLOUD_URL.test(value.trim());
}

function stripQuery(value: string): string {
  const url = new URL(value);
  return `${url.origin}${url.pathname}`;
}

async function canonicalUrl(value: string, signal?: AbortSignal): Promise<string> {
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  if (url.hostname.toLowerCase() === SHORT_LINK_HOST) {
    try {
      const response = await fetch(url, { redirect: "follow", signal });
      if (response.url) return stripQuery(response.url);
    } catch {
      rethrowIfAborted(signal);
    }
  }
  return `https://soundcloud.com${url.pathname}`;
}

function mapResolved(record: JsonRecord): SearchResult | null {
  if (record.kind === "user") return mapSoundCloudSearchArtist(record);
  if (record.kind === "playlist") return mapSoundCloudSearchSet(record);
  if (record.kind === "track") return mapSoundCloudSearchTrack(record);
  return null;
}

function matchesType(result: SearchResult, type: SearchType): boolean {
  return type === "all" || result.type === type;
}

export async function resolveSoundCloudUrl(value: string, type: SearchType = "all", signal?: AbortSignal): Promise<SearchResult[]> {
  const url = await canonicalUrl(value.trim(), signal);
  const result = mapResolved(await getJson("/resolve", { url }, signal));
  return result && matchesType(result, type) ? [result] : [];
}

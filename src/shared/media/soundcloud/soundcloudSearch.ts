import type { SearchResult } from "@/shared/contracts";
import {
  asArray,
  asRecord,
  numberValue,
  trimmedString,
} from "@/shared/utils/json";
import { getJson } from "./soundcloudCatalogRequest";
import { mapSoundCloudCatalogTrack } from "./soundcloudMappers";

export type SoundCloudSearchTrack = Extract<SearchResult, { type: "track" }>;

export interface SoundCloudSearchHit {
  track: SoundCloudSearchTrack;
  uploader: string;
  publisherArtist?: string;
  plays: number;
}

const SEARCH_LIMIT = "20";
const UNPLAYABLE_POLICIES = new Set(["SNIP", "BLOCK"]);

function isPlayable(rawTrack: unknown): boolean {
  const track = asRecord(rawTrack);
  if (!track || track.streamable === false) return false;
  const policy = trimmedString(track.policy)?.toUpperCase();
  return !policy || !UNPLAYABLE_POLICIES.has(policy);
}

function toSearchHit(rawTrack: unknown): SoundCloudSearchHit[] {
  const track = mapSoundCloudCatalogTrack(rawTrack);
  const record = asRecord(rawTrack);
  const uploader = trimmedString(asRecord(record?.user)?.username);
  if (!track || !record || !uploader) return [];
  const publisherArtist = trimmedString(
    asRecord(record.publisher_metadata)?.artist,
  );
  return [
    {
      track: { ...track, type: "track" },
      uploader,
      ...(publisherArtist ? { publisherArtist } : {}),
      plays: numberValue(record.playback_count) ?? 0,
    },
  ];
}

export async function searchSoundCloudTracks(
  query: string,
  signal?: AbortSignal,
): Promise<SoundCloudSearchHit[]> {
  const body = await getJson(
    "/search/tracks",
    { q: query, limit: SEARCH_LIMIT },
    signal,
  );
  return asArray(body.collection).filter(isPlayable).flatMap(toSearchHit);
}

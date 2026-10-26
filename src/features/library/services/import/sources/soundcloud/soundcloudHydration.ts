import {
  asArray,
  asRecord,
  isRecord,
  parseJsonSafe,
  trimmedString,
} from "@/shared/utils/json";
import { tryFetchText } from "@/shared/api/tryFetch";
import type { SoundCloudCollection } from "./soundcloudCollection";

const PLAYLIST_HYDRATABLES = new Set(["playlist", "system_playlist", "set"]);

export function applySoundCloudHydration(
  html: string,
  collection: SoundCloudCollection,
): void {
  const match = html.match(
    /<script>window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);<\/script>/,
  );
  if (!match?.[1]) return;
  const items = asArray(parseJsonSafe(match[1])).map(asRecord);
  const playlistItem = items.find(
    (item) =>
      typeof item?.hydratable === "string" &&
      PLAYLIST_HYDRATABLES.has(item.hydratable),
  );
  const data = asRecord(playlistItem?.data);
  if (!data) return;
  const title = trimmedString(data.title);
  const description = trimmedString(data.description);
  const artworkUrl = trimmedString(data.artwork_url);
  if (title) collection.title = title;
  if (description) collection.description = description;
  if (artworkUrl) collection.artworkUrl = artworkUrl;
  collection.rawTracks.push(...asArray(data.tracks).filter(isRecord));
}

export async function scrapeSoundCloudHydration(
  canonicalUrl: string,
  collection: SoundCloudCollection,
  signal?: AbortSignal,
): Promise<void> {
  const html = await tryFetchText(canonicalUrl, {
    headers: { accept: "text/html,application/xhtml+xml" },
    signal,
  });
  if (html) applySoundCloudHydration(html, collection);
}

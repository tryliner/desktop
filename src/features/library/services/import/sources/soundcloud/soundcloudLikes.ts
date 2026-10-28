import {
  asArray,
  asRecord,
  type JsonRecord,
  stringValue,
} from "@/shared/utils/json";
import { fetchSoundCloudApi, SOUNDCLOUD_API } from "@/shared/media/soundcloud";
import { log } from "@/shared/utils/logger";
import type { SoundCloudCollection } from "./soundcloudCollection";

export const MAX_LIKES_PAGES = 500;

export function isSoundCloudUserEntity(
  body: JsonRecord,
  isLikesUrl: boolean,
): boolean {
  return (
    body.kind === "user" ||
    isLikesUrl ||
    (typeof body.id === "number" && !body.tracks)
  );
}

function likedTrack(item: unknown): JsonRecord | undefined {
  const record = asRecord(item);
  return (
    asRecord(record?.track) ?? (record?.kind === "track" ? record : undefined)
  );
}

function nextLikesUrl(nextHref: unknown): string | null {
  const href = stringValue(nextHref);
  return href?.trim() ? href : null;
}

export async function collectSoundCloudLikes(
  body: JsonRecord,
  fallbackUsername: string,
  collection: SoundCloudCollection,
  signal?: AbortSignal,
): Promise<void> {
  const username = stringValue(body.username) ?? fallbackUsername;
  collection.title = `${username} — Likes`;
  collection.description = `Liked tracks from SoundCloud user ${username}`;

  let nextUrl: string | null = `/users/${String(body.id)}/likes?limit=50`;
  const visitedPages = new Set<string>();
  while (nextUrl) {
    const pageUrl = new URL(nextUrl, SOUNDCLOUD_API).href;
    if (visitedPages.has(pageUrl)) break;
    if (visitedPages.size >= MAX_LIKES_PAGES) {
      log(
        "yellow",
        "import",
        `soundcloud likes import stopped at ${MAX_LIKES_PAGES} pages with ${collection.rawTracks.length} tracks`,
      );
      break;
    }
    visitedPages.add(pageUrl);
    const response = await fetchSoundCloudApi(nextUrl, {}, { signal });
    if (!response.ok) {
      log(
        "yellow",
        "import",
        `soundcloud likes import is partial: page ${visitedPages.size} failed with ${response.status}, kept ${collection.rawTracks.length} tracks`,
      );
      break;
    }
    const likesBody = asRecord((await response.json()) as unknown);
    for (const item of asArray(likesBody?.collection)) {
      const track = likedTrack(item);
      if (track) collection.rawTracks.push(track);
    }
    nextUrl = nextLikesUrl(likesBody?.next_href);
  }
}

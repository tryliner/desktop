import {
  asArray,
  asRecord,
  type JsonRecord,
  stringValue,
} from "@/shared/utils/json";
import { fetchSoundCloudApi } from "@/shared/media/soundcloud";
import type { SoundCloudCollection } from "./soundcloudCollection";

const MAX_LIKES_PAGES = 20;

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
  let pageCount = 0;
  while (nextUrl && pageCount < MAX_LIKES_PAGES) {
    pageCount += 1;
    const response = await fetchSoundCloudApi(nextUrl, {}, { signal });
    if (!response.ok) break;
    const likesBody = asRecord((await response.json()) as unknown);
    for (const item of asArray(likesBody?.collection)) {
      const track = likedTrack(item);
      if (track) collection.rawTracks.push(track);
    }
    nextUrl = nextLikesUrl(likesBody?.next_href);
  }
}

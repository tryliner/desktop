import {
  asArray,
  asRecord,
  isRecord,
  trimmedString,
} from "@/shared/utils/json";
import { rethrowIfAborted } from "@/shared/utils/abort";
import { fetchSoundCloudApi } from "@/shared/media/soundcloud";
import type { SoundCloudCollection } from "./soundcloudCollection";
import {
  collectSoundCloudLikes,
  isSoundCloudUserEntity,
} from "./soundcloudLikes";
import { isSoundCloudLikesUrl, soundCloudPathParts } from "./soundcloudUrl";

async function resolveCollection(
  canonicalUrl: string,
  collection: SoundCloudCollection,
  signal?: AbortSignal,
) {
  const response = await fetchSoundCloudApi(
    "/resolve",
    { url: canonicalUrl },
    { signal },
  );
  if (!response.ok) return;
  const body = asRecord((await response.json()) as unknown);

  if (
    body &&
    isSoundCloudUserEntity(body, isSoundCloudLikesUrl(canonicalUrl))
  ) {
    await collectSoundCloudLikes(
      body,
      soundCloudPathParts(canonicalUrl)[0],
      collection,
      signal,
    );
    if (collection.rawTracks.length > 0) return;
  }

  const title = trimmedString(body?.title);
  const description = trimmedString(body?.description);
  const artworkUrl = trimmedString(body?.artwork_url);
  if (title) collection.title = title;
  if (description) collection.description = description;
  if (artworkUrl && !collection.artworkUrl) collection.artworkUrl = artworkUrl;
  collection.rawTracks.push(...asArray(body?.tracks).filter(isRecord));
}

export async function resolveSoundCloudApi(
  canonicalUrl: string,
  collection: SoundCloudCollection,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await resolveCollection(canonicalUrl, collection, signal);
  } catch {
    rethrowIfAborted(signal);
  }
}

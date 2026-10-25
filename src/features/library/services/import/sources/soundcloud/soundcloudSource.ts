import type {
  ClientImportedPlaylist,
  ClientImportedTrack,
} from "../../importTypes";
import {
  getSoundCloudClientId,
  hydrateSoundCloudStubs,
} from "@/shared/media/soundcloud";
import { createSoundCloudCollection } from "./soundcloudCollection";
import { scrapeSoundCloudHydration } from "./soundcloudHydration";
import { resolveSoundCloudApi } from "./soundcloudResolve";
import { mapSoundCloudTrack, soundCloudCanonicalId } from "./soundcloudTracks";
import { isSoundCloudLikesUrl, resolveSoundCloudUrl } from "./soundcloudUrl";

export interface SoundCloudImportOptions {
  signal?: AbortSignal;
}

export async function importSoundCloud(
  rawUrl: string,
  options: SoundCloudImportOptions = {},
): Promise<ClientImportedPlaylist> {
  const { signal } = options;
  const canonicalUrl = await resolveSoundCloudUrl(rawUrl, signal);
  const collection = createSoundCloudCollection();

  if (!isSoundCloudLikesUrl(canonicalUrl)) {
    await scrapeSoundCloudHydration(canonicalUrl, collection, signal);
  }

  await getSoundCloudClientId(undefined, signal);
  if (collection.rawTracks.length === 0) {
    await resolveSoundCloudApi(canonicalUrl, collection, signal);
  }

  const rawTracks = await hydrateSoundCloudStubs(collection.rawTracks, signal);
  const tracks = rawTracks
    .map((raw) => mapSoundCloudTrack(raw, collection.artworkUrl))
    .filter((track): track is ClientImportedTrack => Boolean(track));

  if (tracks.length === 0) {
    throw new Error(
      "No tracks found in the SoundCloud playlist. Make sure the playlist is public and contains available tracks.",
    );
  }

  return {
    source: "soundcloud",
    sourceUrl: rawUrl,
    title: collection.title,
    canonicalTrackIds: tracks.map((track) =>
      soundCloudCanonicalId(track.sourceId),
    ),
    ...(collection.description ? { description: collection.description } : {}),
    tracks,
  };
}

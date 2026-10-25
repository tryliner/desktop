import type { ImportSource } from "@/shared/contracts";
import { detectImportSource } from "./detectImportSource";
import type { ClientImportedPlaylist } from "./importTypes";
import { normalizeImportUrl } from "./shared/url";
import { importAppleMusic } from "./sources/appleMusic/appleMusicSource";
import { importDeezer } from "./sources/deezerSource";
import { importSoundCloud } from "./sources/soundcloud/soundcloudSource";
import { importSpotify } from "./sources/spotify/spotifySource";
import { importYoutube } from "./sources/youtube/youtubeSource";

type SourceParser = (
  url: string,
  signal?: AbortSignal,
) => Promise<ClientImportedPlaylist>;

const PARSERS: Record<ImportSource, SourceParser> = {
  youtube: importYoutube,
  deezer: importDeezer,
  soundcloud: (url, signal) => importSoundCloud(url, { signal }),
  spotify: importSpotify,
  apple_music: importAppleMusic,
};

export async function parseImportSource(
  url: string,
  signal?: AbortSignal,
): Promise<ClientImportedPlaylist> {
  const source = detectImportSource(url);
  signal?.throwIfAborted();
  const playlist = await PARSERS[source](normalizeImportUrl(url), signal);
  if (!playlist.tracks.length) {
    throw new Error(
      "No tracks found in the imported playlist. Make sure the playlist is public and contains available tracks.",
    );
  }
  return playlist;
}

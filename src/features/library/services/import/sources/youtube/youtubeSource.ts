import {
  fetchYoutubePlaylist,
  playlistIdFromYoutube,
  videoIdFromYoutube,
} from "@/shared/youtube";
import type { ClientImportedPlaylist } from "../../importTypes";
import { importYoutubeSingleVideo } from "./youtubeSingleVideo";

export async function importYoutube(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<ClientImportedPlaylist> {
  const playlistId = playlistIdFromYoutube(rawUrl);
  if (!playlistId) {
    const videoId = videoIdFromYoutube(rawUrl);
    if (videoId) return importYoutubeSingleVideo(videoId, rawUrl, signal);
    throw new Error(
      "YouTube URL must contain a valid playlist or video identifier.",
    );
  }

  const playlist = await fetchYoutubePlaylist(playlistId, signal);

  if (playlist.tracks.length === 0) {
    throw new Error(
      "No tracks could be extracted from this YouTube playlist. Check if the playlist is public.",
    );
  }

  return {
    source: "youtube",
    sourceUrl: rawUrl,
    ...playlist,
    canonicalTrackIds: playlist.tracks.map((track) => track.sourceId),
  };
}

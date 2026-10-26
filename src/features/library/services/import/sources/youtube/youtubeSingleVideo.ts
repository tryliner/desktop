import { fetchYoutubeVideoMeta, youtubeThumbnailUrl } from "@/shared/youtube";
import type { ClientImportedPlaylist } from "../../importTypes";
import { withoutArtistPrefix } from "../../shared/titles";

export async function importYoutubeSingleVideo(
  videoId: string,
  rawUrl: string,
  signal?: AbortSignal,
): Promise<ClientImportedPlaylist> {
  const meta = await fetchYoutubeVideoMeta(videoId, signal);
  const title = meta.title ?? "YouTube Track";
  const artist = meta.artist ?? "YouTube";

  const cleanArtist = artist.trim() || "YouTube";
  const cleanTitle =
    withoutArtistPrefix(title.trim(), cleanArtist) || title.trim();

  return {
    source: "youtube",
    sourceUrl: rawUrl,
    title: cleanTitle,
    tracks: [
      {
        sourceId: videoId,
        title: cleanTitle,
        artists: [cleanArtist],
        coverUrl: youtubeThumbnailUrl(videoId),
      },
    ],
    canonicalTrackIds: [videoId],
  };
}

import { toVideoId } from "@/shared/youtube";
import { findCatalogMatch } from "@/shared/media/matching";
import type { PlayableTrack } from "./playbackStream";

const matchedVideoIds = new Map<string, string>();

export function clearYoutubeStandInCache(): void {
  matchedVideoIds.clear();
}

export async function findYoutubeStandIn(
  track: PlayableTrack,
  signal?: AbortSignal,
): Promise<string | null> {
  const remembered = matchedVideoIds.get(track.id);
  if (remembered) return remembered;
  const artist = track.artists.trim();
  if (!track.title.trim()) return null;
  const outcome = await findCatalogMatch(
    {
      sourceId: track.id,
      title: track.title,
      artists: artist ? [artist] : [],
      ...(track.durationMs > 0 ? { durationMs: track.durationMs } : {}),
    },
    signal,
  );
  if (outcome.status !== "approved") return null;
  const videoId = toVideoId(outcome.track.id);
  if (videoId) matchedVideoIds.set(track.id, videoId);
  return videoId;
}

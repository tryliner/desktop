import type { WireTrack } from "@/shared/contracts";
import type { Track } from "@/shared/types";

// The track sent with a playback event. Only real metadata goes in: without a
// title or a structured artist list it is left out and the server takes the
// track from its catalog (404 TRACK_UNKNOWN when it has never seen the id).
// Unknown artist ids, durations and cover sizes are null, never made up.
export function playbackSnapshot(
  track: Track,
  measuredDurationMs: number,
): WireTrack | undefined {
  const title = track.title?.trim();
  const artists = (track.artistList ?? []).flatMap((artist) => {
    const name = artist.name?.trim();
    return name ? [{ id: artist.id || null, name }] : [];
  });
  if (!title || artists.length === 0) return undefined;

  const durationMs = Math.round(track.durationMs || measuredDurationMs);
  return {
    id: track.id,
    title,
    artists,
    durationMs: durationMs > 0 ? durationMs : null,
    ...(track.album?.id && track.album.title
      ? { album: { id: track.album.id, title: track.album.title } }
      : {}),
    ...(track.coverUrl
      ? { cover: { url: track.coverUrl, width: null, height: null } }
      : {}),
  };
}

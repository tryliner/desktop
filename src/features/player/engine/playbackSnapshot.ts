import type { PlaybackTrackSnapshot } from "@/shared/contracts";
import type { Track } from "@/shared/types";

// Snapshot sent with a playback event. Only real metadata goes in: without a
// title or a structured artist list the snapshot is left out and the server
// resolves the track itself, instead of storing "Unknown Artist" placeholders
// (or every comma-split name under the primary artist's id) in its catalog.
export function playbackSnapshot(
  track: Track,
  measuredDurationMs: number,
): PlaybackTrackSnapshot | undefined {
  const title = track.title?.trim();
  const artists = (track.artistList ?? []).flatMap((artist) => {
    const name = artist.name?.trim();
    if (!name) return [];
    // "unknown" is the server's own placeholder id, the same as sending none
    return [
      artist.id && artist.id !== "unknown" ? { id: artist.id, name } : { name },
    ];
  });
  if (!title || artists.length === 0) return undefined;

  const durationMs = track.durationMs || measuredDurationMs;
  return {
    id: track.id,
    title,
    artists,
    ...(track.album?.id && track.album.title
      ? { album: { id: track.album.id, title: track.album.title } }
      : {}),
    ...(durationMs > 0 ? { durationMs } : {}),
    ...(track.coverUrl ? { cover: { url: track.coverUrl } } : {}),
  };
}

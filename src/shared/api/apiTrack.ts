import type { Track, WireTrack } from "@/shared/contracts";

const positive = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;

/**
 * The api Track for a request body, or undefined when the track has no title
 * or no named artist (the server would refuse it with 400). Unknown durations
 * and cover sizes are null, never 0; client-only fields are left out.
 */
export function toApiTrack(
  track: Track | null | undefined,
): WireTrack | undefined {
  const title = track?.title?.trim();
  if (!track || !title) return undefined;
  const artists = track.artists.flatMap((artist) => {
    const name = artist.name?.trim();
    return name ? [{ id: artist.id || null, name }] : [];
  });
  if (artists.length === 0) return undefined;
  return {
    id: track.id,
    title,
    artists,
    durationMs: positive(track.durationMs),
    ...(track.album?.id && track.album.title
      ? { album: { id: track.album.id, title: track.album.title } }
      : {}),
    ...(track.cover?.url
      ? {
          cover: {
            url: track.cover.url,
            width: positive(track.cover.width),
            height: positive(track.cover.height),
          },
        }
      : {}),
    ...(track.explicit !== undefined ? { explicit: track.explicit } : {}),
  };
}

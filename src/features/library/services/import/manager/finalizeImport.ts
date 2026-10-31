import { api } from "@/shared/api";
import type { Track } from "@/shared/contracts";

export interface FinalizedPlaylist {
  playlistId: string;
  saved: number;
  overLimit: number;
}

function uniqueTracks(tracks: Track[]): Track[] {
  return [
    ...new Map(
      tracks
        .filter((track) => Boolean(track?.id))
        .map((track) => [track.id, track] as const),
    ).values(),
  ];
}

export async function finalizeImportedPlaylist(
  title: string,
  description: string | undefined,
  tracks: Track[],
): Promise<FinalizedPlaylist> {
  const playlist = await api.createPlaylist({
    title: title.trim().slice(0, 200) || "Imported playlist",
    ...(description?.trim()
      ? { description: description.trim().slice(0, 2000) }
      : {}),
  });
  const unique = uniqueTracks(tracks);
  if (unique.length === 0) {
    return { playlistId: playlist.id, saved: 0, overLimit: 0 };
  }
  const { added, overLimit } = await api.addPlaylistTrackSnapshots(
    playlist.id,
    unique,
  );
  return { playlistId: playlist.id, saved: added, overLimit };
}

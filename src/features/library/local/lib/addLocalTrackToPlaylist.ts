import { useLocalLibraryStore } from "../store/localLibraryStore";
import { useLocalPlaylistLinksStore } from "../store/localPlaylistLinksStore";

export type AddLocalTrackResult = "added" | "duplicate" | "missing";

export async function addLocalTrackToPlaylist(
  playlistId: string,
  trackId: string,
): Promise<AddLocalTrackResult> {
  const track = useLocalLibraryStore
    .getState()
    .tracks.find((candidate) => candidate.id === trackId);
  if (!track) return "missing";
  const added = await useLocalPlaylistLinksStore
    .getState()
    .add(playlistId, track);
  return added ? "added" : "duplicate";
}

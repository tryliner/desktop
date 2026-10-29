import { api, toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";
import { isScopeActive, type AccountScope } from "./accountScope";

export async function fetchLikedTracks(
  scope: AccountScope,
): Promise<Track[] | null> {
  const tracks: Track[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.listLikedTracks(100, cursor);
    if (!isScopeActive(scope)) return null;
    tracks.push(
      ...page.items.map(({ track, likedAt }) => ({
        ...toClientTrack(track),
        addedAt: likedAt,
      })),
    );
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return tracks;
}

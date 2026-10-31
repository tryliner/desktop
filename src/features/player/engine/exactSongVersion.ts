import type { SearchResult } from "@/shared/contracts";
import { searchRaw } from "@/shared/youtube";
import { isAbortError } from "@/shared/utils/abort";
import type { PlayableTrack } from "./playbackStream";

const DURATION_TOLERANCE_MS = 2000;
const songVersions = new Map<string, string | null>();

type SongResult = Extract<SearchResult, { type: "track" }>;

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const isChannelId = (id: string | null | undefined): id is string =>
  Boolean(id?.startsWith("UC"));

function primaryArtist(
  track: PlayableTrack,
): { id?: string; name: string } | null {
  const listed = track.artistList?.[0];
  if (listed?.name) return { id: listed.id, name: listed.name };
  const name = track.artists.split(",")[0]?.trim();
  return name ? { name } : null;
}

function isExactSong(
  result: SearchResult,
  track: PlayableTrack,
  artist: { id?: string; name: string },
  rowVideoId: string,
): result is SongResult {
  if (result.type !== "track" || result.id === rowVideoId) return false;
  if (normalize(result.title) !== normalize(track.title)) return false;
  // an unknown length (null or 0) never proves the same recording
  if (
    !result.durationMs ||
    Math.abs(result.durationMs - track.durationMs) > DURATION_TOLERANCE_MS
  )
    return false;
  return result.artists.some((candidate) =>
    isChannelId(artist.id) && isChannelId(candidate.id)
      ? candidate.id === artist.id
      : normalize(candidate.name) === normalize(artist.name),
  );
}

export function clearExactSongVersions(): void {
  songVersions.clear();
}

export async function findExactSongVersion(
  track: PlayableTrack,
  rowVideoId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (songVersions.has(rowVideoId)) return songVersions.get(rowVideoId) ?? null;
  const artist = primaryArtist(track);
  if (!artist || !track.title.trim() || track.durationMs <= 0) return null;
  try {
    const results = await searchRaw(
      `${track.title} ${artist.name}`,
      "track",
      signal,
    );
    const match = results.find((result) =>
      isExactSong(result, track, artist, rowVideoId),
    );
    songVersions.set(rowVideoId, match?.id ?? null);
    return match?.id ?? null;
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    return null;
  }
}

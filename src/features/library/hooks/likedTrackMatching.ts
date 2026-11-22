import {
  artistsMatch,
  isSameRecording,
  recordingProfile,
} from "@/shared/media/matching";
import type { Track as CatalogTrack } from "@/shared/contracts";
import type { Track } from "@/shared/types";

export type LikeTarget = string | Track;

export function toCatalogTrack(track: Track): CatalogTrack {
  const artists =
    track.artistList?.map((artist) => ({
      id: artist.id ?? "",
      name: artist.name,
    })) ??
    track.artists
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ id: "", name }));
  return {
    id: track.id,
    title: track.title,
    artists,
    durationMs: track.durationMs,
  };
}

export function equivalentTrack(target: Track, candidate: Track): boolean {
  const targetArtists = toCatalogTrack(target).artists;
  const candidateArtists = toCatalogTrack(candidate).artists;
  if (targetArtists.length === 0 || candidateArtists.length === 0) return false;
  return (
    targetArtists.some((targetArtist) =>
      candidateArtists.some((candidateArtist) =>
        artistsMatch(targetArtist.name, candidateArtist.name),
      ),
    ) &&
    isSameRecording(
      recordingProfile(toCatalogTrack(target)),
      toCatalogTrack(candidate),
    )
  );
}

import { isSpotifyId, isSpotifyUri, toSpotifyPlaylistUrl, parseSpotifyUrl, toSpotifyUrl } from "../sources/spotify/spotifyUrl";

export function normalizeImportUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (isSpotifyId(trimmed)) {
    return toSpotifyPlaylistUrl(trimmed);
  }
  if (isSpotifyUri(trimmed)) {
    const parsed = parseSpotifyUrl(trimmed);
    return toSpotifyUrl(parsed.type, parsed.id);
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

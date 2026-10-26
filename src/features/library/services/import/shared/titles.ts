import { normalizeWords } from "@/shared/media/matching";

export function withoutArtistPrefix(
  title: string,
  artist: string | undefined,
): string {
  if (!artist) return title;
  const match = /^(.+?)\s*[-–—]\s*(.+)$/.exec(title.trim());
  return match && normalizeWords(match[1]) === normalizeWords(artist)
    ? match[2].trim()
    : title;
}

import type { Track } from "@/shared/types/track";

export type MysteryGenre =
  | "V-Pop"
  | "K-Pop"
  | "Anime / J-Pop"
  | "Hip-Hop / Rap"
  | "R&B / Soul"
  | "Rock / Metal"
  | "Electronic / EDM"
  | "Indie / Alternative"
  | "Acoustic / Ballad"
  | "Lo-Fi / Chill"
  | "Pop";

export const MYSTERY_GENRES: readonly MysteryGenre[] = [
  "V-Pop",
  "K-Pop",
  "Anime / J-Pop",
  "Hip-Hop / Rap",
  "R&B / Soul",
  "Rock / Metal",
  "Electronic / EDM",
  "Indie / Alternative",
  "Acoustic / Ballad",
  "Lo-Fi / Chill",
  "Pop",
] as const;

export interface TrackStats {
  lastPlayedTimestamp?: number;
  skipCount?: number;
  wasSkippedQuickly?: boolean;
}

/**
 * Heuristically classifies a track into one of 11 distinct genres.
 */
export function classifyGenre(track: Partial<Track>): MysteryGenre {
  const text = `${track.title ?? ""} ${track.artists ?? ""} ${track.album?.title ?? ""}`.toLowerCase();

  // 1. Vietnamese detection (Vietnamese diacritics)
  const vietnameseRegex =
    /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
  if (vietnameseRegex.test(text)) {
    return "V-Pop";
  }

  // 2. Korean detection (Hangul)
  const hangulRegex = /[\uAC00-\uD7AF\u1100-\u11FF]/;
  if (hangulRegex.test(text) || /\b(bts|blackpink|newjeans|twice|exo|aespa|le sserafim|ive|iu|txt|nct|seventeen|red velvet)\b/i.test(text)) {
    return "K-Pop";
  }

  // 3. Japanese / Anime detection (Kana/Kanji or Anime keywords)
  const japaneseRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
  if (
    japaneseRegex.test(text) ||
    /\b(anime|ost|opening|ending|yoasobi|radwimps|aimer|eve|kenshi yonezu|vaundy|lisa|ado|miku)\b/i.test(text)
  ) {
    return "Anime / J-Pop";
  }

  // 4. Lo-Fi / Chill
  if (/\b(lo-?fi|chill|chillhop|relax|sleep|coffee|study beat|ambient)\b/i.test(text)) {
    return "Lo-Fi / Chill";
  }

  // 5. Electronic / EDM
  if (/\b(edm|electro|electronic|house|dubstep|techno|dance|synthwave|trap beat|bass|remix|dj)\b/i.test(text)) {
    return "Electronic / EDM";
  }

  // 6. Hip-Hop / Rap
  if (/\b(hip-?hop|rap|rapper|trap|drill|freestyle|beatbox|mc|feat\.|ft\.)\b/i.test(text)) {
    return "Hip-Hop / Rap";
  }

  // 7. Acoustic / Ballad
  if (/\b(acoustic|ballad|unplugged|piano|guitar solo|slowed|stripped|serenade)\b/i.test(text)) {
    return "Acoustic / Ballad";
  }

  // 8. Rock / Metal
  if (/\b(rock|metal|heavy metal|punk|grunge|hard rock|indie rock|alternative rock)\b/i.test(text)) {
    return "Rock / Metal";
  }

  // 9. R&B / Soul
  if (/\b(r&b|rnb|soul|motown|funk|blues|neo-soul|groove)\b/i.test(text)) {
    return "R&B / Soul";
  }

  // 10. Indie / Alternative
  if (/\b(indie|alternative|alt-pop|folk|bedroom|shoegaze|dreampop)\b/i.test(text)) {
    return "Indie / Alternative";
  }

  // 11. Default fallback
  return "Pop";
}

/**
 * Calculates a track preference score:
 * - Recency weight: x3 for today (<24h), x2 for last 7d, x1 for older
 * - Play count: x2
 * - Skip penalty: -50% if skipped quickly (<30s)
 */
export function calculateTrackScore(
  track: Partial<Track>,
  stats?: TrackStats,
  now = Date.now(),
): number {
  const baseScore = 10;
  const playCount = track.playCount ?? 0;
  const playScore = playCount * 2;

  let recencyMultiplier = 1.0;
  if (stats?.lastPlayedTimestamp) {
    const hoursSincePlay = (now - stats.lastPlayedTimestamp) / (1000 * 60 * 60);
    if (hoursSincePlay <= 24) {
      recencyMultiplier = 3.0;
    } else if (hoursSincePlay <= 24 * 7) {
      recencyMultiplier = 2.0;
    }
  }

  let skipMultiplier = 1.0;
  if (stats?.wasSkippedQuickly) {
    skipMultiplier = 0.5;
  }

  return Math.max(1, (baseScore + playScore) * recencyMultiplier * skipMultiplier);
}

/**
 * In-place or copy Fisher-Yates shuffle algorithm.
 */
export function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Rearranges tracks to prevent adjacent tracks by the same artist where possible.
 */
export function deduplicateConsecutiveArtists(tracks: readonly Track[]): Track[] {
  if (tracks.length <= 2) return [...tracks];

  const result: Track[] = [];
  const remaining = [...tracks];

  while (remaining.length > 0) {
    const prevArtist = result[result.length - 1]?.artists?.toLowerCase();
    
    // Find next track with different artist
    let candidateIndex = remaining.findIndex(
      (t) => !prevArtist || t.artists?.toLowerCase() !== prevArtist,
    );

    if (candidateIndex === -1) {
      // If all remaining have same artist, just take the first one
      candidateIndex = 0;
    }

    const [chosen] = remaining.splice(candidateIndex, 1);
    if (chosen) result.push(chosen);
  }

  return result;
}

/**
 * Generates a serendipitous mystery queue.
 */
export function generateMysteryQueue(
  pool: readonly Track[],
  options?: {
    targetGenre?: MysteryGenre;
    count?: number;
    statsMap?: Record<string, TrackStats>;
  },
): { genre: MysteryGenre; tracks: Track[] } {
  if (pool.length === 0) {
    return { genre: options?.targetGenre ?? "Pop", tracks: [] };
  }

  // 1. Pick genre (if not specified, pick one randomly from MYSTERY_GENRES)
  const chosenGenre =
    options?.targetGenre ??
    MYSTERY_GENRES[Math.floor(Math.random() * MYSTERY_GENRES.length)]!;

  // 2. Filter tracks matching the genre if enough exist, else blend pool
  const genreMatches = pool.filter((t) => classifyGenre(t) === chosenGenre);
  const candidatePool =
    genreMatches.length >= 3 ? genreMatches : pool;

  // 3. Score tracks
  const scored = candidatePool.map((t) => ({
    track: t,
    score: calculateTrackScore(t, options?.statsMap?.[t.id]),
    jitter: Math.random() * 5,
  }));

  // Sort by weighted score + jitter
  scored.sort((a, b) => b.score + b.jitter - (a.score + a.jitter));

  const targetCount = options?.count ?? Math.min(20, Math.max(5, candidatePool.length));
  const topSlice = scored.slice(0, targetCount).map((s) => s.track);

  // 4. Shuffle and eliminate consecutive duplicate artists
  const shuffled = fisherYatesShuffle(topSlice);
  const deduplicated = deduplicateConsecutiveArtists(shuffled);

  return {
    genre: chosenGenre,
    tracks: deduplicated,
  };
}

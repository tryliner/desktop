import { useMemo } from "react";
import type { Lyric } from "@braccato/parsers";
import {
  useAiTranslateStore,
  getTranslationCacheKey,
  getRomanizationCacheKey,
} from "@/features/ai-translate";
import { useLyricsStore } from "../store/lyricsStore";

function getLineTexts(lyrics: Lyric[]): string[] {
  return lyrics.map(
    (l) => l.words || l.parts?.map((p) => p.words).join("") || "",
  );
}

function matchesSourceLines(
  cached: string[] | undefined,
  lines: string[],
): boolean {
  if (!cached) return true;
  if (cached.length !== lines.length) return false;
  return cached.every((line, idx) => line.trim() === lines[idx]?.trim());
}

export function enrichLyrics(
  braccatoLyrics: Lyric[],
  trackTranslations?: string[],
  trackRomanizations?: string[],
  targetLang = "en",
): Lyric[] {
  if (!braccatoLyrics || braccatoLyrics.length === 0) return braccatoLyrics;
  if (!trackTranslations && !trackRomanizations) return braccatoLyrics;

  return braccatoLyrics.map((line, idx) => {
    const translationText = trackTranslations?.[idx]?.trim();
    const romanizationText = trackRomanizations?.[idx]?.trim();

    if (!translationText && !romanizationText) return line;

    return {
      ...line,
      translation: translationText
        ? { text: translationText, lang: targetLang }
        : line.translation,
      romanization: romanizationText || line.romanization,
    };
  });
}

export function useEnrichedLyrics(
  currentTrackId: string | undefined,
  braccatoLyrics: Lyric[],
): Lyric[] {
  const activeProvider = useLyricsStore((s) => s.activeProvider);
  const showTranslation = useAiTranslateStore((s) => s.showTranslation);
  const showRomanization = useAiTranslateStore((s) => s.showRomanization);
  const translationsByTrackId = useAiTranslateStore(
    (s) => s.translationsByTrackId,
  );
  const romanizationsByTrackId = useAiTranslateStore(
    (s) => s.romanizationsByTrackId,
  );
  const sourceLinesByCacheKey = useAiTranslateStore(
    (s) => s.sourceLinesByCacheKey,
  );
  const sourceRomLinesByCacheKey = useAiTranslateStore(
    (s) => s.sourceRomLinesByCacheKey,
  );
  const targetLang = useAiTranslateStore((s) => s.targetLang);
  const singableMode = useAiTranslateStore((s) => s.singableMode);

  const trackTranslations = useMemo(() => {
    if (!currentTrackId || !showTranslation) return undefined;
    const key = getTranslationCacheKey(currentTrackId, targetLang, singableMode, activeProvider);
    const fallbackKey = getTranslationCacheKey(currentTrackId, targetLang, singableMode);
    const cached = translationsByTrackId[key] || translationsByTrackId[fallbackKey];
    if (!cached) return undefined;
    const sources = sourceLinesByCacheKey[key] || sourceLinesByCacheKey[fallbackKey];
    return matchesSourceLines(sources, getLineTexts(braccatoLyrics)) ? cached : undefined;
  }, [
    currentTrackId,
    showTranslation,
    targetLang,
    singableMode,
    activeProvider,
    translationsByTrackId,
    sourceLinesByCacheKey,
    braccatoLyrics,
  ]);

  const trackRomanizations = useMemo(() => {
    if (!currentTrackId || !showRomanization) return undefined;
    const key = getRomanizationCacheKey(currentTrackId, activeProvider);
    const fallbackKey = getRomanizationCacheKey(currentTrackId);
    const cached = romanizationsByTrackId[key] || romanizationsByTrackId[fallbackKey];
    if (!cached) return undefined;
    const sources = sourceRomLinesByCacheKey[key] || sourceRomLinesByCacheKey[fallbackKey];
    return matchesSourceLines(sources, getLineTexts(braccatoLyrics)) ? cached : undefined;
  }, [
    currentTrackId,
    showRomanization,
    activeProvider,
    romanizationsByTrackId,
    sourceRomLinesByCacheKey,
    braccatoLyrics,
  ]);

  return useMemo(
    () =>
      enrichLyrics(
        braccatoLyrics,
        trackTranslations,
        trackRomanizations,
        targetLang,
      ),
    [braccatoLyrics, trackTranslations, trackRomanizations, targetLang],
  );
}

import { useMemo } from "react";
import type { Lyric } from "@braccato/parsers";
import {
  useAiTranslateStore,
  getTranslationCacheKey,
  getRomanizationCacheKey,
} from "@/features/ai-translate";
import { useLyricsStore } from "../store/lyricsStore";

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
  const targetLang = useAiTranslateStore((s) => s.targetLang);
  const singableMode = useAiTranslateStore((s) => s.singableMode);

  const trackTranslations = useMemo(() => {
    if (!currentTrackId || !showTranslation) return undefined;
    return translationsByTrackId[
      getTranslationCacheKey(
        currentTrackId,
        targetLang,
        singableMode,
        activeProvider,
      )
    ];
  }, [
    currentTrackId,
    showTranslation,
    targetLang,
    singableMode,
    activeProvider,
    translationsByTrackId,
  ]);

  const trackRomanizations = useMemo(() => {
    if (!currentTrackId || !showRomanization) return undefined;
    return romanizationsByTrackId[
      getRomanizationCacheKey(currentTrackId, activeProvider)
    ];
  }, [currentTrackId, showRomanization, activeProvider, romanizationsByTrackId]);

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

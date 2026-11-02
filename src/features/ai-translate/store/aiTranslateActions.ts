import {
  translateSongLyrics,
  romanizeSongLyrics,
} from "../services/aiTranslateService";
import {
  trimCache,
  getTranslationCacheKey,
  getRomanizationCacheKey,
} from "./aiTranslateCache";
import type { AiTranslateState } from "./aiTranslateStore";

let activeTranslationCount = 0;
let activeRomanizationCount = 0;

export async function executeTrackTranslation(
  get: () => AiTranslateState,
  set: (fn: (s: AiTranslateState) => Partial<AiTranslateState>) => void,
  currentGen: () => number,
  trackId: string,
  lines: string[],
  lyricsProvider?: string | null,
): Promise<string[] | null> {
  if (!trackId || lines.length === 0) return null;
  const requestGen = currentGen();
  const { provider, apiKey, targetLang, model, baseUrl, singableMode } = get();
  const cacheKey = getTranslationCacheKey(trackId, targetLang, singableMode, lyricsProvider);
  const existing = get().translationsByTrackId[cacheKey];
  const storedSources = get().sourceLinesByCacheKey?.[cacheKey];
  if (
    existing &&
    storedSources &&
    storedSources.length === lines.length &&
    storedSources.every((line, idx) => line === lines[idx])
  ) {
    return existing;
  }

  activeTranslationCount++;
  set((s) => ({ ...s, isTranslating: true, error: null }));
  try {
    const translated = await translateSongLyrics(lines, {
      provider,
      apiKey: apiKey.trim() || undefined,
      targetLang,
      model: model.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      singableMode,
    });
    activeTranslationCount = Math.max(0, activeTranslationCount - 1);
    if (currentGen() !== requestGen) {
      if (activeTranslationCount === 0) {
        set((s) => ({ ...s, isTranslating: false }));
      }
      return null;
    }
    set((s) => ({
      isTranslating: activeTranslationCount > 0,
      translationsByTrackId: trimCache({ ...s.translationsByTrackId, [cacheKey]: translated }),
      sourceLinesByCacheKey: trimCache({ ...s.sourceLinesByCacheKey, [cacheKey]: lines }),
    }));
    return translated;
  } catch (err: unknown) {
    activeTranslationCount = Math.max(0, activeTranslationCount - 1);
    const errorMsg = err instanceof Error ? err.message : "Translation failed";
    if (currentGen() !== requestGen) {
      if (activeTranslationCount === 0) {
        set((s) => ({ ...s, isTranslating: false }));
      }
      return null;
    }
    set((s) => ({ ...s, isTranslating: activeTranslationCount > 0, error: errorMsg }));
    return null;
  }
}

export async function executeTrackRomanization(
  get: () => AiTranslateState,
  set: (fn: (s: AiTranslateState) => Partial<AiTranslateState>) => void,
  currentGen: () => number,
  trackId: string,
  lines: string[],
  lyricsProvider?: string | null,
): Promise<string[] | null> {
  if (!trackId || lines.length === 0) return null;
  const requestGen = currentGen();
  const cacheKey = getRomanizationCacheKey(trackId, lyricsProvider);
  const existing = get().romanizationsByTrackId[cacheKey];
  const storedSources = get().sourceRomLinesByCacheKey?.[cacheKey];
  if (
    existing &&
    storedSources &&
    storedSources.length === lines.length &&
    storedSources.every((line, idx) => line === lines[idx])
  ) {
    return existing;
  }

  activeRomanizationCount++;
  set((s) => ({ ...s, isRomanizing: true, error: null }));
  try {
    const { provider, apiKey, targetLang, model, baseUrl } = get();
    const romanized = await romanizeSongLyrics(lines, {
      provider,
      apiKey: apiKey.trim() || undefined,
      targetLang,
      model: model.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
    });
    activeRomanizationCount = Math.max(0, activeRomanizationCount - 1);
    if (currentGen() !== requestGen) {
      if (activeRomanizationCount === 0) {
        set((s) => ({ ...s, isRomanizing: false }));
      }
      return null;
    }
    set((s) => ({
      isRomanizing: activeRomanizationCount > 0,
      romanizationsByTrackId: trimCache({ ...s.romanizationsByTrackId, [cacheKey]: romanized }),
      sourceRomLinesByCacheKey: trimCache({ ...s.sourceRomLinesByCacheKey, [cacheKey]: lines }),
    }));
    return romanized;
  } catch (err: unknown) {
    activeRomanizationCount = Math.max(0, activeRomanizationCount - 1);
    const errorMsg = err instanceof Error ? err.message : "Romanization failed";
    if (currentGen() !== requestGen) {
      if (activeRomanizationCount === 0) {
        set((s) => ({ ...s, isRomanizing: false }));
      }
      return null;
    }
    set((s) => ({ ...s, isRomanizing: activeRomanizationCount > 0, error: errorMsg }));
    return null;
  }
}

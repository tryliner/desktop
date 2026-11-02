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
  if (existing && existing.length === lines.length) return existing;

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
    if (currentGen() !== requestGen) return null;
    set((s) => ({
      isTranslating: false,
      translationsByTrackId: trimCache({ ...s.translationsByTrackId, [cacheKey]: translated }),
    }));
    return translated;
  } catch (err: any) {
    if (currentGen() !== requestGen) return null;
    set((s) => ({ ...s, isTranslating: false, error: err.message || "Translation failed" }));
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
  if (existing && existing.length === lines.length) return existing;

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
    if (currentGen() !== requestGen) return null;
    set((s) => ({
      isRomanizing: false,
      romanizationsByTrackId: trimCache({ ...s.romanizationsByTrackId, [cacheKey]: romanized }),
    }));
    return romanized;
  } catch (err: any) {
    if (currentGen() !== requestGen) return null;
    set((s) => ({ ...s, isRomanizing: false, error: err.message || "Romanization failed" }));
    return null;
  }
}

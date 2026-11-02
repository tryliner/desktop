import {
  translateSongLyrics,
  romanizeSongLyrics,
} from "../services/aiTranslateService";
import { debouncedStorage } from "@/shared/utils/storage";
import {
  trimCache,
  getTranslationCacheKey,
  getRomanizationCacheKey,
} from "./aiTranslateCache";
import type { AiTranslateState } from "./aiTranslateStore";

let activeTranslationCount = 0;
let activeRomanizationCount = 0;

function formatErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (
      err.name === "TimeoutError" ||
      err.message.toLowerCase().includes("timeout") ||
      err.message.toLowerCase().includes("aborted")
    ) {
      return "Request timed out. The AI service took too long to respond. Please retry.";
    }
    return err.message;
  }
  return fallback;
}

function isCachedMatch(existing?: string[], sources?: string[], lines?: string[]): boolean {
  if (!existing || !lines || existing.length !== lines.length) return false;
  return !sources || sources.every((l, i) => l.trim() === lines[i]?.trim());
}

function saveDualCache(
  cache: Record<string, string[]>, k1: string, k2: string, val: string[],
): Record<string, string[]> {
  return trimCache({ ...cache, [k1]: val, [k2]: val });
}

export function resetActiveRequestCounts(): void {
  activeTranslationCount = 0;
  activeRomanizationCount = 0;
}

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
  const fallbackKey = getTranslationCacheKey(trackId, targetLang, singableMode);
  const existing = get().translationsByTrackId[cacheKey] || get().translationsByTrackId[fallbackKey];
  const sources = get().sourceLinesByCacheKey?.[cacheKey] || get().sourceLinesByCacheKey?.[fallbackKey];
  if (isCachedMatch(existing, sources, lines)) return existing;

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
    if (currentGen() !== requestGen) return null;
    activeTranslationCount = Math.max(0, activeTranslationCount - 1);
    set((s) => ({
      isTranslating: activeTranslationCount > 0,
      translationsByTrackId: saveDualCache(s.translationsByTrackId, cacheKey, fallbackKey, translated),
      sourceLinesByCacheKey: saveDualCache(s.sourceLinesByCacheKey, cacheKey, fallbackKey, lines),
    }));
    debouncedStorage.flush();
    return translated;
  } catch (err: unknown) {
    if (currentGen() !== requestGen) return null;
    activeTranslationCount = Math.max(0, activeTranslationCount - 1);
    const errorMsg = formatErrorMessage(err, "Translation failed");
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
  const fallbackKey = getRomanizationCacheKey(trackId);
  const existing = get().romanizationsByTrackId[cacheKey] || get().romanizationsByTrackId[fallbackKey];
  const sources = get().sourceRomLinesByCacheKey?.[cacheKey] || get().sourceRomLinesByCacheKey?.[fallbackKey];
  if (isCachedMatch(existing, sources, lines)) return existing;

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
    if (currentGen() !== requestGen) return null;
    activeRomanizationCount = Math.max(0, activeRomanizationCount - 1);
    const hasNonEmpty = romanized.some((l) => l.trim().length > 0);
    if (hasNonEmpty) {
      set((s) => ({
        isRomanizing: activeRomanizationCount > 0,
        romanizationsByTrackId: saveDualCache(s.romanizationsByTrackId, cacheKey, fallbackKey, romanized),
        sourceRomLinesByCacheKey: saveDualCache(s.sourceRomLinesByCacheKey, cacheKey, fallbackKey, lines),
      }));
      debouncedStorage.flush();
    } else {
      set((s) => ({ ...s, isRomanizing: activeRomanizationCount > 0 }));
    }
    return romanized;
  } catch (err: unknown) {
    if (currentGen() !== requestGen) return null;
    activeRomanizationCount = Math.max(0, activeRomanizationCount - 1);
    const errorMsg = formatErrorMessage(err, "Romanization failed");
    set((s) => ({ ...s, isRomanizing: activeRomanizationCount > 0, error: errorMsg }));
    return null;
  }
}

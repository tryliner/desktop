import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AiProvider } from "../types";
import {
  translateSongLyrics,
  romanizeSongLyrics,
} from "../services/aiTranslateService";

const MAX_CACHE_ENTRIES = 500;
let configGeneration = 0;

function trimCache(
  cache: Record<string, string[]>,
  max = MAX_CACHE_ENTRIES,
): Record<string, string[]> {
  const keys = Object.keys(cache);
  if (keys.length <= max) return cache;
  const pruned: Record<string, string[]> = {};
  for (const k of keys.slice(keys.length - max)) {
    pruned[k] = cache[k];
  }
  return pruned;
}

export function getTranslationCacheKey(
  trackId: string,
  targetLang: string,
  singableMode = false,
  provider?: string | null,
): string {
  const base = singableMode
    ? `${trackId}:${targetLang}:singable`
    : `${trackId}:${targetLang}`;
  return provider ? `${base}:${provider}` : base;
}

export function getRomanizationCacheKey(
  trackId: string,
  provider?: string | null,
): string {
  return provider ? `${trackId}:${provider}` : trackId;
}

export interface AiTranslateState {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  singableMode: boolean;
  targetLang: string;
  showTranslation: boolean;
  showRomanization: boolean;
  isTranslating: boolean;
  isRomanizing: boolean;
  error: string | null;
  translationsByTrackId: Record<string, string[]>;
  romanizationsByTrackId: Record<string, string[]>;

  setProvider: (provider: AiProvider) => void;
  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  setSingableMode: (enabled: boolean) => void;
  toggleSingableMode: () => void;
  setTargetLang: (lang: string) => void;
  setShowTranslation: (show: boolean) => void;
  setShowRomanization: (show: boolean) => void;
  toggleTranslation: () => void;
  toggleRomanization: () => void;
  clearCache: () => void;

  translateTrackLyrics: (
    trackId: string,
    lines: string[],
    lyricsProvider?: string | null,
  ) => Promise<string[] | null>;

  romanizeTrackLyrics: (
    trackId: string,
    lines: string[],
    lyricsProvider?: string | null,
  ) => Promise<string[] | null>;
}

export const useAiTranslateStore = create<AiTranslateState>()(
  persist(
    (set, get) => ({
      provider: "gemini",
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      model: "",
      singableMode: false,
      targetLang: "en",
      showTranslation: true,
      showRomanization: true,
      isTranslating: false,
      isRomanizing: false,
      error: null,
      translationsByTrackId: {},
      romanizationsByTrackId: {},

      setProvider: (provider) => {
        configGeneration++;
        set({
          provider,
          error: null,
          translationsByTrackId: {},
          romanizationsByTrackId: {},
        });
      },
      setApiKey: (apiKey) => set({ apiKey, error: null }),
      setBaseUrl: (baseUrl) => {
        configGeneration++;
        set({
          baseUrl,
          error: null,
          translationsByTrackId: {},
          romanizationsByTrackId: {},
        });
      },
      setModel: (model) => {
        configGeneration++;
        set({
          model,
          error: null,
          translationsByTrackId: {},
          romanizationsByTrackId: {},
        });
      },
      setSingableMode: (singableMode) => set({ singableMode }),
      toggleSingableMode: () =>
        set((s) => ({ singableMode: !s.singableMode })),
      setTargetLang: (targetLang) => set({ targetLang }),
      setShowTranslation: (showTranslation) => set({ showTranslation }),
      setShowRomanization: (showRomanization) => set({ showRomanization }),
      toggleTranslation: () =>
        set((s) => ({ showTranslation: !s.showTranslation })),
      toggleRomanization: () =>
        set((s) => ({ showRomanization: !s.showRomanization })),
      clearCache: () => {
        configGeneration++;
        set({ translationsByTrackId: {}, romanizationsByTrackId: {} });
      },

      translateTrackLyrics: async (
        trackId: string,
        lines: string[],
        lyricsProvider?: string | null,
      ) => {
        if (!trackId || lines.length === 0) return null;
        const requestGen = configGeneration;
        const { provider, apiKey, targetLang, model, baseUrl, singableMode } = get();
        const cacheKey = getTranslationCacheKey(
          trackId,
          targetLang,
          singableMode,
          lyricsProvider,
        );
        const existing = get().translationsByTrackId[cacheKey];
        if (existing && existing.length === lines.length) {
          return existing;
        }

        set({ isTranslating: true, error: null });
        try {
          const translated = await translateSongLyrics(lines, {
            provider,
            apiKey: apiKey.trim() || undefined,
            targetLang,
            model: model.trim() || undefined,
            baseUrl: baseUrl.trim() || undefined,
            singableMode,
          });

          if (configGeneration !== requestGen) return null;

          set((s) => ({
            isTranslating: false,
            translationsByTrackId: trimCache({
              ...s.translationsByTrackId,
              [cacheKey]: translated,
            }),
          }));
          return translated;
        } catch (err: any) {
          if (configGeneration !== requestGen) return null;
          const errorMsg = err.message || "Translation failed";
          set({
            isTranslating: false,
            error: errorMsg,
          });
          return null;
        }
      },

      romanizeTrackLyrics: async (
        trackId: string,
        lines: string[],
        lyricsProvider?: string | null,
      ) => {
        if (!trackId || lines.length === 0) return null;
        const requestGen = configGeneration;
        const cacheKey = getRomanizationCacheKey(trackId, lyricsProvider);
        const existing = get().romanizationsByTrackId[cacheKey];
        if (existing && existing.length === lines.length) {
          return existing;
        }

        set({ isRomanizing: true, error: null });
        try {
          const { provider, apiKey, targetLang, model, baseUrl } = get();
          const romanized = await romanizeSongLyrics(lines, {
            provider,
            apiKey: apiKey.trim() || undefined,
            targetLang,
            model: model.trim() || undefined,
            baseUrl: baseUrl.trim() || undefined,
          });

          if (configGeneration !== requestGen) return null;

          set((s) => ({
            isRomanizing: false,
            romanizationsByTrackId: trimCache({
              ...s.romanizationsByTrackId,
              [cacheKey]: romanized,
            }),
          }));
          return romanized;
        } catch (err: any) {
          if (configGeneration !== requestGen) return null;
          const errorMsg = err.message || "Romanization failed";
          set({
            isRomanizing: false,
            error: errorMsg,
          });
          return null;
        }
      },
    }),
    {
      name: "liner_ai_translate_v1",
      version: 2,
      storage: createJSONStorage(() => ({
        getItem: (name: string) => {
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name: string, value: string) => {
          try {
            localStorage.setItem(name, value);
          } catch (err) {
            console.warn("[aiTranslateStore] Persistence write failed:", err);
          }
        },
        removeItem: (name: string) => {
          try {
            localStorage.removeItem(name);
          } catch {}
        },
      })),
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Partial<AiTranslateState>;
        if (version < 2) {
          return {
            ...state,
            translationsByTrackId: {},
            romanizationsByTrackId: {},
          } as AiTranslateState;
        }
        return state as AiTranslateState;
      },
      partialize: (state) => ({
        provider: state.provider,
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        model: state.model,
        singableMode: state.singableMode,
        targetLang: state.targetLang,
        showTranslation: state.showTranslation,
        showRomanization: state.showRomanization,
        translationsByTrackId: state.translationsByTrackId,
        romanizationsByTrackId: state.romanizationsByTrackId,
      }),
    },
  ),
);

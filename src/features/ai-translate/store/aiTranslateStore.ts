import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AiProvider } from "../types";
import {
  translateSongLyrics,
  romanizeSongLyrics,
} from "../services/aiTranslateService";

export function getTranslationCacheKey(
  trackId: string,
  targetLang: string,
  singableMode = false,
): string {
  return singableMode
    ? `${trackId}:${targetLang}:singable`
    : `${trackId}:${targetLang}`;
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
  ) => Promise<string[] | null>;

  romanizeTrackLyrics: (
    trackId: string,
    lines: string[],
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

      setProvider: (provider) => set({ provider, error: null }),
      setApiKey: (apiKey) => set({ apiKey, error: null }),
      setBaseUrl: (baseUrl) => set({ baseUrl, error: null }),
      setModel: (model) => set({ model, error: null }),
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
      clearCache: () =>
        set({ translationsByTrackId: {}, romanizationsByTrackId: {} }),

      translateTrackLyrics: async (trackId: string, lines: string[]) => {
        if (!trackId || lines.length === 0) return null;
        const { provider, apiKey, targetLang, model, baseUrl, singableMode } = get();
        const cacheKey = getTranslationCacheKey(trackId, targetLang, singableMode);
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

          set((s) => ({
            isTranslating: false,
            translationsByTrackId: {
              ...s.translationsByTrackId,
              [cacheKey]: translated,
            },
          }));
          return translated;
        } catch (err: any) {
          const errorMsg = err.message || "Translation failed";
          set({
            isTranslating: false,
            error: errorMsg,
          });
          return null;
        }
      },

      romanizeTrackLyrics: async (trackId: string, lines: string[]) => {
        if (!trackId || lines.length === 0) return null;
        const existing = get().romanizationsByTrackId[trackId];
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

          set((s) => ({
            isRomanizing: false,
            romanizationsByTrackId: {
              ...s.romanizationsByTrackId,
              [trackId]: romanized,
            },
          }));
          return romanized;
        } catch (err: any) {
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

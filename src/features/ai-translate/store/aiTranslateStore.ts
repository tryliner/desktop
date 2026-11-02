import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import type { AiProvider } from "../types";
import {
  executeTrackTranslation,
  executeTrackRomanization,
  resetActiveRequestCounts,
} from "./aiTranslateActions";

export * from "./aiTranslateCache";

let configGeneration = 0;

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
  sourceLinesByCacheKey: Record<string, string[]>;
  sourceRomLinesByCacheKey: Record<string, string[]>;

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
      baseUrl: "",
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
      sourceLinesByCacheKey: {},
      sourceRomLinesByCacheKey: {},

      setProvider: (provider) => {
        configGeneration++;
        resetActiveRequestCounts();
        set({ provider, error: null, isTranslating: false, isRomanizing: false });
      },
      setApiKey: (apiKey) => set({ apiKey, error: null }),
      setBaseUrl: (baseUrl) => {
        configGeneration++;
        resetActiveRequestCounts();
        set({ baseUrl, error: null, isTranslating: false, isRomanizing: false });
      },
      setModel: (model) => {
        configGeneration++;
        resetActiveRequestCounts();
        set({ model, error: null, isTranslating: false, isRomanizing: false });
      },
      setSingableMode: (singableMode) => set({ singableMode }),
      toggleSingableMode: () => set((s) => ({ singableMode: !s.singableMode })),
      setTargetLang: (targetLang) => set({ targetLang }),
      setShowTranslation: (showTranslation) => set({ showTranslation }),
      setShowRomanization: (showRomanization) => set({ showRomanization }),
      toggleTranslation: () => set((s) => ({ showTranslation: !s.showTranslation })),
      toggleRomanization: () => set((s) => ({ showRomanization: !s.showRomanization })),
      clearCache: () => {
        configGeneration++;
        resetActiveRequestCounts();
        set({ isTranslating: false, isRomanizing: false, translationsByTrackId: {}, romanizationsByTrackId: {}, sourceLinesByCacheKey: {}, sourceRomLinesByCacheKey: {} });
        debouncedStorage.flush();
      },

      translateTrackLyrics: (trackId, lines, lyricsProvider) =>
        executeTrackTranslation(get, set, () => configGeneration, trackId, lines, lyricsProvider),

      romanizeTrackLyrics: (trackId, lines, lyricsProvider) =>
        executeTrackRomanization(get, set, () => configGeneration, trackId, lines, lyricsProvider),
    }),
    {
      name: "liner_ai_translate_v1",
      version: 4,
      storage: createJSONStorage(() => debouncedStorage),
      migrate: (persisted: unknown) => {
        const state = (persisted ?? {}) as Partial<AiTranslateState>;
        return {
          ...state,
          translationsByTrackId: state.translationsByTrackId ?? {},
          romanizationsByTrackId: state.romanizationsByTrackId ?? {},
          sourceLinesByCacheKey: state.sourceLinesByCacheKey ?? {},
          sourceRomLinesByCacheKey: state.sourceRomLinesByCacheKey ?? {},
        } as AiTranslateState;
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
        sourceLinesByCacheKey: state.sourceLinesByCacheKey,
        sourceRomLinesByCacheKey: state.sourceRomLinesByCacheKey,
      }),
    },
  ),
);

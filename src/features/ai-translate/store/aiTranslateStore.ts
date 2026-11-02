import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AiProvider } from "../types";
import {
  executeTrackTranslation,
  executeTrackRomanization,
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
        set({ provider, error: null, translationsByTrackId: {}, romanizationsByTrackId: {} });
      },
      setApiKey: (apiKey) => set({ apiKey, error: null }),
      setBaseUrl: (baseUrl) => {
        configGeneration++;
        set({ baseUrl, error: null, translationsByTrackId: {}, romanizationsByTrackId: {} });
      },
      setModel: (model) => {
        configGeneration++;
        set({ model, error: null, translationsByTrackId: {}, romanizationsByTrackId: {} });
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
        set({ translationsByTrackId: {}, romanizationsByTrackId: {} });
      },

      translateTrackLyrics: (trackId, lines, lyricsProvider) =>
        executeTrackTranslation(get, set, () => configGeneration, trackId, lines, lyricsProvider),

      romanizeTrackLyrics: (trackId, lines, lyricsProvider) =>
        executeTrackRomanization(get, set, () => configGeneration, trackId, lines, lyricsProvider),
    }),
    {
      name: "liner_ai_translate_v1",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Partial<AiTranslateState>;
        return version < 2
          ? ({ ...state, translationsByTrackId: {}, romanizationsByTrackId: {} } as AiTranslateState)
          : (state as AiTranslateState);
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

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import type { RomanizationMode } from "../engine/romanizationPreference";

export interface LyricsDisplayState {
  romanization: boolean;
  setRomanization: (enabled: boolean) => void;
  languageOverrides: Record<string, RomanizationMode>;
  setLanguageOverride: (key: string, mode: RomanizationMode) => void;
}

export const useLyricsDisplayStore = create<LyricsDisplayState>()(
  persist(
    (set) => ({
      romanization: false,
      setRomanization: (enabled) => set({ romanization: enabled }),
      languageOverrides: {},
      setLanguageOverride: (key, mode) =>
        set((state) => {
          const overrides = { ...state.languageOverrides };
          delete overrides[key];
          if (mode !== "auto") overrides[key] = mode;
          return {
            languageOverrides: Object.fromEntries(
              Object.entries(overrides).slice(-256),
            ),
          };
        }),
    }),
    {
      name: "liner_lyrics_display_v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({
        romanization: state.romanization,
        languageOverrides: state.languageOverrides,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<LyricsDisplayState> | null;
        const overrides = Object.entries(saved?.languageOverrides ?? {})
          .filter(
            ([, mode]) => mode === "ja" || mode === "zh" || mode === "off",
          )
          .slice(-256);
        return {
          ...current,
          romanization:
            typeof saved?.romanization === "boolean"
              ? saved.romanization
              : current.romanization,
          languageOverrides: Object.fromEntries(overrides),
        };
      },
    },
  ),
);

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";

export interface LyricsDisplayState {
  romanization: boolean;
  setRomanization: (enabled: boolean) => void;
}

export const useLyricsDisplayStore = create<LyricsDisplayState>()(
  persist(
    (set) => ({
      romanization: false,
      setRomanization: (enabled) => set({ romanization: enabled }),
    }),
    {
      name: "liner_lyrics_display_v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({ romanization: state.romanization }),
    },
  ),
);

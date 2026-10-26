import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import { parseRawLyrics, applyLyricsOffset } from "../engine/lyricsParser";
import type { LyricsState } from "./lyricsState";
import {
  getLyricsStateUpdate,
  getLyricsOffsetUpdate,
} from "./lyricsStateUpdates";

export { hasSyncedLyricsSources } from "./lyricsState";
export type { LyricsProviderOption, LyricsState } from "./lyricsState";

const LYRICS_SESSION_STORAGE_KEY = "liner_lyrics_session_v1";

export const useLyricsStore = create<LyricsState>()(
  persist(
    (set, get) => ({
      lyricsLoading: false,
      lyricsError: null,
      rawLyrics: null,
      rawFormat: null,
      baseBraccatoLyrics: [],
      baseSyncedLines: [],
      braccatoLyrics: [],
      syncedLines: [],
      plainLyrics: null,
      lyricsQuality: 0,
      currentLyricsTrackId: null,
      activeProvider: null,
      availableProviders: [],
      offsetMs: 0,
      trackOffsets: {},
      activeLineIndex: null,
      showPronunciation: false,

      setShowPronunciation: (showPronunciation) => set({ showPronunciation }),

      setActiveLineIndex: (index) => {
        if (get().activeLineIndex === index) return;
        set({ activeLineIndex: index });
      },

      setLyricsState: (state) => set(getLyricsStateUpdate(get(), state)),

      selectProvider: (providerName: string) => {
        const { availableProviders, offsetMs } = get();
        const option = availableProviders.find(
          (p) => p.provider === providerName,
        );
        if (!option) return;

        try {
          const parsed = parseRawLyrics(
            option.candidate.lyrics.content,
            option.candidate.lyrics.format,
          );

          const adjusted = applyLyricsOffset(
            {
              braccatoLyrics: parsed.braccatoLyrics,
              syncedLines: parsed.syncedLines,
            },
            offsetMs,
          );

          set({
            activeProvider: option.provider,
            rawLyrics: option.candidate.lyrics.content,
            rawFormat: option.candidate.lyrics.format,
            baseBraccatoLyrics: parsed.braccatoLyrics,
            baseSyncedLines: parsed.syncedLines,
            braccatoLyrics: adjusted.braccatoLyrics,
            syncedLines: adjusted.syncedLines,
            plainLyrics: parsed.plainLyrics,
            lyricsQuality: option.quality,
          });
        } catch {
          set({
            activeProvider: option.provider,
            rawLyrics: option.candidate.lyrics.content,
            rawFormat: option.candidate.lyrics.format,
            baseBraccatoLyrics: [],
            baseSyncedLines: [],
            braccatoLyrics: [],
            syncedLines: [],
            plainLyrics: option.candidate.lyrics.content,
            lyricsQuality: option.quality,
          });
        }
      },

      setOffset: (offsetMs) => set(getLyricsOffsetUpdate(get(), offsetMs)),

      adjustOffset: (deltaMs: number) => {
        const { offsetMs, setOffset } = get();
        setOffset(offsetMs + deltaMs);
      },

      resetOffset: () => {
        get().setOffset(0);
      },

      reset: () =>
        set({
          lyricsLoading: false,
          lyricsError: null,
          rawLyrics: null,
          rawFormat: null,
          baseBraccatoLyrics: [],
          baseSyncedLines: [],
          braccatoLyrics: [],
          syncedLines: [],
          plainLyrics: null,
          lyricsQuality: 0,
          currentLyricsTrackId: null,
          activeProvider: null,
          availableProviders: [],
          offsetMs: 0,
          activeLineIndex: null,
        }),
    }),
    {
      name: LYRICS_SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => debouncedStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.lyricsLoading = false;
          state.lyricsError = null;
          if (!state.trackOffsets) {
            state.trackOffsets = {};
          }
        }
      },
      partialize: (state) => ({
        currentLyricsTrackId: state.currentLyricsTrackId,
        trackOffsets: state.trackOffsets,
        showPronunciation: state.showPronunciation,
      }),
    },
  ),
);

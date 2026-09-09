import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import {
  parseRawLyrics,
  applyLyricsOffset,
  type WordData,
} from "../engine/lyricsParser";
import type { Lyric } from "@braccato/parsers";
import type { LyricsCandidate, LyricsSyncLevel } from "@/shared/contracts/lyrics";

export interface LyricsProviderOption {
  provider: string;
  syncLevel: LyricsSyncLevel;
  quality: number;
  candidate: LyricsCandidate;
}

export interface LyricsState {
  lyricsLoading: boolean;
  lyricsError: string | null;
  rawLyrics: string | null;
  rawFormat: string | null;
  baseBraccatoLyrics: Lyric[];
  baseSyncedLines: { timeMs: number; text: string; words?: WordData[] }[];
  braccatoLyrics: Lyric[];
  syncedLines: { timeMs: number; text: string; words?: WordData[] }[];
  plainLyrics: string | null;
  lyricsQuality: number;
  currentLyricsTrackId: string | null;
  activeProvider: string | null;
  availableProviders: LyricsProviderOption[];
  offsetMs: number;
  trackOffsets: Record<string, number>;

  setLyricsState: (
    state: Partial<
      Omit<
        LyricsState,
        | "setLyricsState"
        | "reset"
        | "selectProvider"
        | "setOffset"
        | "adjustOffset"
        | "resetOffset"
      >
    >,
  ) => void;
  selectProvider: (providerName: string) => void;
  setOffset: (offsetMs: number) => void;
  adjustOffset: (deltaMs: number) => void;
  resetOffset: () => void;
  reset: () => void;
}

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

      setLyricsState: (state) => {
        const current = get();
        const nextTrackId =
          state.currentLyricsTrackId !== undefined
            ? state.currentLyricsTrackId
            : current.currentLyricsTrackId;
        const isNewTrack =
          state.currentLyricsTrackId !== undefined &&
          state.currentLyricsTrackId !== current.currentLyricsTrackId;

        const offset =
          state.offsetMs !== undefined
            ? state.offsetMs
            : isNewTrack
              ? nextTrackId && current.trackOffsets?.[nextTrackId]
                ? current.trackOffsets[nextTrackId]
                : 0
              : current.offsetMs;

        let baseBraccato =
          state.baseBraccatoLyrics ??
          state.braccatoLyrics ??
          (isNewTrack ? [] : current.baseBraccatoLyrics);
        let baseSynced =
          state.baseSyncedLines ??
          state.syncedLines ??
          (isNewTrack ? [] : current.baseSyncedLines);

        const adjusted = applyLyricsOffset(
          { braccatoLyrics: baseBraccato, syncedLines: baseSynced },
          offset,
        );

        set({
          ...state,
          offsetMs: offset,
          baseBraccatoLyrics: baseBraccato,
          baseSyncedLines: baseSynced,
          braccatoLyrics: adjusted.braccatoLyrics,
          syncedLines: adjusted.syncedLines,
        });
      },

      selectProvider: (providerName: string) => {
        const { availableProviders, offsetMs } = get();
        const option = availableProviders.find((p) => p.provider === providerName);
        if (!option) return;

        const parsed = parseRawLyrics(
          option.candidate.lyrics.content,
          option.candidate.lyrics.format,
        );

        const adjusted = applyLyricsOffset(
          { braccatoLyrics: parsed.braccatoLyrics, syncedLines: parsed.syncedLines },
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
      },

      setOffset: (offsetMs: number) => {
        const {
          baseBraccatoLyrics,
          baseSyncedLines,
          currentLyricsTrackId,
          trackOffsets,
        } = get();

        const adjusted = applyLyricsOffset(
          { braccatoLyrics: baseBraccatoLyrics, syncedLines: baseSyncedLines },
          offsetMs,
        );

        const updatedTrackOffsets = { ...(trackOffsets || {}) };
        if (currentLyricsTrackId) {
          if (offsetMs === 0) {
            delete updatedTrackOffsets[currentLyricsTrackId];
          } else {
            updatedTrackOffsets[currentLyricsTrackId] = offsetMs;
          }
        }

        set({
          offsetMs,
          braccatoLyrics: adjusted.braccatoLyrics,
          syncedLines: adjusted.syncedLines,
          trackOffsets: updatedTrackOffsets,
        });
      },

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
      }),
    },
  ),
);


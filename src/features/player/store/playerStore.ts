import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Track } from "@/shared/types";
import { debouncedStorage } from "@/shared/utils/storage";

export { debouncedStorage };

export type RepeatMode = "off" | "all" | "one";
export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";
export type MiniPlayerStyle = "default" | "rounded";
export type AudioQuality = "low" | "standard" | "high" | "lossless";
export type TrackDoubleClickBehavior = "play" | "queue";
export type DefaultPlaybackContext = "resume" | "empty";
export type AccentVariant =
  | "default"
  | "spotify"
  | "discord"
  | "telegram"
  | "aurora"
  | "sunset"
  | "ocean"
  | "forest"
  | "berry"
  | "carbon"
  | "pixel"
  | "scanlines"
  | "vhs";

export interface TransportState {
  status: PlayerStatus;
  playbackMode: "hls" | "mp3" | null;
  error: string | null;
}

export interface TimelineState {
  positionMs: number;
  durationMs: number;
}

export interface QueueState {
  queue: Track[];
  currentIndex: number;
  currentTrack: Track | null;
  playbackContext: string | null;
  playbackContextCover: string | null;
}

export interface SessionState {
  volume: number;
  repeat: RepeatMode;
  shuffle: boolean;
  audioQuality: AudioQuality;
  miniPlayerStyle: MiniPlayerStyle;
  accentVariant: AccentVariant;
  pauseOnDeviceChange: boolean;
  autoplaySimilar: boolean;
  trackDoubleClickBehavior: TrackDoubleClickBehavior;
  defaultPlaybackContext: DefaultPlaybackContext;
  fullscreen: boolean;
}

export type PlayerState = TransportState &
  TimelineState &
  QueueState &
  SessionState;

export type PlayerCommand =
  | {
      type: "PLAY_REQUESTED";
      track: Track;
      queue?: Track[];
      context?: string | null;
      contextCover?: string | null;
    }
  | { type: "PAUSE_REQUESTED" }
  | { type: "RESUME_REQUESTED" }
  | { type: "SEEK_COMMITTED"; positionMs: number }
  | { type: "SKIP_NEXT"; isAutoEnd?: boolean }
  | { type: "SKIP_PREVIOUS" }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "TOGGLE_PLAY_PAUSE" };

export interface PlayerStore extends PlayerState {
  dispatch: (command: PlayerCommand) => void;
  setStatus: (status: PlayerStatus, error?: string | null) => void;
  setPosition: (positionMs: number) => void;
  setDuration: (durationMs: number) => void;
  setPlaybackMode: (mode: "hls" | "mp3" | null) => void;
  setRepeat: (mode: RepeatMode) => void;
  setShuffle: (shuffle: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTrack: (track: Track | null, index: number) => void;
  setQueue: (queue: Track[]) => void;
  setPlaybackContext: (context: string | null) => void;
  setPlaybackContextCover: (cover: string | null) => void;
  setAudioQuality: (quality: AudioQuality) => void;
  setMiniPlayerStyle: (style: MiniPlayerStyle) => void;
  setAccentVariant: (variant: AccentVariant) => void;
  setPauseOnDeviceChange: (value: boolean) => void;
  setAutoplaySimilar: (value: boolean) => void;
  setTrackDoubleClickBehavior: (value: TrackDoubleClickBehavior) => void;
  setDefaultPlaybackContext: (value: DefaultPlaybackContext) => void;
  setFullscreen: (value: boolean) => void;
  clearQueue: () => void;
}

const PLAYER_SESSION_STORAGE_KEY = "liner_player_session_v2";

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      // TransportSlice
      status: "idle",
      playbackMode: null,
      error: null,

      // TimelineSlice
      positionMs: 0,
      durationMs: 0,

      // QueueSlice
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      playbackContext: null,
      playbackContextCover: null,

      // SessionSlice
      volume: 1,
      repeat: "off",
      shuffle: false,
      audioQuality: "high",
      miniPlayerStyle: "default",
      accentVariant: "default",
      pauseOnDeviceChange: true,
      autoplaySimilar: true,
      trackDoubleClickBehavior: "play",
      defaultPlaybackContext: "resume",
      fullscreen: false,

      dispatch: () => {
        // Implementation injected by PlayerEngine
      },

      setStatus: (status, error = null) => set({ status, error }),
      setPosition: (positionMs) => set({ positionMs }),
      setDuration: (durationMs) => set({ durationMs }),
      setPlaybackMode: (playbackMode) => set({ playbackMode }),
      setRepeat: (repeat) => set({ repeat }),
      setShuffle: (shuffle) => set({ shuffle }),
      setVolume: (volume) => set({ volume }),
      setCurrentTrack: (currentTrack, currentIndex) => {
        const prev = get().currentTrack;
        const isDifferent = prev?.id !== currentTrack?.id;
        set({
          currentTrack,
          currentIndex,
          ...(isDifferent ? { positionMs: 0 } : {}),
        });
      },
      setQueue: (queue) => set({ queue }),
      setPlaybackContext: (playbackContext) => set({ playbackContext }),
      setPlaybackContextCover: (playbackContextCover) =>
        set({ playbackContextCover }),
      setAudioQuality: (audioQuality) => set({ audioQuality }),
      setMiniPlayerStyle: (miniPlayerStyle: MiniPlayerStyle) =>
        set({ miniPlayerStyle }),
      setAccentVariant: (accentVariant: AccentVariant) =>
        set({ accentVariant }),
      setPauseOnDeviceChange: (pauseOnDeviceChange: boolean) =>
        set({ pauseOnDeviceChange }),
      setAutoplaySimilar: (autoplaySimilar: boolean) =>
        set({ autoplaySimilar }),
      setTrackDoubleClickBehavior: (trackDoubleClickBehavior: TrackDoubleClickBehavior) =>
        set({ trackDoubleClickBehavior }),
      setDefaultPlaybackContext: (defaultPlaybackContext: DefaultPlaybackContext) =>
        set({ defaultPlaybackContext }),
      setFullscreen: (fullscreen: boolean) => set({ fullscreen }),
      clearQueue: () => {
        const state = get();
        if (state.currentTrack) {
          set({
            queue: [state.currentTrack],
            currentIndex: 0,
            playbackContext: null,
            playbackContextCover: null,
          });
        } else {
          set({
            queue: [],
            currentIndex: -1,
            currentTrack: null,
            playbackContext: null,
            playbackContextCover: null,
            fullscreen: false,
          });
        }
      },
    }),
    {
      name: PLAYER_SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => debouncedStorage),
      onRehydrateStorage: () => (state) => {
        // After hydration, if a track was saved, restore as paused so the UI
        // shows the track and position without auto-playing.
        if (state?.currentTrack) {
          state.status = "paused";
        }
        // Guard against a persisted accent variant that no longer exists.
        const validVariants: AccentVariant[] = [
          "default",
          "spotify",
          "discord",
          "telegram",
          "aurora",
          "sunset",
          "ocean",
          "forest",
          "berry",
          "carbon",
          "pixel",
          "scanlines",
          "vhs",
        ];
        if (state && !validVariants.includes(state.accentVariant)) {
          state.accentVariant = "default";
        }
      },
      partialize: (state) => ({
        ...(state.defaultPlaybackContext === "resume"
          ? {
              queue: state.queue,
              currentIndex: state.currentIndex,
              currentTrack: state.currentTrack,
              playbackContext: state.playbackContext,
              playbackContextCover: state.playbackContextCover,
              playbackMode: state.playbackMode,
              positionMs: state.positionMs,
              durationMs: state.durationMs,
            }
          : {}),
        repeat: state.repeat,
        shuffle: state.shuffle,
        volume: state.volume,
        audioQuality: state.audioQuality,
        miniPlayerStyle: state.miniPlayerStyle,
        accentVariant: state.accentVariant,
        pauseOnDeviceChange: state.pauseOnDeviceChange,
        autoplaySimilar: state.autoplaySimilar,
        trackDoubleClickBehavior: state.trackDoubleClickBehavior,
        defaultPlaybackContext: state.defaultPlaybackContext,
      }),
    },
  ),
);

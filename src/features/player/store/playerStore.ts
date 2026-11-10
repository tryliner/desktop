import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "@/shared/types";
import {
  createIncrementalJSONStorage,
  debouncedStorage,
} from "@/shared/utils/storage";
import {
  FLAT_EQ,
  normalizeEqCustomPresets,
  normalizeEqGains,
  type EqCustomPreset,
} from "../engine/equalizer";
import { clampCrossfadeSeconds } from "../engine/crossfade";

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
  playbackRate: number;
  pitchSemitones: number;
  isPitchLinked: boolean;
  keepSpeedAcrossTracks: boolean;
  crossfadeSeconds: number;
  isReverbEnabled: boolean;
  reverbLevel: number;
  isEqEnabled: boolean;
  eqGains: number[];
  eqCustomPresets: EqCustomPreset[];
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
  | { type: "SET_PLAYBACK_RATE"; rate: number }
  | { type: "SET_PITCH_SEMITONES"; semitones: number }
  | { type: "SET_REVERB_ENABLED"; enabled: boolean }
  | { type: "SET_REVERB_LEVEL"; level: number }
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
  setPlaybackRate: (rate: number) => void;
  setPitchSemitones: (semitones: number) => void;
  setIsPitchLinked: (linked: boolean) => void;
  setKeepSpeedAcrossTracks: (keep: boolean) => void;
  setCrossfadeSeconds: (seconds: number) => void;
  setIsReverbEnabled: (enabled: boolean) => void;
  setReverbLevel: (level: number) => void;
  setIsEqEnabled: (enabled: boolean) => void;
  setEqGains: (gains: number[]) => void;
  setEqCustomPresets: (presets: EqCustomPreset[]) => void;
  resetSpeedAndPitch: () => void;
  clearQueue: () => void;
  resetPlayback: () => void;
}

const PLAYER_SESSION_STORAGE_KEY = "liner_player_session_v2";
const PLAYER_RESUME_STORAGE_KEY = "liner_player_resume_v1";
const RESUME_SAVE_INTERVAL_MS = 10_000;

interface ResumePosition {
  trackId: string;
  positionMs: number;
}

function readResumePosition(): ResumePosition | null {
  try {
    const raw = debouncedStorage.getItem(PLAYER_RESUME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ResumePosition> | null;
    if (
      typeof parsed?.trackId !== "string" ||
      typeof parsed.positionMs !== "number" ||
      !Number.isFinite(parsed.positionMs)
    ) {
      return null;
    }
    return { trackId: parsed.trackId, positionMs: parsed.positionMs };
  } catch {
    return null;
  }
}

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
      playbackRate: 1,
      pitchSemitones: 0,
      isPitchLinked: true,
      keepSpeedAcrossTracks: true,
      crossfadeSeconds: 0,
      isReverbEnabled: false,
      reverbLevel: 0.35,
      isEqEnabled: false,
      eqGains: FLAT_EQ,
      eqCustomPresets: [],

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
      setTrackDoubleClickBehavior: (
        trackDoubleClickBehavior: TrackDoubleClickBehavior,
      ) => set({ trackDoubleClickBehavior }),
      setDefaultPlaybackContext: (
        defaultPlaybackContext: DefaultPlaybackContext,
      ) => set({ defaultPlaybackContext }),
      setFullscreen: (fullscreen: boolean) => {
        if (get().fullscreen === fullscreen) return;
        set({ fullscreen });
      },
      setPlaybackRate: (playbackRate: number) => set({ playbackRate }),
      setPitchSemitones: (pitchSemitones: number) => set({ pitchSemitones }),
      setIsPitchLinked: (isPitchLinked: boolean) => set({ isPitchLinked }),
      setKeepSpeedAcrossTracks: (keepSpeedAcrossTracks: boolean) =>
        set({ keepSpeedAcrossTracks }),
      setCrossfadeSeconds: (seconds: number) =>
        set({ crossfadeSeconds: clampCrossfadeSeconds(seconds) }),
      setIsReverbEnabled: (isReverbEnabled: boolean) =>
        set({ isReverbEnabled }),
      setReverbLevel: (reverbLevel: number) =>
        set({ reverbLevel: Math.max(0, Math.min(1, reverbLevel)) }),
      setIsEqEnabled: (isEqEnabled: boolean) => set({ isEqEnabled }),
      setEqGains: (eqGains: number[]) =>
        set({ eqGains: normalizeEqGains(eqGains) }),
      setEqCustomPresets: (eqCustomPresets: EqCustomPreset[]) =>
        set({ eqCustomPresets: normalizeEqCustomPresets(eqCustomPresets) }),
      resetSpeedAndPitch: () => set({ playbackRate: 1, pitchSemitones: 0 }),
      resetPlayback: () =>
        set({
          status: "idle",
          playbackMode: null,
          error: null,
          positionMs: 0,
          durationMs: 0,
          queue: [],
          currentIndex: -1,
          currentTrack: null,
          playbackContext: null,
          playbackContextCover: null,
          fullscreen: false,
        }),
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
      storage: createIncrementalJSONStorage(debouncedStorage),
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...((persisted ?? {}) as Partial<PlayerStore>),
        };
        const resume = readResumePosition();
        if (resume && merged.currentTrack?.id === resume.trackId) {
          merged.positionMs = resume.positionMs;
        }
        return merged;
      },
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
        if (state) {
          if (
            typeof state.playbackRate !== "number" ||
            isNaN(state.playbackRate)
          ) {
            state.playbackRate = 1;
          }
          if (
            typeof state.pitchSemitones !== "number" ||
            isNaN(state.pitchSemitones)
          ) {
            state.pitchSemitones = 0;
          }
          if (typeof state.isPitchLinked !== "boolean") {
            state.isPitchLinked = true;
          }
          if (typeof state.keepSpeedAcrossTracks !== "boolean") {
            state.keepSpeedAcrossTracks = true;
          }
          state.crossfadeSeconds = clampCrossfadeSeconds(
            state.crossfadeSeconds,
          );
          if (typeof state.isReverbEnabled !== "boolean") {
            state.isReverbEnabled = false;
          }
          if (
            typeof state.reverbLevel !== "number" ||
            isNaN(state.reverbLevel)
          ) {
            state.reverbLevel = 0.35;
          }
          if (typeof state.isEqEnabled !== "boolean") {
            state.isEqEnabled = false;
          }
          state.eqGains = normalizeEqGains(state.eqGains);
          state.eqCustomPresets = normalizeEqCustomPresets(
            state.eqCustomPresets,
          );
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
        playbackRate: state.playbackRate,
        pitchSemitones: state.pitchSemitones,
        isPitchLinked: state.isPitchLinked,
        keepSpeedAcrossTracks: state.keepSpeedAcrossTracks,
        crossfadeSeconds: state.crossfadeSeconds,
        isReverbEnabled: state.isReverbEnabled,
        reverbLevel: state.reverbLevel,
        isEqEnabled: state.isEqEnabled,
        eqGains: state.eqGains,
        eqCustomPresets: state.eqCustomPresets,
      }),
    },
  ),
);

let lastResumeSavedAt = 0;
let lastResumeValue: string | null = null;

function saveResumePosition(state: PlayerState) {
  lastResumeSavedAt = Date.now();
  if (state.defaultPlaybackContext !== "resume" || !state.currentTrack) {
    if (lastResumeValue !== "") {
      lastResumeValue = "";
      debouncedStorage.removeItem(PLAYER_RESUME_STORAGE_KEY);
    }
    return;
  }
  const value = JSON.stringify({
    trackId: state.currentTrack.id,
    positionMs: Math.max(0, Math.round(state.positionMs)),
  });
  if (value === lastResumeValue) return;
  lastResumeValue = value;
  debouncedStorage.setItem(PLAYER_RESUME_STORAGE_KEY, value);
}

usePlayerStore.subscribe((state, prev) => {
  if (
    state.currentTrack?.id !== prev.currentTrack?.id ||
    state.status !== prev.status ||
    state.defaultPlaybackContext !== prev.defaultPlaybackContext
  ) {
    saveResumePosition(state);
    return;
  }
  if (
    state.positionMs !== prev.positionMs &&
    Date.now() - lastResumeSavedAt >= RESUME_SAVE_INTERVAL_MS
  ) {
    saveResumePosition(state);
  }
});

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    saveResumePosition(usePlayerStore.getState());
    debouncedStorage.flush();
  });
}

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
  isReverbEnabled: boolean;
  reverbLevel: number;
  isEqEnabled: boolean;
  eqGains: number[];
  eqCustomPresets: EqCustomPreset[];
  /** overlap between songs, 0 = off (seconds); what the engine reads */
  crossfadeSeconds: number;
  /** the length picked on the slider, kept while crossfade is switched off */
  crossfadeLength: number;
  /** start the next song exactly where this one ends (no gap) */
  gapless: boolean;
  /** smart transitions: trim silence, follow fades, keep albums seamless */
  automix: boolean;
  /** a short crossfade on Next too, not only when a song ends */
  crossfadeOnSkip: boolean;
  /** turn loud songs down to the level of the others */
  normalizeVolume: boolean;
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
  setCrossfadeSeconds: (seconds: number) => void;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setGapless: (gapless: boolean) => void;
  setAutomix: (automix: boolean) => void;
  setCrossfadeOnSkip: (crossfadeOnSkip: boolean) => void;
  setNormalizeVolume: (normalizeVolume: boolean) => void;
  setTrackDoubleClickBehavior: (value: TrackDoubleClickBehavior) => void;
  setDefaultPlaybackContext: (value: DefaultPlaybackContext) => void;
  setFullscreen: (value: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setPitchSemitones: (semitones: number) => void;
  setIsPitchLinked: (linked: boolean) => void;
  setKeepSpeedAcrossTracks: (keep: boolean) => void;
  setIsReverbEnabled: (enabled: boolean) => void;
  setReverbLevel: (level: number) => void;
  setIsEqEnabled: (enabled: boolean) => void;
  setEqGains: (gains: number[]) => void;
  setEqCustomPresets: (presets: EqCustomPreset[]) => void;
  resetSpeedAndPitch: () => void;
  clearQueue: () => void;
  resetPlayback: () => void;
}

export const MAX_CROSSFADE_SECONDS = 12;
export const DEFAULT_CROSSFADE_SECONDS = 6;

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
      crossfadeSeconds: 0,
      crossfadeLength: DEFAULT_CROSSFADE_SECONDS,
      gapless: false,
      automix: true,
      crossfadeOnSkip: false,
      normalizeVolume: false,
      trackDoubleClickBehavior: "play",
      defaultPlaybackContext: "resume",
      fullscreen: false,
      playbackRate: 1,
      pitchSemitones: 0,
      isPitchLinked: true,
      keepSpeedAcrossTracks: true,
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
      setCrossfadeSeconds: (seconds: number) => {
        const next = Number.isFinite(seconds)
          ? Math.min(MAX_CROSSFADE_SECONDS, Math.max(0, Math.round(seconds)))
          : 0;
        // 0 switches it off but keeps the last length for the toggle
        set(
          next > 0
            ? { crossfadeSeconds: next, crossfadeLength: next }
            : { crossfadeSeconds: 0 },
        );
      },
      setCrossfadeEnabled: (enabled: boolean) =>
        set((state) => ({
          crossfadeSeconds: enabled ? state.crossfadeLength : 0,
        })),
      setGapless: (gapless: boolean) => set({ gapless }),
      setAutomix: (automix: boolean) => set({ automix }),
      setCrossfadeOnSkip: (crossfadeOnSkip: boolean) =>
        set({ crossfadeOnSkip }),
      setNormalizeVolume: (normalizeVolume: boolean) =>
        set({ normalizeVolume }),
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
        // builds before the on/off switch only saved crossfadeSeconds: keep
        // that as the length the switch brings back
        const saved = persisted as Partial<PlayerStore> | null;
        if (
          saved &&
          saved.crossfadeLength === undefined &&
          typeof saved.crossfadeSeconds === "number" &&
          saved.crossfadeSeconds > 0
        ) {
          merged.crossfadeLength = saved.crossfadeSeconds;
        }
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
          if (
            typeof state.crossfadeSeconds !== "number" ||
            !Number.isFinite(state.crossfadeSeconds)
          ) {
            state.crossfadeSeconds = 0;
          }
          state.crossfadeSeconds = Math.min(
            MAX_CROSSFADE_SECONDS,
            Math.max(0, Math.round(state.crossfadeSeconds)),
          );
          const length = state.crossfadeLength;
          state.crossfadeLength =
            typeof length === "number" && Number.isFinite(length) && length >= 1
              ? Math.min(MAX_CROSSFADE_SECONDS, Math.round(length))
              : state.crossfadeSeconds > 0
                ? state.crossfadeSeconds
                : DEFAULT_CROSSFADE_SECONDS;
          if (typeof state.gapless !== "boolean") state.gapless = false;
          if (typeof state.automix !== "boolean") state.automix = true;
          if (typeof state.crossfadeOnSkip !== "boolean") {
            state.crossfadeOnSkip = false;
          }
          if (typeof state.normalizeVolume !== "boolean") {
            state.normalizeVolume = false;
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
        crossfadeSeconds: state.crossfadeSeconds,
        crossfadeLength: state.crossfadeLength,
        gapless: state.gapless,
        automix: state.automix,
        crossfadeOnSkip: state.crossfadeOnSkip,
        normalizeVolume: state.normalizeVolume,
        trackDoubleClickBehavior: state.trackDoubleClickBehavior,
        defaultPlaybackContext: state.defaultPlaybackContext,
        playbackRate: state.playbackRate,
        pitchSemitones: state.pitchSemitones,
        isPitchLinked: state.isPitchLinked,
        keepSpeedAcrossTracks: state.keepSpeedAcrossTracks,
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

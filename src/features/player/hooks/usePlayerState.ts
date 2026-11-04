import { useSyncExternalStore } from "react";
import { playerEngine, type PlayerState } from "../engine/playerEngine";
import { FLAT_EQ } from "../engine/equalizer";

const EMPTY_STATE: PlayerState = {
  status: "idle",
  queue: [],
  currentIndex: -1,
  currentTrack: null,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  repeat: "off",
  shuffle: false,
  error: null,
  playbackMode: null,
  playbackContext: null,
  playbackContextCover: null,
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
};

export function usePlayerState(): PlayerState {
  return useSyncExternalStore(
    (onStoreChange) => playerEngine.subscribe(onStoreChange),
    () => playerEngine.getSnapshot(),
    () => EMPTY_STATE,
  );
}

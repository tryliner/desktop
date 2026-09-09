import { useSyncExternalStore } from "react";
import { playerEngine, type PlayerState } from "../engine/playerEngine";

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
};

export function usePlayerState(): PlayerState {
  return useSyncExternalStore(
    (onStoreChange) => playerEngine.subscribe(onStoreChange),
    () => playerEngine.getSnapshot(),
    () => EMPTY_STATE,
  );
}

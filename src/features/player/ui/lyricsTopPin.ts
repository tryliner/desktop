export const FRESH_TRACK_MS = 2_000;
export const TOP_PIN_MAX_MS = 8_000;

export function startsPinnedToTop(status: string, positionMs: number): boolean {
  return status === "loading" || status === "idle" || positionMs < FRESH_TRACK_MS;
}

export function shouldReleaseTopPin(state: {
  status: string;
  audioPaused: boolean;
  audioTimeMs: number;
  pinnedForMs: number;
}): boolean {
  const freshAudioPlaying = state.status === "playing" && !state.audioPaused && state.audioTimeMs < FRESH_TRACK_MS;
  return freshAudioPlaying || state.pinnedForMs > TOP_PIN_MAX_MS;
}

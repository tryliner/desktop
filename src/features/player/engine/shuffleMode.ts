import type { ShuffleMode } from "../store/playerStore";

export const SHUFFLE_MODES: ShuffleMode[] = ["off", "playlist", "smart"];

export function nextShuffleMode(current: ShuffleMode): ShuffleMode {
  switch (current) {
    case "off":
      return "playlist";
    case "playlist":
      return "smart";
    case "smart":
      return "off";
    default:
      return "playlist";
  }
}

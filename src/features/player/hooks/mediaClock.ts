import type { LyricsClock } from "@/features/lyrics";
import { usePlayerStore } from "../store/playerStore";

const MAX_CARRY_MS = 100;

interface ClockAnchor {
  mediaMs: number;
  frameMs: number;
  rate: number;
}

export function audioElement(): HTMLAudioElement | null {
  return document.getElementById("liner-audio") as HTMLAudioElement | null;
}

function isRunning(audio: HTMLAudioElement): boolean {
  return !audio.paused && !audio.ended && audio.readyState > 2;
}

export function createMediaClock(): LyricsClock {
  let anchor: ClockAnchor | null = null;
  return {
    timeMs: () => {
      const audio = audioElement();
      if (!audio || Number.isNaN(audio.currentTime)) {
        anchor = null;
        return usePlayerStore.getState().positionMs;
      }
      const mediaMs = audio.currentTime * 1000;
      const frameMs = performance.now();
      if (!isRunning(audio) || !anchor || anchor.mediaMs !== mediaMs) {
        anchor = { mediaMs, frameMs, rate: audio.playbackRate };
        return mediaMs;
      }
      const carried = Math.min(
        Math.max(frameMs - anchor.frameMs, 0),
        MAX_CARRY_MS,
      );
      return anchor.mediaMs + carried * anchor.rate;
    },
    playing: () => {
      const audio = audioElement();
      return Boolean(audio && !audio.paused);
    },
  };
}

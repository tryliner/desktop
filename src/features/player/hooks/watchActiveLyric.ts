import { useLyricsStore } from "@/features/lyrics";
import {
  isWindowVisible,
  onWindowVisibilityChange,
} from "@/shared/utils/windowVisibility";

export function watchActiveLyric() {
  let syncRafId: number;
  let lastReportedIndex = -1;

  const checkActiveLine = () => {
    if (!isWindowVisible()) return;
    const audioEl = document.getElementById(
      "liner-audio",
    ) as HTMLAudioElement | null;
    if (audioEl && !Number.isNaN(audioEl.currentTime)) {
      const currentMs = audioEl.currentTime * 1000;
      const lines = useLyricsStore.getState().syncedLines;
      let idx = -1;
      for (let i = 0; i < lines.length; i++) {
        const prevEnd =
          i > 0 && lines[i - 1].words && lines[i - 1].words!.length > 0
            ? lines[i - 1].words![lines[i - 1].words!.length - 1].endMs
            : i > 0
              ? lines[i - 1].timeMs
              : 0;
        const targetEarlyMs = Math.max(prevEnd, lines[i].timeMs - 600);
        if (targetEarlyMs <= currentMs) {
          idx = i;
        } else {
          break;
        }
      }
      if (idx !== lastReportedIndex) {
        lastReportedIndex = idx;
        useLyricsStore.getState().setActiveLineIndex(idx >= 0 ? idx : null);
      }
    }
    syncRafId = requestAnimationFrame(checkActiveLine);
  };

  syncRafId = requestAnimationFrame(checkActiveLine);
  const stopWatchingVisibility = onWindowVisibilityChange((visible) => {
    if (!visible) return;
    cancelAnimationFrame(syncRafId);
    syncRafId = requestAnimationFrame(checkActiveLine);
  });

  return () => {
    cancelAnimationFrame(syncRafId);
    stopWatchingVisibility();
    useLyricsStore.getState().setActiveLineIndex(null);
  };
}

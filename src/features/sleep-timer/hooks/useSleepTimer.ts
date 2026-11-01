import { useEffect } from "react";
import { useSleepTimerStore } from "../store/sleepTimerStore";
import { usePlayerStore } from "@/features/player/store/playerStore";

export function useSleepTimer() {
  const mode = useSleepTimerStore((s) => s.mode);
  const isActive = useSleepTimerStore((s) => s.isActive);
  const remainingSeconds = useSleepTimerStore((s) => s.remainingSeconds);
  const originalVolume = useSleepTimerStore((s) => s.originalVolume);
  const isFadingOut = useSleepTimerStore((s) => s.isFadingOut);
  const tick = useSleepTimerStore((s) => s.tick);
  const cancelTimer = useSleepTimerStore((s) => s.cancelTimer);
  const setRemainingSeconds = useSleepTimerStore((s) => s.setRemainingSeconds);

  const durationMs = usePlayerStore((s) => s.durationMs);
  const positionMs = usePlayerStore((s) => s.positionMs);
  const status = usePlayerStore((s) => s.status);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const dispatch = usePlayerStore((s) => s.dispatch);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      if (mode === "end_of_track") {
        const remainingTrackMs = Math.max(0, durationMs - positionMs);
        const remSec = Math.floor(remainingTrackMs / 1000);
        setRemainingSeconds(remSec);

        if (remSec <= 60 && remSec > 0) {
          const orig = originalVolume ?? 1;
          const fadeVolume = Math.max(0, orig * (remSec / 60));
          setVolume(fadeVolume);
        } else if (remSec <= 1 || status === "paused") {
          dispatch({ type: "PAUSE_REQUESTED" });
          if (originalVolume !== null) {
            setVolume(originalVolume);
          }
          cancelTimer();
        }
        return;
      }

      // Time-based countdown
      tick();
      const currentRemaining = useSleepTimerStore.getState().remainingSeconds;

      if (currentRemaining <= 60 && currentRemaining > 0) {
        const orig = originalVolume ?? 1;
        const fadeVolume = Math.max(0, orig * (currentRemaining / 60));
        setVolume(fadeVolume);
      } else if (currentRemaining <= 0) {
        dispatch({ type: "PAUSE_REQUESTED" });
        if (originalVolume !== null) {
          setVolume(originalVolume);
        }
        cancelTimer();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isActive,
    mode,
    durationMs,
    positionMs,
    status,
    originalVolume,
    tick,
    cancelTimer,
    setRemainingSeconds,
    setVolume,
    dispatch,
  ]);

  return {
    isActive,
    mode,
    remainingSeconds,
    isFadingOut,
  };
}

export function formatRemainingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

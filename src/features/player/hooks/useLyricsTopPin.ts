import { useEffect } from "react";
import { playerEngine } from "../engine/playerEngine";
import { shouldReleaseTopPin } from "../ui/lyricsTopPin";
import type { LyricsScrollState } from "./useLyricsScroll";

export function useLyricsTopPin({
  elementRef,
  pinnedToTopRef,
}: LyricsScrollState) {
  useEffect(() => {
    if (!pinnedToTopRef.current) return;
    const startedAt = performance.now();
    let rafId = 0;
    const holdTop = () => {
      const el = elementRef.current as HTMLElement & {
        renderer?: {
          noteUserScroll?: () => void;
          resumeAutoscroll?: () => void;
        };
      };
      if (!pinnedToTopRef.current) return;
      const audio = document.getElementById(
        "liner-audio",
      ) as HTMLAudioElement | null;
      const release = shouldReleaseTopPin({
        status: playerEngine.getSnapshot().status,
        audioPaused: !audio || audio.paused,
        audioTimeMs: (audio?.currentTime ?? 0) * 1000,
        pinnedForMs: performance.now() - startedAt,
      });
      if (release) {
        pinnedToTopRef.current = false;
        el?.renderer?.resumeAutoscroll?.();
        return;
      }
      if (el) {
        el.renderer?.noteUserScroll?.();
        if (el.scrollTop !== 0) el.scrollTop = 0;
      }
      rafId = requestAnimationFrame(holdTop);
    };
    rafId = requestAnimationFrame(holdTop);
    return () => cancelAnimationFrame(rafId);
  }, [elementRef, pinnedToTopRef]);
}

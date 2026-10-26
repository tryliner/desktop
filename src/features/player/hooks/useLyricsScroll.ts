import { useCallback, useMemo, useRef } from "react";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import { startsPinnedToTop } from "../ui/lyricsTopPin";

export function useLyricsScroll(status: string, positionMs: number) {
  const elementRef = useRef<BraccatoLyricsElement | null>(null);
  const freeScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelTimeRef = useRef(0);
  const isInFreeSearchRef = useRef(false);
  const waitingForAudioAfterClickRef = useRef(false);
  const pinnedToTopRef = useRef(startsPinnedToTop(status, positionMs));

  const scrollToActiveLine = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = elementRef.current;
      if (!el) return false;

      const activeEls = (el as HTMLElement).querySelectorAll<HTMLElement>(
        ".blyrics--active",
      );
      if (activeEls.length === 0) return false;
      const activeEl = activeEls[activeEls.length - 1];
      const activeLine = el.renderer?.lines.find(
        (line) => line.lyricElement === activeEl,
      );

      const containerRect = el.getBoundingClientRect();
      if (containerRect.height === 0 || !activeLine || activeLine.height <= 0)
        return false;

      const offset =
        (el.renderer?.container?.offsetTop ?? 0) + activeLine.position;
      const targetScrollTop =
        offset - containerRect.height / 2 + activeLine.height / 2;

      if (behavior === "auto") {
        el.scrollTop = Math.max(0, targetScrollTop);
      } else {
        el.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior,
        });
      }
      return true;
    },
    [],
  );

  const returnToFollowingMode = useCallback(() => {
    if (freeScrollTimerRef.current) {
      clearTimeout(freeScrollTimerRef.current);
      freeScrollTimerRef.current = null;
    }
    isInFreeSearchRef.current = false;
    lastWheelTimeRef.current = 0;

    const el = elementRef.current;
    if (!el) return;

    if (el.renderer) {
      el.renderer.resumeAutoscroll?.();
      const engine = (
        el.renderer as typeof el.renderer & {
          engine?: {
            scrollResumeTime: number;
            nextScrollAllowedTime: number;
            queuedScroll: boolean;
          };
        }
      ).engine;
      if (engine) {
        engine.scrollResumeTime = 0;
        engine.nextScrollAllowedTime = 0;
        engine.queuedScroll = true;
      }
    }

    scrollToActiveLine("smooth");
  }, [scrollToActiveLine]);

  const returnToFollowingModeRef = useRef(returnToFollowingMode);
  returnToFollowingModeRef.current = returnToFollowingMode;

  const handleUserInteraction = useCallback(() => {
    pinnedToTopRef.current = false;
    lastWheelTimeRef.current = Date.now();
    isInFreeSearchRef.current = true;

    const el = elementRef.current;
    if (el?.renderer) {
      el.renderer.noteUserScroll?.();
      el.renderer.noteUserScroll?.();
      el.renderer.noteUserScroll?.();
    }

    if (freeScrollTimerRef.current) {
      clearTimeout(freeScrollTimerRef.current);
      freeScrollTimerRef.current = null;
    }

    freeScrollTimerRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastWheelTimeRef.current;
      if (elapsed < 5900) return;

      returnToFollowingMode();
    }, 6000);
  }, [returnToFollowingMode]);

  const handleUserInteractionRef = useRef(handleUserInteraction);
  handleUserInteractionRef.current = handleUserInteraction;

  return useMemo(
    () => ({
      elementRef,
      freeScrollTimerRef,
      isInFreeSearchRef,
      waitingForAudioAfterClickRef,
      pinnedToTopRef,
      scrollToActiveLine,
      returnToFollowingMode,
      returnToFollowingModeRef,
      handleUserInteractionRef,
    }),
    [scrollToActiveLine, returnToFollowingMode],
  );
}

export type LyricsScrollState = ReturnType<typeof useLyricsScroll>;

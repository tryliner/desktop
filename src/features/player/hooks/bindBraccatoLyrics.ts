import type { Lyric } from "@braccato/parsers";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import { braccatoThemeCss } from "@/features/lyrics";
import { playerEngine } from "../engine/playerEngine";
import { watchActiveLyric } from "./watchActiveLyric";
import type { LyricsScrollState } from "./useLyricsScroll";

export function bindBraccatoLyrics(
  el: BraccatoLyricsElement,
  scroll: LyricsScrollState,
  latestLyricsRef: { current: Lyric[] },
  updateAnnotations: () => void,
) {
  const {
    elementRef,
    freeScrollTimerRef,
    isInFreeSearchRef,
    waitingForAudioAfterClickRef,
    pinnedToTopRef,
    scrollToActiveLine,
    returnToFollowingModeRef,
    handleUserInteractionRef,
  } = scroll;
  el.source = "#liner-audio";

  const handleBraccatoLineClick = (e: Event) => {
    const isAudioLoading = playerEngine.getSnapshot().status === "loading";
    if (isAudioLoading) {
      waitingForAudioAfterClickRef.current = true;
      isInFreeSearchRef.current = true;
      if (freeScrollTimerRef.current) {
        clearTimeout(freeScrollTimerRef.current);
        freeScrollTimerRef.current = null;
      }
      if (el.renderer) {
        el.renderer.noteUserScroll?.();
        el.renderer.noteUserScroll?.();
        el.renderer.noteUserScroll?.();
      }
    } else {
      returnToFollowingModeRef.current();
    }

    const detail = (e as CustomEvent).detail as
      { timeS?: number; time?: number } | undefined;
    const timeMs =
      detail?.timeS !== undefined
        ? Math.round(detail.timeS * 1000)
        : detail?.time !== undefined
          ? detail.time > 1000
            ? Math.round(detail.time)
            : Math.round(detail.time * 1000)
          : null;
    if (timeMs !== null) {
      playerEngine.seek(timeMs, true);
    }
  };

  const onUserScroll = () => {
    handleUserInteractionRef.current();
  };

  const onLyricsLoaded = () => {
    updateAnnotations();
    if (
      waitingForAudioAfterClickRef.current ||
      pinnedToTopRef.current ||
      isInFreeSearchRef.current
    )
      return;
    requestAnimationFrame(() => {
      if (
        !waitingForAudioAfterClickRef.current &&
        !isInFreeSearchRef.current &&
        !pinnedToTopRef.current
      ) {
        scrollToActiveLine("auto");
      }
    });
  };

  const stopWatchingActiveLyric = watchActiveLyric();

  el.addEventListener("braccato:lyrics-loaded", onLyricsLoaded);
  el.addEventListener("braccato:line-click", handleBraccatoLineClick);
  el.addEventListener("wheel", onUserScroll, {
    passive: true,
    capture: true,
  });
  el.addEventListener("touchmove", onUserScroll, {
    passive: true,
    capture: true,
  });

  el.theme = braccatoThemeCss;
  el.lyrics = latestLyricsRef.current;

  return () => {
    stopWatchingActiveLyric();
    el.removeEventListener("braccato:lyrics-loaded", onLyricsLoaded);
    el.removeEventListener("braccato:line-click", handleBraccatoLineClick);
    el.removeEventListener("wheel", onUserScroll, { capture: true });
    el.removeEventListener("touchmove", onUserScroll, { capture: true });
    if (freeScrollTimerRef.current) {
      clearTimeout(freeScrollTimerRef.current);
      freeScrollTimerRef.current = null;
    }
    elementRef.current = null;
  };
}

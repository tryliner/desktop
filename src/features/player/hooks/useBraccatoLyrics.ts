import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Lyric } from "@braccato/parsers";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import { decorateLyricsLines, useLyricsStore } from "@/features/lyrics";
import { usePlayerState } from "./usePlayerState";
import { useLyricsScroll } from "./useLyricsScroll";
import { useLyricsTopPin } from "./useLyricsTopPin";
import { bindBraccatoLyrics } from "./bindBraccatoLyrics";

export function useBraccatoLyrics(lyrics: Lyric[]) {
  const player = usePlayerState();
  const latestLyricsRef = useRef(lyrics);
  const showPronunciation = useLyricsStore((s) => s.showPronunciation);
  const scroll = useLyricsScroll(player.status, player.positionMs);
  const {
    elementRef,
    isInFreeSearchRef,
    waitingForAudioAfterClickRef,
    pinnedToTopRef,
    scrollToActiveLine,
    returnToFollowingMode,
  } = scroll;
  const updateAnnotations = useCallback(() => {
    const element = elementRef.current;
    const renderer = element?.renderer;
    if (!element || !renderer) return;
    decorateLyricsLines(
      renderer,
      latestLyricsRef.current,
      useLyricsStore.getState(),
    );
    renderer.relayout();
    renderer.retickFromPlaybackClock((eventCreationTime, isPlaying) => ({
      ...element.tickOptions,
      eventCreationTime,
      isPlaying,
      playbackRate: element.mediaElement?.playbackRate ?? 1,
    }));
  }, [elementRef]);

  const setElement = useCallback(
    (el: BraccatoLyricsElement | null) => {
      elementRef.current = el;
      if (el)
        return bindBraccatoLyrics(
          el,
          scroll,
          latestLyricsRef,
          updateAnnotations,
        );
    },
    [elementRef, scroll, updateAnnotations],
  );

  useEffect(() => {
    latestLyricsRef.current = lyrics;
    const element = elementRef.current;
    if (element) element.lyrics = lyrics;
  }, [elementRef, lyrics]);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top;
    const anchor = isInFreeSearchRef.current
      ? element.renderer?.lines.find(
          (line) => line.lyricElement.getBoundingClientRect().bottom > top,
        )?.lyricElement
      : null;
    const anchorTop = anchor?.getBoundingClientRect().top ?? 0;
    updateAnnotations();
    if (anchor) {
      element.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
    } else if (
      !pinnedToTopRef.current &&
      !waitingForAudioAfterClickRef.current
    ) {
      scrollToActiveLine("auto");
    }
  }, [
    elementRef,
    isInFreeSearchRef,
    pinnedToTopRef,
    waitingForAudioAfterClickRef,
    showPronunciation,
    updateAnnotations,
    scrollToActiveLine,
  ]);

  useEffect(() => {
    if (
      (player.status === "playing" || player.status === "paused") &&
      waitingForAudioAfterClickRef.current
    ) {
      waitingForAudioAfterClickRef.current = false;
      returnToFollowingMode();
    }
  }, [player.status, waitingForAudioAfterClickRef, returnToFollowingMode]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const checkAndScroll = () => {
      if (
        cancelled ||
        waitingForAudioAfterClickRef.current ||
        pinnedToTopRef.current
      )
        return;
      attempts++;
      const success = scrollToActiveLine("auto");
      if (!success && attempts < 30) {
        requestAnimationFrame(checkAndScroll);
      }
    };

    const rafId = requestAnimationFrame(checkAndScroll);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [
    lyrics,
    pinnedToTopRef,
    waitingForAudioAfterClickRef,
    scrollToActiveLine,
  ]);

  useLyricsTopPin(scroll);
  return { elementRef, setElement };
}

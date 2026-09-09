import { useEffect, useRef, useCallback } from "react";

export interface LyricsWord {
  timeMs: number;
  endMs: number;
  text: string;
}

export interface SyncedLine {
  timeMs: number;
  text: string;
  words?: LyricsWord[];
}

/**
 * Drives lyrics word-fill animation through direct DOM writes and precision
 * clock anchor extrapolation, eliminating drift and jumping during loading/start.
 */
export function useLyricsAnimator({
  syncedLines,
  isActuallySynced,
  isPlaying,
  positionMs,
  durationMs,
  onActiveLineChange,
}: {
  syncedLines: SyncedLine[];
  isActuallySynced: boolean;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  onActiveLineChange: (indices: number[]) => void;
}) {
  const isPlayingRef = useRef(isPlaying);
  const positionMsRef = useRef(positionMs);
  const durationMsRef = useRef(durationMs);
  const syncedLinesRef = useRef(syncedLines);
  const isActuallySyncedRef = useRef(isActuallySynced);
  const onActiveLineChangeRef = useRef(onActiveLineChange);

  // Clock Anchor to prevent ghost forward-drift and snap-back glitches
  const anchorPosRef = useRef(positionMs);
  const anchorTimeRef = useRef(performance.now());
  const activeLineIndicesRef = useRef<number[]>([]);

  const wordSpansByLine = useRef<Map<number, HTMLElement[]>>(new Map());
  const wordDataByLine = useRef<
    Map<number, { timeMs: number; endMs: number }[]>
  >(new Map());

  useEffect(() => {
    const prevPlaying = isPlayingRef.current;
    isPlayingRef.current = isPlaying;

    // Reset clock anchor when transitioning playback state
    if (!prevPlaying && isPlaying) {
      anchorPosRef.current = positionMsRef.current;
      anchorTimeRef.current = performance.now();
    } else if (!isPlaying) {
      anchorPosRef.current = positionMsRef.current;
      anchorTimeRef.current = performance.now();
    }
  }, [isPlaying]);

  useEffect(() => {
    positionMsRef.current = positionMs;

    if (!isPlayingRef.current) {
      anchorPosRef.current = positionMs;
      anchorTimeRef.current = performance.now();
    } else {
      // Resynchronize anchor if audio clock deviated significantly (> 150ms)
      const now = performance.now();
      const currentExtrapolated =
        anchorPosRef.current + (now - anchorTimeRef.current);
      if (Math.abs(currentExtrapolated - positionMs) > 150) {
        anchorPosRef.current = positionMs;
        anchorTimeRef.current = now;
      }
    }
  }, [positionMs]);

  useEffect(() => {
    durationMsRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    syncedLinesRef.current = syncedLines;
  }, [syncedLines]);

  useEffect(() => {
    isActuallySyncedRef.current = isActuallySynced;
  }, [isActuallySynced]);

  useEffect(() => {
    onActiveLineChangeRef.current = onActiveLineChange;
  }, [onActiveLineChange]);

  const setWordSpans = useCallback(
    (lineIndex: number, spans: HTMLElement[]) => {
      wordSpansByLine.current.set(lineIndex, spans);
    },
    [],
  );

  const setWordData = useCallback(
    (
      lineIndex: number,
      words: { timeMs: number; endMs: number }[],
    ) => {
      wordDataByLine.current.set(lineIndex, words);
    },
    [],
  );

  const clearWordSpans = useCallback((lineIndex: number) => {
    wordSpansByLine.current.delete(lineIndex);
    wordDataByLine.current.delete(lineIndex);
  }, []);

  const registerWordSpan = useCallback(
    (
      lineIndex: number,
      wordIndex: number,
      totalWords: number,
      el: HTMLElement | null,
    ) => {
      if (!el) return;
      let lineSpans = wordSpansByLine.current.get(lineIndex);
      if (!lineSpans || lineSpans.length !== totalWords) {
        lineSpans = new Array(totalWords);
        wordSpansByLine.current.set(lineIndex, lineSpans);
      }
      lineSpans[wordIndex] = el;
    },
    [],
  );

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const lines = syncedLinesRef.current;
      const isSynced = isActuallySyncedRef.current;
      const playing = isPlayingRef.current;

      const now = performance.now();
      const estimated = playing
        ? Math.min(
            durationMsRef.current || Infinity,
            Math.max(0, anchorPosRef.current + (now - anchorTimeRef.current)),
          )
        : anchorPosRef.current;

      let newMainLineIndex = -1;
      if (isSynced && lines.length > 0) {
        for (let i = 0; i < lines.length; i++) {
          if (estimated >= lines[i].timeMs) {
            if (!lines[i].text.match(/^\s*<[^>]+>/)) {
              newMainLineIndex = i;
            }
          } else {
            break;
          }
        }
      }

      const newActiveIndices: number[] = [];
      if (newMainLineIndex >= 0) {
        newActiveIndices.push(newMainLineIndex);
        for (let i = newMainLineIndex + 1; i < lines.length; i++) {
          if (lines[i].text.match(/^\s*<[^>]+>/)) {
            if (estimated >= lines[i].timeMs) {
              newActiveIndices.push(i);
            }
          } else {
            break;
          }
        }
      }

      let changed =
        newActiveIndices.length !== activeLineIndicesRef.current.length;
      if (!changed) {
        for (let k = 0; k < newActiveIndices.length; k++) {
          if (newActiveIndices[k] !== activeLineIndicesRef.current[k]) {
            changed = true;
            break;
          }
        }
      }

      if (changed) {
        activeLineIndicesRef.current = newActiveIndices;
        onActiveLineChangeRef.current(newActiveIndices);
      }

      for (const idx of newActiveIndices) {
        const spans = wordSpansByLine.current.get(idx);
        const words = wordDataByLine.current.get(idx);
        if (spans && words && spans.length === words.length) {
          for (let wi = 0; wi < words.length; wi++) {
            const w = words[wi];
            const span = spans[wi];
            if (!span) continue;

            let progress: number;
            if (w.endMs <= w.timeMs) {
              progress = estimated >= w.timeMs ? 100 : 0;
            } else if (estimated >= w.endMs) {
              progress = 100;
            } else if (estimated >= w.timeMs) {
              const pct =
                ((estimated - w.timeMs) / (w.endMs - w.timeMs)) * 100;
              progress = Math.max(0, Math.min(100, isNaN(pct) ? 0 : pct));
            } else {
              progress = 0;
            }

            const bg = `linear-gradient(to right, var(--color-text-primary) ${progress.toFixed(1)}%, var(--color-text-tertiary) ${progress.toFixed(1)}%)`;

            if (span.style.backgroundImage !== bg) {
              span.style.backgroundImage = bg;
            }
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return { setWordSpans, setWordData, clearWordSpans, registerWordSpan };
}

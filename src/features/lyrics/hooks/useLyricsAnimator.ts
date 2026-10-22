import { useEffect, useRef, useCallback } from "react";
import {
  CROSSFADE_MS,
  PREWARM_MS,
  getActiveLineIndices,
  getPrewarmLeadMs,
  getUnfinishedOutgoingLineIndices,
  wordEmphasis,
} from "./lyricsTiming";

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

  const anchorPosRef = useRef(positionMs);
  const anchorTimeRef = useRef(performance.now());
  const lastSeekTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const trueLineIndicesRef = useRef<number[]>([]);
  const outgoingFillLineIndicesRef = useRef<number[]>([]);
  const activeLineIndicesRef = useRef<number[]>([]);

  const wordSpansByLine = useRef<Map<number, HTMLElement[]>>(new Map());
  const wordDataByLine = useRef<
    Map<number, { timeMs: number; endMs: number }[]>
  >(new Map());

  useEffect(() => {
    const prevPlaying = isPlayingRef.current;
    isPlayingRef.current = isPlaying;

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
      const now = performance.now();
      const currentExtrapolated =
        anchorPosRef.current + (now - anchorTimeRef.current);
      if (Math.abs(currentExtrapolated - positionMs) > 150) {
        anchorPosRef.current = positionMs;
        anchorTimeRef.current = now;
        lastSeekTimeRef.current = now;
        trueLineIndicesRef.current = [];
        outgoingFillLineIndicesRef.current = [];
      }
    }
  }, [positionMs]);

  useEffect(() => {
    durationMsRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    syncedLinesRef.current = syncedLines;
    trueLineIndicesRef.current = [];
    outgoingFillLineIndicesRef.current = [];
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
    const reducedMotionQuery = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
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

      const reduceMotion = reducedMotionQuery?.matches === true;
      const bufferMs = reduceMotion ? 0 : CROSSFADE_MS;

      // Word fill follows the real clock (trueIndices). The line-change callback
      // looks up to PREWARM_MS ahead, capped at the next line boundary so close
      // lines are not skipped. No lead while paused/seeking or with reduced motion.
      const seeking = now - lastSeekTimeRef.current < 150;
      const requestedLead =
        playing && !seeking && !reduceMotion ? PREWARM_MS : 0;
      const trueIndices = isSynced ? getActiveLineIndices(lines, estimated) : [];
      const lead = isSynced
        ? getPrewarmLeadMs(lines, estimated, requestedLead)
        : 0;
      const prewarmedIndices =
        lead > 0
          ? getActiveLineIndices(lines, estimated + lead)
          : trueIndices;

      const getLastWordEnd = (idx: number) => {
        const words = wordDataByLine.current.get(idx) ?? lines[idx]?.words;
        return (
          words?.reduce((end, word) => Math.max(end, word.endMs), -Infinity) ??
          -Infinity
        );
      };
      const outgoingCandidates = [
        ...new Set([
          ...outgoingFillLineIndicesRef.current,
          ...trueLineIndicesRef.current,
          ...trueIndices,
        ]),
      ];
      const lastWordEndByLine = new Map(
        outgoingCandidates.map((index) => [index, getLastWordEnd(index)]),
      );
      const outgoingFillIndices = getUnfinishedOutgoingLineIndices(
        outgoingCandidates,
        prewarmedIndices,
        lastWordEndByLine,
        estimated,
        lines,
      );
      const newActiveIndices = [
        ...new Set([...prewarmedIndices, ...outgoingFillIndices]),
      ].sort((a, b) => a - b);
      trueLineIndicesRef.current = trueIndices;
      outgoingFillLineIndicesRef.current = outgoingFillIndices;

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

      // Pre-warmed lines need their fill initialised. Outgoing lines keep filling
      // until their last word ends on the real clock.
      const fillIndices = [
        ...new Set([...trueIndices, ...newActiveIndices]),
      ];

      for (const idx of fillIndices) {
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

            const emphasis = wordEmphasis(estimated, w, bufferMs).toFixed(3);
            if (span.style.getPropertyValue("--word-emphasis") !== emphasis) {
              span.style.setProperty("--word-emphasis", emphasis);
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

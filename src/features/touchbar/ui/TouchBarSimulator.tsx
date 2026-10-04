import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipNext,
  SkipPrevious,
  VolumeCross,
  VolumeSmall,
  VolumeLoud,
  MaximizeSquare3,
  Shuffle,
} from "@solar-icons/react";
import { HeartFill, HeartLine, CloseLine } from "@mingcute/react";
import { toVolumeLevel, toVolumeGain } from "@/features/player/engine/volume";
import { useDisableButtonFocus } from "@/features/navigation/hooks/useDisableButtonFocus";
import type {
  TouchBarAction,
  TouchBarStatePayload,
  TouchBarActiveLine,
  TouchBarWordData,
} from "../contracts";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function generateWaveform(seed: string, count = 44): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = i / count;
    const wave1 = Math.sin(x * Math.PI * 4 + hash);
    const wave2 = Math.cos(x * Math.PI * 10 + hash * 0.4);
    const wave3 = Math.sin(x * Math.PI * 18 + hash * 0.8);
    const raw = 0.35 + 0.32 * Math.abs(wave1) + 0.18 * Math.abs(wave2) + 0.15 * Math.abs(wave3);
    result.push(Math.max(0.2, Math.min(0.95, raw)));
  }
  return result;
}

function VolumeIcon({ percent, size = 14 }: { percent: number; size?: number }) {
  if (percent === 0) {
    return <VolumeCross size={size} weight="Bold" />;
  }
  if (percent < 45) {
    return <VolumeSmall size={size} weight="Bold" />;
  }
  return <VolumeLoud size={size} weight="Bold" />;
}

export function TouchBarSimulator() {
  useDisableButtonFocus();

  const [state, setState] = useState<TouchBarStatePayload>({
    status: "idle",
    track: null,
    positionMs: 0,
    durationMs: 0,
    volume: 1,
    isLiked: false,
    shuffle: false,
    repeat: "off",
    activeLine: null,
    activeLyricText: "",
    nextLyricText: "",
    offsetMs: 0,
    currentRoute: "/",
    isFullscreen: false,
  });

  const [isSeeking, setIsSeeking] = useState(false);
  const [localSeekMs, setLocalSeekMs] = useState(0);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const lastNonZeroVolumeRef = useRef<number>(0.7);

  const anchorPosRef = useRef(state.positionMs);
  const anchorTimeRef = useRef(performance.now());
  const [interpolatedPosMs, setInterpolatedPosMs] = useState(state.positionMs);

  useEffect(() => {
    window.linerElectron?.getTouchBarInitialState?.().then((initial) => {
      if (initial) setState(initial);
    });

    if (!window.linerElectron?.onTouchBarSimulatorState) return;
    const cleanup = window.linerElectron.onTouchBarSimulatorState((newState) => {
      setState(newState);
    });
    return cleanup;
  }, []);

  const sendAction = useCallback((action: TouchBarAction) => {
    window.linerElectron?.sendTouchBarAction?.(action);
  }, []);

  const isPlaying = state.status === "playing";
  const durationMs = Math.max(1, state.durationMs || state.track?.durationMs || 1);

  useEffect(() => {
    setInterpolatedPosMs(state.positionMs);
    anchorPosRef.current = state.positionMs;
    anchorTimeRef.current = performance.now();
  }, [state.positionMs, state.status]);

  useEffect(() => {
    if (!isPlaying || isSeeking) return;
    let animId: number;
    const startAnchor = anchorPosRef.current;
    const startTime = anchorTimeRef.current;

    const step = () => {
      const elapsed = performance.now() - startTime;
      const current = Math.min(durationMs, startAnchor + elapsed);
      setInterpolatedPosMs(current);
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isSeeking, durationMs]);

  const currentPosMs = isSeeking ? localSeekMs : interpolatedPosMs;
  const progressRatio = Math.min(1, Math.max(0, currentPosMs / durationMs));
  const activeTimelineRatio = progressRatio;
  const activeTimelineMs = currentPosMs;

  const [waveformWidth, setWaveformWidth] = useState(240);

  const setWaveformRef = useCallback((node: HTMLDivElement | null) => {
    waveformRef.current = node;
    if (node) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0) setWaveformWidth(Math.round(rect.width));
    }
  }, []);

  useEffect(() => {
    const el = waveformRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWaveformWidth(Math.round(w));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerTrackWidth = Math.max(60, waveformWidth - 16);
  const barsCount = Math.max(
    24,
    Math.min(75, Math.round(26 + innerTrackWidth / 11))
  );
  const waveformSeed = state.track
    ? `${state.track.id || state.track.title}-${durationMs}`
    : "liner";
  const waveformBars = useMemo(
    () => generateWaveform(waveformSeed, barsCount),
    [waveformSeed, barsCount]
  );

  const wordSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const noteClipRectRef = useRef<SVGRectElement | null>(null);
  const activeLineContainerRef = useRef<HTMLDivElement>(null);
  const [isThreeRows, setIsThreeRows] = useState(false);

  const lastActiveLineRef = useRef<TouchBarActiveLine | null>(null);
  const lastActiveLyricTextRef = useRef<string>("");
  const currentTrackId = state.track?.id;
  const prevTrackIdRef = useRef<string | undefined>(currentTrackId);

  const [localActiveIndex, setLocalActiveIndex] = useState<number>(-1);

  if (prevTrackIdRef.current !== currentTrackId) {
    prevTrackIdRef.current = currentTrackId;
    lastActiveLineRef.current = null;
    lastActiveLyricTextRef.current = "";
  }

  useEffect(() => {
    if (typeof state.activeIndex === "number") {
      setLocalActiveIndex(state.activeIndex);
    }
  }, [state.activeIndex]);

  useEffect(() => {
    const lines = state.syncedLines;
    if (!lines || lines.length === 0) {
      setLocalActiveIndex(-1);
      return;
    }

    let rafId: number;
    let lastIdx = -1;

    const syncTick = () => {
      const now = performance.now();
      const timeMs =
        isPlaying && !isSeeking
          ? Math.min(durationMs, anchorPosRef.current + (now - anchorTimeRef.current))
          : isSeeking
            ? localSeekMs
            : anchorPosRef.current;

      let idx = -1;
      for (let i = 0; i < lines.length; i++) {
        const prevEnd =
          i > 0 && lines[i - 1].words && lines[i - 1].words!.length > 0
            ? lines[i - 1].words![lines[i - 1].words!.length - 1].endMs
            : i > 0
              ? lines[i - 1].timeMs
              : 0;
        const targetEarlyMs = Math.max(prevEnd, lines[i].timeMs - 600);
        if (targetEarlyMs <= timeMs) {
          idx = i;
        } else {
          break;
        }
      }

      if (idx !== lastIdx) {
        lastIdx = idx;
        setLocalActiveIndex(idx);
      }

      rafId = requestAnimationFrame(syncTick);
    };

    rafId = requestAnimationFrame(syncTick);
    return () => cancelAnimationFrame(rafId);
  }, [state.syncedLines, isPlaying, isSeeking, durationMs, localSeekMs]);

  const activeLineFromSynced = useMemo(() => {
    if (!state.syncedLines || state.syncedLines.length === 0) return null;
    if (localActiveIndex >= 0 && localActiveIndex < state.syncedLines.length) {
      return state.syncedLines[localActiveIndex];
    }
    const firstLine = state.syncedLines[0];
    if (firstLine && firstLine.timeMs > 3000 && currentPosMs < firstLine.timeMs - 600) {
      return {
        text: "",
        timeMs: 0,
        durationMs: firstLine.timeMs,
        words: [],
        isInstrumental: true,
      };
    }
    return null;
  }, [state.syncedLines, localActiveIndex, currentPosMs]);

  const nextLyricFromSynced = useMemo(() => {
    if (!state.syncedLines || state.syncedLines.length === 0) return "";
    const fromIdx = localActiveIndex >= 0 ? localActiveIndex + 1 : 0;
    const upcoming = state.syncedLines
      .slice(fromIdx)
      .find((l) => Boolean(l.text && l.text.trim()));
    return upcoming?.text || "";
  }, [state.syncedLines, localActiveIndex]);

  if (activeLineFromSynced) {
    lastActiveLineRef.current = activeLineFromSynced;
    lastActiveLyricTextRef.current = activeLineFromSynced.text;
  } else if (state.activeLine) {
    lastActiveLineRef.current = state.activeLine;
    lastActiveLyricTextRef.current = state.activeLine.text;
  } else if (state.activeLyricText) {
    lastActiveLyricTextRef.current = state.activeLyricText;
  }

  const hasLyricsContent = Boolean(
    (state.hasSyncedLyrics ||
      (state.syncedLines && state.syncedLines.length > 0) ||
      state.activeLine ||
      state.activeLyricText ||
      lastActiveLyricTextRef.current) &&
      state.track
  );

  const displayLine =
    activeLineFromSynced || state.activeLine || lastActiveLineRef.current;
  const nextLyricText = nextLyricFromSynced || state.nextLyricText || "";
  const displayLineText =
    displayLine?.isInstrumental
      ? ""
      : displayLine?.text ||
        state.activeLyricText ||
        lastActiveLyricTextRef.current ||
        nextLyricText ||
        "•••";

  useEffect(() => {
    const el = activeLineContainerRef.current;
    if (!el) {
      setIsThreeRows(false);
      return;
    }
    const checkHeight = () => {
      setIsThreeRows(el.scrollHeight >= 40);
    };
    checkHeight();
    const observer = new ResizeObserver(checkHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayLineText, displayLine]);

  const activeIsThreeRows = useMemo(() => {
    if (isThreeRows) return true;
    if (!displayLineText || displayLineText === "•••") return false;
    return (
      displayLineText.length > 55 ||
      Boolean(displayLine?.words && displayLine.words.length > 11)
    );
  }, [isThreeRows, displayLineText, displayLine]);

  const showNextLine =
    !activeIsThreeRows &&
    Boolean(
      nextLyricText &&
        nextLyricText.trim() &&
        nextLyricText.trim() !== "•••" &&
        nextLyricText.trim() !== displayLineText.trim()
    );

  const wordsList = useMemo(() => {
    if (!displayLineText || displayLineText === "•••") return [];
    return displayLineText.trim().split(/\s+/).filter(Boolean);
  }, [displayLineText]);

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const effectiveTime = currentPosMs;

      if (displayLine?.isInstrumental && noteClipRectRef.current) {
        const lineStart = displayLine.timeMs;
        const lineDuration = Math.max(1000, displayLine.durationMs || 4000);
        const progress = Math.max(0, Math.min(1, (effectiveTime - lineStart) / lineDuration));
        const yVal = (24 * (1 - progress)).toFixed(2);
        noteClipRectRef.current.setAttribute("y", yVal);
      } else {
        const words = displayLine?.words;
        if (words && words.length > 0) {
          for (let i = 0; i < words.length; i++) {
            const span = wordSpanRefs.current[i];
            if (!span) continue;
            const w = words[i];

            const timedDuration = Math.max(120, w.endMs - w.timeMs);
            const swipeDuration = timedDuration * 1.6;
            const swipeLead = timedDuration * 0.1;
            const elapsed = effectiveTime - (w.timeMs - swipeLead);
            let startPct = -20;
            let endPct = -10;

            if (w.endMs <= w.timeMs) {
              if (effectiveTime >= w.timeMs) {
                startPct = 140;
                endPct = 150;
              }
            } else if (elapsed <= 0) {
              startPct = -20;
              endPct = -10;
            } else if (elapsed >= swipeDuration) {
              startPct = 140;
              endPct = 150;
            } else {
              const t = elapsed / swipeDuration;
              startPct = (-0.2 + t * 1.6) * 100;
              endPct = (-0.1 + t * 1.6) * 100;
            }

            const bg = `linear-gradient(90deg, #ffffff ${startPct.toFixed(1)}%, #71717a ${endPct.toFixed(1)}%)`;
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
  }, [currentPosMs, displayLine]);

  const handleWaveformPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const targetEl = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      targetEl.setPointerCapture(pointerId);
    } catch {}

    const rect = waveformRef.current.getBoundingClientRect();
    const waveformPad = 8;
    const trackWidth = Math.max(1, rect.width - waveformPad * 2);
    const getMsFromClientX = (clientX: number) => {
      const x = clientX - rect.left - waveformPad;
      const ratio = Math.max(0, Math.min(1, x / trackWidth));
      return ratio * durationMs;
    };

    const startClientX = e.clientX;
    const initialMs = getMsFromClientX(startClientX);
    let latestMs = initialMs;
    let isDragSeeking = false;

    const startSeeking = (targetMs: number) => {
      if (isDragSeeking) return;
      isDragSeeking = true;
      setIsSeeking(true);
      setLocalSeekMs(targetMs);
    };

    const holdTimer = window.setTimeout(() => {
      startSeeking(initialMs);
    }, 100);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const currentMs = getMsFromClientX(moveEvent.clientX);
      latestMs = currentMs;
      if (!isDragSeeking) {
        if (Math.abs(moveEvent.clientX - startClientX) > 3) {
          window.clearTimeout(holdTimer);
          startSeeking(currentMs);
        }
      } else {
        setLocalSeekMs(currentMs);
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      window.clearTimeout(holdTimer);
      try {
        if (targetEl.hasPointerCapture(pointerId)) {
          targetEl.releasePointerCapture(pointerId);
        }
      } catch {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      const finalMs =
        typeof upEvent.clientX === "number" && !Number.isNaN(upEvent.clientX)
          ? getMsFromClientX(upEvent.clientX)
          : latestMs;

      setIsSeeking(false);
      anchorPosRef.current = finalMs;
      anchorTimeRef.current = performance.now();
      setInterpolatedPosMs(finalMs);
      setState((prev) => ({ ...prev, positionMs: finalMs }));
      sendAction({ type: "seek", payload: { positionMs: finalMs } });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const [localVolumeLevel, setLocalVolumeLevel] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVolumeOpen) {
        setIsVolumeOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVolumeOpen]);

  const baseVolumeLevel = toVolumeLevel(state.volume);
  const activeVolumeLevel =
    isDraggingVolume && localVolumeLevel !== null ? localVolumeLevel : baseVolumeLevel;
  const activeVolumePercent = Math.round(activeVolumeLevel * 100);

  const handleToggleMute = useCallback(() => {
    if (activeVolumeLevel > 0) {
      lastNonZeroVolumeRef.current = activeVolumeLevel;
      setLocalVolumeLevel(0);
      sendAction({ type: "volume", payload: { volume: 0 } });
    } else {
      const restoreLevel = lastNonZeroVolumeRef.current || 0.7;
      setLocalVolumeLevel(restoreLevel);
      sendAction({
        type: "volume",
        payload: { volume: toVolumeGain(restoreLevel) },
      });
    }
  }, [activeVolumeLevel, sendAction]);

  const handleVolumePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!volumeTrackRef.current) return;
    const targetEl = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      targetEl.setPointerCapture(pointerId);
    } catch {}

    const rect = volumeTrackRef.current.getBoundingClientRect();
    const calculateLevel = (clientX: number) => {
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      return Math.round(ratio * 100) / 100;
    };

    setIsDraggingVolume(true);
    const initialLvl = calculateLevel(e.clientX);
    setLocalVolumeLevel(initialLvl);
    sendAction({
      type: "volume",
      payload: { volume: toVolumeGain(initialLvl) },
    });

    const onPointerMove = (moveEv: PointerEvent) => {
      if (moveEv.pointerId !== pointerId) return;
      const lvl = calculateLevel(moveEv.clientX);
      setLocalVolumeLevel(lvl);
      sendAction({
        type: "volume",
        payload: { volume: toVolumeGain(lvl) },
      });
    };

    const onPointerUp = (upEv: PointerEvent) => {
      if (upEv.pointerId !== pointerId) return;
      try {
        if (targetEl.hasPointerCapture(pointerId)) {
          targetEl.releasePointerCapture(pointerId);
        }
      } catch {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      setIsDraggingVolume(false);
      setLocalVolumeLevel(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  return (
    <div className="flex h-screen w-screen select-none items-center justify-center bg-transparent antialiased overflow-hidden font-sans p-0 m-0 border-0">
      <div className="relative flex h-full w-full flex-col justify-start rounded-xl bg-black p-3 text-white overflow-hidden shadow-2xl border-0 select-none">
        <div
          className="flex h-5 w-full items-center justify-between shrink-0 mb-1.5"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="flex items-center min-w-0 pr-2">
            <span className="text-[#52525b] text-xs mr-2 leading-none select-none">⠿</span>
            <div className="flex items-baseline min-w-0 truncate">
              <span className="font-semibold text-[11.5px] text-white tracking-tight truncate">
                {state.track?.title || "Liner"}
              </span>
              {state.track?.artist && (
                <span className="text-[10px] text-[#a1a1aa] truncate ml-1.5 font-normal">
                  • {state.track.artist}
                </span>
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-1 shrink-0"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => sendAction({ type: "restoreMainWindow" })}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[#8e8e93] hover:bg-white/10 hover:text-white transition-colors outline-none border-0"
              title="Open Liner"
            >
              <MaximizeSquare3 size={12} weight="Bold" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => sendAction({ type: "closeOverlay" })}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[#8e8e93] hover:bg-red-500/20 hover:text-red-400 transition-colors outline-none border-0"
              title="Close"
            >
              <CloseLine size={13} />
            </button>
          </div>
        </div>

        <div
          className="flex min-h-[52px] h-[52px] w-full items-center shrink-0"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div
            onClick={() => sendAction({ type: "togglePlay" })}
            className="relative h-13 w-13 shrink-0 rounded-lg overflow-hidden bg-[#141414] cursor-pointer group shadow-sm border-0"
          >
            {state.track?.cover ? (
              <img
                src={state.track.cover}
                alt=""
                crossOrigin="anonymous"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl text-[#71717a]">
                ♪
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              {isPlaying ? (
                <Pause size={18} weight="Bold" className="text-white" />
              ) : (
                <Play size={18} weight="Bold" className="text-white translate-x-[1px]" />
              )}
            </div>
          </div>

          <div className="flex h-full flex-1 flex-col justify-center min-w-0 pl-3 overflow-hidden">
            {hasLyricsContent ? (
              <div className="flex flex-col justify-center w-full overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={
                      displayLine?.isInstrumental
                        ? `instrumental-${displayLine.timeMs}`
                        : displayLine?.timeMs !== undefined
                          ? `${displayLine.timeMs}-${displayLine.text}`
                          : displayLineText
                    }
                    initial={{ opacity: 0, y: 14, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -14, scale: 0.96 }}
                    transition={{
                      duration: 0.3,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex w-full flex-col justify-center overflow-hidden origin-bottom-left"
                  >
                    {displayLine?.isInstrumental ? (
                      <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa] py-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
                          <defs>
                            <clipPath id="miniplayer-note-clip">
                              <rect
                                ref={noteClipRectRef}
                                x="0"
                                y={
                                  displayLine.timeMs !== undefined
                                    ? (
                                        24 *
                                        (1 -
                                          Math.max(
                                            0,
                                            Math.min(
                                              1,
                                              (currentPosMs - displayLine.timeMs) /
                                                Math.max(1000, displayLine.durationMs || 4000)
                                            )
                                          ))
                                      ).toFixed(2)
                                    : "24"
                                }
                                width="24"
                                height="24"
                              />
                            </clipPath>
                          </defs>
                          <path
                            d="M10 21q-1.65 0-2.825-1.175T6 17t1.175-2.825T10 13q.575 0 1.063.138t.937.412V4q0-.425.288-.712T13 3h4q.425 0 .713.288T18 4v2q0 .425-.288.713T17 7h-3v10q0 1.65-1.175 2.825T10 21"
                            fill="#52525b"
                          />
                          <path
                            d="M10 21q-1.65 0-2.825-1.175T6 17t1.175-2.825T10 13q.575 0 1.063.138t.937.412V4q0-.425.288-.712T13 3h4q.425 0 .713.288T18 4v2q0 .425-.288.713T17 7h-3v10q0 1.65-1.175 2.825T10 21"
                            fill="#ffffff"
                            clipPath="url(#miniplayer-note-clip)"
                          />
                        </svg>
                        <span className="font-medium text-[12px] text-[#a1a1aa]">Instrumental</span>
                      </div>
                    ) : displayLine?.words && displayLine.words.length > 0 ? (
                      <div
                        ref={activeLineContainerRef}
                        className="flex flex-wrap items-baseline gap-x-1 overflow-hidden leading-[16.5px] max-h-[50px]"
                      >
                        {displayLine.words.map((w: TouchBarWordData, idx: number) => (
                          <motion.span
                            key={`${displayLine.timeMs}-${idx}`}
                            ref={(el) => {
                              if (el) wordSpanRefs.current[idx] = el;
                            }}
                            initial={{ opacity: 0, y: 7 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.24,
                              delay: Math.min(0.24, idx * 0.022),
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="bg-clip-text text-transparent font-medium text-[12.5px] leading-[16.5px] inline-block tracking-tight"
                            style={{
                              backgroundImage:
                                "linear-gradient(90deg, #ffffff -20%, #71717a -10%)",
                            }}
                          >
                            {w.text.trim()}
                          </motion.span>
                        ))}
                      </div>
                    ) : (
                      <div
                        ref={activeLineContainerRef}
                        className="flex flex-wrap items-baseline gap-x-1 overflow-hidden leading-[16.5px] max-h-[50px]"
                      >
                        {wordsList.map((word, idx) => (
                          <motion.span
                            key={`${displayLine?.timeMs ?? displayLineText}-${idx}`}
                            initial={{ opacity: 0, y: 7 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.24,
                              delay: Math.min(0.24, idx * 0.022),
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="font-medium text-[12.5px] leading-[16.5px] text-white tracking-tight inline-block"
                          >
                            {word}
                          </motion.span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence mode="popLayout" initial={false}>
                  {showNextLine && (
                    <motion.div
                      key={nextLyricText}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="text-[10px] leading-[13px] text-[#71717a] truncate mt-0.5 select-none pointer-events-none w-full"
                    >
                      {nextLyricText}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col justify-center min-w-0">
                <p className="font-semibold text-[13.5px] text-white tracking-tight truncate">
                  {state.track?.title || "No track playing"}
                </p>
                <p className="text-[11px] text-[#a1a1aa] truncate mt-0.5">
                  {state.track?.artist || "Liner Music"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex h-7 w-full items-center gap-2 shrink-0 select-none my-1"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <span className="font-mono text-[10px] text-[#71717a] tabular-nums shrink-0 w-7 text-right">
            {formatTime(currentPosMs)}
          </span>

          <div
            ref={setWaveformRef}
            onPointerDown={handleWaveformPointerDown}
            className="relative flex h-full flex-1 cursor-pointer items-center bg-[#111111] rounded-[6px] overflow-hidden py-0.5 touch-none border-0"
          >
            <div className="absolute inset-x-2 inset-y-0.5 flex items-center">
              {waveformBars.map((heightRatio, i) => {
                const barRatio = i / Math.max(1, waveformBars.length - 1);
                const isPlayed = barRatio <= activeTimelineRatio;
                const pixelHeight = Math.max(4, Math.round(heightRatio * 21));

                return (
                  <div
                    key={i}
                    style={{
                      left: `${barRatio * 100}%`,
                      height: `${pixelHeight}px`,
                      width: "2px",
                    }}
                    className={`absolute -translate-x-1/2 rounded-full transition-colors duration-75 ${
                      isPlayed ? "bg-white" : "bg-[#27272a]"
                    }`}
                  />
                );
              })}

              <div
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 z-10"
                style={{ left: `${activeTimelineRatio * 100}%` }}
              >
                <motion.div
                  initial={false}
                  animate={{
                    width: isSeeking ? 11 : 3.5,
                    height: isSeeking ? 11 : 18,
                    borderRadius: 2,
                    scale: isSeeking ? 1.08 : 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 32,
                    mass: 0.5,
                  }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-md"
                />
                {isSeeking && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#181818] text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap border-0">
                    {formatTime(activeTimelineMs)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <span className="font-mono text-[10px] text-[#71717a] tabular-nums shrink-0 w-7 text-left">
            {formatTime(durationMs)}
          </span>
        </div>

        <div
          className="relative flex h-8 w-full items-center shrink-0 mt-auto"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isVolumeOpen ? (
              <motion.div
                key="volume-bar"
                initial={{ opacity: 0, scaleX: 0.88, originX: 1 }}
                animate={{ opacity: 1, scaleX: 1, originX: 1 }}
                exit={{ opacity: 0, scaleX: 0.88, originX: 1 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-full w-full items-center gap-2 px-0.5 origin-right"
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsVolumeOpen(false)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#8e8e93] hover:text-white hover:bg-white/10 active:scale-95 transition-all outline-none border-0"
                  title="Close volume"
                >
                  <CloseLine size={15} />
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleToggleMute}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#8e8e93] hover:text-white hover:bg-white/10 active:scale-95 transition-all outline-none border-0"
                  title={activeVolumeLevel === 0 ? "Unmute" : "Mute"}
                >
                  <VolumeIcon percent={activeVolumePercent} size={15} />
                </button>

                <div
                  ref={volumeTrackRef}
                  onPointerDown={handleVolumePointerDown}
                  className="relative flex flex-1 items-center h-full cursor-pointer touch-none select-none px-1"
                >
                  <div className="relative w-full h-[6px] rounded-full bg-[#222226] overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 bg-white rounded-full ${
                        isDraggingVolume ? "" : "transition-[width] duration-75 ease-out"
                      }`}
                      style={{ width: `${activeVolumePercent}%` }}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                    style={{ left: `calc(${activeVolumePercent}% * 0.98 + 2px)` }}
                  >
                    <div className="h-[12px] w-[3.5px] bg-white rounded-full shadow-sm" />
                  </div>
                </div>

                <div className="flex items-center justify-center shrink-0 w-11 pr-0.5">
                  <span className="font-mono text-[10.5px] text-[#8e8e93] tabular-nums select-none text-center">
                    {activeVolumePercent}%
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="playback-controls"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="relative flex h-full w-full items-center justify-between"
              >
                <div className="flex items-center">
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => sendAction({ type: "toggleShuffle" })}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors outline-none border-0 ${
                      state.shuffle
                        ? "text-white bg-white/20"
                        : "text-[#8e8e93] hover:text-white hover:bg-white/10"
                    }`}
                    title="Shuffle"
                  >
                    <Shuffle size={14} weight={state.shuffle ? "Bold" : "Outline"} />
                  </button>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => sendAction({ type: "prev" })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8e8e93] hover:text-white hover:bg-white/10 active:scale-95 transition-all outline-none border-0"
                    title="Previous"
                  >
                    <SkipPrevious size={16} weight="Bold" />
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => sendAction({ type: "togglePlay" })}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-[#e4e4e7] active:scale-95 transition-all shadow-md outline-none border-0"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause size={16} weight="Bold" />
                    ) : (
                      <Play size={16} weight="Bold" className="translate-x-[0.5px]" />
                    )}
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => sendAction({ type: "next" })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8e8e93] hover:text-white hover:bg-white/10 active:scale-95 transition-all outline-none border-0"
                    title="Next"
                  >
                    <SkipNext size={16} weight="Bold" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => sendAction({ type: "like" })}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors outline-none active:scale-90 border-0 ${
                      state.isLiked
                        ? "text-red-500 hover:text-red-400"
                        : "text-[#8e8e93] hover:text-white hover:bg-white/10"
                    }`}
                    title={state.isLiked ? "Unlike" : "Like"}
                  >
                    {state.isLiked ? <HeartFill size={15} /> : <HeartLine size={15} />}
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setIsVolumeOpen(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8e8e93] hover:text-white hover:bg-white/10 transition-colors outline-none border-0"
                    title="Volume"
                  >
                    <VolumeIcon percent={activeVolumePercent} size={14} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default TouchBarSimulator;

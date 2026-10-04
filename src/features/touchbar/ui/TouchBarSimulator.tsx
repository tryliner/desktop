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
  const lastNonZeroVolumeRef = useRef<number>(0.7);

  useEffect(() => {
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
  const currentPosMs = isSeeking ? localSeekMs : state.positionMs;
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

  const barsCount = Math.max(20, Math.min(54, Math.floor((waveformWidth - 16) / 5)));
  const waveformSeed = state.track ? `${state.track.id || state.track.title}-${durationMs}` : "liner";
  const waveformBars = useMemo(
    () => generateWaveform(waveformSeed, barsCount),
    [waveformSeed, barsCount]
  );

  const anchorPosRef = useRef(state.positionMs);
  const anchorTimeRef = useRef(performance.now());
  const wordSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const noteClipRectRef = useRef<SVGRectElement | null>(null);

  useEffect(() => {
    anchorPosRef.current = state.positionMs;
    anchorTimeRef.current = performance.now();
  }, [state.positionMs, state.status]);

  const lastActiveLineRef = useRef<TouchBarActiveLine | null>(null);
  const lastActiveLyricTextRef = useRef<string>("");
  const currentTrackId = state.track?.id;
  const prevTrackIdRef = useRef<string | undefined>(currentTrackId);

  if (prevTrackIdRef.current !== currentTrackId) {
    prevTrackIdRef.current = currentTrackId;
    lastActiveLineRef.current = null;
    lastActiveLyricTextRef.current = "";
  }

  if (state.activeLine) {
    lastActiveLineRef.current = state.activeLine;
    lastActiveLyricTextRef.current = state.activeLine.text;
  } else if (state.activeLyricText) {
    lastActiveLyricTextRef.current = state.activeLyricText;
  }

  const hasLyricsContent = Boolean(
    state.hasSyncedLyrics ||
      state.activeLine ||
      state.activeLyricText ||
      lastActiveLyricTextRef.current
  );

  const displayLine = state.activeLine || lastActiveLineRef.current;
  const displayLineText =
    displayLine?.isInstrumental
      ? ""
      : state.activeLine?.text ||
        state.activeLyricText ||
        lastActiveLyricTextRef.current ||
        state.nextLyricText ||
        "•••";

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const now = performance.now();
      const currentPos = isSeeking
        ? localSeekMs
        : isPlaying
          ? anchorPosRef.current + (now - anchorTimeRef.current)
          : state.positionMs;

      const effectiveTime = currentPos;

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

            const bg = `linear-gradient(90deg, #ffffff ${startPct.toFixed(1)}%, #636366 ${endPct.toFixed(1)}%)`;
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
  }, [state.status, state.positionMs, isSeeking, localSeekMs, displayLine, isPlaying]);

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
    if (!isDraggingVolume) return;
    const handleUp = () => {
      setIsDraggingVolume(false);
      setLocalVolumeLevel(null);
    };
    window.addEventListener("pointerup", handleUp);
    return () => window.removeEventListener("pointerup", handleUp);
  }, [isDraggingVolume]);

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

  return (
    <div className="flex h-screen w-screen select-none items-center justify-center bg-transparent antialiased overflow-hidden font-sans p-0 m-0 border-0">
      <div className="relative flex h-full w-full flex-col justify-between rounded-2xl bg-[#121214] p-3 text-white overflow-hidden shadow-2xl border-0 select-none">
        <div
          className="flex h-5 w-full items-center justify-between shrink-0"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="flex items-center min-w-0 pr-2">
            <span className="text-[#636366] text-xs mr-2 leading-none select-none">⠿</span>
            <div className="flex items-baseline min-w-0 truncate">
              <span className="font-semibold text-[11.5px] text-white tracking-tight truncate">
                {state.track?.title || "Liner"}
              </span>
              {state.track?.artist && (
                <span className="text-[10px] text-[#8e8e93] truncate ml-1.5 font-normal">
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
          className="flex h-14 w-full items-center my-auto"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div
            onClick={() => sendAction({ type: "togglePlay" })}
            className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-[#1c1c1e] cursor-pointer group shadow-sm border-0"
          >
            {state.track?.cover ? (
              <img
                src={state.track.cover}
                alt=""
                crossOrigin="anonymous"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl text-[#8e8e93]">
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
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={
                      displayLine?.isInstrumental
                        ? `instrumental-${displayLine.timeMs}`
                        : displayLine?.timeMs !== undefined
                          ? `${displayLine.timeMs}-${displayLine.text}`
                          : displayLineText
                    }
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="flex max-w-full items-center overflow-hidden"
                  >
                    {displayLine?.isInstrumental ? (
                      <div className="flex items-center gap-1.5 text-xs text-[#8e8e93]">
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
                            fill="#636366"
                          />
                          <path
                            d="M10 21q-1.65 0-2.825-1.175T6 17t1.175-2.825T10 13q.575 0 1.063.138t.937.412V4q0-.425.288-.712T13 3h4q.425 0 .713.288T18 4v2q0 .425-.288.713T17 7h-3v10q0 1.65-1.175 2.825T10 21"
                            fill="#ffffff"
                            clipPath="url(#miniplayer-note-clip)"
                          />
                        </svg>
                        <span>Instrumental</span>
                      </div>
                    ) : displayLine?.words && displayLine.words.length > 0 ? (
                      <div className="flex flex-wrap items-baseline gap-1 overflow-hidden leading-tight">
                        {displayLine.words.map((w: TouchBarWordData, idx: number) => (
                          <span
                            key={`${w.timeMs}-${idx}`}
                            ref={(el) => {
                              if (el) wordSpanRefs.current[idx] = el;
                            }}
                            className="bg-clip-text text-transparent font-medium text-[13px] inline tracking-tight"
                            style={{
                              backgroundImage:
                                "linear-gradient(90deg, #ffffff -20%, #636366 -10%)",
                            }}
                          >
                            {w.text.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="font-medium text-[13px] text-white tracking-tight truncate">
                        {displayLineText}
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>

                {state.nextLyricText && state.nextLyricText !== displayLineText && (
                  <p className="text-[10px] text-[#636366] truncate mt-1">
                    {state.nextLyricText}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col justify-center min-w-0">
                <p className="font-semibold text-[13.5px] text-white tracking-tight truncate">
                  {state.track?.title || "No track playing"}
                </p>
                <p className="text-[11px] text-[#8e8e93] truncate mt-0.5">
                  {state.track?.artist || "Liner Music"}
                </p>
                {state.track?.album && (
                  <p className="text-[9.5px] text-[#636366] truncate mt-0.5">
                    {state.track.album}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex h-5 w-full items-center gap-2 shrink-0 select-none"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <span className="font-mono text-[9.5px] text-[#8e8e93] tabular-nums shrink-0 w-6 text-right">
            {formatTime(currentPosMs)}
          </span>

          <div
            ref={setWaveformRef}
            onPointerDown={handleWaveformPointerDown}
            className="relative flex h-full flex-1 cursor-pointer items-center bg-[#1c1c1f] hover:bg-[#222226] transition-colors rounded-lg overflow-hidden py-0.5 touch-none border-0"
          >
            <div className="absolute inset-x-2 inset-y-1 flex items-center">
              {waveformBars.map((heightRatio, i) => {
                const barRatio = i / (waveformBars.length - 1);
                const isPlayed = barRatio <= activeTimelineRatio;
                const pixelHeight = Math.max(3, Math.round(heightRatio * 14));

                return (
                  <div
                    key={i}
                    style={{
                      left: `${barRatio * 100}%`,
                      height: `${pixelHeight}px`,
                      width: "2px",
                    }}
                    className={`absolute -translate-x-1/2 rounded-full transition-colors duration-75 ${
                      isPlayed ? "bg-white" : "bg-[#333336]"
                    }`}
                  />
                );
              })}

              <div
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 z-10"
                style={{ left: `${activeTimelineRatio * 100}%` }}
              >
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full shadow-md"
                  style={{
                    width: isSeeking ? "10px" : "3px",
                    height: isSeeking ? "10px" : "12px",
                  }}
                />
                {isSeeking && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#1c1c1e] text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap border-0">
                    {formatTime(activeTimelineMs)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <span className="font-mono text-[9.5px] text-[#8e8e93] tabular-nums shrink-0 w-6 text-left">
            {formatTime(durationMs)}
          </span>
        </div>

        <div
          className="relative flex h-8 w-full items-center justify-between shrink-0"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div className="flex items-center">
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => sendAction({ type: "toggleShuffle" })}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors outline-none border-0 ${
                state.shuffle
                  ? "text-white bg-white/15"
                  : "text-[#8e8e93] hover:text-white hover:bg-white/5"
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
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8e8e93] hover:text-white hover:bg-white/5 active:scale-95 transition-all outline-none border-0"
              title="Previous"
            >
              <SkipPrevious size={16} weight="Bold" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => sendAction({ type: "togglePlay" })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-[#f2f2f7] active:scale-95 transition-all shadow-md outline-none border-0"
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
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8e8e93] hover:text-white hover:bg-white/5 active:scale-95 transition-all outline-none border-0"
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
                  : "text-[#8e8e93] hover:text-white hover:bg-white/5"
              }`}
              title={state.isLiked ? "Unlike" : "Like"}
            >
              {state.isLiked ? <HeartFill size={15} /> : <HeartLine size={15} />}
            </button>

            <div className="relative flex items-center">
              <AnimatePresence>
                {isVolumeOpen ? (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 90, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="flex items-center gap-1.5 bg-[#1c1c1e] px-2 py-1 rounded-lg overflow-hidden mr-1 border-0"
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleToggleMute}
                      className="text-[#8e8e93] hover:text-white transition-colors border-0"
                    >
                      <VolumeIcon percent={activeVolumePercent} size={12} />
                    </button>
                    <input
                      type="range"
                      tabIndex={-1}
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeVolumeLevel}
                      onPointerDown={() => setIsDraggingVolume(true)}
                      onPointerUp={() => {
                        setIsDraggingVolume(false);
                        setLocalVolumeLevel(null);
                      }}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalVolumeLevel(val);
                        sendAction({
                          type: "volume",
                          payload: { volume: toVolumeGain(val) },
                        });
                      }}
                      className="w-12 h-1 bg-[#3a3a3c] rounded appearance-none cursor-pointer accent-white border-0"
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsVolumeOpen(!isVolumeOpen)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8e8e93] hover:text-white hover:bg-white/5 transition-colors outline-none border-0"
                title="Volume"
              >
                <VolumeIcon percent={activeVolumePercent} size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TouchBarSimulator;

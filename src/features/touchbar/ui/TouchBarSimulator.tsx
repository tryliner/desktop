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
} from "@solar-icons/react";
import { HeartFill, HeartLine } from "@mingcute/react";
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

function generateWaveform(seed: string, count = 52): number[] {
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

function VolumeIcon({ percent, size = 13 }: { percent: number; size?: number }) {
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
  const [hoverPositionMs, setHoverPositionMs] = useState<number | null>(null);
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
  const durationMs = state.durationMs || state.track?.durationMs || 1;
  const currentPosMs = isSeeking ? localSeekMs : state.positionMs;
  const progressRatio = Math.min(1, Math.max(0, currentPosMs / durationMs));

  const [waveformWidth, setWaveformWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const updateWaveformWidth = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0) {
      setWaveformWidth(Math.round(rect.width));
    }
  }, []);

  const setWaveformRef = useCallback(
    (node: HTMLDivElement | null) => {
      waveformRef.current = node;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (node) {
        updateWaveformWidth(node);
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const width = entry.contentRect.width;
            if (width > 0) {
              setWaveformWidth(Math.round(width));
            }
          }
        });
        observer.observe(node);
        observerRef.current = observer;
      }
    },
    [updateWaveformWidth]
  );

  useEffect(() => {
    const handleResize = () => {
      if (waveformRef.current) {
        updateWaveformWidth(waveformRef.current);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateWaveformWidth]);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  const effectiveWidth =
    waveformWidth > 0
      ? waveformWidth
      : typeof window !== "undefined"
      ? Math.max(300, window.innerWidth - 260)
      : 300;

  const barSlotWidth = 5;
  const padding = 16;
  const barsCount = Math.max(16, Math.floor((effectiveWidth - padding) / barSlotWidth));
  const waveformSeed = state.track ? `${state.track.id || state.track.title}-${durationMs}` : "default";
  const waveformBars = useMemo(
    () => generateWaveform(waveformSeed, barsCount),
    [waveformSeed, barsCount]
  );

  const handleWaveformPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const padding = 8;
    const trackWidth = Math.max(1, rect.width - padding * 2);
    const clickX = e.clientX - rect.left - padding;
    const ratio = Math.max(0, Math.min(1, clickX / trackWidth));
    const targetMs = ratio * durationMs;
    setIsSeeking(true);
    setLocalSeekMs(targetMs);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const currentX = moveEvent.clientX - rect.left - padding;
      const moveRatio = Math.max(0, Math.min(1, currentX / trackWidth));
      setLocalSeekMs(moveRatio * durationMs);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      const finalX = upEvent.clientX - rect.left - padding;
      const finalRatio = Math.max(0, Math.min(1, finalX / trackWidth));
      const finalMs = finalRatio * durationMs;
      setIsSeeking(false);
      setHoverPositionMs(null);
      sendAction({ type: "seek", payload: { positionMs: finalMs } });
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleWaveformPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const padding = 8;
    const trackWidth = Math.max(1, rect.width - padding * 2);
    const clickX = e.clientX - rect.left - padding;
    const ratio = Math.max(0, Math.min(1, clickX / trackWidth));
    setHoverPositionMs(ratio * durationMs);
  };

  const handleWaveformPointerLeave = () => {
    if (!isSeeking) {
      setHoverPositionMs(null);
    }
  };

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

  const anchorPosRef = useRef(state.positionMs);
  const anchorTimeRef = useRef(performance.now());
  const wordSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    anchorPosRef.current = state.positionMs;
    anchorTimeRef.current = performance.now();
  }, [state.positionMs, state.status]);

  const displayLine = state.activeLine || lastActiveLineRef.current;
  const displayLineText =
    state.activeLine?.text ||
    state.activeLyricText ||
    lastActiveLyricTextRef.current ||
    state.nextLyricText ||
    "•••";

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const isPlaying = state.status === "playing";
      const now = performance.now();
      const currentPos = isSeeking
        ? localSeekMs
        : isPlaying
          ? anchorPosRef.current + (now - anchorTimeRef.current)
          : state.positionMs;

      const effectiveTime = currentPos + (state.offsetMs || 0);

      const words = displayLine?.words;
      if (words && words.length > 0) {
        for (let i = 0; i < words.length; i++) {
          const span = wordSpanRefs.current[i];
          if (!span) continue;
          const w = words[i];

          let progress = 0;
          if (w.endMs <= w.timeMs) {
            progress = effectiveTime >= w.timeMs ? 100 : 0;
          } else if (effectiveTime >= w.endMs) {
            progress = 100;
          } else if (effectiveTime <= w.timeMs) {
            progress = 0;
          } else {
            const pct = ((effectiveTime - w.timeMs) / (w.endMs - w.timeMs)) * 100;
            progress = Math.max(0, Math.min(100, pct));
          }

          const bg = `linear-gradient(to right, #ffffff ${progress.toFixed(1)}%, #636366 ${progress.toFixed(1)}%)`;
          if (span.style.backgroundImage !== bg) {
            span.style.backgroundImage = bg;
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [state.status, state.positionMs, state.offsetMs, isSeeking, localSeekMs, displayLine]);

  const volumeLevel = toVolumeLevel(state.volume);
  const volumePercent = Math.round(volumeLevel * 100);

  const handleToggleMute = useCallback(() => {
    if (volumeLevel > 0) {
      lastNonZeroVolumeRef.current = volumeLevel;
      sendAction({ type: "volume", payload: { volume: 0 } });
    } else {
      const restoreLevel = lastNonZeroVolumeRef.current || 0.7;
      sendAction({
        type: "volume",
        payload: { volume: toVolumeGain(restoreLevel) },
      });
    }
  }, [volumeLevel, sendAction]);

  return (
    <div className="flex h-full w-full select-none items-center justify-between bg-black px-2 text-white antialiased overflow-hidden">
      <div
        className="flex items-center gap-1.5 shrink-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div
          className="flex h-6 w-2.5 cursor-grab items-center justify-center text-[#38383a] hover:text-[#8e8e93] active:cursor-grabbing"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <span className="text-[10px] leading-none">⠿</span>
        </div>

        <div className="flex items-center gap-2 pl-0.5 pr-1">
          {state.track?.cover ? (
            <img
              src={state.track.cover}
              alt=""
              className="h-6 w-6 shrink-0 rounded-[5px] object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] bg-[#1c1c1e] text-[#8e8e93] text-[10px]">
              ♪
            </div>
          )}
          <div className="min-w-0 max-w-[100px] leading-tight">
            <p className="truncate text-[11px] font-medium text-white tracking-tight">
              {state.track?.title || "No track"}
            </p>
            <p className="truncate text-[9.5px] text-[#8e8e93]">
              {state.track?.artist || "Liner"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => sendAction({ type: "prev" })}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
          >
            <SkipPrevious size={13} weight="Bold" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => sendAction({ type: "togglePlay" })}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-white hover:bg-[#2c2c2e] active:bg-[#3a3a3c] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={13} weight="Bold" />
            ) : (
              <Play size={13} weight="Bold" />
            )}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => sendAction({ type: "next" })}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
          >
            <SkipNext size={13} weight="Bold" />
          </button>
        </div>
      </div>

      <div
        className="relative mx-1.5 flex flex-1 min-w-0 items-center justify-center overflow-hidden"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {state.isFullscreen ? (
          <div
            onClick={() => sendAction({ type: "toggleFullscreen" })}
            className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden text-center"
          >
            <div className="relative flex items-center justify-center w-full min-h-[16px]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={displayLine?.timeMs !== undefined ? `${displayLine.timeMs}-${displayLine.text}` : displayLineText}
                  initial={{ y: 13, scale: 0.82, opacity: 0.6 }}
                  animate={{ y: 0, scale: 1, opacity: 1 }}
                  exit={{ y: -13, scale: 0.96, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="flex max-w-full items-center justify-center gap-1 px-2 text-center origin-center"
                >
                  {displayLine?.words && displayLine.words.length > 0 ? (
                    displayLine.words.map((w: TouchBarWordData, idx: number) => {
                      return (
                        <span
                          key={`${w.timeMs}-${idx}`}
                          ref={(el) => {
                            if (el) {
                              wordSpanRefs.current[idx] = el;
                            }
                          }}
                          className="bg-clip-text text-transparent font-medium inline"
                          style={{
                            backgroundImage: "linear-gradient(to right, #ffffff 0%, #636366 0%)",
                            fontSize: "11.5px",
                            lineHeight: "14px",
                          }}
                        >
                          {w.text}
                        </span>
                      );
                    })
                  ) : (
                    <motion.span
                      initial={{ color: "#636366" }}
                      animate={{ color: "#ffffff" }}
                      transition={{ duration: 0.32, ease: "easeOut" }}
                      className="text-[11.5px] font-medium truncate max-w-full"
                    >
                      {displayLineText}
                    </motion.span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="relative flex items-center justify-center w-full min-h-[11px] mt-0.5 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                {state.nextLyricText && state.nextLyricText !== displayLineText && (
                  <motion.p
                    key={state.nextLyricText}
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="max-w-full truncate text-[8.5px] text-[#636366] leading-none"
                  >
                    {state.nextLyricText}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex h-6 w-full items-center gap-1.5 px-0.5">
            <span className="w-7 shrink-0 font-mono text-[9.5px] tabular-nums text-[#8e8e93] text-right">
              {formatTime(hoverPositionMs !== null ? hoverPositionMs : currentPosMs)}
            </span>

            <div
              ref={setWaveformRef}
              onPointerDown={handleWaveformPointerDown}
              onPointerMove={handleWaveformPointerMove}
              onPointerLeave={handleWaveformPointerLeave}
              className="relative flex h-6 flex-1 min-w-[60px] cursor-pointer items-center rounded-[6px] bg-[#161618] hover:bg-[#19191c] transition-colors overflow-hidden select-none"
            >
              <div className="absolute inset-x-2 inset-y-0 flex items-center">
                {waveformBars.map((heightRatio, i) => {
                  const barRatio = i / (waveformBars.length - 1);
                  const isPlayed = barRatio <= progressRatio;
                  const pixelHeight = Math.max(3, Math.round(heightRatio * 16));

                  return (
                    <div
                      key={i}
                      style={{
                        left: `${barRatio * 100}%`,
                        height: `${pixelHeight}px`,
                      }}
                      className={`absolute w-[2px] -translate-x-1/2 rounded-full transition-colors duration-75 ${
                        isPlayed ? "bg-white" : "bg-[#333336]"
                      }`}
                    />
                  );
                })}

                <div
                  className="pointer-events-none absolute top-1/2 h-4 w-[2.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                  style={{
                    left: `${progressRatio * 100}%`,
                  }}
                />

                {hoverPositionMs !== null && (
                  <div
                    className="pointer-events-none absolute -top-0.5 rounded-[4px] bg-[#2c2c2e] px-1 font-mono text-[8.5px] text-white shadow -translate-x-1/2"
                    style={{
                      left: `${(hoverPositionMs / durationMs) * 100}%`,
                    }}
                  >
                    {formatTime(hoverPositionMs)}
                  </div>
                )}
              </div>
            </div>

            <span className="w-7 shrink-0 font-mono text-[9.5px] tabular-nums text-[#8e8e93] text-left">
              {formatTime(durationMs)}
            </span>
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-1 pl-0.5 shrink-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => sendAction({ type: "like" })}
          className={`flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1c1e] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
            state.isLiked
              ? "text-red-500 hover:text-red-400"
              : "text-[#8e8e93] hover:text-white"
          }`}
          title={state.isLiked ? "Unlike" : "Like"}
        >
          {state.isLiked ? (
            <HeartFill size={13} />
          ) : (
            <HeartLine size={13} />
          )}
        </button>

        <AnimatePresence initial={false}>
          {isVolumeOpen ? (
            <motion.div
              key="inline-volume"
              initial={{ width: 24, opacity: 0 }}
              animate={{ width: 172, opacity: 1 }}
              exit={{ width: 24, opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="flex h-6 items-center rounded-[6px] bg-[#1c1c1e] px-1.5 gap-1.5 overflow-hidden"
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleToggleMute}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[#8e8e93] hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                title={volumePercent === 0 ? "Unmute" : "Mute"}
              >
                <VolumeIcon percent={volumePercent} size={13} />
              </button>

              <div className="relative flex flex-1 items-center h-full min-w-0">
                <div className="relative h-[4px] w-full rounded-full bg-[#2c2c2e] overflow-hidden my-auto">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-75"
                    style={{ width: `${volumePercent}%` }}
                  />
                </div>
                <div
                  className="pointer-events-none absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                  style={{ left: `${volumePercent}%` }}
                />
                <input
                  type="range"
                  tabIndex={-1}
                  min={0}
                  max={1}
                  step={0.01}
                  value={volumeLevel}
                  onChange={(e) =>
                    sendAction({
                      type: "volume",
                      payload: { volume: toVolumeGain(Number(e.target.value)) },
                    })
                  }
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                />
              </div>

              <span className="w-7 shrink-0 font-mono text-[9.5px] tabular-nums text-[#8e8e93] text-right select-none leading-none flex items-center justify-end h-full">
                {volumePercent}%
              </span>

              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsVolumeOpen(false)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                title="Close Volume"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="block">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="volume-icon"
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: "easeOut" }}
              onClick={() => setIsVolumeOpen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
              title="Volume"
            >
              <VolumeIcon percent={volumePercent} size={14} />
            </motion.button>
          )}
        </AnimatePresence>

        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => sendAction({ type: "toggleFullscreen" })}
          className={`flex h-6 w-6 items-center justify-center rounded-[6px] transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
            state.isFullscreen
              ? "bg-white text-black hover:bg-[#e5e5ea]"
              : "bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c]"
          }`}
          title="Fullscreen / Lyrics"
        >
          <MaximizeSquare3 size={13} weight="Bold" />
        </button>
      </div>
    </div>
  );
}

export default TouchBarSimulator;

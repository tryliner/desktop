import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toVolumeLevel, toVolumeGain } from "@/features/player/engine/volume";
import type { TouchBarAction, TouchBarStatePayload } from "../contracts";

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

export function TouchBarSimulator() {
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

  const waveformSeed = state.track ? `${state.track.id || state.track.title}-${durationMs}` : "default";
  const waveformBars = useMemo(() => generateWaveform(waveformSeed, 52), [waveformSeed]);

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

  const effectiveLyricsTimeMs = currentPosMs + (state.offsetMs || 0);
  const volumeLevel = toVolumeLevel(state.volume);
  const volumePercent = Math.round(volumeLevel * 100);

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
            onClick={() => sendAction({ type: "prev" })}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3.5" y="4.5" width="2.5" height="15" rx="1" />
              <path d="M20 5.2v13.6c0 .8-.9 1.3-1.6.8L8.6 12.8c-.6-.4-.6-1.3 0-1.7l9.8-6.7c.7-.5 1.6 0 1.6.8z" />
            </svg>
          </button>
          <button
            onClick={() => sendAction({ type: "togglePlay" })}
            className="flex h-6 w-7 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-white hover:bg-[#2c2c2e] active:bg-[#3a3a3c] transition-colors"
          >
            {isPlaying ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5.5" y="4" width="4" height="16" rx="1.5" />
                <rect x="14.5" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4.5v15c0 .8.9 1.3 1.6.9l12-7.5c.7-.4.7-1.4 0-1.8l-12-7.5c-.7-.4-1.6.1-1.6.9z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => sendAction({ type: "next" })}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 5.2v13.6c0 .8.9 1.3 1.6.8l9.8-6.8c.6-.4.6-1.3 0-1.7L5.6 4.4c-.7-.5-1.6 0-1.6.8z" />
              <rect x="18" y="4.5" width="2.5" height="15" rx="1" />
            </svg>
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
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden text-center py-0.5"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={state.activeLine?.timeMs ?? (state.activeLyricText || "idle")}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex max-w-full items-center justify-center gap-1 px-2 text-center"
              >
                {state.activeLine?.words && state.activeLine.words.length > 0 ? (
                  state.activeLine.words.map((w, idx) => {
                    const isSung = effectiveLyricsTimeMs >= w.endMs;
                    const isActive =
                      effectiveLyricsTimeMs >= w.timeMs &&
                      effectiveLyricsTimeMs < w.endMs;

                    return (
                      <span
                        key={`${w.timeMs}-${idx}`}
                        className={`transition-all duration-100 ${
                          isActive
                            ? "font-semibold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.85)] scale-[1.03]"
                            : isSung
                              ? "font-medium text-white"
                              : "font-normal text-[#545458]"
                        }`}
                        style={{ fontSize: "11.5px", lineHeight: "14px" }}
                      >
                        {w.text}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[11.5px] font-medium text-white truncate max-w-full">
                    {state.activeLine?.text || state.activeLyricText || state.track?.title || "Lyrics"}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>

            {state.nextLyricText && (
              <p className="max-w-full truncate text-[8.5px] text-[#48484a] mt-0.5">
                {state.nextLyricText}
              </p>
            )}
          </div>
        ) : (
          <div className="flex h-6 w-full items-center gap-1.5 px-0.5">
            <span className="w-7 shrink-0 font-mono text-[9.5px] tabular-nums text-[#8e8e93] text-right">
              {formatTime(hoverPositionMs !== null ? hoverPositionMs : currentPosMs)}
            </span>

            <div
              ref={waveformRef}
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
          onClick={() => sendAction({ type: "like" })}
          className={`flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1c1e] transition-colors ${
            state.isLiked
              ? "text-red-500 hover:text-red-400"
              : "text-[#8e8e93] hover:text-white"
          }`}
          title={state.isLiked ? "Unlike" : "Like"}
        >
          {state.isLiked ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          )}
        </button>

        <AnimatePresence initial={false} mode="wait">
          {isVolumeOpen ? (
            <motion.div
              key="inline-volume"
              initial={{ width: 24, opacity: 0 }}
              animate={{ width: 172, opacity: 1 }}
              exit={{ width: 24, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="flex h-6 items-center rounded-[6px] bg-[#1c1c1e] px-1.5 gap-1.5 overflow-hidden"
            >
              <button
                onClick={() => sendAction({ type: "volume", payload: { volume: 0 } })}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[#8e8e93] hover:text-white transition-colors"
                title="Mute"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="10 5 5 9 2 9 2 15 5 15 10 19 10 5" fill="currentColor" stroke="none" />
                  <line x1="22" y1="9" x2="16" y2="15" />
                  <line x1="16" y1="9" x2="22" y2="15" />
                </svg>
              </button>

              <div className="relative flex flex-1 items-center h-full">
                <div className="relative h-1 w-full rounded-full bg-[#2c2c2e] overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${volumePercent}%` }}
                  />
                </div>
                <div
                  className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                  style={{ left: `${volumePercent}%` }}
                />
                <input
                  type="range"
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
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                />
              </div>

              <span className="w-6 shrink-0 font-mono text-[9px] tabular-nums text-[#8e8e93] text-right select-none">
                {volumePercent}%
              </span>

              <button
                onClick={() => setIsVolumeOpen(false)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white transition-colors"
                title="Close Volume"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="volume-icon"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={() => setIsVolumeOpen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors"
              title="Volume"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="10 5 5 9 2 9 2 15 5 15 10 19 10 5" fill="currentColor" stroke="none" />
                <path d="M14.5 9a4 4 0 0 1 0 6" />
                <path d="M17.5 6a8 8 0 0 1 0 12" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        <button
          onClick={() => sendAction({ type: "toggleFullscreen" })}
          className={`flex h-6 w-6 items-center justify-center rounded-[6px] transition-colors ${
            state.isFullscreen
              ? "bg-white text-black hover:bg-[#e5e5ea]"
              : "bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c]"
          }`}
          title="Fullscreen / Lyrics"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TouchBarSimulator;

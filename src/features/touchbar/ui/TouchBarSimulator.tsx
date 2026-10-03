import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TouchBarAction, TouchBarStatePayload } from "../contracts";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function generateWaveform(seed: string, count = 72): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = i / count;
    const wave1 = Math.sin(x * Math.PI * 4 + hash);
    const wave2 = Math.cos(x * Math.PI * 11 + hash * 0.3);
    const wave3 = Math.sin(x * Math.PI * 18 + hash * 0.7);
    const raw = 0.35 + 0.3 * Math.abs(wave1) + 0.2 * Math.abs(wave2) + 0.15 * Math.abs(wave3);
    result.push(Math.max(0.18, Math.min(0.96, raw)));
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
  const waveformBars = useMemo(() => generateWaveform(waveformSeed, 68), [waveformSeed]);

  const handleWaveformPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetMs = ratio * durationMs;
    setIsSeeking(true);
    setLocalSeekMs(targetMs);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const moveRatio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      setLocalSeekMs(moveRatio * durationMs);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      const finalRatio = Math.max(0, Math.min(1, (upEvent.clientX - rect.left) / rect.width));
      const finalMs = finalRatio * durationMs;
      setIsSeeking(false);
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
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPositionMs(ratio * durationMs);
  };

  const handleWaveformPointerLeave = () => {
    setHoverPositionMs(null);
  };

  const effectiveLyricsTimeMs = currentPosMs + (state.offsetMs || 0);

  return (
    <div className="flex h-full w-full select-none items-center justify-between bg-black px-2 text-white antialiased rounded-[8px] overflow-hidden">
      <AnimatePresence mode="wait">
        {isVolumeOpen ? (
          <motion.div
            key="volume-bar"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex h-full w-full items-center justify-between px-3"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              onClick={() => sendAction({ type: "volume", payload: { volume: 0 } })}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#8e8e93] hover:text-white transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            </button>

            <div className="flex flex-1 items-center gap-3 px-4">
              <span className="font-mono text-[10px] text-[#8e8e93] w-7 text-left">
                {Math.round(state.volume * 100)}%
              </span>
              <div className="relative flex flex-1 items-center">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.volume}
                  onChange={(e) =>
                    sendAction({
                      type: "volume",
                      payload: { volume: Number(e.target.value) },
                    })
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2c2c2e] accent-white hover:bg-[#3a3a3c] transition-colors"
                />
              </div>
            </div>

            <button
              onClick={() => sendAction({ type: "volume", payload: { volume: 1 } })}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#8e8e93] hover:text-white transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </button>

            <button
              onClick={() => setIsVolumeOpen(false)}
              className="ml-3 flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="player-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex h-full w-full items-center justify-between"
          >
            <div
              className="flex h-7 w-4 cursor-grab items-center justify-center text-[#48484a] hover:text-[#8e8e93] active:cursor-grabbing"
              style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
              <span className="text-[10px] leading-none">⠿</span>
            </div>

            <div
              className="flex items-center gap-2 pl-1 pr-2"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              {state.track?.cover ? (
                <img
                  src={state.track.cover}
                  alt=""
                  className="h-[26px] w-[26px] flex-shrink-0 rounded-[4px] object-cover"
                />
              ) : (
                <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[4px] bg-[#1c1c1e] text-[#8e8e93] text-[10px]">
                  ♪
                </div>
              )}
              <div className="min-w-0 max-w-[125px] leading-tight">
                <p className="truncate text-[11px] font-normal text-white">
                  {state.track?.title || "No track"}
                </p>
                <p className="truncate text-[10px] text-[#8e8e93]">
                  {state.track?.artist || "Liner"}
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-1 px-1"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <button
                onClick={() => sendAction({ type: "prev" })}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" />
                  <line x1="5" y1="19" x2="5" y2="5" />
                </svg>
              </button>
              <button
                onClick={() => sendAction({ type: "togglePlay" })}
                className="flex h-7 w-8 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-white hover:bg-[#2c2c2e] active:bg-[#3a3a3c] transition-colors"
              >
                {isPlaying ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => sendAction({ type: "next" })}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>
            </div>

            <div
              className="relative mx-2 flex flex-1 items-center justify-center overflow-hidden"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              {state.isFullscreen && state.activeLine ? (
                <div
                  onClick={() => sendAction({ type: "toggleFullscreen" })}
                  className="flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden text-center"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={state.activeLine.timeMs}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="flex max-w-full items-center justify-center gap-1 px-2 text-center"
                    >
                      {state.activeLine.words && state.activeLine.words.length > 0 ? (
                        state.activeLine.words.map((w, idx) => {
                          const isSung = effectiveLyricsTimeMs >= w.endMs;
                          const isActive =
                            effectiveLyricsTimeMs >= w.timeMs &&
                            effectiveLyricsTimeMs < w.endMs;

                          return (
                            <span
                              key={`${w.timeMs}-${idx}`}
                              className={`transition-colors duration-150 ${
                                isActive
                                  ? "font-semibold text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                                  : isSung
                                    ? "font-medium text-white"
                                    : "font-normal text-[#545458]"
                              }`}
                              style={{ fontSize: "12px", lineHeight: "14px" }}
                            >
                              {w.text}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[12px] font-medium text-white">
                          {state.activeLine.text}
                        </span>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {state.nextLyricText && (
                    <p className="mt-0.5 max-w-full truncate text-[9px] text-[#545458]">
                      {state.nextLyricText}
                    </p>
                  )}
                </div>
              ) : (
                <div
                  ref={waveformRef}
                  onPointerDown={handleWaveformPointerDown}
                  onPointerMove={handleWaveformPointerMove}
                  onPointerLeave={handleWaveformPointerLeave}
                  className="relative flex h-8 w-full cursor-pointer items-center justify-between rounded-[4px] bg-[#1c1c1e] px-2"
                >
                  <div className="absolute inset-0 flex items-center justify-between px-2.5">
                    {waveformBars.map((heightRatio, i) => {
                      const barRatio = i / waveformBars.length;
                      const isPlayed = barRatio <= progressRatio;
                      const pixelHeight = Math.max(4, Math.round(heightRatio * 22));

                      return (
                        <div
                          key={i}
                          style={{
                            height: `${pixelHeight}px`,
                            width: "2px",
                          }}
                          className={`rounded-full transition-colors duration-75 ${
                            isPlayed ? "bg-white" : "bg-[#38383a]"
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div
                    className="pointer-events-none absolute top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]"
                    style={{
                      left: `calc(${progressRatio * 100}% - 2px)`,
                    }}
                  />

                  <div className="pointer-events-none absolute bottom-0.5 left-2 font-mono text-[9px] text-[#8e8e93]">
                    {formatTime(hoverPositionMs !== null ? hoverPositionMs : currentPosMs)}
                  </div>
                  <div className="pointer-events-none absolute bottom-0.5 right-2 font-mono text-[9px] text-[#8e8e93]">
                    {formatTime(durationMs)}
                  </div>
                </div>
              )}
            </div>

            <div
              className="flex items-center gap-1 pl-1 pr-1"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <button
                onClick={() => setIsVolumeOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c] transition-colors"
                title="Volume"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>

              <button
                onClick={() => sendAction({ type: "toggleFullscreen" })}
                className={`flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors ${
                  state.isFullscreen
                    ? "bg-white text-black hover:bg-[#e5e5ea]"
                    : "bg-[#1c1c1e] text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white active:bg-[#3a3a3c]"
                }`}
                title="Fullscreen / Lyrics"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6" />
                  <path d="M9 21H3v-6" />
                  <path d="M21 3l-7 7" />
                  <path d="M3 21l7-7" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TouchBarSimulator;

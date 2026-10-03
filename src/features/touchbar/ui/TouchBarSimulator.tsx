import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  SkipNext,
  SkipPrevious,
  Shuffle,
  VolumeCross,
  VolumeLoud,
} from "@solar-icons/react";
import { HeartFill, HeartLine } from "@mingcute/react";
import type {
  TouchBarAction,
  TouchBarStatePayload,
} from "../contracts";

type TouchBarMode = "player" | "lyrics" | "actions" | "audio";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
    activeLyricText: "",
    nextLyricText: "",
    offsetMs: 0,
    currentRoute: "/",
  });

  const [mode, setMode] = useState<TouchBarMode>("player");
  const [isSeeking, setIsSeeking] = useState(false);
  const [localSeekMs, setLocalSeekMs] = useState(0);

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
  const durationMs = state.durationMs || 1;
  const currentPosMs = isSeeking ? localSeekMs : state.positionMs;
  const progressPercent = Math.min(100, Math.max(0, (currentPosMs / durationMs) * 100));

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setIsSeeking(true);
    setLocalSeekMs(val);
  };

  const handleSeekCommit = () => {
    setIsSeeking(false);
    sendAction({ type: "seek", payload: { positionMs: localSeekMs } });
  };

  const handleClose = () => {
    window.linerElectron?.closeTouchBarSimulator?.();
  };

  return (
    <div className="flex h-12 w-full select-none items-center justify-between rounded-xl border border-white/10 bg-[#0d0d0f]/95 px-2.5 text-xs text-white shadow-2xl backdrop-blur-2xl">
      <div
        className="flex h-7 w-5 cursor-grab items-center justify-center text-white/30 hover:text-white/70 active:cursor-grabbing"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="text-[11px] leading-none">⠿</span>
      </div>

      <div
        className="mx-1.5 flex h-7 items-center gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={() => setMode("player")}
          className={`flex h-6 items-center px-2 text-[11px] font-medium rounded-md transition-colors ${
            mode === "player"
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/50 hover:text-white"
          }`}
        >
          🎵
        </button>
        <button
          onClick={() => setMode("lyrics")}
          className={`flex h-6 items-center px-2 text-[11px] font-medium rounded-md transition-colors ${
            mode === "lyrics"
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/50 hover:text-white"
          }`}
        >
          🎤
        </button>
        <button
          onClick={() => setMode("actions")}
          className={`flex h-6 items-center px-2 text-[11px] font-medium rounded-md transition-colors ${
            mode === "actions"
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/50 hover:text-white"
          }`}
        >
          ⚡
        </button>
        <button
          onClick={() => setMode("audio")}
          className={`flex h-6 items-center px-2 text-[11px] font-medium rounded-md transition-colors ${
            mode === "audio"
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/50 hover:text-white"
          }`}
        >
          🎚️
        </button>
      </div>

      <div
        className="flex flex-1 items-center overflow-hidden px-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {mode === "player" && (
          <div className="flex w-full items-center gap-3">
            <div className="flex min-w-0 max-w-[170px] items-center gap-2">
              {state.track?.cover ? (
                <img
                  src={state.track.cover}
                  alt=""
                  className="h-7 w-7 flex-shrink-0 rounded-md object-cover shadow-sm ring-1 ring-white/10"
                />
              ) : (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-white/10 text-white/50 text-[10px]">
                  ♪
                </div>
              )}
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-xs font-semibold text-white">
                  {state.track?.title || "No track playing"}
                </p>
                <p className="truncate text-[10px] text-white/50">
                  {state.track?.artist || "Liner"}
                </p>
              </div>
            </div>

            <div className="flex flex-1 items-center gap-2">
              <span className="w-8 text-right font-mono text-[10px] text-white/50">
                {formatTime(currentPosMs)}
              </span>
              <div className="relative flex flex-1 items-center">
                <input
                  type="range"
                  min={0}
                  max={durationMs}
                  value={currentPosMs}
                  onChange={handleSeekChange}
                  onMouseUp={handleSeekCommit}
                  onTouchEnd={handleSeekCommit}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-red-500 hover:bg-white/25"
                />
              </div>
              <span className="w-8 font-mono text-[10px] text-white/50">
                {formatTime(durationMs)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => sendAction({ type: "toggleShuffle" })}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  state.shuffle
                    ? "text-red-400"
                    : "text-white/40 hover:text-white"
                }`}
              >
                <Shuffle size={14} />
              </button>
              <button
                onClick={() => sendAction({ type: "prev" })}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 hover:text-white"
              >
                <SkipPrevious size={15} />
              </button>
              <button
                onClick={() => sendAction({ type: "togglePlay" })}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-md hover:scale-105 active:scale-95 transition-transform"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                onClick={() => sendAction({ type: "next" })}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 hover:text-white"
              >
                <SkipNext size={15} />
              </button>
              <button
                onClick={() => sendAction({ type: "like" })}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  state.isLiked
                    ? "text-red-500"
                    : "text-white/40 hover:text-white"
                }`}
              >
                {state.isLiked ? <HeartFill size={15} /> : <HeartLine size={15} />}
              </button>
            </div>
          </div>
        )}

        {mode === "lyrics" && (
          <div className="flex w-full items-center justify-between gap-3">
            <button
              onClick={() => sendAction({ type: "navigate", payload: { route: "/player" } })}
              className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-90 transition-opacity"
            >
              {state.track?.cover && (
                <img
                  src={state.track.cover}
                  alt=""
                  className="h-7 w-7 flex-shrink-0 rounded-md object-cover ring-1 ring-white/10"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white drop-shadow-sm">
                  {state.activeLyricText || "♪ ..."}
                </p>
                {state.nextLyricText && (
                  <p className="truncate text-[10px] text-white/40">
                    {state.nextLyricText}
                  </p>
                )}
              </div>
            </button>

            <div className="flex items-center gap-1 border-l border-white/10 pl-2">
              <button
                onClick={() =>
                  sendAction({ type: "adjustOffset", payload: { deltaMs: -200 } })
                }
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/70 hover:bg-white/15"
              >
                -0.2s
              </button>
              <span className="px-1 font-mono text-[10px] text-white/40">
                {state.offsetMs && state.offsetMs !== 0
                  ? `${state.offsetMs > 0 ? "+" : ""}${state.offsetMs}ms`
                  : "Sync"}
              </span>
              <button
                onClick={() =>
                  sendAction({ type: "adjustOffset", payload: { deltaMs: 200 } })
                }
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/70 hover:bg-white/15"
              >
                +0.2s
              </button>
            </div>
          </div>
        )}

        {mode === "actions" && (
          <div className="flex w-full items-center justify-around gap-2">
            <button
              onClick={() => sendAction({ type: "navigate", payload: { route: "/" } })}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/80 hover:bg-white/15 hover:text-white"
            >
              🏠 Home
            </button>
            <button
              onClick={() =>
                sendAction({ type: "navigate", payload: { route: "/library" } })
              }
              className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/80 hover:bg-white/15 hover:text-white"
            >
              📚 Library
            </button>
            <button
              onClick={() =>
                sendAction({ type: "navigate", payload: { route: "/player" } })
              }
              className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/80 hover:bg-white/15 hover:text-white"
            >
              🎤 Player View
            </button>
            <button
              onClick={() => sendAction({ type: "toggleShuffle" })}
              className={`flex h-7 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium ${
                state.shuffle
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : "bg-white/5 text-white/80 hover:bg-white/15"
              }`}
            >
              🔀 Shuffle
            </button>
          </div>
        )}

        {mode === "audio" && (
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() =>
                  sendAction({
                    type: "volume",
                    payload: { volume: state.volume > 0 ? 0 : 0.8 },
                  })
                }
                className="text-white/60 hover:text-white"
              >
                {state.volume === 0 ? (
                  <VolumeCross size={16} />
                ) : (
                  <VolumeLoud size={16} />
                )}
              </button>
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
                className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-white/15 accent-white hover:bg-white/25"
              />
              <span className="font-mono text-[10px] text-white/50 w-8">
                {Math.round(state.volume * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  sendAction({ type: "navigate", payload: { route: "/player" } })
                }
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/15"
              >
                Stereo EQ
              </button>
              <button
                onClick={() =>
                  sendAction({ type: "navigate", payload: { route: "/" } })
                }
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/15"
              >
                High-Res
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        className="ml-1.5 flex h-7 items-center pl-1.5 border-l border-white/10"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={handleClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          title="Close Touch Bar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
export default TouchBarSimulator;

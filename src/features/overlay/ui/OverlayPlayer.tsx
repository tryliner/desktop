import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { SkipNext, SkipPrevious } from "@solar-icons/react";
import {
  PlayerMorphIcon,
  ICON_PLAY,
  ICON_PAUSE,
} from "@/features/player/ui/morphPlayerIcons";
import { HeartFill, HeartLine } from "@mingcute/react";
import CoverImage from "@/features/covers/ui/CoverImage";
import { ScrollableText } from "@/shared/ui/ScrollableText";
import { useDisableButtonFocus } from "@/features/navigation/hooks/useDisableButtonFocus";
import type { OverlayAction, OverlayStatePayload } from "../contracts";
import { useShortcutsStore, matchesShortcut } from "@/features/shortcuts";
import { isLocalTrackId } from "@/shared/media/local/localTrackIds";

function sampledPositionMs({
  status,
  positionMs,
  positionAt,
  playbackRate,
}: Pick<
  OverlayStatePayload,
  "status" | "positionMs" | "positionAt" | "playbackRate"
>): number {
  if (status !== "playing" || typeof positionAt !== "number") {
    return positionMs;
  }
  const rate = playbackRate && playbackRate > 0 ? playbackRate : 1;
  return positionMs + Math.max(0, Date.now() - positionAt) * rate;
}

const OVERLAY_CARD_TRANSITION = {
  duration: 0.08,
  ease: [0.16, 1, 0.3, 1],
} as const;

export function OverlayPlayer() {
  useDisableButtonFocus();

  const [state, setState] = useState<OverlayStatePayload>({
    status: "idle",
    track: null,
    positionMs: 0,
    durationMs: 0,
    volume: 1,
    isLiked: false,
  });

  const [isInfoHovered, setIsInfoHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isShown, setIsShown] = useState(
    () => !window.linerElectron?.onOverlayVisibility,
  );

  const anchorPosRef = useRef(state.positionMs);
  const anchorTimeRef = useRef(performance.now());
  const [interpolatedPosMs, setInterpolatedPosMs] = useState(state.positionMs);
  const lastTrackIdRef = useRef<string | null>(null);

  const pullLatestState = useCallback(() => {
    window.linerElectron?.getOverlayInitialState?.().then((initial) => {
      if (initial) {
        const pos = sampledPositionMs(initial);
        anchorPosRef.current = pos;
        anchorTimeRef.current = performance.now();
        setInterpolatedPosMs(pos);
        setState(initial);
      }
    });
  }, []);

  useEffect(() => {
    pullLatestState();

    if (window.linerElectron?.onOverlayState) {
      const cleanupState = window.linerElectron.onOverlayState((newState) => {
        setState(newState);
      });
      return cleanupState;
    }
  }, [pullLatestState]);

  useEffect(() => {
    const signal = setTimeout(() => window.linerElectron?.overlayReady?.(), 0);
    return () => clearTimeout(signal);
  }, []);

  useEffect(() => {
    if (!window.linerElectron?.onOverlayVisibility) return;
    const cleanupVisibility = window.linerElectron.onOverlayVisibility(
      (visible) => {
        setIsVisible(visible);
        setIsShown(visible);
        if (visible) pullLatestState();
      },
    );
    return cleanupVisibility;
  }, [pullLatestState]);

  const sendAction = useCallback((action: OverlayAction) => {
    window.linerElectron?.sendOverlayAction?.(action);
  }, []);

  const isPlaying = state.status === "playing";
  const rate =
    state.playbackRate && state.playbackRate > 0 ? state.playbackRate : 1;
  const durationMs = Math.max(
    1,
    state.durationMs || state.track?.durationMs || 1,
  );

  const interpolatedPosRef = useRef(interpolatedPosMs);
  useEffect(() => {
    interpolatedPosRef.current = interpolatedPosMs;
  }, [interpolatedPosMs]);

  const {
    status: stateStatus,
    positionMs: statePositionMs,
    positionAt: statePositionAt,
    playbackRate: statePlaybackRate,
  } = state;
  const stateTrackId = state.track?.id;

  useEffect(() => {
    const syncedPos = sampledPositionMs({
      status: stateStatus,
      positionMs: statePositionMs,
      positionAt: statePositionAt,
      playbackRate: statePlaybackRate,
    });
    if (stateTrackId !== lastTrackIdRef.current) {
      lastTrackIdRef.current = stateTrackId ?? null;
      setInterpolatedPosMs(syncedPos);
      anchorPosRef.current = syncedPos;
      anchorTimeRef.current = performance.now();
      return;
    }

    if (stateStatus === "paused") {
      const pos = syncedPos > 0 ? syncedPos : interpolatedPosRef.current;
      setInterpolatedPosMs(pos);
      anchorPosRef.current = pos;
      anchorTimeRef.current = performance.now();
      return;
    }

    if (syncedPos > 0 || interpolatedPosRef.current === 0) {
      setInterpolatedPosMs(syncedPos);
      anchorPosRef.current = syncedPos;
      anchorTimeRef.current = performance.now();
    }
  }, [
    statePositionMs,
    statePositionAt,
    stateStatus,
    statePlaybackRate,
    stateTrackId,
  ]);

  useEffect(() => {
    if (!isPlaying || !isShown) return;
    let animId: number;

    const step = () => {
      const elapsed = performance.now() - anchorTimeRef.current;
      const current = Math.min(
        durationMs,
        anchorPosRef.current + elapsed * rate,
      );
      setInterpolatedPosMs(current);
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animId);
      const elapsed = performance.now() - anchorTimeRef.current;
      anchorPosRef.current = Math.min(
        durationMs,
        anchorPosRef.current + elapsed * rate,
      );
      anchorTimeRef.current = performance.now();
    };
  }, [isPlaying, isShown, durationMs, rate]);

  const currentPosMs = interpolatedPosMs;
  const progressRatio = Math.min(1, Math.max(0, currentPosMs / durationMs));

  // Keyboard Shortcuts (Miniplayer mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      const { miniplayer, volumeHoldRepeats } = useShortcutsStore.getState();

      // Sound up / down shortcuts
      if (matchesShortcut(e, miniplayer.volumeUp)) {
        e.preventDefault();
        if (e.repeat && !volumeHoldRepeats) return;
        sendAction({ type: "volumeUp" });
        return;
      }

      if (matchesShortcut(e, miniplayer.volumeDown)) {
        e.preventDefault();
        if (e.repeat && !volumeHoldRepeats) return;
        sendAction({ type: "volumeDown" });
        return;
      }

      // Switch to main app
      if (matchesShortcut(e, miniplayer.focusMainWindow)) {
        e.preventDefault();
        sendAction({ type: "focusMainWindow" });
        return;
      }

      // Playback toggle
      if (matchesShortcut(e, miniplayer.playPause)) {
        e.preventDefault();
        sendAction({ type: "togglePlay" });
        return;
      }

      // Seek left / right
      if (matchesShortcut(e, miniplayer.seekBackward)) {
        e.preventDefault();
        sendAction({
          type: "seek",
          payload: { positionMs: Math.max(0, currentPosMs - 5000) },
        });
        return;
      }

      if (matchesShortcut(e, miniplayer.seekForward)) {
        e.preventDefault();
        sendAction({
          type: "seek",
          payload: { positionMs: Math.min(durationMs, currentPosMs + 5000) },
        });
        return;
      }

      // Like
      if (matchesShortcut(e, miniplayer.likeTrack)) {
        e.preventDefault();
        if (!isLocalTrackId(stateTrackId)) sendAction({ type: "like" });
        return;
      }

      // Previous
      if (matchesShortcut(e, miniplayer.prevTrack)) {
        e.preventDefault();
        sendAction({ type: "prev" });
        return;
      }

      // Next
      if (matchesShortcut(e, miniplayer.nextTrack)) {
        e.preventDefault();
        sendAction({ type: "next" });
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPosMs, durationMs, sendAction, state.volume, stateTrackId]);

  return (
    <div
      className="flex h-screen w-screen select-none flex-col justify-start bg-transparent antialiased overflow-hidden font-sans p-1 m-0 border-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* ── Main Overlay Card ── */}
      <motion.div
        initial={false}
        animate={{
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.92,
        }}
        transition={OVERLAY_CARD_TRANSITION}
        className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-[10px] bg-[#0d0d10]"
        style={{
          height: "48px",
          willChange: "transform, opacity",
          transformOrigin: "center center",
        }}
      >
        {/* Background Progress Fill - Straight rectangular without rounding */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] rounded-none"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            width: `${progressRatio * 100}%`,
            transition: "width 200ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />

        {/* Content Row */}
        <div className="relative z-[2] flex h-full w-full items-center justify-between px-2.5">
          {/* Left: Artwork + Track Info (Fully draggable to drag window) */}
          <div
            className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden cursor-default pr-2"
            onMouseEnter={() => setIsInfoHovered(true)}
            onMouseLeave={() => setIsInfoHovered(false)}
          >
            <div className="relative h-[32px] w-[32px] shrink-0 overflow-hidden rounded-item bg-[#16161a]">
              {state.track?.coverUrl || state.track?.cover ? (
                <CoverImage
                  key={state.track.coverUrl || state.track.cover}
                  src={state.track.coverUrl || state.track.cover || ""}
                  alt={state.track?.title || "Artwork"}
                  fill
                  sizes="32px"
                  priority
                  unoptimized
                  draggable={false}
                  className="rounded-item object-cover pointer-events-none select-none"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] text-white/30 select-none">
                  ♪
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
              <ScrollableText
                text={state.track?.title || "No track playing"}
                isParentHovered={isInfoHovered}
                className="text-body font-normal leading-[16px] text-white tracking-tight"
              />
              <ScrollableText
                text={state.track?.artist || ""}
                isParentHovered={isInfoHovered}
                className="mt-[1px] text-[11px] font-light leading-[14px] text-white/50"
              />
            </div>
          </div>

          {/* Right: Like Button + Playback Controls (Previous, Play/Pause, Next) */}
          <div
            className="flex items-center gap-0.5 shrink-0 pl-1"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {!isLocalTrackId(state.track?.id) && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  sendAction({ type: "like" });
                }}
                className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border-0 bg-transparent transition-colors outline-none cursor-pointer active:scale-90 ${
                  state.isLiked
                    ? "text-[#ff3b5c]"
                    : "text-white/40 hover:text-white"
                }`}
                aria-label={state.isLiked ? "Unlike" : "Like"}
              >
                {state.isLiked ? (
                  <HeartFill size={16} />
                ) : (
                  <HeartLine size={16} />
                )}
              </button>
            )}

            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                sendAction({ type: "prev" });
              }}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border-0 bg-transparent text-white/60 hover:text-white active:scale-90 transition-all outline-none cursor-pointer"
              aria-label="Previous"
            >
              <SkipPrevious size={16} weight="Bold" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                sendAction({ type: "togglePlay" });
              }}
              className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-full bg-white text-black shadow transition-all duration-150 ease-out hover:scale-105 active:scale-95 border-none cursor-pointer"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <span
                className={`flex items-center justify-center transition-transform ${
                  isPlaying ? "" : "translate-x-[0.5px]"
                }`}
              >
                <PlayerMorphIcon
                  icon={isPlaying ? ICON_PAUSE : ICON_PLAY}
                  size={14}
                />
              </span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                sendAction({ type: "next" });
              }}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border-0 bg-transparent text-white/60 hover:text-white active:scale-90 transition-all outline-none cursor-pointer"
              aria-label="Next"
            >
              <SkipNext size={16} weight="Bold" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default OverlayPlayer;

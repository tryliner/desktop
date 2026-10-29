import { useCallback, useEffect, createElement, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shouldReleaseTopPin, startsPinnedToTop } from "./lyricsTopPin";
import { usePlayerStore } from "../store/playerStore";
import {
  useGlassBlur,
  useKawarpEnabled,
  useLyricsEdgeBlur,
  useLyricsEdgeFade,
} from "../store/visualModeStore";
import { useScrollEdges } from "../hooks/useScrollEdges";
import { cn } from "@/shared/lib";
import { Notch } from "@/shared/ui";
import { FullscreenTopNotch } from "./FullscreenTopNotch";
import { LyricsNotchStatus } from "./LyricsNotchStatus";
import { FullscreenFrameGlass } from "./FullscreenFrameGlass";
import { playerEngine } from "../engine/playerEngine";
import {
  useLyricsStore,
  useLyricsRomanization,
  LyricsProviderIsland,
  braccatoThemeCss,
} from "@/features/lyrics";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerUiElements } from "./PlayerUiElements";
import { DownLine } from "@mingcute/react";
import { preloadCoverArt, useCoverSrc } from "@/features/covers";
import {
  isWindowVisible,
  onWindowVisibilityChange,
} from "@/shared/utils/windowVisibility";
import "@braccato/core/element";
import "@braccato/core/styles/variables.css";
import "@braccato/core/styles/lyrics.css";
import "@braccato/core/styles/instrumental.css";
import KawarpWrapper from "./KawarpWrapper";
import AmbientLayer from "./AmbientLayer";
import { BetaVisualsWarning } from "./BetaVisualsWarning";
import { useTranslation } from "@/languages";

const BRACCATO_TAG = "braccato-lyrics";
const KAWARP_FADE_IN_MS = 600;

interface BraccatoLyricsViewProps {
  lyrics: any[];
}

function BraccatoLyricsView({ lyrics }: BraccatoLyricsViewProps) {
  const status = usePlayerStore((s) => s.status);
  const edgeFade = useLyricsEdgeFade();
  const edgeBlur = useLyricsEdgeBlur();
  const elementRef = useRef<any>(null);
  const latestLyricsRef = useRef(lyrics);
  const freeScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelTimeRef = useRef(0);
  const isInFreeSearchRef = useRef(false);
  const waitingForAudioAfterClickRef = useRef(false);
  const pinnedToTopRef = useRef(
    startsPinnedToTop(status, usePlayerStore.getState().positionMs),
  );

  const scrollToActiveLine = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = elementRef.current;
      if (!el) return false;

      const activeEls = (el as HTMLElement).querySelectorAll<HTMLElement>(
        ".blyrics--active",
      );
      if (activeEls.length === 0) return false;
      const activeEl = activeEls[activeEls.length - 1];

      const containerRect = el.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      if (containerRect.height === 0 || elRect.height === 0) return false;

      const offset = elRect.top - containerRect.top + el.scrollTop;
      const targetScrollTop =
        offset - containerRect.height / 2 + elRect.height / 2;

      if (behavior === "auto") {
        el.scrollTop = Math.max(0, targetScrollTop);
      } else {
        el.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior,
        });
      }
      return true;
    },
    [],
  );

  const returnToFollowingMode = useCallback(() => {
    if (freeScrollTimerRef.current) {
      clearTimeout(freeScrollTimerRef.current);
      freeScrollTimerRef.current = null;
    }
    isInFreeSearchRef.current = false;
    lastWheelTimeRef.current = 0;

    const el = elementRef.current;
    if (!el) return;

    if (el.renderer) {
      el.renderer.resumeAutoscroll?.();
      const engine = (el.renderer as any)?.engine;
      if (engine) {
        engine.scrollResumeTime = 0;
        engine.nextScrollAllowedTime = 0;
        engine.queuedScroll = true;
      }
    }

    scrollToActiveLine("smooth");
  }, [scrollToActiveLine]);

  const returnToFollowingModeRef = useRef(returnToFollowingMode);
  returnToFollowingModeRef.current = returnToFollowingMode;

  const handleUserInteraction = useCallback(() => {
    pinnedToTopRef.current = false;
    lastWheelTimeRef.current = Date.now();
    isInFreeSearchRef.current = true;

    const el = elementRef.current;
    if (el?.renderer) {
      el.renderer.noteUserScroll?.();
      el.renderer.noteUserScroll?.();
      el.renderer.noteUserScroll?.();
    }

    if (freeScrollTimerRef.current) {
      clearTimeout(freeScrollTimerRef.current);
      freeScrollTimerRef.current = null;
    }

    freeScrollTimerRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastWheelTimeRef.current;
      if (elapsed < 5900) return;

      returnToFollowingMode();
    }, 6000);
  }, [returnToFollowingMode]);

  const handleUserInteractionRef = useRef(handleUserInteraction);
  handleUserInteractionRef.current = handleUserInteraction;

  const setElement = useCallback(
    (el: any) => {
      elementRef.current = el;
      if (!el) return;
      el.theme = braccatoThemeCss;
      el.lyrics = latestLyricsRef.current;
      el.source = "#liner-audio";

      const handleBraccatoLineClick = (e: Event) => {
        const isAudioLoading = playerEngine.getSnapshot().status === "loading";
        if (isAudioLoading) {
          waitingForAudioAfterClickRef.current = true;
          isInFreeSearchRef.current = true;
          if (freeScrollTimerRef.current) {
            clearTimeout(freeScrollTimerRef.current);
            freeScrollTimerRef.current = null;
          }
          if (el.renderer) {
            el.renderer.noteUserScroll?.();
            el.renderer.noteUserScroll?.();
            el.renderer.noteUserScroll?.();
          }
        } else {
          returnToFollowingModeRef.current();
        }

        const detail = (e as CustomEvent).detail as
          { timeS?: number; time?: number } | undefined;
        const timeMs =
          detail?.timeS !== undefined
            ? Math.round(detail.timeS * 1000)
            : detail?.time !== undefined
              ? detail.time > 1000
                ? Math.round(detail.time)
                : Math.round(detail.time * 1000)
              : null;
        if (timeMs !== null) {
          playerEngine.seek(timeMs, true);
        }
      };

      const onUserScroll = () => {
        handleUserInteractionRef.current();
      };

      const onLyricsLoaded = () => {
        if (waitingForAudioAfterClickRef.current) return;
        requestAnimationFrame(() => {
          if (!waitingForAudioAfterClickRef.current) {
            scrollToActiveLine("auto");
          }
        });
      };

      let syncRafId: number;
      let lastReportedIndex = -1;

      const checkActiveLine = () => {
        // minimized or hidden: stop until the window shows again
        if (!isWindowVisible()) return;
        const audioEl = document.getElementById(
          "liner-audio",
        ) as HTMLAudioElement | null;
        if (audioEl && !Number.isNaN(audioEl.currentTime)) {
          const currentMs = audioEl.currentTime * 1000;
          const lines = useLyricsStore.getState().syncedLines;
          let idx = -1;
          for (let i = 0; i < lines.length; i++) {
            const prevEnd =
              i > 0 && lines[i - 1].words && lines[i - 1].words!.length > 0
                ? lines[i - 1].words![lines[i - 1].words!.length - 1].endMs
                : i > 0
                  ? lines[i - 1].timeMs
                  : 0;
            const targetEarlyMs = Math.max(prevEnd, lines[i].timeMs - 600);
            if (targetEarlyMs <= currentMs) {
              idx = i;
            } else {
              break;
            }
          }
          if (idx !== lastReportedIndex) {
            lastReportedIndex = idx;
            useLyricsStore.getState().setActiveLineIndex(idx >= 0 ? idx : null);
          }
        }
        syncRafId = requestAnimationFrame(checkActiveLine);
      };

      syncRafId = requestAnimationFrame(checkActiveLine);
      const stopWatchingVisibility = onWindowVisibilityChange((visible) => {
        if (!visible) return;
        cancelAnimationFrame(syncRafId);
        syncRafId = requestAnimationFrame(checkActiveLine);
      });

      el.addEventListener("braccato:lyrics-loaded", onLyricsLoaded);
      el.addEventListener("braccato:line-click", handleBraccatoLineClick);
      el.addEventListener("wheel", onUserScroll, {
        passive: true,
        capture: true,
      });
      el.addEventListener("touchmove", onUserScroll, {
        passive: true,
        capture: true,
      });

      return () => {
        cancelAnimationFrame(syncRafId);
        stopWatchingVisibility();
        useLyricsStore.getState().setActiveLineIndex(null);
        el.removeEventListener("braccato:lyrics-loaded", onLyricsLoaded);
        el.removeEventListener("braccato:line-click", handleBraccatoLineClick);
        el.removeEventListener("wheel", onUserScroll, { capture: true });
        el.removeEventListener("touchmove", onUserScroll, { capture: true });
        if (freeScrollTimerRef.current) {
          clearTimeout(freeScrollTimerRef.current);
          freeScrollTimerRef.current = null;
        }
        elementRef.current = null;
      };
    },
    [scrollToActiveLine],
  );

  useEffect(() => {
    latestLyricsRef.current = lyrics;
    const element = elementRef.current;
    if (element) element.lyrics = lyrics;
  }, [lyrics]);

  useLyricsRomanization(elementRef, lyrics);

  useEffect(() => {
    if (
      (status === "playing" || status === "paused") &&
      waitingForAudioAfterClickRef.current
    ) {
      waitingForAudioAfterClickRef.current = false;
      returnToFollowingMode();
    }
  }, [status, returnToFollowingMode]);

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
  }, [lyrics, scrollToActiveLine]);

  useEffect(() => {
    if (!pinnedToTopRef.current) return;
    const startedAt = performance.now();
    let rafId = 0;
    const holdTop = () => {
      const el = elementRef.current as HTMLElement & {
        renderer?: {
          noteUserScroll?: () => void;
          resumeAutoscroll?: () => void;
        };
      };
      if (!pinnedToTopRef.current) return;
      const audio = document.getElementById(
        "liner-audio",
      ) as HTMLAudioElement | null;
      const release = shouldReleaseTopPin({
        status: playerEngine.getSnapshot().status,
        audioPaused: !audio || audio.paused,
        audioTimeMs: (audio?.currentTime ?? 0) * 1000,
        pinnedForMs: performance.now() - startedAt,
      });
      if (release) {
        pinnedToTopRef.current = false;
        el?.renderer?.resumeAutoscroll?.();
        return;
      }
      if (el) {
        el.renderer?.noteUserScroll?.();
        if (el.scrollTop !== 0) el.scrollTop = 0;
      }
      rafId = requestAnimationFrame(holdTop);
    };
    rafId = requestAnimationFrame(holdTop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const { atTop, atBottom } = useScrollEdges(elementRef, lyrics);

  return (
    <div className="relative flex flex-col flex-1 w-full h-full min-h-0">
      {createElement(BRACCATO_TAG, {
        ref: setElement,
        source: "#liner-audio",
        className: cn(
          "block flex-1 w-full h-full px-6",
          edgeFade && "lyrics-edge-fog",
        ),
        "data-at-top": atTop ? "" : undefined,
        "data-at-bottom": atBottom ? "" : undefined,
        style: {
          overflowY: "auto",
          overflowX: "hidden",
          position: "relative",
          scrollbarWidth: "none",
        },
      })}
      {edgeBlur && (
        <>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-[18%] backdrop-blur-xs transition-opacity duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] [mask-image:linear-gradient(to_bottom,black,transparent)]",
              atTop ? "opacity-0" : "opacity-100",
            )}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-[26%] backdrop-blur-xs transition-opacity duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] [mask-image:linear-gradient(to_top,black,transparent)]",
              atBottom ? "opacity-0" : "opacity-100",
            )}
          />
        </>
      )}
    </div>
  );
}

export interface FullscreenPlayerProps {
  effectsReady?: boolean;
  onClose: () => void;
}

export function FullscreenPlayer({
  effectsReady = true,
  onClose,
}: FullscreenPlayerProps) {
  const { t } = useTranslation();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const nextCoverUrl = usePlayerStore(
    (s) => s.queue[s.currentIndex + 1]?.coverUrl,
  );
  const coverUrl = currentTrack?.coverUrl;
  const kawarpSrc = useCoverSrc(coverUrl);

  useEffect(() => {
    if (!currentTrack) {
      onClose();
    }
  }, [currentTrack, onClose]);

  const {
    braccatoLyrics,
    lyricsLoading,
    lyricsError,
    plainLyrics,
    availableProviders,
    currentLyricsTrackId,
  } = useLyricsStore();

  const onError = useCallback((err: Error) => {
    console.error("kawarp load error:", err);
  }, []);

  const kawarpEnabled = useKawarpEnabled();
  const glassBlur = useGlassBlur();
  const [kawarpShown, setKawarpShown] = useState(false);
  const [kawarpWasEnabled, setKawarpWasEnabled] = useState(kawarpEnabled);
  if (kawarpWasEnabled !== kawarpEnabled) {
    setKawarpWasEnabled(kawarpEnabled);
    setKawarpShown(false);
  }
  const onKawarpLoad = useCallback(() => {
    setTimeout(() => setKawarpShown(true), KAWARP_FADE_IN_MS);
  }, []);

  useEffect(() => {
    void preloadCoverArt(coverUrl);
    void preloadCoverArt(nextCoverUrl);
  }, [coverUrl, nextCoverUrl]);

  const currentTrackId = currentTrack?.id;
  const isMatchingTrack = Boolean(
    currentTrackId && currentLyricsTrackId === currentTrackId,
  );
  const hasLyrics = isMatchingTrack && braccatoLyrics.length > 0;
  const showProviderIsland = hasLyrics && availableProviders.length > 0;
  const isInstrumental =
    isMatchingTrack &&
    !lyricsLoading &&
    !hasLyrics &&
    !lyricsError &&
    plainLyrics === "[INSTRUMENTAL]";
  const isLyricsLoading = !hasLyrics && lyricsLoading;
  const isLyricsMissing = isMatchingTrack && !hasLyrics && !lyricsLoading;

  return (
    <div
      data-theme="dark"
      className="dark relative h-full w-full overflow-hidden bg-black text-white"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundColor: "var(--color-bg-primary)" }}
        />
        {(kawarpSrc || coverUrl) && (!kawarpShown || !kawarpEnabled) && (
          <img
            src={kawarpSrc || coverUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            style={{
              filter: "blur(64px) saturate(1.3)",
              transform: "scale(1.3)",
            }}
          />
        )}
        {effectsReady && kawarpEnabled ? (
          <KawarpWrapper
            src={kawarpSrc}
            onLoad={onKawarpLoad}
            onError={onError}
          />
        ) : null}
        <AmbientLayer trackId={currentTrackId} />
      </div>

      <div className="absolute inset-0 z-[1] bg-black/40" />

      <FullscreenFrameGlass />

      <div className="absolute inset-1.5 z-10 flex">
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <PlayerUiElements
            onClose={onClose}
            layout={isLyricsMissing ? "horizontal" : "vertical"}
          />
        </div>

        <div
          className={cn(
            "h-full min-h-0 flex flex-col relative overflow-hidden",
            isLyricsMissing ? "grow-0 basis-0 px-0" : "grow basis-0 pl-2 pr-6",
          )}
        >
          <div
            className="flex-1 min-h-0 relative w-full h-full"
            style={{
              display: hasLyrics ? "flex" : "none",
            }}
          >
            <AnimatePresence initial={false}>
              {hasLyrics && (
                <motion.div
                  key={`lyrics-${currentTrackId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, pointerEvents: "none" }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="absolute inset-0 flex flex-col"
                >
                  <BraccatoLyricsView lyrics={braccatoLyrics} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="absolute top-1.5 left-1/2 z-30 flex -translate-x-1/2 justify-center pointer-events-none">
        <FullscreenTopNotch>
          <BetaVisualsWarning docked={false} />
          {showProviderIsland && <LyricsProviderIsland />}
          {isLyricsLoading && <LyricsNotchStatus kind="loading" />}
          {isLyricsMissing && (
            <LyricsNotchStatus
              kind={isInstrumental ? "instrumental" : "missing"}
            />
          )}
        </FullscreenTopNotch>
      </div>

      <div className="absolute top-1.5 left-1.5 z-30">
        <Notch align="start" tone="glass" blur={glassBlur}>
          <button
            type="button"
            aria-label={t("player.close_fullscreen")}
            onClick={onClose}
            data-no-window-drag
            className="inline-flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-white/70 transition-colors select-none hover:bg-white/10 hover:text-white active:scale-95"
          >
            <DownLine size={16} />
          </button>
        </Notch>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  const navigate = useNavigate();
  return <FullscreenPlayer onClose={() => navigate(-1)} />;
}

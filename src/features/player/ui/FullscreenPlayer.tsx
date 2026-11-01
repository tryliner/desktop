import { useCallback, useEffect, createElement, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { shouldReleaseTopPin, startsPinnedToTop } from "./lyricsTopPin";
import { applyLyricsSubtitles } from "../lib/lyricsSubtitles";
import { usePlayerStore } from "../store/playerStore";
import {
  useKawarpEnabled,
  useLyricsEdgeBlur,
  useLyricsEdgeFade,
} from "../store/visualModeStore";
import { useScrollEdges } from "../hooks/useScrollEdges";
import { cn } from "@/shared/lib";
import { ISLAND_SURFACE } from "@/shared/ui";
import { playerEngine } from "../engine/playerEngine";
import {
  useLyricsStore,
  LyricsProviderIsland,
  braccatoThemeCss,
} from "@/features/lyrics";
import { useAiTranslateStore, getTranslationCacheKey } from "@/features/ai-translate";
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
import { SpectrumVisualizer } from "@/features/visualizer";
import { BetaVisualsWarning } from "./BetaVisualsWarning";
import { useTranslation } from "@/languages";

const BRACCATO_TAG = "braccato-lyrics";
const KAWARP_FADE_IN_MS = 600;

interface BraccatoLyricsViewProps {
  lyrics: any[];
  translations?: string[];
  romanizations?: string[];
  showTranslation?: boolean;
  showRomanization?: boolean;
}

function BraccatoLyricsView({
  lyrics,
  translations,
  romanizations,
  showTranslation = true,
  showRomanization = true,
}: BraccatoLyricsViewProps) {
  const status = usePlayerStore((s) => s.status);
  const edgeFade = useLyricsEdgeFade();
  const edgeBlur = useLyricsEdgeBlur();
  const elementRef = useRef<any>(null);
  const latestLyricsRef = useRef(lyrics);
  const freeScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelTimeRef = useRef(0);
  const isInFreeSearchRef = useRef(false);
  const waitingForAudioAfterClickRef = useRef(false);
  const isUpdatingDomRef = useRef(false);
  const pinnedToTopRef = useRef(
    startsPinnedToTop(status, usePlayerStore.getState().positionMs),
  );

  const applySubtitlesToDom = useCallback(() => {
    if (isUpdatingDomRef.current) return;
    const el = elementRef.current as
      | (HTMLElement & { renderer?: { relayout?: (measureLines?: boolean) => void } })
      | null;
    if (!el) return;
    if (!el.querySelector(".blyrics--line")) return;

    isUpdatingDomRef.current = true;
    try {
      const changed = applyLyricsSubtitles(el, {
        translations,
        romanizations,
        showTranslation,
        showRomanization,
      });

      // The extra subtitle rows change every line's height. Braccato cached the
      // old measurements, so without this the scroll targets drift.
      if (changed) {
        el.renderer?.relayout?.(true);
      }
    } finally {
      isUpdatingDomRef.current = false;
    }
  }, [translations, romanizations, showTranslation, showRomanization]);

  const applySubtitlesToDomRef = useRef(applySubtitlesToDom);
  applySubtitlesToDomRef.current = applySubtitlesToDom;

  useEffect(() => {
    applySubtitlesToDom();
  }, [applySubtitlesToDom, lyrics]);

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
        // Braccato rebuilds its line DOM on every lyrics/theme change, which
        // discards our injected translation/romanization nodes. Re-apply them
        // before measuring or scrolling.
        applySubtitlesToDomRef.current();
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
  const activeProvider = useLyricsStore((s) => s.activeProvider);
  const showTranslation = useAiTranslateStore((s) => s.showTranslation);
  const showRomanization = useAiTranslateStore((s) => s.showRomanization);
  const translationsByTrackId = useAiTranslateStore((s) => s.translationsByTrackId);
  const romanizationsByTrackId = useAiTranslateStore((s) => s.romanizationsByTrackId);
  const targetLang = useAiTranslateStore((s) => s.targetLang);
  const singableMode = useAiTranslateStore((s) => s.singableMode);

  const trackTranslations = useMemo(() => {
    if (!currentTrackId) return undefined;
    return translationsByTrackId[getTranslationCacheKey(currentTrackId, targetLang, singableMode)];
  }, [currentTrackId, targetLang, singableMode, translationsByTrackId]);

  const trackRomanizations = useMemo(() => {
    if (!currentTrackId) return undefined;
    return romanizationsByTrackId[currentTrackId];
  }, [currentTrackId, romanizationsByTrackId]);

  const isInstrumental =
    isMatchingTrack &&
    !lyricsLoading &&
    !hasLyrics &&
    !lyricsError &&
    plainLyrics === "[INSTRUMENTAL]";

  const showLyricsColumn = hasLyrics || (lyricsLoading && isMatchingTrack);

  const [showNoLyricsNotice, setShowNoLyricsNotice] = useState(false);
  const lastNotifiedTrackRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTrackId) {
      setShowNoLyricsNotice(false);
      return;
    }

    if (lyricsLoading && isMatchingTrack) {
      return;
    }

    if (!hasLyrics) {
      if (lastNotifiedTrackRef.current !== currentTrackId) {
        lastNotifiedTrackRef.current = currentTrackId;
        setShowNoLyricsNotice(true);
        const timer = setTimeout(() => {
          setShowNoLyricsNotice(false);
        }, 5000);
        return () => clearTimeout(timer);
      }
    } else {
      setShowNoLyricsNotice(false);
      lastNotifiedTrackRef.current = currentTrackId;
    }
  }, [currentTrackId, lyricsLoading, isMatchingTrack, hasLyrics]);

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

      {/* Fullscreen Audio Spectrum Visualizer Backdrop */}
      <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden select-none">
        <SpectrumVisualizer className="w-full h-full" barCount={32} />
      </div>

      {/* Floating No-Lyrics Notification Pill */}
      <AnimatePresence>
        {showNoLyricsNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-auto cursor-pointer select-none"
            onClick={() => setShowNoLyricsNotice(false)}
            title="Click to dismiss"
          >
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/60 backdrop-blur-2xl border border-white/15 text-sm font-medium text-white/90 shadow-2xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/60 shrink-0"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
              <span>{isInstrumental ? (t("player.instrumental") || "Instrumental track") : "This song doesn't have lyrics"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showLyricsColumn && (
        <div className="absolute top-[6px] right-[136px] z-30 pointer-events-none flex">
          <BetaVisualsWarning docked={false} />
        </div>
      )}

      <div className="absolute inset-0 z-10 flex">
        <motion.div
          layout
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "flex flex-col items-center justify-center gap-5 transition-all duration-300",
            showLyricsColumn ? "flex-1" : "w-full",
          )}
        >
          <PlayerUiElements onClose={onClose} />
        </motion.div>

        <AnimatePresence>
          {showLyricsColumn && (
            <motion.div
              key="lyrics-column"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex-1 h-full min-h-0 pl-2 pr-6 flex flex-col relative"
            >
              <div className="absolute top-[6px] left-2 right-[128px] z-30 pointer-events-none flex justify-center">
                <div className="relative inline-flex">
                  <BetaVisualsWarning docked={showProviderIsland} />
                  {showProviderIsland && <LyricsProviderIsland />}
                </div>
              </div>

              <div
                className="flex-1 min-h-0 relative w-full h-full"
                style={{
                  display: hasLyrics ? "flex" : "none",
                }}
              >
                <AnimatePresence initial={false}>
                  {hasLyrics && (
                    <motion.div
                      key={`lyrics-${currentTrackId}-${activeProvider || "default"}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, pointerEvents: "none" }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="absolute inset-0 flex flex-col"
                    >
                      <BraccatoLyricsView
                        lyrics={braccatoLyrics}
                        translations={trackTranslations}
                        romanizations={trackRomanizations}
                        showTranslation={showTranslation}
                        showRomanization={showRomanization}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait">
                {!hasLyrics && lyricsLoading ? (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <div className="flex flex-col gap-5 w-full max-w-[500px]">
                      {[80, 65, 45, 70, 55, 85, 60, 50, 75, 40, 65, 55].map(
                        (w, i) => (
                          <div
                            key={i}
                            className="h-5 rounded animate-pulse bg-border-alpha-14"
                            style={{ width: `${w}%` }}
                          />
                        ),
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        aria-label={t("player.close_fullscreen")}
        onClick={onClose}
        data-no-window-drag
        className={cn(
          ISLAND_SURFACE,
          "absolute top-[6px] left-[6px] z-30 inline-flex h-[32px] w-[32px] items-center justify-center border-none text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.94] transition-all cursor-pointer select-none pointer-events-auto",
        )}
      >
        <DownLine size={18} />
      </button>
    </div>
  );
}

export default function PlayerPage() {
  const navigate = useNavigate();
  return <FullscreenPlayer onClose={() => navigate(-1)} />;
}

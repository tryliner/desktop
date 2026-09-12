import {
  useCallback,
  useEffect,
  createElement,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { useLyricsStore, LyricsProviderIsland, braccatoThemeCss } from "@/features/lyrics";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerUiElements } from "./PlayerUiElements";
import { DownLine } from "@mingcute/react";
import { preloadCoverArt, useCoverSrc } from "@/features/covers";
import "@braccato/core/element";
import "@braccato/core/styles/variables.css";
import "@braccato/core/styles/lyrics.css";
import "@braccato/core/styles/instrumental.css";
import KawarpWrapper from "./KawarpWrapper";
import { useTranslation } from "@/languages";

const BRACCATO_TAG = "braccato-lyrics";

interface BraccatoLyricsViewProps {
  lyrics: any[];
}

function BraccatoLyricsView({ lyrics }: BraccatoLyricsViewProps) {
  const elementRef = useRef<any>(null);
  const latestLyricsRef = useRef(lyrics);

  const setElement = useCallback((el: any) => {
    elementRef.current = el;
    if (!el) return;
    el.theme = braccatoThemeCss;
    el.lyrics = latestLyricsRef.current;
    el.source = "#liner-audio";

    const handleBraccatoLineClick = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { timeS?: number; time?: number }
        | undefined;
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

    const handleBraccatoScroll = (e: Event) => {
      (e.currentTarget as any)?.renderer?.noteUserScroll();
    };

    el.addEventListener("braccato:line-click", handleBraccatoLineClick);
    el.addEventListener("scroll", handleBraccatoScroll, { passive: true });

    return () => {
      el.removeEventListener("braccato:line-click", handleBraccatoLineClick);
      el.removeEventListener("scroll", handleBraccatoScroll);
      elementRef.current = null;
    };
  }, []);

  useEffect(() => {
    latestLyricsRef.current = lyrics;
    const element = elementRef.current;
    if (element) element.lyrics = lyrics;
  }, [lyrics]);

  return (
    <div className="relative flex flex-col flex-1 w-full h-full min-h-0">
      {createElement(BRACCATO_TAG, {
        ref: setElement,
        source: "#liner-audio",
        className: "block flex-1 w-full h-full px-6",
        style: {
          overflowY: "auto",
          overflowX: "hidden",
          position: "relative",
          scrollbarWidth: "none",
        },
      })}
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
  const player = usePlayerState();
  const coverUrl = player.currentTrack?.coverUrl;
  const kawarpSrc = useCoverSrc(coverUrl);

  const {
    braccatoLyrics,
    lyricsLoading,
    lyricsError,
    plainLyrics,
    activeProvider,
    currentLyricsTrackId,
  } = useLyricsStore();

  const onError = useCallback((err: Error) => {
    console.error("kawarp load error:", err);
  }, []);

  const nextCoverUrl = player.queue[player.currentIndex + 1]?.coverUrl;
  useEffect(() => {
    void preloadCoverArt(coverUrl);
    void preloadCoverArt(nextCoverUrl);
  }, [coverUrl, nextCoverUrl]);

  const currentTrackId = player.currentTrack?.id;
  const isMatchingTrack = Boolean(currentTrackId && currentLyricsTrackId === currentTrackId);
  const hasLyrics = isMatchingTrack && braccatoLyrics.length > 0;
  const isInstrumental =
    isMatchingTrack &&
    !lyricsLoading &&
    !hasLyrics &&
    !lyricsError &&
    plainLyrics === "[INSTRUMENTAL]";

  const [lyricsVersion, setLyricsVersion] = useState(0);
  const prevProviderRef = useRef(activeProvider);
  const prevTrackIdRef = useRef(currentTrackId);

  useEffect(() => {
    if (prevTrackIdRef.current !== currentTrackId) {
      prevTrackIdRef.current = currentTrackId;
      prevProviderRef.current = activeProvider;
      setLyricsVersion(0);
    } else if (
      activeProvider &&
      prevProviderRef.current &&
      prevProviderRef.current !== activeProvider
    ) {
      prevProviderRef.current = activeProvider;
      setLyricsVersion((v) => v + 1);
    } else {
      prevProviderRef.current = activeProvider;
    }
  }, [activeProvider, currentTrackId]);

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
        {kawarpSrc && (
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-110 opacity-70 pointer-events-none"
            style={{ backgroundImage: `url(${kawarpSrc})` }}
          />
        )}
        {effectsReady ? (
          <KawarpWrapper src={kawarpSrc} onError={onError} />
        ) : null}
      </div>

      <div className="absolute inset-0 z-[1] bg-black/40" />

      <div className="absolute inset-0 z-10 flex">
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <PlayerUiElements onClose={onClose} />
        </div>

        <div className="flex-1 h-full min-h-0 pl-2 pr-6 flex flex-col relative">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex justify-center">
            <LyricsProviderIsland />
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
                  key={`lyrics-${currentTrackId}-${lyricsVersion}`}
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
            ) : !hasLyrics && isInstrumental ? (
              <motion.div
                key="instrumental"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center text-text-tertiary text-lg"
              >
                <span>{t("player.instrumental")}</span>
              </motion.div>
            ) : !hasLyrics ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center text-text-tertiary"
              >
                <div className="flex flex-col items-center justify-center gap-3 opacity-80">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="opacity-40"
                  >
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                    <line x1="2" y1="2" x2="22" y2="22"></line>
                  </svg>
                  <span
                    className="text-[15px] font-[400] max-w-[250px] text-center"
                    style={{ lineHeight: "1.4" }}
                  >
                    {lyricsError || t("player.no_lyrics_found")}
                  </span>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <button
        type="button"
        aria-label={t("player.close_fullscreen")}
        onClick={onClose}
        className="absolute top-4 left-4 z-20 inline-flex h-[36px] w-[36px] items-center justify-center rounded-full border-none bg-white/[0.08] text-white/80 transition-all duration-150 ease-out hover:bg-white/[0.14] hover:text-white active:scale-[0.92] cursor-pointer"
      >
        <DownLine size={20} />
      </button>
    </div>
  );
}

export default function PlayerPage() {
  const navigate = useNavigate();
  return <FullscreenPlayer onClose={() => navigate(-1)} />;
}

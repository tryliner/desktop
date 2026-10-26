import { AnimatePresence, motion } from "framer-motion";
import {
  useLyricsStore,
  LyricsProviderIsland,
  LyricsPronunciationToggle,
} from "@/features/lyrics";
import { BraccatoLyricsView } from "./BraccatoLyricsView";
import { FullscreenLyricsFallback } from "./FullscreenLyricsFallback";

interface FullscreenLyricsPanelProps {
  currentTrackId?: string;
}

export function FullscreenLyricsPanel({
  currentTrackId,
}: FullscreenLyricsPanelProps) {
  const {
    braccatoLyrics,
    lyricsLoading,
    lyricsError,
    plainLyrics,
    availableProviders,
    currentLyricsTrackId,
  } = useLyricsStore();

  const isMatchingTrack = Boolean(
    currentTrackId && currentLyricsTrackId === currentTrackId,
  );
  const hasLyrics = isMatchingTrack && braccatoLyrics.length > 0;
  const isInstrumental =
    isMatchingTrack &&
    !lyricsLoading &&
    !hasLyrics &&
    !lyricsError &&
    plainLyrics === "[INSTRUMENTAL]";

  return (
    <div className="flex-1 h-full min-h-0 pl-2 pr-6 flex flex-col relative">
      {hasLyrics && (
        <div className="relative z-30 shrink-0 pointer-events-none flex flex-wrap items-start justify-center gap-2 py-[6px] pl-2 pr-[104px]">
          {availableProviders.length > 0 && <LyricsProviderIsland />}
          <LyricsPronunciationToggle />
        </div>
      )}

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

      <FullscreenLyricsFallback
        hasLyrics={hasLyrics}
        lyricsLoading={lyricsLoading}
        isInstrumental={isInstrumental}
        lyricsError={lyricsError}
      />
    </div>
  );
}

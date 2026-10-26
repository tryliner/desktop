import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/languages";

interface FullscreenLyricsFallbackProps {
  hasLyrics: boolean;
  lyricsLoading: boolean;
  isInstrumental: boolean;
  lyricsError: string | null;
}

export function FullscreenLyricsFallback({
  hasLyrics,
  lyricsLoading,
  isInstrumental,
  lyricsError,
}: FullscreenLyricsFallbackProps) {
  const { t } = useTranslation();
  return (
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
            {[80, 65, 45, 70, 55, 85, 60, 50, 75, 40, 65, 55].map((w, i) => (
              <div
                key={i}
                className="h-5 rounded animate-pulse bg-border-alpha-14"
                style={{ width: `${w}%` }}
              />
            ))}
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
  );
}

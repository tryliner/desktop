import { useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/languages";
import { useToast } from "@/shared/ui";
import { playerEngine, usePlayerStore } from "@/features/player";
import { CoverImage } from "@/features/covers";
import { ScrollableRow } from "@/shared/ui/ScrollableRow";
import { generateMysteryQueue } from "../services/mysteryDice";
import { useMysteryDiceStore } from "../store/mysteryDiceStore";
import { usePopularTracksAllTime } from "../hooks/usePopularTracks";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import { useListeningNow } from "../hooks/useListeningNow";
import { cn } from "@/shared/lib";
import { PlayFill, Refresh1Line, SparklesFill } from "@mingcute/react";
import type { Track } from "@/shared/types/track";

function DiceIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="16" cy="8" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="8" cy="16" r="1.5" />
      <circle cx="16" cy="16" r="1.5" />
    </svg>
  );
}

function PlayingBars({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-end gap-0.5 h-3", className)}>
      <span className="w-[2.5px] bg-white rounded-full animate-pulse h-2" />
      <span className="w-[2.5px] bg-white rounded-full animate-pulse h-3 [animation-delay:150ms]" />
      <span className="w-[2.5px] bg-white rounded-full animate-pulse h-1.5 [animation-delay:300ms]" />
    </div>
  );
}

export interface MysteryDiceRowProps {
  className?: string;
}

export function MysteryDiceRow({ className }: MysteryDiceRowProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isRolling, setIsRolling] = useState(false);

  const { revealedGenre, revealedTracks, isRolled, setRevealed } =
    useMysteryDiceStore();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.status === "playing");

  const { data: popularTracks } = usePopularTracksAllTime(50);
  const { data: recentTracks } = useRecentlyPlayed(30);
  const { tracks: listeningNow } = useListeningNow();

  const handleRoll = useCallback(async () => {
    if (isRolling) return;
    setIsRolling(true);

    try {
      const poolMap = new Map<string, Track>();

      if (popularTracks) {
        for (const item of popularTracks) {
          if (item.type === "track" && item.item.id) {
            poolMap.set(item.item.id, {
              id: item.item.id,
              title: item.item.title,
              artists: item.item.artists,
              coverUrl: item.item.coverUrl,
              durationMs: item.item.durationMs,
              playCount: item.item.playCount ?? 0,
            });
          }
        }
      }

      if (recentTracks) {
        for (const item of recentTracks) {
          if (item.type === "track" && item.item.id) {
            poolMap.set(item.item.id, {
              id: item.item.id,
              title: item.item.title,
              artists: item.item.artists,
              coverUrl: item.item.coverUrl,
              durationMs: item.item.durationMs,
              playCount: item.item.playCount ?? 0,
            });
          }
        }
      }

      if (listeningNow) {
        for (const track of listeningNow) {
          if (track.id) poolMap.set(track.id, track);
        }
      }

      const pool = Array.from(poolMap.values());

      if (pool.length === 0) {
        toast("No tracks found to roll Mystery Dice", "error");
        setIsRolling(false);
        return;
      }

      // Spring spin duration
      await new Promise((resolve) => setTimeout(resolve, 600));

      const { genre, tracks } = generateMysteryQueue(pool);
      setRevealed(genre, tracks);

      if (tracks.length > 0 && tracks[0]) {
        const firstTrack = tracks[0];
        void playerEngine.playTrack(
          firstTrack,
          tracks,
          `Mystery Dice: ${genre}`,
          firstTrack.coverUrl,
        );

        toast(`🎲 Mystery Dice: ${genre}`, "checkmark", {
          description: `${tracks.length} tracks queued`,
        });
      }
    } catch {
      toast("Failed to roll Mystery Dice", "error");
    } finally {
      setIsRolling(false);
    }
  }, [
    isRolling,
    popularTracks,
    recentTracks,
    listeningNow,
    setRevealed,
    toast,
  ]);

  const handlePlayTrack = useCallback(
    (track: Track) => {
      void playerEngine.playTrack(
        track,
        revealedTracks,
        `Mystery Dice: ${revealedGenre || "Mix"}`,
        track.coverUrl,
      );
    },
    [revealedTracks, revealedGenre],
  );

  return (
    <div
      className={cn(
        "px-3 mt-[18px] mb-[6px] w-full select-none",
        className,
      )}
    >
      <div className="h-[72px] min-h-[72px] flex items-center gap-3 w-full">
        {/* Left: The Dice Trigger Button */}
        <motion.button
          type="button"
          onClick={handleRoll}
          disabled={isRolling}
          whileTap={{ scale: 0.94 }}
          title={isRolled ? "Reroll mystery tracks" : "Roll mystery tracks"}
          className={cn(
            "relative w-[64px] h-[64px] shrink-0 rounded-[16px] p-1.5 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 backdrop-blur-xl border select-none group overflow-hidden",
            "bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.07]",
            "border-white/10 hover:border-white/20 shadow-md",
            isRolling && "opacity-80",
          )}
        >
          {/* Subtle radial glow pulse on hover */}
          <div className="absolute inset-0 bg-radial from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Dice SVG icon with spring spin animation */}
          <motion.div
            animate={
              isRolling
                ? {
                    rotate: [0, 90, 180, 270, 360],
                    scale: [1, 1.15, 1],
                  }
                : { rotate: 0, scale: 1 }
            }
            transition={{
              duration: 0.6,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            className="text-text-primary group-hover:text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.2)] transition-colors"
          >
            <DiceIcon className="w-6 h-6" />
          </motion.div>

          {/* Status Label */}
          <span className="text-[9px] font-bold tracking-widest text-text-tertiary group-hover:text-text-secondary uppercase mt-1 flex items-center gap-0.5 leading-none">
            {isRolled ? (
              <>
                <Refresh1Line className="w-2.5 h-2.5" />
                <span>REROLL</span>
              </>
            ) : (
              <span>ROLL</span>
            )}
          </span>
        </motion.button>

        {/* Right side: Either the Unrolled Tray or the Revealed Tracks */}
        <div className="flex-1 min-w-0 h-[64px] flex items-center">
          <AnimatePresence mode="wait">
            {!isRolled ? (
              /* Unrolled Empty State: Fixed height with dashed placeholder tray (0 layout shift) */
              <motion.div
                key="unrolled-tray"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={handleRoll}
                className="w-full h-[64px] flex items-center gap-3 cursor-pointer group/tray"
                title="Click to roll mystery tracks"
              >
                {/* Primary Dashed Slot with Callout */}
                <div className="flex-1 max-w-[290px] h-[64px] rounded-[14px] border border-dashed border-white/15 group-hover/tray:border-white/30 bg-white/[0.02] group-hover/tray:bg-white/[0.05] flex items-center px-4 gap-3 transition-all duration-200 backdrop-blur-sm">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-text-primary shrink-0">
                    <SparklesFill className="w-4 h-4 animate-pulse text-text-primary" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-text-primary group-hover/tray:text-white transition-colors truncate">
                      Roll to unveil mystery tracks...
                    </span>
                    <span className="text-[11px] text-text-tertiary group-hover/tray:text-text-secondary transition-colors truncate">
                      Serendipitous music discovery
                    </span>
                  </div>
                </div>

                {/* Secondary Dashed Slots */}
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="hidden md:flex w-[180px] h-[64px] rounded-[14px] border border-dashed border-white/10 group-hover/tray:border-white/20 bg-white/[0.01] items-center justify-center transition-colors select-none"
                  >
                    <span className="text-[14px] text-white/20 group-hover/tray:text-white/40 font-mono transition-colors">
                      ?
                    </span>
                  </div>
                ))}
              </motion.div>
            ) : (
              /* Rolled State: Horizontal Mini-Cards */
              <motion.div
                key="rolled-tracks"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-[64px] flex items-center gap-2.5 min-w-0"
              >
                {/* Genre Indicator Chip */}
                {revealedGenre && (
                  <div className="hidden sm:flex flex-col justify-center shrink-0 pr-1 pl-0.5 select-none">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                      Mystery
                    </span>
                    <span
                      className="text-[12px] font-semibold text-text-primary truncate max-w-[85px] leading-tight"
                      title={revealedGenre}
                    >
                      {revealedGenre}
                    </span>
                  </div>
                )}

                {/* Horizontal Scrollable Row for Revealed Mini-Cards */}
                <ScrollableRow className="flex items-center gap-2.5 overflow-x-auto py-1 px-0.5 w-full">
                  {revealedTracks.map((track, index) => {
                    const isCurrentPlaying =
                      isPlaying && currentTrack?.id === track.id;

                    return (
                      <motion.div
                        key={`${track.id}-${index}`}
                        initial={{ opacity: 0, x: -30, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{
                          duration: 0.35,
                          delay: index * 0.06,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        onClick={() => handlePlayTrack(track)}
                        className={cn(
                          "relative h-[64px] w-[210px] shrink-0 rounded-[14px] p-2 flex items-center gap-2.5 cursor-pointer transition-all duration-200 select-none group/card backdrop-blur-md active:scale-[0.98]",
                          isCurrentPlaying
                            ? "bg-white/[0.12] border border-white/30 shadow-[0_0_16px_rgba(255,255,255,0.08)]"
                            : "bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 shadow-sm",
                        )}
                        title={`${track.title} - ${track.artists}`}
                      >
                        {/* Square Thumbnail */}
                        <div className="relative w-[48px] h-[48px] rounded-lg overflow-hidden shrink-0 bg-white/5">
                          {track.coverUrl ? (
                            <CoverImage
                              src={track.coverUrl}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/10 text-white/40">
                              <DiceIcon className="w-5 h-5" />
                            </div>
                          )}

                          {/* Playing indicator or hover play overlay */}
                          <div
                            className={cn(
                              "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-150",
                              isCurrentPlaying
                                ? "opacity-100"
                                : "opacity-0 group-hover/card:opacity-100",
                            )}
                          >
                            {isCurrentPlaying ? (
                              <PlayingBars />
                            ) : (
                              <PlayFill className="w-4 h-4 text-white fill-current translate-x-0.5" />
                            )}
                          </div>
                        </div>

                        {/* Text: Title + Artist */}
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                          <span
                            className={cn(
                              "text-[13px] font-semibold truncate leading-tight transition-colors",
                              isCurrentPlaying
                                ? "text-text-primary"
                                : "text-text-primary group-hover/card:text-white",
                            )}
                          >
                            {track.title}
                          </span>
                          <span className="text-[11px] text-text-tertiary truncate leading-snug mt-0.5">
                            {track.artists}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </ScrollableRow>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default memo(MysteryDiceRow);

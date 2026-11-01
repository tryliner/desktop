import { useState, useCallback, memo } from "react";
import { useTranslation } from "@/languages";
import { useToast } from "@/shared/ui";
import { playerEngine } from "@/features/player";
import { generateMysteryQueue } from "../services/mysteryDice";
import { usePopularTracksAllTime } from "../hooks/usePopularTracks";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import { useListeningNow } from "../hooks/useListeningNow";
import { cn } from "@/shared/lib";
import type { Track } from "@/shared/types/track";

function DiceIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="16" cy="8" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="8" cy="16" r="1.5" />
      <circle cx="16" cy="16" r="1.5" />
    </svg>
  );
}

export interface MysteryDiceButtonProps {
  className?: string;
  variant?: "pill" | "icon";
}

function MysteryDiceButton({ className, variant = "pill" }: MysteryDiceButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isRolling, setIsRolling] = useState(false);

  const { data: popularTracks } = usePopularTracksAllTime(50);
  const { data: recentTracks } = useRecentlyPlayed(30);
  const { tracks: listeningNow } = useListeningNow();

  const handleRoll = useCallback(async () => {
    if (isRolling) return;
    setIsRolling(true);

    try {
      // Gather track pool from all available sources
      const poolMap = new Map<string, Track>();

      // Convert popular items to Track shape
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

      // Convert recently played
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

      // Add listening now
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

      // Let animation play for 600ms
      await new Promise((resolve) => setTimeout(resolve, 600));

      const { genre, tracks } = generateMysteryQueue(pool);

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
  }, [isRolling, popularTracks, recentTracks, listeningNow, toast]);

  const rawRolling = t("home.rollingDice");
  const rawDice = t("home.mysteryDice");
  const rollingLabel = !rawRolling || rawRolling.startsWith("home.") ? "Rolling Dice..." : rawRolling;
  const diceLabel = !rawDice || rawDice.startsWith("home.") ? "Mystery Dice" : rawDice;

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleRoll}
        disabled={isRolling}
        title={diceLabel}
        className={cn(
          "relative p-2 rounded-full cursor-pointer transition-transform duration-200 active:scale-95 bg-bg-elevated text-text-primary hover:bg-bg-hover",
          isRolling && "animate-spin text-text-primary",
          className,
        )}
      >
        <DiceIcon className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleRoll}
      disabled={isRolling}
      data-no-window-drag
      className={cn(
        "group flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-medium cursor-pointer transition-all duration-200 active:scale-95 shrink-0 select-none",
        "bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-text-primary shadow-sm",
        isRolling && "opacity-80 scale-95",
        className,
      )}
    >
      <DiceIcon
        className={cn(
          "w-4 h-4 transition-transform duration-500",
          isRolling && "rotate-[360deg] scale-110 text-white",
        )}
      />
      <span>{isRolling ? rollingLabel : diceLabel}</span>
    </button>
  );
}

export default memo(MysteryDiceButton);

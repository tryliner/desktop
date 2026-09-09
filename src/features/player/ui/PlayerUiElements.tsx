import { useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Play,
  Pause,
  SkipNext,
  SkipPrevious,
  Repeat,
  RepeatOne,
  Shuffle,
} from "@solar-icons/react";
import { AddLine, CheckFill } from "@mingcute/react";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { useIsTrackLiked, useLikeTrack, useUnlikeTrack } from "@/features/library/hooks";
import { AnimatePresence, motion } from "framer-motion";
import { ArtistLink } from "@/features/artist";
import { useCoverReady, CoverImage } from "@/features/covers";
import ExplicitBadge from "@/shared/ui/ExplicitBadge";
import { VolumePicker } from "./VolumePicker";
import { TimelineSlider } from "./TimelineSlider";

const iconButtonClass =
  "inline-flex h-[28px] w-[28px] items-center justify-center text-white opacity-70 transition-all duration-150 ease-out hover:opacity-100 active:scale-[0.94] shrink-0 border-none bg-transparent cursor-pointer";

function PlayPauseIcon({ status }: { status: string }) {
  if (status === "loading") {
    return (
      <span
        className="h-[18px] w-[18px] animate-spin rounded-full border-[2px] border-current border-t-transparent"
        aria-label="Loading playback"
      />
    );
  }
  return status === "playing" ? (
    <Pause weight="Bold" size={22} />
  ) : (
    <Play weight="Bold" size={22} className="translate-x-[1px]" />
  );
}

interface PlayerUiElementsProps {
  onDuration?: (duration: number) => void;
  onClose?: () => void;
}

export function PlayerUiElements({
  onDuration: _onDuration,
  onClose,
}: PlayerUiElementsProps) {
  const player = usePlayerState();

  const track = player.currentTrack;
  const coverUrl = track?.coverUrl || "";
  const trackTitle = track?.title || "";
  const trackArtists = track?.artists || "";

  const isLiked = useIsTrackLiked(track?.id);
  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();
  const togglingRef = useRef(false);

  const handleLikeToggle = useCallback(() => {
    if (!track || togglingRef.current) return;
    togglingRef.current = true;
    const onSettled = () => {
      togglingRef.current = false;
    };
    if (isLiked) {
      unlikeMutation.mutate(track.id, { onSettled });
    } else {
      likeMutation.mutate(track.id, { onSettled });
    }
  }, [track, isLiked, likeMutation, unlikeMutation]);

  const isCoverLoaded = useCoverReady(coverUrl);

  return (
    <>
      {/* Artwork (Compact, flat, no drop shadows) */}
      <div
        className={`relative shrink-0 overflow-hidden rounded-xl w-[280px] h-[280px] bg-black/20 ${
          !isCoverLoaded ? "animate-pulse" : ""
        }`}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={coverUrl}
            initial={
              isCoverLoaded
                ? { opacity: 1, filter: "blur(0px)" }
                : { opacity: 0, filter: "blur(8px)" }
            }
            animate={{
              opacity: isCoverLoaded ? 1 : 0,
              filter: isCoverLoaded ? "blur(0px)" : "blur(8px)",
            }}
            exit={{ opacity: 0, filter: "blur(8px)" }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <CoverImage
              src={coverUrl}
              alt={trackTitle}
              fill
              sizes="280px"
              priority
              unoptimized
              crossOrigin="anonymous"
              className="rounded-xl object-cover"
            />
          </motion.div>
        </AnimatePresence>
        <button
          type="button"
          aria-label={isLiked ? "Unlike" : "Like"}
          className={`absolute bottom-2.5 left-2.5 z-20 inline-flex h-[30px] w-[30px] items-center justify-center rounded-full transition-all duration-200 ease-out active:scale-[0.92] bg-black/40 backdrop-blur-md border-none ${
            isLiked
              ? "text-white hover:bg-black/60"
              : "text-white/70 hover:text-white hover:bg-black/60"
          }`}
          onClick={handleLikeToggle}
          style={{ cursor: "pointer" }}
        >
          <motion.div
            initial={false}
            animate={{
              scale: isLiked ? 1 : 0.5,
              opacity: isLiked ? 1 : 0,
              rotate: isLiked ? 0 : -45,
            }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <CheckFill size={16} />
          </motion.div>
          <motion.div
            initial={false}
            animate={{
              scale: !isLiked ? 1 : 0.5,
              opacity: !isLiked ? 1 : 0,
              rotate: !isLiked ? 0 : 45,
            }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <AddLine size={16} />
          </motion.div>
        </button>
      </div>

      {/* Track info */}
      <div className="w-[280px] flex items-start justify-center min-w-0">
        <div className="flex flex-col gap-[2px] min-w-0 text-center">
          <p
            className="m-0 text-[15px] font-[600] text-white flex items-center justify-center gap-[6px] max-w-[280px]"
            style={{ letterSpacing: "-0.03em" }}
          >
            <span className="min-w-0 truncate">{trackTitle}</span>
          </p>
          <p className="m-0 flex items-center justify-center gap-[5px] text-[12px] text-white/60 leading-snug max-w-[320px] overflow-hidden">
            {track?.explicit && (
              <ExplicitBadge className="!bg-white/60 !text-black !pb-0 !leading-none shrink-0" />
            )}
            <ArtistLink
              name={trackArtists}
              artistId={track?.artistId}
              artistList={track?.artistList}
              onNavigate={() => {
                if (location.pathname !== "/player") {
                  onClose?.();
                }
              }}
              className="text-white/60"
            />
          </p>
        </div>
      </div>

      {/* Timeline (Compact, with smooth spring pill, no thumb) */}
      <TimelineSlider
        positionMs={player.positionMs}
        durationMs={player.durationMs}
        onSeek={(pos) => playerEngine.seek(pos)}
        showTime
        size="md"
        className="w-[320px]"
      />

      {/* Primary Playback Controls */}
      <div className="flex items-center gap-[14px]">
        <button
          type="button"
          aria-label="Shuffle"
          onClick={() => playerEngine.setShuffle(!player.shuffle)}
          className={`${iconButtonClass} ${
            player.shuffle ? "!text-white !opacity-100" : "!text-white/40"
          }`}
        >
          <Shuffle size={18} />
        </button>

        <button
          type="button"
          aria-label="Previous track"
          onClick={() => void playerEngine.skipPrevious()}
          className={iconButtonClass}
        >
          <SkipPrevious size={20} weight="Bold" />
        </button>

        <button
          type="button"
          aria-label={player.status === "playing" ? "Pause" : "Play"}
          onClick={() => void playerEngine.togglePlayPause()}
          className="inline-flex h-[36px] w-[36px] items-center justify-center text-white opacity-85 transition-all duration-150 ease-out hover:opacity-100 active:scale-[0.94] shrink-0 border-none bg-transparent cursor-pointer"
        >
          <PlayPauseIcon status={player.status} />
        </button>

        <button
          type="button"
          aria-label="Next track"
          onClick={() => void playerEngine.skipNext()}
          className={iconButtonClass}
        >
          <SkipNext size={20} weight="Bold" />
        </button>

        <button
          type="button"
          aria-label="Repeat"
          onClick={() =>
            playerEngine.setRepeat(
              player.repeat === "off"
                ? "all"
                : player.repeat === "all"
                  ? "one"
                  : "off",
            )
          }
          className={`${iconButtonClass} ${
            player.repeat !== "off" ? "!text-white !opacity-100" : "!text-white/40"
          }`}
        >
          {player.repeat === "one" ? (
            <RepeatOne size={18} />
          ) : (
            <Repeat size={18} />
          )}
        </button>
      </div>

      {/* Volume (Compact smooth slider, size sm) */}
      <VolumePicker className="w-[180px]" size="sm" />
    </>
  );
}

export default PlayerUiElements;

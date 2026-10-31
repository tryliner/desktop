import { useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  useIsTrackLiked,
  useLikeTrack,
  useUnlikeTrack,
} from "@/features/library/hooks";
import { ArtistLink } from "@/features/artist";
import { isLocalTrackId } from "@/shared/media/local";
import { useTranslation } from "@/languages";
import { ScrollableText } from "@/shared/ui";
import { usePlayerStore } from "../store/playerStore";
import { useGlassBlur } from "../store/visualModeStore";
import { cn } from "@/shared/lib";
import { LikeMorphIcon } from "./LikeMorphIcon";

interface FullscreenTrackInfoProps {
  onClose?: () => void;
}

export function FullscreenTrackInfo({ onClose }: FullscreenTrackInfoProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const track = usePlayerStore((s) => s.currentTrack);
  const glassBlur = useGlassBlur();

  const isLocal = isLocalTrackId(track?.id);
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

  return (
    <div className="flex w-full items-center gap-[12px]">
      <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <ScrollableText
          text={track?.title || ""}
          className="font-montserrat m-0 text-[20px] font-[600] leading-[1.2] tracking-[-0.01em] text-white"
        />
        <p className="font-montserrat m-0 flex min-w-0 items-center gap-[6px] text-[14px] font-[500] text-white/70 leading-snug">
          {track?.explicit && (
            <span
              aria-label="Explicit"
              className="inline-flex h-[18px] w-[18px] shrink-0 -translate-y-px items-center justify-center rounded-[5px] bg-white/70 text-black/80"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path
                  d="M2.2 1H7.8V2.4H3.8V4.3H7.2V5.7H3.8V7.6H7.8V9H2.2Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          )}
          <ArtistLink
            name={track?.artists || ""}
            artistId={track?.artistId}
            artistList={track?.artistList}
            plain={isLocal}
            onNavigate={() => {
              if (location.pathname !== "/player") onClose?.();
            }}
            className="truncate text-white/70"
          />
        </p>
      </div>

      {!isLocal && (
        <button
          type="button"
          aria-label={isLiked ? t("common.unlike") : t("common.like")}
          onClick={handleLikeToggle}
          className={cn(
            "relative inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[11px] border-none bg-white/[0.06] cursor-pointer text-white transition-colors duration-200 ease-out hover:bg-white/[0.12] active:scale-[0.92]",
            glassBlur && "backdrop-blur-xl backdrop-brightness-[1.15]",
          )}
        >
          <LikeMorphIcon liked={Boolean(isLiked)} size={20} />
        </button>
      )}
    </div>
  );
}

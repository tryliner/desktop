import { useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  useIsTrackLiked,
  useLikeTrack,
  useUnlikeTrack,
} from "@/features/library/hooks";
import { ArtistLink } from "@/features/artist";
import { useTranslation } from "@/languages";
import { usePlayerState } from "../hooks/usePlayerState";
import { LikeMorphIcon } from "./LikeMorphIcon";

interface FullscreenTrackInfoProps {
  onClose?: () => void;
}

export function FullscreenTrackInfo({ onClose }: FullscreenTrackInfoProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const track = usePlayerState().currentTrack;

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
        <p className="font-montserrat m-0 truncate text-[20px] font-[600] leading-[1.2] tracking-[-0.01em] text-white">
          {track?.title || ""}
        </p>
        <p className="font-montserrat m-0 flex min-w-0 items-center gap-[6px] text-[14px] font-[500] text-white/70 leading-snug">
          {track?.explicit && (
            <span className="font-montserrat inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-[#303030]/50 backdrop-blur-2xl backdrop-saturate-150 text-[10px] font-[700] leading-none text-white">
              <span className="[text-box:trim-both_cap_alphabetic]">E</span>
            </span>
          )}
          <ArtistLink
            name={track?.artists || ""}
            artistId={track?.artistId}
            artistList={track?.artistList}
            onNavigate={() => {
              if (location.pathname !== "/player") onClose?.();
            }}
            className="truncate text-white/70"
          />
        </p>
      </div>

      <button
        type="button"
        aria-label={isLiked ? t("common.unlike") : t("common.like")}
        onClick={handleLikeToggle}
        className="relative inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border-none bg-[#303030]/50 backdrop-blur-2xl backdrop-saturate-150 cursor-pointer text-white transition-colors duration-200 ease-out hover:bg-[#303030]/65 active:scale-[0.92]"
      >
        <LikeMorphIcon liked={Boolean(isLiked)} size={20} />
      </button>
    </div>
  );
}

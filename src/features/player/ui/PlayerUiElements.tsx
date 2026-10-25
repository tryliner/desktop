import { useEffect, useState } from "react";
import { MusicNote } from "@solar-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCoverReady, CoverImage } from "@/features/covers";
import { cn } from "@/shared/lib";
import { usePlayerState } from "../hooks/usePlayerState";
import { VolumePicker } from "./VolumePicker";
import { FullscreenTrackInfo } from "./FullscreenTrackInfo";
import { FullscreenTimeline } from "./FullscreenTimeline";
import { FullscreenTransportControls } from "./FullscreenTransportControls";
import { BASE_COLUMN_WIDTH, fullscreenColumnScale } from "../lib/fullscreenScale";
import { useWindowState } from "@/features/navigation/hooks/useWindowState";

function useFullscreenColumnScale(): number {
  const { isEdgeToEdge } = useWindowState();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!isEdgeToEdge) {
      setScale(1);
      return;
    }
    const update = () => setScale(fullscreenColumnScale(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isEdgeToEdge]);

  return scale;
}

interface PlayerUiElementsProps {
  onDuration?: (duration: number) => void;
  onClose?: () => void;
}

export function PlayerUiElements({ onClose }: PlayerUiElementsProps) {
  const track = usePlayerState().currentTrack;
  const coverUrl = track?.coverUrl || "";
  const isCoverLoaded = useCoverReady(coverUrl);
  const scale = useFullscreenColumnScale();
  const scaled = scale > 1;

  return (
    <div
      className={cn(
        "flex min-w-[240px] flex-col items-stretch",
        !scaled && "w-[min(340px,32vw,calc(100vh-340px))]",
      )}
      style={scaled ? { width: Math.round(BASE_COLUMN_WIDTH * scale) } : undefined}
    >
      <div
        className={cn(
          "relative aspect-square w-full shrink-0 overflow-hidden rounded-xl bg-black/20",
          coverUrl && !isCoverLoaded && "animate-pulse",
        )}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={track?.id || coverUrl || "empty"}
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(8px)" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {coverUrl ? (
              <CoverImage
                key={coverUrl}
                src={coverUrl}
                alt={track?.title || ""}
                fill
                sizes={`${Math.round(BASE_COLUMN_WIDTH * scale)}px`}
                priority
                unoptimized
                className="rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/40">
                <MusicNote size={64} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-[24px]">
        <FullscreenTrackInfo onClose={onClose} />
      </div>

      <div className="mt-[22px]">
        <FullscreenTimeline />
      </div>

      <div className="mt-[20px]">
        <FullscreenTransportControls />
      </div>

      <div className="mt-[22px] flex justify-center">
        <VolumePicker
          className="w-[60%]"
          size="sm"
          iconSize={22}
          iconClassName="text-white opacity-80 hover:opacity-100"
        />
      </div>
    </div>
  );
}

export default PlayerUiElements;

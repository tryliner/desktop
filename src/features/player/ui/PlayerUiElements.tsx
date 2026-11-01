import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib";
import { VolumePicker } from "./VolumePicker";
import { FullscreenCoverArt } from "./FullscreenCoverArt";
import { FullscreenTrackInfo } from "./FullscreenTrackInfo";
import { FullscreenTimeline } from "./FullscreenTimeline";
import { FullscreenTransportControls } from "./FullscreenTransportControls";
import {
  BASE_COLUMN_WIDTH,
  fullscreenColumnScale,
} from "../lib/fullscreenScale";
import { useWindowState } from "@/features/navigation/hooks/useWindowState";

function useFullscreenColumnScale(): number {
  const { isEdgeToEdge } = useWindowState();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!isEdgeToEdge) {
      setScale(1);
      return;
    }
    const update = () =>
      setScale(fullscreenColumnScale(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isEdgeToEdge]);

  return scale;
}

interface PlayerUiElementsProps {
  onDuration?: (duration: number) => void;
  onClose?: () => void;
  layout?: "vertical" | "horizontal";
}

const LAYOUT_TRANSITION = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1],
} as const;

export function PlayerUiElements({
  onClose,
  layout = "vertical",
}: PlayerUiElementsProps) {
  const scale = useFullscreenColumnScale();
  const scaled = scale > 1;
  const horizontal = layout === "horizontal";
  const columnWidth = Math.round(BASE_COLUMN_WIDTH * scale);
  const columnStyle = scaled ? { width: columnWidth } : undefined;
  const columnClass = cn(
    "min-w-[240px]",
    !scaled &&
      (horizontal
        ? "w-[min(360px,34vw,calc(100vh-200px))]"
        : "w-[min(340px,32vw,calc(100vh-340px))]"),
  );

  return (
    <motion.div
      layout
      transition={LAYOUT_TRANSITION}
      className={cn(
        "flex",
        horizontal ? "flex-row items-stretch gap-[56px]" : "flex-col",
        !horizontal && columnClass,
      )}
      style={horizontal ? undefined : columnStyle}
    >
      <motion.div
        layout
        transition={LAYOUT_TRANSITION}
        className={cn("relative", horizontal && "aspect-square shrink-0")}
      >
        <FullscreenCoverArt sizes={`${columnWidth}px`} />
      </motion.div>

      <motion.div
        layout="position"
        transition={LAYOUT_TRANSITION}
        className={cn("flex flex-col", horizontal && columnClass)}
        style={horizontal ? columnStyle : undefined}
      >
        <div className={horizontal ? undefined : "mt-[24px]"}>
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
      </motion.div>
    </motion.div>
  );
}

export default PlayerUiElements;

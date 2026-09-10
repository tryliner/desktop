import { useState, useRef, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { VolumeCross, VolumeSmall, VolumeLoud } from "@solar-icons/react";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { toVolumeGain, toVolumeLevel } from "../engine/volume";

export interface VolumePickerProps {
  className?: string;
  showIcon?: boolean;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  trackClassName?: string;
  fillClassName?: string;
  iconClassName?: string;
  valueClassName?: string;
  trackBg?: string;
  trackActiveBg?: string;
  fillColor?: string;
  onVolumeChange?: (level: number) => void;
}

export const VolumePicker = memo(function VolumePicker({
  className = "",
  showIcon = true,
  showValue = false,
  size = "md",
  trackClassName = "",
  fillClassName = "",
  iconClassName = "",
  valueClassName = "",
  trackBg,
  trackActiveBg,
  fillColor,
  onVolumeChange,
}: VolumePickerProps) {
  const player = usePlayerState();
  const volumeLevel = toVolumeLevel(player.volume);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragLevel, setDragLevel] = useState<number | null>(null);
  const lastNonZeroVolumeRef = useRef<number>(0.7);

  const trackRef = useRef<HTMLDivElement>(null);

  const currentLevel = isDragging && dragLevel !== null ? dragLevel : volumeLevel;
  const percentage = Math.round(currentLevel * 100);

  const updateVolume = useCallback(
    (level: number) => {
      const clamped = Math.min(1, Math.max(0, level));
      const gain = toVolumeGain(clamped);
      playerEngine.setVolume(gain);
      if (clamped > 0) {
        lastNonZeroVolumeRef.current = clamped;
      }
      onVolumeChange?.(clamped);
    },
    [onVolumeChange],
  );

  const calculateLevelFromPointer = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return currentLevel;
      const ratio = (clientX - rect.left) / rect.width;
      return Math.min(1, Math.max(0, ratio));
    },
    [currentLevel],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      const nextLevel = calculateLevelFromPointer(e.clientX);
      setDragLevel(nextLevel);
      updateVolume(nextLevel);

      const onPointerMove = (ev: PointerEvent) => {
        const lvl = calculateLevelFromPointer(ev.clientX);
        setDragLevel(lvl);
        updateVolume(lvl);
      };

      const onPointerUp = (ev: PointerEvent) => {
        setIsDragging(false);
        setDragLevel(null);
        try {
          (e.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
        } catch {}
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [calculateLevelFromPointer, updateVolume],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.04 : -0.04;
      const nextLevel = Math.min(1, Math.max(0, currentLevel + delta));
      updateVolume(nextLevel);
    },
    [currentLevel, updateVolume],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        updateVolume(currentLevel + 0.05);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        updateVolume(currentLevel - 0.05);
      } else if (e.key === "Home") {
        e.preventDefault();
        updateVolume(0);
      } else if (e.key === "End") {
        e.preventDefault();
        updateVolume(1);
      }
    },
    [currentLevel, updateVolume],
  );

  const handleToggleMute = useCallback(() => {
    if (volumeLevel > 0) {
      lastNonZeroVolumeRef.current = volumeLevel;
      updateVolume(0);
    } else {
      updateVolume(lastNonZeroVolumeRef.current || 0.7);
    }
  }, [volumeLevel, updateVolume]);

  const containerHeights = {
    sm: "h-[24px]",
    md: "h-[28px]",
    lg: "h-[32px]",
  }[size];

  const baseTrackHeights = {
    sm: "h-[6px]",
    md: "h-[7px]",
    lg: "h-[8px]",
  }[size];

  const iconSizes = {
    sm: 16,
    md: 18,
    lg: 20,
  }[size];

  const isActive = isHovered || isDragging;

  return (
    <div
      className={`group relative flex ${containerHeights} items-center gap-[10px] select-none prevent-seek ${className}`}
      onWheel={handleWheel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showIcon && (
        <button
          type="button"
          onClick={handleToggleMute}
          aria-label={volumeLevel === 0 ? "Unmute" : "Mute"}
          className={`flex h-full w-[24px] shrink-0 items-center justify-center border-none bg-transparent p-0 ${
            !iconClassName ? "text-text-secondary hover:text-text-primary" : ""
          } transition-colors duration-150 ease-out cursor-pointer ${iconClassName}`}
        >
          <span className="flex items-center justify-center transition-transform duration-150 ease-out hover:scale-110 active:scale-90">
            {percentage === 0 ? (
              <VolumeCross size={iconSizes} weight="Bold" />
            ) : percentage < 40 ? (
              <VolumeSmall size={iconSizes} weight="Bold" />
            ) : (
              <VolumeLoud size={iconSizes} weight="Bold" />
            )}
          </span>
        </button>
      )}

      <div
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        className="relative flex h-full flex-1 items-center cursor-pointer outline-none"
      >
        <motion.div
          ref={trackRef}
          initial={false}
          animate={{
            scaleY: isActive ? (size === "sm" ? 1.35 : 1.3) : 1,
            ...(trackBg ? { backgroundColor: isActive ? (trackActiveBg || trackBg) : trackBg } : {}),
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.8,
          }}
          className={`relative w-full rounded-full overflow-hidden origin-center transition-colors duration-150 ${baseTrackHeights} ${
            !trackBg
              ? isActive
                ? "bg-black/[0.22] dark:bg-white/[0.28]"
                : "bg-black/[0.12] dark:bg-white/[0.18]"
              : ""
          } ${trackClassName}`}
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${
              !fillColor && !fillClassName ? "bg-text-primary" : ""
            } transition-[width] ease-out ${
              isDragging ? "duration-0" : "duration-100"
            } ${fillClassName}`}
            style={{ width: `${percentage}%`, ...(fillColor ? { backgroundColor: fillColor } : {}) }}
          />
        </motion.div>
      </div>

      {showValue && (
        <span
          className={`w-[32px] shrink-0 text-right text-[12px] font-[500] tabular-nums ${
            !valueClassName ? "text-text-tertiary group-hover:text-text-secondary" : ""
          } transition-colors ${valueClassName}`}
        >
          {percentage}%
        </span>
      )}
    </div>
  );
});

export default VolumePicker;

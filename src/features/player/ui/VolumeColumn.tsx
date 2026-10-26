import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { VolumeCross, VolumeLoud, VolumeSmall } from "@solar-icons/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { toVolumeGain, toVolumeLevel } from "../engine/volume";

export interface VolumeColumnProps {
  onDraggingChange?: (dragging: boolean) => void;
}

const WHEEL_STEP = 0.04;
const KEY_STEP = 0.05;
const DEFAULT_RESTORE_LEVEL = 0.7;

const clampLevel = (level: number) => Math.min(1, Math.max(0, level));

function VolumeIcon({ percent }: { percent: number }) {
  if (percent === 0) return <VolumeCross size={14} weight="Bold" />;
  if (percent < 40) return <VolumeSmall size={14} weight="Bold" />;
  return <VolumeLoud size={14} weight="Bold" />;
}

export function VolumeColumn({ onDraggingChange }: VolumeColumnProps) {
  const { t } = useTranslation();
  const player = usePlayerState();
  const trackRef = useRef<HTMLDivElement>(null);
  const restoreLevelRef = useRef(DEFAULT_RESTORE_LEVEL);
  const [dragLevel, setDragLevel] = useState<number | null>(null);
  const level = dragLevel ?? toVolumeLevel(player.volume);
  const percent = Math.round(level * 100);

  const apply = (next: number) => {
    const clamped = clampLevel(next);
    if (clamped > 0) restoreLevelRef.current = clamped;
    playerEngine.setVolume(toVolumeGain(clamped));
    return clamped;
  };

  const levelAt = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return level;
    return clampLevel((rect.bottom - clientY) / rect.height);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragLevel(apply(levelAt(event.clientY)));
    onDraggingChange?.(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragLevel === null) return;
    setDragLevel(apply(levelAt(event.clientY)));
  };

  const handlePointerUp = () => {
    if (dragLevel === null) return;
    setDragLevel(null);
    onDraggingChange?.(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? level + KEY_STEP
        : event.key === "ArrowDown" || event.key === "ArrowLeft"
          ? level - KEY_STEP
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? 1
              : null;
    if (next === null) return;
    event.preventDefault();
    apply(next);
  };

  const toggleMute = () => apply(level === 0 ? restoreLevelRef.current : 0);

  const label = (
    <span className="text-[10px] font-[700] tabular-nums">{percent}%</span>
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={t("player.volume") || "Volume"}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={(event) =>
        apply(level + (event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP))
      }
      onKeyDown={handleKeyDown}
      className="prevent-seek relative h-[120px] w-[38px] cursor-pointer touch-none select-none overflow-hidden rounded-[7px] bg-black/[0.08] outline-none focus-visible:ring-2 focus-visible:ring-text-primary/30 dark:bg-white/[0.08]"
    >
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-text-primary/85",
          dragLevel === null && "transition-[height] duration-100 ease-out",
        )}
        style={{ height: `${percent}%` }}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-[6px] text-text-primary">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={toggleMute}
          aria-label={
            percent === 0
              ? t("player.unmute") || "Unmute"
              : t("player.mute") || "Mute"
          }
          className="pointer-events-auto flex size-[20px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-inherit"
        >
          <VolumeIcon percent={percent} />
        </button>
        {label}
      </div>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-[6px] text-bg-primary",
          dragLevel === null && "transition-[clip-path] duration-100 ease-out",
        )}
        style={{ clipPath: `inset(${100 - percent}% 0 0 0)` }}
        aria-hidden="true"
      >
        <span className="flex size-[20px] items-center justify-center">
          <VolumeIcon percent={percent} />
        </span>
        {label}
      </div>
    </div>
  );
}

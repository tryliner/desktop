import type { ReactNode } from "react";
import { Shuffle } from "@solar-icons/react";
import type { ShuffleMode } from "../store/playerStore";
import { cn } from "@/shared/lib";

export type ShuffleIconSize = 18 | 24;

const ICON_SIZE: Record<
  ShuffleIconSize,
  { box: string; sparkle: number; offset: string }
> = {
  18: { box: "size-[18px]", sparkle: 8, offset: "-top-[3px] -left-[3px]" },
  24: { box: "size-[24px]", sparkle: 11, offset: "-top-[4px] -left-[4px]" },
};

export interface ShuffleIconProps {
  mode: ShuffleMode;
  size?: ShuffleIconSize;
  className?: string;
  icon?: ReactNode;
}

export function SparkleStar({
  size = 10,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("pointer-events-none select-none", className)}
      aria-hidden="true"
    >
      <path d="M8 0C8 4.418 4.418 8 0 8C4.418 8 8 11.582 8 16C8 11.582 11.582 8 16 8C11.582 8 8 4.418 8 0Z" />
    </svg>
  );
}

export function ShuffleIcon({
  mode,
  size = 18,
  className,
  icon,
}: ShuffleIconProps) {
  const dims = ICON_SIZE[size];

  return (
    <span
      className={cn("relative inline-flex shrink-0", dims.box, className)}
      data-shuffle-mode={mode}
    >
      {icon ?? <Shuffle size={size} weight="Outline" />}
      {mode === "smart" && (
        <span className={cn("absolute flex pointer-events-none", dims.offset)}>
          <SparkleStar size={dims.sparkle} />
        </span>
      )}
    </span>
  );
}

export default ShuffleIcon;

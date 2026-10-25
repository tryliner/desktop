import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/shared/lib";

export interface TickRulerProps {
  value: number;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  valueText: string;
  onChange: (value: number) => void;
}

const TICK_GAP = 8;
const TICK_WIDTH = 3;
const GHOST_TICKS = 24;
const FADE_MASK =
  "linear-gradient(to right, transparent 0, black 22%, black 78%, transparent 100%)";

function snap(value: number, min: number, max: number, step: number): number {
  const stepped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(3))));
}

export function TickRuler({
  value,
  min,
  max,
  step,
  ariaLabel,
  valueText,
  onChange,
}: TickRulerProps) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; value: number } | null>(null);
  const count = Math.round((max - min) / step) + 1;
  const activeIndex = Math.round((value - min) / step);

  const commit = (next: number) => {
    const snapped = snap(next, min, max, step);
    if (snapped !== value) onChange(snapped);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, value };
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragRef.current;
    if (!origin) return;
    const ticks = (origin.x - event.clientX) / TICK_GAP;
    commit(origin.value + ticks * step);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? step
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -step
          : 0;
    if (!delta) return;
    event.preventDefault();
    commit(value + delta);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={(event) => commit(value + (event.deltaY < 0 ? step : -step))}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative h-[40px] w-full touch-none select-none overflow-hidden rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-text-primary/30",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 12"
        className="absolute left-1/2 top-0 h-[12px] w-[16px] -translate-x-1/2 text-text-primary opacity-45"
      >
        <path
          d="M2 1.5h12L8 10.5z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </svg>
      <div
        className="absolute inset-x-0 bottom-[4px] top-[17px]"
        style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
      >
        <div
          className={cn(
            "absolute bottom-0 left-1/2 flex h-full items-end",
            !dragging && "transition-transform duration-200 ease-out",
          )}
          style={{
            gap: TICK_GAP - TICK_WIDTH,
            transform: `translateX(${-(activeIndex + GHOST_TICKS) * TICK_GAP - TICK_WIDTH / 2}px)`,
          }}
        >
          {Array.from({ length: count + GHOST_TICKS * 2 }, (_, slot) => {
            const index = slot - GHOST_TICKS;
            return (
              <span
                key={slot}
                className={cn(
                  "h-full w-[3px] shrink-0 rounded-full transition-colors duration-200",
                  index === activeIndex
                    ? "bg-text-primary"
                    : "bg-text-primary/35",
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

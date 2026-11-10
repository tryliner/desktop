import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib";
import { SMOOTH_EASE } from "@/shared/hooks/useTweenedNumber";

const MIN_SHARE = 0.015;

export interface UsageSegment {
  key: string;
  value: number;
  /** bg-* class for the bar segment and its legend dot */
  swatch: string;
  /** legend text; segments without one stay out of the legend */
  label?: string;
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-[7px]">
      <span className={`h-[7px] w-[7px] rounded-full ${swatch}`} />
      {label}
    </span>
  );
}

/**
 * Bar of segments sized by share, animating as the values change. Tiny
 * non-zero segments keep a sliver so they never vanish.
 */
export function SegmentBar({
  segments,
  className,
}: {
  segments: UsageSegment[];
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const share = (value: number) =>
    total > 0 && value > 0 ? Math.max(value / total, MIN_SHARE) : 0;
  const empty = total <= 0;

  return (
    <div className={cn("flex h-[8px] gap-[3px]", className)}>
      {empty ? (
        <div className="h-full flex-1 rounded-full bg-fill" />
      ) : (
        segments.map((segment) => {
          const grow = share(segment.value);
          return (
            <motion.div
              key={segment.key}
              className={`h-full rounded-full ${segment.swatch}`}
              style={{ flexBasis: 0 }}
              initial={false}
              animate={{ flexGrow: grow, opacity: grow > 0 ? 1 : 0 }}
              transition={{ duration: 0.7, ease: SMOOTH_EASE }}
            />
          );
        })
      )}
    </div>
  );
}

/**
 * The storage-style summary: a large number with its unit, a note on the
 * right, a segment bar and a dot legend. Pass already tweened values.
 */
export default function UsageOverview({
  value,
  unit,
  meta,
  segments,
}: {
  value: string;
  unit?: string;
  meta?: ReactNode;
  segments: UsageSegment[];
}) {
  const legend = segments.filter((segment) => segment.label);

  return (
    <div
      className="flex flex-col px-[2px] pt-[4px]"
      style={{ fontFamily: "var(--font-sf)" }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-[5px]">
          <span className="text-[28px] font-[600] leading-none tracking-[-0.02em] tabular-nums text-text-primary">
            {value}
          </span>
          {unit ? (
            <span className="text-title text-text-tertiary">{unit}</span>
          ) : null}
        </div>
        {meta}
      </div>

      <SegmentBar segments={segments} className="mt-[14px]" />

      {legend.length > 0 ? (
        <div className="mt-[12px] flex gap-[20px] text-body tabular-nums text-text-tertiary">
          {legend.map((segment) => (
            <Legend
              key={segment.key}
              swatch={segment.swatch}
              label={segment.label!}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

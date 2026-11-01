import type { ReactNode } from "react";
import { HERO_SUBTITLE_CLASS, HERO_TITLE_CLASS } from "./EntityHero";

export interface EntityHeroSkeletonProps {
  cover?: ReactNode;
  title?: string;
  subtitle?: string;
}

export function EntityHeroSkeleton({
  cover,
  title,
  subtitle,
}: EntityHeroSkeletonProps = {}) {
  return (
    <div className="flex w-full items-stretch gap-[22px]">
      <div className="relative h-[168px] w-[168px] shrink-0 overflow-hidden rounded-[10px] bg-border-alpha-14">
        {cover ?? <div className="skeleton-shimmer h-full w-full" />}
      </div>

      <div
        className={`flex min-w-0 flex-1 flex-col ${title ? "pt-[2px]" : ""}`}
      >
        {title ? (
          <h1 className={HERO_TITLE_CLASS}>{title}</h1>
        ) : (
          <div className="skeleton-shimmer mt-[4px] h-[30px] w-[40%] rounded-[8px]" />
        )}
        {title && subtitle ? (
          <p className={`${HERO_SUBTITLE_CLASS} mt-[4px]`}>{subtitle}</p>
        ) : (
          <div className="skeleton-shimmer mt-[8px] h-[18px] w-[20%] rounded-[6px]" />
        )}
        <div className="mt-[12px] flex items-center gap-[8px]">
          <div className="skeleton-shimmer h-[26px] w-[52px] rounded-[10px]" />
          <div className="skeleton-shimmer h-[26px] w-[190px] rounded-[10px]" />
        </div>

        <div className="mt-[26px] flex items-center justify-between gap-[12px]">
          <div className="flex items-center gap-[8px]">
            <div className="skeleton-shimmer h-[32px] w-[120px] rounded-[9px]" />
            <div className="skeleton-shimmer h-[32px] w-[52px] rounded-[9px]" />
          </div>
          <div className="flex items-center gap-[8px]">
            <div className="skeleton-shimmer h-[32px] w-[52px] rounded-[9px]" />
            <div className="skeleton-shimmer h-[32px] w-[205px] rounded-[9px]" />
            <div className="skeleton-shimmer h-[32px] w-[52px] rounded-[9px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default EntityHeroSkeleton;

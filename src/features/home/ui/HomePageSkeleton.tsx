import { memo } from "react";
import { useIsContentTransparent } from "@/features/settings/store/customizationStore";

interface HomePageSkeletonProps {
  glowClass?: string;
  showQuickGrid?: boolean;
}

const TITLE_WIDTHS = ["w-[78%]", "w-[88%]", "w-[68%]", "w-[82%]", "w-[72%]", "w-[85%]", "w-[64%]"];
const ARTIST_WIDTHS = ["w-[52%]", "w-[44%]", "w-[60%]", "w-[48%]", "w-[56%]", "w-[40%]", "w-[50%]"];

function SectionSkeleton({
  headingMarginTop = "mt-[22px]",
  titleWidth = "w-[180px]",
  cardsCount = 7,
}: {
  headingMarginTop?: string;
  titleWidth?: string;
  cardsCount?: number;
}) {
  return (
    <div className="flex flex-col select-none">
      {/* Section Header */}
      <div className={`${headingMarginTop} px-8 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <div className="skeleton-shimmer w-5 h-5 rounded-[4px] shrink-0" />
          <div className={`skeleton-shimmer h-[22px] ${titleWidth} rounded-[5px]`} />
        </div>
      </div>

      {/* Cards Row */}
      <div className="flex gap-[28px] pl-8 pr-8 mt-[12px] overflow-hidden pb-[2px]">
        {Array.from({ length: cardsCount }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[175px]">
            {/* Thumbnail */}
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
              <div className="skeleton-shimmer w-full h-full" />
            </div>

            {/* Info */}
            <div className="flex flex-col mt-[8px] gap-1.5">
              <div
                className={`skeleton-shimmer h-[14px] ${TITLE_WIDTHS[i % TITLE_WIDTHS.length]} rounded-[4px]`}
              />
              <div
                className={`skeleton-shimmer h-[12px] ${ARTIST_WIDTHS[i % ARTIST_WIDTHS.length]} rounded-[4px]`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomePageSkeletonComponent({
  glowClass = "from-amber-500/20 via-orange-500/10 to-transparent",
  showQuickGrid = false,
}: HomePageSkeletonProps) {
  const hasCustomBg = useIsContentTransparent();

  return (
    <div className="relative min-h-full w-full bg-transparent pb-[16px] select-none overflow-hidden">

      {!hasCustomBg && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute top-0 left-0 right-0 h-[360px] bg-gradient-to-b ${glowClass} blur-3xl opacity-80`}
        />
      )}

      {/* Speed Dial Section Skeleton */}
      {showQuickGrid && (
        <div className="flex flex-col select-none">
          <div className="mt-[20px] px-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="skeleton-shimmer w-5 h-5 rounded-[4px] shrink-0" />
              <div className="skeleton-shimmer h-[22px] w-[120px] rounded-[5px]" />
            </div>
          </div>

          <div className="px-8 mt-[12px] relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {/* Liked Songs Quick Card */}
            <div className={`flex h-[56px] items-center gap-3 overflow-hidden rounded-[6px] ${hasCustomBg ? "apple-glass-action" : "bg-bg-elevated"} pr-4 select-none`}>
              <div className="skeleton-shimmer h-[56px] w-[56px] shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="skeleton-shimmer h-[14px] w-[95px] rounded-[4px]" />
                <div className="skeleton-shimmer h-[11px] w-[55px] rounded-[4px]" />
              </div>
            </div>

            {/* Recently Played Quick Cards (5 cards) */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`flex h-[56px] items-center gap-3 overflow-hidden rounded-[6px] ${hasCustomBg ? "apple-glass-action" : "bg-bg-elevated"} pr-4 select-none`}
              >
                <div className="skeleton-shimmer h-[56px] w-[56px] shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div
                    className={`skeleton-shimmer h-[14px] ${i % 2 === 0 ? "w-[68%]" : "w-[58%]"} rounded-[4px]`}
                  />
                  <div
                    className={`skeleton-shimmer h-[11px] ${i % 2 === 0 ? "w-[42%]" : "w-[36%]"} rounded-[4px]`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 1: Listening Right Now */}
      <SectionSkeleton
        headingMarginTop="mt-[22px]"
        titleWidth="w-[190px]"
        cardsCount={7}
      />

      {/* Section 2: Jump Back In */}
      <SectionSkeleton
        headingMarginTop="mt-[22px]"
        titleWidth="w-[170px]"
        cardsCount={7}
      />

      {/* Section 3: Most Listened of All Time */}
      <SectionSkeleton
        headingMarginTop="mt-[22px]"
        titleWidth="w-[210px]"
        cardsCount={7}
      />
    </div>
  );
}

export default memo(HomePageSkeletonComponent);

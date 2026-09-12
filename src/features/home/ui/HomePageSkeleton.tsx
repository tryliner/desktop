import { memo } from "react";

interface HomePageSkeletonProps {
  glowClass?: string;
  showQuickGrid?: boolean;
}

const TITLE_WIDTHS = ["w-[78%]", "w-[88%]", "w-[68%]", "w-[82%]", "w-[72%]", "w-[85%]", "w-[64%]"];
const ARTIST_WIDTHS = ["w-[52%]", "w-[44%]", "w-[60%]", "w-[48%]", "w-[56%]", "w-[40%]", "w-[50%]"];

function SectionSkeleton({
  headingMarginTop = "mt-[32px]",
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
      <div className="flex gap-[28px] pl-8 pr-8 mt-[16px] overflow-hidden pb-[20px]">
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
  return (
    <div className="relative min-h-full w-full bg-bg-primary pb-[40px] select-none overflow-hidden">
      {/* Ambient time-of-day gradient glow matching actual page */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-0 left-0 right-0 h-[360px] bg-gradient-to-b ${glowClass} blur-3xl opacity-80`}
      />

      {/* Hero Greeting Section */}
      <div className={`relative px-8 pt-4 ${showQuickGrid ? "pb-2" : "pb-0"}`}>
        {/* Greeting Header */}
        <div
          className={`relative -ml-4 inline-flex items-center gap-3 px-4 py-2 rounded-2xl rounded-tl-[3px] bg-bg-canvas/25 ${
            showQuickGrid ? "mb-5" : "mb-2"
          }`}
        >
          <svg
            viewBox="0 0 10 16"
            className="absolute -left-[10px] top-0 w-[10px] h-[16px] text-bg-canvas/25 fill-current pointer-events-none"
            aria-hidden="true"
          >
            <path d="M10 0 H2 C0.5 0 0 0.8 0 1.8 C0 3.2 1.5 5.5 3.5 7.8 C6 10.5 8.5 13.2 10 16 Z" />
          </svg>
          <div className="skeleton-shimmer w-6 h-6 rounded-[6px] shrink-0" />
          <div className="skeleton-shimmer h-[22px] w-[220px] sm:w-[280px] rounded-[6px]" />
        </div>

        {/* Quick Access Mix Grid */}
        {showQuickGrid && (
          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {/* Liked Songs Quick Card */}
            <div className="flex h-[56px] items-center gap-3 overflow-hidden rounded-[6px] bg-bg-elevated pr-4 select-none">
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
                className="flex h-[56px] items-center gap-3 overflow-hidden rounded-[6px] bg-bg-elevated pr-4 select-none"
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
        )}
      </div>

      {/* Section 1: Listening Right Now */}
      <SectionSkeleton
        headingMarginTop={showQuickGrid ? "mt-[28px]" : "mt-[20px]"}
        titleWidth="w-[190px]"
        cardsCount={7}
      />

      {/* Section 2: Jump Back In */}
      <SectionSkeleton
        headingMarginTop="mt-[32px]"
        titleWidth="w-[170px]"
        cardsCount={7}
      />

      {/* Section 3: Most Listened of All Time */}
      <SectionSkeleton
        headingMarginTop="mt-[32px]"
        titleWidth="w-[210px]"
        cardsCount={7}
      />
    </div>
  );
}

export default memo(HomePageSkeletonComponent);

import { memo } from "react";

const TITLE_WIDTHS = [
  "w-[78%]",
  "w-[88%]",
  "w-[68%]",
  "w-[82%]",
  "w-[72%]",
  "w-[85%]",
  "w-[64%]",
];
const ARTIST_WIDTHS = [
  "w-[52%]",
  "w-[44%]",
  "w-[60%]",
  "w-[48%]",
  "w-[56%]",
  "w-[40%]",
  "w-[50%]",
];

function SectionSkeleton({
  headingMarginTop = "mt-[22px]",
  titleWidth = "w-[180px]",
  titleHeight = "h-[24px]",
  hasIcon = true,
  iconClassName = "w-6 h-6 rounded-[5px]",
  gapClassName = "gap-2.5",
  cardsCount = 7,
}: {
  headingMarginTop?: string;
  titleWidth?: string;
  titleHeight?: string;
  hasIcon?: boolean;
  iconClassName?: string;
  gapClassName?: string;
  cardsCount?: number;
}) {
  return (
    <div className="flex flex-col select-none">
      <div
        className={`${headingMarginTop} px-3 flex items-center justify-between`}
      >
        <div className={`flex items-center ${gapClassName}`}>
          {hasIcon && (
            <div className={`skeleton-shimmer shrink-0 ${iconClassName}`} />
          )}
          <div
            className={`skeleton-shimmer ${titleHeight} ${titleWidth} rounded-[5px]`}
          />
        </div>
      </div>

      <div className="flex gap-[28px] pl-3 pr-3 mt-[12px] overflow-hidden pb-[2px]">
        {Array.from({ length: cardsCount }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[175px]">
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
              <div className="skeleton-shimmer w-full h-full" />
            </div>

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

function HomePageSkeletonComponent() {
  return (
    <div className="relative min-h-full w-full bg-transparent pb-[16px] select-none overflow-hidden">
      <SectionSkeleton
        headingMarginTop="mt-0"
        titleWidth="w-[190px]"
        titleHeight="h-[36px]"
        hasIcon={true}
        iconClassName="w-[32px] h-[32px] rounded-[10px]"
        gapClassName="gap-3"
        cardsCount={7}
      />
      <SectionSkeleton
        headingMarginTop="mt-[22px]"
        titleWidth="w-[170px]"
        titleHeight="h-[24px]"
        cardsCount={7}
      />
      <SectionSkeleton
        headingMarginTop="mt-[22px]"
        titleWidth="w-[210px]"
        titleHeight="h-[24px]"
        cardsCount={7}
      />
    </div>
  );
}

export default memo(HomePageSkeletonComponent);

import { memo } from "react";

const TRACK_TITLE_WIDTHS = [
  "w-[38%]",
  "w-[46%]",
  "w-[32%]",
  "w-[42%]",
  "w-[35%]",
];
const TRACK_SUBTITLE_WIDTHS = [
  "w-[20%]",
  "w-[26%]",
  "w-[18%]",
  "w-[24%]",
  "w-[22%]",
];
const CARD_TITLE_WIDTHS = [
  "w-[78%]",
  "w-[88%]",
  "w-[68%]",
  "w-[82%]",
  "w-[72%]",
  "w-[85%]",
];

function CardRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-[16px] overflow-hidden pb-[10px]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[180px] shrink-0">
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
            <div className="skeleton-shimmer h-full w-full" />
          </div>
          <div className="mt-[8px] flex flex-col gap-1.5">
            <div
              className={`skeleton-shimmer h-[14px] ${CARD_TITLE_WIDTHS[i % CARD_TITLE_WIDTHS.length]} rounded-[4px]`}
            />
            <div className="skeleton-shimmer h-[12px] w-[46px] rounded-[4px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtistHeroSkeleton() {
  return (
    <div className="flex w-full items-start gap-[22px]">
      <div className="relative h-[144px] w-[144px] shrink-0 overflow-hidden rounded-full bg-border-alpha-14">
        <div className="skeleton-shimmer h-full w-full" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col self-stretch justify-center">
        <div className="skeleton-shimmer h-[30px] w-[36%] rounded-[8px]" />
        <div className="skeleton-shimmer mt-[8px] h-[18px] w-[24%] rounded-[6px]" />

        <div className="mt-[20px] flex items-center gap-[8px]">
          <div className="skeleton-shimmer h-[32px] w-[112px] rounded-[9px]" />
          <div className="skeleton-shimmer h-[32px] w-[52px] rounded-[9px]" />
          <div className="skeleton-shimmer h-[32px] w-[52px] rounded-[9px]" />
          <div className="skeleton-shimmer h-[32px] w-[52px] rounded-[9px]" />
        </div>
      </div>
    </div>
  );
}

interface ArtistPageSkeletonProps {
  className?: string;
}

function ArtistPageSkeleton({ className = "" }: ArtistPageSkeletonProps) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-transparent select-none pt-(--page-inset-top) ${className}`}
    >
      <div className="shrink-0 pl-[16px] pr-[12px] pt-[8px]">
        <ArtistHeroSkeleton />
      </div>

      <div className="relative z-10 pl-[16px] pr-[12px] pt-[28px]">
        <div className="flex flex-col gap-[40px]">
          <section>
            <div className="skeleton-shimmer h-[22px] w-[160px] rounded-[5px] mb-[16px]" />
            <div className="space-y-[4px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[52px] rounded-md px-[12px] flex items-center gap-[14px]"
                >
                  <div className="skeleton-shimmer h-[14px] w-[16px] rounded-[3px]" />
                  <div className="skeleton-shimmer h-[40px] w-[40px] rounded-[12px] shrink-0" />
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div
                      className={`skeleton-shimmer h-[14px] ${TRACK_TITLE_WIDTHS[i]} rounded-[4px]`}
                    />
                    <div
                      className={`skeleton-shimmer h-[12px] ${TRACK_SUBTITLE_WIDTHS[i]} rounded-[4px]`}
                    />
                  </div>
                  <div className="skeleton-shimmer h-[12px] w-[36px] rounded-[4px]" />
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="skeleton-shimmer h-[22px] w-[130px] rounded-[5px] mb-[16px]" />
            <CardRowSkeleton count={6} />
          </section>

          <section>
            <div className="skeleton-shimmer h-[22px] w-[150px] rounded-[5px] mb-[16px]" />
            <CardRowSkeleton count={6} />
          </section>
        </div>
      </div>
    </div>
  );
}

export default memo(ArtistPageSkeleton);

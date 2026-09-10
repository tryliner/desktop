import { memo } from "react";

const TRACK_TITLE_WIDTHS = ["w-[38%]", "w-[46%]", "w-[32%]", "w-[42%]", "w-[35%]"];
const TRACK_SUBTITLE_WIDTHS = ["w-[20%]", "w-[26%]", "w-[18%]", "w-[24%]", "w-[22%]"];
const CARD_TITLE_WIDTHS = ["w-[78%]", "w-[88%]", "w-[68%]", "w-[82%]", "w-[72%]", "w-[85%]"];

function CardRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-[28px] overflow-hidden pb-[10px]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[175px] shrink-0">
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

interface ArtistPageSkeletonProps {
  className?: string;
}

// matches widescreen hero header and catalog layout of artist page
function ArtistPageSkeleton({ className = "" }: ArtistPageSkeletonProps) {
  return (
    <div className={`relative w-full bg-bg-primary pb-[32px] select-none ${className}`}>
      {/* hero header skeleton */}
      <div className="relative min-h-[340px] md:min-h-[380px] w-full flex flex-col justify-between overflow-hidden bg-bg-elevated/40">
        {/* soft gradient fade matching actual header */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, var(--bg-primary) 0%, color-mix(in srgb, var(--bg-primary) 90%, transparent) 25%, color-mix(in srgb, var(--bg-primary) 60%, transparent) 50%, color-mix(in srgb, var(--bg-primary) 20%, transparent) 75%, transparent 100%)",
          }}
        />

        {/* top row: back button */}
        <div className="relative z-10 pt-[20px] px-[32px]">
          <div className="skeleton-shimmer h-[34px] w-[34px] rounded-full" />
        </div>

        {/* bottom row: artist info & action buttons + bio card */}
        <div className="relative z-10 px-[32px] pb-[16px] flex flex-col md:flex-row md:items-end justify-between gap-[24px]">
          {/* left: title, listeners, buttons */}
          <div className="flex flex-col">
            <div className="skeleton-shimmer h-[36px] md:h-[44px] w-[260px] md:w-[320px] rounded-[8px]" />
            <div className="skeleton-shimmer h-[14px] w-[140px] rounded-[4px] mt-[10px]" />

            <div className="mt-[20px] flex items-center gap-[10px]">
              {/* play button */}
              <div className="skeleton-shimmer h-[38px] w-[96px] rounded-full" />
              {/* add to queue */}
              <div className="skeleton-shimmer h-[38px] w-[38px] rounded-md" />
              {/* save to library */}
              <div className="skeleton-shimmer h-[38px] w-[38px] rounded-md" />
              {/* share */}
              <div className="skeleton-shimmer h-[38px] w-[38px] rounded-md" />
            </div>
          </div>

          {/* right: bio card */}
          <div className="w-full md:w-[340px] lg:w-[380px] shrink-0 rounded-md bg-[#141414]/90 p-[16px] backdrop-blur-md flex flex-col gap-[8px]">
            <div className="skeleton-shimmer h-[15px] w-[80px] rounded-[4px]" />
            <div className="skeleton-shimmer h-[13px] w-[96%] rounded-[4px] mt-[2px]" />
            <div className="skeleton-shimmer h-[13px] w-[88%] rounded-[4px]" />
            <div className="skeleton-shimmer h-[13px] w-[62%] rounded-[4px]" />
            <div className="skeleton-shimmer h-[12px] w-[64px] rounded-[4px] mt-[4px]" />
          </div>
        </div>
      </div>

      {/* content sections skeleton */}
      <div className="relative z-10 px-[32px] pt-[24px]">
        <div className="flex flex-col gap-[40px]">
          {/* popular tracks section */}
          <section>
            <div className="skeleton-shimmer h-[22px] w-[160px] rounded-[5px] mb-[16px]" />
            <div className="space-y-[4px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[52px] rounded-md px-[12px] flex items-center gap-[14px]"
                >
                  <div className="skeleton-shimmer h-[14px] w-[16px] rounded-[3px]" />
                  <div className="skeleton-shimmer h-[40px] w-[40px] rounded-[6px] shrink-0" />
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

          {/* albums section */}
          <section>
            <div className="skeleton-shimmer h-[22px] w-[130px] rounded-[5px] mb-[16px]" />
            <CardRowSkeleton count={6} />
          </section>

          {/* singles & eps section */}
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

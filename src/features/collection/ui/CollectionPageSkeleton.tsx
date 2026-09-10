import { memo } from "react";

const TRACK_TITLE_WIDTHS = [
  "w-[38%]",
  "w-[48%]",
  "w-[32%]",
  "w-[44%]",
  "w-[54%]",
  "w-[36%]",
  "w-[46%]",
  "w-[40%]",
];

const TRACK_ARTIST_WIDTHS = [
  "w-[22%]",
  "w-[28%]",
  "w-[18%]",
  "w-[24%]",
  "w-[30%]",
  "w-[20%]",
  "w-[26%]",
  "w-[22%]",
];

export interface CollectionPageSkeletonProps {
  className?: string;
  isAlbum?: boolean;
}

// matches album and catalog playlist hero headers and tracklist layout
function CollectionPageSkeletonComponent({
  className = "",
  isAlbum = true,
}: CollectionPageSkeletonProps) {
  return (
    <div
      className={`relative w-full bg-bg-primary pb-[32px] select-none ${className}`}
    >
      {/* subtle ambient header glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-0 h-[450px] w-full bg-gradient-to-b from-white/[0.04] to-transparent blur-3xl opacity-30"
      />

      <div className="relative z-10 px-[32px] pt-[24px]">
        {/* top row: back button and collection title */}
        <div className="inline-flex items-center gap-[10px]">
          <div className="skeleton-shimmer h-[24px] w-[24px] rounded-full shrink-0" />
          <div className="skeleton-shimmer h-[28px] w-[220px] rounded-[6px]" />
        </div>

        {/* hero header: artwork + metadata */}
        <section className="mt-[20px] flex items-start gap-[28px]">
          {/* cover artwork */}
          <div className="relative h-[170px] w-[170px] shrink-0 overflow-hidden rounded-xl bg-border-alpha-14">
            <div className="skeleton-shimmer h-full w-full" />
          </div>

          {/* title, subtitle, track count and action buttons */}
          <div className="flex min-h-[170px] flex-1 justify-between">
            <div className="flex flex-col justify-center">
              <div className="skeleton-shimmer h-[34px] w-[260px] md:w-[340px] rounded-[6px]" />
              <div className="skeleton-shimmer h-[18px] w-[210px] rounded-[4px] mt-[8px]" />
              <div className="skeleton-shimmer h-[14px] w-[140px] rounded-[4px] mt-[10px]" />

              <div className="mt-[18px] flex items-center gap-[10px]">
                {/* play all */}
                <div className="skeleton-shimmer h-[42px] w-[124px] rounded-md" />
                {/* add to queue */}
                <div className="skeleton-shimmer h-[42px] w-[42px] rounded-md" />
                {/* save to library */}
                <div className="skeleton-shimmer h-[42px] w-[42px] rounded-md" />
              </div>
            </div>

            {/* right share button */}
            <div className="flex items-end gap-[10px] pb-[6px] pr-[16px]">
              <div className="skeleton-shimmer h-[42px] w-[42px] rounded-md" />
            </div>
          </div>
        </section>

        {/* tracklist rows */}
        <section className="mt-[20px]">
          <div className="flex flex-col -mx-[8px] space-y-[2px]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg p-[8px] h-[64px]"
              >
                <div className="flex items-center gap-[16px] min-w-0 flex-1">
                  {isAlbum ? (
                    <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center">
                      <div className="skeleton-shimmer h-[14px] w-[18px] rounded-[3px]" />
                    </div>
                  ) : (
                    <div className="skeleton-shimmer h-[48px] w-[48px] shrink-0 rounded-md" />
                  )}

                  <div className="min-w-0 flex flex-col gap-[6px] flex-1">
                    <div
                      className={`skeleton-shimmer h-[15px] ${TRACK_TITLE_WIDTHS[i % TRACK_TITLE_WIDTHS.length]} rounded-[4px]`}
                    />
                    <div
                      className={`skeleton-shimmer h-[13px] ${TRACK_ARTIST_WIDTHS[i % TRACK_ARTIST_WIDTHS.length]} rounded-[4px]`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-[16px] pr-[8px]">
                  <div className="skeleton-shimmer h-[13px] w-[36px] rounded-[4px]" />
                  <div className="skeleton-shimmer h-[32px] w-[32px] rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const CollectionPageSkeleton = memo(CollectionPageSkeletonComponent);
export default CollectionPageSkeleton;

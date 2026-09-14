import { memo } from "react";

const TRACK_TITLE_WIDTHS = [
  "w-[42%]",
  "w-[34%]",
  "w-[50%]",
  "w-[28%]",
  "w-[46%]",
  "w-[38%]",
  "w-[52%]",
  "w-[30%]",
];

const TRACK_ARTIST_WIDTHS = [
  "w-[24%]",
  "w-[18%]",
  "w-[28%]",
  "w-[22%]",
  "w-[32%]",
  "w-[20%]",
  "w-[26%]",
  "w-[16%]",
];

export interface PlaylistPageSkeletonProps {
  className?: string;
}

function PlaylistPageSkeletonComponent({
  className = "",
}: PlaylistPageSkeletonProps) {
  return (
    <div
      className={`relative w-full bg-bg-primary pb-[32px] select-none ${className}`}
    >
      <div className="flex items-start gap-[32px] px-[32px] pt-[56px] pb-[24px]">
        <aside className="w-[280px] shrink-0">
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-border-alpha-14">
            <div className="skeleton-shimmer h-full w-full" />
          </div>

          <div className="skeleton-shimmer h-[26px] w-[80%] rounded-[6px] mt-[16px]" />
          <div className="skeleton-shimmer h-[16px] w-[60%] rounded-[4px] mt-[8px]" />
          <div className="skeleton-shimmer h-[14px] w-[40%] rounded-[4px] mt-[8px]" />

          <div className="skeleton-shimmer h-[36px] w-full rounded-md mt-[16px]" />
          <div className="mt-[8px] flex items-center gap-[8px]">
            <div className="skeleton-shimmer h-[36px] flex-1 rounded-md" />
            <div className="skeleton-shimmer h-[36px] w-[36px] rounded-md" />
            <div className="skeleton-shimmer h-[36px] w-[36px] rounded-md" />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col -mx-[8px] space-y-[2px]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg p-[8px] h-[64px]"
              >
                <div className="flex items-center gap-[16px] min-w-0 flex-1">
                  <div className="skeleton-shimmer h-[48px] w-[48px] shrink-0 rounded-md" />

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
        </div>
      </div>
    </div>
  );
}

const PlaylistPageSkeleton = memo(PlaylistPageSkeletonComponent);
export default PlaylistPageSkeleton;

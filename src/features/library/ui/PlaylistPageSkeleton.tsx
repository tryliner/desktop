import { memo } from "react";
import { EntityHeroSkeleton } from "@/shared/ui";

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
      className={`relative h-full w-full overflow-hidden bg-transparent select-none pt-(--page-inset-top) ${className}`}
    >
      <div className="relative z-10 flex flex-col gap-[20px] h-full w-full min-h-0 box-border">
        <div className="shrink-0 pl-[16px] pr-[12px] pt-[8px]">
          <EntityHeroSkeleton />
        </div>

        <div className="min-w-0 flex-1 min-h-0 overflow-hidden mx-[4px] mb-[8px] rounded-[14px] bg-border-alpha-14 overflow-hidden">
          <div className="flex flex-col">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md p-[8px] h-[64px]"
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

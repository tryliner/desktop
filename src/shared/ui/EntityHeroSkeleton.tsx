export function EntityHeroSkeleton() {
  return (
    <div className="flex w-full items-stretch gap-[22px]">
      <div className="relative h-[168px] w-[168px] shrink-0 overflow-hidden rounded-[10px] bg-border-alpha-14">
        <div className="skeleton-shimmer h-full w-full" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="skeleton-shimmer mt-[4px] h-[30px] w-[40%] rounded-[8px]" />
        <div className="skeleton-shimmer mt-[8px] h-[18px] w-[20%] rounded-[6px]" />
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

import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

export interface AccountCardProps {
  media?: ReactNode;
  placeholderIcon: ReactNode;
  title: string;
  titleAccessory?: ReactNode;
  subtitle?: string;
  loading?: boolean;
  action?: ReactNode;
}

export const accountCardActionClassName =
  "h-[30px] shrink-0 rounded-full border-0 px-[14px] text-body font-[500] transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60";

export default function AccountCard({
  media,
  placeholderIcon,
  title,
  titleAccessory,
  subtitle,
  loading = false,
  action,
}: AccountCardProps) {
  return (
    <div className="flex items-center gap-[12px] rounded-item bg-fill py-[10px] pl-[10px] pr-[12px]">
      <div className="relative size-[40px] shrink-0 overflow-hidden rounded-control bg-fill">
        {media ?? (
          <div
            className={cn(
              "flex size-full items-center justify-center text-text-tertiary",
              loading && "animate-pulse",
            )}
          >
            {!loading && placeholderIcon}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        {loading ? (
          <>
            <span className="h-[12px] w-[110px] animate-pulse rounded-full bg-fill-hover" />
            <span className="h-[10px] w-[160px] animate-pulse rounded-full bg-fill" />
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-[4px]">
              <span className="truncate text-label font-[600] text-text-primary">
                {title}
              </span>
              {titleAccessory}
            </div>
            {subtitle && (
              <span className="truncate text-caption text-text-tertiary">
                {subtitle}
              </span>
            )}
          </>
        )}
      </div>
      {action}
    </div>
  );
}

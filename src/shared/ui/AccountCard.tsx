import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

export interface AccountCardProps {
  media?: ReactNode;
  placeholderIcon: ReactNode;
  title: string;
  subtitle?: string;
  loading?: boolean;
  action?: ReactNode;
}

export const accountCardActionClassName =
  "h-[44px] shrink-0 rounded-[14px] px-[22px] text-[15px] font-[500] transition-colors disabled:cursor-default disabled:opacity-60";

export default function AccountCard({
  media,
  placeholderIcon,
  title,
  subtitle,
  loading = false,
  action,
}: AccountCardProps) {
  return (
    <div className="flex items-center gap-[16px] rounded-[16px] bg-black/[0.04] p-[14px] dark:bg-white/[0.08]">
      <div className="relative size-[64px] shrink-0 overflow-hidden rounded-[12px] bg-black/[0.06] dark:bg-white/[0.08]">
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
      <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
        {loading ? (
          <>
            <span className="h-[14px] w-[110px] animate-pulse rounded-full bg-black/[0.08] dark:bg-white/[0.1]" />
            <span className="h-[11px] w-[160px] animate-pulse rounded-full bg-black/[0.06] dark:bg-white/[0.07]" />
          </>
        ) : (
          <>
            <span className="truncate text-[16px] font-[600] text-text-primary">
              {title}
            </span>
            {subtitle && (
              <span className="truncate text-[13.5px] text-text-secondary">
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

import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

export const HERO_TITLE_CLASS =
  "font-roboto-flex-heading m-0 text-[30px] leading-[1.15] text-text-primary line-clamp-1";

export const HERO_SUBTITLE_CLASS =
  "m-0 text-[18px] font-[400] leading-[1.3] text-text-secondary line-clamp-1";

export const HERO_GLASS_CLASS = "bg-black/[0.05] dark:bg-white/[0.09]";

// same tint as the glass buttons, so chips and buttons read as one surface
export const HERO_CHIP_CLASS =
  "inline-flex h-[26px] items-center gap-[6px] rounded-[9px] px-[11px] text-[12px] font-[400] text-text-primary select-none bg-black/[0.05] dark:bg-white/[0.1]";

export const HERO_BUTTON_CLASS =
  "!h-[32px] !rounded-[9px] !border-0 !text-[14px] flex items-center justify-center gap-[7px] shrink-0";

export const HERO_GLASS_BUTTON_CLASS =
  "!border-transparent !bg-black/[0.05] dark:!bg-white/[0.1] hover:!bg-black/[0.09] dark:hover:!bg-white/[0.16]";

export interface EntityHeroProps {
  cover: ReactNode;
  coverClassName?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  trailingActions?: ReactNode;
  /** extra classes for the text column (e.g. `self-stretch` to match the cover height) */
  contentClassName?: string;
  /** extra classes for the actions row (e.g. `mt-auto` to pin it to the bottom) */
  actionsClassName?: string;
}

export function EntityHero({
  cover,
  coverClassName,
  title,
  subtitle,
  meta,
  actions,
  trailingActions,
  contentClassName,
  actionsClassName,
}: EntityHeroProps) {
  return (
    <section
      className="flex w-full min-w-0 items-start gap-[22px]"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
      data-no-window-drag
    >
      <div
        className={cn(
          "relative flex h-[168px] w-[168px] shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
          coverClassName || "bg-border-alpha-14",
        )}
      >
        {cover}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col pt-[2px]", contentClassName)}>
        <div className="min-w-0">{title}</div>
        {subtitle && <div className="mt-[4px] min-w-0">{subtitle}</div>}
        {meta && <div className="mt-[12px]">{meta}</div>}

        {(actions || trailingActions) && (
          <div
            className={cn(
              "mt-[26px] flex flex-wrap items-center justify-between gap-[12px]",
              actionsClassName,
            )}
          >
            <div className="flex items-center gap-[8px]">{actions}</div>
            <div className="flex items-center gap-[12px]">
              {trailingActions}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default EntityHero;

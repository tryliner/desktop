import { Fragment, type ReactNode } from "react";
import { cn } from "@/shared/lib";
import ScrollableText from "./ScrollableText";

export const HERO_TITLE_CLASS =
  "font-roboto-flex-heading m-0 text-[30px] leading-[1.15] text-text-primary line-clamp-1";

const HERO_SUBTITLE_TEXT =
  "m-0 text-heading font-[400] leading-[1.3] text-text-secondary";

export const HERO_SUBTITLE_CLASS = `${HERO_SUBTITLE_TEXT} line-clamp-1`;

export interface HeroSubtitleProps {
  text: string;
}

export function HeroSubtitle({ text }: HeroSubtitleProps) {
  return <ScrollableText text={text} className={HERO_SUBTITLE_TEXT} />;
}

export const HERO_GLASS_CLASS = "bg-black/[0.05] dark:bg-white/[0.09]";

export interface HeroMetaProps {
  items: ReactNode[];
}

/** One line of plain facts under the subtitle: "2019 · 12 tracks · 41 min". */
export function HeroMeta({ items }: HeroMetaProps) {
  const visible = items.filter(
    (item) =>
      item !== null && item !== undefined && item !== false && item !== "",
  );
  if (visible.length === 0) return null;
  return (
    <p className="m-0 flex min-w-0 flex-wrap items-center text-label font-[400] leading-[1.3] text-text-secondary select-none">
      {visible.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className="px-[6px]" aria-hidden>
              ·
            </span>
          )}
          <span>{item}</span>
        </Fragment>
      ))}
    </p>
  );
}

export const HERO_BUTTON_CLASS =
  "!h-[32px] !rounded-[9px] !border-0 !text-label flex items-center justify-center gap-[7px] shrink-0";

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
      className="flex w-full min-w-0 items-stretch gap-[22px]"
      data-no-window-drag
    >
      {/* 140px is the text column's natural height (title, subtitle, meta,
          16px + buttons), so pinning the buttons to the bottom adds no gap */}
      <div
        className={cn(
          "relative flex h-[140px] w-[140px] shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
          coverClassName || "bg-border-alpha-14",
        )}
      >
        {cover}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col", contentClassName)}>
        {/* the 30px title's line box starts 7px above its capitals in SF Pro,
            so this puts the cap top level with the cover's top edge */}
        <div className="-mt-[7px] min-w-0">{title}</div>
        {subtitle && <div className="mt-[4px] min-w-0">{subtitle}</div>}
        {meta && <div className="mt-[10px]">{meta}</div>}

        {(actions || trailingActions) && (
          <div
            className={cn(
              // pinned to the cover's bottom edge, at least 16px under the meta
              "mt-auto pt-[16px] flex flex-wrap items-center justify-between gap-[12px]",
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

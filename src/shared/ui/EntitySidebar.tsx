import type { ReactNode } from "react";
import { ArrowLeftLine } from "@mingcute/react";

export const SIDEBAR_TITLE_CLASS =
  "m-0 text-[22px] leading-[1.2] tracking-[-0.02em] text-text-primary line-clamp-2";

export const SIDEBAR_SUBTITLE_CLASS =
  "m-0 text-[13px] leading-[1.55] text-text-secondary line-clamp-3";

export interface EntitySidebarProps {
  cover: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  primaryAction?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

// Sticky metadata sidebar used next to the track list on
// playlist / album / collection pages. Flat, no shadows or glows.
// Subtitle is omitted entirely when missing so empty data
// doesn't leave a hole in the layout.
export function EntitySidebar({
  cover,
  title,
  subtitle,
  meta,
  primaryAction,
  actions,
  onBack,
  backLabel = "Back",
}: EntitySidebarProps) {
  return (
    <aside className="sticky top-[20px] w-[280px] shrink-0 self-start">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-[32px] cursor-pointer items-center gap-[6px] rounded-md border-0 bg-transparent px-[8px] ml-[-8px] text-[13px] font-[500] text-text-tertiary transition-colors hover:bg-border-alpha-14 hover:text-text-primary"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          <ArrowLeftLine size={16} />
          <span className="relative -left-[1.5px] top-[1px]">{backLabel}</span>
        </button>
      )}

      <div
        className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-border-alpha-14 ${
          onBack ? "mt-[16px]" : ""
        }`}
      >
        {cover}
      </div>

      <div
        className="mt-[16px] min-w-0"
        style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 600 }}
      >
        {title}
      </div>

      {subtitle && (
        <div
          className="mt-[6px]"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {subtitle}
        </div>
      )}

      {meta && (
        <div
          className="m-0 mt-[8px] text-[12px] leading-[1.4] text-text-tertiary"
          style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 400 }}
        >
          {meta}
        </div>
      )}

      {primaryAction && <div className="mt-[16px]">{primaryAction}</div>}

      {actions && (
        <div className="mt-[8px] flex items-center gap-[8px]">{actions}</div>
      )}
    </aside>
  );
}

export default EntitySidebar;

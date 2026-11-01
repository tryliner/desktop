import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/shared/lib";

/** Top-level glass container: dialogs, popovers, floating sheets. */
export const PANEL_GLASS_CLASS =
  "rounded-panel bg-surface-glass backdrop-blur-2xl backdrop-saturate-150";

/** Quiet inset block inside a surface: bio text, grouped rows, empty states. */
export const PANEL_FILL_CLASS = "rounded-item bg-fill";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "fill";
}

/**
 * The two surfaces everything sits on (see docs/DESIGN.md): glass for
 * containers, fill for blocks inside them. Spacing stays with the caller.
 */
export default function Panel({
  variant = "fill",
  className,
  ...rest
}: PanelProps) {
  return (
    <div
      className={cn(
        variant === "glass" ? PANEL_GLASS_CLASS : PANEL_FILL_CLASS,
        className,
      )}
      {...rest}
    />
  );
}

const LIST_PANEL_BLEED: CSSProperties = {
  marginBottom: "calc(var(--page-inset-bottom) * -1)",
  paddingBottom: "calc(var(--page-inset-bottom) + 16px)",
};

/**
 * Track list panel under an entity hero (playlist, album, saved, local,
 * cached). Runs under the floating mini player to the page bottom; the blur
 * is only there over the dark cover backdrop.
 */
export function ListPanel({
  className,
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-[4px] mt-[20px] shrink-0 grow overflow-hidden rounded-t-[14px] bg-fill-subtle px-[8px] pt-[8px] dark:backdrop-blur-xl",
        className,
      )}
      style={{ ...LIST_PANEL_BLEED, ...style }}
      {...rest}
    />
  );
}

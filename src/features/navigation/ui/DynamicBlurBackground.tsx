import { memo } from "react";
import PageCoverBackdrop from "./PageCoverBackdrop";
import { useActiveBackgroundCover } from "../hooks/useActiveBackgroundCover";

export interface DynamicBlurBackgroundProps {
  isDark?: boolean;
}

/**
 * Page-level blurred cover backdrop. Pages opt in via `usePageBackdrop`;
 * without one the canvas stays plain so nothing flashes while a page loads.
 */
export function DynamicBlurBackground({
  isDark = true,
}: DynamicBlurBackgroundProps) {
  const { effectiveCoverSrc, pageBackdropOptions } =
    useActiveBackgroundCover();

  if (!effectiveCoverSrc) return null;

  return (
    <PageCoverBackdrop
      coverSrc={effectiveCoverSrc}
      isDark={isDark}
      blur={pageBackdropOptions?.blur}
      dim={pageBackdropOptions?.dim}
    />
  );
}

export default memo(DynamicBlurBackground);

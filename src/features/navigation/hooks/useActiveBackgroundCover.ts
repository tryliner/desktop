import { useCoverSrc } from "@/features/covers";
import { usePageBackdropStore, type PageBackdropOptions } from "@/shared/lib";

export interface ActiveBackgroundCoverResult {
  rawCoverUrl?: string;
  effectiveCoverSrc?: string;
  isPageBackdrop: boolean;
  pageBackdropOptions?: PageBackdropOptions;
}

/**
 * Resolves the cover a page registered through `usePageBackdrop`. There is no
 * fallback: a page without a backdrop gets a plain canvas.
 */
export function useActiveBackgroundCover(): ActiveBackgroundCoverResult {
  const pageCoverUrl = usePageBackdropStore((s) => s.coverUrl);
  const pageBackdropOptions = usePageBackdropStore((s) => s.options);
  const effectiveCoverSrc = useCoverSrc(pageCoverUrl);

  return {
    rawCoverUrl: pageCoverUrl,
    effectiveCoverSrc,
    isPageBackdrop: Boolean(pageCoverUrl),
    pageBackdropOptions,
  };
}

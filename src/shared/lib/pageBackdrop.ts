import { useEffect } from "react";
import { create } from "zustand";

export interface PageBackdropOptions {
  /** blur radius in px (default 32) */
  blur?: number;
  /** extra darkening on top of the cover, 0..1 (default 0) */
  dim?: number;
}

interface PageBackdropState {
  coverUrl?: string;
  options?: PageBackdropOptions;
  setCoverUrl: (coverUrl?: string, options?: PageBackdropOptions) => void;
}

export const usePageBackdropStore = create<PageBackdropState>((set) => ({
  coverUrl: undefined,
  options: undefined,
  setCoverUrl: (coverUrl, options) => set({ coverUrl, options }),
}));

export function usePageBackdrop(
  coverUrl?: string,
  options?: PageBackdropOptions,
) {
  const blur = options?.blur;
  const dim = options?.dim;
  useEffect(() => {
    usePageBackdropStore
      .getState()
      .setCoverUrl(
        coverUrl,
        blur === undefined && dim === undefined ? undefined : { blur, dim },
      );
    return () => usePageBackdropStore.getState().setCoverUrl(undefined);
  }, [coverUrl, blur, dim]);
}

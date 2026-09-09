import AppImage, { type ImageProps } from "./AppImage";
import { useEffect, useState } from "react";
import { markCoverReady } from "../lib/coverArt";
import { prepareCoverFallback } from "../lib/coverSigner";

type CoverImageProps = Omit<ImageProps, "src" | "onError"> & {
  src: string;
};

// cover art renderer with automatic proxy fallback on direct cdn failure
export default function CoverImage({ src, onLoad, ...rest }: CoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (failedSrc !== src) return;
    let active = true;
    void prepareCoverFallback(src).then((resolved) => {
      if (active) setFallback(resolved);
    });
    return () => {
      active = false;
    };
  }, [src, failedSrc]);

  const currentSrc = failedSrc === src && fallback ? fallback : src;

  return (
    <AppImage
      {...rest}
      src={currentSrc}
      onLoad={(event) => {
        markCoverReady(src, currentSrc);
        onLoad?.(event);
      }}
      onError={() => setFailedSrc(src)}
    />
  );
}

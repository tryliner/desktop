import AppImage, { type ImageProps } from "./AppImage";
import { useEffect, useState, useRef } from "react";
import { markCoverReady, useCoverSrc } from "../lib/coverArt";
import { prepareCoverFallback } from "../lib/coverSigner";

type CoverImageProps = Omit<ImageProps, "src" | "onError"> & {
  src: string;
};

// cover art renderer with automatic proxy fallback on direct cdn failure and self-healing retries
export default function CoverImage({ src, onLoad, ...rest }: CoverImageProps) {
  const centralSrc = useCoverSrc(src);
  const [localFallback, setLocalFallback] = useState<string | undefined>(undefined);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalFallback(undefined);
    setRetryCount(0);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [src]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const effectiveSrc = localFallback || centralSrc || src;

  const handleError = () => {
    void prepareCoverFallback(src).then((resolved) => {
      if (resolved && resolved !== src) {
        setLocalFallback(resolved);
        return;
      }
      // If direct CDN had a transient network abort (e.g. during rapid skipping),
      // retry up to 2 times after brief debounce
      if (retryCount < 2) {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          setRetryCount((prev) => prev + 1);
        }, 250);
      }
    });
  };

  return (
    <AppImage
      {...rest}
      key={`${effectiveSrc}-${retryCount}`}
      src={effectiveSrc}
      onLoad={(event) => {
        markCoverReady(src, effectiveSrc, event.currentTarget);
        onLoad?.(event);
      }}
      onError={handleError}
    />
  );
}

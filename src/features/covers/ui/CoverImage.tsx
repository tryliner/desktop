import AppImage, { type ImageProps } from "./AppImage";
import { useEffect, useState, useRef } from "react";
import { markCoverReady, useCoverSrc } from "../lib/coverArt";
import { prepareCoverFallback } from "../lib/coverSigner";

type CoverImageProps = Omit<ImageProps, "src" | "onError"> & {
  src: string;
};

// cover art renderer with automatic proxy fallback on direct cdn failure and self-healing retries
export default function CoverImage({
  src,
  onLoad,
  crossOrigin = "anonymous",
  ...rest
}: CoverImageProps) {
  const centralSrc = useCoverSrc(src);
  const [localFallback, setLocalFallback] = useState<string | undefined>(undefined);
  const [retryCount, setRetryCount] = useState(0);
  const [corsMode, setCorsMode] = useState<ImageProps["crossOrigin"]>(crossOrigin || undefined);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalFallback(undefined);
    setRetryCount(0);
    setCorsMode(crossOrigin || undefined);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [src, crossOrigin]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const effectiveSrc = localFallback || centralSrc || src;

  const handleError = () => {
    // If CORS mode failed (e.g. file:// origin in Electron or CDN lacks CORS headers),
    // immediately fallback to standard no-cors mode so artwork is never blank
    if (corsMode === "anonymous") {
      setCorsMode(undefined);
      return;
    }

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
      key={`${effectiveSrc}-${corsMode ?? "nocors"}-${retryCount}`}
      src={effectiveSrc}
      crossOrigin={corsMode}
      onLoad={(event) => {
        markCoverReady(src, effectiveSrc, event.currentTarget);
        onLoad?.(event);
      }}
      onError={handleError}
    />
  );
}

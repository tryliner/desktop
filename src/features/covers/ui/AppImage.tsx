import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ImgHTMLAttributes,
  type SyntheticEvent,
  type CSSProperties,
} from "react";

export interface ImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "placeholder"> {
  src: string | { src: string };
  alt?: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  fallbackSrc?: string;
  unoptimized?: boolean;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  autoCropLetterbox?: boolean;
}

// high-performance image component: smooth fade-in, autocrop letterboxed thumbnails
export default function AppImage({
  src,
  alt = "",
  width,
  height,
  fill = false,
  priority = false,
  placeholder = "empty",
  blurDataURL,
  fallbackSrc,
  crossOrigin,
  autoCropLetterbox = true,
  className = "",
  style,
  onLoad,
  onError,
  draggable = false,
  ...rest
}: ImageProps) {
  const resolvedSrc = typeof src === "string" ? src : src?.src ?? "";
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLetterboxed, setIsLetterboxed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const checkLetterbox = useCallback(
    (img: HTMLImageElement) => {
      if (!autoCropLetterbox) {
        setIsLetterboxed(false);
        return;
      }
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const ratio = img.naturalWidth / img.naturalHeight;
        // Standard square artwork has ratio ≈ 1.0 (0.9 to 1.1).
        // YouTube letterboxed video thumbnails (e.g. 480x360 or 640x480) have ratio 1.333 (4:3)
        // with 16:9 content centered with black bars on top and bottom.
        // Any aspect ratio >= 1.2 is non-square and letterboxed in square containers.
        setIsLetterboxed(ratio >= 1.2);
      }
    },
    [autoCropLetterbox],
  );

  // Sync state if src prop changes
  useEffect(() => {
    setCurrentSrc(resolvedSrc);
    setIsLoaded(false);
    setHasError(false);
    setIsLetterboxed(false);
  }, [resolvedSrc]);

  // If already complete (e.g. from browser / service worker cache)
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      checkLetterbox(imgRef.current);
      setIsLoaded(true);
    }
  }, [currentSrc, checkLetterbox]);

  const handleLoad = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    checkLetterbox(e.currentTarget);
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    setHasError(true);
    onError?.(e);
  };

  const containerStyle: CSSProperties = fill
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
      }
    : {
        position: "relative",
        display: "inline-block",
        width: width ? (typeof width === "number" ? `${width}px` : width) : undefined,
        height: height ? (typeof height === "number" ? `${height}px` : height) : undefined,
      };

  const baseScale = isLetterboxed ? "scale(1.34)" : undefined;
  const combinedTransform = [baseScale, style?.transform].filter(Boolean).join(" ") || undefined;

  const imgStyle: CSSProperties = {
    width: fill ? "100%" : width ? (typeof width === "number" ? `${width}px` : width) : undefined,
    height: fill ? "100%" : height ? (typeof height === "number" ? `${height}px` : height) : undefined,
    opacity: isLoaded ? 1 : 0,
    transformOrigin: "center center",
    transition: style?.transition ?? "opacity 0.22s ease-in-out, filter 0.3s ease-out",
    ...style,
    ...(combinedTransform ? { transform: combinedTransform } : {}),
  };

  return (
    <div
      className={`relative overflow-hidden ${fill ? "w-full h-full" : ""}`}
      style={containerStyle}
    >
      {/* Placeholder / Skeleton layer */}
      {!isLoaded && !hasError && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-[#161616]"
        />
      )}

      {/* Actual Image */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        crossOrigin={crossOrigin}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={draggable}
        onLoad={handleLoad}
        onError={handleError}
        className={`${fill ? "absolute inset-0 w-full h-full object-cover" : "object-cover"} ${className}`}
        style={imgStyle}
        {...rest}
      />
    </div>
  );
}


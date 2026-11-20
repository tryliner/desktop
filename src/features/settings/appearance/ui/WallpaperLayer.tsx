import { memo, useEffect, useRef, useState } from "react";
import { measureImageTone } from "@/shared/lib/imageTone";
import { useAppearanceStore, wallpaperUrl } from "../appearanceStore";
import { blurredBackdrop } from "../backdropRender";
import { readableDim } from "../wallpaperCss";
import { cn } from "@/shared/lib";

function WallpaperLayer({ isDark, lite }: { isDark: boolean; lite: boolean }) {
  const key = useAppearanceStore((s) => s.wallpaperKey);
  const kind = useAppearanceStore((s) => s.wallpaperKind);
  const blur = useAppearanceStore((s) => s.blur);
  const saturation = useAppearanceStore((s) => s.saturation);
  const dim = useAppearanceStore((s) => s.dim);
  const readable = useAppearanceStore((s) => s.readable);
  const [src, setSrc] = useState<string | null>(null);
  const [luminance, setLuminance] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const url = key ? wallpaperUrl(key) : null;
  const effectiveBlur = lite ? 0 : blur;

  useEffect(() => {
    if (!url || kind !== "image") {
      setSrc(null);
      return;
    }
    let active = true;
    void blurredBackdrop(url, effectiveBlur, saturation).then((made) => {
      if (active) setSrc(made);
    });
    return () => {
      active = false;
    };
  }, [url, kind, effectiveBlur, saturation]);

  useEffect(() => {
    setLuminance(null);
    if (!url || kind !== "image") return;
    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (active) setLuminance(measureImageTone(img).luminance);
    };
    img.src = url;
    return () => {
      active = false;
    };
  }, [url, kind]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      if (document.hidden || lite) video.pause();
      else void video.play().catch(() => {});
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [url, kind, lite]);

  if (!url || !kind) return null;

  const guard =
    readable && luminance !== null ? readableDim(luminance, isDark) : 0;
  const videoGuard = readable && kind === "video" ? (isDark ? 0.35 : 0.4) : 0;
  const shade = Math.max(dim, guard, videoGuard);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      data-wallpaper-layer
    >
      {kind === "image" ? (
        src ? (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            className="wallpaper-fade-in absolute inset-0 h-full w-full select-none object-cover"
          />
        ) : null
      ) : (
        <video
          ref={videoRef}
          src={url}
          muted
          loop
          playsInline
          autoPlay={!lite}
          className="absolute h-full w-full object-cover"
          style={{
            inset: effectiveBlur ? -effectiveBlur * 2 : 0,
            width: effectiveBlur
              ? `calc(100% + ${effectiveBlur * 4}px)`
              : undefined,
            height: effectiveBlur
              ? `calc(100% + ${effectiveBlur * 4}px)`
              : undefined,
            filter:
              effectiveBlur || saturation !== 1
                ? `blur(${effectiveBlur}px) saturate(${saturation})`
                : undefined,
          }}
        />
      )}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          isDark ? "bg-black" : "bg-white",
        )}
        style={{ opacity: shade }}
      />
    </div>
  );
}

export default memo(WallpaperLayer);

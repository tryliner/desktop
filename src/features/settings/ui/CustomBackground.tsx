import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowActive } from "../hooks/useWindowActive";
import { loadBackgroundFile } from "../lib/backgroundFile";
import { useAppearanceStore } from "../store/appearanceStore";

export function useHasCustomBackground(): boolean {
  return useAppearanceStore((state) => state.backgroundVersion > 0);
}

function freezeFrame(image: HTMLImageElement, canvas: HTMLCanvasElement) {
  if (!image.complete || image.naturalWidth === 0) return false;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  return true;
}

export default function CustomBackground() {
  const version = useAppearanceStore((state) => state.backgroundVersion);
  const dim = useAppearanceStore((state) => state.backgroundDim);
  const blur = useAppearanceStore((state) => state.backgroundBlur);
  const active = useWindowActive();
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    if (version === 0) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    loadBackgroundFile()
      .then((file) => {
        if (cancelled || !file) return;
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [version]);

  useLayoutEffect(() => {
    if (active) {
      setFrozen(false);
      return;
    }
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (image && canvas && freezeFrame(image, canvas)) setFrozen(true);
  }, [active, url]);

  if (!url) return null;

  const mediaClass = "absolute inset-0 h-full w-full select-none object-cover";
  const mediaStyle =
    blur > 0
      ? { filter: `blur(${blur}px)`, transform: "scale(1.06)" }
      : undefined;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className={mediaClass}
        style={{ ...mediaStyle, visibility: frozen ? "visible" : "hidden" }}
      />
      {frozen ? null : (
        <img
          ref={imageRef}
          src={url}
          alt=""
          draggable={false}
          className={mediaClass}
          style={mediaStyle}
        />
      )}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: dim / 100 }}
      />
    </div>
  );
}

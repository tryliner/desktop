import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import {
  useCustomBackgroundStore,
  type BackgroundMediaKind,
} from "../store/customBackgroundStore";

export interface WallpaperBackgroundProps {
  /** false fades the wallpaper out (cover backdrop page, no file) */
  visible: boolean;
  /** stops gif / video playback, e.g. while the window is minimized */
  paused: boolean;
}

const FADE_MS = 380;

interface Layer {
  id: number;
  url: string;
  kind: BackgroundMediaKind;
  animatedImage: boolean;
}

let nextLayerId = 1;

const mediaClass =
  "absolute inset-0 h-full w-full object-cover select-none transform-gpu";

function WallpaperLayer({
  layer,
  frozen,
  loaded,
  style,
  onReady,
}: {
  layer: Layer;
  frozen: boolean;
  loaded: boolean;
  style: CSSProperties;
  onReady: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerStyle: CSSProperties = {
    ...style,
    opacity: loaded ? 1 : 0,
    transition: `opacity ${FADE_MS}ms ease-out`,
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (frozen) video.pause();
    else void video.play().catch(() => {});
  }, [frozen, loaded]);

  // an <img> gif can't be paused, so a frozen gif swaps to a still frame on a
  // canvas; chromium stops decoding the hidden <img> meanwhile
  const drawStill = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !img.naturalWidth) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
  };

  useEffect(() => {
    if (frozen && layer.animatedImage && loaded) drawStill();
  }, [frozen, layer.animatedImage, loaded]);

  if (layer.kind === "video") {
    return (
      <video
        ref={videoRef}
        src={layer.url}
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        onLoadedData={onReady}
        className={mediaClass}
        style={layerStyle}
      />
    );
  }

  const showStill = frozen && layer.animatedImage;
  return (
    <>
      <img
        ref={imgRef}
        src={layer.url}
        alt=""
        draggable={false}
        decoding="async"
        onLoad={() => {
          if (showStill) drawStill();
          onReady();
        }}
        className={mediaClass}
        style={{ ...layerStyle, display: showStill ? "none" : undefined }}
      />
      {layer.animatedImage ? (
        <canvas
          ref={canvasRef}
          className={mediaClass}
          style={{ ...layerStyle, display: showStill ? undefined : "none" }}
        />
      ) : null}
    </>
  );
}

/**
 * The user's custom wallpaper behind the app shell. A new file crossfades in
 * over the previous one; removing it fades the whole layer out.
 */
function WallpaperBackgroundComponent({
  visible,
  paused,
}: WallpaperBackgroundProps) {
  const mediaUrl = useCustomBackgroundStore((s) => s.mediaUrl);
  const media = useCustomBackgroundStore((s) => s.media);
  const blur = useCustomBackgroundStore((s) => s.blur);
  const dim = useCustomBackgroundStore((s) => s.dim);
  const loadMedia = useCustomBackgroundStore((s) => s.loadMedia);
  const reducedMotion = useReducedMotion() ?? false;

  const [layers, setLayers] = useState<Layer[]>([]);
  const [loadedIds, setLoadedIds] = useState<Set<number>>(() => new Set());
  const cleanupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    if (!mediaUrl || !media) {
      // let the container fade before the last layer goes away
      const timer = window.setTimeout(() => {
        setLayers([]);
        setLoadedIds(new Set());
      }, FADE_MS + 60);
      return () => window.clearTimeout(timer);
    }
    setLayers((prev) => {
      if (prev[prev.length - 1]?.url === mediaUrl) return prev;
      return [
        ...prev.slice(-1),
        {
          id: nextLayerId++,
          url: mediaUrl,
          kind: media.kind,
          animatedImage: media.type === "image/gif",
        },
      ];
    });
  }, [mediaUrl, media]);

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) window.clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  const handleReady = (layer: Layer) => {
    setLoadedIds((prev) => {
      if (prev.has(layer.id)) return prev;
      const next = new Set(prev);
      next.add(layer.id);
      return next;
    });
    if (layers[layers.length - 1]?.id !== layer.id) return;
    // the old layer stays opaque underneath until the new one has faded in
    if (cleanupTimerRef.current) window.clearTimeout(cleanupTimerRef.current);
    cleanupTimerRef.current = window.setTimeout(() => {
      cleanupTimerRef.current = null;
      // a file picked during the fade is newer and has to survive
      setLayers((prev) => prev.filter((l) => l.id >= layer.id));
      setLoadedIds((prev) => new Set([...prev].filter((id) => id >= layer.id)));
    }, FADE_MS + 60);
  };

  if (layers.length === 0) return null;

  const shown =
    visible && Boolean(mediaUrl) && layers.some((l) => loadedIds.has(l.id));
  const mediaStyle: CSSProperties =
    blur > 0
      ? {
          filter: `blur(${blur}px)`,
          // hides the soft transparent edge blur leaves behind
          transform: `scale(${1 + blur * 0.004}) translateZ(0)`,
        }
      : {};

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] select-none"
      style={{
        opacity: shown ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
      aria-hidden="true"
    >
      {layers.map((layer) => (
        <WallpaperLayer
          key={layer.id}
          layer={layer}
          frozen={paused || !visible || reducedMotion}
          loaded={loadedIds.has(layer.id)}
          style={mediaStyle}
          onReady={() => handleReady(layer)}
        />
      ))}
      {dim > 0 ? (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: dim / 100 }}
        />
      ) : null}
    </div>
  );
}

export const WallpaperBackground = memo(WallpaperBackgroundComponent);
export default WallpaperBackground;

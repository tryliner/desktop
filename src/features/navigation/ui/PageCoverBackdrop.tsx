import { memo, useEffect, useRef, useState } from "react";

export interface PageCoverBackdropProps {
  coverSrc: string;
  isDark?: boolean;
  /** blur radius in px */
  blur?: number;
  /** extra darkening on top of the cover, 0..1 */
  dim?: number;
}

const FILL_DARKEN = 0.38;
const FADE_MS = 380;

const COVER_FADE =
  "linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.9) 45%, rgba(0, 0, 0, 0) 100%)";

function sampleBottomColor(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !img.naturalWidth || !img.naturalHeight) return null;
  const stripHeight = Math.max(1, img.naturalHeight * 0.08);
  try {
    ctx.drawImage(
      img,
      0,
      img.naturalHeight - stripHeight,
      img.naturalWidth,
      stripHeight,
      0,
      0,
      16,
      1,
    );
    const data = ctx.getImageData(0, 0, 16, 1).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = data.length / 4;
    const tone = (v: number) => Math.round((v / n) * FILL_DARKEN);
    return `${tone(r)}, ${tone(g)}, ${tone(b)}`;
  } catch {
    return null;
  }
}

interface Layer {
  id: number;
  src: string;
}

let nextLayerId = 1;

/**
 * Blurred cover behind a page. Cover changes crossfade: the previous image
 * stays underneath until the new one has loaded and faded in on top.
 */
function PageCoverBackdropComponent({
  coverSrc,
  isDark = true,
  blur = 32,
  dim = 0,
}: PageCoverBackdropProps) {
  const [layers, setLayers] = useState<Layer[]>(() => [
    { id: nextLayerId++, src: coverSrc },
  ]);
  const [loadedIds, setLoadedIds] = useState<Set<number>>(() => new Set());
  // id of the layer that is currently shown; everything else fades out
  const [visibleId, setVisibleId] = useState<number | null>(null);
  const [bottomRgb, setBottomRgb] = useState<string | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const opacity = isDark ? 0.6 : 0.45;

  // a new cover pushes a layer on top; at most two layers live at once
  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.src === coverSrc) return prev;
      return [...prev.slice(-1), { id: nextLayerId++, src: coverSrc }];
    });
  }, [coverSrc]);

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) window.clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  const handleLoad = (layer: Layer, img: HTMLImageElement) => {
    setLoadedIds((prev) => {
      if (prev.has(layer.id)) return prev;
      const next = new Set(prev);
      next.add(layer.id);
      return next;
    });
    const isTop = layers[layers.length - 1]?.id === layer.id;
    if (!isTop) return;
    setBottomRgb(sampleBottomColor(img));
    // the new layer fades in while the previous one fades out at the same time,
    // so the combined density stays level; the old layer is dropped only after
    // its opacity transition has finished and it is already invisible
    setVisibleId(layer.id);
    if (cleanupTimerRef.current) window.clearTimeout(cleanupTimerRef.current);
    cleanupTimerRef.current = window.setTimeout(() => {
      cleanupTimerRef.current = null;
      setLayers((prev) => prev.filter((l) => l.id === layer.id));
      setLoadedIds((prev) => {
        const next = new Set<number>();
        if (prev.has(layer.id)) next.add(layer.id);
        return next;
      });
    }, FADE_MS + 60);
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[12px] select-none ease-out"
      style={{
        backgroundColor: bottomRgb
          ? `rgba(${bottomRgb}, ${isDark ? 0.9 : 0.35})`
          : undefined,
        transition: `background-color ${FADE_MS}ms ease-out`,
      }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-x-0 top-0 h-[50%] overflow-hidden"
        style={{ maskImage: COVER_FADE, WebkitMaskImage: COVER_FADE }}
      >
        {layers.map((layer) => (
          <img
            key={layer.id}
            src={layer.src}
            alt=""
            crossOrigin="anonymous"
            draggable={false}
            decoding="async"
            onLoad={(e) => handleLoad(layer, e.currentTarget)}
            className="absolute inset-0 h-full w-full object-cover select-none transform-gpu ease-out"
            style={{
              filter: `blur(${blur}px) saturate(130%)`,
              transform: "scale(1.1) translateZ(0)",
              opacity:
                loadedIds.has(layer.id) &&
                (visibleId === null || visibleId === layer.id)
                  ? opacity
                  : 0,
              transition: `opacity ${FADE_MS}ms ease-out`,
            }}
          />
        ))}
        {isDark && dim > 0 && (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0, 0, 0, ${dim})` }}
          />
        )}
      </div>
      {!isDark && <div className="absolute inset-0 bg-bg-surface/75" />}
    </div>
  );
}

export const PageCoverBackdrop = memo(PageCoverBackdropComponent);
export default PageCoverBackdrop;

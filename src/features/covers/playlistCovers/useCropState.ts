import { useCallback, useState } from "react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampOffset,
  zoomAround,
  type Point,
  type Size,
} from "./coverCrop";

export const VIEWPORT = 280;
export const CENTER: Point = { x: VIEWPORT / 2, y: VIEWPORT / 2 };

const LOG_RANGE = Math.log(MAX_ZOOM / MIN_ZOOM);
export const zoomToSlider = (zoom: number) =>
  Math.log(zoom / MIN_ZOOM) / LOG_RANGE;
export const sliderToZoom = (value: number) =>
  MIN_ZOOM * Math.exp(value * LOG_RANGE);

export function useCropState(size: Size | null) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const zoomAt = useCallback(
    (nextZoom: number, anchor: Point) => {
      if (!size) return;
      const next = zoomAround(size, VIEWPORT, zoom, offset, nextZoom, anchor);
      setZoom(next.zoom);
      setOffset(next.offset);
    },
    [size, zoom, offset],
  );

  const moveTo = useCallback(
    (next: Point) => {
      if (size) setOffset(clampOffset(size, VIEWPORT, zoom, next));
    },
    [size, zoom],
  );

  const reset = useCallback(() => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  }, []);

  return {
    zoom,
    offset,
    zoomAt,
    moveTo,
    reset,
    changed: zoom > MIN_ZOOM + 0.001 || offset.x !== 0 || offset.y !== 0,
  };
}

export type CropState = ReturnType<typeof useCropState>;

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const COVER_OUTPUT_SIZE = 1200;
export const COVER_QUALITY = 0.9;
export const MAX_ANIMATED_BYTES = 4 * 1024 * 1024;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function displayScale(image: Size, viewport: number, zoom: number): number {
  return (viewport / Math.min(image.width, image.height)) * clampZoom(zoom);
}

export function clampOffset(
  image: Size,
  viewport: number,
  zoom: number,
  offset: Point,
): Point {
  const scale = displayScale(image, viewport, zoom);
  const maxX = Math.max(0, (image.width * scale - viewport) / 2);
  const maxY = Math.max(0, (image.height * scale - viewport) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

export function cropRect(
  image: Size,
  viewport: number,
  zoom: number,
  offset: Point,
): { x: number; y: number; size: number } {
  const scale = displayScale(image, viewport, zoom);
  const safe = clampOffset(image, viewport, zoom, offset);
  const size = Math.min(viewport / scale, image.width, image.height);
  const centerX = image.width / 2 - safe.x / scale;
  const centerY = image.height / 2 - safe.y / scale;
  const x = Math.min(image.width - size, Math.max(0, centerX - size / 2));
  const y = Math.min(image.height - size, Math.max(0, centerY - size / 2));
  return { x, y, size };
}

export function zoomAround(
  image: Size,
  viewport: number,
  zoom: number,
  offset: Point,
  nextZoom: number,
  anchor: Point,
): { zoom: number; offset: Point } {
  const from = clampZoom(zoom);
  const to = clampZoom(nextZoom);
  const ratio = to / from;
  const ax = anchor.x - viewport / 2;
  const ay = anchor.y - viewport / 2;
  const next = {
    x: ax - (ax - offset.x) * ratio,
    y: ay - (ay - offset.y) * ratio,
  };
  return { zoom: to, offset: clampOffset(image, viewport, to, next) };
}

export async function renderCroppedCover(
  source: CanvasImageSource,
  image: Size,
  viewport: number,
  zoom: number,
  offset: Point,
  outputSize = COVER_OUTPUT_SIZE,
): Promise<Blob> {
  const rect = cropRect(image, viewport, zoom, offset);
  const size = Math.round(Math.min(outputSize, rect.size));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, rect.x, rect.y, rect.size, rect.size, 0, 0, size, size);
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, COVER_QUALITY),
    );
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("could not encode cover");
  return jpeg;
}

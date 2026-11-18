/**
 * Square crop maths for the cover editor. The image is drawn so its shorter
 * side fills the square viewport at zoom 1; `offset` is how far (in viewport
 * px) the image centre sits from the viewport centre. Everything is kept so
 * the image always covers the square: no empty corners in the result.
 */

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
/** animated gif/webp can't be re-encoded on a canvas, so they're kept as is */
export const MAX_ANIMATED_BYTES = 8 * 1024 * 1024;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function displayScale(image: Size, viewport: number, zoom: number): number {
  return (viewport / Math.min(image.width, image.height)) * clampZoom(zoom);
}

/** keeps the offset inside the range where the image still covers the square */
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

/** the square of the source image (in its own pixels) that ends up visible */
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

/**
 * Zooms around a point of the viewport (the cursor), so what's under the
 * pointer stays under it, like every image editor.
 */
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
  // anchor relative to the viewport centre
  const ax = anchor.x - viewport / 2;
  const ay = anchor.y - viewport / 2;
  const next = {
    x: ax - (ax - offset.x) * ratio,
    y: ay - (ay - offset.y) * ratio,
  };
  return { zoom: to, offset: clampOffset(image, viewport, to, next) };
}

/** GIF with more than one frame, or WebP with an ANIM chunk */
export function isAnimatedImage(bytes: Uint8Array): boolean {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (ascii(0, 3) === "GIF") {
    // count image descriptors (0x2C) that follow a graphic control block
    let frames = 0;
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
        frames++;
        if (frames > 1) return true;
      }
    }
    return false;
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    for (let i = 12; i <= Math.min(bytes.length - 4, 4096); i++) {
      if (ascii(i, 4) === "ANIM") return true;
    }
  }
  return false;
}

/** draws the crop into a square canvas and encodes it (WebP, JPEG fallback) */
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

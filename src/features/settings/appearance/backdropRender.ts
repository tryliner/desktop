/**
 * Blurring a full-window picture with CSS `filter` costs GPU time on every
 * frame something moves above it. Instead the blur is baked once into a
 * small image (blur hides the lost resolution) and that is what's shown.
 */

const cache = new Map<string, Promise<string>>();
const MAX_CACHED = 4;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** blur in px as seen at full size -> canvas scale; more blur, smaller canvas */
export function renderScale(blur: number): number {
  if (blur <= 2) return 1;
  return Math.max(0.12, Math.min(1, 6 / blur));
}

async function render(
  url: string,
  blur: number,
  saturation: number,
  targetWidth: number,
): Promise<string> {
  const img = await loadImage(url);
  const scale = renderScale(blur);
  const width = Math.max(
    64,
    Math.round(Math.min(img.naturalWidth, targetWidth) * scale),
  );
  const height = Math.max(
    64,
    Math.round(width * (img.naturalHeight / img.naturalWidth)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return url;
  const blurPx = blur * (width / Math.min(img.naturalWidth, targetWidth));
  ctx.filter = `blur(${blurPx.toFixed(2)}px) saturate(${saturation})`;
  // draw past the edges so the blur doesn't fade the borders to transparent
  const pad = blurPx * 2;
  ctx.drawImage(img, -pad, -pad, width + pad * 2, height + pad * 2);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  return blob ? URL.createObjectURL(blob) : url;
}

export function blurredBackdrop(
  url: string,
  blur: number,
  saturation: number,
  targetWidth = typeof window !== "undefined"
    ? window.innerWidth * (window.devicePixelRatio || 1)
    : 1920,
): Promise<string> {
  const width = Math.min(3840, Math.round(targetWidth / 256) * 256 || 1920);
  const id = `${url}|${Math.round(blur)}|${saturation.toFixed(2)}|${width}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const job = render(url, blur, saturation, width).catch(() => url);
  cache.set(id, job);
  while (cache.size > MAX_CACHED) {
    const [oldest, promise] = cache.entries().next().value!;
    cache.delete(oldest);
    void promise.then((made) => {
      if (made.startsWith("blob:")) URL.revokeObjectURL(made);
    });
  }
  return job;
}

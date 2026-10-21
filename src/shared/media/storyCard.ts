// Builds a vertical "story" picture (1080x1920) for a track: cover, title and artists on a
// background tinted with the cover's colours. Works fully in the browser with a canvas.

const WIDTH = 1080;
const HEIGHT = 1920;
const COVER_SIZE = 840;
const COVER_X = (WIDTH - COVER_SIZE) / 2;
const COVER_Y = 400;
const TEXT_X = 120;
const TEXT_WIDTH = WIDTH - TEXT_X * 2;
const FONT = '"Inter", "SF Pro Display", "Segoe UI", system-ui, -apple-system, sans-serif';

export interface StoryTrack {
  title: string;
  artists: string;
  coverUrl?: string;
  fallbackCoverUrl?: string;
}

// fetch + createImageBitmap gives a picture that does not taint the canvas, so toBlob keeps working.
// If the cover host does not allow cross-origin reads, null is returned and the card is drawn without it.
async function loadBitmap(url: string | undefined): Promise<ImageBitmap | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    return await createImageBitmap(await response.blob());
  } catch {
    return null;
  }
}

function averageColor(bitmap: ImageBitmap): [number, number, number] {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [60, 60, 80];
  ctx.drawImage(bitmap, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = size * size;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return [Math.round(r / pixels), Math.round(g / pixels), Math.round(b / pixels)];
}

function mix([r, g, b]: [number, number, number], amount: number): string {
  // amount 0 = original colour, 1 = black
  const k = 1 - amount;
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = words[i];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);

  const usedAll = lines.join(" ").split(/\s+/).length >= words.length;
  const result = lines.slice(0, maxLines);
  if (!usedAll || result.some((line) => ctx.measureText(line).width > maxWidth)) {
    let last = result[result.length - 1] ?? "";
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    result[result.length - 1] = `${last.trimEnd()}…`;
  }
  return result;
}

export async function createStoryBlob(track: StoryTrack): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const bitmap = (await loadBitmap(track.coverUrl)) ?? (await loadBitmap(track.fallbackCoverUrl));
  const tint: [number, number, number] = bitmap ? averageColor(bitmap) : [70, 60, 110];

  // background: a gradient of the cover colour fading to almost black
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, mix(tint, 0.35));
  gradient.addColorStop(1, mix(tint, 0.85));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // soft blurred copy of the cover behind everything
  if (bitmap) {
    try {
      ctx.save();
      ctx.filter = "blur(70px)";
      ctx.globalAlpha = 0.45;
      const scale = HEIGHT / bitmap.height;
      const w = bitmap.width * scale;
      ctx.drawImage(bitmap, (WIDTH - w) / 2, 0, w, HEIGHT);
      ctx.restore();
    } catch {
      // blur is only decoration
    }
  }

  // cover with a rounded shadowed frame
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  roundedRect(ctx, COVER_X, COVER_Y, COVER_SIZE, COVER_SIZE, 36);
  ctx.fillStyle = mix(tint, 0.5);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(ctx, COVER_X, COVER_Y, COVER_SIZE, COVER_SIZE, 36);
  ctx.clip();
  if (bitmap) {
    // centre-crop to a square
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      COVER_X,
      COVER_Y,
      COVER_SIZE,
      COVER_SIZE,
    );
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(COVER_X, COVER_Y, COVER_SIZE, COVER_SIZE);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = `700 360px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♪", WIDTH / 2, COVER_Y + COVER_SIZE / 2);
  }
  ctx.restore();

  // title and artists
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 68px ${FONT}`;
  const titleLines = wrapLines(ctx, track.title, TEXT_WIDTH, 2);
  let y = COVER_Y + COVER_SIZE + 130;
  for (const line of titleLines) {
    ctx.fillText(line, TEXT_X, y);
    y += 82;
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = `500 46px ${FONT}`;
  const [artistLine] = wrapLines(ctx, track.artists, TEXT_WIDTH, 1);
  ctx.fillText(artistLine ?? "", TEXT_X, y + 10);

  // footer
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = `600 34px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Listening on Liner", WIDTH / 2, HEIGHT - 120);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image"))), "image/png");
  });
}

function fileNameFor(track: StoryTrack): string {
  const base = `${track.artists} - ${track.title}`.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80);
  return `liner-story-${base || "track"}.png`;
}

/** creates the picture, saves it as a PNG and copies it to the clipboard when the browser allows it */
export async function shareTrackAsStory(track: StoryTrack): Promise<{ copied: boolean }> {
  const blob = await createStoryBlob(track);

  let copied = false;
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copied = true;
    }
  } catch {
    // saving the file still works
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileNameFor(track);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return { copied };
}

import type { TokenHighlight } from "./timing";
import type { PlacedToken } from "./types";

export interface TokenPaint {
  ctx: CanvasRenderingContext2D;
  top: number;
  rtl: boolean;
  base: number;
  remPx: number;
  dpr: number;
  color?: string;
}

export function white(alpha: number, color = "#ffffff"): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  const [, red = "ff", green = "ff", blue = "ff"] = match ?? [];
  return `rgba(${parseInt(red, 16)}, ${parseInt(green, 16)}, ${parseInt(blue, 16)}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function highlightStyle(
  paint: TokenPaint,
  placed: PlacedToken,
  highlight: TokenHighlight,
): string | CanvasGradient {
  if (highlight.solid >= 1) return white(highlight.opacity, paint.color);
  const width = Math.max(1, placed.width);
  const start = paint.rtl ? placed.x + width : placed.x;
  const end = paint.rtl ? placed.x : placed.x + width;
  const y = paint.top + placed.baseline;
  const gradient = paint.ctx.createLinearGradient(start, y, end, y);
  const solid = highlight.solid;
  const clear = highlight.clear + 1 / width;
  const alphaAt = (offset: number) =>
    highlight.opacity *
    Math.max(0, Math.min(1, (clear - offset) / Math.max(1e-6, clear - solid)));
  gradient.addColorStop(0, white(alphaAt(0), paint.color));
  if (solid > 0 && solid < 1)
    gradient.addColorStop(solid, white(alphaAt(solid), paint.color));
  if (clear > 0 && clear < 1) gradient.addColorStop(clear, white(0, paint.color));
  gradient.addColorStop(1, white(alphaAt(1), paint.color));
  return gradient;
}

export function drawToken(
  paint: TokenPaint,
  placed: PlacedToken,
  highlight: TokenHighlight | null,
) {
  const { ctx } = paint;
  const y = Math.round((paint.top + placed.baseline) * paint.dpr) / paint.dpr;
  const text = placed.token.text;
  ctx.fillStyle = white(paint.base, paint.color);
  ctx.fillText(text, placed.x, y);
  if (!highlight || highlight.opacity <= 0) return;
  if (highlight.clear <= 0) return;
  ctx.fillStyle = highlightStyle(paint, placed, highlight);
  if (highlight.glowRem > 0) {
    ctx.save();
    ctx.shadowColor = white(1, paint.color);
    ctx.shadowBlur = highlight.glowRem * paint.remPx * paint.dpr;
    ctx.fillText(text, placed.x, y);
    ctx.restore();
    return;
  }
  ctx.fillText(text, placed.x, y);
}

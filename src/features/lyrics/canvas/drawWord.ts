import type { TokenHighlight } from "./timing";
import type { PlacedToken } from "./types";

export interface TokenPaint {
  ctx: CanvasRenderingContext2D;
  top: number;
  rtl: boolean;
  base: number;
  remPx: number;
  dpr: number;
}

export function white(alpha: number): string {
  return `rgba(255, 255, 255, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function highlightStyle(
  paint: TokenPaint,
  placed: PlacedToken,
  highlight: TokenHighlight,
): string | CanvasGradient {
  if (highlight.solid >= 1) return white(highlight.opacity);
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
  gradient.addColorStop(0, white(alphaAt(0)));
  if (solid > 0 && solid < 1)
    gradient.addColorStop(solid, white(alphaAt(solid)));
  if (clear > 0 && clear < 1) gradient.addColorStop(clear, white(0));
  gradient.addColorStop(1, white(alphaAt(1)));
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

  const scale = highlight?.scale ?? 1;
  const dy = highlight?.dy ?? 0;
  const hasTransform =
    Boolean(highlight) &&
    (Math.abs(scale - 1) > 0.003 || Math.abs(dy) > 0.1);

  if (hasTransform) {
    ctx.save();
    const cx = placed.x + placed.width / 2;
    const cy = y - paint.remPx * 0.6;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(0, dy);
    ctx.translate(-cx, -cy);
  }

  ctx.fillStyle = white(paint.base);
  ctx.fillText(text, placed.x, y);

  if (highlight && highlight.opacity > 0 && highlight.clear > 0) {
    ctx.fillStyle = highlightStyle(paint, placed, highlight);
    if (highlight.glowRem > 0) {
      ctx.save();
      ctx.shadowColor = white(1);
      ctx.shadowBlur = highlight.glowRem * paint.remPx * paint.dpr;
      ctx.fillText(text, placed.x, y);
      ctx.restore();
    } else {
      ctx.fillText(text, placed.x, y);
    }
  }

  if (hasTransform) {
    ctx.restore();
  }
}

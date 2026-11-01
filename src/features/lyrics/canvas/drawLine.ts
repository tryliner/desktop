import { drawToken, white } from "./drawWord";
import { backgroundFont, mainFont, subtitleFont } from "./fonts";
import { tokenHighlight } from "./timing";
import type { LineLayout, LyricsTypography } from "./types";

const INACTIVE_ALPHA = 0.3;
const BACKGROUND_ALPHA = INACTIVE_ALPHA * 0.78;
const SUBTITLE_ALPHA = 0.6;
const REM_PX = 16;

export function drawLine(
  ctx: CanvasRenderingContext2D,
  layout: LineLayout,
  top: number,
  timeMs: number,
  type: LyricsTypography,
  dpr: number,
  now: number,
) {
  const { line } = layout;
  ctx.direction = line.rtl ? "rtl" : "ltr";
  let current = "";
  for (const placed of layout.tokens) {
    const background = placed.token.background;
    const font = background ? backgroundFont(type) : mainFont(type);
    if (font !== current) {
      current = font;
      ctx.font = font;
    }
    drawToken(
      {
        ctx,
        top,
        rtl: line.rtl,
        base: background ? BACKGROUND_ALPHA : INACTIVE_ALPHA,
        remPx: REM_PX,
        dpr,
      },
      placed,
      tokenHighlight(placed.token, line, timeMs, now),
    );
  }
  if (layout.subtitle.length === 0) return;
  ctx.font = subtitleFont(type);
  ctx.fillStyle = white(SUBTITLE_ALPHA);
  for (const text of layout.subtitle) {
    ctx.fillText(
      text.text,
      text.x,
      Math.round((top + text.baseline) * dpr) / dpr,
    );
  }
}

export const APP_ICON_SIZE = 512;
// Leave the same 32 px transparent edge as the packaged macOS icon.
const ICON_SAFE_AREA_INSET = 32;
const ICON_CONTENT_SIZE = APP_ICON_SIZE - ICON_SAFE_AREA_INSET * 2;
const ICON_CONTENT_SCALE = ICON_CONTENT_SIZE / APP_ICON_SIZE;

function fitCoordinate(value: number): number {
  return ICON_SAFE_AREA_INSET + value * ICON_CONTENT_SCALE;
}

export function drawAppIconArtwork(
  ctx: CanvasRenderingContext2D,
  logoImage: CanvasImageSource,
  isLight: boolean,
) {
  const inset = ICON_SAFE_AREA_INSET;
  const contentSize = ICON_CONTENT_SIZE;
  const contentRadius = 112 * ICON_CONTENT_SCALE;

  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(inset, inset, contentSize, contentSize, contentRadius);
  } else {
    ctx.rect(inset, inset, contentSize, contentSize);
  }
  ctx.fillStyle = isLight ? "#f5f5f7" : "#0d0d10";
  ctx.fill();

  ctx.lineWidth = 2 * ICON_CONTENT_SCALE;
  ctx.strokeStyle = isLight
    ? "rgba(0, 0, 0, 0.08)"
    : "rgba(255, 255, 255, 0.08)";
  ctx.stroke();

  if (isLight) {
    ctx.filter = "invert(1)";
  }

  ctx.drawImage(
    logoImage,
    fitCoordinate(112),
    fitCoordinate(144),
    288 * ICON_CONTENT_SCALE,
    224 * ICON_CONTENT_SCALE,
  );
  ctx.restore();
}

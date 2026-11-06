import { BITMAP_PAD } from "./lineBitmaps";
import type { LiveLayer, LivePiece } from "./liveLayer";
import {
  lineBitmap,
  visibleLines,
  type SceneFrame,
  type VisibleLine,
} from "./sceneLines";

export type { SceneFrame } from "./sceneLines";

export interface SceneResult {
  animating: boolean;
  fading: boolean;
  signature: string;
}

function canSplit(frame: SceneFrame, lines: VisibleLine[]): boolean {
  if (frame.fog.isMoving(frame.now)) return false;
  if (lines.some((line) => line.moving)) return false;
  const { top, bottom } = frame.fog.insets(frame.scene.height, frame.now);
  const limit = frame.scene.height - bottom;
  return lines
    .filter((line) => line.live)
    .every(
      (line) =>
        line.top - BITMAP_PAD >= top &&
        line.top + line.layout.height + BITMAP_PAD <= limit,
    );
}

function paintBase(frame: SceneFrame, lines: VisibleLine[]) {
  const { ctx, scene, dpr, now } = frame;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.imageSmoothingEnabled = true;
  for (const line of lines) {
    const bitmap = lineBitmap(frame, line);
    if (!bitmap) continue;
    ctx.drawImage(
      bitmap,
      0,
      line.top - BITMAP_PAD,
      bitmap.width / dpr,
      bitmap.height / dpr,
    );
  }
  frame.fog.draw(ctx, scene.width, scene.height, now);
}

export function drawScene(
  frame: SceneFrame,
  previous: string,
  live: LiveLayer,
): SceneResult {
  const lines = visibleLines(frame);
  const animating = lines.some((line) => line.live);
  const fading = lines.some((line) => line.fading);
  const split = canSplit(frame, lines);
  const baseLines = split ? lines.filter((line) => !line.live) : lines;
  const signature =
    (split ? "split|" : "full|") +
    baseLines
      .map((line) => `${line.index}@${line.top.toFixed(2)}#${line.key}`)
      .join("|");
  frame.bitmaps.begin();
  for (const line of lines) frame.bitmaps.keep(line.index);
  if (signature !== previous || frame.fog.isMoving(frame.now)) {
    paintBase(frame, baseLines);
  }
  if (split) {
    const pieces: LivePiece[] = [];
    for (const line of lines.filter((entry) => entry.live)) {
      const bitmap = lineBitmap(frame, line);
      if (bitmap) {
        pieces.push({ bitmap, top: line.top, height: line.layout.height });
      }
    }
    live.draw(pieces, frame.scene.width, frame.dpr);
  } else {
    live.hide();
  }
  frame.bitmaps.end();
  return { animating, fading, signature };
}

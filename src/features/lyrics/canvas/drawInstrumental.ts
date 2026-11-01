import {
  NOTE_VIEWBOX,
  note,
  waveClip,
  waveFlattenEasing,
} from "./instrumentalNote";
import { instrumentalState } from "./instrumentalTiming";
import type { LineLayout, LyricsTypography } from "./types";
import { white } from "./drawWord";

const INACTIVE_ALPHA = 0.3;
const GLOW_SIGMA = 5;
const GLOW_ALPHA = 0.6;
const GLOW_PAD = 3;

export interface InstrumentalFrame {
  left: number;
  width: number;
}

let scratch: HTMLCanvasElement | null = null;

function scratchCanvas(size: number): CanvasRenderingContext2D | null {
  scratch ??= document.createElement("canvas");
  if (scratch.width !== size || scratch.height !== size) {
    scratch.width = size;
    scratch.height = size;
  }
  const ctx = scratch.getContext("2d");
  ctx?.setTransform(1, 0, 0, 1, 0, 0);
  ctx?.clearRect(0, 0, size, size);
  return ctx;
}

function noteLeft(layout: LineLayout, size: number, frame: InstrumentalFrame) {
  const box = (size * 4) / 3;
  const inset = (box - size) / 2;
  if (layout.line.align === "end") {
    return frame.left + frame.width + size / 3 - box + inset;
  }
  if (layout.line.align === "center") {
    return frame.left + (frame.width - box) / 2 + inset;
  }
  return frame.left - size / 3 + inset;
}

export function drawInstrumental(
  ctx: CanvasRenderingContext2D,
  layout: LineLayout,
  top: number,
  timeMs: number,
  type: LyricsTypography,
  frame: InstrumentalFrame,
  dpr: number,
  now: number,
) {
  const size = type.size;
  const scale = size / NOTE_VIEWBOX;
  const left = noteLeft(layout, size, frame);
  const noteTop = top + type.paddingY;
  ctx.save();
  ctx.translate(left, noteTop);
  ctx.scale(scale, scale);
  ctx.fillStyle = white(INACTIVE_ALPHA);
  ctx.fill(note());
  ctx.restore();

  const state = instrumentalState(layout.line, timeMs, waveFlattenEasing, now);
  if (!state) return;
  const pad = GLOW_PAD * GLOW_SIGMA * scale;
  const pixels = Math.ceil((size + pad * 2) * dpr);
  const fill = scratchCanvas(pixels);
  if (!fill || !scratch) return;
  fill.save();
  fill.scale(dpr, dpr);
  fill.translate(pad, pad);
  fill.scale(scale, scale);
  fill.clip(waveClip(state));
  fill.fillStyle = white(1);
  fill.fill(note());
  fill.restore();

  ctx.save();
  ctx.globalAlpha = state.opacity;
  ctx.shadowColor = white(GLOW_ALPHA);
  ctx.shadowBlur = GLOW_SIGMA * scale * 2 * dpr;
  ctx.drawImage(
    scratch,
    left - pad,
    noteTop - pad,
    size + pad * 2,
    size + pad * 2,
  );
  ctx.restore();
}

import { nativeImage, type BrowserWindow, type NativeImage, type ThumbarButton } from "electron";

export type ThumbarGlyph = "prev" | "next" | "play" | "pause";
export type ThumbarAction = "prev" | "togglePlay" | "next";

type Point = [number, number];
type Shape = { kind: "rect"; x: number; y: number; w: number; h: number } | { kind: "tri"; a: Point; b: Point; c: Point };

const GRID = 16;
const SUPERSAMPLE = 4;

const SHAPES: Record<ThumbarGlyph, Shape[]> = {
  play: [{ kind: "tri", a: [4.5, 2.5], b: [4.5, 13.5], c: [13, 8] }],
  pause: [
    { kind: "rect", x: 3.5, y: 2.5, w: 3, h: 11 },
    { kind: "rect", x: 9.5, y: 2.5, w: 3, h: 11 },
  ],
  next: [
    { kind: "tri", a: [2.5, 2.5], b: [2.5, 13.5], c: [10, 8] },
    { kind: "rect", x: 10.5, y: 2.5, w: 2.5, h: 11 },
  ],
  prev: [
    { kind: "rect", x: 3, y: 2.5, w: 2.5, h: 11 },
    { kind: "tri", a: [13.5, 2.5], b: [13.5, 13.5], c: [6, 8] },
  ],
};

function inTriangle([px, py]: Point, [ax, ay]: Point, [bx, by]: Point, [cx, cy]: Point): boolean {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const negative = d1 < 0 || d2 < 0 || d3 < 0;
  const positive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negative && positive);
}

function covered(glyph: ThumbarGlyph, point: Point): boolean {
  return SHAPES[glyph].some((shape) =>
    shape.kind === "rect"
      ? point[0] >= shape.x && point[0] <= shape.x + shape.w && point[1] >= shape.y && point[1] <= shape.y + shape.h
      : inTriangle(point, shape.a, shape.b, shape.c),
  );
}

export function drawThumbarGlyph(glyph: ThumbarGlyph, sizePx: number): Buffer {
  const pixels = Buffer.alloc(sizePx * sizePx * 4);
  const unit = GRID / sizePx;
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < sizePx; y++) {
    for (let x = 0; x < sizePx; x++) {
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const point: Point = [(x + (sx + 0.5) / SUPERSAMPLE) * unit, (y + (sy + 0.5) / SUPERSAMPLE) * unit];
          if (covered(glyph, point)) hits++;
        }
      }
      const alpha = Math.round((hits / samples) * 255);
      const offset = (y * sizePx + x) * 4;
      pixels[offset] = alpha;
      pixels[offset + 1] = alpha;
      pixels[offset + 2] = alpha;
      pixels[offset + 3] = alpha;
    }
  }
  return pixels;
}

function glyphImage(glyph: ThumbarGlyph): NativeImage {
  const image = nativeImage.createFromBitmap(drawThumbarGlyph(glyph, GRID), { width: GRID, height: GRID, scaleFactor: 1 });
  image.addRepresentation({ scaleFactor: 2, width: GRID * 2, height: GRID * 2, buffer: drawThumbarGlyph(glyph, GRID * 2) });
  return image;
}

export type ThumbarPlayerState = { status?: string; track?: unknown } | null | undefined;

const PLAYING_STATUSES = new Set(["playing", "loading", "buffering"]);

export class ThumbarController {
  private icons: Record<ThumbarGlyph, NativeImage> | null = null;
  private hasTrack = false;
  private playing = false;
  private appliedKey: string | null = null;

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly send: (action: ThumbarAction) => void,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  update(state: ThumbarPlayerState) {
    this.hasTrack = Boolean(state?.track);
    this.playing = PLAYING_STATUSES.has(state?.status ?? "");
    this.apply(false);
  }

  refresh() {
    this.apply(true);
  }

  private apply(force: boolean) {
    if (this.platform !== "win32") return;
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return;
    const key = this.hasTrack ? (this.playing ? "playing" : "paused") : "none";
    if (!force && key === this.appliedKey) return;
    try {
      win.setThumbarButtons(this.hasTrack ? this.buttons() : []);
      this.appliedKey = key;
    } catch (err) {
      console.warn("[thumbar] could not set taskbar buttons:", err);
    }
  }

  private buttons(): ThumbarButton[] {
    this.icons ??= { prev: glyphImage("prev"), next: glyphImage("next"), play: glyphImage("play"), pause: glyphImage("pause") };
    return [
      { tooltip: "Previous", icon: this.icons.prev, click: () => this.send("prev") },
      {
        tooltip: this.playing ? "Pause" : "Play",
        icon: this.playing ? this.icons.pause : this.icons.play,
        click: () => this.send("togglePlay"),
      },
      { tooltip: "Next", icon: this.icons.next, click: () => this.send("next") },
    ];
  }
}

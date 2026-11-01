import { BITMAP_PAD } from "./lineBitmaps";

export interface LivePiece {
  bitmap: HTMLCanvasElement;
  top: number;
  height: number;
}

export class LiveLayer {
  private readonly ctx: CanvasRenderingContext2D | null;
  private shown = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
    canvas.style.visibility = "hidden";
  }

  hide() {
    if (!this.shown) return;
    this.shown = false;
    this.canvas.style.visibility = "hidden";
  }

  draw(pieces: LivePiece[], width: number, dpr: number) {
    const ctx = this.ctx;
    if (!ctx || pieces.length === 0) {
      this.hide();
      return;
    }
    const snap = (value: number, round: (v: number) => number) =>
      round(value * dpr) / dpr;
    const top = snap(
      Math.min(...pieces.map((piece) => piece.top - BITMAP_PAD)),
      Math.floor,
    );
    const bottom = snap(
      Math.max(...pieces.map((piece) => piece.top + piece.height + BITMAP_PAD)),
      Math.ceil,
    );
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round((bottom - top) * dpr));
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    const style = this.canvas.style;
    const height = `${bottom - top}px`;
    const transform = `translateY(${top}px)`;
    if (style.height !== height) style.height = height;
    if (style.transform !== transform) style.transform = transform;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, bottom - top);
    for (const piece of pieces) {
      ctx.drawImage(
        piece.bitmap,
        0,
        piece.top - top - BITMAP_PAD,
        piece.bitmap.width / dpr,
        piece.bitmap.height / dpr,
      );
    }
    if (!this.shown) {
      this.shown = true;
      style.visibility = "visible";
    }
  }
}

export const BITMAP_PAD = 24;

interface Bitmap {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  key: string;
}

export type PaintLine = (ctx: CanvasRenderingContext2D, top: number) => void;

export class LineBitmaps {
  private readonly bitmaps = new Map<number, Bitmap>();
  private seen = new Set<number>();

  begin() {
    this.seen = new Set();
  }

  keep(index: number) {
    this.seen.add(index);
  }

  get(
    index: number,
    key: string,
    width: number,
    height: number,
    dpr: number,
    paint: PaintLine,
  ): HTMLCanvasElement | null {
    this.seen.add(index);
    const pixelWidth = Math.max(1, Math.ceil(width * dpr));
    const pixelHeight = Math.max(1, Math.ceil((height + BITMAP_PAD * 2) * dpr));
    let bitmap = this.bitmaps.get(index);
    if (!bitmap) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      bitmap = { canvas, ctx, key: "" };
      this.bitmaps.set(index, bitmap);
    }
    const sized =
      bitmap.canvas.width === pixelWidth &&
      bitmap.canvas.height === pixelHeight;
    if (sized && bitmap.key === key) return bitmap.canvas;
    if (!sized) {
      bitmap.canvas.width = pixelWidth;
      bitmap.canvas.height = pixelHeight;
    }
    const { ctx } = bitmap;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height + BITMAP_PAD * 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    paint(ctx, BITMAP_PAD);
    bitmap.key = key;
    return bitmap.canvas;
  }

  end() {
    for (const index of this.bitmaps.keys()) {
      if (!this.seen.has(index)) this.bitmaps.delete(index);
    }
  }

  clear() {
    this.bitmaps.clear();
  }
}

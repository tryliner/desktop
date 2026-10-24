import { describe, expect, it, vi } from "vitest";
import { drawAppIconArtwork } from "./appIconArtwork";

function makeContext(withRoundRect = true) {
  const drawImage = vi.fn();
  const rect = vi.fn();
  const roundRect = withRoundRect ? vi.fn() : undefined;
  const ctx = {
    beginPath: vi.fn(),
    drawImage,
    fill: vi.fn(),
    rect,
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    filter: "none",
    lineWidth: 0,
    strokeStyle: "",
    roundRect,
  } as unknown as CanvasRenderingContext2D;

  return { ctx, drawImage, rect, roundRect };
}

describe("drawAppIconArtwork", () => {
  it("keeps dark artwork inside a 32 px transparent safe area", () => {
    const { ctx, drawImage, roundRect } = makeContext();
    const logo = {} as CanvasImageSource;

    drawAppIconArtwork(ctx, logo, false);

    expect(roundRect).toHaveBeenCalledWith(32, 32, 448, 448, 98);
    expect(ctx.fillStyle).toBe("#0d0d10");
    expect(ctx.strokeStyle).toBe("rgba(255, 255, 255, 0.08)");
    expect(ctx.lineWidth).toBe(1.75);
    expect(ctx.filter).toBe("none");
    expect(drawImage).toHaveBeenCalledWith(logo, 130, 158, 252, 196);
  });

  it("keeps light artwork inside the same safe area and inverts the logo", () => {
    const { ctx, drawImage, roundRect } = makeContext();
    const logo = {} as CanvasImageSource;
    let filterAtLogoDraw = "none";
    drawImage.mockImplementation(() => {
      filterAtLogoDraw = ctx.filter;
    });

    drawAppIconArtwork(ctx, logo, true);

    expect(roundRect).toHaveBeenCalledWith(32, 32, 448, 448, 98);
    expect(ctx.fillStyle).toBe("#f5f5f7");
    expect(ctx.strokeStyle).toBe("rgba(0, 0, 0, 0.08)");
    expect(drawImage).toHaveBeenCalledWith(logo, 130, 158, 252, 196);
    expect(filterAtLogoDraw).toBe("invert(1)");
  });

  it("uses the inset fallback rectangle when roundRect is unavailable", () => {
    const { ctx, rect, roundRect } = makeContext(false);

    drawAppIconArtwork(ctx, {} as CanvasImageSource, false);

    expect(roundRect).toBeUndefined();
    expect(rect).toHaveBeenCalledWith(32, 32, 448, 448);
  });
});

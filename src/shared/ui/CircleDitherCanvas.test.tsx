import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CircleDitherCanvas, { DITHER_RESIZE_SETTLE_MS } from "./CircleDitherCanvas";

describe("CircleDitherCanvas", () => {
  let container: HTMLDivElement;
  let root: Root;
  let size = { width: 800, height: 600 };
  let screenSize = { width: 1920, height: 1080 };
  let observed: (() => void) | null = null;
  const getImageData = vi.fn((_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }));

  beforeEach(() => {
    vi.useFakeTimers();
    size = { width: 800, height: 600 };
    screenSize = { width: 1920, height: 1080 };
    getImageData.mockClear();
    vi.spyOn(window, "screen", "get").mockImplementation(() => screenSize as Screen);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observed = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        crossOrigin = "";
        width = 1600;
        height = 900;
        naturalWidth = 1600;
        naturalHeight = 900;
        set src(_value: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      },
    );
    const ctx = new Proxy({ getImageData } as Record<string | symbol, unknown>, {
      get: (target, key) => (key in target ? target[key] : vi.fn()),
      set: () => true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ ...size, x: 0, y: 0, top: 0, left: 0, right: size.width, bottom: size.height, toJSON: () => ({}) }) as DOMRect,
    );
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function mount() {
    act(() => root.render(<CircleDitherCanvas src="clouds.jpg" />));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    return container.querySelector("canvas")!;
  }

  it("draws once at screen size, centered, right after the image loads", async () => {
    const canvas = await mount();
    expect([canvas.width, canvas.height]).toEqual([1920, 1080]);
    expect([canvas.style.width, canvas.style.height]).toEqual(["1920px", "1080px"]);
    expect(canvas.className).toContain("-translate-x-1/2");
    expect(getImageData).toHaveBeenCalledTimes(1);
  });

  it("keeps the same dots while the window maximizes and restores: no stretch, no redraw", async () => {
    const canvas = await mount();
    getImageData.mockClear();

    for (const [width, height] of [[1100, 700], [1500, 900], [1920, 1080], [800, 600]]) {
      size = { width, height };
      act(() => {
        observed?.();
        vi.advanceTimersByTime(30);
      });
    }
    act(() => vi.advanceTimersByTime(DITHER_RESIZE_SETTLE_MS * 2));
    expect([canvas.width, canvas.height]).toEqual([1920, 1080]);
    expect(getImageData).not.toHaveBeenCalled();
  });

  it("redraws once for a screen with a different size", async () => {
    const canvas = await mount();
    getImageData.mockClear();
    screenSize = { width: 2560, height: 1440 };
    act(() => observed?.());
    expect(getImageData).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(DITHER_RESIZE_SETTLE_MS));
    expect([canvas.width, canvas.height]).toEqual([2560, 1440]);
    expect(getImageData).toHaveBeenCalledTimes(1);
  });
});

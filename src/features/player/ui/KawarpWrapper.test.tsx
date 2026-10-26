import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({ resize: vi.fn(), start: vi.fn(), dispose: vi.fn(), loadImage: vi.fn(async () => {}) }));

vi.mock("../engine/kawarpEngine", () => ({
  KawarpEngine: vi.fn(function KawarpEngine() {
    return engine;
  }),
}));
vi.mock("@/features/covers", () => ({ getCoverElement: () => undefined, useCoverElement: () => undefined }));

import { KAWARP_RENDER_SCALE, KAWARP_RESIZE_SETTLE_MS, KawarpWrapper } from "./KawarpWrapper";

describe("KawarpWrapper", () => {
  let container: HTMLDivElement;
  let root: Root;
  let size = { width: 800, height: 600 };
  let screenSize = { width: 1920, height: 1080 };

  beforeEach(() => {
    vi.useFakeTimers();
    size = { width: 800, height: 600 };
    screenSize = { width: 1920, height: 1080 };
    vi.spyOn(window, "screen", "get").mockImplementation(() => screenSize as Screen);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
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
    engine.resize.mockClear();
  });

  it("renders once at half the screen resolution, shown at screen size and centered", () => {
    act(() => root.render(<KawarpWrapper />));
    const canvas = container.querySelector("canvas")!;
    expect([canvas.width, canvas.height]).toEqual([1920 * KAWARP_RENDER_SCALE, 1080 * KAWARP_RENDER_SCALE]);
    expect([canvas.style.width, canvas.style.height]).toEqual(["1920px", "1080px"]);
    expect(canvas.className).toContain("-translate-x-1/2");
    expect(canvas.className).not.toContain("w-full");
  });

  it("does nothing while the window maximizes and restores", () => {
    act(() => root.render(<KawarpWrapper />));
    const canvas = container.querySelector("canvas")!;
    engine.resize.mockClear();
    for (const [width, height] of [[1100, 700], [1500, 900], [1920, 1080], [800, 600]]) {
      size = { width, height };
      window.dispatchEvent(new Event("resize"));
      act(() => vi.advanceTimersByTime(30));
    }
    act(() => vi.advanceTimersByTime(KAWARP_RESIZE_SETTLE_MS * 2));
    expect([canvas.width, canvas.height]).toEqual([960, 540]);
    expect(engine.resize).not.toHaveBeenCalled();
  });

  it("re-renders once for a screen with a different size", () => {
    act(() => root.render(<KawarpWrapper />));
    const canvas = container.querySelector("canvas")!;
    engine.resize.mockClear();
    screenSize = { width: 2560, height: 1440 };
    window.dispatchEvent(new Event("resize"));
    expect(engine.resize).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(KAWARP_RESIZE_SETTLE_MS));
    expect([canvas.width, canvas.height]).toEqual([1280, 720]);
    expect(canvas.style.width).toBe("2560px");
    expect(engine.resize).toHaveBeenCalledTimes(1);
  });
});

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { detectParser } from "@braccato/parsers";
import {
  resetWindowDragTimeForTests,
  useWindowDrag,
} from "@/shared/hooks/useWindowDrag";
import { CanvasLyricsView } from "./CanvasLyricsView";

const seek = vi.hoisted(() => vi.fn());

vi.mock("../engine/playerEngine", () => ({
  playerEngine: {
    seek,
    getSnapshot: () => ({ status: "paused" }),
  },
}));

vi.mock("../hooks/pixelSnap", () => ({
  snapStage: () => ({ width: 600, height: 400, dpr: 1 }),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const LRC = Array.from({ length: 12 }, (_, index) => {
  const seconds = 5 + index * 4;
  return `[00:${String(seconds).padStart(2, "0")}.00]line number ${index + 1}`;
}).join("\n");

function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  return new Proxy({} as Record<string, unknown>, {
    get(target, key) {
      if (key in target) return target[key as string];
      if (key === "measureText")
        return (text: string) => ({
          width: text.length * 16,
          fontBoundingBoxAscent: 30,
          fontBoundingBoxDescent: 8,
        });
      if (key === "createLinearGradient") return () => gradient;
      return () => {};
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function Harness() {
  useWindowDrag();
  return <CanvasLyricsView lyrics={detectParser(LRC).parse(LRC)} />;
}

function lyricsCanvas(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector<HTMLCanvasElement>("canvas.inset-0");
  if (!canvas) throw new Error("lyrics canvas is missing");
  return canvas;
}

function press(target: Element, type: string, clientY: number) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX: 120,
      clientY,
      screenX: 120,
      screenY: clientY,
    }),
  );
}

describe("CanvasLyricsView clicks", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    resetWindowDragTimeForTests();
    seek.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => fakeContext() as never,
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly callback: () => void) {}
        observe() {
          this.callback();
        }
        disconnect() {}
      },
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Harness />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("seeks to a lyric line on a normal click", () => {
    const canvas = lyricsCanvas(container);
    press(canvas, "pointerdown", 60);
    press(canvas, "click", 60);
    expect(seek).toHaveBeenCalledTimes(1);
  });

  it("ignores the click that ends a window drag from the top strip", () => {
    const canvas = lyricsCanvas(container);
    press(canvas, "pointerdown", 10);
    press(window.document.body, "pointermove", 200);
    press(window.document.body, "pointerup", 200);
    press(canvas, "click", 60);
    expect(seek).not.toHaveBeenCalled();
  });
});

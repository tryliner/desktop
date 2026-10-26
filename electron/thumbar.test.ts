import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  nativeImage: {
    createFromBitmap: vi.fn((_buffer: Buffer, options: { width: number }) => ({ width: options.width, addRepresentation: vi.fn() })),
  },
}));

import { ThumbarController, drawThumbarGlyph, type ThumbarAction } from "./thumbar";

const alphaAt = (pixels: Buffer, size: number, x: number, y: number) => pixels[(y * size + x) * 4 + 3];

type FakeButton = { tooltip: string; click: () => void };

function fakeWindow() {
  return { isDestroyed: () => false, setThumbarButtons: vi.fn<(buttons: FakeButton[]) => boolean>(() => true) };
}

describe("drawThumbarGlyph", () => {
  it("draws solid white glyphs on a transparent background", () => {
    const play = drawThumbarGlyph("play", 16);
    expect(play).toHaveLength(16 * 16 * 4);
    expect(alphaAt(play, 16, 7, 8)).toBe(255);
    expect(alphaAt(play, 16, 0, 0)).toBe(0);
    expect(alphaAt(play, 16, 15, 1)).toBe(0);
  });

  it("leaves the gap between the pause bars clear", () => {
    const pause = drawThumbarGlyph("pause", 32);
    expect(alphaAt(pause, 32, 10, 16)).toBe(255);
    expect(alphaAt(pause, 32, 16, 16)).toBe(0);
    expect(alphaAt(pause, 32, 22, 16)).toBe(255);
  });

  it("points previous and next in opposite directions", () => {
    const next = drawThumbarGlyph("next", 16);
    const prev = drawThumbarGlyph("prev", 16);
    expect(alphaAt(next, 16, 3, 8)).toBe(255);
    expect(alphaAt(prev, 16, 12, 8)).toBe(255);
    expect(alphaAt(prev, 16, 3, 8)).toBe(255);
    expect(alphaAt(next, 16, 12, 8)).toBe(255);
  });
});

describe("ThumbarController", () => {
  function setup(platform: NodeJS.Platform = "win32") {
    const win = fakeWindow();
    const sent: ThumbarAction[] = [];
    const controller = new ThumbarController(() => win as never, (action) => sent.push(action), platform);
    const lastButtons = () => win.setThumbarButtons.mock.calls.at(-1)?.[0] ?? [];
    return { win, sent, controller, lastButtons };
  }

  it("shows previous, pause and next while a track plays, and routes clicks to the player", () => {
    const { sent, controller, lastButtons } = setup();
    controller.update({ status: "playing", track: { id: "a" } });
    const buttons = lastButtons();
    expect(buttons.map((b) => b.tooltip)).toEqual(["Previous", "Pause", "Next"]);
    buttons.forEach((b) => b.click());
    expect(sent).toEqual(["prev", "togglePlay", "next"]);
  });

  it("switches to play when paused, and only touches the taskbar when something changed", () => {
    const { win, controller, lastButtons } = setup();
    controller.update({ status: "playing", track: { id: "a" } });
    controller.update({ status: "playing", track: { id: "b" } });
    expect(win.setThumbarButtons).toHaveBeenCalledTimes(1);
    controller.update({ status: "paused", track: { id: "b" } });
    expect(lastButtons().map((b) => b.tooltip)).toEqual(["Previous", "Play", "Next"]);
    expect(win.setThumbarButtons).toHaveBeenCalledTimes(2);
  });

  it("removes the buttons when nothing is loaded", () => {
    const { controller, lastButtons } = setup();
    controller.update({ status: "playing", track: { id: "a" } });
    controller.update({ status: "idle", track: null });
    expect(lastButtons()).toEqual([]);
  });

  it("re-applies the same buttons when the window comes back", () => {
    const { win, controller } = setup();
    controller.update({ status: "paused", track: { id: "a" } });
    controller.refresh();
    expect(win.setThumbarButtons).toHaveBeenCalledTimes(2);
  });

  it("does nothing outside windows", () => {
    const { win, controller } = setup("darwin");
    controller.update({ status: "playing", track: { id: "a" } });
    expect(win.setThumbarButtons).not.toHaveBeenCalled();
  });
});

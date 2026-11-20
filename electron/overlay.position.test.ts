import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupOverlay } from "./overlay.testSetup";

const electron = await vi.hoisted(
  async () => (await import("./overlay.testSetup")).electron,
);

vi.mock("electron", () => electron.module);
vi.mock("./ipc-guard.js", () => ({
  confineToApp: () => {},
  handleTrusted: electron.module.ipcMain.handle,
  onTrusted: electron.module.ipcMain.on,
}));
vi.mock("./compositor/index.js", () => ({
  createCompositorBridge: () => null,
}));

import { OverlayManager } from "./overlay";

describe("OverlayManager positions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    electron.windows.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("applies and saves top-center for an invalid explicit position", () => {
    const userData = fs.mkdtempSync(
      path.join(os.tmpdir(), "liner-overlay-test-"),
    );
    vi.spyOn(electron.module.app, "getPath").mockReturnValue(userData);
    try {
      const manager = new OverlayManager("/preload.cjs", "/dist");
      const updateSettings = electron.ipcOn.get("overlay:update-settings");
      updateSettings?.({}, { position: "bottom-right" });
      expect(manager.getPillBounds()).toMatchObject({ x: 1580, y: 1004 });

      updateSettings?.({}, { position: "invalid" });
      expect(manager.getPillBounds()).toMatchObject({ x: 800, y: 20 });
      const settingsFile = path.join(userData, "overlay-settings.json");
      const savedSettings: unknown = JSON.parse(
        fs.readFileSync(settingsFile, "utf8"),
      );
      expect(savedSettings).toMatchObject({ position: "top-center" });
    } finally {
      fs.rmSync(userData, { recursive: true, force: true });
    }
  });

  it("saves all six positions, restores them on startup and falls back for an invalid value", () => {
    const userData = fs.mkdtempSync(
      path.join(os.tmpdir(), "liner-overlay-test-"),
    );
    vi.spyOn(electron.module.app, "getPath").mockReturnValue(userData);
    try {
      new OverlayManager("/preload.cjs", "/dist");
      const positions = [
        ["top-left", 20, 20],
        ["top-center", 800, 20],
        ["top-right", 1580, 20],
        ["bottom-left", 20, 1004],
        ["bottom-center", 800, 1004],
        ["bottom-right", 1580, 1004],
      ] as const;

      for (const [position, x, y] of positions) {
        electron.ipcOn.get("overlay:update-settings")?.({}, { position });
        const restarted = new OverlayManager("/preload.cjs", "/dist");
        expect(restarted.getPillBounds()).toMatchObject({ x, y });
      }

      fs.writeFileSync(
        path.join(userData, "overlay-settings.json"),
        JSON.stringify({ position: "invalid" }),
      );
      const restarted = new OverlayManager("/preload.cjs", "/dist");
      expect(restarted.getPillBounds()).toMatchObject({ x: 800, y: 20 });
    } finally {
      fs.rmSync(userData, { recursive: true, force: true });
    }
  });

  it("animates a visible overlay to the bottom and keeps it anchored while resizing", async () => {
    const { manager, overlays, ready } = setupOverlay(OverlayManager);
    await vi.advanceTimersByTimeAsync(600);
    const [overlay] = overlays();
    ready(overlay);
    await vi.advanceTimersByTimeAsync(100);
    manager.showOverlay();

    electron.ipcOn.get("overlay:update-settings")?.(
      {},
      { position: "bottom-center" },
    );
    await vi.advanceTimersByTimeAsync(64);
    expect(overlay.getBounds().y).toBeGreaterThan(20);
    expect(overlay.getBounds().y).toBeLessThan(1004);
    await vi.advanceTimersByTimeAsync(80);
    expect(overlay.getBounds()).toEqual({
      x: 800,
      y: 1004,
      width: 320,
      height: 56,
    });

    for (const height of [120, 56]) {
      const target = manager["getWindowBounds"](320, height);
      expect(target.y + height).toBe(1060);
      const setBounds = vi.spyOn(overlay, "setBounds").mockClear();
      manager["animateWindowBounds"](target);
      await vi.advanceTimersByTimeAsync(144);
      expect(setBounds.mock.calls.length).toBeGreaterThan(1);
      for (const [bounds] of setBounds.mock.calls) {
        expect(bounds.y + bounds.height).toBe(1060);
      }
      expect(overlay.getBounds()).toEqual(target);
    }
  });

  it("keeps the top edge fixed while resizing a top-anchored overlay", async () => {
    const { manager, overlays, ready } = setupOverlay(OverlayManager);
    await vi.advanceTimersByTimeAsync(600);
    const [overlay] = overlays();
    ready(overlay);
    await vi.advanceTimersByTimeAsync(100);
    manager.showOverlay();

    const { y } = overlay.getBounds();
    const target = manager["getWindowBounds"](320, 120);
    const setBounds = vi.spyOn(overlay, "setBounds").mockClear();
    manager["animateWindowBounds"](target);
    await vi.advanceTimersByTimeAsync(144);

    expect(setBounds.mock.calls.length).toBeGreaterThan(1);
    for (const [bounds] of setBounds.mock.calls) {
      expect(bounds.y).toBe(y);
    }
    expect(overlay.getBounds()).toEqual(target);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeItem = {
  label?: string;
  type?: string;
  enabled?: boolean;
  click?: () => void;
};

const { trays, FakeTray } = vi.hoisted(() => {
  const trays: InstanceType<typeof FakeTray>[] = [];

  class FakeTray {
    destroyed = false;
    listeners = new Map<string, () => void>();
    setToolTip = vi.fn();
    setContextMenu = vi.fn<(menu: FakeItem[]) => void>();
    constructor() {
      trays.push(this);
    }
    on(event: string, listener: () => void) {
      this.listeners.set(event, listener);
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
    }
  }

  return { trays, FakeTray };
});

vi.mock("electron", () => ({
  Tray: FakeTray,
  Menu: { buildFromTemplate: (template: FakeItem[]) => template },
  nativeImage: {
    createFromPath: vi.fn(() => ({ resize: vi.fn(() => ({})) })),
  },
}));

import { createTray } from "./tray";
import type { ThumbarAction } from "./thumbar";

describe("TrayController", () => {
  beforeEach(() => {
    trays.length = 0;
  });

  function setup(platform: NodeJS.Platform = "win32") {
    const sent: ThumbarAction[] = [];
    const showWindow = vi.fn();
    const quit = vi.fn();
    const controller = createTray({
      iconPath: "icon.png",
      showWindow,
      send: (action) => sent.push(action),
      quit,
      platform,
    });
    const tray = trays[0]!;
    const lastMenu = () => tray.setContextMenu.mock.calls.at(-1)?.[0] ?? [];
    const item = (label: string) => lastMenu().find((i) => i.label === label);
    return { sent, showWindow, quit, controller, tray, lastMenu, item };
  }

  it("starts with playback disabled until a track is loaded", () => {
    const { item } = setup();
    expect(item("Show Liner")?.enabled).toBeUndefined();
    expect(item("Previous")?.enabled).toBe(false);
    expect(item("Play")?.enabled).toBe(false);
    expect(item("Next")?.enabled).toBe(false);
  });

  it("routes playback items to the player while a track plays", () => {
    const { sent, controller, item } = setup();
    controller.update({ status: "playing", track: { id: "a" } });
    item("Previous")?.click?.();
    item("Pause")?.click?.();
    item("Next")?.click?.();
    expect(sent).toEqual(["prev", "togglePlay", "next"]);
  });

  it("only rebuilds the menu when the play state changes", () => {
    const { tray, controller, item } = setup();
    controller.update({ status: "playing", track: { id: "a" } });
    controller.update({ status: "buffering", track: { id: "b" } });
    expect(tray.setContextMenu).toHaveBeenCalledTimes(2);
    controller.update({ status: "paused", track: { id: "b" } });
    expect(item("Play")?.enabled).toBe(true);
    expect(tray.setContextMenu).toHaveBeenCalledTimes(3);
  });

  it("disables playback items when the track is removed", () => {
    const { controller, item } = setup();
    controller.update({ status: "playing", track: { id: "a" } });
    controller.update({ status: "idle", track: null });
    expect(item("Previous")?.enabled).toBe(false);
    expect(item("Play")?.enabled).toBe(false);
    expect(item("Next")?.enabled).toBe(false);
  });

  it("shows the window and quits from the menu", () => {
    const { showWindow, quit, item } = setup();
    item("Show Liner")?.click?.();
    item("Quit Liner")?.click?.();
    expect(showWindow).toHaveBeenCalledOnce();
    expect(quit).toHaveBeenCalledOnce();
  });

  it("brings the window back on click outside macos", () => {
    const { tray, showWindow } = setup();
    tray.listeners.get("click")?.();
    expect(showWindow).toHaveBeenCalledOnce();
  });

  it("leaves the click to the menu on macos", () => {
    const { tray, item } = setup("darwin");
    expect(tray.listeners.has("click")).toBe(false);
    expect(item("Show Liner")).toBeDefined();
  });

  it("stops touching the tray once destroyed", () => {
    const { tray, controller } = setup();
    controller.destroy();
    expect(tray.destroyed).toBe(true);
    controller.update({ status: "playing", track: { id: "a" } });
    expect(tray.setContextMenu).toHaveBeenCalledTimes(1);
  });
});

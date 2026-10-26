import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ screen: { getPrimaryDisplay: () => ({ scaleFactor: 1 }) } }));

import { NativeSnapPreview } from "./snap-native";

type SnapPreviewAddon = Parameters<typeof NativeSnapPreview.create>[0];

type AddonLevel = "legacy" | "transitions" | "offscreen";

function fakeAddon(level: AddonLevel) {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      const hwnd = args[0] instanceof Buffer ? args[0].toString() : "";
      calls.push([name, hwnd, ...args.slice(1).filter((a) => typeof a === "boolean")].filter((p) => p !== "").join(":"));
      return true;
    };
  const addon = {
    init: () => true,
    hasBackdrop: () => true,
    windowRect: (hwnd: Buffer) => (hwnd.toString() === "main" ? [100, 100, 900, 700] : [800, 20, 1120, 76]),
    placeOnWindowMonitor: () => [0, 0, 1920, 1080],
    animate: () => {},
    show: () => {},
    hide: () => {},
    setStyle: () => {},
    transform: () => true,
    endMorph: () => {},
    cloak: record("cloak"),
    ...(level !== "legacy" ? { setTransitionsDisabled: record("transitionsDisabled") } : {}),
    ...(level === "offscreen"
      ? { minimizeKeepingPreview: record("minimizeOffscreen"), armRestoreTrap: record("restoreTrap"), takeRestoredCloaked: () => true }
      : {}),
  };
  return { addon: addon as unknown as SnapPreviewAddon, calls };
}

function fakeWindow(name: string, visible = false) {
  return {
    isDestroyed: () => false,
    isVisible: () => visible,
    getNativeWindowHandle: () => Buffer.from(name),
    webContents: { isLoading: () => false, executeJavaScript: async () => 1 },
  };
}

function snapFor(level: AddonLevel, main: ReturnType<typeof fakeWindow>) {
  const { addon, calls } = fakeAddon(level);
  const snap = NativeSnapPreview.create(addon, () => main as never, {
    insetDip: 8,
    tuckInsetDip: 20,
    radiusDip: 8,
    growMs: 220,
    collapseMs: 240,
    tint: 0,
    tintNoBlur: 0,
  })!;
  return { snap, calls };
}

async function minimizeIntoPill(level: AddonLevel) {
  const { addon, calls } = fakeAddon(level);
  const main = fakeWindow("main");
  const overlay = fakeWindow("overlay");
  const snap = NativeSnapPreview.create(addon, () => main as never, {
    insetDip: 8,
    tuckInsetDip: 20,
    radiusDip: 8,
    growMs: 220,
    collapseMs: 240,
    tint: 0,
    tintNoBlur: 0,
  })!;
  const minimize = vi.fn(() => calls.push("minimize"));
  await snap.toOverlay(async (beforeShow) => {
    beforeShow(overlay as never);
    return overlay as never;
  }, minimize);
  calls.length = 0;
  await vi.advanceTimersByTimeAsync(1_000);
  return { calls, minimize };
}

describe("NativeSnapPreview.toOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("minimizes off-screen in one native step: preview keeps content and nothing flashes", async () => {
    const { calls, minimize } = await minimizeIntoPill("offscreen");
    expect(minimize).not.toHaveBeenCalled();
    const order = calls.filter((c) => c.startsWith("minimizeOffscreen") || c.startsWith("transitionsDisabled:main") || c === "cloak:main:false");
    expect(order).toEqual(["minimizeOffscreen:main", "transitionsDisabled:main:false"]);
    expect(calls.indexOf("restoreTrap:main:true")).toBeGreaterThan(calls.indexOf("minimizeOffscreen:main"));
  });

  it("a taskbar restore plays the pill-to-window animation without restoring twice", async () => {
    const main = fakeWindow("main");
    const overlay = fakeWindow("overlay", true);
    const { snap, calls } = snapFor("offscreen", main);
    const restore = vi.fn();
    const closeOverlay = vi.fn();
    expect(snap.takeRestoredCloaked()).toBe(true);
    await snap.fromOverlay(overlay as never, restore, closeOverlay, true);
    expect(restore).not.toHaveBeenCalled();
    expect(calls).toContain("restoreTrap:main:false");
    expect(calls).toContain("cloak:main:true");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls.lastIndexOf("cloak:main:false")).toBeGreaterThan(calls.indexOf("cloak:main:true"));
    expect(closeOverlay).toHaveBeenCalled();
  });

  it("a taskbar restore with no mini-player on screen just shows the window", async () => {
    const main = fakeWindow("main");
    const overlay = fakeWindow("overlay", false);
    const { snap, calls } = snapFor("offscreen", main);
    const restore = vi.fn();
    const closeOverlay = vi.fn();
    await snap.fromOverlay(overlay as never, restore, closeOverlay, true);
    expect(restore).not.toHaveBeenCalled();
    expect(calls).toEqual(["cloak:main:false"]);
    expect(closeOverlay).toHaveBeenCalled();
  });

  it("with an add-on that only knows setTransitionsDisabled, uncloaks right before minimizing", async () => {
    const { calls, minimize } = await minimizeIntoPill("transitions");
    expect(minimize).toHaveBeenCalledTimes(1);
    const order = calls.filter((c) => c.startsWith("transitionsDisabled:main") || c === "cloak:main:false" || c === "minimize");
    expect(order).toEqual(["transitionsDisabled:main:true", "cloak:main:false", "minimize", "transitionsDisabled:main:false"]);
  });

  it("keeps the old behaviour with an add-on built before setTransitionsDisabled existed", async () => {
    const { calls, minimize } = await minimizeIntoPill("legacy");
    expect(minimize).toHaveBeenCalledTimes(1);
    expect(calls.indexOf("minimize")).toBeLessThan(calls.indexOf("cloak:main:false"));
  });
});

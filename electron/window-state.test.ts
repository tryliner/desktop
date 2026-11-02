import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWindowStateStore,
  parseWindowState,
  restorableBounds,
} from "./window-state";

const MIN = { width: 1100, height: 705 };
const PRIMARY = { x: 0, y: 0, width: 1920, height: 1040 };
const RIGHT = { x: 1920, y: 0, width: 2560, height: 1400 };

describe("parseWindowState", () => {
  it("defaults to off for garbage", () => {
    expect(parseWindowState(null)).toEqual({ remember: false });
    expect(parseWindowState("x")).toEqual({ remember: false });
    expect(parseWindowState({ remember: "yes" })).toEqual({ remember: false });
  });

  it("drops invalid bounds", () => {
    expect(
      parseWindowState({
        remember: true,
        bounds: { x: 0, y: 0, width: 0, height: 10 },
      }),
    ).toEqual({ remember: true });
  });

  it("keeps valid bounds and maximized flag", () => {
    expect(
      parseWindowState({
        remember: true,
        bounds: { x: 10.4, y: 20, width: 1200, height: 800 },
        maximized: true,
      }),
    ).toEqual({
      remember: true,
      bounds: { x: 10, y: 20, width: 1200, height: 800 },
      maximized: true,
    });
  });
});

describe("restorableBounds", () => {
  const bounds = { x: 100, y: 50, width: 1300, height: 800 };

  it("ignores saved bounds when the setting is off", () => {
    expect(restorableBounds({ remember: false, bounds }, [PRIMARY], MIN)).toBe(
      null,
    );
  });

  it("restores bounds that fit a display", () => {
    expect(
      restorableBounds({ remember: true, bounds }, [PRIMARY], MIN),
    ).toEqual(bounds);
  });

  it("restores onto a secondary display", () => {
    const onRight = { x: 2200, y: 100, width: 1400, height: 900 };
    expect(
      restorableBounds(
        { remember: true, bounds: onRight },
        [PRIMARY, RIGHT],
        MIN,
      ),
    ).toEqual(onRight);
  });

  it("falls back when the saved display is gone", () => {
    const onRight = { x: 2200, y: 100, width: 1400, height: 900 };
    expect(
      restorableBounds({ remember: true, bounds: onRight }, [PRIMARY], MIN),
    ).toBe(null);
  });

  it("pulls a partly offscreen window back inside the work area", () => {
    expect(
      restorableBounds(
        {
          remember: true,
          bounds: { x: 1500, y: -40, width: 1300, height: 800 },
        },
        [PRIMARY],
        MIN,
      ),
    ).toEqual({ x: 620, y: 0, width: 1300, height: 800 });
  });

  it("shrinks to a smaller display and grows to the minimum size", () => {
    const small = { x: 0, y: 0, width: 1280, height: 680 };
    expect(
      restorableBounds(
        { remember: true, bounds: { x: 0, y: 0, width: 600, height: 2000 } },
        [small],
        MIN,
      ),
    ).toEqual({ x: 0, y: 0, width: 1100, height: 680 });
  });
});

describe("createWindowStateStore", () => {
  let dir = "";

  afterEach(() => {
    vi.useRealTimers();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  function makeStore() {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "liner-window-state-"));
    const file = path.join(dir, "window-state.json");
    return { file, store: createWindowStateStore(file) };
  }

  const snapshot = {
    bounds: { x: 10, y: 20, width: 1200, height: 800 },
    maximized: false,
  };

  it("starts off and saves nothing while off", () => {
    const { file, store } = makeStore();
    expect(store.remembers()).toBe(false);
    store.flush(() => snapshot);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("persists bounds once enabled and survives a reload", () => {
    vi.useFakeTimers();
    const { file, store } = makeStore();
    store.setRemember(true, snapshot);
    const moved = { ...snapshot, bounds: { ...snapshot.bounds, x: 300 } };
    store.track(() => moved);
    vi.advanceTimersByTime(1000);
    expect(createWindowStateStore(file).get()).toEqual({
      remember: true,
      ...moved,
    });
  });

  it("forgets bounds when turned off", () => {
    const { file, store } = makeStore();
    store.setRemember(true, snapshot);
    store.setRemember(false, null);
    expect(createWindowStateStore(file).get()).toEqual({ remember: false });
  });
});

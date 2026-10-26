import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => {
  const { EventEmitter } = require("node:events") as typeof import("node:events");
  const ipcOn = new Map<string, (...args: unknown[]) => unknown>();
  const windows: FakeWindow[] = [];
  let nextId = 1;

  class FakeContents extends EventEmitter {
    id = nextId++;
    send = vi.fn();
    executeJavaScript = vi.fn(async () => 1);
  }

  class FakeWindow extends EventEmitter {
    webContents = new FakeContents();
    visible: boolean;
    destroyed = false;
    bounds: { x: number; y: number; width: number; height: number };
    loadFile = vi.fn(async () => {});
    loadURL = vi.fn(async () => {});
    showInactive = vi.fn(() => {
      this.visible = true;
    });
    hide = vi.fn(() => {
      this.visible = false;
    });
    constructor(options: { show?: boolean; x?: number; y?: number; width?: number; height?: number } = {}) {
      super();
      this.visible = options.show ?? true;
      this.bounds = { x: options.x ?? 0, y: options.y ?? 0, width: options.width ?? 0, height: options.height ?? 0 };
      windows.push(this);
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.emit("closed");
    }
    isVisible() {
      return this.visible;
    }
    getBounds() {
      return this.bounds;
    }
    setBounds(b: { x: number; y: number; width: number; height: number }) {
      this.bounds = b;
    }
    opacity = 1;
    setOpacity = vi.fn((value: number) => {
      this.opacity = value;
    });
    setAlwaysOnTop() {}
    moveTop = vi.fn(() => {
      this.visible = true;
    });
    setVisibleOnAllWorkspaces() {}
  }

  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  return {
    ipcOn,
    windows,
    FakeWindow,
    module: {
      BrowserWindow: FakeWindow,
      ipcMain: {
        on: (channel: string, handler: (...args: unknown[]) => unknown) => ipcOn.set(channel, handler),
        handle: () => {},
      },
      screen: { getPrimaryDisplay: () => display, getDisplayMatching: () => display },
      globalShortcut: { register: () => true, unregister: () => {} },
      app: { getPath: () => require("node:os").tmpdir() + "/liner-overlay-test-missing" },
    },
  };
});

vi.mock("electron", () => electron.module);
vi.mock("./compositor/index.js", () => ({ createCompositorBridge: () => null }));

import { OverlayManager } from "./overlay";

type Win = InstanceType<typeof electron.FakeWindow>;

function setup(signedIn = true) {
  const manager = new OverlayManager("/preload.cjs", "/dist");
  const main = new electron.FakeWindow({ show: true }) as Win;
  manager.setMainWindow(main as never);
  manager.bindAuthSource(() => signedIn, () => {});
  const overlays = () => electron.windows.filter((w) => w !== main) as Win[];
  const ready = (win: Win) => electron.ipcOn.get("overlay:ready")?.({ sender: win.webContents });
  return { manager, main, overlays, ready };
}

describe("OverlayManager", () => {
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

  it("keeps a hidden overlay warm once signed in, on every platform", async () => {
    const { overlays } = setup();
    expect(overlays()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(600);
    expect(overlays()).toHaveLength(1);
    expect(overlays()[0].isVisible()).toBe(false);
  });

  it("shows on the first minimize right after launch, before the main window reports sign-in", async () => {
    const { main, overlays, ready } = setup();
    main.emit("minimize");
    await vi.advanceTimersByTimeAsync(50);
    const [overlay] = overlays();
    expect(overlay).toBeDefined();
    expect(overlay.showInactive).not.toHaveBeenCalled();
    ready(overlay);
    expect(overlay.isVisible()).toBe(true);
  });

  it("never reveals a half-loaded window, and the warm one shows at once", async () => {
    const { manager, overlays, ready } = setup();
    await vi.advanceTimersByTimeAsync(600);
    const [overlay] = overlays();
    ready(overlay);
    await vi.advanceTimersByTimeAsync(100);
    expect(overlay.isVisible()).toBe(false);
    manager.showOverlay();
    expect(overlay.isVisible()).toBe(true);
    expect(overlays()).toHaveLength(1);
  });

  it("still shows with an older ui bundle that never signals ready", async () => {
    const { manager, overlays } = setup();
    manager.showOverlay();
    const [overlay] = overlays();
    overlay.webContents.emit("did-finish-load");
    await vi.advanceTimersByTimeAsync(1_499);
    expect(overlay.isVisible()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(overlay.isVisible()).toBe(true);
  });

  it("closing before the overlay is ready cancels the show", async () => {
    const { manager, overlays, ready } = setup();
    manager.showOverlay();
    manager.closeOverlay();
    const [overlay] = overlays();
    ready(overlay);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(overlay.isVisible()).toBe(false);
  });

  it("rebuilds the overlay after its renderer crashes and still shows it", async () => {
    const { manager, overlays, ready } = setup();
    manager.showOverlay();
    const [first] = overlays();
    first.webContents.emit("render-process-gone", {}, { reason: "crashed" });
    expect(first.isDestroyed()).toBe(true);
    const second = overlays().find((w) => !w.isDestroyed())!;
    expect(second).toBeDefined();
    ready(second);
    expect(second.isVisible()).toBe(true);
  });

  it("stops rebuilding a renderer that keeps crashing", async () => {
    const { manager, overlays } = setup();
    manager.showOverlay();
    for (let i = 0; i < 4; i++) {
      const live = overlays().find((w) => !w.isDestroyed());
      live?.webContents.emit("render-process-gone", {}, { reason: "crashed" });
    }
    await vi.advanceTimersByTimeAsync(5_000);
    expect(overlays().filter((w) => !w.isDestroyed())).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(60_000);
    manager.showOverlay();
    expect(overlays().filter((w) => !w.isDestroyed())).toHaveLength(1);
  });

  it("loads the same ui bundle as the main window", async () => {
    const { manager, overlays } = setup();
    manager.setIndexPathResolver(() => "/bundles/v42/dist/index.html");
    manager.showOverlay();
    expect(overlays()[0].loadFile).toHaveBeenCalledWith("/bundles/v42/dist/index.html", { hash: "/overlay" });
  });

  it("rebuilds the hidden overlay when the main window switches ui bundles", async () => {
    const { manager, main, overlays } = setup();
    let bundle = "/bundles/v1/dist/index.html";
    manager.setIndexPathResolver(() => bundle);
    await vi.advanceTimersByTimeAsync(600);
    const [old] = overlays();
    bundle = "/bundles/v2/dist/index.html";
    main.webContents.emit("did-finish-load");
    expect(old.isDestroyed()).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    const fresh = overlays().find((w) => !w.isDestroyed())!;
    expect(fresh.loadFile).toHaveBeenCalledWith("/bundles/v2/dist/index.html", { hash: "/overlay" });
  });

  it("primes a new overlay invisibly so the first minimize hand-off has a painted surface", async () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      const { manager, overlays, ready } = setup();
      await vi.advanceTimersByTimeAsync(600);
      const [overlay] = overlays();
      expect(manager.isReadyForTransition()).toBe(false);
      ready(overlay);
      expect(overlay.setOpacity).toHaveBeenCalledWith(0);
      expect(overlay.isVisible()).toBe(true);
      expect(manager.isReadyForTransition()).toBe(false);
      await vi.advanceTimersByTimeAsync(100);
      expect(overlay.isVisible()).toBe(false);
      expect(overlay.opacity).toBe(1);
      expect(manager.isReadyForTransition()).toBe(true);
    } finally {
      Object.defineProperty(process, "platform", platform);
    }
  });

  it("a show that lands while priming stays on screen at full opacity", async () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      const { manager, overlays, ready } = setup();
      await vi.advanceTimersByTimeAsync(600);
      const [overlay] = overlays();
      ready(overlay);
      manager.showOverlay();
      await vi.advanceTimersByTimeAsync(100);
      expect(overlay.isVisible()).toBe(true);
      expect(overlay.opacity).toBe(1);
    } finally {
      Object.defineProperty(process, "platform", platform);
    }
  });

  it("a hidden overlay never pops up from the always-on-top setup or a settings sync", async () => {
    const { overlays, ready } = setup();
    await vi.advanceTimersByTimeAsync(600);
    const [overlay] = overlays();
    electron.ipcOn.get("overlay:update-settings")?.({}, { alwaysOnTop: true, position: "top-right" });
    ready(overlay);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(overlay.moveTop).not.toHaveBeenCalled();
    expect(overlay.isVisible()).toBe(false);
  });

  it("revealing always really shows the window, even if windows already reports it visible", async () => {
    const { manager, overlays, ready } = setup();
    await vi.advanceTimersByTimeAsync(600);
    const [overlay] = overlays();
    ready(overlay);
    await vi.advanceTimersByTimeAsync(1_000);
    overlay.visible = true;
    overlay.showInactive.mockClear();
    manager.showOverlay();
    expect(overlay.showInactive).toHaveBeenCalledTimes(1);
  });

  it("never shows while signed out", async () => {
    const { main, overlays } = setup(false);
    main.emit("minimize");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(overlays()).toHaveLength(0);
  });
});

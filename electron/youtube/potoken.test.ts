import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  on: new Map<string, (event: unknown, ...args: unknown[]) => void>(),
  windows: [] as Array<{ destroyed: boolean }>,
}));

vi.mock("electron", () => {
  class BrowserWindow {
    destroyed = false;
    private closed: (() => void) | null = null;
    webContents = {
      once: () => {},
      on: () => {},
      setWindowOpenHandler: () => {},
      setAudioMuted: () => {},
      // the botguard page answers each mint right away
      send: (_channel: string, { id }: { id: number }) => {
        queueMicrotask(() =>
          mocks.on.get("potoken:result")?.(
            { sender: this.webContents },
            { id, value: `tok${id}` },
          ),
        );
      },
    };
    constructor() {
      mocks.windows.push(this);
    }
    loadURL() {
      queueMicrotask(() =>
        mocks.on.get("potoken:ready")?.({ sender: this.webContents }),
      );
      return Promise.resolve();
    }
    on(event: string, handler: () => void) {
      if (event === "closed") this.closed = handler;
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.closed?.();
    }
  }
  return {
    BrowserWindow,
    ipcMain: {
      on: (
        channel: string,
        handler: (event: unknown, ...args: unknown[]) => void,
      ) => mocks.on.set(channel, handler),
      handle: vi.fn(),
    },
  };
});

import { PoTokenService } from "./potoken";

describe("PoTokenService idle close", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.on.clear();
    mocks.windows.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("closes the hidden window after 10 idle minutes and reopens it on the next mint", async () => {
    const service = new PoTokenService("preload.cjs");

    await expect(service.mint("video1")).resolves.toBe("tok1");
    await vi.advanceTimersByTimeAsync(8 * 60_000);
    await expect(service.mint("video2")).resolves.toBe("tok2");
    // the second mint pushed the deadline back
    await vi.advanceTimersByTimeAsync(8 * 60_000);
    expect(mocks.windows).toHaveLength(1);
    expect(mocks.windows[0].destroyed).toBe(false);

    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(mocks.windows[0].destroyed).toBe(true);

    await expect(service.mint("video3")).resolves.toBe("tok3");
    expect(mocks.windows).toHaveLength(2);
    service.destroy();
  });
});

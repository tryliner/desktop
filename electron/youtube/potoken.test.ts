import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => {
  const { EventEmitter } =
    require("node:events") as typeof import("node:events");
  const ipcOn = new Map<string, (...args: unknown[]) => unknown>();
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const windows: FakeWindow[] = [];

  class FakeContents extends EventEmitter {
    send = vi.fn();
    setAudioMuted = vi.fn();
  }

  class FakeWindow extends EventEmitter {
    webContents = new FakeContents();
    destroyed = false;
    loadURL = vi.fn(async () => {});
    constructor() {
      super();
      windows.push(this);
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.emit("closed");
    }
  }

  return {
    ipcOn,
    handlers,
    windows,
    module: {
      BrowserWindow: FakeWindow,
      ipcMain: {
        on: (channel: string, handler: (...args: unknown[]) => unknown) =>
          ipcOn.set(channel, handler),
        handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
          handlers.set(channel, handler),
      },
    },
  };
});

vi.mock("electron", () => electron.module);

import { PoTokenService } from "./potoken";

type Win = (typeof electron.windows)[number];

const live = () => electron.windows.filter((w) => !w.isDestroyed());

function answer(win: Win, reply: (method: string, payload: any) => unknown) {
  win.webContents.send.mockImplementation(
    (_channel: string, request: { id: number; method: string; payload: any }) =>
      queueMicrotask(() =>
        electron.ipcOn.get("potoken:result")?.(
          { sender: win.webContents },
          { id: request.id, value: reply(request.method, request.payload) },
        ),
      ),
  );
}

async function startWorker(
  service: PoTokenService,
  reply: (method: string, payload: any) => unknown,
) {
  const call = service.mint("first");
  await vi.advanceTimersByTimeAsync(0);
  const win = electron.windows.at(-1)!;
  answer(win, reply);
  electron.ipcOn.get("potoken:ready")?.({ sender: win.webContents });
  await call;
  return win;
}

describe("PoTokenService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    electron.windows.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves a minted token from cache until it expires", async () => {
    const service = new PoTokenService("/preload.cjs");
    let mints = 0;
    const expiresAt = Date.now() + 60 * 60_000;
    const win = await startWorker(service, (_method, payload) => {
      mints++;
      return { token: `token-${payload.identifier}`, expiresAt };
    });

    await expect(service.mint("video")).resolves.toBe("token-video");
    await expect(service.mint("video")).resolves.toBe("token-video");
    expect(mints).toBe(2);

    win.destroy();
    await expect(service.mint("video")).resolves.toBe("token-video");
    expect(live()).toHaveLength(0);
  });

  it("shuts the hidden window down once idle and keeps it while playing", async () => {
    const service = new PoTokenService("/preload.cjs");
    await startWorker(service, () => ({
      token: "t",
      expiresAt: Date.now() + 60 * 60_000,
    }));

    service.setPlaybackActive(true);
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(live()).toHaveLength(1);

    service.setPlaybackActive(false);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(live()).toHaveLength(0);
  });

  it("rewarms on demand only after it has been used", async () => {
    const unused = new PoTokenService("/preload.cjs");
    unused.warm();
    expect(electron.windows).toHaveLength(0);

    const service = new PoTokenService("/preload.cjs");
    await startWorker(service, () => ({ token: "t", expiresAt: 0 }));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(live()).toHaveLength(0);

    service.warm();
    expect(live()).toHaveLength(1);
  });

  it("only asks the worker for n values it has not solved yet", async () => {
    const service = new PoTokenService("/preload.cjs");
    const asked: string[][] = [];
    await startWorker(service, (method, payload) => {
      if (method !== "solve-n") return { token: "t", expiresAt: 0 };
      asked.push(payload.values);
      return {
        signatureTimestamp: 42,
        values: payload.values.map((value: string) => `${value}!`),
      };
    });

    await expect(service.solveN("player", ["a", "b"], 1000)).resolves.toEqual({
      signatureTimestamp: 42,
      values: ["a!", "b!"],
    });
    await expect(service.solveN("player", ["b", "c"], 1000)).resolves.toEqual({
      signatureTimestamp: 42,
      values: ["b!", "c!"],
    });
    await service.solveN("player", ["a", "c"], 1000);
    expect(asked).toEqual([["a", "b"], ["c"]]);
  });

  it("reuses the tv session across a worker restart", async () => {
    const service = new PoTokenService("/preload.cjs");
    let sessions = 0;
    const win = await startWorker(service, (method) => {
      if (method !== "tv-session") return { token: "t", expiresAt: 0 };
      sessions++;
      return {
        session: { poToken: "tv" },
        expiresAt: Date.now() + 60 * 60_000,
      };
    });

    await expect(service.getTvSession(1000)).resolves.toEqual({
      poToken: "tv",
    });
    win.destroy();
    await expect(service.getTvSession(1000)).resolves.toEqual({
      poToken: "tv",
    });
    expect(sessions).toBe(1);
  });
});

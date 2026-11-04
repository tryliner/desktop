import { afterEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const listeners = new Map<string, (...args: unknown[]) => unknown>();
  return {
    handlers,
    listeners,
    openExternal: vi.fn(async (_url: string) => {}),
    module: {
      ipcMain: {
        handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
          handlers.set(channel, handler),
        on: (channel: string, listener: (...args: unknown[]) => unknown) =>
          listeners.set(channel, listener),
      },
      shell: {
        openExternal: (url: string) => electron.openExternal(url),
      },
    },
  };
});

vi.mock("electron", () => electron.module);

import {
  confineToApp,
  handleTrusted,
  isAppUrl,
  isTrustedSender,
  onTrusted,
} from "./ipc-guard";

const DEV = "http://localhost:5173/";
const fromFrame = (url: string | undefined) =>
  ({ senderFrame: url === undefined ? null : { url } }) as never;

afterEach(() => {
  vi.unstubAllEnvs();
  electron.handlers.clear();
  electron.listeners.clear();
  electron.openExternal.mockClear();
});

describe("isAppUrl", () => {
  it("trusts only file urls when packaged", () => {
    expect(isAppUrl("file:///C:/app/dist/index.html#/overlay", "")).toBe(true);
    expect(isAppUrl("http://localhost:5173/", "")).toBe(false);
    expect(isAppUrl("https://evil.example/", "")).toBe(false);
  });

  it("trusts only the dev server origin in development", () => {
    expect(isAppUrl("http://localhost:5173/#/overlay", DEV)).toBe(true);
    expect(isAppUrl("http://localhost:5174/", DEV)).toBe(false);
    expect(isAppUrl("http://localhost.evil.example:5173/", DEV)).toBe(false);
    expect(isAppUrl("file:///C:/app/dist/index.html", DEV)).toBe(false);
  });

  it("rejects missing or malformed urls", () => {
    expect(isAppUrl(undefined, "")).toBe(false);
    expect(isAppUrl("", "")).toBe(false);
    expect(isAppUrl("not a url", "")).toBe(false);
    expect(isAppUrl("http://localhost:5173/", "not a url")).toBe(false);
  });
});

describe("isTrustedSender", () => {
  it("needs a live sender frame on the app origin", () => {
    vi.stubEnv("VITE_DEV_SERVER_URL", "");
    expect(isTrustedSender(fromFrame("file:///app/index.html"))).toBe(true);
    expect(isTrustedSender(fromFrame("https://www.youtube.com/"))).toBe(false);
    expect(isTrustedSender(fromFrame(undefined))).toBe(false);
  });
});

describe("guarded ipc", () => {
  it("runs handlers for app frames and throws for foreign ones", async () => {
    vi.stubEnv("VITE_DEV_SERVER_URL", DEV);
    const handler = vi.fn((_event: unknown, value: number) => value * 2);
    handleTrusted("test:double", handler);
    const registered = electron.handlers.get("test:double")!;

    expect(await registered(fromFrame("http://localhost:5173/"), 21)).toBe(42);
    expect(() => registered(fromFrame("https://evil.example/"), 21)).toThrow(
      "untrusted sender for test:double",
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores foreign senders on listeners and answers sync calls with null", () => {
    vi.stubEnv("VITE_DEV_SERVER_URL", "");
    const listener = vi.fn((event: { returnValue?: unknown }) => {
      event.returnValue = "secret";
    });
    onTrusted("test:get", listener as never);
    const registered = electron.listeners.get("test:get")!;

    const foreign = {
      senderFrame: { url: "https://evil.example/" },
    } as { returnValue?: unknown };
    registered(foreign);
    expect(listener).not.toHaveBeenCalled();
    expect(foreign.returnValue).toBeNull();

    const own = { senderFrame: { url: "file:///app/index.html" } } as {
      returnValue?: unknown;
    };
    registered(own);
    expect(own.returnValue).toBe("secret");
  });
});

describe("confineToApp", () => {
  function fakeContents() {
    const events = new Map<string, (...args: unknown[]) => void>();
    let openHandler: ((details: { url: string }) => unknown) | null = null;
    return {
      contents: {
        on: (name: string, fn: (...args: unknown[]) => void) =>
          events.set(name, fn),
        setWindowOpenHandler: (fn: (details: { url: string }) => unknown) => {
          openHandler = fn;
        },
      },
      emit: (name: string, url: string) => {
        const event = { preventDefault: vi.fn() };
        events.get(name)?.(event, url);
        return event.preventDefault;
      },
      open: (url: string) => openHandler?.({ url }),
    };
  }

  it("keeps navigation on the app and hands web links to the browser", () => {
    vi.stubEnv("VITE_DEV_SERVER_URL", "");
    const page = fakeContents();
    confineToApp(page.contents as never);

    expect(
      page.emit("will-navigate", "file:///app/index.html"),
    ).not.toBeCalled();
    expect(page.emit("will-navigate", "https://evil.example/")).toBeCalled();
    expect(electron.openExternal).toHaveBeenCalledWith("https://evil.example/");

    electron.openExternal.mockClear();
    expect(page.emit("will-navigate", "javascript:alert(1)")).toBeCalled();
    expect(page.emit("will-redirect", "https://evil.example/")).toBeCalled();
    expect(electron.openExternal).not.toHaveBeenCalled();
  });

  it("denies new windows and only opens http links externally", () => {
    vi.stubEnv("VITE_DEV_SERVER_URL", DEV);
    const page = fakeContents();
    confineToApp(page.contents as never);

    expect(page.open("https://tryliner.fun/")).toEqual({ action: "deny" });
    expect(page.open("file:///C:/Windows/System32/calc.exe")).toEqual({
      action: "deny",
    });
    expect(electron.openExternal).toHaveBeenCalledTimes(1);
    expect(electron.openExternal).toHaveBeenCalledWith("https://tryliner.fun/");
    expect(
      page.emit("will-navigate", "http://localhost:5173/#/x"),
    ).not.toBeCalled();
  });
});

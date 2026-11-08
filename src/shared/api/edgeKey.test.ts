import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as object | null }));
vi.mock("./auth-session", () => ({ getAuthSession: () => session.current }));

import {
  heldEdgeKey,
  initEdgeKey,
  nextRefreshDelay,
  refreshEdgeKey,
} from "./edgeKey";

const KEY = "k".repeat(32);

describe("edge key", () => {
  let stop: (() => void) | undefined;
  const handed: (string | null)[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    handed.length = 0;
    (window as unknown as { linerElectron: object }).linerElectron = {
      setEdgeKey: (key: string | null) => handed.push(key),
    };
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    session.current = null;
    vi.useRealTimers();
  });

  it("refreshes two minutes before the rotation, within one and ten minutes", () => {
    const now = Date.parse("2026-11-08T12:00:00Z");
    expect(nextRefreshDelay("2026-11-08T12:30:00Z", now)).toBe(10 * 60_000);
    expect(nextRefreshDelay("2026-11-08T12:07:00Z", now)).toBe(5 * 60_000);
    expect(nextRefreshDelay("2026-11-08T12:01:00Z", now)).toBe(60_000);
    expect(nextRefreshDelay("soon", now)).toBe(10 * 60_000);
  });

  it("asks for a key once signed in, hands it to the main process and keeps it fresh", async () => {
    session.current = { accessToken: "a" };
    const fetchKey = vi.fn(async () => ({
      key: KEY,
      rotatesAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    }));
    stop = initEdgeKey(fetchKey);
    await vi.waitFor(() => expect(handed).toEqual([KEY]));
    expect(heldEdgeKey()).toBe(KEY);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetchKey).toHaveBeenCalledTimes(2);
  });

  it("drops the key on sign-out and asks nothing while signed out", async () => {
    const fetchKey = vi.fn(async () => ({
      key: KEY,
      rotatesAt: new Date().toISOString(),
    }));
    stop = initEdgeKey(fetchKey);
    expect(await refreshEdgeKey()).toBe(false);
    expect(fetchKey).not.toHaveBeenCalled();
    expect(handed.at(-1)).toBeNull();
  });

  it("keeps the old key when the server has none and tries again later", async () => {
    session.current = { accessToken: "a" };
    let fail = false;
    const fetchKey = vi.fn(async () => {
      if (fail) throw new Error("503");
      return {
        key: KEY,
        rotatesAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      };
    });
    stop = initEdgeKey(fetchKey);
    await vi.waitFor(() => expect(heldEdgeKey()).toBe(KEY));
    fail = true;
    expect(await refreshEdgeKey()).toBe(false);
    expect(heldEdgeKey()).toBe(KEY);
  });

  it("shares one request between callers", async () => {
    session.current = { accessToken: "a" };
    let release: (() => void) | undefined;
    const fetchKey = vi.fn(
      () =>
        new Promise<{ key: string; rotatesAt: string }>((resolve) => {
          release = () =>
            resolve({ key: KEY, rotatesAt: new Date().toISOString() });
        }),
    );
    stop = initEdgeKey(fetchKey);
    const again = refreshEdgeKey();
    release?.();
    expect(await again).toBe(true);
    expect(fetchKey).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryCache } from "./queryCache";

beforeEach(() => { vi.useFakeTimers(); queryCache.clear(); });
afterEach(() => { queryCache.clear(); vi.useRealTimers(); });

describe("bounded query cache", () => {
  it("releases expired entries without reading them again", () => {
    for (let i = 0; i < 100; i++) queryCache.set(`q${i}`, { payload: "value" }, 100, 1000);
    vi.advanceTimersByTime(1001);
    expect(queryCache.getStats().count).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps recently read entries when capacity is exceeded", () => {
    for (let i = 0; i < 100; i++) queryCache.set(`q${i}`, i);
    expect(queryCache.get("q0")).toBe(0);
    queryCache.set("new", 100);
    expect(queryCache.getStats().count).toBe(100);
    expect(queryCache.get("q0")).toBe(0);
    expect(queryCache.get("q1")).toBeUndefined();
  });

  it("reschedules expiry when an entry is refreshed", () => {
    queryCache.set("q", "old", 100, 1000);
    vi.advanceTimersByTime(900);
    queryCache.set("q", "new", 100, 1000);
    vi.advanceTimersByTime(101);
    expect(queryCache.get("q")).toBe("new");
    vi.advanceTimersByTime(900);
    expect(queryCache.get("q")).toBeUndefined();
  });
});

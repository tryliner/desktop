import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_PRIMARY_API,
  getApiBaseUrl,
  setApiBaseUrl,
  initApiEndpointProbe,
  resetEndpointProbe,
} from "./baseUrl";

describe("baseUrl endpoint manager & probe", () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, string>();

  const localStorageMock = {
    getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn((key: string, val: string) => {
      storageMap.set(key, val);
    }),
    removeItem: vi.fn((key: string) => {
      storageMap.delete(key);
    }),
    clear: vi.fn(() => {
      storageMap.clear();
    }),
  };

  beforeEach(() => {
    storageMap.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    resetEndpointProbe();
    setApiBaseUrl(DEFAULT_PRIMARY_API);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("refuses a plain http base url to a remote host and keeps the current one", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    storageMap.clear();

    expect(setApiBaseUrl("http://edge.tryliner.fun:10518")).toBe(false);
    expect(setApiBaseUrl("not a url")).toBe(false);
    expect(getApiBaseUrl()).toBe(DEFAULT_PRIMARY_API);
    expect(storageMap.has("liner_active_api_base")).toBe(false);
  });

  it("accepts https and plain http to loopback", () => {
    expect(setApiBaseUrl("https://staging.example.com/")).toBe(true);
    expect(getApiBaseUrl()).toBe("https://staging.example.com");

    for (const url of ["http://localhost:1337", "http://127.0.0.1:1337", "http://[::1]:1337"]) {
      expect(setApiBaseUrl(url)).toBe(true);
      expect(getApiBaseUrl()).toBe(url);
    }
  });

  it("stays on the https primary api when health probe fails", async () => {
    resetEndpointProbe();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const endpoint = await initApiEndpointProbe(500);
    expect(endpoint).toBe(DEFAULT_PRIMARY_API);
    expect(getApiBaseUrl()).toBe(DEFAULT_PRIMARY_API);
  });

  it("preserves primary api when health probe succeeds", async () => {
    resetEndpointProbe();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const endpoint = await initApiEndpointProbe(500);
    expect(endpoint).toBe(DEFAULT_PRIMARY_API);
    expect(getApiBaseUrl()).toBe(DEFAULT_PRIMARY_API);
    expect(storageMap.get("liner_active_api_base")).toBe(DEFAULT_PRIMARY_API);
  });
});

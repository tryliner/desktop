import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_PRIMARY_API,
  FALLBACK_EDGE_API,
  getApiBaseUrl,
  setApiBaseUrl,
  switchToFallbackEdge,
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

  it("defaults to primary api and persists when switching to edge", () => {
    expect(getApiBaseUrl()).toBe(DEFAULT_PRIMARY_API);
    const switched = switchToFallbackEdge();
    expect(switched).toBe(true);
    expect(getApiBaseUrl()).toBe(FALLBACK_EDGE_API);
    expect(storageMap.get("liner_active_api_base")).toBe(FALLBACK_EDGE_API);
  });

  it("switches to edge relay when health probe fails", async () => {
    resetEndpointProbe();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const endpoint = await initApiEndpointProbe(500);
    expect(endpoint).toBe(FALLBACK_EDGE_API);
    expect(getApiBaseUrl()).toBe(FALLBACK_EDGE_API);
    expect(storageMap.get("liner_active_api_base")).toBe(FALLBACK_EDGE_API);
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

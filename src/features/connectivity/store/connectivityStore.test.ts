import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectivityStore } from "./connectivityStore";

vi.mock("../lib/diagnostics", () => ({
  runAllChecks: vi.fn().mockResolvedValue({ checks: [], main: null }),
}));

describe("connectivityStore trip logic", () => {
  beforeEach(() => {
    useConnectivityStore.getState().reset();
    vi.useFakeTimers();
  });

  it("trips the wall on 3 failures inside a minute", () => {
    const { recordFailure } = useConnectivityStore.getState();
    recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    expect(useConnectivityStore.getState().tripped).toBe(false);
    recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    expect(useConnectivityStore.getState().tripped).toBe(false);
    recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    const state = useConnectivityStore.getState();
    expect(state.tripped).toBe(true);
    expect(state.visible).toBe(true);
    expect(state.failures).toHaveLength(3);
  });

  it("lets old failures age out of the window", () => {
    const store = useConnectivityStore.getState();
    store.recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    store.recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    vi.advanceTimersByTime(61_000);
    useConnectivityStore.getState().recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    useConnectivityStore.getState().recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    expect(useConnectivityStore.getState().tripped).toBe(false);
  });

  it("caps the failure log", () => {
    for (let i = 0; i < 30; i++) {
      useConnectivityStore.getState().recordFailure({ method: "GET", path: "/v1/me", latencyMs: 1 });
    }
    expect(useConnectivityStore.getState().failures.length).toBeLessThanOrEqual(20);
  });
});

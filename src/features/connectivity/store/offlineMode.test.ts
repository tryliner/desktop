import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RESTORE_SUCCESS_COUNT,
  isOfflineModeActive,
  recordConnectivitySuccess,
  useConnectivityStore,
} from "./connectivityStore";
import { runAllChecks } from "../lib/diagnostics";

vi.mock("../lib/diagnostics", () => ({
  runAllChecks: vi.fn().mockResolvedValue({ checks: [], main: null }),
  DIAG_ENDPOINTS: { api: "https://api.tryliner.fun", covers: "https://covers.tryliner.fun", link: "https://link.tryliner.fun" },
}));

const failure = { method: "GET", path: "/v1/me", status: 503, latencyMs: 5 };

describe("connectivity offline mode", () => {
  beforeEach(() => {
    useConnectivityStore.getState().reset();
    useConnectivityStore.setState({ restoredAt: undefined });
    vi.mocked(runAllChecks).mockResolvedValue({ checks: [], main: null });
  });

  it("hides the wall when the user opens downloaded music", () => {
    const store = useConnectivityStore.getState();
    for (let i = 0; i < 3; i++) store.recordFailure(failure);
    expect(useConnectivityStore.getState().visible).toBe(true);

    useConnectivityStore.getState().enterOfflineMode();
    const state = useConnectivityStore.getState();
    expect(state.visible).toBe(false);
    expect(state.offlineMode).toBe(true);
    expect(isOfflineModeActive()).toBe(true);
  });

  it("keeps recording failures without bringing the wall back while offline", () => {
    useConnectivityStore.getState().enterOfflineMode();
    for (let i = 0; i < 5; i++) useConnectivityStore.getState().recordFailure(failure);
    const state = useConnectivityStore.getState();
    expect(state.visible).toBe(false);
    expect(state.tripped).toBe(true);
    expect(state.failures).toHaveLength(5);
  });

  it("leaves offline mode after a few successful api answers in a row", () => {
    useConnectivityStore.getState().enterOfflineMode();
    useConnectivityStore.getState().recordFailure(failure);

    for (let i = 0; i < RESTORE_SUCCESS_COUNT - 1; i++) recordConnectivitySuccess();
    expect(useConnectivityStore.getState().offlineMode).toBe(true);
    expect(useConnectivityStore.getState().restoredAt).toBeUndefined();

    recordConnectivitySuccess();

    const state = useConnectivityStore.getState();
    expect(state.offlineMode).toBe(false);
    expect(state.tripped).toBe(false);
    expect(state.failures).toHaveLength(0);
    expect(state.restoredAt).toBeTypeOf("number");
  });

  it("stays offline when the server flaps between answers and errors", () => {
    useConnectivityStore.getState().enterOfflineMode();
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < RESTORE_SUCCESS_COUNT - 1; i++) recordConnectivitySuccess();
      useConnectivityStore.getState().recordFailure(failure);
    }
    const state = useConnectivityStore.getState();
    expect(state.offlineMode).toBe(true);
    expect(state.visible).toBe(false);
  });

  it("does not announce a restore when the user simply leaves offline mode", () => {
    useConnectivityStore.getState().enterOfflineMode();
    useConnectivityStore.getState().exitOfflineMode();
    expect(useConnectivityStore.getState().restoredAt).toBeUndefined();
  });

  it("does nothing on success when offline mode is off", () => {
    for (let i = 0; i < 3; i++) useConnectivityStore.getState().recordFailure(failure);

    recordConnectivitySuccess();

    const state = useConnectivityStore.getState();
    expect(state.visible).toBe(true);
    expect(state.tripped).toBe(true);
  });

  it("shows the wall again after offline mode ends and the server fails again", () => {
    useConnectivityStore.getState().enterOfflineMode();
    for (let i = 0; i < RESTORE_SUCCESS_COUNT; i++) recordConnectivitySuccess();
    for (let i = 0; i < 3; i++) useConnectivityStore.getState().recordFailure(failure);
    expect(useConnectivityStore.getState().visible).toBe(true);
  });

  it("leaves offline mode when a retry reaches the api", async () => {
    useConnectivityStore.getState().enterOfflineMode();
    vi.mocked(runAllChecks).mockResolvedValue({
      checks: [{ id: "api", status: "ok" }],
      main: null,
    } as never);

    await useConnectivityStore.getState().retry();

    const state = useConnectivityStore.getState();
    expect(state.offlineMode).toBe(false);
    expect(state.visible).toBe(false);
  });

  it("stays offline when a retry still fails", async () => {
    useConnectivityStore.getState().enterOfflineMode();
    vi.mocked(runAllChecks).mockResolvedValue({
      checks: [{ id: "api", status: "fail", detail: "HTTP 503" }],
      main: null,
    } as never);

    await useConnectivityStore.getState().retry();

    const state = useConnectivityStore.getState();
    expect(state.offlineMode).toBe(true);
    expect(state.visible).toBe(false);
  });
});

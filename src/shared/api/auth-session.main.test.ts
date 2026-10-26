import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthTokens } from "../contracts";

type Listener = (session: AuthTokens | null) => void;

const session = (refreshToken: string, accessToken = `access_${refreshToken}`): AuthTokens => ({
  accessToken,
  refreshToken,
  accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
  user: { id: "u1", email: "user@example.com" },
});

function installBridge(stored: AuthTokens | null) {
  const listeners = new Set<Listener>();
  const bridge = {
    stored,
    get: vi.fn(() => bridge.stored),
    set: vi.fn(async (next: AuthTokens | null) => {
      bridge.stored = next;
      return next;
    }),
    refresh: vi.fn(),
    onChange: vi.fn((cb: Listener) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    }),
    broadcast: (next: AuthTokens | null) => {
      bridge.stored = next;
      for (const cb of listeners) cb(next);
    },
  };
  (window as unknown as { linerElectron: unknown }).linerElectron = { authSession: bridge };
  return bridge;
}

async function loadModule() {
  vi.resetModules();
  return import("./auth-session");
}

describe("auth-session backed by the main process", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    delete (window as unknown as { linerElectron?: unknown }).linerElectron;
    vi.restoreAllMocks();
  });

  it("reads the session from main once, not from localStorage", async () => {
    const bridge = installBridge(session("rt_main"));
    const auth = await loadModule();
    expect(auth.getAuthSession()?.refreshToken).toBe("rt_main");
    expect(auth.getAuthSession()?.refreshToken).toBe("rt_main");
    expect(bridge.get).toHaveBeenCalledTimes(1);
  });

  it("moves a legacy localStorage session into main and wipes the plain copy", async () => {
    localStorage.setItem("liner_auth_session", JSON.stringify(session("rt_legacy")));
    const bridge = installBridge(null);
    const auth = await loadModule();
    expect(auth.getAuthSession()?.refreshToken).toBe("rt_legacy");
    expect(bridge.set).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: "rt_legacy" }));
    expect(localStorage.getItem("liner_auth_session")).toBeNull();
  });

  it("prefers main over a stale legacy copy", async () => {
    localStorage.setItem("liner_auth_session", JSON.stringify(session("rt_stale")));
    const bridge = installBridge(session("rt_main"));
    const auth = await loadModule();
    expect(auth.getAuthSession()?.refreshToken).toBe("rt_main");
    expect(bridge.set).not.toHaveBeenCalled();
    expect(localStorage.getItem("liner_auth_session")).toBeNull();
  });

  it("saves through main and never writes the token to localStorage", async () => {
    const bridge = installBridge(null);
    const auth = await loadModule();
    auth.setAuthSession(session("rt_login"));
    expect(bridge.set).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: "rt_login" }));
    expect(localStorage.getItem("liner_auth_session")).toBeNull();
  });

  it("delegates refresh to main and adopts the result", async () => {
    const bridge = installBridge(session("rt_1"));
    bridge.refresh.mockResolvedValue({ outcome: "refreshed", session: session("rt_2") });
    const auth = await loadModule();
    const [a, b] = await Promise.all([auth.refreshAuthSession(), auth.refreshAuthSession()]);
    expect(bridge.refresh).toHaveBeenCalledTimes(1);
    expect(bridge.refresh).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: "rt_1" }));
    expect(a?.refreshToken).toBe("rt_2");
    expect(b?.refreshToken).toBe("rt_2");
    expect(auth.getAuthSession()?.refreshToken).toBe("rt_2");
  });

  it("keeps the session when main reports a transient failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const bridge = installBridge(session("rt_1"));
    bridge.refresh.mockResolvedValue({ outcome: "transient", session: session("rt_1"), reason: "503" });
    const auth = await loadModule();
    expect(await auth.refreshAuthSession()).toBeNull();
    expect(auth.getAuthSession()?.refreshToken).toBe("rt_1");
  });

  it("drops the session when main says the refresh token is dead", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const bridge = installBridge(session("rt_1"));
    bridge.refresh.mockResolvedValue({ outcome: "signed_out", session: null, reason: "401 INVALID_REFRESH_TOKEN" });
    const auth = await loadModule();
    expect(await auth.refreshAuthSession()).toBeNull();
    expect(auth.getAuthSession()).toBeNull();
  });

  it("follows sessions rotated by another window", async () => {
    const bridge = installBridge(session("rt_1"));
    const auth = await loadModule();
    auth.getAuthSession();
    const changed = vi.fn();
    window.addEventListener("auth:changed", changed);
    bridge.broadcast(session("rt_other"));
    window.removeEventListener("auth:changed", changed);
    expect(auth.getAuthSession()?.refreshToken).toBe("rt_other");
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

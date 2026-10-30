import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { YoutubeAuthTokens } from "./tvTokens";

const STORAGE_KEY = "liner_youtube_tv_session";

const deviceFlow = vi.hoisted(() => ({ poll: vi.fn() }));
vi.mock("./tvOauthClient", () => ({
  getTvOauthClient: async () => ({ clientId: "id", clientSecret: "secret" }),
}));
vi.mock("./tvDeviceFlow", () => ({
  requestTvDeviceCode: vi.fn(),
  pollTvDeviceToken: deviceFlow.poll,
}));

const tokens = (refreshToken: string): YoutubeAuthTokens => ({
  accessToken: `access_${refreshToken}`,
  refreshToken,
  tokenType: "Bearer",
  expiresAt: Date.now() + 3_600_000,
});

function installBridge(stored: YoutubeAuthTokens | null, writable = true) {
  const bridge = {
    stored,
    get: vi.fn(() => bridge.stored),
    set: vi.fn(async (next: YoutubeAuthTokens | null) => {
      if (!writable) return false;
      bridge.stored = next;
      return true;
    }),
  };
  (window as unknown as { linerElectron: unknown }).linerElectron = {
    youtubeAuthSession: bridge,
  };
  return bridge;
}

async function loadModule() {
  vi.resetModules();
  return import("./youtubeAuthSession");
}

describe("youtube auth session backed by the main process", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    delete (window as unknown as { linerElectron?: unknown }).linerElectron;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("moves plain localStorage tokens into main once and wipes them", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens("rt_legacy")));
    const bridge = installBridge(null);
    const auth = await loadModule();
    expect(auth.getYoutubeAuthTokens()?.refreshToken).toBe("rt_legacy");
    expect(bridge.set).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "rt_legacy" }),
    );
    await vi.waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull(),
    );

    const restarted = await loadModule();
    expect(restarted.getYoutubeAuthTokens()?.refreshToken).toBe("rt_legacy");
    expect(bridge.set).toHaveBeenCalledTimes(1);
  });

  it("keeps the plain copy when main can't store it, and retries on the next launch", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens("rt_legacy")));
    const bridge = installBridge(null, false);
    const auth = await loadModule();
    expect(auth.getYoutubeAuthTokens()?.refreshToken).toBe("rt_legacy");
    await vi.waitFor(() => expect(bridge.set).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    const restarted = await loadModule();
    expect(restarted.getYoutubeAuthTokens()?.refreshToken).toBe("rt_legacy");
    expect(bridge.set).toHaveBeenCalledTimes(2);
  });

  it("fails the sign-in when main can't store the new tokens", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deviceFlow.poll.mockResolvedValueOnce(tokens("rt_new"));
    installBridge(null, false);
    const auth = await loadModule();
    await expect(auth.completeYoutubeTvSignIn({} as never)).rejects.toThrow(
      /couldn't save/i,
    );
    expect(auth.isYoutubeSignedIn()).toBe(false);
  });

  it("signs out through main without touching localStorage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null)),
    );
    const bridge = installBridge(tokens("rt_main"));
    const auth = await loadModule();
    expect(auth.isYoutubeSignedIn()).toBe(true);
    await auth.signOutYoutube();
    expect(bridge.set).toHaveBeenCalledWith(null);
    expect(bridge.stored).toBeNull();
    expect(auth.isYoutubeSignedIn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to localStorage outside electron", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens("rt_web")));
    const auth = await loadModule();
    expect(auth.getYoutubeAuthTokens()?.refreshToken).toBe("rt_web");
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

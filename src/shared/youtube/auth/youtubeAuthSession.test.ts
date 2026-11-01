import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { YoutubeAuthTokens } from "./tvTokens";

const STORAGE_KEY = "liner_youtube_tv_session";

const tokens = (refreshToken: string): YoutubeAuthTokens => ({
  accessToken: `access_${refreshToken}`,
  refreshToken,
  tokenType: "Bearer",
  expiresAt: Date.now() + 3_600_000,
});

function installBridge(stored: YoutubeAuthTokens | null) {
  const bridge = {
    stored,
    get: vi.fn(() => bridge.stored),
    set: vi.fn(async (next: YoutubeAuthTokens | null) => {
      bridge.stored = next;
      return next;
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
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    const restarted = await loadModule();
    expect(restarted.getYoutubeAuthTokens()?.refreshToken).toBe("rt_legacy");
    expect(bridge.set).toHaveBeenCalledTimes(1);
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

  it("keeps a shared refresh alive when the caller that started it aborts", async () => {
    vi.doMock("./tvOauthClient", () => ({
      getTvOauthClient: async () => ({
        clientId: "id",
        clientSecret: "secret",
      }),
    }));
    let finishRefresh = (_response: Response) => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
            finishRefresh = resolve;
          }),
      ),
    );
    const bridge = installBridge({ ...tokens("rt_shared"), expiresAt: 0 });
    const auth = await loadModule();
    const first = new AbortController();
    const firstAuthorization = auth.getYoutubeAuthorization(first.signal);
    const secondAuthorization = auth.getYoutubeAuthorization();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    first.abort();
    await expect(firstAuthorization).rejects.toThrow();
    finishRefresh(Response.json({ access_token: "fresh", expires_in: 3600 }));
    await expect(secondAuthorization).resolves.toBe("Bearer fresh");
    expect(bridge.stored?.accessToken).toBe("fresh");
    vi.doUnmock("./tvOauthClient");
  });

  it("falls back to localStorage outside electron", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens("rt_web")));
    const auth = await loadModule();
    expect(auth.getYoutubeAuthTokens()?.refreshToken).toBe("rt_web");
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

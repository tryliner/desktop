import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// the player feature pulls lottie/canvas ui that jsdom cannot load; initialize() never touches it
const player = vi.hoisted(() => ({ stopAndClear: vi.fn(async () => {}) }));
vi.mock("@/features/player", () => ({ playerEngine: player }));
const youtube = vi.hoisted(() => ({ signOut: vi.fn(async () => {}) }));
vi.mock("@/shared/youtube", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/youtube")>()),
  signOutYoutube: youtube.signOut,
}));

import { useAuthStore } from "./authStore";
import { useYoutubePreferences } from "@/shared/youtube";
import {
  api,
  ApiError,
  getAuthSession,
  registerSignOutTask,
  setAuthSession,
  type AuthTokens,
} from "@/shared/api";

const stored = {
  accessToken: "expired-access",
  refreshToken: "refresh-1",
  user: { id: "u1", username: "leo" },
} as unknown as AuthTokens;

describe("authStore.initialize — expired access token at launch", () => {
  beforeEach(() => {
    setAuthSession(stored);
    useAuthStore.setState({ status: "initializing", user: null });
    vi.spyOn(api, "getMe").mockRejectedValue(new ApiError(401, "Unauthorized"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAuthSession(null);
  });

  it("keeps the session when the refresh fails for a transient reason (server down)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("error code: 525", { status: 525 }),
    );

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(getAuthSession()?.refreshToken).toBe("refresh-1");
  });

  it("signs out when the server rejects the refresh token", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ code: "INVALID_REFRESH_TOKEN" }), {
          status: 401,
        }),
    );

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(getAuthSession()).toBeNull();
  });

  it("stays signed in when a refresh 401 carries no token verdict", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("{}", { status: 401 }),
    );

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(getAuthSession()?.refreshToken).toBeTruthy();
  });
});

describe("signing out clears the player", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    player.stopAndClear.mockReset();
    player.stopAndClear.mockImplementation(async () => {});
    setAuthSession(null);
  });

  it("logout stops playback while the old account's token still exists", async () => {
    setAuthSession(stored);
    useAuthStore.setState({ status: "authenticated", user: stored.user });
    let sessionDuringStop: unknown = "not called";
    player.stopAndClear.mockImplementation(async () => {
      if (sessionDuringStop === "not called")
        sessionDuringStop = getAuthSession();
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await useAuthStore.getState().logout();

    expect(sessionDuringStop).toMatchObject({ refreshToken: "refresh-1" });
    expect(getAuthSession()).toBeNull();
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("clears the player whenever the app ends up signed out", async () => {
    useAuthStore.setState({ status: "initializing", user: null });
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(player.stopAndClear).toHaveBeenCalled();
  });

  it("does not hang logout when the player never finishes", async () => {
    vi.useFakeTimers();
    try {
      setAuthSession(stored);
      useAuthStore.setState({ status: "authenticated", user: stored.user });
      player.stopAndClear.mockImplementation(() => new Promise(() => {}));
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 204 }),
      );
      const loggingOut = useAuthStore.getState().logout();
      await vi.advanceTimersByTimeAsync(3_000);
      await loggingOut;
      expect(useAuthStore.getState().status).toBe("anonymous");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("signing out runs the device cleanup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setAuthSession(null);
  });

  it("runs sign-out tasks once the session is gone and before going anonymous", async () => {
    setAuthSession(stored);
    useAuthStore.setState({ status: "authenticated", user: stored.user });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const seen: Array<{ session: unknown; status: string }> = [];
    const unregister = registerSignOutTask(async () => {
      seen.push({
        session: getAuthSession(),
        status: useAuthStore.getState().status,
      });
    });
    try {
      await useAuthStore.getState().logout();
    } finally {
      unregister();
    }

    expect(seen).toEqual([{ session: null, status: "authenticated" }]);
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("finishes signing out when a cleanup task fails", async () => {
    setAuthSession(stored);
    useAuthStore.setState({ status: "authenticated", user: stored.user });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const unregister = registerSignOutTask(async () => {
      throw new Error("disk busy");
    });
    try {
      await useAuthStore.getState().logout();
    } finally {
      unregister();
    }

    expect(useAuthStore.getState().status).toBe("anonymous");
  });
});

describe("signing out of liner and the youtube account", () => {
  beforeEach(() => {
    setAuthSession(stored);
    useAuthStore.setState({ status: "authenticated", user: stored.user });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    youtube.signOut.mockClear();
    useYoutubePreferences.setState({ signOutWithLiner: false });
    setAuthSession(null);
  });

  it("keeps the youtube account by default", async () => {
    await useAuthStore.getState().logout();

    expect(youtube.signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("signs out of youtube too when the setting asks for it", async () => {
    useYoutubePreferences.setState({ signOutWithLiner: true });

    await useAuthStore.getState().logout();

    expect(youtube.signOut).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe("anonymous");
  });
});

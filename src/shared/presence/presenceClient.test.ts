import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PresenceClient } from "./presenceClient";
import * as authSession from "../api/auth-session";

describe("PresenceClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(null, { status: 204, headers: { "x-liner-heartbeat-interval": "60" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(authSession, "getValidAccessToken").mockResolvedValue("test-valid-jwt-token");
    vi.spyOn(authSession, "getAuthSession").mockReturnValue({
      accessToken: "test-valid-jwt-token",
      refreshToken: "test-refresh-token",
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "alice@example.com",
        username: "alice",
        displayName: "Alice",
        avatarUrl: null,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts a heartbeat on start and adopts the interval the server suggests", async () => {
    const client = new PresenceClient(100);
    client.start();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v1/presence/heartbeat");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer test-valid-jwt-token");
    expect(JSON.parse(init.body).username).toBe("alice");

    expect(client.getIntervalMs()).toBe(60_000);
    client.stop();
  });

  it("keeps beating on its own interval when the server suggests none, and stops on stop()", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    const client = new PresenceClient(50);
    client.start();
    await new Promise((resolve) => setTimeout(resolve, 130));
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    client.stop();

    const calls = fetchMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("does not beat if user is not authenticated", async () => {
    vi.spyOn(authSession, "getValidAccessToken").mockResolvedValue(null);
    vi.spyOn(authSession, "getAuthSession").mockReturnValue(null);

    const client = new PresenceClient(100);
    client.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    client.stop();
  });
});

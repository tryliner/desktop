import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PresenceClient } from "./presenceClient";
import * as authSession from "../api/auth-session";

describe("PresenceClient", () => {
  let mockSockets: any[] = [];

  class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = MockWebSocket.OPEN;
    sentData: string[] = [];
    url: string;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((ev: any) => void) | null = null;

    constructor(url: string) {
      this.url = url;
      mockSockets.push(this);
      setTimeout(() => {
        if (this.onopen) this.onopen();
      }, 0);
    }

    send(data: string) {
      this.sentData.push(data);
    }

    close() {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) this.onclose();
    }
  }

  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    mockSockets = [];
    (globalThis as any).WebSocket = MockWebSocket;
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
    globalThis.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it("connects, sends init payload on open, and triggers periodic pings", async () => {
    const client = new PresenceClient(100);
    client.start();

    // wait for connect and open
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockSockets.length).toBe(1);
    const socket = mockSockets[0];
    expect(socket.url).toContain("/v1/ping/ws");
    expect(socket.sentData.length).toBe(1);

    const initData = JSON.parse(socket.sentData[0]);
    expect(initData.token).toBe("test-valid-jwt-token");
    expect(initData.userId).toBe("11111111-1111-1111-1111-111111111111");
    expect(initData.username).toBe("alice");

    // wait for ping interval
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(socket.sentData.slice(1)).toContain("p");

    client.stop();
  });

  it("does not connect if user is not authenticated", async () => {
    vi.spyOn(authSession, "getValidAccessToken").mockResolvedValue(null);
    vi.spyOn(authSession, "getAuthSession").mockReturnValue(null);

    const client = new PresenceClient(100);
    client.start();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockSockets.length).toBe(0);

    client.stop();
  });
});

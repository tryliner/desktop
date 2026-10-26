import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionStore, isTrustedApiBase, type SessionCipher, type StoredAuthSession } from "./auth-session-store";

const API = "https://api.example.test";

const session = (refreshToken: string): StoredAuthSession => ({
  accessToken: `access_${refreshToken}`,
  refreshToken,
  accessTokenExpiresAt: "2026-01-01T00:00:00.000Z",
  user: { id: "u1" },
});

const xorCipher: SessionCipher = {
  available: () => true,
  encrypt: (plain) => Buffer.from(Buffer.from(plain, "utf8").map((b) => b ^ 0x5a)),
  decrypt: (data) => Buffer.from(data.map((b) => b ^ 0x5a)).toString("utf8"),
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("AuthSessionStore", () => {
  let dir: string;
  let file: string;
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
  let syncClock: ReturnType<typeof vi.fn<(dateHeader: string) => void>>;

  const createStore = (cipher: SessionCipher = xorCipher) =>
    new AuthSessionStore(file, cipher, {
      fetch: fetchMock,
      syncClock,
    });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "liner-auth-"));
    file = path.join(dir, "auth", "session.json");
    fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
    syncClock = vi.fn<(dateHeader: string) => void>();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("persists the session encrypted and reads it back in a new process", () => {
    createStore().set(session("rt_1"));
    const raw = fs.readFileSync(file, "utf8");
    expect(raw).not.toContain("rt_1");
    expect(JSON.parse(raw).encrypted).toBe(true);
    expect(createStore().get()?.refreshToken).toBe("rt_1");
  });

  it("falls back to plain storage when the os keychain is unavailable", () => {
    const plain = { ...xorCipher, available: () => false };
    createStore(plain).set(session("rt_plain"));
    expect(JSON.parse(fs.readFileSync(file, "utf8")).encrypted).toBe(false);
    expect(createStore(plain).get()?.refreshToken).toBe("rt_plain");
  });

  it("leaves no temp files behind and removes the file on sign out", () => {
    const store = createStore();
    store.set(session("rt_1"));
    store.set(session("rt_2"));
    expect(fs.readdirSync(path.dirname(file))).toEqual(["session.json"]);
    store.set(null);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("rejects malformed sessions instead of storing them", () => {
    const store = createStore();
    expect(store.set({ accessToken: "a" })).toBeNull();
    expect(fs.existsSync(file)).toBe(false);
  });

  it("treats an unreadable file as signed out", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "garbage");
    expect(createStore().get()).toBeNull();
  });

  it("refreshes once for parallel callers and persists before answering", async () => {
    const store = createStore();
    store.set(session("rt_1"));
    fetchMock.mockResolvedValue(json(200, { accessToken: "access_new", refreshToken: "rt_2" }, { date: "Tue, 21 Oct 2026 10:00:00 GMT" }));
    const [a, b] = await Promise.all([store.refresh(API, "rt_1"), store.refresh(API, "rt_1")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.outcome).toBe("refreshed");
    expect(a.session?.user).toEqual({ id: "u1" });
    expect(syncClock).toHaveBeenCalledWith("Tue, 21 Oct 2026 10:00:00 GMT");
    expect(createStore().get()?.refreshToken).toBe("rt_2");
  });

  it("finishes a refresh even if the window that asked for it reloads", async () => {
    const store = createStore();
    store.set(session("rt_1"));
    let respond: (res: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (respond = resolve)));
    void store.refresh(API, "rt_1");
    respond(json(200, { accessToken: "access_2", refreshToken: "rt_2" }));
    await vi.waitFor(() => expect(createStore().get()?.refreshToken).toBe("rt_2"));
    const afterReload = await store.refresh(API, "rt_1");
    expect(afterReload.outcome).toBe("rotated");
    expect(afterReload.session?.refreshToken).toBe("rt_2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("signs out only on a dead refresh token code", async () => {
    const store = createStore();
    store.set(session("rt_1"));
    fetchMock.mockResolvedValue(json(401, { code: "INVALID_REFRESH_TOKEN" }));
    const result = await store.refresh(API, "rt_1");
    expect(result.outcome).toBe("signed_out");
    expect(result.reason).toBe("401 INVALID_REFRESH_TOKEN");
    expect(store.get()).toBeNull();
    expect(fs.existsSync(file)).toBe(false);
  });

  it("retries a signature rejection and keeps the session if it persists", async () => {
    const store = createStore();
    store.set(session("rt_1"));
    fetchMock.mockImplementation(async () => json(401, { code: "SIGNATURE_SKEWED" }, { date: "Tue, 21 Oct 2026 10:00:00 GMT" }));
    const result = await store.refresh(API, "rt_1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.outcome).toBe("transient");
    expect(store.get()?.refreshToken).toBe("rt_1");
  });

  it("recovers when the retry after a signature rejection succeeds", async () => {
    const store = createStore();
    store.set(session("rt_1"));
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(200, { accessToken: "access_2", refreshToken: "rt_2" }));
    expect((await store.refresh(API, "rt_1")).session?.refreshToken).toBe("rt_2");
  });

  it("keeps the session on server errors and network failures", async () => {
    const store = createStore();
    store.set(session("rt_1"));
    fetchMock.mockResolvedValueOnce(json(503, {}));
    expect((await store.refresh(API, "rt_1")).outcome).toBe("transient");
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const offline = await store.refresh(API, "rt_1");
    expect(offline).toMatchObject({ outcome: "transient", reason: "offline" });
    expect(store.get()?.refreshToken).toBe("rt_1");
  });

  it("does not clobber a fresh login that lands while a refresh is in flight", async () => {
    const store = createStore();
    store.set(session("rt_1"));
    let respond: (res: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (respond = resolve)));
    const pending = store.refresh(API, "rt_1");
    store.set(session("rt_login"));
    respond(json(401, { code: "INVALID_REFRESH_TOKEN" }));
    const result = await pending;
    expect(result.outcome).toBe("rotated");
    expect(store.get()?.refreshToken).toBe("rt_login");
  });

  it("notifies listeners with the window that caused the change", async () => {
    const store = createStore();
    const listener = vi.fn();
    store.onChange(listener);
    store.set(session("rt_1"), 7);
    fetchMock.mockResolvedValue(json(200, { accessToken: "access_2", refreshToken: "rt_2" }));
    await store.refresh(API, "rt_1", 9);
    expect(listener.mock.calls.map(([s, origin]) => [s?.refreshToken, origin])).toEqual([
      ["rt_1", 7],
      ["rt_2", 9],
    ]);
  });

  it("refuses to send the refresh token to an untrusted host", async () => {
    const store = createStore();
    store.set(session("rt_1"));
    expect((await store.refresh("http://evil.example", "rt_1")).outcome).toBe("transient");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isTrustedApiBase("http://localhost:1337")).toBe(true);
  });
});

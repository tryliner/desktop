// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { LastfmApi } from "./lastfm-api";
import { LastfmService } from "./lastfm-service";
import { emptyLastfmData, type LastfmData } from "./lastfm-store";
import type { LastfmListen } from "../src/features/lastfm/contracts";

const credentials = { apiKey: "a".repeat(32), secret: "b".repeat(32) };
const listen = (id = "play"): LastfmListen => ({
  id,
  artist: "Artist",
  track: "Song",
  duration: 180,
  timestamp: 1700000000,
});
const success = (count = 1, ignored = 0) => ({
  scrobbles: {
    scrobble: Array.from({ length: count }, () => ({
      ignoredMessage: { code: String(ignored) },
    })),
  },
});
const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const services: LastfmService[] = [];
afterEach(() => {
  services.splice(0).forEach((service) => service.destroy());
  vi.useRealTimers();
});

function setup(seed: Partial<LastfmData> = {}, authenticated = true) {
  const stored = new Map<string, LastfmData>();
  stored.set("liner-a", {
    ...emptyLastfmData(),
    ...(authenticated
      ? {
          enabled: true,
          session: { username: "lastfm-a", key: "session" },
          username: "lastfm-a",
        }
      : {}),
    ...seed,
  });
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const params = new URLSearchParams(String(init?.body));
    const method = params.get("method");
    const data =
      method === "auth.getToken"
        ? { token: "auth-token" }
        : method === "auth.getSession"
          ? { session: { name: "lastfm-a", key: "new-session" } }
          : method === "track.updateNowPlaying"
            ? { nowplaying: {} }
            : success(
                [...params.keys()].filter((key) => key.startsWith("track["))
                  .length,
              );
    return { ok: true, status: 200, json: async () => data } as Response;
  });
  const save = vi.fn((owner: string, data: LastfmData) => {
    stored.set(owner, structuredClone(data));
  });
  const changed = vi.fn();
  const openBrowser = vi.fn(async () => {});
  const load = vi.fn((owner: string) =>
    structuredClone(stored.get(owner) ?? emptyLastfmData()),
  );
  const service = new LastfmService({
    api: new LastfmApi(fetch),
    credentials,
    secure: () => true,
    load,
    save,
    changed,
    openBrowser,
  });
  services.push(service);
  service.setOwner("liner-a");
  return { service, stored, fetch, save, load, changed, openBrowser };
}

describe("Last.fm settings request state", () => {
  it("preserves pending browser authorization", async () => {
    const { service } = setup({}, false);
    await service.connect();
    service.settings({ nowPlaying: false });
    expect(service.status().authorizing).toBe(true);
    await service.finish();
    expect(service.status()).toMatchObject({
      connected: true,
      nowPlaying: false,
      error: undefined,
    });
  });

  it("does not abort or restart an in-flight batch when settings change", async () => {
    const { service, fetch, stored } = setup();
    let resolve!: (response: Response) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await service.enqueue(listen());
    const signal = fetch.mock.calls[0][1]?.signal;
    service.settings({ nowPlaying: false });
    service.settings({ enabled: false });
    expect(signal?.aborted).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve({ ok: true, json: async () => success() } as Response);
    await settle();
    expect(service.status()).toMatchObject({ pending: 0, enabled: false });
    expect(stored.get("liner-a")?.recent).toEqual(["play"]);
  });

  it("keeps retry backoff when only Now Playing changes", async () => {
    vi.useFakeTimers();
    const { service, fetch } = setup();
    fetch.mockRejectedValueOnce(new Error("offline"));
    await service.enqueue(listen());
    await settle();
    service.settings({ nowPlaying: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(service.status().pending).toBe(0);
  });

  it("clears only the retry timer on disable and preserves the failure count", async () => {
    vi.useFakeTimers();
    const { service, fetch } = setup();
    fetch.mockRejectedValueOnce(new Error("offline"));
    await service.enqueue(listen());
    await settle();
    service.settings({ enabled: false });
    expect(vi.getTimerCount()).toBe(0);
    expect(service.status().pending).toBe(1);
    fetch.mockRejectedValueOnce(new Error("still offline"));
    service.settings({ enabled: true });
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30000);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30000);
    expect(service.status().pending).toBe(0);
  });

  it("rejects settings changes before overwriting unreadable storage", () => {
    const { service, load, save } = setup();
    load.mockImplementationOnce(() => {
      throw new Error("cannot decrypt");
    });
    service.setOwner("unreadable-owner");
    const before = service.status();
    expect(() => service.settings({ nowPlaying: false })).toThrow();
    expect(service.status()).toEqual(before);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps unreadable storage protected after retry and request cancellation", async () => {
    const { service, load, save, fetch } = setup();
    load.mockImplementationOnce(() => {
      throw new Error("cannot decrypt");
    });
    service.setOwner("unreadable-owner");
    await service.retry();
    service.cancel();
    await service.retry();
    expect(service.status().error).toBe("storage_unreadable");
    expect(() => service.settings({ nowPlaying: false })).toThrow();
    await expect(service.connect()).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows settings only after the owner's saved data reloads successfully", () => {
    const { service, load, save, stored } = setup();
    stored.set("unreadable-owner", {
      ...emptyLastfmData(),
      username: "saved-user",
      queue: [listen()],
    });
    load.mockImplementationOnce(() => {
      throw new Error("cannot decrypt");
    });
    service.setOwner("unreadable-owner");
    service.setOwner("unreadable-owner");
    expect(service.status()).toMatchObject({
      username: "saved-user",
      pending: 1,
      error: undefined,
    });
    service.settings({ nowPlaying: false });
    expect(save).toHaveBeenCalledTimes(1);
    expect(stored.get("unreadable-owner")?.queue).toEqual([listen()]);
  });

  it("allows an explicit disconnect to reset unreadable storage", async () => {
    const { service, load, stored } = setup();
    load.mockImplementationOnce(() => {
      throw new Error("cannot decrypt");
    });
    service.setOwner("unreadable-owner");
    await service.retry();
    service.disconnect();
    service.settings({ nowPlaying: false });
    expect(service.status()).toMatchObject({
      connected: false,
      pending: 0,
      nowPlaying: false,
      error: undefined,
    });
    expect(stored.get("unreadable-owner")?.queue).toEqual([]);
  });
});

describe("Last.fm desktop authorization", () => {
  it("keeps a consumed session usable if saving it fails, and reports the storage failure", async () => {
    const { service, save } = setup({}, false);
    await service.connect();
    save.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    await service.finish();
    expect(service.status()).toMatchObject({
      connected: true,
      authorizing: false,
      error: "storage_failed",
    });
  });

  it.each([4, 15])(
    "allows restarting authorization after token error %s",
    async (code) => {
      const { service, fetch } = setup({}, false);
      await service.connect();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: code }),
      } as Response);
      await service.finish();
      expect(service.status()).toMatchObject({
        connected: false,
        authorizing: false,
        error: "authorization_expired",
      });
      await service.connect();
      expect(service.status().authorizing).toBe(true);
    },
  );
  it("opens the system browser, exchanges the token once, and exposes no secrets", async () => {
    const { service, openBrowser, stored } = setup({}, false);
    await service.connect();
    expect(openBrowser).toHaveBeenCalledWith(
      `https://www.last.fm/api/auth/?api_key=${credentials.apiKey}&token=auth-token`,
    );
    expect(service.status().authorizing).toBe(true);
    await service.finish();
    expect(service.status()).toMatchObject({
      connected: true,
      username: "lastfm-a",
      enabled: true,
      authorizing: false,
    });
    expect(stored.get("liner-a")?.session?.key).toBe("new-session");
    expect(JSON.stringify(service.status())).not.toContain("new-session");
    expect(JSON.stringify(service.status())).not.toContain(credentials.secret);
    await service.finish();
    expect(service.status().error).toBe("authorization_expired");
  });

  it("keeps an unapproved token pending and expires it after an hour", async () => {
    vi.useFakeTimers();
    const { service, fetch } = setup({}, false);
    await service.connect();
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 14 }),
    } as Response);
    await service.finish();
    expect(service.status()).toMatchObject({
      authorizing: true,
      error: "authorization_pending",
      connected: false,
    });
    vi.setSystemTime(Date.now() + 3600001);
    await service.finish();
    expect(service.status()).toMatchObject({
      authorizing: false,
      error: "authorization_expired",
    });
  });

  it("ignores a session response after cancellation or account switch", async () => {
    const { service, fetch } = setup({}, false);
    await service.connect();
    let resolve!: (response: Response) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const finishing = service.finish();
    service.setOwner("liner-b");
    resolve({
      ok: true,
      json: async () => ({ session: { name: "old-account", key: "secret" } }),
    } as Response);
    await finishing;
    expect(service.status()).toMatchObject({
      connected: false,
      authorizing: false,
    });
    expect(service.status().username).toBeUndefined();
  });

  it("rejects invalid credentials and discards the former Last.fm account's queue on replacement", async () => {
    const { service, fetch } = setup({ queue: [listen()] });
    await settle();
    await expect(
      service.connect({ apiKey: "bad", secret: "bad" }),
    ).rejects.toThrow();
    await service.connect();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: { name: "lastfm-b", key: "other" } }),
    } as Response);
    await service.finish();
    expect(service.status()).toMatchObject({
      username: "lastfm-b",
      pending: 0,
    });
  });
});

describe("Last.fm durable submission queue", () => {
  it("persists before sending and suppresses duplicate submissions including acknowledged IDs", async () => {
    const { service, save, fetch, stored } = setup();
    await service.enqueue(listen());
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(
      fetch.mock.invocationCallOrder[0],
    );
    await service.enqueue(listen());
    await settle();
    expect(service.status().pending).toBe(0);
    await service.enqueue(listen());
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(stored.get("liner-a")?.recent).toEqual(["play"]);
  });

  it("preserves network failures and retries after backoff with the original timestamp", async () => {
    vi.useFakeTimers();
    const { service, fetch, stored } = setup();
    fetch.mockRejectedValueOnce(new Error("offline"));
    await service.enqueue(listen());
    await settle();
    expect(service.status()).toMatchObject({ pending: 1, error: "retrying" });
    expect(stored.get("liner-a")?.queue[0].timestamp).toBe(1700000000);
    await service.enqueue(listen("second"));
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30000);
    await settle();
    expect(service.status().pending).toBe(0);
    const body = new URLSearchParams(String(fetch.mock.calls[1][1]?.body));
    expect(body.get("timestamp[0]")).toBe("1700000000");
    expect(body.get("track[1]")).toBe("Song");
  });

  it.each([11, 16, 29])(
    "retries API error %s even with HTTP 200",
    async (code) => {
      vi.useFakeTimers();
      const { service, fetch } = setup();
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ error: code }),
      } as Response);
      await service.enqueue(listen());
      await settle();
      expect(service.status()).toMatchObject({ pending: 1, error: "retrying" });
      await vi.advanceTimersByTimeAsync(30000);
      expect(service.status().pending).toBe(0);
    },
  );

  it("retains revoked-session listens for reauthorization by the same user", async () => {
    const { service, fetch } = setup();
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ error: 9 }),
    } as Response);
    await service.enqueue(listen());
    await settle();
    expect(service.status()).toMatchObject({
      connected: false,
      pending: 1,
      error: "reauthorize",
    });
    await service.connect();
    await service.finish();
    await settle();
    expect(service.status()).toMatchObject({ connected: true, pending: 0 });
  });

  it("does not spin on permanent API errors and permits an explicit retry", async () => {
    const { service, fetch } = setup();
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ error: 13 }),
    } as Response);
    await service.enqueue(listen());
    await settle();
    expect(service.status()).toMatchObject({
      pending: 1,
      error: "submission_failed",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await service.retry();
    expect(service.status().pending).toBe(0);
  });

  it("drains restored queues in ordered batches of at most fifty and consumes ignored results", async () => {
    const { service, fetch } = setup({
      queue: Array.from({ length: 52 }, (_, index) => listen(String(index))),
    });
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    const first = new URLSearchParams(String(fetch.mock.calls[0][1]?.body));
    expect(first.has("track[49]")).toBe(true);
    expect(first.has("track[50]")).toBe(false);
    expect(service.status().pending).toBe(0);
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => success(1, 5),
    } as Response);
    await service.enqueue(listen("daily-limit"));
    await settle();
    expect(service.status()).toMatchObject({
      pending: 0,
      error: "scrobble_ignored",
    });
  });

  it("retains a batch if the response is malformed or persistence fails", async () => {
    vi.useFakeTimers();
    const { service, fetch, save } = setup();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrobbles: { scrobble: [] } }),
    } as Response);
    await service.enqueue(listen());
    await settle();
    expect(service.status().pending).toBe(1);
    save.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    await service.retry();
    expect(service.status().pending).toBe(1);
  });

  it("never sends if the initial durable enqueue fails", async () => {
    const { service, save, fetch } = setup();
    save.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    expect(await service.enqueue(listen())).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(service.status()).toMatchObject({
      pending: 0,
      error: "storage_failed",
    });
  });

  it("stops on disable, clears on disconnect, and ignores old in-flight responses", async () => {
    const { service, fetch, stored } = setup();
    let resolve!: (response: Response) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await service.enqueue(listen());
    service.disconnect();
    service.setOwner("liner-b");
    resolve({ ok: true, json: async () => success() } as Response);
    await settle();
    expect(service.status()).toMatchObject({ connected: false, pending: 0 });
    expect(stored.get("liner-a")?.queue).toEqual([]);
    service.setOwner("liner-a");
    await service.connect();
    await service.finish();
    service.settings({ enabled: false });
    expect(await service.enqueue(listen("disabled"))).toBe(false);
    expect(service.status().pending).toBe(0);
  });

  it("isolates Liner accounts and reloads only the owner's queue", async () => {
    vi.useFakeTimers();
    const { service, fetch } = setup();
    fetch.mockRejectedValueOnce(new Error("offline"));
    await service.enqueue(listen());
    await settle();
    service.setOwner("liner-b");
    expect(service.status()).toMatchObject({ connected: false, pending: 0 });
    service.setOwner("liner-a");
    await settle();
    expect(service.status()).toMatchObject({
      connected: true,
      pending: 0,
      username: "lastfm-a",
    });
  });

  it("sends Now Playing once per play, never retries failures, and honors the toggle", async () => {
    const { service, fetch } = setup();
    fetch.mockRejectedValueOnce(new Error("offline"));
    await service.updateNowPlaying(listen());
    await service.updateNowPlaying(listen());
    expect(fetch).toHaveBeenCalledTimes(1);
    await service.updateNowPlaying(listen("repeat"));
    expect(fetch).toHaveBeenCalledTimes(2);
    service.settings({ nowPlaying: false });
    await service.updateNowPlaying(listen("hidden"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

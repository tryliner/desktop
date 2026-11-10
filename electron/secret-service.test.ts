import { spawnSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasSecretService,
  listsSecretService,
  querySessionBus,
} from "./secret-service";

const { spawnSyncFn } = vi.hoisted(() => ({ spawnSyncFn: vi.fn() }));
vi.mock("node:child_process", () => ({
  default: { spawnSync: spawnSyncFn },
  spawnSync: spawnSyncFn,
}));

const spawnSyncMock = vi.mocked(spawnSync);

const spawnResult = (
  result: Partial<ReturnType<typeof spawnSync>>,
): ReturnType<typeof spawnSync> => ({
  pid: 1,
  output: [],
  stdout: "",
  stderr: "",
  status: 0,
  signal: null,
  ...result,
});

const reply = (...names: string[]) =>
  `method return time=1 sender=org.freedesktop.DBus\n   array [\n${names
    .map((name) => `      string "${name}"`)
    .join("\n")}\n   ]\n`;

describe("listsSecretService", () => {
  it("finds the secret service among the bus names", () => {
    expect(
      listsSecretService(
        reply("org.freedesktop.DBus", "org.freedesktop.secrets"),
      ),
    ).toBe(true);
  });

  it("ignores names that only start with the secret service name", () => {
    expect(listsSecretService(reply("org.freedesktop.secrets.extra"))).toBe(
      false,
    );
  });
});

describe("hasSecretService", () => {
  it("accepts a running provider", () => {
    expect(
      hasSecretService((method) =>
        method === "ListNames" ? reply("org.freedesktop.secrets") : reply(),
      ),
    ).toBe(true);
  });

  it("accepts a provider the bus can activate", () => {
    expect(
      hasSecretService((method) =>
        method === "ListActivatableNames"
          ? reply("org.freedesktop.secrets")
          : reply(),
      ),
    ).toBe(true);
  });

  it("rejects a bus without a provider", () => {
    expect(hasSecretService(() => reply("org.freedesktop.DBus"))).toBe(false);
  });

  it("rejects when the session bus can't be queried", () => {
    expect(hasSecretService(() => null)).toBe(false);
  });
});

describe("querySessionBus", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  it("asks the session bus daemon through dbus-send", () => {
    spawnSyncMock.mockReturnValue(
      spawnResult({ stdout: reply("org.freedesktop.secrets") }),
    );

    expect(querySessionBus("ListActivatableNames")).toBe(
      reply("org.freedesktop.secrets"),
    );
    expect(spawnSyncMock).toHaveBeenCalledWith(
      "dbus-send",
      [
        "--session",
        "--print-reply",
        "--reply-timeout=1000",
        "--dest=org.freedesktop.DBus",
        "/org/freedesktop/DBus",
        "org.freedesktop.DBus.ListActivatableNames",
      ],
      { encoding: "utf8", timeout: 2000 },
    );
  });

  it("returns null when dbus-send is missing", () => {
    spawnSyncMock.mockReturnValue(
      spawnResult({
        error: new Error("spawnSync dbus-send ENOENT"),
        status: null,
      }),
    );
    expect(querySessionBus("ListNames")).toBeNull();
  });

  it("returns null when the bus call fails", () => {
    spawnSyncMock.mockReturnValue(
      spawnResult({ status: 1, stderr: "Failed to open connection" }),
    );
    expect(querySessionBus("ListNames")).toBeNull();
  });

  it("is what hasSecretService uses by default", () => {
    spawnSyncMock.mockReturnValue(
      spawnResult({ stdout: reply("org.freedesktop.secrets") }),
    );
    expect(hasSecretService()).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
  });
});

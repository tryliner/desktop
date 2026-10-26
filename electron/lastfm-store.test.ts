// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LastfmStore, emptyLastfmData } from "./lastfm-store";

const directories: string[] = [];
afterEach(() => {
  directories
    .splice(0)
    .forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  vi.restoreAllMocks();
});
const cipher = {
  available: () => true,
  encrypt: (plain: string) =>
    Buffer.from(Buffer.from(plain).map((byte) => byte ^ 0x71)),
  decrypt: (data: Buffer) =>
    Buffer.from(data.map((byte) => byte ^ 0x71)).toString("utf8"),
};
function setup(available = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "liner-lastfm-"));
  directories.push(directory);
  return {
    directory,
    store: new LastfmStore(directory, {
      ...cipher,
      available: () => available,
    }),
  };
}

describe("Last.fm secure storage", () => {
  it("round trips encrypted credentials and pending listens across restarts, isolated by owner", () => {
    const { store, directory } = setup();
    const data = {
      ...emptyLastfmData(),
      enabled: true,
      username: "listener",
      session: { username: "listener", key: "private-session" },
      credentials: { apiKey: "a".repeat(32), secret: "b".repeat(32) },
      queue: [
        {
          id: "play",
          artist: "artist",
          track: "title",
          duration: 180,
          timestamp: 1700000000,
        },
      ],
    };
    store.save("../../owner-a", data);
    const files = fs.readdirSync(directory);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[a-f0-9]{64}\.bin$/);
    expect(
      fs.readFileSync(path.join(directory, files[0]), "utf8"),
    ).not.toContain("private-session");
    expect(
      new LastfmStore(directory, cipher).load("../../owner-a"),
    ).toMatchObject(data);
    expect(store.load("owner-b")).toEqual(emptyLastfmData());
    if (process.platform !== "win32")
      expect(fs.statSync(path.join(directory, files[0])).mode & 0o777).toBe(
        0o600,
      );
  });

  it("does not write secrets or the queue when OS encryption is unavailable", () => {
    const { store, directory } = setup(false);
    store.save("owner", {
      ...emptyLastfmData(),
      session: { username: "listener", key: "secret" },
    });
    expect(fs.readdirSync(directory)).toEqual([]);
  });

  it("leaves corrupt files intact and refuses to load invalid persisted input", () => {
    const { store, directory } = setup();
    store.save("owner", emptyLastfmData());
    const file = path.join(directory, fs.readdirSync(directory)[0]);
    fs.writeFileSync(
      file,
      cipher.encrypt(
        JSON.stringify({
          version: 1,
          ...emptyLastfmData(),
          queue: [{ duration: NaN }],
        }),
      ),
    );
    expect(() => store.load("owner")).toThrow();
    expect(fs.existsSync(file)).toBe(true);
  });

  it("keeps the previous file intact if writing the replacement fails", () => {
    const { store } = setup();
    store.save("owner", emptyLastfmData());
    vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    expect(() =>
      store.save("owner", { ...emptyLastfmData(), enabled: true }),
    ).toThrow("disk full");
    expect(store.load("owner").enabled).toBe(false);
  });

  it("clears an existing saved session on disconnect even if keychain access was lost", () => {
    const { store, directory } = setup();
    store.save("owner", {
      ...emptyLastfmData(),
      session: { username: "listener", key: "secret" },
    });
    new LastfmStore(directory, { ...cipher, available: () => false }).save(
      "owner",
      emptyLastfmData(),
    );
    expect(fs.readdirSync(directory)).toEqual([]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import type { LyricsCandidate } from "@/shared/contracts/lyrics";
import type { LocalTrackRecord } from "@/shared/media/local";
import {
  RATE_LIMIT_BACKOFF_MS,
  createLocalLyricsQueue,
  type LocalLyricsQueueDeps,
} from "./localLyricsQueue";

const candidate = {
  provider: "lrclib",
  lyrics: { content: "[00:01.00] hi", format: "lrc" },
} as unknown as LyricsCandidate;

function record(
  id: string,
  title = "Song",
  artist = "Band",
  extra: Partial<LocalTrackRecord> = {},
): LocalTrackRecord {
  return {
    id,
    title,
    artist,
    durationMs: 200_000,
    fileName: `${id}.mp3`,
    audioFile: `${id}.mp3`,
    mimeType: "audio/mpeg",
    byteSize: 1,
    addedAt: 1,
    ...extra,
  };
}

function deps(overrides: Partial<LocalLyricsQueueDeps> = {}) {
  const saved: Array<[string, string, LyricsCandidate | undefined]> = [];
  const base: LocalLyricsQueueDeps = {
    readLegacy: async () => null,
    dropLegacy: vi.fn(async () => undefined),
    search: vi.fn(async () => ({ candidate })),
    isSignedIn: () => true,
    save: async (id, state, lyrics) => {
      saved.push([id, state, lyrics]);
      return true;
    },
    onSaved: vi.fn(),
    sleep: vi.fn(async () => undefined),
    ...overrides,
  };
  return { deps: base, saved };
}

describe("local lyrics queue", () => {
  it("searches each new track once and stores what it finds", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ candidate })
      .mockResolvedValueOnce(null);
    const { deps: d, saved } = deps({ search });
    const queue = createLocalLyricsQueue(d);

    await queue.enqueue([record("a"), record("b")]);
    await queue.enqueue([record("a"), record("b")]);

    expect(search).toHaveBeenCalledTimes(2);
    expect(saved).toEqual([
      ["a", "found", candidate],
      ["b", "missing", undefined],
    ]);
  });

  it("searches a removed track again when the same file is imported again", async () => {
    const { deps: d } = deps();
    const queue = createLocalLyricsQueue(d);

    await queue.enqueue([record("a", "Song", "Band", { addedAt: 1 })]);
    queue.forget(["a"]);
    await queue.enqueue([record("a", "Song", "Band", { addedAt: 2 })]);

    expect(d.search).toHaveBeenCalledTimes(2);
  });

  it("searches a re-imported file even if its removal was never reported", async () => {
    const { deps: d } = deps();
    const queue = createLocalLyricsQueue(d);

    await queue.enqueue([record("a", "Song", "Band", { addedAt: 1 })]);
    await queue.enqueue([record("a", "Song", "Band", { addedAt: 2 })]);

    expect(d.search).toHaveBeenCalledTimes(2);
  });

  it("skips tracks that already have a lyrics result", async () => {
    const { deps: d } = deps();
    const queue = createLocalLyricsQueue(d);
    await queue.enqueue([record("a", "Song", "Band", { lyrics: "missing" })]);
    expect(d.search).not.toHaveBeenCalled();
  });

  it("marks tracks without an artist without asking the server", async () => {
    const { deps: d, saved } = deps();
    await createLocalLyricsQueue(d).enqueue([record("a", "Song", " ")]);
    expect(d.search).not.toHaveBeenCalled();
    expect(saved).toEqual([["a", "untagged", undefined]]);
  });

  it("moves lyrics found earlier on this device instead of searching again", async () => {
    const { deps: d, saved } = deps({ readLegacy: async () => candidate });
    await createLocalLyricsQueue(d).enqueue([record("a")]);
    expect(d.search).not.toHaveBeenCalled();
    expect(saved).toEqual([["a", "found", candidate]]);
    expect(d.dropLegacy).toHaveBeenCalledWith("local:a");
  });

  it("waits out the hourly limit and then carries on", async () => {
    const search = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(429, "Too Many Requests"))
      .mockResolvedValueOnce({ candidate });
    const { deps: d, saved } = deps({ search });
    await createLocalLyricsQueue(d).enqueue([record("a")]);
    expect(d.sleep).toHaveBeenCalledWith(RATE_LIMIT_BACKOFF_MS);
    expect(saved).toEqual([["a", "found", candidate]]);
  });

  it("holds the queue while signed out and resumes on retry", async () => {
    let signedIn = false;
    const { deps: d, saved } = deps({ isSignedIn: () => signedIn });
    const queue = createLocalLyricsQueue(d);

    await queue.enqueue([record("a")]);
    expect(saved).toEqual([]);

    signedIn = true;
    await queue.retry();
    expect(saved).toEqual([["a", "found", candidate]]);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SavedTrackRecord } from "@/shared/media/saved";
import type { Track } from "@/shared/types";
import {
  BLOCKED_PAUSE_MS,
  MAX_ATTEMPTS,
  NETWORK_GAP_MIN_MS,
  START_DELAY_MS,
  createSavedTrackSync,
  emptySyncMemory,
  type FailureKind,
  type SavedAudioSource,
  type SavedSyncMemory,
  type SavedTrackSyncDeps,
  type StoredClaims,
  type SyncStatus,
} from "./savedTrackSync";

const track = (id: string): Track => ({
  id,
  title: `song ${id}`,
  artists: "artist",
  coverUrl: "",
  durationMs: 1000,
  playCount: 0,
});

const record = (trackId: string): SavedTrackRecord => ({
  trackId,
  key: trackId.padEnd(20, "0"),
  title: `song ${trackId}`,
  artists: "artist",
  durationMs: 1000,
  audioFile: `${trackId}.webm`,
  mimeType: "audio/webm",
  byteSize: 10,
  savedAt: 1,
  lyrics: "found",
});

class Failure extends Error {
  constructor(readonly failure: FailureKind) {
    super(failure.kind);
  }
}

function setup(overrides: Partial<SavedTrackSyncDeps> = {}) {
  let clock = 1_000_000;
  const sleeps: number[] = [];
  const statuses: SyncStatus[] = [];
  const saved: string[] = [];
  const removed: string[][] = [];
  let memory: SavedSyncMemory = emptySyncMemory();
  let source: SavedAudioSource = "liner";
  let failNext: FailureKind[] = [];
  let account: string | null = "u1";
  let claimsStore: { accountId: string | null; trackIds: string[] } | null =
    null;
  let wipes = 0;
  let visible: string[] = [];
  const deps: SavedTrackSyncDeps = {
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    random: () => 0,
    isOnline: () => true,
    waitForOnline: async () => {},
    isPlayerBusy: () => false,
    currentTrackId: () => null,
    isEnabled: () => true,
    limitBytes: () => 0,
    usage: async () => ({ bytes: 0, freeBytes: null }),
    saveTrack: async (input) => {
      const failure = failNext.shift();
      if (failure) throw new Failure(failure);
      saved.push(input.id);
      return { record: record(input.id), source };
    },
    saveLyrics: async () => "found",
    remove: async (ids) => {
      removed.push(ids);
    },
    removeAll: async () => {
      wipes += 1;
    },
    accountId: () => account,
    readClaims: (accountId): StoredClaims => {
      if (!claimsStore) return accountId ? "all" : [];
      return claimsStore.accountId === accountId ? claimsStore.trackIds : [];
    },
    writeClaims: (accountId, trackIds) => {
      claimsStore = { accountId, trackIds };
    },
    classify: (error) =>
      error instanceof Failure
        ? error.failure
        : { kind: "failed", reason: String(error) },
    readMemory: () => memory,
    writeMemory: (next) => {
      memory = next;
    },
    onStatus: (status) => statuses.push(status),
    onRecords: (claimed) => {
      visible = claimed.map((entry) => entry.trackId);
    },
    log: () => {},
    ...overrides,
  };
  const sync = createSavedTrackSync(deps);
  return {
    sync,
    sleeps,
    statuses,
    saved,
    removed,
    memory: () => memory,
    setSource: (next: SavedAudioSource) => {
      source = next;
    },
    failWith: (...failures: FailureKind[]) => {
      failNext = failures;
    },
    signInAs: (next: string | null) => {
      account = next;
    },
    claims: () => claimsStore,
    setClaims: (accountId: string | null, trackIds: string[]) => {
      claimsStore = { accountId, trackIds };
    },
    wipes: () => wipes,
    visible: () => visible,
  };
}

describe("saved track sync", () => {
  it("waits for the startup delay, then saves liked songs in order", async () => {
    const t = setup();
    await t.sync.reconcile([track("a"), track("b")], true);
    await t.sync.idle();

    expect(t.sleeps[0]).toBe(START_DELAY_MS);
    expect(t.saved).toEqual(["a", "b"]);
    expect(t.statuses.at(-1)).toMatchObject({ phase: "idle", pending: 0 });
  });

  it("spaces out youtube downloads more than liner ones", async () => {
    const t = setup();
    t.setSource("network");
    await t.sync.resume();
    await t.sync.reconcile([track("a")], true);
    await t.sync.idle();

    expect(t.sleeps).toContain(NETWORK_GAP_MIN_MS);
    expect(t.memory().networkCount).toBe(1);
  });

  it("pauses for an hour when youtube asks for a bot check", async () => {
    const t = setup();
    t.failWith({ kind: "blocked" });
    t.sync.resume();
    await t.sync.reconcile([track("a")], true);
    await t.sync.idle();

    expect(t.sleeps).toContain(BLOCKED_PAUSE_MS);
    expect(t.saved).toEqual(["a"]);
  });

  it("honours retry-after on rate limits", async () => {
    const t = setup();
    t.failWith({ kind: "rate_limited", retryAfterMs: 30_000 });
    t.sync.resume();
    await t.sync.reconcile([track("a")], true);
    await t.sync.idle();

    expect(t.sleeps).toContain(30_000);
    expect(t.saved).toEqual(["a"]);
  });

  it("gives up on a song after repeated failures", async () => {
    let attemptsOnA = 0;
    const t = setup({
      saveTrack: async (input) => {
        if (input.id === "a") {
          attemptsOnA += 1;
          throw new Failure({ kind: "failed", reason: "boom" });
        }
        return { record: record(input.id), source: "liner" };
      },
    });
    t.sync.resume();
    await t.sync.reconcile([track("a"), track("b")], true);
    await t.sync.idle();

    expect(attemptsOnA).toBe(MAX_ATTEMPTS);
    expect(t.sync.records().map((entry) => entry.trackId)).toEqual(["b"]);
    expect(t.memory().givenUp.a).toBeDefined();
  });

  it("stops at the storage limit", async () => {
    const t = setup({
      limitBytes: () => 100,
      usage: async () => ({ bytes: 150, freeBytes: null }),
    });
    t.sync.resume();
    await t.sync.reconcile([track("a")], true);
    await t.sync.idle();

    expect(t.saved).toEqual([]);
    expect(t.statuses.at(-1)?.phase).toBe("limit");
  });

  it("removes unliked songs but keeps the one that is playing", async () => {
    let playing: string | null = "b";
    const t = setup({ currentTrackId: () => playing });
    t.sync.setRecords([record("a"), record("b"), record("c")]);
    await t.sync.reconcile([track("c")], true);

    expect(t.removed).toEqual([["a"]]);
    playing = null;
    await t.sync.trackChanged();
    expect(t.removed).toEqual([["a"], ["b"]]);
  });

  it("never removes anything when the liked list failed to load", async () => {
    const t = setup();
    t.sync.setRecords([record("a")]);
    await t.sync.reconcile([], false);

    expect(t.removed).toEqual([]);
  });

  it("does nothing while saving is turned off", async () => {
    const t = setup({ isEnabled: () => false });
    const save = vi.fn();
    await t.sync.reconcile([track("a")], true);
    await t.sync.idle();

    expect(save).not.toHaveBeenCalled();
    expect(t.saved).toEqual([]);
    expect(t.statuses.at(-1)?.phase).toBe("disabled");
  });
});

describe("downloads across sign-out and sign-in", () => {
  it("wipes every download on sign-out when keeping is off", async () => {
    const t = setup();
    t.sync.setRecords([record("a"), record("b")]);
    await t.sync.reconcile([track("a"), track("b")], true);

    const removed = await t.sync.signOut(false);
    t.signInAs(null);

    expect(removed).toBe(2);
    expect(t.wipes()).toBe(1);
    expect(t.sync.records()).toEqual([]);
    expect(t.visible()).toEqual([]);
    expect(t.claims()?.trackIds).toEqual([]);
  });

  it("keeps the files but forgets whose they were when keeping is on", async () => {
    const t = setup();
    t.sync.setRecords([record("a"), record("b")]);
    await t.sync.reconcile([track("a"), track("b")], true);

    const removed = await t.sync.signOut(true);
    t.signInAs(null);
    await t.sync.reconcile([], false);

    expect(removed).toBe(0);
    expect(t.wipes()).toBe(0);
    expect(t.removed).toEqual([]);
    expect(t.sync.records().map((entry) => entry.trackId)).toEqual(["a", "b"]);
    expect(t.visible()).toEqual([]);
    expect(t.claims()).toEqual({ accountId: null, trackIds: [] });
  });

  it("forgets the account's failed songs on sign-out but keeps the daily download budget", async () => {
    const t = setup({
      readMemory: () => ({
        attempts: { a: 2 },
        givenUp: { b: 1 },
        networkDay: 7,
        networkCount: 40,
      }),
    });
    await t.sync.signOut(true);

    expect(t.memory()).toEqual({
      attempts: {},
      givenUp: {},
      networkDay: 7,
      networkCount: 40,
    });
  });

  it("reuses kept files by track id for the next account and downloads only what is missing", async () => {
    const t = setup();
    t.setClaims(null, []);
    t.signInAs("u2");
    t.sync.setRecords([record("a"), record("b")]);
    expect(t.visible()).toEqual([]);

    t.sync.resume();
    await t.sync.reconcile([track("b"), track("c")], true);
    await t.sync.idle();

    expect(t.saved).toEqual(["c"]);
    expect(t.removed).toEqual([]);
    expect(t.visible().sort()).toEqual(["b", "c"]);
    expect(t.sync.sharedRecords().map((entry) => entry.trackId)).toEqual(["a"]);
    expect(t.claims()).toEqual({ accountId: "u2", trackIds: ["b", "c"] });
  });

  it("does not wipe downloads that are still liked when the same account signs back in", async () => {
    const t = setup();
    t.sync.setRecords([record("a"), record("b")]);
    await t.sync.reconcile([track("a"), track("b")], true);
    await t.sync.signOut(true);
    t.signInAs(null);
    await t.sync.reconcile([], false);

    t.signInAs("u1");
    await t.sync.reconcile([], false);
    t.sync.resume();
    await t.sync.reconcile([track("a"), track("b"), track("d")], true);
    await t.sync.idle();

    expect(t.removed).toEqual([]);
    expect(t.saved).toEqual(["d"]);
    expect(t.visible().sort()).toEqual(["a", "b", "d"]);
  });

  it("only removes songs this account unliked, never songs kept from other accounts", async () => {
    const t = setup();
    t.setClaims("u2", ["b"]);
    t.signInAs("u2");
    t.sync.setRecords([record("a"), record("b")]);
    await t.sync.reconcile([track("c")], true);

    expect(t.removed).toEqual([["b"]]);
    expect(t.sync.records().map((entry) => entry.trackId)).toEqual(["a"]);
  });

  it("ignores claims stored for a different account", async () => {
    const t = setup();
    t.setClaims("u1", ["a", "b"]);
    t.signInAs("u2");
    t.sync.setRecords([record("a"), record("b")]);

    expect(t.visible()).toEqual([]);
    await t.sync.reconcile([], true);
    expect(t.removed).toEqual([]);
  });

  it("claims every existing download for the signed-in account on first run", () => {
    const t = setup();
    t.sync.setRecords([record("a"), record("b")]);

    expect(t.visible()).toEqual(["a", "b"]);
    expect(t.claims()).toEqual({ accountId: "u1", trackIds: ["a", "b"] });
  });

  it("frees space by removing the oldest kept song before stopping at the limit", async () => {
    let bytes = 150;
    const t = setup({
      limitBytes: () => 100,
      usage: async () => ({ bytes, freeBytes: null }),
      remove: async (ids) => {
        t.removed.push(ids);
        bytes -= 100;
      },
    });
    t.setClaims("u1", []);
    t.sync.setRecords([
      { ...record("old"), savedAt: 1 },
      { ...record("new"), savedAt: 2 },
    ]);
    t.sync.resume();
    await t.sync.reconcile([track("x")], true);
    await t.sync.idle();

    expect(t.removed).toEqual([["old"]]);
    expect(t.saved).toEqual(["x"]);
  });

  it("drops a download that finishes after sign-out", async () => {
    let finish: (() => void) | null = null;
    const t = setup({
      saveTrack: async (input) => {
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return { record: record(input.id), source: "liner" };
      },
    });
    t.sync.resume();
    const reconciling = t.sync.reconcile([track("a")], true);
    await reconciling;
    await vi.waitFor(() => expect(finish).not.toBeNull());
    await t.sync.signOut(true);
    finish!();
    await t.sync.idle();

    expect(t.removed).toEqual([["a"]]);
    expect(t.sync.records()).toEqual([]);
    expect(t.visible()).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, START_DELAY_MS } from "./savedTrackSync";
import { record, setup, track } from "./savedTrackSync.fixture";

describe("pinned downloads", () => {
  it("puts pinned songs ahead of liked ones", async () => {
    const t = setup();
    await t.sync.reconcile([track("liked")], true);
    await t.sync.setPinned([track("pick")]);
    await t.sync.idle();
    expect(t.saved).toEqual(["pick", "liked"]);
  });

  it("skips the start-up wait for a download the user asked for", async () => {
    const t = setup({ isEnabled: () => false });
    await t.sync.setPinned([track("pick")]);
    await t.sync.idle();
    expect(t.sleeps).not.toContain(START_DELAY_MS);
    expect(t.saved).toEqual(["pick"]);
  });

  it("cuts a start-up wait that's already running", async () => {
    let release: () => void = () => {};
    const t = setup({
      sleep: (ms) =>
        ms === START_DELAY_MS
          ? new Promise<void>((resolve) => {
              release = resolve;
            })
          : Promise.resolve(),
    });
    await t.sync.reconcile([track("liked")], true);
    await t.sync.setPinned([track("pick")]);
    await t.sync.idle();
    expect(t.saved).toEqual(["pick", "liked"]);
    release();
  });

  it("runs with 'save liked' off, but only for pins", async () => {
    const t = setup({ isEnabled: () => false });
    await t.sync.reconcile([track("liked")], true);
    expect(t.statuses.at(-1)?.phase).toBe("disabled");
    await t.sync.setPinned([track("pick")]);
    await t.sync.idle();
    expect(t.saved).toEqual(["pick"]);
  });

  it("keeps a file while anything still wants it", async () => {
    const t = setup();
    t.sync.setRecords([record("both"), record("pin-only")]);
    await t.sync.reconcile([track("both")], true);
    await t.sync.setPinned([track("both"), track("pin-only")]);
    await t.sync.idle();

    await t.sync.reconcile([], true);
    expect(t.removed.flat()).not.toContain("both");

    await t.sync.setPinned([track("both")]);
    expect(t.removed.flat()).toContain("pin-only");
    await t.sync.setPinned([]);
    expect(t.removed.flat()).toContain("both");
  });

  it("never deletes liked downloads just because 'save liked' is off", async () => {
    let enabled = true;
    const t = setup({ isEnabled: () => enabled });
    t.sync.setRecords([record("liked")]);
    await t.sync.reconcile([track("liked")], true);
    enabled = false;
    await t.sync.setPinned([track("other")]);
    await t.sync.setPinned([]);
    await t.sync.idle();
    expect(t.removed.flat()).not.toContain("liked");
  });

  it("retries a song it gave up on when asked", async () => {
    const t = setup();
    t.failWith(
      ...Array.from({ length: MAX_ATTEMPTS }, () => ({
        kind: "failed" as const,
        reason: "nope",
      })),
    );
    await t.sync.setPinned([track("x")]);
    await t.sync.idle();
    expect(t.sync.failedIds()).toEqual(["x"]);
    await t.sync.retry("x");
    await t.sync.idle();
    expect(t.saved).toEqual(["x"]);
    expect(t.sync.failedIds()).toEqual([]);
  });

  it("forgets pins on sign-out", async () => {
    const t = setup({ isEnabled: () => false });
    await t.sync.setPinned([track("x")]);
    await t.sync.signOut(true);
    expect(t.sync.pinnedIds().size).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import type { SavedTrackRecord } from "@/shared/media/saved";
import type { SavedAudioSource } from "./savedTrackSync";
import { Failure, record, setup, track } from "./savedTrackSync.fixture";

type SaveResult = { record: SavedTrackRecord; source: SavedAudioSource };

function deferredSave() {
  let finish: (result: SaveResult) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const pending = new Promise<SaveResult>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  let started = false;
  return {
    saveTrack: () => {
      started = true;
      return pending;
    },
    started: () => started,
    finish: (id: string) => finish({ record: record(id), source: "liner" }),
    fail: (error: Error) => fail(error),
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("saves that finish after the user changed their mind", () => {
  it("throws away a save whose pin was taken away meanwhile", async () => {
    const save = deferredSave();
    const t = setup({ isEnabled: () => false, saveTrack: save.saveTrack });
    await t.sync.setPinned([track("x")]);
    await tick();
    expect(save.started()).toBe(true);
    await t.sync.setPinned([]);
    save.finish("x");
    await t.sync.idle();
    expect(t.removed.flat()).toContain("x");
    expect(t.visible()).not.toContain("x");
  });

  it("does not retry a failed save nobody wants any more", async () => {
    const save = deferredSave();
    const t = setup({ isEnabled: () => false, saveTrack: save.saveTrack });
    await t.sync.setPinned([track("x")]);
    await tick();
    await t.sync.setPinned([]);
    save.fail(new Failure({ kind: "failed", reason: "boom" }));
    await t.sync.idle();
    expect(t.sync.queuedIds()).toEqual([]);
    expect(t.memory().attempts.x).toBeUndefined();
  });

  it("drops an in-flight save when another account signs in", async () => {
    const save = deferredSave();
    const t = setup({ isEnabled: () => false, saveTrack: save.saveTrack });
    await t.sync.setPinned([track("x")]);
    await tick();
    t.signInAs("u2");
    await t.sync.setPinned([track("x")]);
    save.finish("x");
    await tick();
    expect(t.removed.flat()).toContain("x");
  });
});

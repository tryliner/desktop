import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerEngine, usePlayerStore } from "./playerEngine";
import { api } from "@/shared/api";
import type { Track } from "@/shared/types";
import type { RadioResponse } from "@/shared/contracts/catalog";

const mk = (id: string): Track => ({
  id,
  title: `Track ${id}`,
  artists: `Artist ${id}`,
  durationMs: 180000,
  coverUrl: "",
  playCount: 0,
});

const radioItems = (ids: string[]): RadioResponse => ({
  items: ids.map((id) => ({
    id,
    title: `Track ${id}`,
    artists: [{ id: `artist-${id}`, name: `Artist ${id}` }],
    durationMs: 180000,
  })),
});

const list = ["l0", "l1", "l2", "l3", "l4", "l5"].map(mk);

function deferredRadio() {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let counter = 0;
  const spy = vi.spyOn(api, "getRadio").mockImplementation(async () => {
    await gate;
    return radioItems([`rec${counter++}`, `rec${counter++}`]);
  });
  return { spy, release };
}

const recommendedIds = () =>
  usePlayerStore
    .getState()
    .queue.filter((t) => t.isRecommended)
    .map((t) => t.id);

describe("smart shuffle timing", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      status: "idle",
      queue: [...list],
      currentIndex: 0,
      currentTrack: list[0],
      repeat: "off",
      shuffle: true,
      shuffleMode: "playlist",
      autoplaySimilar: false,
      playbackContext: "playlist:test",
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the mix when the user skips while recommendations load", async () => {
    const { release } = deferredRadio();
    const enabling = playerEngine.setShuffleMode("smart");

    await playerEngine.skipNext();
    release();
    await enabling;

    expect(usePlayerStore.getState().currentIndex).toBe(1);
    expect(recommendedIds().length).toBeGreaterThan(0);
  });

  it("drops the mix when the queue is replaced while recommendations load", async () => {
    const { release } = deferredRadio();
    const enabling = playerEngine.setShuffleMode("smart");

    playerEngine.clearQueue();
    usePlayerStore.setState({
      queue: [...list],
      currentIndex: 0,
      currentTrack: list[0],
    });
    release();
    await enabling;

    expect(recommendedIds()).toEqual([]);
  });

  it("ignores recommendations that were requested before smart shuffle was turned off", async () => {
    const { spy, release } = deferredRadio();
    const firstMix = playerEngine.setShuffleMode("smart");
    const firstBatchCalls = spy.mock.calls.length;

    await playerEngine.setShuffleMode("playlist");
    const secondMix = playerEngine.setShuffleMode("smart");
    release();
    await Promise.all([firstMix, secondMix]);

    const firstBatchIds = new Set(
      Array.from({ length: firstBatchCalls * 2 }, (_, i) => `rec${i}`),
    );
    expect(recommendedIds().length).toBeGreaterThan(0);
    expect(recommendedIds().some((id) => firstBatchIds.has(id))).toBe(false);
  });

  it("does not mix recommendations into a radio station", async () => {
    const { spy, release } = deferredRadio();
    usePlayerStore.setState({ playbackContext: "radio:l0" });

    release();
    await playerEngine.setShuffleMode("smart");

    expect(spy).not.toHaveBeenCalled();
    expect(recommendedIds()).toEqual([]);
  });
});

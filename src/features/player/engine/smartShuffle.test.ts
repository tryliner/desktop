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

const list = ["l0", "l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9"].map(
  mk,
);

const injectSmartMix = (): Promise<void> => {
  const fn = Reflect.get(playerEngine, "injectSmartMix") as (
    session: number,
  ) => Promise<void>;
  return fn.call(playerEngine, Reflect.get(playerEngine, "queueEpoch"));
};

describe("smart shuffle (Spotify style)", () => {
  let getRadio: ReturnType<typeof vi.spyOn>;
  let counter = 0;

  beforeEach(() => {
    counter = 0;
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
    getRadio = vi
      .spyOn(api, "getRadio")
      .mockImplementation(async (_id, opts) => {
        const k = (opts as { k?: number } | undefined)?.k ?? 5;
        return radioItems(Array.from({ length: k }, () => `rec${counter++}`));
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("makes about one in every three upcoming tracks a recommendation", async () => {
    await playerEngine.setShuffleMode("smart");

    const upcoming = usePlayerStore.getState().queue.slice(1);
    expect(upcoming.filter((t) => t.isRecommended)).toHaveLength(4);
    expect(upcoming.filter((t) => !t.isRecommended)).toHaveLength(9);
    upcoming.forEach((t, i) => {
      expect(Boolean(t.isRecommended)).toBe((i + 1) % 3 === 0);
    });
    expect(getRadio.mock.calls.length).toBeGreaterThan(1);
  });

  it("builds the mix once instead of topping it up", async () => {
    await playerEngine.setShuffleMode("smart");
    const callsAfterFirst = getRadio.mock.calls.length;
    const queueAfterFirst = usePlayerStore.getState().queue.map((t) => t.id);

    await injectSmartMix();

    expect(getRadio.mock.calls.length).toBe(callsAfterFirst);
    expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(
      queueAfterFirst,
    );
  });

  it("gives a fresh mix when turned off and on again", async () => {
    await playerEngine.setShuffleMode("smart");
    const firstRecs = usePlayerStore
      .getState()
      .queue.filter((t) => t.isRecommended)
      .map((t) => t.id);

    await playerEngine.setShuffleMode("off");
    expect(usePlayerStore.getState().queue.some((t) => t.isRecommended)).toBe(
      false,
    );

    await playerEngine.setShuffleMode("smart");
    const secondRecs = usePlayerStore
      .getState()
      .queue.filter((t) => t.isRecommended)
      .map((t) => t.id);
    expect(secondRecs.length).toBeGreaterThan(0);
    expect(secondRecs.some((id) => firstRecs.includes(id))).toBe(false);
  });

  it("never recommends a track that is already in the list", async () => {
    getRadio.mockImplementation(async () =>
      radioItems(["l3", "l5", "new1", "new2", "new3", "new4", "new5"]),
    );
    await playerEngine.setShuffleMode("smart");

    const recs = usePlayerStore
      .getState()
      .queue.filter((t) => t.isRecommended)
      .map((t) => t.id);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((id) => id.startsWith("new"))).toBe(true);
  });

  it("keeps the list playable when recommendations fail to load", async () => {
    getRadio.mockRejectedValue(new Error("offline"));
    await playerEngine.setShuffleMode("smart");

    const state = usePlayerStore.getState();
    expect(state.shuffleMode).toBe("smart");
    expect(state.queue.map((t) => t.id)).toEqual(list.map((t) => t.id));
  });
});

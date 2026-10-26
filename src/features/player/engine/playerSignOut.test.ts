import { afterEach, describe, expect, it, vi } from "vitest";
import { playerEngine, usePlayerStore } from "./playerEngine";
import { api } from "@/shared/api";
import type { Track } from "@/shared/types";

const track = (id: string): Track => ({
  id,
  title: `Song ${id}`,
  artists: `Artist ${id}`,
  durationMs: 180_000,
  coverUrl: `https://example.com/${id}.jpg`,
  playCount: 0,
});

describe("playerEngine.stopAndClear", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forgets the old account's track and queue but keeps player settings", async () => {
    vi.spyOn(api, "recordPlaybackEvent").mockResolvedValue(undefined as never);
    await playerEngine.playTrack(track("a"), [track("a"), track("b")]);
    usePlayerStore.setState({ volume: 0.4, repeat: "all", fullscreen: true, positionMs: 42_000 });

    await playerEngine.stopAndClear();

    const state = usePlayerStore.getState();
    expect(state).toMatchObject({
      status: "idle",
      currentTrack: null,
      currentIndex: -1,
      queue: [],
      positionMs: 0,
      playbackContext: null,
      fullscreen: false,
      volume: 0.4,
      repeat: "all",
    });
    expect(playerEngine.snapshotQueue()).toEqual([]);
  });

  it("does not bring the old track back after a restart", async () => {
    vi.spyOn(api, "recordPlaybackEvent").mockResolvedValue(undefined as never);
    await playerEngine.playTrack(track("c"), [track("c")]);

    await playerEngine.stopAndClear();

    const persisted = JSON.parse(localStorage.getItem("liner_player_session_v2") ?? "{}");
    expect(persisted.state?.currentTrack ?? null).toBeNull();
    expect(persisted.state?.queue ?? []).toEqual([]);
  });

  it("reports the last listen before clearing, and waits for it", async () => {
    let finishReport: () => void = () => {};
    const report = vi.spyOn(api, "recordPlaybackEvent").mockImplementation(
      () => new Promise((resolve) => (finishReport = () => resolve(undefined as never))),
    );
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    await playerEngine.playTrack(track("d"), [track("d")]);
    usePlayerStore.getState().setStatus("playing");
    for (let second = 1; second <= 4; second++) {
      now += 1_000;
      usePlayerStore.getState().setPosition(second * 1_000);
    }

    let done = false;
    const stopping = playerEngine.stopAndClear().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ trackId: "d" }));
    expect(done).toBe(false);
    finishReport();
    await stopping;
    expect(done).toBe(true);
  });
});

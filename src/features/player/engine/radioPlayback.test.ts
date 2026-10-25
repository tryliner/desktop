import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerEngine, usePlayerStore } from "./playerEngine";
import { api } from "@/shared/api";
import type { Track } from "@/shared/types";

const mk = (id: string): Track => ({
  id,
  title: `Track ${id}`,
  artists: `Artist ${id}`,
  durationMs: 180000,
  coverUrl: "",
  playCount: 0,
});

const radioItems = (ids: string[]) =>
  ({
    items: ids.map((id) => ({
      id,
      title: `Track ${id}`,
      artists: `Artist ${id}`,
      durationMs: 180000,
    })),
  }) as any;

describe("radio playback", () => {
  let getRadio: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    usePlayerStore.setState({
      status: "idle",
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      repeat: "off",
      shuffle: false,
      error: null,
      autoplaySimilar: false,
      playbackContext: null,
    });
    getRadio = vi.spyOn(api, "getRadio");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("turns repeat-all off when a station starts", async () => {
    getRadio.mockResolvedValue(radioItems(["b", "c"]));
    playerEngine.setRepeat("all");
    await playerEngine.startRadioStation(mk("a"));
    expect(usePlayerStore.getState().repeat).toBe("off");
  });

  it("refills when one track is left, even with autoplay-similar off", async () => {
    getRadio.mockResolvedValueOnce(radioItems(["b", "c"])); // station start
    await playerEngine.startRadioStation(mk("a"));
    expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual([
      "a",
      "b",
      "c",
    ]);

    getRadio.mockResolvedValueOnce(radioItems(["d", "e"]));
    await playerEngine.skipNext(); // on "b": one left after it -> refill
    await vi.advanceTimersByTimeAsync(500);
    expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("never wraps to the first track; at the end it fetches more and keeps going", async () => {
    getRadio.mockResolvedValueOnce(radioItems([])); // station start returns nothing
    await playerEngine.startRadioStation(mk("a"));
    usePlayerStore.getState().setRepeat("all"); // even if repeat-all sneaks in

    getRadio.mockResolvedValueOnce(radioItems(["x"]));
    await playerEngine.skipNext(true);
    const state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe("x");
    expect(state.currentIndex).toBe(1);
  });

  it("plain playlists still loop with repeat-all", async () => {
    const tracks = [mk("1"), mk("2")];
    await playerEngine.playTrack(tracks[0], tracks, "playlist:p");
    playerEngine.setRepeat("all");
    await playerEngine.skipNext();
    await playerEngine.skipNext();
    expect(usePlayerStore.getState().currentTrack?.id).toBe("1");
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { playerEngine } from "./playerEngine";
import { usePlayerStore } from "../store/playerStore";
import type { Track } from "@/shared/types";
import { api } from "@/shared/api";

function mockTrack(id: string, title = id): Track {
  return {
    id,
    title,
    artists: "Test Artist",
    durationMs: 180000,
    coverUrl: "https://example.com/cover.jpg",
    playCount: 1,
  };
}

describe("playerEngine shuffle modes (off, playlist, smart)", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      shuffle: false,
      shuffleMode: "off",
      repeat: "off",
      playbackContext: "playlist:test-playlist",
      autoplaySimilar: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("cycles shuffle modes in correct order: off -> playlist -> smart -> off", async () => {
    expect(usePlayerStore.getState().shuffleMode).toBe("off");
    expect(usePlayerStore.getState().shuffle).toBe(false);

    playerEngine.cycleShuffleMode();
    expect(usePlayerStore.getState().shuffleMode).toBe("playlist");
    expect(usePlayerStore.getState().shuffle).toBe(true);

    playerEngine.cycleShuffleMode();
    expect(usePlayerStore.getState().shuffleMode).toBe("smart");
    expect(usePlayerStore.getState().shuffle).toBe(true);

    playerEngine.cycleShuffleMode();
    expect(usePlayerStore.getState().shuffleMode).toBe("off");
    expect(usePlayerStore.getState().shuffle).toBe(false);
  });

  it("strips smart recommendations when toggling from smart to playlist or off", async () => {
    const t1 = mockTrack("1", "Song 1");
    const t2 = mockTrack("2", "Song 2");
    const t3 = mockTrack("3", "Song 3");
    const rec1 = { ...mockTrack("rec1", "Rec 1"), isRecommended: true };
    const rec2 = { ...mockTrack("rec2", "Rec 2"), isRecommended: true };

    usePlayerStore.setState({
      queue: [t1, t2, rec1, t3, rec2],
      currentIndex: 1,
      currentTrack: t2,
      shuffleMode: "smart",
      shuffle: true,
    });

    await playerEngine.setShuffleMode("playlist");
    const statePlaylist = usePlayerStore.getState();
    expect(statePlaylist.shuffleMode).toBe("playlist");
    expect(statePlaylist.queue.find((t) => t.isRecommended)).toBeUndefined();
    expect(statePlaylist.queue.map((t) => t.id)).toEqual(["1", "2", "3"]);

    await playerEngine.setShuffleMode("off");
    const stateOff = usePlayerStore.getState();
    expect(stateOff.shuffleMode).toBe("off");
    expect(stateOff.queue.find((t) => t.isRecommended)).toBeUndefined();
  });

  const reachLastTrack = async (shuffleMode: "off" | "playlist") => {
    vi.useFakeTimers();
    const getRadioSpy = vi
      .spyOn(api, "getRadio")
      .mockResolvedValue({ items: [] });
    const tracks = [mockTrack("a"), mockTrack("b")];

    usePlayerStore.setState({
      queue: tracks,
      currentIndex: 0,
      currentTrack: tracks[0],
      shuffleMode,
      shuffle: shuffleMode !== "off",
      autoplaySimilar: true,
    });

    await playerEngine.skipNext(true);
    await vi.advanceTimersByTimeAsync(500);
    return getRadioSpy;
  };

  it("fetches similar tracks at the end of a list when shuffle is off", async () => {
    const getRadioSpy = await reachLastTrack("off");
    expect(getRadioSpy).toHaveBeenCalledTimes(1);
  });

  it("does not fetch similar tracks at the end of a list in playlist shuffle", async () => {
    const getRadioSpy = await reachLastTrack("playlist");
    expect(getRadioSpy).not.toHaveBeenCalled();
  });
});

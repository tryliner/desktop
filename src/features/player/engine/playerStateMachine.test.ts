import { describe, expect, it, beforeEach, vi } from "vitest";
import { playerEngine, usePlayerStore } from "./playerEngine";
import { playerRuntime } from "./playerRuntime";
import type { Track } from "@/shared/types";

const mockTrack = (id: string, title: string, durationMs = 180000): Track => ({
  id,
  title,
  artists: "Artist " + id,
  durationMs,
  coverUrl: "https://example.com/cover-" + id + ".jpg",
  playCount: 0,
});

describe("Player State Machine", () => {
  beforeEach(() => {
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
    });
  });

  it("starts playback and updates state immediately", async () => {
    const track1 = mockTrack("1", "First Song");
    const track2 = mockTrack("2", "Second Song");

    await playerEngine.playTrack(track1, [track1, track2]);

    const state = usePlayerStore.getState();
    expect(state.currentTrack?.id).toBe("1");
    expect(state.currentIndex).toBe(0);
    expect(state.queue.length).toBe(2);
    expect(state.status).toBe("loading");
    expect(state.positionMs).toBe(0);
    expect(state.durationMs).toBe(180000);
  });

  it("handles fast skipping (rapid next clicks) with instantaneous UI transitions", async () => {
    const tracks = Array.from({ length: 10 }, (_, i) =>
      mockTrack(String(i + 1), `Track ${i + 1}`, 200000),
    );

    await playerEngine.playTrack(tracks[0], tracks);
    expect(usePlayerStore.getState().currentIndex).toBe(0);

    // Rapidly skip 5 times
    await playerEngine.skipNext();
    await playerEngine.skipNext();
    await playerEngine.skipNext();
    await playerEngine.skipNext();
    await playerEngine.skipNext();

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(5);
    expect(state.currentTrack?.id).toBe("6");
    expect(state.positionMs).toBe(0);
    expect(state.status).toBe("loading");
  });

  it("overrides repeat='one' mode on manual skipNext and respects it on natural track end", async () => {
    const tracks = [mockTrack("1", "Track 1"), mockTrack("2", "Track 2")];
    await playerEngine.playTrack(tracks[0], tracks);

    playerEngine.setRepeat("one");
    await playerEngine.skipNext();

    let state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.currentTrack?.id).toBe("2");
    expect(state.repeat).toBe("one");

    await playerEngine.skipNext(true);

    state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.currentTrack?.id).toBe("2");
    expect(state.repeat).toBe("one");
  });

  it("respects repeat='all' loop around the queue", async () => {
    const tracks = [mockTrack("1", "Track 1"), mockTrack("2", "Track 2")];
    await playerEngine.playTrack(tracks[1], tracks, undefined, undefined, 1);

    playerEngine.setRepeat("all");
    await playerEngine.skipNext();

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(0);
    expect(state.currentTrack?.id).toBe("1");
  });

  it("stops playback when reaching end of queue with repeat='off'", async () => {
    const tracks = [mockTrack("1", "Track 1"), mockTrack("2", "Track 2")];
    await playerEngine.playTrack(tracks[1], tracks, undefined, undefined, 1);

    playerEngine.setRepeat("off");
    await playerEngine.skipNext();

    const state = usePlayerStore.getState();
    expect(state.status).toBe("idle");
    expect(state.currentTrack).toBeNull();
    expect(state.currentIndex).toBe(-1);
  });

  it("restarts track when skipPrevious is called after 3 seconds", async () => {
    const tracks = [mockTrack("1", "Track 1"), mockTrack("2", "Track 2")];
    await playerEngine.playTrack(tracks[1], tracks, undefined, undefined, 1);

    usePlayerStore.setState({ positionMs: 5000 });
    await playerEngine.skipPrevious();

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.positionMs).toBe(0);
  });

  it("goes to previous track when skipPrevious is called before 3 seconds", async () => {
    const tracks = [mockTrack("1", "Track 1"), mockTrack("2", "Track 2")];
    await playerEngine.playTrack(tracks[1], tracks, undefined, undefined, 1);

    usePlayerStore.setState({ positionMs: 1000 });
    await playerEngine.skipPrevious();

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(0);
    expect(state.currentTrack?.id).toBe("1");
  });

  it("preserves queue and currentIndex when modifying queue items", () => {
    const track1 = mockTrack("1", "Track 1");
    const track2 = mockTrack("2", "Track 2");
    const track3 = mockTrack("3", "Track 3");

    playerEngine.addToQueue(track1);
    playerEngine.addToQueue(track2);
    expect(usePlayerStore.getState().queue.length).toBe(2);

    playerEngine.playNext(track3);
    const queue = usePlayerStore.getState().queue;
    expect(queue.map((t) => t.id)).toContain("3");
  });

  it("shuffles only upcoming tracks when shuffle is enabled", async () => {
    const tracks = Array.from({ length: 6 }, (_, i) => mockTrack(String(i + 1), `Track ${i + 1}`));
    await playerEngine.playTrack(tracks[1], tracks, undefined, undefined, 1);

    playerEngine.setShuffle(true);
    const state = usePlayerStore.getState();

    expect(state.shuffle).toBe(true);
    expect(state.currentIndex).toBe(1);
    expect(state.queue[0].id).toBe("1");
    expect(state.queue[1].id).toBe("2");

    const upcomingIds = state.queue.slice(2).map((t) => t.id);
    expect(upcomingIds.sort()).toEqual(["3", "4", "5", "6"]);
  });

  it("restores original relative order of remaining upcoming tracks when shuffle is disabled", async () => {
    const tracks = Array.from({ length: 6 }, (_, i) => mockTrack(String(i + 1), `Track ${i + 1}`));
    await playerEngine.playTrack(tracks[1], tracks, undefined, undefined, 1);

    playerEngine.setShuffle(true);

    await playerEngine.skipNext();
    const currentPlayingTrack = usePlayerStore.getState().currentTrack!;

    playerEngine.setShuffle(false);
    const state = usePlayerStore.getState();

    expect(state.shuffle).toBe(false);
    expect(state.currentTrack?.id).toBe(currentPlayingTrack.id);

    const remainingUpcoming = state.queue.slice(state.currentIndex + 1).map((t) => t.id);
    for (let i = 0; i < remainingUpcoming.length - 1; i++) {
      expect(Number(remainingUpcoming[i])).toBeLessThan(Number(remainingUpcoming[i + 1]));
    }
  });

  it("plays shuffled from full playlist and cleanly restores original order upon unshuffle", async () => {
    const tracks = Array.from({ length: 6 }, (_, i) => mockTrack(String(i + 1), `Track ${i + 1}`));
    await playerEngine.playShuffled(tracks, "playlist:test", null, 2);

    const state = usePlayerStore.getState();
    expect(state.shuffle).toBe(true);
    expect(state.currentIndex).toBe(0);
    expect(state.currentTrack?.id).toBe("3");
    expect(state.queue.length).toBe(6);

    await playerEngine.skipNext();
    const playingAfterSkip = usePlayerStore.getState().currentTrack!;

    playerEngine.setShuffle(false);
    const unshuffleState = usePlayerStore.getState();

    expect(unshuffleState.shuffle).toBe(false);
    expect(unshuffleState.currentTrack?.id).toBe(playingAfterSkip.id);

    const upcomingIds = unshuffleState.queue.slice(unshuffleState.currentIndex + 1).map((t) => t.id);
    for (let i = 0; i < upcomingIds.length - 1; i++) {
      expect(Number(upcomingIds[i])).toBeLessThan(Number(upcomingIds[i + 1]));
    }
  });

  it("does not re-shuffle queue when hand-picking a track from the queue while shuffle is enabled", async () => {
    const tracks = Array.from({ length: 6 }, (_, i) => mockTrack(String(i + 1), `Track ${i + 1}`));
    await playerEngine.playTrack(tracks[0], tracks, undefined, undefined, 0);

    playerEngine.setShuffle(true);
    const queueBeforePick = [...usePlayerStore.getState().queue];
    const pickedTrack = queueBeforePick[3];

    await playerEngine.playTrack(
      pickedTrack,
      queueBeforePick,
      undefined,
      undefined,
      3,
      true,
    );

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(3);
    expect(state.currentTrack?.id).toBe(pickedTrack.id);
    expect(state.queue.map((t) => t.id)).toEqual(queueBeforePick.map((t) => t.id));
  });
});

describe("Player auto-skip on playback error", () => {
  beforeEach(() => {
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
    });
  });

  it("advances to the next track when the current one fails to load/play", async () => {
    const tracks = [mockTrack("1", "Track 1"), mockTrack("2", "Track 2"), mockTrack("3", "Track 3")];
    await playerEngine.playTrack(tracks[0], tracks);
    expect(usePlayerStore.getState().currentIndex).toBe(0);

    playerRuntime!.onError!({ trackId: "1", message: "Track was not found." });

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.currentTrack?.id).toBe("2");
  });

  it("advances past a broken track even under repeat='one' instead of reselecting it forever", async () => {
    const tracks = [mockTrack("1", "Track 1"), mockTrack("2", "Track 2")];
    await playerEngine.playTrack(tracks[0], tracks);
    playerEngine.setRepeat("one");

    playerRuntime!.onError!({ trackId: "1", message: "dead track" });

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.currentTrack?.id).toBe("2");
  });

  it("ignores a stale error for a track the user has already navigated away from", async () => {
    const tracks = [mockTrack("1", "Track 1"), mockTrack("2", "Track 2")];
    await playerEngine.playTrack(tracks[0], tracks);
    await playerEngine.skipNext();
    expect(usePlayerStore.getState().currentTrack?.id).toBe("2");

    playerRuntime!.onError!({ trackId: "1", message: "stale error" });

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.currentTrack?.id).toBe("2");
  });

  it("stops instead of auto-skipping forever when many consecutive tracks fail", async () => {
    const tracks = Array.from({ length: 10 }, (_, i) => mockTrack(String(i + 1), `Track ${i + 1}`));
    await playerEngine.playTrack(tracks[0], tracks);

    for (let i = 0; i < 8; i++) {
      const current = usePlayerStore.getState().currentTrack;
      if (!current) break;
      playerRuntime!.onError!({ trackId: current.id, message: "dead track" });
    }

    const state = usePlayerStore.getState();
    expect(state.status).toBe("idle");
    expect(state.currentTrack).toBeNull();
  });

  describe("reorderQueue", () => {
    it("reorders queue items and tracks currentIndex when moving active track", async () => {
      const tracks = [
        mockTrack("1", "Track 1"),
        mockTrack("2", "Track 2"),
        mockTrack("3", "Track 3"),
        mockTrack("4", "Track 4"),
      ];
      await playerEngine.playTrack(tracks[1], tracks, null, null, 1);
      expect(usePlayerStore.getState().currentIndex).toBe(1);
      expect(usePlayerStore.getState().currentTrack?.id).toBe("2");

      playerEngine.reorderQueue(1, 3);

      const state = usePlayerStore.getState();
      expect(state.queue.map((t) => t.id)).toEqual(["1", "3", "4", "2"]);
      expect(state.currentIndex).toBe(3);
      expect(state.currentTrack?.id).toBe("2");
    });

    it("adjusts currentIndex when an item moves across the active track position", async () => {
      const tracks = [
        mockTrack("1", "Track 1"),
        mockTrack("2", "Track 2"),
        mockTrack("3", "Track 3"),
        mockTrack("4", "Track 4"),
      ];
      await playerEngine.playTrack(tracks[2], tracks, null, null, 2);
      expect(usePlayerStore.getState().currentIndex).toBe(2);

      playerEngine.reorderQueue(0, 3);
      expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(["2", "3", "4", "1"]);
      expect(usePlayerStore.getState().currentIndex).toBe(1);
      expect(usePlayerStore.getState().currentTrack?.id).toBe("3");

      playerEngine.reorderQueue(2, 0);
      expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(["4", "2", "3", "1"]);
      expect(usePlayerStore.getState().currentIndex).toBe(2);
      expect(usePlayerStore.getState().currentTrack?.id).toBe("3");
    });

    it("ignores invalid indices or equal from/to indices", async () => {
      const tracks = [mockTrack("1", "Track 1"), mockTrack("2", "Track 2")];
      await playerEngine.playTrack(tracks[0], tracks);

      playerEngine.reorderQueue(0, 0);
      playerEngine.reorderQueue(-1, 1);
      playerEngine.reorderQueue(0, 10);

      expect(usePlayerStore.getState().queue.map((t) => t.id)).toEqual(["1", "2"]);
      expect(usePlayerStore.getState().currentIndex).toBe(0);
    });
  });

  describe("Queue Preload Behavior", () => {
    it("preloads strictly only 1 next track in queue without spamming upcoming tracks", async () => {
      if (!playerRuntime) return;
      const preloadSpy = vi.spyOn(playerRuntime, "preloadTrack");
      const tracks = Array.from({ length: 10 }, (_, i) =>
        mockTrack(`queue-${i + 1}`, `Song ${i + 1}`),
      );

      await playerEngine.playTrack(tracks[0], tracks);
      expect(usePlayerStore.getState().currentIndex).toBe(0);

      expect(preloadSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: "queue-2" }),
      );
      expect(preloadSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: "queue-3" }),
      );
      expect(preloadSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: "queue-4" }),
      );

      preloadSpy.mockRestore();
    });
  });
});

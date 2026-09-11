import { describe, expect, it, beforeEach } from "vitest";
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
    // Play Track 2 (index 1). Played: [Track 1], Playing: Track 2, Upcoming: [3, 4, 5, 6]
    await playerEngine.playTrack(tracks[1], tracks, undefined, undefined, 1);

    playerEngine.setShuffle(true);
    const state = usePlayerStore.getState();

    expect(state.shuffle).toBe(true);
    expect(state.currentIndex).toBe(1);
    expect(state.queue[0].id).toBe("1");
    expect(state.queue[1].id).toBe("2");

    // Upcoming tracks must be a permutation of [3, 4, 5, 6]
    const upcomingIds = state.queue.slice(2).map((t) => t.id);
    expect(upcomingIds.sort()).toEqual(["3", "4", "5", "6"]);
  });

  it("restores original relative order of remaining upcoming tracks when shuffle is disabled", async () => {
    const tracks = Array.from({ length: 6 }, (_, i) => mockTrack(String(i + 1), `Track ${i + 1}`));
    await playerEngine.playTrack(tracks[1], tracks, undefined, undefined, 1);

    // Turn shuffle ON
    playerEngine.setShuffle(true);

    // Skip to next track (now playing index 2)
    await playerEngine.skipNext();
    const currentPlayingTrack = usePlayerStore.getState().currentTrack!;

    // Turn shuffle OFF
    playerEngine.setShuffle(false);
    const state = usePlayerStore.getState();

    expect(state.shuffle).toBe(false);
    expect(state.currentTrack?.id).toBe(currentPlayingTrack.id);

    // Played tracks + current track stay intact
    const remainingUpcoming = state.queue.slice(state.currentIndex + 1).map((t) => t.id);
    // Original upcoming tracks that were NOT played must maintain their relative order from 1..6
    for (let i = 0; i < remainingUpcoming.length - 1; i++) {
      expect(Number(remainingUpcoming[i])).toBeLessThan(Number(remainingUpcoming[i + 1]));
    }
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
});

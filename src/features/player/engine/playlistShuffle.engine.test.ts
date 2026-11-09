import { describe, expect, it, beforeEach } from "vitest";
import { playerEngine, usePlayerStore } from "./playerEngine";
import type { Track } from "@/shared/types";

const mockTrack = (id: string): Track => ({
  id,
  title: `Track ${id}`,
  artists: `Artist ${id}`,
  durationMs: 180000,
  coverUrl: `https://example.com/cover-${id}.jpg`,
  playCount: 0,
});

const playlist = (count: number) =>
  Array.from({ length: count }, (_, i) => mockTrack(String(i + 1)));

const ids = (tracks: Track[]) => tracks.map((track) => track.id);

async function playFrom(tracks: Track[], index: number, context: string) {
  await playerEngine.playTrack(tracks[index], tracks, context, null);
}

describe("shuffle toggled during a playlist (LIN-352)", () => {
  beforeEach(async () => {
    await playerEngine.stopAndClear();
    usePlayerStore.setState({
      status: "idle",
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      repeat: "off",
      shuffle: false,
      autoplaySimilar: false,
      playbackContext: null,
      error: null,
    });
  });

  it("puts the playing song on top and shuffles the whole playlist after it, played songs included", async () => {
    const tracks = playlist(10);
    await playFrom(tracks, 5, "playlist:p1");
    const playing = usePlayerStore.getState().currentTrack;

    playerEngine.setShuffle(true);
    const state = usePlayerStore.getState();

    expect(state.currentIndex).toBe(0);
    expect(state.currentTrack).toBe(playing);
    expect(state.queue[0].id).toBe("6");
    expect(new Set(ids(state.queue)).size).toBe(10);
    expect([...ids(state.queue)].sort()).toEqual([...ids(tracks)].sort());
    for (const played of ["1", "2", "3", "4", "5"]) {
      expect(ids(state.queue)).toContain(played);
    }
  });

  it("does not restart the playing song", async () => {
    const tracks = playlist(10);
    await playFrom(tracks, 3, "playlist:p1");
    usePlayerStore.setState({ status: "playing", positionMs: 42000 });

    playerEngine.setShuffle(true);
    const state = usePlayerStore.getState();

    expect(state.status).toBe("playing");
    expect(state.positionMs).toBe(42000);
    expect(state.currentTrack?.id).toBe("4");
  });

  it("plays every playlist song exactly once across a full shuffled run", async () => {
    const tracks = playlist(120);
    await playFrom(tracks, 60, "playlist:p1");
    playerEngine.setShuffle(true);

    const heard = [usePlayerStore.getState().currentTrack!.id];
    for (let i = 0; i < 119; i++) {
      await playerEngine.skipNext();
      heard.push(usePlayerStore.getState().currentTrack!.id);
    }

    expect(new Set(heard).size).toBe(120);
    await playerEngine.skipNext();
    expect(usePlayerStore.getState().currentTrack).toBeNull();
  });

  it("restores the playlist order from the current song when shuffle goes off", async () => {
    const tracks = playlist(10);
    await playFrom(tracks, 2, "playlist:p1");
    playerEngine.setShuffle(true);
    await playerEngine.skipNext();
    await playerEngine.skipNext();
    const playing = usePlayerStore.getState().currentTrack!;
    usePlayerStore.setState({ status: "playing", positionMs: 9000 });

    playerEngine.setShuffle(false);
    const state = usePlayerStore.getState();

    expect(ids(state.queue)).toEqual(ids(tracks));
    expect(state.currentTrack).toBe(playing);
    expect(state.queue[state.currentIndex].id).toBe(playing.id);
    expect(state.positionMs).toBe(9000);
    expect(state.status).toBe("playing");
  });

  it("keeps a play-next pick right after the current song when shuffle goes off", async () => {
    const tracks = playlist(6);
    await playFrom(tracks, 0, "playlist:p1");
    playerEngine.setShuffle(true);
    const extra = mockTrack("x");
    playerEngine.playNext(extra);

    playerEngine.setShuffle(false);
    const state = usePlayerStore.getState();

    expect(ids(state.queue)).toEqual(["1", "x", "2", "3", "4", "5", "6"]);
    expect(state.currentIndex).toBe(0);
  });

  it("starting a playlist with shuffle on puts the clicked song first and shuffles the rest", async () => {
    usePlayerStore.setState({ shuffle: true });
    const tracks = playlist(30);
    await playFrom(tracks, 12, "playlist:p1");

    const state = usePlayerStore.getState();
    expect(state.currentIndex).toBe(0);
    expect(state.currentTrack?.id).toBe("13");
    let heard = [state.currentTrack!.id];
    for (let i = 0; i < 29; i++) {
      await playerEngine.skipNext();
      heard.push(usePlayerStore.getState().currentTrack!.id);
    }
    heard = [...new Set(heard)];
    expect(heard.length).toBe(30);
  });

  it("keeps today's behavior for a queue that is not a playlist", async () => {
    const tracks = playlist(8);
    await playFrom(tracks, 3, "album:a1");

    playerEngine.setShuffle(true);
    const state = usePlayerStore.getState();

    expect(state.currentIndex).toBe(3);
    expect(ids(state.queue.slice(0, 4))).toEqual(["1", "2", "3", "4"]);
    expect([...ids(state.queue.slice(4))].sort()).toEqual(["5", "6", "7", "8"]);
  });

  it("forgets the playlist once a radio starts", async () => {
    const tracks = playlist(8);
    await playFrom(tracks, 3, "playlist:p1");
    await playerEngine.playTrack(tracks[0], tracks.slice(0, 4), "radio:1");

    playerEngine.setShuffle(true);
    const state = usePlayerStore.getState();

    expect(state.currentIndex).toBe(0);
    expect(state.queue.length).toBe(4);
  });

  it("adds songs that finish loading after playback started to the shuffle", async () => {
    const all = playlist(250);
    await playFrom(all.slice(0, 100), 10, "playlist:p1");
    playerEngine.setShuffle(true);
    playerEngine.syncPlaylistTracks("playlist:p1", all);

    const heard = [usePlayerStore.getState().currentTrack!.id];
    for (let i = 0; i < 249; i++) {
      await playerEngine.skipNext();
      heard.push(usePlayerStore.getState().currentTrack!.id);
    }
    expect(new Set(heard).size).toBe(250);
  });

  it("shuffles a 5,000 song playlist without putting it all in the queue", async () => {
    const tracks = playlist(5000);
    await playFrom(tracks, 4000, "playlist:big");

    const started = performance.now();
    playerEngine.setShuffle(true);
    const elapsed = performance.now() - started;
    const state = usePlayerStore.getState();

    expect(elapsed).toBeLessThan(50);
    expect(state.queue[0].id).toBe("4001");
    expect(state.queue.length).toBeLessThanOrEqual(101);
    expect(new Set(ids(state.queue)).size).toBe(state.queue.length);

    for (let i = 0; i < 150; i++) await playerEngine.skipNext();
    const later = usePlayerStore.getState();
    expect(later.queue.length).toBeLessThan(400);
    expect(later.queue.length - later.currentIndex).toBeGreaterThan(1);
    expect(new Set(ids(later.queue)).size).toBe(later.queue.length);

    playerEngine.setShuffle(false);
    const restored = usePlayerStore.getState();
    expect(restored.queue).toHaveLength(5000);
    expect(restored.queue[restored.currentIndex].id).toBe(
      later.currentTrack!.id,
    );
  });
});

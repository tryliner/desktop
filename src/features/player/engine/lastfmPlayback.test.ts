import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerEngine, usePlayerStore } from "./playerEngine";
import { playerRuntime } from "./playerRuntime";
import { lastfmTracker } from "@/features/lastfm/playbackTracker";
import type { LastfmBridge } from "@/features/lastfm/contracts";
import type { Track } from "@/shared/types";

const track: Track = {
  id: "same",
  title: "Same song",
  artists: "Artist",
  durationMs: 60000,
  coverUrl: "",
  playCount: 0,
};
let now = 0;
let bridge: LastfmBridge;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(playerRuntime!, "loadAndPlay").mockResolvedValue(undefined);
  vi.spyOn(playerRuntime!, "resume").mockImplementation(() => {});
  vi.spyOn(playerRuntime!, "pause").mockImplementation(() => {});
  vi.spyOn(playerEngine as any, "fetchLyricsForTrack").mockResolvedValue(
    undefined,
  );
  vi.spyOn(playerEngine as any, "preloadNextTrack").mockImplementation(
    () => {},
  );
  const status = {
    configured: true,
    connected: true,
    enabled: true,
    nowPlaying: true,
    authorizing: false,
    username: "listener",
    pending: 0,
    sessionOnly: false,
  };
  bridge = {
    status: async () => status,
    onChange: () => () => {},
    scrobble: vi.fn(async () => true),
    updateNowPlaying: vi.fn(),
  } as unknown as LastfmBridge;
  lastfmTracker.bind(bridge);
  lastfmTracker.updateStatus(status);
  lastfmTracker.stop();
  usePlayerStore.setState({
    currentTrack: null,
    currentIndex: -1,
    queue: [],
    positionMs: 0,
    repeat: "off",
    shuffle: false,
    autoplaySimilar: false,
  });
});
afterEach(() => {
  lastfmTracker.stop();
  vi.restoreAllMocks();
});

function listen() {
  lastfmTracker.progress(0, true, 1);
  for (let second = 1; second <= 30; second++) {
    now += 1000;
    lastfmTracker.progress(second * 1000, true, 1);
  }
}

describe("Last.fm player lifecycle", () => {
  it("uses real audio events and excludes buffering and seek jumps", async () => {
    await playerEngine.playTrack(track, [track]);
    const runtime = playerRuntime as unknown as {
      audio: HTMLAudioElement;
      currentTrackId: string;
      attachedTrackId: string;
      lastfmSourceReady: boolean;
    };
    runtime.currentTrackId = track.id;
    runtime.attachedTrackId = track.id;
    runtime.lastfmSourceReady = false;
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockReturnValue(
      false,
    );
    vi.spyOn(HTMLMediaElement.prototype, "seeking", "get").mockReturnValue(
      false,
    );
    vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(
      4,
    );
    usePlayerStore.getState().setStatus("playing");
    const tick = (second: number) => {
      runtime.audio.currentTime = second;
      runtime.audio.dispatchEvent(new Event("timeupdate"));
    };
    tick(0);
    expect(bridge.updateNowPlaying).not.toHaveBeenCalled();
    runtime.lastfmSourceReady = true;
    tick(0);
    for (let second = 1; second <= 10; second++) {
      now += 1000;
      tick(second);
    }
    runtime.audio.dispatchEvent(new Event("waiting"));
    now += 60000;
    tick(10);
    runtime.audio.dispatchEvent(new Event("seeking"));
    tick(40);
    expect(bridge.scrobble).not.toHaveBeenCalled();
    for (let second = 41; second <= 60; second++) {
      now += 1000;
      tick(second);
    }
    expect(bridge.scrobble).toHaveBeenCalledTimes(1);
    expect(bridge.scrobble).toHaveBeenCalledWith(
      expect.objectContaining({ artist: "Artist", track: "Same song" }),
    );
  });

  it("creates a new scrobble for repeat-one even though the track ID stays the same", async () => {
    await playerEngine.playTrack(track, [track]);
    listen();
    await Promise.resolve();
    usePlayerStore.getState().setRepeat("one");
    await playerEngine.skipNext(true);
    listen();
    const calls = vi.mocked(bridge.scrobble).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].id).not.toBe(calls[1][0].id);
  });

  it("tracks a restored paused track only after resuming without backfilling the saved position", () => {
    usePlayerStore.setState({
      currentTrack: track,
      queue: [track],
      currentIndex: 0,
      positionMs: 45000,
      status: "paused",
    });
    playerEngine.resume();
    expect(bridge.scrobble).not.toHaveBeenCalled();
    listen();
    expect(bridge.scrobble).toHaveBeenCalledTimes(1);
  });
});

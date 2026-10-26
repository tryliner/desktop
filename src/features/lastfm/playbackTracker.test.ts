import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/shared/types";
import type { LastfmBridge, LastfmStatus } from "./contracts";
import { LastfmPlaybackTracker, lastfmMetadata } from "./playbackTracker";

const track: Track = {
  id: "catalog-id",
  title: "Song",
  artists: "Artist, Other",
  artistList: [{ name: "Artist, With Comma" }, { name: "Other" }],
  album: { id: "album", title: "Album" },
  durationMs: 180000,
  coverUrl: "",
  playCount: 0,
};
const enabled: LastfmStatus = {
  configured: true,
  connected: true,
  authorizing: false,
  enabled: true,
  nowPlaying: true,
  pending: 0,
  sessionOnly: false,
  username: "listener",
};
let now: number;
let wall: number;
let tracker: LastfmPlaybackTracker;
let bridge: LastfmBridge;

function listen(seconds: number, start = 0, rate = 1) {
  tracker.progress(start * 1000, true, rate);
  for (let second = 1; second <= seconds; second++) {
    now += 1000;
    wall += 1000;
    tracker.progress((start + second * rate) * 1000, true, rate);
  }
}

beforeEach(() => {
  now = 0;
  wall = 1700000000000;
  bridge = {
    status: vi.fn(async () => enabled),
    onChange: vi.fn(() => () => {}),
    updateNowPlaying: vi.fn(),
    scrobble: vi.fn(async () => true),
  } as unknown as LastfmBridge;
  tracker = new LastfmPlaybackTracker(
    () => now,
    () => wall,
  );
  tracker.bind(bridge);
  tracker.updateStatus(enabled);
  tracker.begin(track, null);
});

describe("Last.fm listening eligibility", () => {
  it("submits once after half the track and uses the audible start timestamp", async () => {
    wall += 5000;
    listen(89);
    expect(bridge.scrobble).not.toHaveBeenCalled();
    now += 1000;
    tracker.progress(90000, true, 1);
    await Promise.resolve();
    expect(bridge.scrobble).toHaveBeenCalledTimes(1);
    expect(bridge.scrobble).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: 1700000005,
        track: "Song",
        album: "Album",
        artist: "Artist, With Comma",
      }),
    );
    listen(10, 90);
    expect(bridge.scrobble).toHaveBeenCalledTimes(1);
    expect(bridge.updateNowPlaying).toHaveBeenCalledTimes(1);
  });

  it("caps the threshold at four minutes and excludes tracks at or below thirty seconds", () => {
    tracker.begin({ ...track, durationMs: 1200000 }, null);
    listen(239);
    expect(bridge.scrobble).not.toHaveBeenCalled();
    now += 1000;
    tracker.progress(240000, true, 1);
    expect(bridge.scrobble).toHaveBeenCalledTimes(1);
    vi.mocked(bridge.scrobble).mockClear();
    tracker.begin({ ...track, durationMs: 30000 }, null);
    listen(30);
    expect(bridge.scrobble).not.toHaveBeenCalled();
  });

  it("does not count forward seeks, backward seeks, paused time, stalls, or system suspend", () => {
    listen(10);
    tracker.discontinuity();
    tracker.progress(150000, true, 1);
    expect(bridge.scrobble).not.toHaveBeenCalled();
    tracker.progress(150000, false, 1);
    now += 100000;
    tracker.progress(150000, true, 1);
    now += 1000;
    tracker.progress(150000, true, 1);
    tracker.discontinuity();
    tracker.progress(0, true, 1);
    now += 60000;
    tracker.progress(60000, true, 1);
    expect(bridge.scrobble).not.toHaveBeenCalled();
    listen(79, 60);
    expect(bridge.scrobble).not.toHaveBeenCalled();
    now += 1000;
    tracker.progress(140000, true, 1);
    expect(bridge.scrobble).toHaveBeenCalledTimes(1);
  });

  it("counts real listening time when speed changes", () => {
    listen(45, 0, 2);
    expect(bridge.scrobble).not.toHaveBeenCalled();
    tracker.discontinuity();
    listen(45, 90, 0.5);
    expect(bridge.scrobble).toHaveBeenCalledTimes(1);
  });

  it("creates separate plays for repeat-one and identical consecutive queue entries", async () => {
    listen(90);
    await Promise.resolve();
    const firstId = vi.mocked(bridge.scrobble).mock.calls[0][0].id;
    tracker.begin(track, null);
    listen(90);
    expect(bridge.scrobble).toHaveBeenCalledTimes(2);
    expect(vi.mocked(bridge.scrobble).mock.calls[1][0].id).not.toBe(firstId);
    expect(bridge.updateNowPlaying).toHaveBeenCalledTimes(2);
  });

  it("does not backfill restored position or listening before opt-in", () => {
    tracker.updateStatus({ ...enabled, enabled: false });
    listen(90);
    tracker.updateStatus(enabled);
    tracker.ensure(track, null);
    listen(89, 90);
    expect(bridge.scrobble).not.toHaveBeenCalled();
    now += 1000;
    tracker.progress(180000, true, 1);
    expect(bridge.scrobble).toHaveBeenCalledTimes(1);
  });

  it("uses later audio duration when catalog duration is missing, and does not require an album", () => {
    tracker.begin({ ...track, durationMs: 0, album: undefined }, "radio:seed");
    tracker.duration(60000);
    listen(30);
    expect(bridge.scrobble).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 60,
        album: undefined,
        chosenByUser: 0,
      }),
    );
  });

  it("retries local enqueue failures without duplicating an accepted play", async () => {
    vi.mocked(bridge.scrobble)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    listen(90);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    listen(5, 90);
    expect(bridge.scrobble).toHaveBeenCalledTimes(2);
  });

  it("stops on sign-out and suppresses Now Playing when disabled", () => {
    tracker.updateStatus({ ...enabled, nowPlaying: false });
    listen(10);
    expect(bridge.updateNowPlaying).not.toHaveBeenCalled();
    tracker.stop();
    listen(100);
    expect(bridge.scrobble).not.toHaveBeenCalled();
  });

  it("does not infer a title or artist from IDs, filenames, or source fallback", () => {
    expect(
      lastfmMetadata(
        { ...track, title: "", id: "Artist - Song.mp3" },
        60000,
        null,
      ),
    ).toBeNull();
    expect(
      lastfmMetadata(
        { ...track, artists: "Unknown Artist", artistList: [] },
        60000,
        null,
      ),
    ).toBeNull();
  });

  it("resets listening when switching Liner accounts even if they share a Last.fm username", () => {
    tracker.updateStatus({ ...enabled, ownerId: "liner-a" });
    listen(80);
    tracker.updateStatus({ ...enabled, ownerId: "liner-b" });
    listen(10, 80);
    expect(bridge.scrobble).not.toHaveBeenCalled();
    listen(80, 90);
    expect(bridge.scrobble).toHaveBeenCalledTimes(1);
  });
});

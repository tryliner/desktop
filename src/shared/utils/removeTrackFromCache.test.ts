import { describe, it, expect, beforeEach } from "vitest";
import { linerDb } from "@/shared/storage/linerDb";
import { audioCache } from "@/shared/storage/audioCache";
import { lyricsCache } from "@/features/lyrics";
import type { LyricsCandidate } from "@/shared/contracts/lyrics";
import { useCachedTracksStore } from "@/features/library/cached/store/cachedTracksStore";
import {
  removeTrackFromCache,
  subscribeStorageAnalytics,
} from "./cacheManager";

const track = {
  id: "cached_1",
  title: "Song",
  artists: "Artist",
  artistId: "artist_1",
  durationMs: 1000,
  coverUrl: "",
  playCount: 0,
};

const otherTrack = { ...track, id: "cached_2" };

const candidate: LyricsCandidate = {
  provider: "lrclib",
  contentKind: "line_synced",
  syncLevel: "line_level",
  quality: {
    total: 80,
    match: 20,
    content: 30,
    sync: 30,
    source: 0,
    reasons: [],
  },
  lyrics: { format: "lrc", content: "[00:01.00] line" },
};

function waitForCachedIds(): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = audioCache.subscribeCachedIds(() => {
      unsubscribe();
      resolve();
    });
  });
}

describe("removeTrackFromCache", () => {
  beforeEach(async () => {
    await linerDb.clearAll();
    audioCache.invalidate();
    lyricsCache.clear();
    useCachedTracksStore.setState({ items: [], loaded: false, loading: false });
  });

  it("tracks which tracks have cached audio", async () => {
    const seen = waitForCachedIds();
    await audioCache.saveAudioBlob(track.id, new Blob(["abc"]), "audio/ogg");
    await seen;
    expect(audioCache.isCached(track.id)).toBe(true);
    expect(audioCache.isCached(otherTrack.id)).toBe(false);

    await audioCache.deleteAudio(track.id);
    expect(audioCache.isCached(track.id)).toBe(false);
  });

  it("drops only that track's audio and lyrics and refreshes the cached list and analytics", async () => {
    for (const item of [track, otherTrack]) {
      await linerDb.putTrack(item);
      await audioCache.saveAudioBlob(item.id, new Blob(["abc"]), "audio/ogg");
      await linerDb.putLyrics({
        trackId: item.id,
        syncLevel: candidate.syncLevel,
        quality: candidate.quality.total,
        activeProvider: candidate.provider,
        availableProviders: [],
        rawLyrics: candidate.lyrics.content,
        rawFormat: candidate.lyrics.format,
        candidate,
        lastCheckedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    useCachedTracksStore.setState({
      loaded: true,
      items: [track, otherTrack].map((item) => ({
        track: item,
        bytes: 3,
        lastPlayedAt: 0,
      })),
    });

    let analyticsUpdates = 0;
    const unsubscribe = subscribeStorageAnalytics(() => {
      analyticsUpdates += 1;
    });

    await removeTrackFromCache(track.id);
    unsubscribe();

    expect(await linerDb.hasAudio(track.id)).toBe(false);
    expect(await linerDb.getLyrics(track.id)).toBeNull();
    expect(audioCache.isCached(track.id)).toBe(false);
    expect(await linerDb.hasAudio(otherTrack.id)).toBe(true);
    expect(await linerDb.getLyrics(otherTrack.id)).not.toBeNull();
    expect(await linerDb.getTrack(track.id)).not.toBeNull();
    expect(
      useCachedTracksStore.getState().items.map((item) => item.track.id),
    ).toEqual([otherTrack.id]);
    expect(analyticsUpdates).toBe(1);
  });
});

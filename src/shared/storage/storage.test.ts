import { describe, it, expect, beforeEach } from "vitest";
import { linerDb } from "./linerDb";
import { audioCache } from "./audioCache";

describe("linerDb storage layer", () => {
  beforeEach(async () => {
    await linerDb.clearAll();
  });

  it("stores and retrieves track metadata", async () => {
    await linerDb.putTrack({
      id: "track_test_1",
      title: "Test Song",
      artists: "Test Artist",
      durationMs: 180000,
      coverUrl: "",
      playCount: 0,
    });

    const record = await linerDb.getTrack("track_test_1");
    expect(record).not.toBeNull();
    expect(record?.title).toBe("Test Song");
    expect(record?.artists).toBe("Test Artist");
    expect(record?.durationMs).toBe(180000);
  });

  it("stores, checks, and calculates total bytes for audio blobs", async () => {
    const dummyBlob = new Blob(["dummy audio data content"], { type: "audio/ogg" });
    await audioCache.saveAudioBlob("track_audio_1", dummyBlob, "audio/ogg");

    const hasAudio = await audioCache.hasAudio("track_audio_1");
    expect(hasAudio).toBe(true);

    const totalBytes = await linerDb.getTotalAudioBytes();
    expect(totalBytes).toBe(dummyBlob.size);

    await audioCache.deleteAudio("track_audio_1");
    const hasAudioAfter = await audioCache.hasAudio("track_audio_1");
    expect(hasAudioAfter).toBe(false);
  });

  it("stores lyrics and updates weekly checked timestamp", async () => {
    const initialTime = Date.now() - 10000;
    await linerDb.putLyrics({
      trackId: "track_lyric_1",
      syncLevel: "word_level",
      quality: 95,
      activeProvider: "kugou",
      availableProviders: [],
      rawLyrics: "[00:01.00] Hello world",
      rawFormat: "lrc",
      candidate: {
        provider: "kugou",
        contentKind: "word_synced",
        syncLevel: "word_level",
        quality: {
          total: 95,
          match: 30,
          content: 30,
          sync: 35,
          source: 0,
          reasons: [],
        },
        lyrics: {
          format: "lrc",
          content: "[00:01.00] Hello world",
        },
      },
      lastCheckedAt: initialTime,
      updatedAt: initialTime,
    });

    const record = await linerDb.getLyrics("track_lyric_1");
    expect(record).not.toBeNull();
    expect(record?.syncLevel).toBe("word_level");
    expect(record?.quality).toBe(95);
    expect(record?.lastCheckedAt).toBe(initialTime);

    await linerDb.updateLyricsChecked("track_lyric_1");
    const updated = await linerDb.getLyrics("track_lyric_1");
    expect(updated?.lastCheckedAt).toBeGreaterThan(initialTime);

    await linerDb.putLyrics({
      trackId: "track_line_only",
      syncLevel: "line_level",
      quality: 60,
      activeProvider: "lrclib",
      availableProviders: [],
      rawLyrics: "[00:01.00] Line only",
      rawFormat: "lrc",
      candidate: {
        provider: "lrclib",
        contentKind: "line_synced",
        syncLevel: "line_level",
        quality: {
          total: 60,
          match: 20,
          content: 20,
          sync: 20,
          source: 0,
          reasons: [],
        },
        lyrics: {
          format: "lrc",
          content: "[00:01.00] Line only",
        },
      },
      lastCheckedAt: initialTime,
      updatedAt: initialTime,
    });
    const lineRecord = await linerDb.getLyrics("track_line_only");
    expect(lineRecord).toBeNull();
  });

  it("stores artist data and calculates total artist bytes", async () => {
    const initialTime = Date.now() - 50000;
    await linerDb.putArtist({
      id: "artist_test_1",
      data: {
        title: "Test Artist",
        description: "Bio",
        coverUrl: "https://example.com/cover.jpg",
        verified: true,
        tracks: [],
        popularSongs: [],
        albums: [],
        reposts: [],
        singles: [],
      },
      savedAt: initialTime,
      lastCheckedAt: initialTime,
    });

    const record = await linerDb.getArtist("artist_test_1");
    expect(record).not.toBeNull();
    expect(record?.data.title).toBe("Test Artist");
    expect(record?.lastCheckedAt).toBe(initialTime);

    const totalBytes = await linerDb.getTotalArtistBytes();
    expect(totalBytes).toBeGreaterThan(0);

    await linerDb.updateArtistChecked("artist_test_1");
    const updated = await linerDb.getArtist("artist_test_1");
    expect(updated?.lastCheckedAt).toBeGreaterThan(initialTime);
  });

  it("tracks lastPlayedAt on putAudio and touchAudio", async () => {
    const blob1 = new Blob(["audio content 1"], { type: "audio/ogg" });
    const earlyTime = 100000;
    await linerDb.putAudio("track_lru_1", blob1, "audio/ogg", earlyTime);

    const initial = await linerDb.getAudio("track_lru_1");
    expect(initial?.lastPlayedAt).toBe(earlyTime);

    await linerDb.touchAudio("track_lru_1");
    const touched = await linerDb.getAudio("track_lru_1");
    expect(touched?.lastPlayedAt).toBeGreaterThan(earlyTime);
  });

  it("enforces cache limit and evicts oldest played tracks first", async () => {
    const chunk1 = new Blob(["1234567890".repeat(10)], { type: "audio/ogg" });
    const chunk2 = new Blob(["1234567890".repeat(10)], { type: "audio/ogg" });
    const chunk3 = new Blob(["1234567890".repeat(10)], { type: "audio/ogg" });

    await linerDb.putAudio("track_oldest", chunk1, "audio/ogg", 1000);
    await linerDb.putAudio("track_middle", chunk2, "audio/ogg", 2000);
    await linerDb.putAudio("track_newest", chunk3, "audio/ogg", 3000);

    const initialTotal = await linerDb.getTotalAudioBytes();
    expect(initialTotal).toBe(300);

    const limit = 200;
    const evicted = await audioCache.enforceCacheLimit(limit);
    expect(evicted).toBeGreaterThan(0);

    const hasOldest = await audioCache.hasAudio("track_oldest");
    const hasNewest = await audioCache.hasAudio("track_newest");

    expect(hasOldest).toBe(false);
    expect(hasNewest).toBe(true);
  });

  it("handles getLimitBytes and setLimitBytes with defaults and clamping", async () => {
    const memStorage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => memStorage.get(key) ?? null,
      setItem: (key: string, val: string) => memStorage.set(key, val),
      removeItem: (key: string) => memStorage.delete(key),
      clear: () => memStorage.clear(),
      length: 0,
      key: () => null,
    };
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    expect(audioCache.getLimitBytes()).toBe(3 * 1024 * 1024 * 1024);

    await audioCache.setLimitBytes(100);
    expect(audioCache.getLimitBytes()).toBe(250 * 1024 * 1024);

    await audioCache.setLimitBytes(0);
    expect(audioCache.getLimitBytes()).toBe(0);

    await audioCache.setLimitBytes(5 * 1024 * 1024 * 1024);
    expect(audioCache.getLimitBytes()).toBe(5 * 1024 * 1024 * 1024);
  });
});

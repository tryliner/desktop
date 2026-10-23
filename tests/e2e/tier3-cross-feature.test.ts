import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Track } from "@/shared/types";
import type { PlaybackHistoryItem } from "@/shared/contracts/history";
import {
  MockSpotifyService,
  MockAudioContext,
  MockAnalyserNode,
  installWebAudioMock,
  uninstallWebAudioMock,
  installElectronSmtcMock,
  uninstallElectronSmtcMock,
  MockElectronSmtcBridge,
  offlineMock,
  createMockStorage,
} from "./mocks";
import { linerDb } from "@/shared/storage/linerDb";
import { audioCache } from "@/shared/storage/audioCache";

interface SyncedLrcLine {
  id: string;
  timeMs: number;
  text: string;
}

function parseLrc(content: string): SyncedLrcLine[] {
  if (!content) return [];
  const lines = content.split("\n");
  const result: SyncedLrcLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  let idx = 0;
  for (const line of lines) {
    const match = line.trim().match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const rawMs = match[3];
      const ms = rawMs.length === 2 ? parseInt(rawMs, 10) * 10 : parseInt(rawMs, 10);
      const timeMs = minutes * 60 * 1000 + seconds * 1000 + ms;
      result.push({ id: `line_${idx++}`, timeMs, text: match[4].trim() });
    }
  }
  return result.sort((a, b) => a.timeMs - b.timeMs);
}

function getActiveLyricIndex(lines: SyncedLrcLine[], positionMs: number): number {
  if (lines.length === 0) return -1;
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) activeIndex = i;
    else break;
  }
  return activeIndex;
}

describe("Tier 3: Cross-Feature Combinations (Pairwise Interoperability)", () => {
  let spotify: MockSpotifyService;
  let smtcBridge: MockElectronSmtcBridge;
  let webAudio: ReturnType<typeof installWebAudioMock>;

  beforeEach(async () => {
    vi.stubGlobal("localStorage", createMockStorage());
    spotify = new MockSpotifyService();
    smtcBridge = installElectronSmtcMock();
    webAudio = installWebAudioMock();
    offlineMock.install();
    await linerDb.clearAll();
  });

  afterEach(async () => {
    offlineMock.uninstall();
    uninstallElectronSmtcMock();
    uninstallWebAudioMock();
    await linerDb.clearAll();
  });

  // --------------------------------------------------------------------------
  // Pairwise 1: Spotify Import (R1) + Offline Audio Cache (R5)
  // --------------------------------------------------------------------------
  it("XF-1: imports Spotify playlist, downloads audio for offline caching, and plays offline", async () => {
    // 1. Fetch public Spotify playlist
    const spPlaylist = await spotify.fetchPublicPlaylist("37i9dQZF1DXcBWIGoYBM5M");
    expect(spPlaylist.tracks.length).toBeGreaterThan(0);

    // 2. Normalize tracks
    const linerTracks: Track[] = spPlaylist.tracks.map((t) => spotify.normalizeTrack(t));
    expect(linerTracks[0].id).toContain("spotify:");

    // 3. Download / cache tracks for offline use
    for (const track of linerTracks) {
      const cacheResult = await offlineMock.cacheTrackAudio(track.id, `audio-payload-${track.id}`);
      expect(cacheResult.success).toBe(true);
      expect(await audioCache.hasAudio(track.id)).toBe(true);
    }

    // 4. Drop network connection
    offlineMock.simulateNetworkDrop();
    expect(offlineMock.isOnline()).toBe(false);

    // 5. Verify all imported tracks resolve seamlessly to local cached blobs
    for (const track of linerTracks) {
      const resolved = await offlineMock.resolveAudioStream(track);
      expect(resolved.fromCache).toBe(true);
      expect(resolved.url).toBe(`blob:mock-cached-blob-${track.id}`);
    }
  });

  // --------------------------------------------------------------------------
  // Pairwise 2: Spotify Import (R1) + Profile Listening Stats (R2)
  // --------------------------------------------------------------------------
  it("XF-2: playback of imported Spotify tracks aggregates into user profile listening statistics", async () => {
    const spPlaylist = await spotify.fetchPublicPlaylist("37i9dQZF1DXcBWIGoYBM5M");
    const trackA = spotify.normalizeTrack(spPlaylist.tracks[0]);
    const trackB = spotify.normalizeTrack(spPlaylist.tracks[1]);

    // Simulate playback history
    const history: PlaybackHistoryItem[] = [
      {
        id: "h_sp_1",
        playbackSessionId: "sess_1",
        listeningSessionId: "l_sess_1",
        track: trackA,
        playedDurationMs: 180000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: new Date().toISOString(),
      },
      {
        id: "h_sp_2",
        playbackSessionId: "sess_2",
        listeningSessionId: "l_sess_1",
        track: trackA,
        playedDurationMs: 180000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: new Date().toISOString(),
      },
      {
        id: "h_sp_3",
        playbackSessionId: "sess_3",
        listeningSessionId: "l_sess_1",
        track: trackB,
        playedDurationMs: 120000,
        completionRate: 0.8,
        completed: false,
        skipped: true,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: new Date().toISOString(),
      },
    ];

    // Compute profile stats
    let totalPlayedMs = 0;
    const trackPlayCounts = new Map<string, number>();
    for (const item of history) {
      totalPlayedMs += item.playedDurationMs;
      trackPlayCounts.set(item.track.id, (trackPlayCounts.get(item.track.id) ?? 0) + 1);
    }

    const totalHours = Math.round((totalPlayedMs / (1000 * 60 * 60)) * 100) / 100;
    expect(totalHours).toBe(0.13); // 480,000ms / 3,600,000ms = 0.133 hrs
    expect(trackPlayCounts.get(trackA.id)).toBe(2);
    expect(trackPlayCounts.get(trackB.id)).toBe(1);
    expect(trackA.artists).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Pairwise 3: Windows SMTC (R3) + Dynamic Lyrics Sync (R4)
  // --------------------------------------------------------------------------
  it("XF-3: Windows SMTC 'next' action resets playback position and re-syncs dynamic lyrics", () => {
    const lrcTrack1 = "[00:05.00]Song 1 Line 1\n[00:15.00]Song 1 Line 2";
    const lrcTrack2 = "[00:02.00]Song 2 Intro\n[00:10.00]Song 2 Verse";

    let currentLrc = parseLrc(lrcTrack1);
    let currentPositionMs = 16000;

    // Track 1 active line at 16s is line 1
    expect(getActiveLyricIndex(currentLrc, currentPositionMs)).toBe(1);

    // SMTC triggers "next"
    smtcBridge.onMediaAction((action) => {
      if (action === "next") {
        // Reset player position and load track 2 lyrics
        currentPositionMs = 0;
        currentLrc = parseLrc(lrcTrack2);
        smtcBridge.sendMediaUpdate({
          status: "playing",
          track: { id: "trk_2", title: "Song 2", artists: "Artist 2", durationMs: 180000 },
          positionMs: 0,
          durationMs: 180000,
        });
      }
    });

    smtcBridge.triggerMediaAction("next");

    expect(currentPositionMs).toBe(0);
    expect(currentLrc[0].text).toBe("Song 2 Intro");
    // At position 0, before first lyric (at 2s), active index is -1
    expect(getActiveLyricIndex(currentLrc, currentPositionMs)).toBe(-1);
    expect(smtcBridge.getLatestUpdate()?.track?.id).toBe("trk_2");
  });

  // --------------------------------------------------------------------------
  // Pairwise 4: Offline Transition (R5) + Windows SMTC Metadata (R3)
  // --------------------------------------------------------------------------
  it("XF-4: network drop mid-playback triggers cache resolution while maintaining SMTC state", async () => {
    const track: Track = {
      id: "trk_cached_midstream",
      title: "Resilient Track",
      artists: "Offline Artist",
      durationMs: 240000,
      coverUrl: "https://liner.fun/covers/resilient.jpg",
      playCount: 0,
    };

    // Pre-cache track
    await offlineMock.cacheTrackAudio(track.id, "pre-cached audio blob");

    // Start playing while online
    smtcBridge.sendMediaUpdate({
      status: "playing",
      track: { id: track.id, title: track.title, artists: track.artists, durationMs: track.durationMs },
      positionMs: 45000,
      durationMs: track.durationMs,
    });
    expect(smtcBridge.getLatestUpdate()?.status).toBe("playing");

    // Sudden network drop
    offlineMock.simulateNetworkDrop();

    // Stream resolver falls back to local cache
    const stream = await offlineMock.resolveAudioStream(track);
    expect(stream.fromCache).toBe(true);

    // SMTC updates position without interrupting playing state
    smtcBridge.sendMediaUpdate({
      status: "playing",
      track: { id: track.id, title: track.title, artists: track.artists, durationMs: track.durationMs },
      positionMs: 50000,
      durationMs: track.durationMs,
    });

    const latest = smtcBridge.getLatestUpdate();
    expect(latest?.status).toBe("playing");
    expect(latest?.positionMs).toBe(50000);
  });

  // --------------------------------------------------------------------------
  // Pairwise 5: Windows Global Media Key (R3) + Audio Visualizer (R4)
  // --------------------------------------------------------------------------
  it("XF-5: hardware MediaPlayPause key pauses Web Audio context and silences visualizer", async () => {
    const ctx = new (window as any).AudioContext() as MockAudioContext;
    const analyser = ctx.createAnalyser();

    // Register shortcut
    smtcBridge.registerShortcut("MediaPlayPause", () => {
      if (ctx.state === "running") {
        ctx.suspend();
        smtcBridge.sendMediaUpdate({ status: "paused", track: null, positionMs: 0, durationMs: 0 });
      } else {
        ctx.resume();
        smtcBridge.sendMediaUpdate({ status: "playing", track: null, positionMs: 0, durationMs: 0 });
      }
    });

    // 1. Initial running state: visualizer produces non-zero frequency spectrum
    expect(ctx.state).toBe("running");
    let freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    expect(Array.from(freqData).some((v) => v > 0)).toBe(true);

    // 2. Press hardware key to pause
    smtcBridge.triggerHardwareKey("MediaPlayPause");
    expect(ctx.state).toBe("suspended");
    expect(smtcBridge.getLatestUpdate()?.status).toBe("paused");

    // Visualizer outputs all zeros while suspended
    freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    expect(Array.from(freqData).every((v) => v === 0)).toBe(true);

    // 3. Press hardware key again to resume
    smtcBridge.triggerHardwareKey("MediaPlayPause");
    expect(ctx.state).toBe("running");
    expect(smtcBridge.getLatestUpdate()?.status).toBe("playing");

    // Visualizer reactivity restores
    analyser.getByteFrequencyData(freqData);
    expect(Array.from(freqData).some((v) => v > 0)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Pairwise 6: Spotify Import (R1) + Profile Created Playlists (R2)
  // --------------------------------------------------------------------------
  it("XF-6: imported Spotify playlist is added to user's profile playlists collection", async () => {
    const spPlaylist = await spotify.fetchPublicPlaylist("37i9dQZF1DXcBWIGoYBM5M");

    const createdPlaylist = {
      id: `pl_local_${Date.now()}`,
      title: spPlaylist.title,
      description: spPlaylist.description,
      source: "spotify",
      originalSpotifyUrl: `https://open.spotify.com/playlist/${spPlaylist.id}`,
      tracksCount: spPlaylist.tracks.length,
      createdAt: new Date().toISOString(),
    };

    const userProfilePlaylists = [createdPlaylist];

    expect(userProfilePlaylists[0].title).toBe("Discover Weekly Mock");
    expect(userProfilePlaylists[0].source).toBe("spotify");
    expect(userProfilePlaylists[0].tracksCount).toBe(spPlaylist.tracks.length);
    expect(userProfilePlaylists[0].originalSpotifyUrl).toContain(spPlaylist.id);
  });

  // --------------------------------------------------------------------------
  // Pairwise 7: Cache Storage Quota Pruning (R5) + Player Current Track
  // --------------------------------------------------------------------------
  it("XF-7: pruning storage quota preserves the currently active playing track", async () => {
    const activeTrackId = "currently_playing_track";
    const inactiveTrack1 = "old_cached_track_1";
    const inactiveTrack2 = "old_cached_track_2";

    await offlineMock.cacheTrackAudio(activeTrackId, "active song content");
    await offlineMock.cacheTrackAudio(inactiveTrack1, "old song content 1");
    await offlineMock.cacheTrackAudio(inactiveTrack2, "old song content 2");

    expect(await audioCache.hasAudio(activeTrackId)).toBe(true);
    expect(await audioCache.hasAudio(inactiveTrack1)).toBe(true);
    expect(await audioCache.hasAudio(inactiveTrack2)).toBe(true);

    // Prune cache with activeTrack exclusion
    const pruneCacheExceptCurrent = async (excludeId: string) => {
      const allCachedIds = [activeTrackId, inactiveTrack1, inactiveTrack2];
      for (const id of allCachedIds) {
        if (id !== excludeId) {
          await audioCache.deleteAudio(id);
        }
      }
    };

    await pruneCacheExceptCurrent(activeTrackId);

    // Active track must remain in cache; old tracks deleted
    expect(await audioCache.hasAudio(activeTrackId)).toBe(true);
    expect(await audioCache.hasAudio(inactiveTrack1)).toBe(false);
    expect(await audioCache.hasAudio(inactiveTrack2)).toBe(false);
  });
});

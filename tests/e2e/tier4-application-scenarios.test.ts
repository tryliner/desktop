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

interface UserListeningStats {
  totalHoursListened: number;
  totalTracksPlayed: number;
  topTracks: Array<{ track: Track; playCount: number; totalPlayedMs: number }>;
  topArtists: Array<{ artistName: string; playCount: number }>;
  calculatedAt: string;
}

function computeListeningStats(history: PlaybackHistoryItem[]): UserListeningStats {
  let totalPlayedMs = 0;
  const trackMap = new Map<string, { track: Track; playCount: number; totalPlayedMs: number }>();
  const artistMap = new Map<string, number>();

  for (const item of history) {
    totalPlayedMs += item.playedDurationMs;
    const existing = trackMap.get(item.track.id) ?? { track: item.track, playCount: 0, totalPlayedMs: 0 };
    existing.playCount += 1;
    existing.totalPlayedMs += item.playedDurationMs;
    trackMap.set(item.track.id, existing);

    const artistName = item.track.artists || "Unknown Artist";
    artistMap.set(artistName, (artistMap.get(artistName) ?? 0) + 1);
  }

  const topTracks = Array.from(trackMap.values())
    .sort((a, b) => b.playCount - a.playCount || b.totalPlayedMs - a.totalPlayedMs)
    .slice(0, 10);

  const topArtists = Array.from(artistMap.entries())
    .map(([artistName, playCount]) => ({ artistName, playCount }))
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 10);

  return {
    totalHoursListened: history.length === 0 ? 0 : Math.round((totalPlayedMs / (1000 * 60 * 60)) * 100) / 100,
    totalTracksPlayed: history.length,
    topTracks,
    topArtists,
    calculatedAt: new Date().toISOString(),
  };
}

describe("Tier 4: Real-World Application Scenarios (End-to-End User Workflows)", () => {
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
  // Scenario 1: Complete Spotify Onboarding & Import Journey
  // --------------------------------------------------------------------------
  it("Scenario 1: executes full Spotify PKCE OAuth flow, playlist browsing, catalog import, and playback with SMTC", async () => {
    // Step 1: User clicks "Connect Spotify" -> generate PKCE authorize URL
    const { url, codeVerifier, state } = await spotify.generateAuthorizeUrl();
    expect(url).toContain("code_challenge=");
    expect(url).toContain(`state=${state}`);

    // Step 2: Deep link redirect received from browser
    const deepLinkUrl = `liner://spotify-callback?code=mock_code_abc123&state=${state}`;
    const parsedCallback = new URL(deepLinkUrl);
    const authCode = parsedCallback.searchParams.get("code")!;
    const returnedState = parsedCallback.searchParams.get("state")!;
    expect(returnedState).toBe(state);

    // Step 3: Exchange code for tokens
    const tokens = await spotify.exchangeCode(authCode, codeVerifier);
    expect(tokens.accessToken).toBeDefined();

    // Step 4: Browse user's private and public Spotify playlists
    const playlists = await spotify.getUserPlaylists(tokens.accessToken);
    expect(playlists.length).toBeGreaterThan(0);
    const selectedPlaylist = playlists[0];
    expect(selectedPlaylist.name).toBe("Morning Acoustic Vibes");

    // Step 5: Import public playlist tracks into Liner
    const playlistDetails = await spotify.fetchPublicPlaylist(selectedPlaylist.id);
    const importedTracks: Track[] = playlistDetails.tracks.map((t) => spotify.normalizeTrack(t));
    expect(importedTracks.length).toBeGreaterThan(0);

    // Step 6: Start playback on track 1 and broadcast metadata to Windows SMTC
    const currentTrack = importedTracks[0];
    smtcBridge.sendMediaUpdate({
      status: "playing",
      track: {
        id: currentTrack.id,
        title: currentTrack.title,
        artists: currentTrack.artists,
        coverUrl: currentTrack.coverUrl,
        durationMs: currentTrack.durationMs,
      },
      positionMs: 0,
      durationMs: currentTrack.durationMs,
    });

    const smtcStatus = smtcBridge.getLatestUpdate();
    expect(smtcStatus?.status).toBe("playing");
    expect(smtcStatus?.track?.title).toBe(currentTrack.title);
    expect(smtcStatus?.track?.artists).toBe(currentTrack.artists);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Profile Customization & Statistics Growth
  // --------------------------------------------------------------------------
  it("Scenario 2: user customizes profile, plays tracks across multiple sessions, and inspects updated stats and share link", () => {
    const profileStorageKey = "liner_user_profile";
    const historyStorageKey = "liner_playback_history";

    // Step 1: Initialize user profile
    const initialProfile = {
      id: "usr_scenario_2",
      handle: "new_listener",
      username: "New Listener",
      bio: "Just getting started with Liner.",
      avatarUrl: "https://assets.liner.fun/avatars/preset_1.png",
    };
    localStorage.setItem(profileStorageKey, JSON.stringify(initialProfile));

    // Step 2: User customizes profile
    const updatedProfile = {
      ...initialProfile,
      handle: "synth_master",
      bio: "Producing synthwave and dreaming in neon retro colors.",
      avatarUrl: "https://assets.liner.fun/avatars/preset_3.png",
    };
    localStorage.setItem(profileStorageKey, JSON.stringify(updatedProfile));

    // Step 3: Simulate playback across sessions
    const track1: Track = { id: "t1", title: "Resonance", artists: "HOME", durationMs: 210000, coverUrl: "", playCount: 0 };
    const track2: Track = { id: "t2", title: "Sunset", artists: "The Midnight", durationMs: 300000, coverUrl: "", playCount: 0 };

    const playbackHistory: PlaybackHistoryItem[] = [
      {
        id: "h1",
        playbackSessionId: "s1",
        listeningSessionId: "l1",
        track: track1,
        playedDurationMs: 210000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-22T10:00:00Z",
      },
      {
        id: "h2",
        playbackSessionId: "s2",
        listeningSessionId: "l1",
        track: track1,
        playedDurationMs: 210000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-22T10:10:00Z",
      },
      {
        id: "h3",
        playbackSessionId: "s3",
        listeningSessionId: "l1",
        track: track2,
        playedDurationMs: 300000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-22T10:20:00Z",
      },
    ];
    localStorage.setItem(historyStorageKey, JSON.stringify(playbackHistory));

    // Step 4: Calculate listening stats
    const stats = computeListeningStats(playbackHistory);
    expect(stats.totalTracksPlayed).toBe(3);
    // Total played = 210k + 210k + 300k = 720,000ms = 0.20 hrs
    expect(stats.totalHoursListened).toBe(0.2);
    expect(stats.topTracks[0].track.title).toBe("Resonance");
    expect(stats.topTracks[0].playCount).toBe(2);
    expect(stats.topArtists[0].artistName).toBe("HOME");

    // Step 5: Verify public share link matches handle
    const retrievedProfile = JSON.parse(localStorage.getItem(profileStorageKey)!);
    const shareUrl = `https://liner.fun/profile/${retrievedProfile.handle}`;
    expect(shareUrl).toBe("https://liner.fun/profile/synth_master");
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Commuter Airplane Offline Mode
  // --------------------------------------------------------------------------
  it("Scenario 3: pre-caches playlist, switches to offline mode, plays cached tracks, and recovers on reconnect", async () => {
    const playlistTracks: Track[] = [
      { id: "plane_trk_1", title: "Altitude", artists: "Cloud Nine", durationMs: 180000, coverUrl: "", playCount: 0 },
      { id: "plane_trk_2", title: "Cruising Speed", artists: "Airwaves", durationMs: 220000, coverUrl: "", playCount: 0 },
      { id: "plane_trk_3", title: "Touchdown", artists: "Runway", durationMs: 200000, coverUrl: "", playCount: 0 },
    ];

    // Step 1: Pre-download tracks while online at airport
    expect(offlineMock.isOnline()).toBe(true);
    for (const track of playlistTracks) {
      await offlineMock.cacheTrackAudio(track.id, `audio-blob-${track.id}`);
      expect(await audioCache.hasAudio(track.id)).toBe(true);
    }

    // Step 2: Board flight -> enable Airplane Mode (network disconnects)
    offlineMock.simulateNetworkDrop();
    expect(offlineMock.isOnline()).toBe(false);
    expect(navigator.onLine).toBe(false);

    // Step 3: Play cached tracks sequentially while offline
    const res1 = await offlineMock.resolveAudioStream(playlistTracks[0]);
    expect(res1.fromCache).toBe(true);
    expect(res1.url).toBe(`blob:mock-cached-blob-${playlistTracks[0].id}`);

    const res2 = await offlineMock.resolveAudioStream(playlistTracks[1]);
    expect(res2.fromCache).toBe(true);
    expect(res2.url).toBe(`blob:mock-cached-blob-${playlistTracks[1].id}`);

    // Step 4: Attempt to play uncached track 99 -> gracefully caught with OfflineError
    const uncachedTrack: Track = { id: "plane_trk_uncached", title: "Online Only", artists: "Streamer", durationMs: 150000, coverUrl: "", playCount: 0 };
    await expect(offlineMock.resolveAudioStream(uncachedTrack)).rejects.toThrow(/OfflineError/);

    // Step 5: Landing -> Wi-Fi reconnected
    offlineMock.simulateNetworkRestore();
    expect(offlineMock.isOnline()).toBe(true);

    // Uncached track now streams normally over network
    const resOnline = await offlineMock.resolveAudioStream(uncachedTrack);
    expect(resOnline.fromCache).toBe(false);
    expect(resOnline.url).toContain("stream.liner.fun");
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Desktop Windows Immersion & Karaoke
  // --------------------------------------------------------------------------
  it("Scenario 4: synchronizes playback, dynamic lyrics, audio visualizer, and global media keys", () => {
    const lrcContent = `
      [00:04.00]First verse begins
      [00:10.00]Chorus arrives in full force
      [00:18.00]Bass drop hits with power
      [00:28.00]Outro fades gently into silence
    `;
    const syncedLyrics = parseLrc(lrcContent);
    expect(syncedLyrics).toHaveLength(4);

    const ctx = new (window as any).AudioContext() as MockAudioContext;
    const analyser = ctx.createAnalyser();

    // Connect audio visualizer graph
    analyser.connect(ctx.destination);
    expect(analyser.isConnected).toBe(true);

    let currentTrack: Track = {
      id: "trk_karaoke",
      title: "Neon Echoes",
      artists: "Cyber Wave",
      durationMs: 40000,
      coverUrl: "https://liner.fun/covers/karaoke.jpg",
      playCount: 0,
    };
    let currentPositionMs = 0;

    // Start playback
    smtcBridge.sendMediaUpdate({
      status: "playing",
      track: { id: currentTrack.id, title: currentTrack.title, artists: currentTrack.artists, durationMs: currentTrack.durationMs },
      positionMs: 0,
      durationMs: currentTrack.durationMs,
    });

    // Advance playback to 11,500ms (Chorus)
    currentPositionMs = 11500;
    const activeIndex = getActiveLyricIndex(syncedLyrics, currentPositionMs);
    expect(activeIndex).toBe(1);
    expect(syncedLyrics[activeIndex].text).toBe("Chorus arrives in full force");

    // Audio visualizer frequency check during playback
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    expect(freqData[0]).toBeGreaterThan(0);

    // User seeks via click on lyric line 2 (Bass drop at 18,000ms)
    currentPositionMs = syncedLyrics[2].timeMs;
    expect(getActiveLyricIndex(syncedLyrics, currentPositionMs)).toBe(2);
    expect(syncedLyrics[2].text).toBe("Bass drop hits with power");

    // Background playback control: press hardware MediaNextTrack key
    smtcBridge.registerShortcut("MediaNextTrack", () => {
      // Switch track
      currentTrack = { id: "trk_karaoke_2", title: "Future Sounds", artists: "Cyber Wave", durationMs: 50000, coverUrl: "", playCount: 0 };
      currentPositionMs = 0;
      smtcBridge.sendMediaUpdate({
        status: "playing",
        track: { id: currentTrack.id, title: currentTrack.title, artists: currentTrack.artists, durationMs: currentTrack.durationMs },
        positionMs: 0,
        durationMs: currentTrack.durationMs,
      });
    });

    smtcBridge.triggerHardwareKey("MediaNextTrack");
    expect(smtcBridge.getLatestUpdate()?.track?.title).toBe("Future Sounds");
    expect(currentPositionMs).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Storage Limit Recovery & Cache Management
  // --------------------------------------------------------------------------
  it("Scenario 5: sets disk storage limit, triggers LRU eviction on overflow, and purges cache from settings", async () => {
    // Step 1: User configures storage cap of 150 bytes in Settings
    offlineMock.setStorageLimitBytes(150);
    expect(offlineMock.getStorageLimitBytes()).toBe(150);

    // Step 2: Download tracks 1 and 2 (60 bytes each = 120 bytes)
    await offlineMock.cacheTrackAudio("track_1", "X".repeat(60));
    await offlineMock.cacheTrackAudio("track_2", "Y".repeat(60));

    expect(await audioCache.hasAudio("track_1")).toBe(true);
    expect(await audioCache.hasAudio("track_2")).toBe(true);

    // Step 3: Download track 3 (60 bytes) -> total would be 180 bytes > 150 bytes cap
    // Triggers LRU eviction of track_1
    const cacheResult = await offlineMock.cacheTrackAudio("track_3", "Z".repeat(60));
    expect(cacheResult.success).toBe(true);
    expect(cacheResult.evictedTracks).toContain("track_1");

    expect(await audioCache.hasAudio("track_1")).toBe(false); // Evicted
    expect(await audioCache.hasAudio("track_2")).toBe(true);
    expect(await audioCache.hasAudio("track_3")).toBe(true);

    // Step 4: User opens Settings > Storage tab and reviews cache size
    const totalBytes = await linerDb.getTotalAudioBytes();
    expect(totalBytes).toBeLessThanOrEqual(150);

    // Step 5: User clicks "Clear Cache" in Settings
    audioCache.invalidate();
    await linerDb.clearAll();

    expect(await audioCache.hasAudio("track_2")).toBe(false);
    expect(await audioCache.hasAudio("track_3")).toBe(false);
    expect(await linerDb.getTotalAudioBytes()).toBe(0);
  });
});

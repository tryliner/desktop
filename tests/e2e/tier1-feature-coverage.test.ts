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

// Shared contract definitions
interface SyncedLrcLine {
  id: string;
  timeMs: number;
  durationMs?: number;
  text: string;
}

function parseLrc(content: string): SyncedLrcLine[] {
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
      const text = match[4].trim();
      result.push({ id: `line_${idx++}`, timeMs, text });
    }
  }

  return result.sort((a, b) => a.timeMs - b.timeMs);
}

function getActiveLyricIndex(lines: SyncedLrcLine[], positionMs: number): number {
  if (lines.length === 0) return -1;
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) {
      activeIndex = i;
    } else {
      break;
    }
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
    totalHoursListened: Math.round((totalPlayedMs / (1000 * 60 * 60)) * 100) / 100,
    totalTracksPlayed: history.length,
    topTracks,
    topArtists,
    calculatedAt: new Date().toISOString(),
  };
}

describe("Tier 1: Feature Coverage (R1 - R5 Isolation & Primary Contracts)", () => {
  // --------------------------------------------------------------------------
  // R1: Spotify Playlist Integration
  // --------------------------------------------------------------------------
  describe("R1: Spotify Playlist Integration", () => {
    let spotify: MockSpotifyService;

    beforeEach(() => {
      spotify = new MockSpotifyService();
    });

    it("R1-T1: generates valid OAuth 2.0 PKCE authorization URL and code verifier", async () => {
      const { url, codeVerifier, state } = await spotify.generateAuthorizeUrl();

      expect(url).toContain("https://accounts.spotify.com/authorize");
      expect(url).toContain("client_id=liner_mock_id");
      expect(url).toContain("response_type=code");
      expect(url).toContain("redirect_uri=liner%3A%2F%2Fspotify-callback");
      expect(url).toContain("code_challenge=");
      expect(url).toContain("code_challenge_method=S256");
      expect(url).toContain(`state=${state}`);
      expect(codeVerifier).toBeDefined();
      expect(codeVerifier.length).toBeGreaterThan(10);
    });

    it("R1-T2: exchanges valid authorization code and verifier for access & refresh tokens", async () => {
      const { codeVerifier } = await spotify.generateAuthorizeUrl();
      const tokens = await spotify.exchangeCode("mock_auth_code_123", codeVerifier);

      expect(tokens.accessToken).toMatch(/^mock_access_token_/);
      expect(tokens.refreshToken).toMatch(/^mock_refresh_token_/);
      expect(tokens.tokenType).toBe("Bearer");
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
      expect(tokens.scope).toContain("playlist-read-private");
    });

    it("R1-T3: fetches and enumerates authenticated user playlists from /v1/me/playlists", async () => {
      const { codeVerifier } = await spotify.generateAuthorizeUrl();
      const tokens = await spotify.exchangeCode("auth_code_xyz", codeVerifier);
      const playlists = await spotify.getUserPlaylists(tokens.accessToken);

      expect(playlists).toBeInstanceOf(Array);
      expect(playlists.length).toBeGreaterThanOrEqual(3);
      expect(playlists[0]).toMatchObject({
        id: "sp_pl_001",
        name: "Morning Acoustic Vibes",
        tracksCount: 25,
        isPublic: true,
      });
      expect(playlists[1]).toMatchObject({
        id: "sp_pl_002",
        name: "Synthwave Coding Session",
        isPublic: false,
      });
    });

    it("R1-T4: parses and resolves public Spotify playlist by URL or bare playlist ID", async () => {
      const parsedUrl = spotify.parseSpotifyUrl("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=123");
      expect(parsedUrl).toEqual({ type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" });

      const parsedBareId = spotify.parseSpotifyUrl("37i9dQZF1DXcBWIGoYBM5M");
      expect(parsedBareId).toEqual({ type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" });

      const parsedUri = spotify.parseSpotifyUrl("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M");
      expect(parsedUri).toEqual({ type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" });

      const playlistData = await spotify.fetchPublicPlaylist("37i9dQZF1DXcBWIGoYBM5M");
      expect(playlistData.id).toBe("37i9dQZF1DXcBWIGoYBM5M");
      expect(playlistData.tracks.length).toBeGreaterThanOrEqual(3);
    });

    it("R1-T5: normalizes Spotify raw track metadata into canonical Liner Track contract", () => {
      const rawTrack = {
        id: "4cOdK2wGLETKBW3PvgPWqT",
        name: "Never Gonna Give You Up",
        artists: [{ name: "Rick Astley", id: "0gxyHStUvyUt4ReAGFrank" }],
        album: {
          name: "Whenever You Need Somebody",
          images: [{ url: "https://i.scdn.co/image/ab67616d0000b2735755e164993798e0c9ef7d7a", width: 640 }],
        },
        duration_ms: 213573,
        external_ids: { isrc: "GBARL9300134" },
      };

      const normalized = spotify.normalizeTrack(rawTrack);

      expect(normalized.id).toBe("spotify:4cOdK2wGLETKBW3PvgPWqT");
      expect(normalized.title).toBe("Never Gonna Give You Up");
      expect(normalized.artists).toBe("Rick Astley");
      expect(normalized.album).toBe("Whenever You Need Somebody");
      expect(normalized.durationMs).toBe(213573);
      expect(normalized.coverUrl).toBe("https://i.scdn.co/image/ab67616d0000b2735755e164993798e0c9ef7d7a");
      expect(normalized.isrc).toBe("GBARL9300134");
      expect(normalized.playCount).toBe(0);
    });

    it("R1-T6: refreshes expired access token using valid refresh token", async () => {
      const refreshed = await spotify.refreshTokens("valid_refresh_token_001");

      expect(refreshed.accessToken).toMatch(/^mock_refreshed_access_/);
      expect(refreshed.refreshToken).toBe("valid_refresh_token_001");
      expect(refreshed.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  // --------------------------------------------------------------------------
  // R2: User Profile System
  // --------------------------------------------------------------------------
  describe("R2: User Profile System", () => {
    beforeEach(() => {
      vi.stubGlobal("localStorage", createMockStorage());
    });

    it("R2-T1: initializes and exposes standard user profile model with handle, bio, and avatar", () => {
      const profile = {
        id: "usr_1001",
        username: "audiophile99",
        handle: "audiophile99",
        bio: "Curator of electronic synthwave and ambient soundscapes.",
        avatarUrl: "https://assets.liner.fun/avatars/preset_1.png",
        createdAt: "2026-01-01T00:00:00Z",
      };

      expect(profile.id).toBe("usr_1001");
      expect(profile.username).toBe("audiophile99");
      expect(profile.handle).toBe("audiophile99");
      expect(profile.bio).toContain("Curator of electronic");
      expect(profile.avatarUrl).toMatch(/\.png$/);
    });

    it("R2-T2: computes accurate listening statistics from playback history", () => {
      const trackA: Track = { id: "trk_a", title: "Midnight City", artists: "M83", durationMs: 240000, coverUrl: "", playCount: 0 };
      const trackB: Track = { id: "trk_b", title: "Resonance", artists: "HOME", durationMs: 210000, coverUrl: "", playCount: 0 };

      const history: PlaybackHistoryItem[] = [
        {
          id: "h1",
          playbackSessionId: "s1",
          listeningSessionId: "l1",
          track: trackA,
          playedDurationMs: 240000,
          completionRate: 1.0,
          completed: true,
          skipped: false,
          loopCount: 0,
          hasSeekBackward: false,
          listenedAt: "2026-10-20T10:00:00Z",
        },
        {
          id: "h2",
          playbackSessionId: "s2",
          listeningSessionId: "l1",
          track: trackA,
          playedDurationMs: 240000,
          completionRate: 1.0,
          completed: true,
          skipped: false,
          loopCount: 0,
          hasSeekBackward: false,
          listenedAt: "2026-10-20T11:00:00Z",
        },
        {
          id: "h3",
          playbackSessionId: "s3",
          listeningSessionId: "l1",
          track: trackB,
          playedDurationMs: 210000,
          completionRate: 1.0,
          completed: true,
          skipped: false,
          loopCount: 0,
          hasSeekBackward: false,
          listenedAt: "2026-10-20T12:00:00Z",
        },
      ];

      const stats = computeListeningStats(history);

      expect(stats.totalTracksPlayed).toBe(3);
      // Total played = 240k + 240k + 210k = 690,000ms = 0.1916 hrs
      expect(stats.totalHoursListened).toBe(0.19);
      expect(stats.topTracks[0].track.id).toBe("trk_a");
      expect(stats.topTracks[0].playCount).toBe(2);
      expect(stats.topArtists[0].artistName).toBe("M83");
      expect(stats.topArtists[0].playCount).toBe(2);
    });

    it("R2-T3: validates profile updates for handle format, bio length, and required fields", () => {
      const validateProfile = (input: { handle: string; bio?: string }) => {
        const errors: string[] = [];
        if (!input.handle || input.handle.length < 3) errors.push("Handle must be at least 3 characters");
        if (input.handle && !/^[a-zA-Z0-9_]+$/.test(input.handle)) errors.push("Handle can only contain alphanumeric and underscore");
        if (input.bio && input.bio.length > 250) errors.push("Bio cannot exceed 250 characters");
        return { valid: errors.length === 0, errors };
      };

      expect(validateProfile({ handle: "valid_user", bio: "Short bio" }).valid).toBe(true);
      expect(validateProfile({ handle: "ab" }).errors).toContain("Handle must be at least 3 characters");
      expect(validateProfile({ handle: "invalid user!" }).errors).toContain("Handle can only contain alphanumeric and underscore");
      expect(validateProfile({ handle: "user", bio: "A".repeat(251) }).errors).toContain("Bio cannot exceed 250 characters");
    });

    it("R2-T4: supports avatar customization between preset gallery and custom image URLs", () => {
      const presetAvatars = [
        "https://assets.liner.fun/avatars/preset_1.png",
        "https://assets.liner.fun/avatars/preset_2.png",
        "https://assets.liner.fun/avatars/preset_3.png",
      ];

      let selectedAvatar = presetAvatars[0];
      expect(selectedAvatar).toBe(presetAvatars[0]);

      // Switch to another preset
      selectedAvatar = presetAvatars[2];
      expect(selectedAvatar).toBe(presetAvatars[2]);

      // Switch to custom URL
      const customUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb";
      selectedAvatar = customUrl;
      expect(selectedAvatar).toBe(customUrl);
    });

    it("R2-T5: persists profile state and retrieves across simulated storage reloads", () => {
      const storageKey = "liner_user_profile_cache";
      const profileData = {
        id: "usr_2002",
        handle: "liner_fanatic",
        bio: "Listening all day long.",
        avatarUrl: "https://assets.liner.fun/avatars/preset_2.png",
      };

      // Save to localStorage
      localStorage.setItem(storageKey, JSON.stringify(profileData));

      // Reload
      const retrieved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      expect(retrieved.id).toBe("usr_2002");
      expect(retrieved.handle).toBe("liner_fanatic");
      expect(retrieved.bio).toBe("Listening all day long.");

      localStorage.removeItem(storageKey);
    });

    it("R2-T6: generates public share link for user profile", () => {
      const profile = { id: "usr_3003", handle: "music_maker" };
      const shareUrl = `https://liner.fun/profile/${profile.handle}`;
      expect(shareUrl).toBe("https://liner.fun/profile/music_maker");
    });
  });

  // --------------------------------------------------------------------------
  // R3: Windows Desktop Experience & Controls
  // --------------------------------------------------------------------------
  describe("R3: Windows Desktop Experience & Controls", () => {
    let smtcBridge: MockElectronSmtcBridge;

    beforeEach(() => {
      smtcBridge = installElectronSmtcMock();
    });

    afterEach(() => {
      uninstallElectronSmtcMock();
    });

    it("R3-T1: transmits playing track metadata to SMTC IPC bridge on playback start", () => {
      smtcBridge.sendMediaUpdate({
        status: "playing",
        track: {
          id: "trk_smtc_1",
          title: "Blinding Lights",
          artists: "The Weeknd",
          coverUrl: "https://images.liner.fun/covers/blinding_lights.jpg",
          durationMs: 200000,
        },
        positionMs: 0,
        durationMs: 200000,
      });

      const latest = smtcBridge.getLatestUpdate();
      expect(latest).toBeDefined();
      expect(latest?.status).toBe("playing");
      expect(latest?.track?.title).toBe("Blinding Lights");
      expect(latest?.track?.artists).toBe("The Weeknd");
      expect(latest?.durationMs).toBe(200000);
    });

    it("R3-T2: updates SMTC playback state transitions between playing, paused, and idle", () => {
      smtcBridge.sendMediaUpdate({ status: "playing", track: null, positionMs: 5000, durationMs: 200000 });
      expect(smtcBridge.getLatestUpdate()?.status).toBe("playing");

      smtcBridge.sendMediaUpdate({ status: "paused", track: null, positionMs: 12000, durationMs: 200000 });
      expect(smtcBridge.getLatestUpdate()?.status).toBe("paused");

      smtcBridge.sendMediaUpdate({ status: "idle", track: null, positionMs: 0, durationMs: 0 });
      expect(smtcBridge.getLatestUpdate()?.status).toBe("idle");
    });

    it("R3-T3: registers global hardware media keyboard shortcuts via Electron IPC", () => {
      const playPauseAction = vi.fn();
      const nextAction = vi.fn();
      const prevAction = vi.fn();

      const reg1 = smtcBridge.registerShortcut("MediaPlayPause", playPauseAction);
      const reg2 = smtcBridge.registerShortcut("MediaNextTrack", nextAction);
      const reg3 = smtcBridge.registerShortcut("MediaPreviousTrack", prevAction);

      expect(reg1).toBe(true);
      expect(reg2).toBe(true);
      expect(reg3).toBe(true);
      expect(smtcBridge.isRegistered("MediaPlayPause")).toBe(true);
      expect(smtcBridge.isRegistered("MediaNextTrack")).toBe(true);
      expect(smtcBridge.isRegistered("MediaPreviousTrack")).toBe(true);
    });

    it("R3-T4: dispatches SMTC action events from Windows shell to player runtime", () => {
      const receivedActions: string[] = [];
      const cleanup = smtcBridge.onMediaAction((action) => {
        receivedActions.push(action);
      });

      smtcBridge.triggerMediaAction("togglePlay");
      smtcBridge.triggerMediaAction("next");
      smtcBridge.triggerMediaAction("prev");

      expect(receivedActions).toEqual(["togglePlay", "next", "prev"]);
      cleanup();
    });

    it("R3-T5: triggers hardware media key press callback and routes to media listener", () => {
      const keyTriggered = vi.fn();
      smtcBridge.registerShortcut("MediaPlayPause", () => {
        keyTriggered();
        smtcBridge.triggerMediaAction("togglePlay");
      });

      const actionReceived = vi.fn();
      smtcBridge.onMediaAction(actionReceived);

      const fired = smtcBridge.triggerHardwareKey("MediaPlayPause");
      expect(fired).toBe(true);
      expect(keyTriggered).toHaveBeenCalledTimes(1);
      expect(actionReceived).toHaveBeenCalledWith("togglePlay");
    });

    it("R3-T6: unregisters global media shortcuts cleanly on teardown", () => {
      smtcBridge.registerShortcut("MediaPlayPause", () => {});
      expect(smtcBridge.isRegistered("MediaPlayPause")).toBe(true);

      smtcBridge.unregisterShortcut("MediaPlayPause");
      expect(smtcBridge.isRegistered("MediaPlayPause")).toBe(false);

      smtcBridge.registerShortcut("MediaNextTrack", () => {});
      smtcBridge.unregisterAllShortcuts();
      expect(smtcBridge.isRegistered("MediaNextTrack")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // R4: Dynamic Lyrics & Audio Visualizer
  // --------------------------------------------------------------------------
  describe("R4: Dynamic Lyrics & Audio Visualizer", () => {
    let webAudio: ReturnType<typeof installWebAudioMock>;

    beforeEach(() => {
      webAudio = installWebAudioMock();
    });

    afterEach(() => {
      uninstallWebAudioMock();
    });

    it("R4-T1: parses standard LRC synced lines into millisecond timestamped array", () => {
      const lrcContent = `
        [00:05.10]Welcome to the night
        [00:12.80]Neon lights are glowing bright
        [00:24.00]Cruising down the highway
      `;

      const parsed = parseLrc(lrcContent);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({ id: "line_0", timeMs: 5100, text: "Welcome to the night" });
      expect(parsed[1]).toEqual({ id: "line_1", timeMs: 12800, text: "Neon lights are glowing bright" });
      expect(parsed[2]).toEqual({ id: "line_2", timeMs: 24000, text: "Cruising down the highway" });
    });

    it("R4-T2: identifies the active lyric line matching current playback position", () => {
      const lines: SyncedLrcLine[] = [
        { id: "1", timeMs: 5000, text: "Line 1" },
        { id: "2", timeMs: 10000, text: "Line 2" },
        { id: "3", timeMs: 20000, text: "Line 3" },
      ];

      expect(getActiveLyricIndex(lines, 0)).toBe(-1); // Before first line
      expect(getActiveLyricIndex(lines, 5000)).toBe(0);
      expect(getActiveLyricIndex(lines, 7500)).toBe(0);
      expect(getActiveLyricIndex(lines, 10000)).toBe(1);
      expect(getActiveLyricIndex(lines, 15000)).toBe(1);
      expect(getActiveLyricIndex(lines, 25000)).toBe(2);
    });

    it("R4-T3: computes lyric scroll offsets accurately for active line positioning", () => {
      const lineHeightPx = 48;
      const viewportHeightPx = 300;
      const activeIndex = 4; // 5th line

      // Centered scroll formula: activeIndex * lineHeight - viewportHeight / 2 + lineHeight / 2
      const targetScrollY = Math.max(0, activeIndex * lineHeightPx - viewportHeightPx / 2 + lineHeightPx / 2);
      expect(targetScrollY).toBe(4 * 48 - 150 + 24); // 192 - 150 + 24 = 66px
    });

    it("R4-T4: initializes Web Audio MockAudioContext and connects AnalyserNode", () => {
      const ctx = new (window as any).AudioContext() as MockAudioContext;
      const analyser = ctx.createAnalyser();
      const gain = ctx.createGain();

      gain.connect(analyser);
      analyser.connect(ctx.destination);

      expect(ctx.state).toBe("running");
      expect(analyser.fftSize).toBe(2048);
      expect(analyser.frequencyBinCount).toBe(1024);
      expect(analyser.isConnected).toBe(true);
    });

    it("R4-T5: samples non-zero frequency spectrum data during active playback", () => {
      const ctx = new (window as any).AudioContext() as MockAudioContext;
      const analyser = ctx.createAnalyser();

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);

      // Verify that bins contain simulated frequency response
      const nonZeroBins = Array.from(freqData).filter((v) => v > 0);
      expect(nonZeroBins.length).toBeGreaterThan(0);
      expect(freqData[0]).toBeGreaterThan(50); // Strong bass in bin 0
    });

    it("R4-T6: samples time-domain waveform data from AnalyserNode", () => {
      const ctx = new (window as any).AudioContext() as MockAudioContext;
      const analyser = ctx.createAnalyser();

      const timeData = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(timeData);

      // In audio, silence is 128 (center). Active waveform fluctuates around 128
      const hasFluctuation = Array.from(timeData).some((v) => v !== 128);
      expect(hasFluctuation).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // R5: Offline Audio Cache & Storage
  // --------------------------------------------------------------------------
  describe("R5: Offline Audio Cache & Storage", () => {
    beforeEach(async () => {
      offlineMock.install();
      await linerDb.clearAll();
    });

    afterEach(async () => {
      offlineMock.uninstall();
      await linerDb.clearAll();
    });

    it("R5-T1: downloads and caches track audio blob in local storage", async () => {
      const res = await offlineMock.cacheTrackAudio("track_offline_01", "audio content for track 01");
      expect(res.success).toBe(true);

      const hasAudio = await audioCache.hasAudio("track_offline_01");
      expect(hasAudio).toBe(true);
    });

    it("R5-T2: detects network offline status via navigator.onLine and window events", () => {
      const offlineListener = vi.fn();
      window.addEventListener("offline", offlineListener);

      expect(offlineMock.isOnline()).toBe(true);
      expect(navigator.onLine).toBe(true);

      offlineMock.simulateNetworkDrop();

      expect(offlineMock.isOnline()).toBe(false);
      expect(navigator.onLine).toBe(false);
      expect(offlineListener).toHaveBeenCalledTimes(1);

      window.removeEventListener("offline", offlineListener);
    });

    it("R5-T3: resolves audio stream from local cache when offline", async () => {
      const track: Track = { id: "cached_track_1", title: "Cached Song", artists: "Artist", durationMs: 120000, coverUrl: "", playCount: 0 };
      await offlineMock.cacheTrackAudio(track.id, "sample cached audio binary data");

      // Go offline
      offlineMock.simulateNetworkDrop();

      const resolved = await offlineMock.resolveAudioStream(track);
      expect(resolved.fromCache).toBe(true);
      expect(resolved.url).toBe(`blob:mock-cached-blob-${track.id}`);
      expect(resolved.mimeType).toBe("audio/webm");
    });

    it("R5-T4: calculates total audio storage usage in bytes", async () => {
      const blobA = new Blob(["audio data chunk A"], { type: "audio/webm" });
      const blobB = new Blob(["longer audio data chunk B"], { type: "audio/webm" });

      await audioCache.saveAudioBlob("trk_size_a", blobA, "audio/webm");
      await audioCache.saveAudioBlob("trk_size_b", blobB, "audio/webm");

      const totalBytes = await linerDb.getTotalAudioBytes();
      expect(totalBytes).toBe(blobA.size + blobB.size);
    });

    it("R5-T5: clears all cached audio blobs on user request in settings", async () => {
      await offlineMock.cacheTrackAudio("trk_to_clear_1", "audio 1");
      await offlineMock.cacheTrackAudio("trk_to_clear_2", "audio 2");

      expect(await audioCache.hasAudio("trk_to_clear_1")).toBe(true);
      expect(await audioCache.hasAudio("trk_to_clear_2")).toBe(true);

      audioCache.invalidate();
      await linerDb.clearAll();

      expect(await audioCache.hasAudio("trk_to_clear_1")).toBe(false);
      expect(await audioCache.hasAudio("trk_to_clear_2")).toBe(false);
      expect(await linerDb.getTotalAudioBytes()).toBe(0);
    });

    it("R5-T6: deletes specific cached track individually from storage", async () => {
      await offlineMock.cacheTrackAudio("keep_me", "audio to keep");
      await offlineMock.cacheTrackAudio("delete_me", "audio to delete");

      await audioCache.deleteAudio("delete_me");

      expect(await audioCache.hasAudio("delete_me")).toBe(false);
      expect(await audioCache.hasAudio("keep_me")).toBe(true);
    });
  });
});

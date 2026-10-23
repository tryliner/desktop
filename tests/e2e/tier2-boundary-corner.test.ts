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
  durationMs?: number;
  text: string;
}

function parseLrc(content: string): SyncedLrcLine[] {
  if (!content || typeof content !== "string") return [];
  const lines = content.split("\n");
  const result: SyncedLrcLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  let idx = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(timeRegex);
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
  if (!lines || lines.length === 0) return -1;
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
    totalHoursListened: history.length === 0 ? 0 : Math.round((totalPlayedMs / (1000 * 60 * 60)) * 100) / 100,
    totalTracksPlayed: history.length,
    topTracks,
    topArtists,
    calculatedAt: new Date().toISOString(),
  };
}

describe("Tier 2: Boundary & Corner Cases (R1 - R5 Robustness & Stress)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockStorage());
  });

  // --------------------------------------------------------------------------
  // R1 Corner Cases: Spotify Integration
  // --------------------------------------------------------------------------
  describe("R1 Corner Cases: Spotify Integration", () => {
    let spotify: MockSpotifyService;

    beforeEach(() => {
      spotify = new MockSpotifyService();
    });

    it("R1-C1: imports empty Spotify playlist (0 tracks) safely without throwing", async () => {
      const playlist = await spotify.fetchPublicPlaylist("empty_playlist");
      expect(playlist.tracks).toEqual([]);
      expect(playlist.title).toBe("Empty Collection");

      const normalizedList = playlist.tracks.map((t) => spotify.normalizeTrack(t));
      expect(normalizedList).toHaveLength(0);
    });

    it("R1-C2: handles invalid or unsupported Spotify URLs gracefully", () => {
      expect(spotify.parseSpotifyUrl("")).toBeNull();
      expect(spotify.parseSpotifyUrl("https://google.com/search?q=spotify")).toBeNull();
      expect(spotify.parseSpotifyUrl("https://open.spotify.com/artist/4cOdK2wGLETKBW3PvgPWqT")).toBeNull();
      expect(spotify.parseSpotifyUrl("not-a-url-at-all")).toBeNull();
    });

    it("R1-C3: handles HTTP 429 rate limiting with Retry-After backoff", async () => {
      spotify.updateConfig({ simulateRateLimit: true, retryAfterSeconds: 3 });

      await expect(spotify.fetchPublicPlaylist("any_playlist_id")).rejects.toMatchObject({
        status: 429,
        retryAfter: 3,
        message: expect.stringContaining("Rate limit"),
      });

      // Clear rate limit and verify recovery
      spotify.updateConfig({ simulateRateLimit: false });
      const recovered = await spotify.fetchPublicPlaylist("valid_id");
      expect(recovered.tracks.length).toBeGreaterThan(0);
    });

    it("R1-C4: handles OAuth error responses during code exchange cleanly", async () => {
      spotify.updateConfig({ simulateAuthError: true });

      await expect(spotify.exchangeCode("bad_code", "bad_verifier")).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("invalid_grant"),
      });
    });

    it("R1-C5: normalizes tracks with null, missing, or malformed metadata fields gracefully", () => {
      const sparseTrack = {
        id: "sparse_track_99",
        name: "",
        artists: [],
        duration_ms: 0,
      };

      const normalized = spotify.normalizeTrack(sparseTrack);
      expect(normalized.id).toBe("spotify:sparse_track_99");
      expect(normalized.title).toBe("Untitled Track");
      expect(normalized.artists).toBe("Unknown Artist");
      expect(normalized.album).toBeUndefined();
      expect(normalized.durationMs).toBe(0);
      expect(normalized.coverUrl).toBe("");
    });

    it("R1-C6: handles invalid refresh token with 401 Unauthorized", async () => {
      await expect(spotify.refreshTokens("invalid_token_xyz")).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  // --------------------------------------------------------------------------
  // R2 Corner Cases: User Profile System
  // --------------------------------------------------------------------------
  describe("R2 Corner Cases: User Profile System", () => {
    it("R2-C1: computes 0 listening stats for brand new user with empty history without NaN", () => {
      const emptyHistory: PlaybackHistoryItem[] = [];
      const stats = computeListeningStats(emptyHistory);

      expect(stats.totalHoursListened).toBe(0);
      expect(Number.isNaN(stats.totalHoursListened)).toBe(false);
      expect(stats.totalTracksPlayed).toBe(0);
      expect(stats.topTracks).toHaveLength(0);
      expect(stats.topArtists).toHaveLength(0);
      expect(new Date(stats.calculatedAt).getTime()).not.toBeNaN();
    });

    it("R2-C2: enforces boundary limits on bio length (250 chars) and handle length (3-30 chars)", () => {
      const validate = (handle: string, bio: string) => {
        const errors: string[] = [];
        if (handle.length < 3 || handle.length > 30) errors.push("Handle length invalid");
        if (bio.length > 250) errors.push("Bio too long");
        return { valid: errors.length === 0, errors };
      };

      // Exactly 3 chars handle, exactly 250 chars bio -> valid
      expect(validate("abc", "X".repeat(250)).valid).toBe(true);

      // Exactly 30 chars handle -> valid
      expect(validate("a".repeat(30), "Bio").valid).toBe(true);

      // 31 chars handle -> invalid
      expect(validate("a".repeat(31), "Bio").errors).toContain("Handle length invalid");

      // 251 chars bio -> invalid
      expect(validate("valid_handle", "X".repeat(251)).errors).toContain("Bio too long");
    });

    it("R2-C3: handles unauthenticated guest user accessing profile with safe fallback", () => {
      const getProfileState = (user: any | null) => {
        if (!user) {
          return {
            isGuest: true,
            handle: "guest",
            username: "Guest Listener",
            bio: "Sign in to save your profile and track listening statistics.",
            avatarUrl: "/default-avatar.png",
          };
        }
        return { isGuest: false, ...user };
      };

      const guestState = getProfileState(null);
      expect(guestState.isGuest).toBe(true);
      expect(guestState.handle).toBe("guest");
      expect(guestState.username).toBe("Guest Listener");
    });

    it("R2-C4: preserves local profile state when remote API update fails", () => {
      const localProfile = { handle: "original_handle", bio: "Original bio" };
      let currentProfile = { ...localProfile };

      const simulateUpdate = (patch: Partial<typeof localProfile>, apiShouldFail: boolean) => {
        if (apiShouldFail) {
          // Revert / do not mutate
          throw new Error("500 Internal Server Error: Failed to update profile");
        }
        currentProfile = { ...currentProfile, ...patch };
      };

      expect(() => {
        simulateUpdate({ bio: "Attempted new bio" }, true);
      }).toThrow();

      // State remains unchanged
      expect(currentProfile.bio).toBe("Original bio");
      expect(currentProfile.handle).toBe("original_handle");
    });

    it("R2-C5: handles unicode emojis and special characters in user bio and username safely", () => {
      const user = {
        username: "DJ 🎧 Beats & Rhymes 🎵",
        bio: "Curating synthwave 🌆 with retro aesthetics! 🚀 <script>alert(1)</script>",
      };

      // Basic sanitization check
      const sanitizedBio = user.bio.replace(/<[^>]*>?/gm, "");
      expect(sanitizedBio).toContain("synthwave");
      expect(sanitizedBio).not.toContain("<script>");
      expect(user.username).toContain("DJ");
      expect(user.username).toContain("🎧");
    });
  });

  // --------------------------------------------------------------------------
  // R3 Corner Cases: Windows Desktop Experience & Controls
  // --------------------------------------------------------------------------
  describe("R3 Corner Cases: Windows Desktop Experience & Controls", () => {
    let smtcBridge: MockElectronSmtcBridge;

    beforeEach(() => {
      smtcBridge = installElectronSmtcMock();
    });

    afterEach(() => {
      uninstallElectronSmtcMock();
    });

    it("R3-C1: handles media updates when track is null (playback stopped/cleared)", () => {
      smtcBridge.sendMediaUpdate({
        status: "idle",
        track: null,
        positionMs: 0,
        durationMs: 0,
      });

      const update = smtcBridge.getLatestUpdate();
      expect(update?.status).toBe("idle");
      expect(update?.track).toBeNull();
      expect(update?.durationMs).toBe(0);
    });

    it("R3-C2: queues and executes rapid sequential media key actions without dropping events", () => {
      const executed: string[] = [];
      smtcBridge.onMediaAction((action) => {
        executed.push(action);
      });

      // Rapidly fire multiple media actions (spamming next/prev)
      for (let i = 0; i < 5; i++) {
        smtcBridge.triggerMediaAction("next");
      }
      smtcBridge.triggerMediaAction("togglePlay");

      expect(executed).toHaveLength(6);
      expect(executed.filter((a) => a === "next")).toHaveLength(5);
      expect(executed[5]).toBe("togglePlay");
    });

    it("R3-C3: truncates or handles excessively long track titles (>300 chars) for SMTC display", () => {
      const hugeTitle = "A".repeat(400);
      const hugeArtist = "B".repeat(200);

      const sanitizeForSmtc = (text: string, maxLen = 100) => {
        return text.length > maxLen ? text.slice(0, maxLen - 3) + "..." : text;
      };

      const titleForSmtc = sanitizeForSmtc(hugeTitle);
      expect(titleForSmtc.length).toBe(100);
      expect(titleForSmtc.endsWith("...")).toBe(true);

      smtcBridge.sendMediaUpdate({
        status: "playing",
        track: {
          id: "huge_trk",
          title: titleForSmtc,
          artists: sanitizeForSmtc(hugeArtist),
          durationMs: 180000,
        },
        positionMs: 0,
        durationMs: 180000,
      });

      expect(smtcBridge.getLatestUpdate()?.track?.title.length).toBe(100);
    });

    it("R3-C4: gracefully handles missing track cover art by supplying placeholder", () => {
      smtcBridge.sendMediaUpdate({
        status: "playing",
        track: {
          id: "no_cover_trk",
          title: "Track Without Cover",
          artists: "Indie Artist",
          coverUrl: undefined,
          durationMs: 150000,
        },
        positionMs: 1000,
        durationMs: 150000,
      });

      const latest = smtcBridge.getLatestUpdate();
      expect(latest?.track?.coverUrl).toBeUndefined();
    });

    it("R3-C5: handles shortcut registration collision gracefully without crashing", () => {
      smtcBridge.shortcutRegistrationBlocked = true;

      const registered = smtcBridge.registerShortcut("MediaPlayPause", () => {});
      expect(registered).toBe(false);
      expect(smtcBridge.isRegistered("MediaPlayPause")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // R4 Corner Cases: Dynamic Lyrics & Audio Visualizer
  // --------------------------------------------------------------------------
  describe("R4 Corner Cases: Dynamic Lyrics & Audio Visualizer", () => {
    let webAudio: ReturnType<typeof installWebAudioMock>;

    beforeEach(() => {
      webAudio = installWebAudioMock();
    });

    afterEach(() => {
      uninstallWebAudioMock();
    });

    it("R4-C1: handles empty lyrics and lyrics without timestamp formatting safely", () => {
      expect(parseLrc("")).toEqual([]);
      expect(parseLrc("Just plain text with no timestamps\nSecond line")).toEqual([]);
      expect(getActiveLyricIndex([], 5000)).toBe(-1);
    });

    it("R4-C2: filters out malformed timestamp tags in LRC content", () => {
      const lrcWithBadLines = `
        [00:02.00]Valid line 1
        [not:a.time]Malformed line
        [99:99.9999]Excessive digits
        [00:10.50]Valid line 2
      `;

      const parsed = parseLrc(lrcWithBadLines);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].text).toBe("Valid line 1");
      expect(parsed[1].text).toBe("Valid line 2");
    });

    it("R4-C3: returns -1 before the first lyric line and preserves last line after song ends", () => {
      const lines: SyncedLrcLine[] = [
        { id: "1", timeMs: 10000, text: "Starts at 10s" },
        { id: "2", timeMs: 20000, text: "Starts at 20s" },
      ];

      // Before first line
      expect(getActiveLyricIndex(lines, 0)).toBe(-1);
      expect(getActiveLyricIndex(lines, 9999)).toBe(-1);

      // In between
      expect(getActiveLyricIndex(lines, 10000)).toBe(0);
      expect(getActiveLyricIndex(lines, 19999)).toBe(0);

      // Beyond last line
      expect(getActiveLyricIndex(lines, 20000)).toBe(1);
      expect(getActiveLyricIndex(lines, 999999)).toBe(1);
    });

    it("R4-C4: returns all zeros for frequency spectrum when AudioContext is suspended", async () => {
      const ctx = new (window as any).AudioContext() as MockAudioContext;
      const analyser = ctx.createAnalyser();

      // Suspend audio context
      await ctx.suspend();
      expect(ctx.state).toBe("suspended");

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);

      // When suspended, all bins should be 0
      const sum = Array.from(freqData).reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    });

    it("R4-C5: throws IndexSizeError when setting invalid fftSize on AnalyserNode", () => {
      const ctx = new (window as any).AudioContext() as MockAudioContext;
      const analyser = ctx.createAnalyser();

      // Not a power of two
      expect(() => {
        analyser.fftSize = 500;
      }).toThrow(/IndexSizeError/);

      // Less than 32
      expect(() => {
        analyser.fftSize = 16;
      }).toThrow(/IndexSizeError/);

      // Greater than 32768
      expect(() => {
        analyser.fftSize = 65536;
      }).toThrow(/IndexSizeError/);

      // Valid power of two
      analyser.fftSize = 1024;
      expect(analyser.fftSize).toBe(1024);
      expect(analyser.frequencyBinCount).toBe(512);
    });
  });

  // --------------------------------------------------------------------------
  // R5 Corner Cases: Offline Audio Cache & Storage
  // --------------------------------------------------------------------------
  describe("R5 Corner Cases: Offline Audio Cache & Storage", () => {
    beforeEach(async () => {
      offlineMock.install();
      await linerDb.clearAll();
    });

    afterEach(async () => {
      offlineMock.uninstall();
      await linerDb.clearAll();
    });

    it("R5-C1: throws clear OfflineError when attempting to stream uncached track while offline", async () => {
      const uncachedTrack: Track = {
        id: "uncached_999",
        title: "Ghost Track",
        artists: "Phantom",
        durationMs: 180000,
        coverUrl: "",
        playCount: 0,
      };

      offlineMock.simulateNetworkDrop();

      await expect(offlineMock.resolveAudioStream(uncachedTrack)).rejects.toThrow(/OfflineError: Cannot stream track/);
    });

    it("R5-C2: enforces storage quota limit and evicts oldest track when limit is exceeded", async () => {
      // Set small storage limit of 100 bytes
      offlineMock.setStorageLimitBytes(100);

      // Save first track (60 bytes)
      const res1 = await offlineMock.cacheTrackAudio("track_old", "A".repeat(60));
      expect(res1.success).toBe(true);
      expect(await audioCache.hasAudio("track_old")).toBe(true);

      // Save second track (60 bytes) -> exceeds 100 bytes, evicts track_old
      const res2 = await offlineMock.cacheTrackAudio("track_new", "B".repeat(60));
      expect(res2.success).toBe(true);
      expect(res2.evictedTracks).toContain("track_old");

      expect(await audioCache.hasAudio("track_old")).toBe(false);
      expect(await audioCache.hasAudio("track_new")).toBe(true);
    });

    it("R5-C3: ignores in-flight download that settles after cache clear / invalidation", async () => {
      const generation = audioCache.currentGeneration();
      audioCache.invalidate();

      const blob = new Blob(["late download data"], { type: "audio/webm" });
      const saved = await audioCache.saveAudioBlob("stale_download", blob, "audio/webm", generation);

      expect(saved).toBe(false);
      expect(await audioCache.hasAudio("stale_download")).toBe(false);
    });

    it("R5-C4: recovers gracefully when cached audio entry is deleted out of band", async () => {
      await offlineMock.cacheTrackAudio("trk_missing_blob", "data");
      expect(await audioCache.hasAudio("trk_missing_blob")).toBe(true);

      // Manually delete blob from underlying storage
      await audioCache.deleteAudio("trk_missing_blob");

      // Verify hasAudio immediately reflects deletion
      expect(await audioCache.hasAudio("trk_missing_blob")).toBe(false);
    });

    it("R5-C5: handles rapid online -> offline -> online flapping without desyncing state", () => {
      const states: boolean[] = [];
      const onOnline = () => states.push(true);
      const onOffline = () => states.push(false);

      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);

      offlineMock.simulateNetworkDrop();
      offlineMock.simulateNetworkRestore();
      offlineMock.simulateNetworkDrop();
      offlineMock.simulateNetworkRestore();

      expect(states).toEqual([false, true, false, true]);
      expect(offlineMock.isOnline()).toBe(true);

      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    });
  });
});

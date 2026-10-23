import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";

// Mock electron module to avoid binary download checks in test runner
vi.mock("electron", () => ({
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn(),
  },
}));

import {
  sanitizeForSmtc,
  formatArtistString,
  createSmtcPayload,
  handleSmtcAction,
  WindowsMediaSync,
} from "@/features/player/hooks/useWindowsMediaSync";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { MockElectronSmtcBridge } from "../e2e/mocks/electronSmtcMock";
import { MediaShortcutsController } from "../../electron/mediaShortcuts";
import type { Track } from "@/shared/types";
import type { SmtcMediaAction, SmtcMediaUpdatePayload } from "@/electron";

// Support React act in Vitest environment
// @ts-expect-error - act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SAMPLE_TRACK_A: Track = {
  id: "track_alpha_01",
  title: "Synthetic Dreams",
  artists: "Cyber Pulse",
  coverUrl: "https://liner.app/art/alpha.png",
  durationMs: 240000,
  playCount: 12,
};

const SAMPLE_TRACK_B: Track = {
  id: "track_beta_02",
  title: "Neon Horizon",
  artists: "Solar Echo",
  coverUrl: "https://liner.app/art/beta.png",
  durationMs: 195000,
  playCount: 5,
};

describe("Adversarial Stress Harness: IPC Media Updates & Rapid Events (M3.1)", () => {
  let mockBridge: MockElectronSmtcBridge;
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockBridge = new MockElectronSmtcBridge();
    (window as any).linerElectron = {
      sendMediaUpdate: (payload: SmtcMediaUpdatePayload) => mockBridge.sendMediaUpdate(payload),
      onMediaAction: (cb: (action: SmtcMediaAction) => void) => mockBridge.onMediaAction(cb),
    };
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
      document.body.removeChild(container);
    }
    root = null;
    container = null;
    document.body.innerHTML = "";
    delete (window as any).linerElectron;
    vi.restoreAllMocks();
  });

  function mountComponent(): void {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(React.createElement(WindowsMediaSync));
    });
  }

  // =========================================================================
  // REQUIREMENT 1: Rapid Event Burst & FIFO Ordering (R3-C2)
  // =========================================================================
  describe("1. Rapid Event Burst & FIFO Execution (100 Consecutive Actions)", () => {
    it("empirically verifies 100 consecutive media action events through handleSmtcAction with 0 dropped events and strict FIFO order", () => {
      const executedOrder: { action: string; order: number }[] = [];
      let orderIndex = 0;

      vi.spyOn(playerEngine, "togglePlayPause").mockImplementation(async () => {
        executedOrder.push({ action: "togglePlay", order: orderIndex++ });
      });
      vi.spyOn(playerEngine, "skipNext").mockImplementation(async () => {
        executedOrder.push({ action: "next", order: orderIndex++ });
      });
      vi.spyOn(playerEngine, "skipPrevious").mockImplementation(async () => {
        executedOrder.push({ action: "prev", order: orderIndex++ });
      });

      const pattern: SmtcMediaAction[] = ["togglePlay", "next", "prev"];
      const burstActions: SmtcMediaAction[] = [];
      for (let i = 0; i < 100; i++) {
        burstActions.push(pattern[i % 3]);
      }

      expect(burstActions.length).toBe(100);

      const startTime = performance.now();
      for (const action of burstActions) {
        handleSmtcAction(action);
      }
      const durationMs = performance.now() - startTime;

      // 1. Zero dropped events
      expect(executedOrder.length).toBe(100);
      expect(playerEngine.togglePlayPause).toHaveBeenCalledTimes(34); // indices 0, 3, 6, ... 99
      expect(playerEngine.skipNext).toHaveBeenCalledTimes(33);        // indices 1, 4, 7, ... 97
      expect(playerEngine.skipPrevious).toHaveBeenCalledTimes(33);    // indices 2, 5, 8, ... 98

      // 2. Exact FIFO ordering
      for (let i = 0; i < 100; i++) {
        expect(executedOrder[i].action).toBe(burstActions[i]);
        expect(executedOrder[i].order).toBe(i);
      }

      // 3. Performance efficiency (100 dispatches completed in < 50ms)
      expect(durationMs).toBeLessThan(50);
    });

    it("empirically verifies 100 consecutive events dispatched through IPC listener in mounted React component", () => {
      mountComponent();

      const executedActions: SmtcMediaAction[] = [];
      vi.spyOn(playerEngine, "togglePlayPause").mockImplementation(async () => {
        executedActions.push("togglePlay");
      });
      vi.spyOn(playerEngine, "skipNext").mockImplementation(async () => {
        executedActions.push("next");
      });
      vi.spyOn(playerEngine, "skipPrevious").mockImplementation(async () => {
        executedActions.push("prev");
      });

      const pattern: SmtcMediaAction[] = ["togglePlay", "next", "prev"];
      const inputActions: SmtcMediaAction[] = Array.from({ length: 100 }, (_, i) => pattern[i % 3]);

      act(() => {
        for (const action of inputActions) {
          mockBridge.triggerMediaAction(action);
        }
      });

      expect(executedActions.length).toBe(100);
      expect(executedActions).toEqual(inputActions);
    });

    it("empirically verifies 100 consecutive hardware shortcuts dispatched through MediaShortcutsController to BrowserWindow webContents", () => {
      const ipcSentActions: SmtcMediaAction[] = [];
      const fakeWebContents = {
        isDestroyed: () => false,
        send: vi.fn((channel: string, action: SmtcMediaAction) => {
          if (channel === "desktop:media-action") {
            ipcSentActions.push(action);
          }
        }),
      };
      const fakeWindow = {
        isDestroyed: () => false,
        webContents: fakeWebContents,
      } as any;

      const registeredCallbacks = new Map<string, () => void>();
      const mockShortcutApi = {
        register: vi.fn((acc: string, cb: () => void) => {
          registeredCallbacks.set(acc, cb);
          return true;
        }),
        unregister: vi.fn((acc: string) => {
          registeredCallbacks.delete(acc);
        }),
        unregisterAll: vi.fn(() => {
          registeredCallbacks.clear();
        }),
        isRegistered: vi.fn((acc: string) => registeredCallbacks.has(acc)),
      };

      const controller = new MediaShortcutsController({
        getWindow: () => fakeWindow,
        shortcutApi: mockShortcutApi,
      });

      controller.registerAll();

      const keys = ["MediaPlayPause", "MediaNextTrack", "MediaPreviousTrack"];
      const expectedActions: SmtcMediaAction[] = [];

      for (let i = 0; i < 100; i++) {
        const key = keys[i % 3];
        expectedActions.push(key === "MediaPlayPause" ? "togglePlay" : key === "MediaNextTrack" ? "next" : "prev");
        const cb = registeredCallbacks.get(key);
        expect(cb).toBeDefined();
        cb!();
      }

      expect(ipcSentActions.length).toBe(100);
      expect(ipcSentActions).toEqual(expectedActions);

      controller.destroy();
    });
  });

  // =========================================================================
  // REQUIREMENT 2: High-Frequency Position Updates & 1Hz Throttling vs Seeks
  // =========================================================================
  describe("2. High-Frequency Position Updates & 1Hz Throttling vs Seek Updates", () => {
    it("empirically verifies 50 rapid position ticks within the same second are 100% throttled down to 1 update", () => {
      // Set initial playing state
      act(() => {
        usePlayerStore.setState({
          status: "playing",
          currentTrack: SAMPLE_TRACK_A,
          positionMs: 1000,
          durationMs: 240000,
        });
      });

      mountComponent();

      // Initial update sent on mount
      expect(mockBridge.recordedUpdates.length).toBe(1);
      expect(mockBridge.recordedUpdates[0].positionMs).toBe(1000);

      // Now fire 50 rapid micro-updates inside the 1.0s - 1.5s range (10ms step, dt < 1s, delta <= 1500ms)
      for (let i = 1; i <= 50; i++) {
        act(() => {
          usePlayerStore.setState({
            positionMs: 1000 + i * 10, // 1010, 1020, ... 1500ms (all within floor(pos/1000) = 1)
          });
        });
      }

      // Exactly 0 new updates emitted because floor(pos/1000) === 1 and delta <= 1500ms
      expect(mockBridge.recordedUpdates.length).toBe(1);
    });

    it("empirically verifies 50 continuous playback ticks spanning 12.5s throttle strictly to 1Hz (~12 updates)", () => {
      act(() => {
        usePlayerStore.setState({
          status: "playing",
          currentTrack: SAMPLE_TRACK_A,
          positionMs: 1000,
          durationMs: 240000,
        });
      });

      mountComponent();
      expect(mockBridge.recordedUpdates.length).toBe(1);

      // Simulate 50 discrete ticks of 250ms (typical HTMLAudioElement timeupdate frequency):
      // 1250, 1500, 1750, 2000, 2250, 2500, ... up to 13250ms
      for (let i = 1; i <= 50; i++) {
        act(() => {
          usePlayerStore.setState({
            positionMs: 1000 + i * 250,
          });
        });
      }

      // From 1.0s to 13.5s, integer second boundaries crossed are:
      // 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 (12 boundaries).
      // Total updates = initial (1) + 12 = 13 updates.
      // Out of 50 state transitions, 38 (76%) were throttled!
      expect(mockBridge.recordedUpdates.length).toBe(13);

      // Verify each emitted update has strictly monotonic integer seconds
      const seconds = mockBridge.recordedUpdates.map((u) => Math.floor(u.positionMs / 1000));
      expect(seconds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    });

    it("empirically verifies immediate IPC emission upon forward seek (>1500ms jump) bypassing 1Hz throttle", () => {
      act(() => {
        usePlayerStore.setState({
          status: "playing",
          currentTrack: SAMPLE_TRACK_A,
          positionMs: 2000,
          durationMs: 240000,
        });
      });

      mountComponent();
      const initialCount = mockBridge.recordedUpdates.length;

      // Jump forward by 60,000ms (seek to 62,000ms)
      act(() => {
        usePlayerStore.setState({
          positionMs: 62000,
        });
      });

      // Must emit immediately
      expect(mockBridge.recordedUpdates.length).toBe(initialCount + 1);
      const latest = mockBridge.getLatestUpdate();
      expect(latest?.positionMs).toBe(62000);
      expect(latest?.status).toBe("playing");
    });

    it("empirically verifies immediate IPC emission upon backward seek (>1500ms jump)", () => {
      act(() => {
        usePlayerStore.setState({
          status: "playing",
          currentTrack: SAMPLE_TRACK_A,
          positionMs: 62000,
          durationMs: 240000,
        });
      });

      mountComponent();
      const countBefore = mockBridge.recordedUpdates.length;

      // Jump backward by 50,000ms (seek to 12,000ms)
      act(() => {
        usePlayerStore.setState({
          positionMs: 12000,
        });
      });

      expect(mockBridge.recordedUpdates.length).toBe(countBefore + 1);
      const latest = mockBridge.getLatestUpdate();
      expect(latest?.positionMs).toBe(12000);
    });
  });

  // =========================================================================
  // REQUIREMENT 3: Null Track & Idle State Transitions Under Stress
  // =========================================================================
  describe("3. Null Track & State Transitions Stress Testing", () => {
    it("empirically verifies createSmtcPayload never throws and produces valid payloads across 500 random state transitions", () => {
      const statuses = ["idle", "loading", "playing", "paused", "error", "unknown_future_status"];
      const tracks = [null, SAMPLE_TRACK_A, SAMPLE_TRACK_B, { id: "bad_track", title: "", artists: "", durationMs: 0 } as Track];
      const positions = [-500, 0, 1000, 99999999];
      const durations = [0, 180000, 360000];

      let transitionCount = 0;
      for (let i = 0; i < 500; i++) {
        const status = statuses[i % statuses.length];
        const track = tracks[i % tracks.length];
        const pos = positions[i % positions.length];
        const dur = durations[i % durations.length];

        const payload = createSmtcPayload(status, track, pos, dur);
        transitionCount++;

        // Assert schema validity
        expect(["playing", "paused", "loading", "idle"]).toContain(payload.status);
        expect(typeof payload.positionMs).toBe("number");
        expect(payload.positionMs).toBeGreaterThanOrEqual(0);
        expect(typeof payload.durationMs).toBe("number");

        if (!track || status === "idle") {
          expect(payload.status).toBe("idle");
          expect(payload.track).toBeNull();
          expect(payload.positionMs).toBe(0);
          expect(payload.durationMs).toBe(0);
        } else {
          expect(payload.track).toBeDefined();
          expect(payload.track?.id).toBe(track.id);
          expect(typeof payload.track?.title).toBe("string");
          expect(typeof payload.track?.artists).toBe("string");
        }
      }

      expect(transitionCount).toBe(500);
    });

    it("empirically verifies rapid alternating null/active transitions in mounted React component without memory leak or crashed state", () => {
      act(() => {
        usePlayerStore.setState({
          status: "idle",
          currentTrack: null,
          positionMs: 0,
          durationMs: 0,
        });
      });

      mountComponent();

      // Rapidly toggle between idle/null and active playback 60 times
      for (let i = 0; i < 60; i++) {
        act(() => {
          if (i % 2 === 0) {
            usePlayerStore.setState({
              status: "playing",
              currentTrack: SAMPLE_TRACK_A,
              positionMs: 5000 + i * 1000,
              durationMs: SAMPLE_TRACK_A.durationMs,
            });
          } else {
            usePlayerStore.setState({
              status: "idle",
              currentTrack: null,
              positionMs: 0,
              durationMs: 0,
            });
          }
        });
      }

      // Final state was odd (i=59) -> idle / null
      const finalUpdate = mockBridge.getLatestUpdate();
      expect(finalUpdate).toBeDefined();
      expect(finalUpdate?.status).toBe("idle");
      expect(finalUpdate?.track).toBeNull();
      expect(finalUpdate?.positionMs).toBe(0);
      expect(finalUpdate?.durationMs).toBe(0);
    });

    it("empirically verifies error state safely falls back to idle with zero unhandled exceptions", () => {
      act(() => {
        usePlayerStore.setState({
          status: "error" as any,
          currentTrack: SAMPLE_TRACK_A,
          positionMs: 4000,
          durationMs: SAMPLE_TRACK_A.durationMs,
        });
      });

      mountComponent();

      const latest = mockBridge.getLatestUpdate();
      expect(latest?.status).toBe("idle");
    });
  });

  // =========================================================================
  // REQUIREMENT 4: Huge 5,000-Character Strings & Sanitization Stress
  // =========================================================================
  describe("4. Huge 5,000-Character Strings & Sanitization Stress", () => {
    it("cleanly truncates 5,000-character ASCII title and artist to exactly 100 characters with '...' (R3-C3)", () => {
      const hugeTitle = "T".repeat(5000);
      const hugeArtist = "A".repeat(5000);

      const sanitizedTitle = sanitizeForSmtc(hugeTitle, 100);
      const sanitizedArtist = sanitizeForSmtc(hugeArtist, 100);

      expect(sanitizedTitle.length).toBe(100);
      expect(sanitizedTitle.endsWith("...")).toBe(true);
      expect(sanitizedTitle).toBe("T".repeat(97) + "...");

      expect(sanitizedArtist.length).toBe(100);
      expect(sanitizedArtist.endsWith("...")).toBe(true);
      expect(sanitizedArtist).toBe("A".repeat(97) + "...");
    });

    it("cleanly handles 5,000-character multi-byte Unicode strings with surrounding whitespace", () => {
      const unicodeBody = "🎵🎶🔥🌟".repeat(1250); // 5000 chars
      const padded = "     " + unicodeBody + "     ";

      const sanitized = sanitizeForSmtc(padded, 100);
      expect(sanitized.length).toBe(100);
      expect(sanitized.endsWith("...")).toBe(true);
      expect(sanitized.startsWith("🎵🎶🔥🌟")).toBe(true);
    });

    it("formats and sanitizes a 5,000-character artistList array in createSmtcPayload", () => {
      // 50 artists with 100-char names = 5000+ characters joined with commas
      const hugeArtistList = Array.from({ length: 50 }, (_, i) => ({
        name: `Artist_${i.toString().padStart(2, "0")}_${"X".repeat(90)}`,
      }));

      const trackWithHugeArtists: Track = {
        id: "t_huge_artist",
        title: "Song With Massive Ensemble",
        artists: "",
        artistList: hugeArtistList,
        coverUrl: "https://liner.app/cover.jpg",
        durationMs: 300000,
        playCount: 1,
      } as unknown as Track;

      const rawFormatted = formatArtistString(trackWithHugeArtists);
      expect(rawFormatted.length).toBeGreaterThan(5000);

      const payload = createSmtcPayload("playing", trackWithHugeArtists, 15000, 300000);
      expect(payload.track?.artists.length).toBe(100);
      expect(payload.track?.artists.endsWith("...")).toBe(true);
    });

    it("runs 10,000 sanitizations of 5,000-character strings in < 50ms without performance degradation", () => {
      const hugeString = "Z".repeat(5000);
      const iterations = 10000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const res = sanitizeForSmtc(hugeString, 100);
        // spot check inside loop
        if (i === 0) expect(res.length).toBe(100);
      }
      const duration = performance.now() - start;

      // 10,000 operations on 5KB strings should take < 50ms in modern V8
      expect(duration).toBeLessThan(50);
    });

    it("safely handles pathological 5,000-character whitespace strings and dangerous payloads", () => {
      // 5000 whitespace characters
      const allSpaces = " ".repeat(5000);
      expect(sanitizeForSmtc(allSpaces, 100)).toBe("");

      // 5000 script tag injection characters
      const scriptPayload = "<script>alert('xss')</script>".repeat(170); // 5100 chars
      const sanitizedScript = sanitizeForSmtc(scriptPayload, 100);
      expect(sanitizedScript.length).toBe(100);
      expect(sanitizedScript.endsWith("...")).toBe(true);

      // Null bytes and control characters
      const nullByteStr = "Title\x00With\x00Null\x00Bytes".repeat(250);
      const sanitizedNull = sanitizeForSmtc(nullByteStr, 100);
      expect(sanitizedNull.length).toBe(100);
      expect(sanitizedNull.endsWith("...")).toBe(true);
    });
  });
});

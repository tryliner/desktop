import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import {
  useWindowsMediaSync,
  WindowsMediaSync,
  sanitizeForSmtc,
  formatArtistString,
  createSmtcPayload,
  handleSmtcAction,
} from "./useWindowsMediaSync";
import { playerEngine } from "../engine/playerEngine";
import { usePlayerStore } from "../store/playerStore";
import type { Track } from "@/shared/types";
import type { SmtcMediaAction, SmtcMediaUpdatePayload } from "@/electron";

describe("useWindowsMediaSync & SMTC helpers", () => {
  describe("sanitizeForSmtc", () => {
    it("truncates excessively long titles (>100 chars) to 97 chars + ... (R3-C3)", () => {
      const hugeTitle = "A".repeat(400);
      const sanitized = sanitizeForSmtc(hugeTitle, 100);

      expect(sanitized.length).toBe(100);
      expect(sanitized.endsWith("...")).toBe(true);
      expect(sanitized.startsWith("AAA")).toBe(true);
    });

    it("leaves titles with 100 or fewer characters intact", () => {
      const normalTitle = "Blinding Lights";
      expect(sanitizeForSmtc(normalTitle, 100)).toBe("Blinding Lights");

      const exact100 = "B".repeat(100);
      expect(sanitizeForSmtc(exact100, 100)).toBe(exact100);
    });

    it("safely handles null, undefined, and empty strings", () => {
      expect(sanitizeForSmtc(null)).toBe("");
      expect(sanitizeForSmtc(undefined)).toBe("");
      expect(sanitizeForSmtc("   ")).toBe("");
    });
  });

  describe("formatArtistString", () => {
    it("returns string artists when present", () => {
      const track: Track = {
        id: "t1",
        title: "Song",
        artists: "Daft Punk",
        coverUrl: "",
        durationMs: 200000,
        playCount: 0,
      };
      expect(formatArtistString(track)).toBe("Daft Punk");
    });

    it("formats artistList when artists string is missing", () => {
      const track = {
        id: "t2",
        title: "Song",
        artists: "",
        artistList: [{ name: "Justice" }, { name: "Simian" }],
        coverUrl: "",
        durationMs: 200000,
        playCount: 0,
      } as unknown as Track;
      expect(formatArtistString(track)).toBe("Justice, Simian");
    });

    it("falls back to Unknown Artist when no artist information exists", () => {
      const track = {
        id: "t3",
        title: "Song",
        artists: "",
        artistList: [],
        coverUrl: "",
        durationMs: 200000,
        playCount: 0,
      } as unknown as Track;
      expect(formatArtistString(track)).toBe("Unknown Artist");
      expect(formatArtistString(null)).toBe("");
    });
  });

  describe("createSmtcPayload", () => {
    it("handles null track or idle status by sending null track and 0 timing (R3-C1)", () => {
      const payload1 = createSmtcPayload("idle", null, 0, 0);
      expect(payload1).toEqual({
        status: "idle",
        track: null,
        positionMs: 0,
        durationMs: 0,
      });

      const track: Track = {
        id: "t1",
        title: "Song",
        artists: "Artist",
        coverUrl: "https://cover.jpg",
        durationMs: 180000,
        playCount: 0,
      };
      const payload2 = createSmtcPayload("idle", track, 5000, 180000);
      expect(payload2.status).toBe("idle");
      expect(payload2.track).toBeNull();
    });

    it("omits coverUrl when missing or empty (R3-C4)", () => {
      const trackWithoutCover: Track = {
        id: "t_no_cover",
        title: "Acoustic",
        artists: "Solo Guitarist",
        coverUrl: "",
        durationMs: 150000,
        playCount: 0,
      };

      const payload = createSmtcPayload("playing", trackWithoutCover, 1000, 150000);
      expect(payload.track?.coverUrl).toBeUndefined();
    });

    it("correctly maps playing track metadata and timing", () => {
      const track: Track = {
        id: "t_normal",
        title: "Starboy",
        artists: "The Weeknd",
        coverUrl: "https://liner.fun/starboy.jpg",
        durationMs: 230000,
        playCount: 0,
      };

      const payload = createSmtcPayload("playing", track, 30000, 230000);
      expect(payload).toEqual({
        status: "playing",
        track: {
          id: "t_normal",
          title: "Starboy",
          artists: "The Weeknd",
          coverUrl: "https://liner.fun/starboy.jpg",
          durationMs: 230000,
        },
        positionMs: 30000,
        durationMs: 230000,
      });
    });
  });

  describe("handleSmtcAction", () => {
    beforeEach(() => {
      vi.spyOn(playerEngine, "togglePlayPause").mockImplementation(vi.fn());
      vi.spyOn(playerEngine, "resume").mockImplementation(async () => {});
      vi.spyOn(playerEngine, "pause").mockImplementation(vi.fn());
      vi.spyOn(playerEngine, "skipNext").mockImplementation(async () => {});
      vi.spyOn(playerEngine, "skipPrevious").mockImplementation(async () => {});
      vi.spyOn(playerEngine, "stopAndClear").mockImplementation(async () => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("routes togglePlay to playerEngine.togglePlayPause", () => {
      handleSmtcAction("togglePlay");
      expect(playerEngine.togglePlayPause).toHaveBeenCalledTimes(1);
    });

    it("routes play to playerEngine.resume", () => {
      handleSmtcAction("play");
      expect(playerEngine.resume).toHaveBeenCalledTimes(1);
    });

    it("routes pause to playerEngine.pause", () => {
      handleSmtcAction("pause");
      expect(playerEngine.pause).toHaveBeenCalledTimes(1);
    });

    it("routes next to playerEngine.skipNext", () => {
      handleSmtcAction("next");
      expect(playerEngine.skipNext).toHaveBeenCalledTimes(1);
    });

    it("routes prev to playerEngine.skipPrevious", () => {
      handleSmtcAction("prev");
      expect(playerEngine.skipPrevious).toHaveBeenCalledTimes(1);
    });

    it("routes stop to playerEngine.stopAndClear", () => {
      handleSmtcAction("stop");
      expect(playerEngine.stopAndClear).toHaveBeenCalledTimes(1);
    });

    it("handles rapid consecutive actions without dropping or throwing (R3-C2)", () => {
      for (let i = 0; i < 5; i++) {
        handleSmtcAction("next");
      }
      handleSmtcAction("togglePlay");

      expect(playerEngine.skipNext).toHaveBeenCalledTimes(5);
      expect(playerEngine.togglePlayPause).toHaveBeenCalledTimes(1);
    });
  });

  describe("React component WindowsMediaSync & hook lifecycle", () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;
    let recordedUpdates: SmtcMediaUpdatePayload[] = [];
    let registeredActionCallback: ((action: SmtcMediaAction) => void) | null = null;
    let cleanupMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      recordedUpdates = [];
      cleanupMock = vi.fn();
      registeredActionCallback = null;

      (window as any).linerElectron = {
        sendMediaUpdate: vi.fn((payload: SmtcMediaUpdatePayload) => {
          recordedUpdates.push({ ...payload });
        }),
        onMediaAction: vi.fn((cb: (action: SmtcMediaAction) => void) => {
          registeredActionCallback = cb;
          return cleanupMock;
        }),
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
    });

    function mount() {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      act(() => {
        root!.render(React.createElement(WindowsMediaSync));
      });
    }

    it("registers onMediaAction listener on mount and cleans up on unmount", () => {
      mount();

      expect((window as any).linerElectron.onMediaAction).toHaveBeenCalledTimes(1);
      expect(registeredActionCallback).toBeDefined();

      act(() => {
        root!.unmount();
      });
      root = null;

      expect(cleanupMock).toHaveBeenCalledTimes(1);
    });

    it("triggers action handler when onMediaAction fires", () => {
      vi.spyOn(playerEngine, "togglePlayPause").mockImplementation(vi.fn());
      mount();

      act(() => {
        registeredActionCallback!("togglePlay");
      });

      expect(playerEngine.togglePlayPause).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
    });

    it("sends media updates when mounted in the app", () => {
      mount();
      expect((window as any).linerElectron.sendMediaUpdate).toHaveBeenCalled();
    });
  });
});

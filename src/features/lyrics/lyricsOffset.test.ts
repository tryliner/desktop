import { beforeEach, describe, expect, it } from "vitest";
import { useLyricsStore } from "./store/lyricsStore";
import { createJSONStorage } from "zustand/middleware";

let rehydrationPayload: string | null = null;
const rehydrationStorage = {
  getItem: () => rehydrationPayload,
  setItem: (_name: string, value: string) => {
    rehydrationPayload = value;
  },
  removeItem: () => {
    rehydrationPayload = null;
  },
};

describe("useLyricsStore offset handling", () => {
  beforeEach(() => {
    rehydrationPayload = null;
    useLyricsStore.persist.setOptions({
      storage: createJSONStorage(() => rehydrationStorage),
    });
    useLyricsStore.getState().reset();
  });

  it("sets and adjusts offset", () => {
    const store = useLyricsStore.getState();
    store.setLyricsState({
      currentLyricsTrackId: "track-1",
      braccatoLyrics: [
        { startTimeMs: 2000, durationMs: 1000, words: "Line 1" },
      ],
      syncedLines: [{ timeMs: 2000, text: "Line 1" }],
    });

    expect(useLyricsStore.getState().offsetMs).toBe(0);
    useLyricsStore.getState().setOffset(500);
    expect(useLyricsStore.getState().braccatoLyrics[0].startTimeMs).toBe(2500);
    useLyricsStore.getState().adjustOffset(-200);
    expect(useLyricsStore.getState().offsetMs).toBe(300);
    useLyricsStore.getState().resetOffset();
    expect(useLyricsStore.getState().offsetMs).toBe(0);
  });

  it("remembers offset per track in trackOffsets", () => {
    useLyricsStore.getState().setLyricsState({
      currentLyricsTrackId: "track-a",
      braccatoLyrics: [{ startTimeMs: 1000, durationMs: 1000, words: "A" }],
      syncedLines: [{ timeMs: 1000, text: "A" }],
    });
    useLyricsStore.getState().setOffset(400);
    useLyricsStore.getState().setLyricsState({
      currentLyricsTrackId: "track-b",
      braccatoLyrics: [{ startTimeMs: 1000, durationMs: 1000, words: "B" }],
      syncedLines: [{ timeMs: 1000, text: "B" }],
    });
    expect(useLyricsStore.getState().offsetMs).toBe(0);

    useLyricsStore.getState().setLyricsState({
      currentLyricsTrackId: "track-a",
      braccatoLyrics: [{ startTimeMs: 1000, durationMs: 1000, words: "A" }],
      syncedLines: [{ timeMs: 1000, text: "A" }],
    });
    expect(useLyricsStore.getState().offsetMs).toBe(400);
  });

  it("does not carry a track offset into an offset-less track", () => {
    useLyricsStore.getState().setLyricsState({
      currentLyricsTrackId: "track-a",
      braccatoLyrics: [{ startTimeMs: 1000, durationMs: 1000, words: "A" }],
      syncedLines: [{ timeMs: 1000, text: "A" }],
    });
    useLyricsStore.getState().setOffset(200);
    useLyricsStore.getState().setLyricsState({
      currentLyricsTrackId: "track-b",
      braccatoLyrics: [{ startTimeMs: 1000, durationMs: 1000, words: "B" }],
      syncedLines: [{ timeMs: 1000, text: "B" }],
    });
    expect(useLyricsStore.getState().offsetMs).toBe(0);
  });

  it("restores a saved offset for the active track when rehydrated", async () => {
    rehydrationPayload = JSON.stringify({
      state: {
        currentLyricsTrackId: "track-a",
        trackOffsets: { "track-a": 400 },
      },
    });
    await useLyricsStore.persist.rehydrate();
    expect(useLyricsStore.getState().currentLyricsTrackId).toBe("track-a");
    expect(useLyricsStore.getState().offsetMs).toBe(400);
  });

  it("rehydrates an offset-less active track without inheriting an offset", async () => {
    useLyricsStore.getState().setOffset(300);
    rehydrationPayload = JSON.stringify({
      state: {
        currentLyricsTrackId: "track-b",
        trackOffsets: { "track-a": 400 },
      },
    });
    await useLyricsStore.persist.rehydrate();
    expect(useLyricsStore.getState().currentLyricsTrackId).toBe("track-b");
    expect(useLyricsStore.getState().offsetMs).toBe(0);
  });
});

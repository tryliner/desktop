import { describe, it, expect, beforeEach } from "vitest";
import { useMysteryDiceStore } from "./mysteryDiceStore";
import type { Track } from "@/shared/types/track";

describe("mysteryDiceStore", () => {
  beforeEach(() => {
    useMysteryDiceStore.getState().reset();
  });

  it("initializes with unrolled empty state", () => {
    const state = useMysteryDiceStore.getState();
    expect(state.isRolled).toBe(false);
    expect(state.revealedGenre).toBeNull();
    expect(state.revealedTracks).toEqual([]);
  });

  it("sets revealed genre and tracks and marks as rolled", () => {
    const sampleTracks: Track[] = [
      {
        id: "t1",
        title: "Song 1",
        artists: "Artist 1",
        coverUrl: "https://example.com/c1.jpg",
        durationMs: 180000,
        playCount: 10,
      },
      {
        id: "t2",
        title: "Song 2",
        artists: "Artist 2",
        coverUrl: "https://example.com/c2.jpg",
        durationMs: 210000,
        playCount: 5,
      },
    ];

    useMysteryDiceStore.getState().setRevealed("V-Pop", sampleTracks);

    const state = useMysteryDiceStore.getState();
    expect(state.isRolled).toBe(true);
    expect(state.revealedGenre).toBe("V-Pop");
    expect(state.revealedTracks).toHaveLength(2);
    expect(state.revealedTracks[0]?.title).toBe("Song 1");
  });

  it("resets back to unrolled state cleanly", () => {
    useMysteryDiceStore.getState().setRevealed("Electronic / EDM", [
      { id: "t1", title: "Bass", artists: "DJ", coverUrl: "", durationMs: 120000, playCount: 0 },
    ]);
    expect(useMysteryDiceStore.getState().isRolled).toBe(true);

    useMysteryDiceStore.getState().reset();
    const resetState = useMysteryDiceStore.getState();
    expect(resetState.isRolled).toBe(false);
    expect(resetState.revealedGenre).toBeNull();
    expect(resetState.revealedTracks).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerEngine, usePlayerStore } from "../playerEngine";
import type { Track } from "@/shared/types";

const mk = (id: string, albumId?: string): Track => ({
  id,
  title: `Track ${id}`,
  artists: "Artist",
  durationMs: 200_000,
  coverUrl: "",
  playCount: 0,
  ...(albumId ? { album: { id: albumId, title: "Album" } } : {}),
});

const engine = playerEngine as any;

describe("transition scheduling", () => {
  let skip: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const a = mk("a");
    const b = mk("b");
    usePlayerStore.setState({
      queue: [a, b],
      currentIndex: 0,
      currentTrack: a,
      status: "playing",
      durationMs: 200_000,
      repeat: "off",
      crossfadeSeconds: 6,
      gapless: false,
      automix: false,
      playbackContext: null,
    });
    engine.transitionedFrom = null;
    engine.plannedTransition = null;
    skip = vi.spyOn(engine, "skipNext").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts the handover at the planned point, once", () => {
    engine.handleNearEnd(193_000);
    expect(skip).not.toHaveBeenCalled();
    engine.handleNearEnd(194_050);
    expect(skip).toHaveBeenCalledTimes(1);
    expect(skip.mock.calls[0][0]).toBe(true);
    expect(skip.mock.calls[0][1]).toMatchObject({
      kind: "crossfade",
      fadeOutMs: 6_000,
    });
    engine.handleNearEnd(195_000);
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it("stays out of the way when crossfade and gapless are off", () => {
    usePlayerStore.setState({ crossfadeSeconds: 0 });
    engine.handleNearEnd(199_990);
    expect(skip).not.toHaveBeenCalled();
  });

  it("leaves repeat-one loops alone", () => {
    usePlayerStore.setState({ repeat: "one" });
    engine.handleNearEnd(199_000);
    expect(skip).not.toHaveBeenCalled();
  });

  it("does nothing at the end of the queue", () => {
    usePlayerStore.setState({ currentIndex: 1, currentTrack: mk("b") });
    engine.handleNearEnd(199_000);
    expect(skip).not.toHaveBeenCalled();
  });

  it("does nothing while paused", () => {
    usePlayerStore.setState({ status: "paused" });
    engine.handleNearEnd(199_000);
    expect(skip).not.toHaveBeenCalled();
  });

  it("goes gapless between songs of the same album with AutoMix", () => {
    const a = mk("a", "al");
    const b = mk("b", "al");
    usePlayerStore.setState({
      queue: [a, b],
      currentTrack: a,
      automix: true,
    });
    engine.handleNearEnd(194_500);
    expect(skip).not.toHaveBeenCalled();
    engine.handleNearEnd(199_900);
    expect(skip.mock.calls[0][1]).toMatchObject({ kind: "gapless" });
  });
});

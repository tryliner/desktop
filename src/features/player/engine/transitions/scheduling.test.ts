import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "../../store/playerStore";
import type { Track } from "@/shared/types";
import { TransitionDirector } from "./transitionDirector";

const mk = (id: string, albumId?: string): Track => ({
  id,
  title: `Track ${id}`,
  artists: "Artist",
  durationMs: 200_000,
  coverUrl: "",
  playCount: 0,
  ...(albumId ? { album: { id: albumId, title: "Album" } } : {}),
});

function director() {
  return new TransitionDirector({
    getState: () => usePlayerStore.getState(),
    nextIndex: () => {
      const { currentIndex, queue } = usePlayerStore.getState();
      return currentIndex + 1 < queue.length ? currentIndex + 1 : null;
    },
    setTrackGain: () => undefined,
    isTransitioning: () => false,
  });
}

describe("transition scheduling", () => {
  let d: TransitionDirector;

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
    d = director();
  });

  it("starts the handover at the planned point, once", () => {
    expect(d.due(193_000)).toBeNull();
    expect(d.due(194_050)).toMatchObject({
      kind: "crossfade",
      fadeOutMs: 6_000,
    });
    expect(d.due(195_000)).toBeNull();
  });

  it("stays out of the way when crossfade and gapless are off", () => {
    usePlayerStore.setState({ crossfadeSeconds: 0 });
    expect(d.due(199_990)).toBeNull();
  });

  it("leaves repeat-one loops alone", () => {
    usePlayerStore.setState({ repeat: "one" });
    expect(d.due(199_000)).toBeNull();
  });

  it("does nothing at the end of the queue", () => {
    usePlayerStore.setState({ currentIndex: 1, currentTrack: mk("b") });
    expect(d.due(199_000)).toBeNull();
  });

  it("does nothing while paused", () => {
    usePlayerStore.setState({ status: "paused" });
    expect(d.due(199_000)).toBeNull();
  });

  it("goes gapless between songs of the same album with AutoMix", () => {
    usePlayerStore.setState({
      queue: [mk("a", "al"), mk("b", "al")],
      currentTrack: mk("a", "al"),
      automix: true,
    });
    expect(d.due(194_500)).toBeNull();
    expect(d.due(199_900)).toMatchObject({ kind: "gapless" });
  });

  it("plans again for the next song after a track change", () => {
    expect(d.due(194_050)).not.toBeNull();
    d.trackChanged(usePlayerStore.getState());
    expect(d.due(194_050)).not.toBeNull();
  });
});

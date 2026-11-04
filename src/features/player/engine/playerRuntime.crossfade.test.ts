import { describe, it, expect, vi } from "vitest";

vi.mock("./streamResolver", () => ({ resolvePlaybackStream: vi.fn() }));

import { resolvePlaybackStream } from "./streamResolver";
import { usePlayerStore } from "../store/playerStore";
import {
  next,
  playingWithNextOnStandby,
  useTransitionFixture,
} from "./transitionTestFixture";

describe("PlayerRuntime — crossfade and skip fades", () => {
  const { dispatch } = useTransitionFixture();

  it("with crossfade on, overlaps the tracks for the crossfade length", async () => {
    usePlayerStore.setState({ crossfadeSeconds: 6 });
    const rt = await playingWithNextOnStandby(6.5);
    const outgoing = rt["audio"];
    const incoming = rt["standby"];

    outgoing.dispatchEvent(new Event("timeupdate"));
    await vi.advanceTimersByTimeAsync(400);
    expect(dispatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(incoming.volume).toBeLessThan(0.01);

    await vi.advanceTimersByTimeAsync(3000);
    expect(outgoing.paused).toBe(false);
    expect(incoming.volume).toBeGreaterThan(0);
    expect(outgoing.volume).toBeLessThan(1);

    await vi.advanceTimersByTimeAsync(3100);
    expect(incoming.volume).toBe(1);
    expect(outgoing.paused).toBe(true);
  });

  it("a late seek shortens the crossfade to the time left", async () => {
    usePlayerStore.setState({ crossfadeSeconds: 6 });
    const rt = await playingWithNextOnStandby(3);
    const outgoing = rt["audio"];
    const incoming = rt["standby"];

    outgoing.dispatchEvent(new Event("timeupdate"));
    await vi.advanceTimersByTimeAsync(10);
    expect(dispatch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3100);
    expect(incoming.volume).toBe(1);
    expect(outgoing.paused).toBe(true);
  });

  it("pausing mid-crossfade silences the outgoing track right away", async () => {
    usePlayerStore.setState({ crossfadeSeconds: 6 });
    const rt = await playingWithNextOnStandby(6);
    const outgoing = rt["audio"];

    outgoing.dispatchEvent(new Event("timeupdate"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(outgoing.paused).toBe(false);

    rt.pause();
    expect(outgoing.paused).toBe(true);
  });

  it("a manual skip to the standby track starts it instantly and fades the old one out", async () => {
    const rt = await playingWithNextOnStandby(100);
    const outgoing = rt["audio"];
    const incoming = rt["standby"];

    await rt.loadAndPlay(next);

    expect(resolvePlaybackStream).not.toHaveBeenCalled();
    expect(rt["audio"]).toBe(incoming);
    expect(outgoing.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(350);
    expect(outgoing.paused).toBe(true);
    expect(incoming.volume).toBe(1);
  });
});

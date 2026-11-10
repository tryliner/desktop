import { describe, it, expect, vi } from "vitest";

vi.mock("./streamResolver", () => ({ resolvePlaybackStream: vi.fn() }));

import { resolvePlaybackStream } from "./streamResolver";
import { usePlayerStore } from "../store/playerStore";
import { linerDb } from "@/shared/storage";
import { setSavedTrackIndex } from "@/shared/media/saved";
import {
  current,
  next,
  playingWithNextOnStandby,
  track,
  useTransitionFixture,
} from "./transitionTestFixture";

describe("PlayerRuntime — gapless handoff", () => {
  const { dispatch } = useTransitionFixture();

  it("starts the next track just before the end, at full volume, without reloading it", async () => {
    const rt = await playingWithNextOnStandby(0.1);
    const outgoing = rt["audio"];
    const incoming = rt["standby"];

    outgoing.dispatchEvent(new Event("timeupdate"));
    expect(dispatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);

    expect(dispatch).toHaveBeenCalledWith({
      type: "SKIP_NEXT",
      isAutoEnd: true,
    });
    expect(rt["audio"]).toBe(incoming);
    expect(incoming.id).toBe("liner-audio");
    expect(outgoing.id).toBe("liner-audio-standby");
    expect(incoming.volume).toBe(1);

    await rt.loadAndPlay(next);
    expect(resolvePlaybackStream).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().status).toBe("playing");

    await vi.advanceTimersByTimeAsync(100);
    expect(outgoing.paused).toBe(true);
  });

  it("prepares saved audio through its resolver instead of the legacy cache", async () => {
    setSavedTrackIndex([
      {
        trackId: next.id,
        key: "saved-next",
        title: next.title,
        artists: next.artists,
        durationMs: next.durationMs,
        audioFile: "next.webm",
        mimeType: "audio/webm",
        byteSize: 1,
        savedAt: 0,
      },
    ]);
    vi.mocked(resolvePlaybackStream).mockResolvedValue({
      url: "liner-local://saved-audio/saved-next",
      expiresAtMs: null,
      mimeType: "audio/webm",
      codec: "local",
      bitrate: 0,
    });

    const rt = await playingWithNextOnStandby(0.1);
    expect(linerDb.getAudio).not.toHaveBeenCalled();
    expect(rt["standby"].src).toBe("liner-local://saved-audio/saved-next");
    const incoming = rt["standby"];

    rt["audio"].dispatchEvent(new Event("timeupdate"));
    await vi.advanceTimersByTimeAsync(100);
    expect(rt["audio"]).toBe(incoming);
    expect(dispatch).toHaveBeenCalledWith({
      type: "SKIP_NEXT",
      isAutoEnd: true,
    });
    expect(resolvePlaybackStream).toHaveBeenCalledTimes(1);
  });

  it("does not hand off when the standby track is not what plays next", async () => {
    const rt = await playingWithNextOnStandby(0.1);
    rt.peekAutoNext = () => current;

    rt["audio"].dispatchEvent(new Event("timeupdate"));
    await vi.advanceTimersByTimeAsync(1000);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("a superseded preload does not replace the standby of the newer one", async () => {
    const rt = await playingWithNextOnStandby(100);

    const stale = rt.preloadTrack(track("stale"));
    const latest = rt.preloadTrack(next);
    await Promise.all([stale, latest]);

    expect(rt["standbySlot"]?.trackId).toBe(next.id);
  });

  it("re-prepares the standby after a reload that keeps the same track", async () => {
    vi.mocked(resolvePlaybackStream).mockResolvedValue({
      url: "https://example.test/current.webm",
      expiresAtMs: null,
      mimeType: "audio/webm",
      codec: "opus",
      bitrate: 0,
    });
    const rt = await playingWithNextOnStandby(100);

    void rt.loadAndPlay(current, 5000, true);
    expect(rt["standbySlot"]).toBeNull();
    await vi.advanceTimersByTimeAsync(400);

    expect(rt["standbySlot"]?.trackId).toBe(next.id);
  });
});

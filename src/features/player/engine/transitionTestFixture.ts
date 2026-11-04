import { vi, beforeEach, afterEach } from "vitest";
import { PlayerRuntime } from "./playerRuntime";
import { resolvePlaybackStream } from "./streamResolver";
import { usePlayerStore } from "../store/playerStore";
import { linerDb } from "@/shared/storage";
import { setSavedTrackIndex } from "@/shared/media/saved";
import type { Track } from "@/shared/types";

type CachedAudio = Awaited<ReturnType<typeof linerDb.getAudio>>;
type AudioWindow = Window & {
  __liner_audio?: HTMLAudioElement;
  __liner_audio_standby?: HTMLAudioElement;
};

export const track = (id: string): Track => ({
  id,
  title: id,
  artists: "Artist",
  coverUrl: "",
  durationMs: 200_000,
  playCount: 0,
});
export const current = track("current");
export const next = track("next");

export function setMedia(el: HTMLMediaElement, props: Record<string, unknown>) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(el, key, { value, configurable: true });
  }
}

export async function playingWithNextOnStandby(
  remainingSeconds: number,
): Promise<PlayerRuntime> {
  const win = window as AudioWindow;
  document.getElementById("liner-audio")?.remove();
  document.getElementById("liner-audio-standby")?.remove();
  delete win.__liner_audio;
  delete win.__liner_audio_standby;
  const rt = new PlayerRuntime();
  rt.peekAutoNext = () => next;
  await rt.preloadTrack(next);
  rt["currentTrackId"] = current.id;
  rt["attachedTrackId"] = current.id;
  setMedia(rt["audio"], {
    paused: false,
    duration: 200,
    currentTime: 200 - remainingSeconds,
  });
  setMedia(rt["standby"], { readyState: 4 });
  return rt;
}

export function useTransitionFixture() {
  const dispatch = vi.fn();
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "performance"],
    });
    URL.createObjectURL = vi.fn(() => "blob:next");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(linerDb, "getAudio").mockResolvedValue({
      blob: new Blob(["x"], { type: "audio/webm" }),
      byteSize: 1,
    } as CachedAudio);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      setMedia(this, { paused: true });
    });
    usePlayerStore.setState({
      status: "playing",
      currentTrack: current,
      queue: [current, next],
      currentIndex: 0,
      volume: 1,
      crossfadeSeconds: 0,
      keepSpeedAcrossTracks: true,
      dispatch,
    });
  });

  afterEach(() => {
    setSavedTrackIndex([]);
    vi.useRealTimers();
    vi.restoreAllMocks();
    dispatch.mockReset();
    vi.mocked(resolvePlaybackStream).mockReset();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  return { dispatch };
}

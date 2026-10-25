import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import WallpaperBackground from "./WallpaperBackground";
import {
  useCustomBackgroundStore,
  DEFAULT_CUSTOM_BACKGROUND,
} from "../store/customBackgroundStore";

function setMedia(type: string, url: string) {
  useCustomBackgroundStore.setState({
    ...DEFAULT_CUSTOM_BACKGROUND,
    legacyChecked: true,
    media: {
      kind: type.startsWith("video/") ? "video" : "image",
      type,
      name: "file",
      size: 1,
      savedAt: 1,
    },
    mediaUrl: url,
  });
}

describe("WallpaperBackground", () => {
  let container: HTMLDivElement;
  let root: Root;
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    play.mockClear();
    pause.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    useCustomBackgroundStore.setState({ media: null, mediaUrl: null });
  });

  it("renders nothing without a wallpaper", () => {
    useCustomBackgroundStore.setState({ media: null, mediaUrl: null });
    act(() => root.render(<WallpaperBackground visible paused={false} />));
    expect(container.innerHTML).toBe("");
  });

  it("fades the image in once it has loaded", () => {
    setMedia("image/png", "blob:test/png");
    act(() => root.render(<WallpaperBackground visible paused={false} />));
    const layer = container.firstElementChild as HTMLElement;
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("blob:test/png");
    expect(layer.style.opacity).toBe("0");

    act(() => img.dispatchEvent(new Event("load")));
    expect(layer.style.opacity).toBe("1");
    expect(img.style.opacity).toBe("1");
  });

  it("stays hidden while a page cover takes over", () => {
    setMedia("image/png", "blob:test/png");
    act(() =>
      root.render(<WallpaperBackground visible={false} paused={false} />),
    );
    act(() => container.querySelector("img")!.dispatchEvent(new Event("load")));
    expect((container.firstElementChild as HTMLElement).style.opacity).toBe(
      "0",
    );
  });

  it("pauses and resumes a video wallpaper", () => {
    setMedia("video/webm", "blob:test/webm");
    act(() => root.render(<WallpaperBackground visible paused={false} />));
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true);
    act(() => video.dispatchEvent(new Event("loadeddata")));
    expect(play).toHaveBeenCalled();

    act(() => root.render(<WallpaperBackground visible paused />));
    expect(pause).toHaveBeenCalled();

    play.mockClear();
    act(() => root.render(<WallpaperBackground visible paused={false} />));
    expect(play).toHaveBeenCalled();
  });

  it("swaps a paused gif for a still frame", () => {
    setMedia("image/gif", "blob:test/gif");
    act(() => root.render(<WallpaperBackground visible paused={false} />));
    const img = container.querySelector("img")!;
    const canvas = container.querySelector("canvas")!;
    act(() => img.dispatchEvent(new Event("load")));
    expect(img.style.display).toBe("");
    expect(canvas.style.display).toBe("none");

    act(() => root.render(<WallpaperBackground visible paused />));
    expect(img.style.display).toBe("none");
    expect(canvas.style.display).toBe("");
  });

  it("keeps a file picked while the previous one is still fading in", () => {
    vi.useFakeTimers();
    try {
      setMedia("image/png", "blob:test/a");
      act(() => root.render(<WallpaperBackground visible paused={false} />));
      act(() =>
        container.querySelector("img")!.dispatchEvent(new Event("load")),
      );

      // pick another file before the cleanup for the first one has run
      act(() =>
        useCustomBackgroundStore.setState({
          mediaUrl: "blob:test/b",
          media: {
            kind: "image",
            type: "image/png",
            name: "b",
            size: 1,
            savedAt: 2,
          },
        }),
      );
      act(() => vi.runAllTimers());

      const srcs = [...container.querySelectorAll("img")].map((img) =>
        img.getAttribute("src"),
      );
      expect(srcs).toContain("blob:test/b");
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies blur and dimming", () => {
    setMedia("image/jpeg", "blob:test/jpg");
    useCustomBackgroundStore.setState({ blur: 20, dim: 40 });
    act(() => root.render(<WallpaperBackground visible paused={false} />));
    const img = container.querySelector("img")!;
    expect(img.style.filter).toBe("blur(20px)");
    const overlay = container.querySelector(".bg-black") as HTMLElement;
    expect(overlay.style.opacity).toBe("0.4");
  });
});

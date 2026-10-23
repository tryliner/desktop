// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MiniPlayer from "./MiniPlayer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../hooks/usePlayerState", () => ({
  usePlayerState: () => ({
    status: "paused",
    queue: [],
    currentIndex: 0,
    currentTrack: {
      id: "legacy-track-id",
      source: "soundcloud",
      externalUrl: "https://soundcloud.com/artist/song",
      title: "Song",
      artists: "Artist",
      coverUrl: "",
      durationMs: 180_000,
      playCount: 1,
    },
    positionMs: 0,
    durationMs: 180_000,
    volume: 1,
    repeat: "off",
    shuffle: false,
    error: null,
    playbackContext: null,
    playbackContextCover: null,
  }),
}));
vi.mock("../engine/playerEngine", () => ({
  playerEngine: {
    playTrack: vi.fn(),
    seek: vi.fn(),
    setRepeat: vi.fn(),
    setShuffle: vi.fn(),
    setVolume: vi.fn(),
    skipNext: vi.fn(),
    skipPrevious: vi.fn(),
    togglePlayPause: vi.fn(),
  },
}));
vi.mock("../store/playerStore", () => ({
  usePlayerStore: (selector: (state: { miniPlayerStyle: "rounded" }) => unknown) =>
    selector({ miniPlayerStyle: "rounded" }),
}));
vi.mock("@/features/settings", () => ({
  useCustomizationStore: (
    selector: (state: { backgroundImage: string; miniplayer: Record<string, never> }) => unknown,
  ) => selector({ backgroundImage: "", miniplayer: {} }),
  getBlockStyle: () => ({}),
}));
vi.mock("@/features/library/hooks", () => ({
  useIsTrackLiked: () => false,
  useLikeTrack: () => ({ mutate: vi.fn() }),
  useUnlikeTrack: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/features/covers", () => ({
  useCoverReady: () => true,
  CoverImage: () => null,
}));
vi.mock("@/features/artist", () => ({
  ArtistLink: ({ name }: { name: string }) => <span>{name}</span>,
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
vi.mock("./TimelineSlider", () => ({ TimelineSlider: () => null }));
vi.mock("./VolumePicker", () => ({ VolumePicker: () => null }));
vi.mock("./SpeedPitchPicker", () => ({ SpeedPitchPicker: () => null }));

describe("MiniPlayer source attribution", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows the current song provider beside its artist", async () => {
    await act(async () => {
      root.render(<MiniPlayer />);
    });

    const marker = container.querySelector('[data-source-badge="soundcloud"]');
    expect(marker).not.toBeNull();
    expect(marker?.closest("p")?.textContent).toContain("Artist");
    expect(marker?.getAttribute("href")).toBe("https://soundcloud.com/artist/song");
  });
});

import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import AppFrame from "./AppFrame";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (typeof window !== "undefined" && !window.localStorage) {
  (window as any).localStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
}

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/", search: "" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("../hooks/useWindowState", () => ({
  useWindowState: () => ({ isEdgeToEdge: false }),
}));

vi.mock("../hooks/useGlobalShortcuts", () => ({
  useGlobalShortcuts: vi.fn(),
}));

vi.mock("../hooks/useDisableButtonFocus", () => ({
  useDisableButtonFocus: vi.fn(),
}));

vi.mock("./Sidebar", () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock("./WindowControls", () => ({
  default: () => <div data-testid="window-controls" />,
}));

vi.mock("./PageTransition", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("./RightDrawer", () => ({
  default: () => <div data-testid="right-drawer" />,
}));

vi.mock("@/features/search/hooks", () => ({
  useSearchAll: () => ({ items: [], loading: false, hasLoaded: true, runNow: vi.fn(), partialWarning: null }),
  useSearchTracks: () => ({ tracks: [], loading: false, hasLoaded: true, runNow: vi.fn() }),
  useSearchArtists: () => ({ artists: [], loading: false, hasLoaded: true, runNow: vi.fn() }),
  useSearchAlbums: () => ({ albums: [], loading: false, hasLoaded: true, runNow: vi.fn() }),
  useSearchPlaylists: () => ({ playlists: [], loading: false, hasLoaded: true, runNow: vi.fn() }),
}));

vi.mock("@/features/search", () => ({
  SearchHistoryList: () => null,
  useSearchHistoryStore: (selector: any) => selector({ addItem: vi.fn(), items: [] }),
}));

vi.mock("@/features/player", () => ({
  playerEngine: {
    subscribe: () => () => {},
    getSnapshot: () => ({ currentTrack: null, status: "idle" }),
    primeUserGesture: vi.fn(),
    playTrack: vi.fn(),
  },
  MiniPlayer: () => null,
  FullscreenPlayer: () => null,
  usePlayerStore: (selector: any) => selector({ fullscreen: false, setFullscreen: vi.fn() }),
}));

vi.mock("@/features/settings", () => ({
  SettingsModal: () => null,
  useCustomizationStore: (selector: any) => selector({ backgroundImage: null, backgroundBlur: 0, backgroundDim: 0, contentView: {} }),
  getBlockStyle: () => ({}),
}));

vi.mock("@/features/updater", () => ({
  UpdateModal: () => null,
  UpdateToastBridge: () => null,
}));

vi.mock("@/languages", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockSpotifyPlaylistsModal = vi.fn(() => <div data-testid="spotify-playlists-modal">Spotify Playlists Modal Mock</div>);

vi.mock("@/features/library", () => ({
  AddToPlaylistModal: () => null,
  AddToLibraryModal: () => null,
  RemoveFromPlaylistModal: () => null,
  RemoveFromLibraryModal: () => null,
  ImportLikesModal: () => null,
  CreatePlaylistModal: () => null,
  ImportReviewModal: () => null,
  SpotifyPlaylistsModal: () => mockSpotifyPlaylistsModal(),
  useModalStore: (selector: any) => selector({
    searchOpen: false,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    toggleSearch: vi.fn(),
    openSettings: vi.fn(),
  }),
}));

describe("AppFrame Modal Mount Verification", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("mounts and renders SpotifyPlaylistsModal in AppFrame", async () => {
    await act(async () => {
      root?.render(
        <AppFrame>
          <div data-testid="test-content">App Content</div>
        </AppFrame>
      );
    });

    expect(mockSpotifyPlaylistsModal).toHaveBeenCalled();
    const modalElement = document.querySelector("[data-testid='spotify-playlists-modal']");
    expect(modalElement).not.toBeNull();
    expect(modalElement?.textContent).toBe("Spotify Playlists Modal Mock");
  });
});

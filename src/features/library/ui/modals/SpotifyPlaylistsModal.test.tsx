import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import SpotifyPlaylistsModal from "./SpotifyPlaylistsModal";
import { useModalStore } from "../../store/modalStore";
import { useImportStore } from "../../store/importStore";
import { useSpotifyAuthStore } from "../../store/spotifyAuthStore";
import type { SpotifyUserPlaylistSummary } from "../../services/import/sources/spotify/spotifyOAuth";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/languages", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        return React.forwardRef(({ children, ...props }: any, ref: any) => {
          const clean = { ...props };
          for (const k of ["initial", "animate", "exit", "transition", "layoutId"]) delete clean[k];
          return React.createElement(prop, { ref, ...clean }, children);
        });
      },
    },
  ),
}));

function setReactInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

const mockPlaylists: SpotifyUserPlaylistSummary[] = [
  {
    id: "playlist-1",
    name: "Chill Electronic Vibes",
    description: "Relaxing electronic music",
    images: [{ url: "https://example.com/cover1.jpg" }],
    tracksCount: 42,
    isPublic: true,
    ownerName: "DJ Chill",
    spotifyUrl: "https://open.spotify.com/playlist/playlist-1",
  },
  {
    id: "playlist-2",
    name: "Workout Energy",
    description: "High BPM tracks",
    images: [{ url: "https://example.com/cover2.jpg" }],
    tracksCount: 25,
    isPublic: false,
    ownerName: "Fitness Coach",
    spotifyUrl: "https://open.spotify.com/playlist/playlist-2",
  },
];

describe("SpotifyPlaylistsModal UI & Integration", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useModalStore.setState({
      spotifyPlaylistsOpen: false,
    });

    useSpotifyAuthStore.setState({
      status: "disconnected",
      playlists: [],
      loadingPlaylists: false,
      initiateAuth: vi.fn().mockResolvedValue("https://accounts.spotify.com/authorize?mock=1"),
      loadUserPlaylists: vi.fn().mockResolvedValue(mockPlaylists),
      disconnect: vi.fn(),
    });
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

  it("does not render dialog content when closed", async () => {
    await act(async () => {
      root?.render(<SpotifyPlaylistsModal />);
    });

    expect(document.body.textContent).not.toContain("Spotify Playlists");
  });

  it("renders disconnected state when open with Connect Spotify button", async () => {
    act(() => {
      useModalStore.getState().openSpotifyPlaylists();
    });

    await act(async () => {
      root?.render(<SpotifyPlaylistsModal />);
    });

    expect(document.body.textContent).toContain("Spotify Playlists");
    expect(document.body.textContent).toContain("Connect your Spotify account");

    const connectBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Connect Spotify")
    );
    expect(connectBtn).toBeDefined();
  });

  it("clicking Connect Spotify triggers initiateAuth and opens browser window/external", async () => {
    const initiateAuthSpy = vi.fn().mockResolvedValue("https://accounts.spotify.com/authorize?mock=1");
    useSpotifyAuthStore.setState({ initiateAuth: initiateAuthSpy });

    const openExternalSpy = vi.fn();
    (window as any).linerElectron = { openExternal: openExternalSpy };

    act(() => {
      useModalStore.getState().openSpotifyPlaylists();
    });

    await act(async () => {
      root?.render(<SpotifyPlaylistsModal />);
    });

    const connectBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Connect Spotify")
    );
    expect(connectBtn).toBeDefined();

    await act(async () => {
      connectBtn?.click();
    });

    expect(initiateAuthSpy).toHaveBeenCalled();
    expect(openExternalSpy).toHaveBeenCalledWith("https://accounts.spotify.com/authorize?mock=1");

    delete (window as any).linerElectron;
  });

  it("renders connected state with playlist list and metadata", async () => {
    useSpotifyAuthStore.setState({
      status: "connected",
      playlists: mockPlaylists,
      loadingPlaylists: false,
    });

    act(() => {
      useModalStore.getState().openSpotifyPlaylists();
    });

    await act(async () => {
      root?.render(<SpotifyPlaylistsModal />);
    });

    expect(document.body.textContent).toContain("Chill Electronic Vibes");
    expect(document.body.textContent).toContain("42 tracks");
    expect(document.body.textContent).toContain("Public");
    expect(document.body.textContent).toContain("by DJ Chill");

    expect(document.body.textContent).toContain("Workout Energy");
    expect(document.body.textContent).toContain("25 tracks");
    expect(document.body.textContent).toContain("Private");
  });

  it("filters playlists via search query input", async () => {
    useSpotifyAuthStore.setState({
      status: "connected",
      playlists: mockPlaylists,
      loadingPlaylists: false,
    });

    act(() => {
      useModalStore.getState().openSpotifyPlaylists();
    });

    await act(async () => {
      root?.render(<SpotifyPlaylistsModal />);
    });

    const filterInput = document.querySelector("input[placeholder='Filter playlists...']") as HTMLInputElement;
    expect(filterInput).toBeDefined();

    await act(async () => {
      setReactInputValue(filterInput, "Workout");
    });

    expect(document.body.textContent).toContain("Workout Energy");
    expect(document.body.textContent).not.toContain("Chill Electronic Vibes");
  });

  it("clicking Import triggers startImport and closes modal", async () => {
    const startImportSpy = vi.fn().mockResolvedValue(undefined);
    useImportStore.setState({ startImport: startImportSpy });

    useSpotifyAuthStore.setState({
      status: "connected",
      playlists: mockPlaylists,
      loadingPlaylists: false,
    });

    act(() => {
      useModalStore.getState().openSpotifyPlaylists();
    });

    await act(async () => {
      root?.render(<SpotifyPlaylistsModal />);
    });

    expect(useModalStore.getState().spotifyPlaylistsOpen).toBe(true);

    const importButtons = Array.from(document.querySelectorAll("button")).filter((btn) =>
      btn.textContent?.trim() === "Import"
    );
    expect(importButtons.length).toBe(2);

    await act(async () => {
      importButtons[0]?.click();
    });

    expect(startImportSpy).toHaveBeenCalledWith("https://open.spotify.com/playlist/playlist-1");
    expect(useModalStore.getState().spotifyPlaylistsOpen).toBe(false);
  });
});

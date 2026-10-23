import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import CreatePlaylistModal from "./CreatePlaylistModal";
import { useModalStore } from "../../store/modalStore";
import { useImportStore } from "../../store/importStore";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/languages", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useToast: () => ({ toast: vi.fn() }),
  };
});

vi.mock("../../hooks", () => ({
  useCreatePlaylist: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useAddPlaylistTracks: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../../hooks/usePlaylists", () => ({
  notifyLibraryChanged: vi.fn(),
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

describe("CreatePlaylistModal UI & Raw ID Ingestion", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useModalStore.setState({
      createPlaylistOpen: false,
      createPlaylistInitialUrl: "",
      createPlaylistPendingTrack: null,
      spotifyPlaylistsOpen: false,
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

  it("renders when open and displays 'Browse Spotify Playlists' button in import tab", async () => {
    act(() => {
      useModalStore.getState().openCreatePlaylist("https://example.com");
    });

    await act(async () => {
      root?.render(<CreatePlaylistModal />);
    });

    const browseBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Browse Spotify Playlists")
    );
    expect(browseBtn).toBeDefined();
    expect(browseBtn?.textContent).toBe("Browse Spotify Playlists");
  });

  it("clicking 'Browse Spotify Playlists' closes CreatePlaylistModal and opens SpotifyPlaylistsModal", async () => {
    act(() => {
      useModalStore.getState().openCreatePlaylist("https://example.com");
    });

    await act(async () => {
      root?.render(<CreatePlaylistModal />);
    });

    expect(useModalStore.getState().createPlaylistOpen).toBe(true);
    expect(useModalStore.getState().spotifyPlaylistsOpen).toBe(false);

    const browseBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Browse Spotify Playlists")
    );
    expect(browseBtn).toBeDefined();

    await act(async () => {
      browseBtn?.click();
    });

    expect(useModalStore.getState().createPlaylistOpen).toBe(false);
    expect(useModalStore.getState().spotifyPlaylistsOpen).toBe(true);
  });

  it("detects and ingests bare 22-char Base62 Spotify IDs without error", async () => {
    const startImportSpy = vi.fn().mockResolvedValue(undefined);
    useImportStore.setState({ startImport: startImportSpy });

    act(() => {
      useModalStore.getState().openCreatePlaylist("37i9dQZF1DXcBWIGoYBM5M");
    });

    await act(async () => {
      root?.render(<CreatePlaylistModal />);
    });

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe("37i9dQZF1DXcBWIGoYBM5M");

    const form = document.querySelector("form");
    expect(form).toBeDefined();

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(startImportSpy).toHaveBeenCalledWith(
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      null
    );
    expect(useModalStore.getState().createPlaylistOpen).toBe(false);
  });

  it("handles bare 22-char Base62 IDs with surrounding whitespace", async () => {
    const startImportSpy = vi.fn().mockResolvedValue(undefined);
    useImportStore.setState({ startImport: startImportSpy });

    act(() => {
      useModalStore.getState().openCreatePlaylist();
    });

    await act(async () => {
      root?.render(<CreatePlaylistModal />);
    });

    // Switch to import tab
    const importTabBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("common.import")
    );
    await act(async () => {
      importTabBtn?.click();
    });

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input).toBeDefined();

    await act(async () => {
      setReactInputValue(input, "   37i9dQZF1DXcBWIGoYBM5M   ");
    });

    const form = document.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(startImportSpy).toHaveBeenCalledWith(
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      null
    );
  });

  it("detects and ingests spotify:playlist:... URIs without error", async () => {
    const startImportSpy = vi.fn().mockResolvedValue(undefined);
    useImportStore.setState({ startImport: startImportSpy });

    act(() => {
      useModalStore.getState().openCreatePlaylist("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M");
    });

    await act(async () => {
      root?.render(<CreatePlaylistModal />);
    });

    const form = document.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(startImportSpy).toHaveBeenCalledWith(
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      null
    );
    expect(useModalStore.getState().createPlaylistOpen).toBe(false);
  });

  it("detects and ingests spotify:album:... URIs without error", async () => {
    const startImportSpy = vi.fn().mockResolvedValue(undefined);
    useImportStore.setState({ startImport: startImportSpy });

    act(() => {
      useModalStore.getState().openCreatePlaylist("spotify:album:4m2880jivSbbyEGAKfITCa");
    });

    await act(async () => {
      root?.render(<CreatePlaylistModal />);
    });

    const form = document.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(startImportSpy).toHaveBeenCalledWith(
      "https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa",
      null
    );
    expect(useModalStore.getState().createPlaylistOpen).toBe(false);
  });

  it("handles case-insensitive and whitespace padded Spotify URIs", async () => {
    const startImportSpy = vi.fn().mockResolvedValue(undefined);
    useImportStore.setState({ startImport: startImportSpy });

    act(() => {
      useModalStore.getState().openCreatePlaylist("  SPOTIFY:PLAYLIST:37i9dQZF1DXcBWIGoYBM5M  ");
    });

    await act(async () => {
      root?.render(<CreatePlaylistModal />);
    });

    const form = document.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(startImportSpy).toHaveBeenCalledWith(
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      null
    );
  });

  it("rejects empty link submissions with error message", async () => {
    const startImportSpy = vi.fn();
    useImportStore.setState({ startImport: startImportSpy });

    act(() => {
      useModalStore.getState().openCreatePlaylist("   ");
    });

    await act(async () => {
      root?.render(<CreatePlaylistModal />);
    });

    const form = document.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(startImportSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("common.paste_link_first");
  });

  it("rejects invalid links with error message", async () => {
    const startImportSpy = vi.fn();
    useImportStore.setState({ startImport: startImportSpy });

    act(() => {
      useModalStore.getState().openCreatePlaylist("http://::invalid-url");
    });

    await act(async () => {
      root?.render(<CreatePlaylistModal />);
    });

    const form = document.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(startImportSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("common.unsupported_link");
  });
});

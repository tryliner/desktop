import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProfilePage from "./ProfilePage";
import { useAuthStore } from "@/features/auth/store/authStore";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("lottie-web", () => ({
  default: {
    loadAnimation: vi.fn(() => ({
      destroy: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
    })),
  },
}));

vi.mock("@/languages", () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params?.count !== undefined) return `${params.count} tracks`;
      return key;
    },
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
          for (const k of ["initial", "animate", "exit", "transition", "layoutId"]) {
            delete clean[k];
          }
          return React.createElement(prop, { ref, ...clean }, children);
        });
      },
    }
  ),
}));

vi.mock("@/features/library/hooks/usePlaylists", () => ({
  usePlaylistsList: () => ({
    data: {
      playlists: [
        {
          id: "pl_1",
          title: "My Lo-Fi Beats",
          description: "Chill beats to study to",
          coverUrl: "https://example.com/cover1.jpg",
          trackCount: 15,
        },
      ],
      total: 1,
    },
    error: null,
    isLoading: false,
  }),
}));

vi.mock("@/features/library/hooks/useExternalItems", () => ({
  useExternalItems: () => ({
    data: [
      {
        id: "sp_pl_1",
        title: "Discover Weekly",
        subtitle: "30 tracks",
        imageUrl: "https://example.com/sp_cover.jpg",
        kind: "playlist",
        addedAt: "2026-10-21T00:00:00Z",
      },
    ],
    isLoading: false,
  }),
}));

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("ProfilePage Component (ProfilePage.test.tsx)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockStorage());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // Seed mock storage
    localStorage.clear();
    const historyData = [
      {
        id: "h1",
        playbackSessionId: "s1",
        listeningSessionId: "l1",
        track: {
          id: "trk_1",
          title: "Midnight City",
          artists: "M83",
          durationMs: 240000,
          coverUrl: "",
          playCount: 0,
        },
        playedDurationMs: 240000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-20T10:00:00Z",
      },
    ];
    localStorage.setItem("liner_playback_history", JSON.stringify(historyData));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  it("renders profile details and playlists tab for authenticated owner", async () => {
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "usr_mock_1",
        username: "synth_master",
        displayName: "Synth Master",
        bio: "Curator of electronic synthwave.",
        avatarUrl: "https://assets.liner.fun/avatars/preset_1.png",
        isPublic: true,
      },
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    // Verify header elements
    expect(container.textContent).toContain("Synth Master");
    expect(container.textContent).toContain("@synth_master");
    expect(container.textContent).toContain("Curator of electronic synthwave.");
    expect(container.textContent).toContain("Edit Profile");

    // Verify tabs
    expect(container.textContent).toContain("Playlists");
    expect(container.textContent).toContain("Listening Stats");
    expect(container.textContent).toContain("History");

    // Verify playlists rendered
    expect(container.textContent).toContain("My Lo-Fi Beats");
  });

  it("renders guest fallback banner and safe guest profile when unauthenticated (R2-C3)", async () => {
    useAuthStore.setState({
      status: "anonymous",
      user: null,
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Guest Listener Mode");
    expect(container.textContent).toContain("Sign in to save your profile and track listening statistics.");
    expect(container.textContent).toContain("@guest");
  });

  it("switches tabs between Playlists, Listening Stats, and History", async () => {
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "usr_mock_2",
        username: "audiophile",
        displayName: "Audiophile",
        bio: "Testing stats",
        avatarUrl: "",
        isPublic: true,
      },
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    // Click Listening Stats tab
    const statsTabButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Listening Stats")
    );
    expect(statsTabButton).toBeDefined();

    await act(async () => {
      statsTabButton?.click();
    });

    expect(container.textContent).toContain("Total Time Listened");
    expect(container.textContent).toContain("Top Tracks");
    expect(container.textContent).toContain("Midnight City");

    // Click History tab
    const historyTabButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("History")
    );
    expect(historyTabButton).toBeDefined();

    await act(async () => {
      historyTabButton?.click();
    });

    expect(container.textContent).toContain("Midnight City");
    expect(container.textContent).toContain("M83");
  });

  it("triggers share link copying when share button is clicked", async () => {
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "usr_mock_3",
        username: "music_maker",
        displayName: "Music Maker",
        bio: "Sharing sounds",
        avatarUrl: "",
        isPublic: true,
      },
    });

    let copiedUrl = "";
    (navigator as any).clipboard = {
      writeText: async (t: string) => {
        copiedUrl = t;
      },
    };

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    const shareButton = container.querySelector("button[aria-label='Share profile']") as HTMLButtonElement;
    expect(shareButton).toBeDefined();

    await act(async () => {
      shareButton?.click();
    });

    expect(copiedUrl).toBe("https://liner.fun/profile/music_maker");
  });

  it("opens EditProfileModal when Edit Profile button is clicked", async () => {
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "usr_mock_4",
        username: "editor",
        displayName: "Editor User",
        bio: "Pre-edit bio",
        avatarUrl: "",
        isPublic: true,
      },
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    const editButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Edit Profile")
    );
    expect(editButton).toBeDefined();

    await act(async () => {
      editButton?.click();
    });

    expect(container.textContent).toContain("Edit Profile");
    expect(container.querySelector("textarea")).toBeDefined();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { I18nProvider } from "@/languages";
import { ToastProvider } from "@/shared/ui";
import ConnectivityWall, { isOfflineRoute } from "./ConnectivityWall";
import {
  RESTORE_SUCCESS_COUNT,
  recordConnectivitySuccess,
  useConnectivityStore,
} from "../store/connectivityStore";
import { loadDownloadedTracks } from "@/features/library/hooks/useDownloadedTracks";
import { getAuthUserId } from "@/shared/api/auth-session";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../lib/diagnostics", () => ({
  runAllChecks: vi.fn().mockResolvedValue({ checks: [], main: null }),
  DIAG_ENDPOINTS: { api: "https://api.tryliner.fun", covers: "https://covers.tryliner.fun", link: "https://link.tryliner.fun" },
}));

vi.mock("@/features/library/hooks/useDownloadedTracks", () => ({
  DOWNLOADS_PLAYLIST_ID: "downloads",
  loadDownloadedTracks: vi.fn(),
}));

vi.mock("@/shared/api/auth-session", () => ({
  getAuthUserId: vi.fn(),
}));

const sampleTrack = (id: string) => ({
  id,
  title: id,
  artists: "A",
  coverUrl: "",
  durationMs: 1,
  playCount: 0,
});

let currentPath = "";
let navigateTo: (to: string) => void = () => {};
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  currentPath = location.pathname + location.search;
  navigateTo = navigate;
  return null;
}

async function renderWall() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/"]}>
        <I18nProvider>
          <ToastProvider>
            <ConnectivityWall />
            <LocationProbe />
          </ToastProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
  });
  return { host, root };
}

function tripWall() {
  act(() => {
    for (let i = 0; i < 3; i++) {
      useConnectivityStore.getState().recordFailure({ method: "GET", path: "/v1/me", status: 503, latencyMs: 1 });
    }
  });
}

function findDownloadsButton(host: HTMLElement) {
  return Array.from(host.querySelectorAll("button")).find((b) =>
    /Downloaded music/.test(b.textContent ?? ""),
  );
}

describe("ConnectivityWall downloaded music", () => {
  let mounted: { host: HTMLElement; root: Root } | null = null;

  beforeEach(() => {
    useConnectivityStore.getState().reset();
    useConnectivityStore.setState({ restoredAt: undefined });
    currentPath = "";
    vi.mocked(getAuthUserId).mockReturnValue("user-a");
    vi.mocked(loadDownloadedTracks).mockResolvedValue([sampleTrack("a"), sampleTrack("b")]);
  });

  afterEach(() => {
    if (mounted) {
      const { host, root } = mounted;
      act(() => root.unmount());
      host.remove();
      mounted = null;
    }
  });

  it("offers downloaded music with the track count and opens it in offline mode", async () => {
    mounted = await renderWall();
    tripWall();
    await act(async () => {});

    const button = findDownloadsButton(mounted.host);
    expect(button).toBeDefined();
    expect(button!.textContent).toContain("(2)");

    await act(async () => {
      button!.click();
    });

    const state = useConnectivityStore.getState();
    expect(state.offlineMode).toBe(true);
    expect(state.visible).toBe(false);
    expect(currentPath).toBe("/library/playlist?id=downloads");
    expect(findDownloadsButton(mounted.host)).toBeUndefined();
  });

  it("tells the user when liner is back online", async () => {
    mounted = await renderWall();
    tripWall();
    await act(async () => {});
    await act(async () => {
      findDownloadsButton(mounted!.host)!.click();
    });
    expect(document.body.textContent).not.toMatch(/Liner is back online/);

    await act(async () => {
      for (let i = 0; i < RESTORE_SUCCESS_COUNT; i++) recordConnectivitySuccess();
    });

    expect(document.body.textContent).toMatch(/Liner is back online/);
  });

  it("keeps offline mode on the player page and drops it elsewhere", async () => {
    mounted = await renderWall();
    tripWall();
    await act(async () => {});
    await act(async () => {
      findDownloadsButton(mounted!.host)!.click();
    });

    await act(async () => navigateTo("/player"));
    expect(useConnectivityStore.getState().offlineMode).toBe(true);

    await act(async () => navigateTo("/"));
    expect(useConnectivityStore.getState().offlineMode).toBe(false);
    expect(document.body.textContent).not.toMatch(/Liner is back online/);

    tripWall();
    await act(async () => {});
    expect(useConnectivityStore.getState().visible).toBe(true);
  });

  it("recognises the offline routes", () => {
    expect(isOfflineRoute("/library/playlist", "?id=downloads")).toBe(true);
    expect(isOfflineRoute("/player", "")).toBe(true);
    expect(isOfflineRoute("/library", "")).toBe(true);
    expect(isOfflineRoute("/library/playlist", "?id=pl_123")).toBe(false);
    expect(isOfflineRoute("/library/playlist", "?id=likes")).toBe(false);
    expect(isOfflineRoute("/", "")).toBe(false);
  });

  it("hides the option when nothing is downloaded", async () => {
    vi.mocked(loadDownloadedTracks).mockResolvedValue([]);
    mounted = await renderWall();
    tripWall();
    await act(async () => {});

    expect(mounted.host.textContent).toMatch(/Retry/);
    expect(findDownloadsButton(mounted.host)).toBeUndefined();
  });

  it("hides the option for a signed-out user", async () => {
    vi.mocked(getAuthUserId).mockReturnValue(null);
    mounted = await renderWall();
    tripWall();
    await act(async () => {});

    expect(findDownloadsButton(mounted.host)).toBeUndefined();
  });
});

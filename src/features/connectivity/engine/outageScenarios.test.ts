import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseNetSimulation,
  simulatedFailureFor,
  type NetSimulation,
} from "../../../../electron/netsim/simulation";

const showToast = vi.fn();

vi.mock("@/shared/ui/Toast", () => ({ showToast }));
vi.mock("@/languages", () => ({
  createTranslatorSync: () => (key: string) => key,
  getStoredLocale: () => "en",
}));

const PROBE_URLS = {
  google: "https://www.google.com/generate_204",
  cloudflare: "https://cloudflare.com/cdn-cgi/trace",
  youtube: "https://www.youtube.com/generate_204",
};

function reaches(url: string, sim: NetSimulation | null): boolean {
  return !sim || simulatedFailureFor(url, sim) === null;
}

function installNetwork(scenario: string, country = "DE") {
  const sim = parseNetSimulation({
    LINER_SIMULATE: scenario,
    LINER_SIMULATE_COUNTRY: country,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const failure = sim ? simulatedFailureFor(url, sim) : null;
      if (failure === "blocked") throw new TypeError("Failed to fetch");
      if (failure === "timeout")
        throw new DOMException("signal timed out", "TimeoutError");
      return new Response("{}", { status: 200 });
    }),
  );
  const probeNetwork = vi.fn(async () => {
    const internet =
      reaches(PROBE_URLS.google, sim) || reaches(PROBE_URLS.cloudflare, sim);
    const youtubeFailure = sim
      ? simulatedFailureFor(PROBE_URLS.youtube, sim)
      : null;
    return {
      internet,
      youtube: youtubeFailure === null,
      youtubeFailure,
      country: sim?.country ?? (internet ? country : null),
    };
  });
  Object.assign(window, { linerElectron: { probeNetwork } });
  return probeNetwork;
}

function setDeviceOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
}

async function loadFeature() {
  const offline = await import("../store/offlineModeStore");
  const connectivity = await import("../store/connectivityStore");
  const controller = await import("./offlineController");
  controller.initOfflineMode();
  return { ...offline, ...connectivity, ...controller };
}

function failApiCalls(
  recordFailure: (entry: {
    method: string;
    path: string;
    status?: number;
    latencyMs: number;
  }) => void,
) {
  for (let i = 0; i < 3; i += 1)
    recordFailure({ method: "GET", path: "/v1/me", status: 0, latencyMs: 5 });
}

beforeEach(() => {
  vi.resetModules();
  showToast.mockClear();
  localStorage.clear();
  setDeviceOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "linerElectron");
});

describe("youtube not responding", () => {
  it("opens the not-responding modal once playback struggles", async () => {
    installNetwork("youtube-timeout");
    const { useOfflineModeStore, noteYoutubeTrouble } = await loadFeature();

    noteYoutubeTrouble();
    await vi.waitFor(() =>
      expect(useOfflineModeStore.getState().issue).toBe("youtube_unreachable"),
    );
    const state = useOfflineModeStore.getState();
    expect(state.verdict).toBe("online");
    expect(state.offline).toBe(false);
  });

  it("does not re-probe for every failing track", async () => {
    const probeNetwork = installNetwork("youtube-timeout");
    const { useOfflineModeStore, noteYoutubeTrouble } = await loadFeature();

    noteYoutubeTrouble();
    await vi.waitFor(() =>
      expect(useOfflineModeStore.getState().checkedAt).not.toBeNull(),
    );
    noteYoutubeTrouble();
    noteYoutubeTrouble();
    expect(probeNetwork).toHaveBeenCalledTimes(1);
  });
});

describe("youtube blocked in the country", () => {
  it("opens the blocked modal with the country", async () => {
    installNetwork("youtube-blocked", "RU");
    const { useOfflineModeStore, presentDetectedIssue } = await loadFeature();

    expect(await useOfflineModeStore.getState().check()).toBe("online");
    presentDetectedIssue();
    const state = useOfflineModeStore.getState();
    expect(state.issue).toBe("youtube_blocked");
    expect(state.country).toBe("RU");
  });

  it("try again closes the modal and announces youtube is back", async () => {
    installNetwork("youtube-blocked", "RU");
    const { useOfflineModeStore, presentDetectedIssue, retryConnection } =
      await loadFeature();
    await useOfflineModeStore.getState().check();
    presentDetectedIssue();

    expect(await retryConnection()).toBe(false);
    expect(useOfflineModeStore.getState().issue).toBe("youtube_blocked");

    installNetwork("");
    expect(await retryConnection()).toBe(true);
    expect(useOfflineModeStore.getState().issue).toBeNull();
    expect(showToast).toHaveBeenLastCalledWith(
      "offline.youtube_back_title",
      "success",
      expect.anything(),
    );
  });

  it("don't show again hides every youtube modal for the session", async () => {
    installNetwork("youtube-blocked", "RU");
    const { useOfflineModeStore, presentDetectedIssue, noteYoutubeTrouble } =
      await loadFeature();
    await useOfflineModeStore.getState().check();
    presentDetectedIssue();

    useOfflineModeStore.getState().dismissIssue();
    presentDetectedIssue();
    noteYoutubeTrouble("refused");
    expect(useOfflineModeStore.getState().issue).toBeNull();
    expect(useOfflineModeStore.getState().openIssue("server")).toBe(true);
  });

  it("offline mode from the modal stays until youtube is back", async () => {
    installNetwork("youtube-blocked", "RU");
    const {
      useOfflineModeStore,
      presentDetectedIssue,
      enterOfflineForIssue,
      goOnline,
    } = await loadFeature();
    await useOfflineModeStore.getState().check();
    presentDetectedIssue();

    enterOfflineForIssue();
    expect(useOfflineModeStore.getState()).toMatchObject({
      offline: true,
      source: "auto",
      reason: "youtube",
      issue: null,
    });

    expect(await goOnline()).toBe(false);
    expect(useOfflineModeStore.getState().offline).toBe(true);
    expect(showToast).toHaveBeenLastCalledWith(
      "offline.still_youtube_title",
      "error",
      expect.anything(),
    );

    installNetwork("");
    expect(await goOnline()).toBe(true);
    expect(useOfflineModeStore.getState().offline).toBe(false);
  });
});

describe("youtube refuses the connection", () => {
  it("opens the refused modal without probing", async () => {
    const probeNetwork = installNetwork("");
    const { useOfflineModeStore, noteYoutubeTrouble, retryConnection } =
      await loadFeature();

    noteYoutubeTrouble("refused");
    expect(useOfflineModeStore.getState().issue).toBe("youtube_refused");
    expect(probeNetwork).not.toHaveBeenCalled();

    expect(await retryConnection()).toBe(true);
    expect(useOfflineModeStore.getState().issue).toBeNull();
  });
});

describe("liner servers unreachable", () => {
  for (const scenario of ["liner-down", "liner-timeout"]) {
    it(`${scenario}: failing api calls open the server modal`, async () => {
      installNetwork(scenario);
      const { useOfflineModeStore, useConnectivityStore } = await loadFeature();

      failApiCalls(useConnectivityStore.getState().recordFailure);
      await vi.waitFor(() =>
        expect(useOfflineModeStore.getState().issue).toBe("server"),
      );
      expect(useOfflineModeStore.getState().verdict).toBe("server_unreachable");
      expect(useOfflineModeStore.getState().offline).toBe(false);
      expect(useConnectivityStore.getState().visible).toBe(false);
    });
  }

  it("mutes network toasts while the server modal is open", async () => {
    installNetwork("liner-down");
    const { useOfflineModeStore, connectionToastsMuted } = await loadFeature();
    expect(connectionToastsMuted()).toBe(false);
    useOfflineModeStore.getState().openIssue("server");
    expect(connectionToastsMuted()).toBe(true);
    useOfflineModeStore.getState().closeIssue();
    useOfflineModeStore.getState().openIssue("youtube_blocked");
    expect(connectionToastsMuted()).toBe(false);
  });

  it("server modal wins over a youtube modal", async () => {
    installNetwork("liner-down");
    const { useOfflineModeStore } = await loadFeature();
    useOfflineModeStore.getState().openIssue("youtube_unreachable");
    expect(useOfflineModeStore.getState().openIssue("server")).toBe(true);
    expect(useOfflineModeStore.getState().openIssue("youtube_blocked")).toBe(
      false,
    );
    expect(useOfflineModeStore.getState().issue).toBe("server");
  });

  it("use offline mode leaves on its own once liner answers", async () => {
    installNetwork("liner-down");
    const { useOfflineModeStore, enterOfflineForIssue, goOnline } =
      await loadFeature();
    useOfflineModeStore.getState().openIssue("server");
    enterOfflineForIssue();
    expect(useOfflineModeStore.getState().reason).toBe("server");

    expect(await goOnline()).toBe(false);
    expect(showToast).toHaveBeenLastCalledWith(
      "offline.still_server_title",
      "error",
      expect.anything(),
    );

    installNetwork("");
    expect(await goOnline()).toBe(true);
    expect(showToast).toHaveBeenLastCalledWith(
      "offline.back_online_title",
      "success",
      expect.anything(),
    );
  });

  it("does not trip on lyrics or playback failures alone", async () => {
    installNetwork("liner-down");
    const { useConnectivityStore, useOfflineModeStore } = await loadFeature();
    for (let i = 0; i < 5; i += 1)
      useConnectivityStore.getState().recordFailure({
        method: "GET",
        path: `/v1/tracks/trk_${i}/lyrics`,
        status: 0,
        latencyMs: 5,
      });
    expect(useConnectivityStore.getState().tripped).toBe(false);
    expect(useOfflineModeStore.getState().issue).toBeNull();
  });
});

describe("device offline", () => {
  it("shows the offline modal instead of silently switching", async () => {
    installNetwork("");
    const { useOfflineModeStore } = await loadFeature();

    window.dispatchEvent(new Event("offline"));
    const state = useOfflineModeStore.getState();
    expect(state.issue).toBe("offline");
    expect(state.offline).toBe(false);
  });

  it("opens the offline modal at startup without a network", async () => {
    setDeviceOnline(false);
    installNetwork("");
    const { useOfflineModeStore } = await loadFeature();
    expect(useOfflineModeStore.getState().issue).toBe("offline");
  });

  it("never shows a modal while offline mode is already on", async () => {
    installNetwork("");
    const { useOfflineModeStore, enterOfflineMode } = await loadFeature();
    enterOfflineMode("manual");
    window.dispatchEvent(new Event("offline"));
    expect(useOfflineModeStore.getState().issue).toBeNull();
  });
});

describe("liner and youtube both down, internet fine", () => {
  it("reports the server problem first", async () => {
    installNetwork("liner-down,youtube-blocked", "RU");
    const { useOfflineModeStore, presentDetectedIssue } = await loadFeature();

    expect(await useOfflineModeStore.getState().check()).toBe(
      "server_unreachable",
    );
    presentDetectedIssue();
    expect(useOfflineModeStore.getState().issue).toBe("server");
    expect(useOfflineModeStore.getState().youtube).toBe("blocked");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { debouncedStorage } from "@/shared/utils/storage";
import {
  AVAILABLE_SEARCH_SOURCES,
  effectiveSearchSource,
  useSearchSourceStore,
} from "./searchSourceStore";

const STORAGE_KEY = "liner_search_sources";

function resetStore(): void {
  useSearchSourceStore.setState({
    enabledSources: [...AVAILABLE_SEARCH_SOURCES],
    selectedSources: [...AVAILABLE_SEARCH_SOURCES],
  });
}

async function rehydrate(state: unknown): Promise<void> {
  debouncedStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 0 }));
  await useSearchSourceStore.persist.rehydrate();
}

describe("searchSourceStore", () => {
  beforeEach(() => {
    debouncedStorage.removeItem(STORAGE_KEY);
    resetStore();
  });

  it("enables and selects both available providers by default", () => {
    expect(useSearchSourceStore.getState()).toMatchObject({
      enabledSources: ["youtube", "soundcloud"],
      selectedSources: ["youtube", "soundcloud"],
    });
  });

  it("removes a disabled provider from selection and selects the remainder", () => {
    useSearchSourceStore.getState().setSourceEnabled("youtube", false);

    expect(useSearchSourceStore.getState()).toMatchObject({
      enabledSources: ["soundcloud"],
      selectedSources: ["soundcloud"],
    });
  });

  it("rejects removal of the final enabled or selected provider", () => {
    useSearchSourceStore.getState().setSourceEnabled("youtube", false);
    useSearchSourceStore.getState().setSourceEnabled("soundcloud", false);
    useSearchSourceStore.getState().toggleSourceSelected("soundcloud");

    expect(useSearchSourceStore.getState()).toMatchObject({
      enabledSources: ["soundcloud"],
      selectedSources: ["soundcloud"],
    });
  });

  it("makes a re-enabled provider available without selecting it", () => {
    useSearchSourceStore.getState().setSourceEnabled("youtube", false);
    useSearchSourceStore.getState().setSourceEnabled("youtube", true);

    expect(useSearchSourceStore.getState()).toMatchObject({
      enabledSources: ["youtube", "soundcloud"],
      selectedSources: ["soundcloud"],
    });
  });

  it("maps selected sets onto the existing search contract", () => {
    expect(effectiveSearchSource(["youtube", "soundcloud"])).toBe("all");
    expect(effectiveSearchSource(["youtube"])).toBe("youtube");
    expect(effectiveSearchSource(["soundcloud"])).toBe("soundcloud");
  });

  it("selects enabled providers from search history values", () => {
    useSearchSourceStore.getState().toggleSourceSelected("soundcloud");
    useSearchSourceStore.getState().selectSearchSource("all");
    expect(useSearchSourceStore.getState().selectedSources).toEqual(["youtube", "soundcloud"]);

    useSearchSourceStore.getState().selectSearchSource("soundcloud");
    expect(useSearchSourceStore.getState().selectedSources).toEqual(["soundcloud"]);

    useSearchSourceStore.getState().setSourceEnabled("youtube", false);
    useSearchSourceStore.getState().selectSearchSource("youtube");
    expect(useSearchSourceStore.getState().selectedSources).toEqual(["soundcloud"]);
  });

  it("normalizes empty and unknown persisted arrays", async () => {
    await rehydrate({ enabledSources: ["unknown"], selectedSources: [] });

    expect(useSearchSourceStore.getState()).toMatchObject({
      enabledSources: ["youtube", "soundcloud"],
      selectedSources: ["youtube", "soundcloud"],
    });
  });

  it("deduplicates persisted sources and selects an enabled fallback", async () => {
    await rehydrate({
      enabledSources: ["soundcloud", "soundcloud", "unknown"],
      selectedSources: ["youtube", "youtube", "unknown"],
    });

    expect(useSearchSourceStore.getState()).toMatchObject({
      enabledSources: ["soundcloud"],
      selectedSources: ["soundcloud"],
    });
  });
});

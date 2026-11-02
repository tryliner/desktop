import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useAiTranslateStore,
  getTranslationCacheKey,
  getRomanizationCacheKey,
  sanitizeAiTranslateForExport,
} from "./aiTranslateStore";

function mockGoogleTranslate(dictionary: Record<string, string>): typeof fetch {
  return vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
    const url = String(input);
    const q = new URL(url).searchParams.get("q") ?? "";
    const translated = dictionary[q] ?? q;
    return new Response(JSON.stringify([[[translated, q]]]), { status: 200 });
  });
}

describe("AI Lyrics Translation Store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAiTranslateStore.getState().clearCache();
    useAiTranslateStore.setState({ provider: "google_translate" });
  });

  it("caches translations in store to prevent duplicate requests", async () => {
    const lines = ["Line 1", "Line 2"];
    const mockFetch = mockGoogleTranslate({
      "Line 1": "Dòng 1",
      "Line 2": "Dòng 2",
    });
    global.fetch = mockFetch;

    const store = useAiTranslateStore.getState();
    const res1 = await store.translateTrackLyrics("track-123", lines);
    expect(res1).toEqual(["Dòng 1", "Dòng 2"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const res2 = await store.translateTrackLyrics("track-123", lines);
    expect(res2).toEqual(["Dòng 1", "Dòng 2"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("differentiates cache keys between standard and singable mode", () => {
    const standardKey = getTranslationCacheKey("track-abc", "vi", false);
    const singableKey = getTranslationCacheKey("track-abc", "vi", true);
    expect(standardKey).toBe("track-abc:vi");
    expect(singableKey).toBe("track-abc:vi:singable");
  });

  it("differentiates cache keys across lyric providers for translation and romanization", () => {
    const keyDefault = getTranslationCacheKey("track-abc", "vi", false);
    const keyGenius = getTranslationCacheKey("track-abc", "vi", false, "genius");
    const keyMusix = getTranslationCacheKey("track-abc", "vi", false, "musixmatch");
    expect(keyDefault).toBe("track-abc:vi");
    expect(keyGenius).toBe("track-abc:vi:genius");
    expect(keyMusix).toBe("track-abc:vi:musixmatch");

    const romDefault = getRomanizationCacheKey("track-abc");
    const romGenius = getRomanizationCacheKey("track-abc", "genius");
    expect(romDefault).toBe("track-abc");
    expect(romGenius).toBe("track-abc:genius");
  });

  it("stores entries under provider-qualified keys when provider is supplied", async () => {
    const mockFetch = mockGoogleTranslate({
      Song: "Bài hát",
    });
    global.fetch = mockFetch;

    const store = useAiTranslateStore.getState();
    await store.translateTrackLyrics("track-genius", ["Song"], "genius");

    const state = useAiTranslateStore.getState();
    const expectedKey = getTranslationCacheKey(
      "track-genius",
      state.targetLang,
      state.singableMode,
      "genius",
    );
    expect(state.translationsByTrackId[expectedKey]).toEqual(["Bài hát"]);
  });

  it("clears translations and romanizations when configuration changes", () => {
    const store = useAiTranslateStore.getState();
    useAiTranslateStore.setState({
      translationsByTrackId: { "track-1": ["line 1"] },
      romanizationsByTrackId: { "track-1": ["line 1"] },
    });

    store.setProvider("openai");
    expect(useAiTranslateStore.getState().translationsByTrackId).toEqual({});
    expect(useAiTranslateStore.getState().romanizationsByTrackId).toEqual({});

    useAiTranslateStore.setState({
      translationsByTrackId: { "track-2": ["line 2"] },
      romanizationsByTrackId: { "track-2": ["line 2"] },
    });
    store.setModel("gpt-4o");
    expect(useAiTranslateStore.getState().translationsByTrackId).toEqual({});
    expect(useAiTranslateStore.getState().romanizationsByTrackId).toEqual({});
  });

  it("does not reuse cached translations when source lines differ", async () => {
    const mockFetch = mockGoogleTranslate({
      "Line 1": "Dòng 1",
      "Different 1": "Khác 1",
    });
    global.fetch = mockFetch;

    const store = useAiTranslateStore.getState();
    const res1 = await store.translateTrackLyrics("track-diff", ["Line 1"]);
    expect(res1).toEqual(["Dòng 1"]);

    const res2 = await store.translateTrackLyrics("track-diff", ["Different 1"]);
    expect(res2).toEqual(["Khác 1"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("sanitizes apiKey before export to prevent credential leakage", () => {
    const payload = JSON.stringify({
      state: {
        provider: "gemini",
        apiKey: "secret-super-key-12345",
        targetLang: "vi",
      },
      version: 2,
    });
    const sanitized = sanitizeAiTranslateForExport(payload);
    expect(sanitized).not.toContain("secret-super-key-12345");
    expect(JSON.parse(sanitized).state.apiKey).toBe("");
  });
});

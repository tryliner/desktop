import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SONG_TRANSLATION_SYSTEM_PROMPT,
  SONG_SINGABLE_TRANSLATION_SYSTEM_PROMPT,
  SONG_ROMANIZATION_SYSTEM_PROMPT,
  translateSongLyrics,
  romanizeSongLyrics,
} from "./services/aiTranslateService";
import {
  useAiTranslateStore,
  getTranslationCacheKey,
  getRomanizationCacheKey,
} from "./store/aiTranslateStore";

function mockGoogleTranslate(dictionary: Record<string, string>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
    const translated = dictionary[q] ?? q;
    return {
      ok: true,
      json: async () => [[[translated, q]]],
    } as Response;
  });
}

describe("AI Lyrics Translation Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("generates correct system prompt enforcing line-by-line parity", () => {
    const prompt = SONG_TRANSLATION_SYSTEM_PROMPT("English", "Vietnamese");
    expect(prompt).toContain("Maintain line-by-line parity");
    expect(prompt).toContain("poetic song translator");
    expect(prompt).toContain("Vietnamese");
  });

  it("generates a romanization prompt that forbids translation", () => {
    expect(SONG_ROMANIZATION_SYSTEM_PROMPT).toContain("Maintain line-by-line parity");
    expect(SONG_ROMANIZATION_SYSTEM_PROMPT).toContain("Hepburn Romaji");
    expect(SONG_ROMANIZATION_SYSTEM_PROMPT).toContain("Do NOT translate");
  });

  it("falls back to free translator when API key is omitted", async () => {
    const mockFetch = mockGoogleTranslate({
      Hello: "Xin chào",
      World: "Thế giới",
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await translateSongLyrics(["Hello", "", "World"], {
      provider: "gemini",
      targetLang: "vi",
    });

    expect(result).toEqual(["Xin chào", "", "Thế giới"]);
    // Blank lines are not sent to the network.
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("keeps subtitle indices aligned when an LLM drops blank lines", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: "Dòng một\nDòng ba" }] } },
        ],
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await translateSongLyrics(
      ["Line one", "", "Line three"],
      {
        provider: "gemini",
        apiKey: "test-key",
        targetLang: "vi",
      },
    );

    expect(result).toEqual(["Dòng một", "", "Dòng ba"]);
  });

  it("romanizes Japanese lyrics and skips lines that are already Latin", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const q = decodeURIComponent(
        new URL(String(input)).searchParams.get("q") ?? "",
      );
      const result = q === "残酷な天使のテーゼ" ? "Zankoku na tenshi no tēze" : q;
      return {
        ok: true,
        json: async () => [[[null, null, null, result]]],
      } as Response;
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await romanizeSongLyrics(
      ["残酷な天使のテーゼ", "Hello world"],
      {
        provider: "google_translate",
        targetLang: "vi",
      },
    );

    expect(result).toEqual(["Zankoku na tenshi no tēze", ""]);
  });

  it("caches translations in store to prevent duplicate requests", async () => {
    const lines = ["Line 1", "Line 2"];
    const mockFetch = mockGoogleTranslate({
      "Line 1": "Dòng 1",
      "Line 2": "Dòng 2",
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const store = useAiTranslateStore.getState();
    const res1 = await store.translateTrackLyrics("track-123", lines);
    expect(res1).toEqual(["Dòng 1", "Dòng 2"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call with same track ID should return the cached version.
    const res2 = await store.translateTrackLyrics("track-123", lines);
    expect(res2).toEqual(["Dòng 1", "Dòng 2"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("generates musical singable prompt with syllable and rhyme rules", () => {
    const singablePrompt = SONG_SINGABLE_TRANSLATION_SYSTEM_PROMPT("Japanese", "English");
    expect(singablePrompt).toContain("singable");
    expect(singablePrompt).toContain("SYLLABLE COUNT & CADENCE");
    expect(singablePrompt).toContain("RHYME & TONAL MELODY");

    // SONG_TRANSLATION_SYSTEM_PROMPT delegates to singable when flag is true
    const prompt = SONG_TRANSLATION_SYSTEM_PROMPT("Japanese", "English", true);
    expect(prompt).toContain("SYLLABLE COUNT & CADENCE");
  });

  it("translates via OpenAI compatible provider with custom baseUrl and model", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;
      capturedBody = JSON.parse(String(init?.body ?? "{}"));
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Xin chào bầu trời xanh\nNắng chiếu lấp lánh quanh",
              },
            },
          ],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const result = await translateSongLyrics(["Blue sky", "Bright sun"], {
      provider: "openai_compatible",
      apiKey: "custom-token-123",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      targetLang: "vi",
      singableMode: true,
    });

    expect(capturedUrl).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(capturedHeaders["Authorization"]).toBe("Bearer custom-token-123");
    expect(capturedBody.model).toBe("llama-3.3-70b-versatile");
    expect(capturedBody.messages[0].content).toContain("SYLLABLE COUNT");
    expect(result).toEqual(["Xin chào bầu trời xanh", "Nắng chiếu lấp lánh quanh"]);
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
});

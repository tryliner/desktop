import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  translateSongLyrics,
  romanizeSongLyrics,
} from "./aiTranslateService";

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

describe("AI Lyrics Translation Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses free translator for google_translate provider", async () => {
    const mockFetch = mockGoogleTranslate({
      Hello: "Xin chào",
      World: "Thế giới",
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await translateSongLyrics(["Hello", "", "World"], {
      provider: "google_translate",
      targetLang: "vi",
    });

    expect(result).toEqual(["Xin chào", "", "Thế giới"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws when API key is missing for gemini, openai, or deepseek", async () => {
    await expect(
      translateSongLyrics(["Hello"], { provider: "gemini", targetLang: "vi" }),
    ).rejects.toThrow("API key is required for Gemini");

    await expect(
      translateSongLyrics(["Hello"], { provider: "openai", targetLang: "vi" }),
    ).rejects.toThrow("API key is required for OpenAI");

    await expect(
      translateSongLyrics(["Hello"], { provider: "deepseek", targetLang: "vi" }),
    ).rejects.toThrow("API key is required for DeepSeek");
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
});

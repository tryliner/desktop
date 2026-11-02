import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  translateSongLyrics,
  romanizeSongLyrics,
} from "./aiTranslateService";

function mockFetchJson(data: unknown): typeof fetch {
  return vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify(data), { status: 200 }),
  );
}

function mockGoogleTranslate(
  dictionary: Record<string, string>,
  onQuery?: (q: string, tl: string | null) => void,
): typeof fetch {
  return vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const q = url.searchParams.get("q") ?? "";
    const tl = url.searchParams.get("tl");
    onQuery?.(q, tl);
    const translated = dictionary[q] ?? q;
    return new Response(JSON.stringify([[[translated, q]]]), { status: 200 });
  });
}

describe("AI Lyrics Translation Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses free translator for google_translate provider", async () => {
    const targetLangs: (string | null)[] = [];
    const mockFetch = mockGoogleTranslate(
      {
        "Hello World": "Xin chào thế giới",
        Peace: "Hòa bình",
      },
      (_q, tl) => targetLangs.push(tl),
    );
    global.fetch = mockFetch;

    const result = await translateSongLyrics(["Hello World", "", "Peace"], {
      provider: "google_translate",
      targetLang: "vi",
    });

    expect(result).toEqual(["Xin chào thế giới", "", "Hòa bình"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(targetLangs.length).toBe(2);
    expect(targetLangs.every((tl) => tl === "vi")).toBe(true);
  });

  it("throws when API key is missing for api key required providers", async () => {
    for (const provider of ["gemini", "claude", "openai", "deepseek", "openrouter"] as const) {
      const name =
        provider === "gemini"
          ? "Gemini"
          : provider === "claude"
            ? "Claude"
            : provider === "openai"
              ? "OpenAI"
              : provider === "deepseek"
                ? "DeepSeek"
                : "OpenRouter";
      await expect(
        translateSongLyrics(["Hello"], { provider, targetLang: "vi" }),
      ).rejects.toThrow(`API key is required for ${name}`);
      await expect(
        romanizeSongLyrics(["Hello"], { provider, targetLang: "vi" }),
      ).rejects.toThrow(`API key is required for ${name}`);
    }
  });

  it("keeps subtitle indices aligned when an LLM drops blank lines", async () => {
    global.fetch = mockFetchJson({
      candidates: [{ content: { parts: [{ text: "Dòng một\nDòng ba" }] } }],
    });

    const result = await translateSongLyrics(
      ["Line one", "", "Line three"],
      { provider: "gemini", apiKey: "test-key", targetLang: "vi" },
    );

    expect(result).toEqual(["Dòng một", "", "Dòng ba"]);
  });

  it("romanizes Japanese lyrics and skips lines that are already Latin", async () => {
    global.fetch = vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
      const q = decodeURIComponent(
        new URL(String(input)).searchParams.get("q") ?? "",
      );
      const result = q === "残酷な天使のテーゼ" ? "Zankoku na tenshi no tēze" : q;
      return new Response(JSON.stringify([[[null, null, null, result]]]), { status: 200 });
    });

    const result = await romanizeSongLyrics(
      ["残酷な天使のテーゼ", "Hello world"],
      { provider: "google_translate", targetLang: "vi" },
    );

    expect(result).toEqual(["Zankoku na tenshi no tēze", ""]);
  });

  it("translates via OpenAI compatible provider with custom baseUrl and model", async () => {
    let capturedUrl = "";
    interface ChatPayload {
      model?: string;
      messages?: Array<{ content?: string }>;
    }
    let capturedBody: ChatPayload = {};
    let capturedHeaders: HeadersInit | undefined = undefined;

    global.fetch = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as ChatPayload;
      return new Response(JSON.stringify({
        choices: [
          { message: { content: "Xin chào bầu trời xanh\nNắng chiếu lấp lánh quanh" } },
        ],
      }), { status: 200 });
    });

    const result = await translateSongLyrics(["Blue sky", "Bright sun"], {
      provider: "openai_compatible",
      apiKey: "custom-token-123",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      targetLang: "vi",
      singableMode: true,
    });

    expect(capturedUrl).toBe("https://api.groq.com/openai/v1/chat/completions");
    const headers = new Headers(capturedHeaders);
    expect(headers.get("Authorization")).toBe("Bearer custom-token-123");
    expect(capturedBody.model).toBe("llama-3.3-70b-versatile");
    const content = capturedBody.messages?.[0]?.content ?? "";
    expect(content).toContain("SYLLABLE COUNT");
    expect(result).toEqual(["Xin chào bầu trời xanh", "Nắng chiếu lấp lánh quanh"]);
  });
});

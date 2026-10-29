import { beforeEach, describe, expect, it } from "vitest";
import { parseRawLyrics, applyLyricsOffset } from "./engine/lyricsParser";
import { getHanLanguage, getLineLanguage } from "./engine/lyricsLanguage";
import { romanizationKey } from "./engine/romanizationPreference";
import { useLyricsStore, type LyricsProviderOption } from "./store/lyricsStore";

const ttml = (language: string) =>
  `<tt xmlns="http://www.w3.org/ns/ttml" xml:lang="${language}"><body dur="4s"><div><p begin="0s" end="2s">未来</p><p begin="2s" end="4s">世界</p></div></body></tt>`;
const option = (provider: string, content: string): LyricsProviderOption => ({
  provider,
  syncLevel: "line_level",
  quality: 1,
  candidate: {
    provider,
    contentKind: "line_synced",
    syncLevel: "line_level",
    lyrics: { format: "ttml", content },
    quality: {
      total: 1,
      match: 1,
      content: 1,
      sync: 1,
      source: 1,
      reasons: [],
    },
  },
});

beforeEach(() => useLyricsStore.getState().reset());

describe("declared lyric language", () => {
  it("preserves TTML language for an entirely kanji song", () => {
    const parsed = parseRawLyrics(ttml("ja-JP"), "ttml");
    expect(parsed.language).toBe("ja-JP");
    expect(getHanLanguage(parsed.braccatoLyrics)).toBe("ja");
    expect(getHanLanguage(parsed.braccatoLyrics, "zh")).toBe("zh");
  });

  it("retains language and the preference key after offset adjustments", () => {
    const parsed = parseRawLyrics(ttml("ja"), "ttml");
    const adjusted = applyLyricsOffset(parsed, 500);
    expect(getHanLanguage(adjusted.braccatoLyrics)).toBe("ja");
    expect(romanizationKey("track", adjusted.braccatoLyrics)).toBe(
      romanizationKey("track", parsed.braccatoLyrics),
    );
  });

  it("updates language when switching lyric providers", () => {
    const store = useLyricsStore.getState();
    store.setLyricsState({
      currentLyricsTrackId: "track",
      availableProviders: [
        option("japanese", ttml("ja")),
        option("mandarin", ttml("zh-Hant")),
      ],
    });
    store.selectProvider("japanese");
    store.setOffset(100);
    expect(getHanLanguage(useLyricsStore.getState().braccatoLyrics)).toBe("ja");
    store.selectProvider("mandarin");
    expect(getHanLanguage(useLyricsStore.getState().braccatoLyrics)).toBe("zh");
  });

  it.each(["yue", "yue-Hant-HK", "zh-yue"])(
    "respects declared Cantonese %s",
    (language) => {
      expect(
        getHanLanguage(parseRawLyrics(ttml(language)).braccatoLyrics),
      ).toBe("yue");
    },
  );

  it("does not read Korean hanja as Mandarin", () => {
    const song = parseRawLyrics(ttml("ko")).braccatoLyrics;
    expect(getLineLanguage("世界", getHanLanguage(song))).toBeNull();
    expect(getLineLanguage("사랑해", getHanLanguage(song))).toBe("ko");
  });

  it("falls back to script heuristics for unsupported or missing metadata", () => {
    expect(getHanLanguage(parseRawLyrics(ttml("und")).braccatoLyrics)).toBe(
      "zh",
    );
    expect(
      getHanLanguage(parseRawLyrics("夜に駆ける\n君").braccatoLyrics),
    ).toBe("ja");
  });
});

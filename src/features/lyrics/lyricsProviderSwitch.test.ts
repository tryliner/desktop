import { describe, it, expect, beforeEach } from "vitest";
import { useLyricsStore, type LyricsProviderOption } from "./store/lyricsStore";
import { hasUsableLyrics, lyricsCache } from "./store/lyricsCache";
import { parseRawLyrics } from "./engine/lyricsParser";
import type { LyricsCandidate } from "@/shared/contracts/lyrics";

const DRAKE_INTRO_LRCLIB_SYNCED = "[00:00.00]\r\n";

function candidate(
  provider: string,
  syncLevel: LyricsCandidate["syncLevel"],
  format: string,
  content: string,
  total: number,
): LyricsCandidate {
  return {
    provider,
    contentKind: syncLevel === "plain" ? "plain" : "line_synced",
    syncLevel,
    quality: { total, match: 0, content: 0, sync: 0, source: 0, reasons: [] },
    matchedTrack: {
      title: "Intro",
      artists: ["Drake"],
      durationMs: 37000,
    },
    lyrics: { format, content },
  } as LyricsCandidate;
}

function option(c: LyricsCandidate): LyricsProviderOption {
  return {
    provider: c.provider,
    syncLevel: c.syncLevel,
    quality: c.quality.total,
    candidate: c,
  };
}

const lrclibEmpty = candidate(
  "lrclib",
  "line_level",
  "lrc",
  DRAKE_INTRO_LRCLIB_SYNCED.trim(),
  70,
);
const geniusText = candidate(
  "genius",
  "plain",
  "plain",
  "Yeah\nLet me take you somewhere",
  40,
);
const binimumSynced = candidate(
  "binimum",
  "line_level",
  "lrc",
  "[00:01.00] Yeah\n[00:03.00] Let me take you somewhere",
  60,
);

function showCandidate(c: LyricsCandidate, providers: LyricsProviderOption[]) {
  const parsed = parseRawLyrics(c.lyrics.content, c.lyrics.format);
  useLyricsStore.getState().setLyricsState({
    lyricsLoading: false,
    lyricsError: null,
    rawLyrics: c.lyrics.content,
    rawFormat: c.lyrics.format,
    braccatoLyrics: parsed.braccatoLyrics,
    syncedLines: parsed.syncedLines,
    plainLyrics: parsed.plainLyrics,
    lyricsQuality: c.quality.total,
    currentLyricsTrackId: "drake-intro",
    activeProvider: c.provider,
    availableProviders: providers,
  });
}

describe("usable lyrics detection", () => {
  it("rejects the lrclib answer for Drake - Intro that parses into no lines", () => {
    expect(
      parseRawLyrics(lrclibEmpty.lyrics.content, "lrc").braccatoLyrics,
    ).toHaveLength(0);
    expect(hasUsableLyrics(lrclibEmpty)).toBe(false);
  });

  it("rejects whitespace and metadata-only lrc", () => {
    expect(hasUsableLyrics(candidate("a", "plain", "plain", "  \r\n ", 1))).toBe(false);
    expect(
      hasUsableLyrics(
        candidate("b", "line_level", "lrc", "[ar:Drake]\n[ti:Intro]\n[length:00:37]", 1),
      ),
    ).toBe(false);
    expect(
      hasUsableLyrics(candidate("c", "line_level", "lrc", "[00:00.00] \n[00:37.00] ", 1)),
    ).toBe(false);
  });

  it("keeps real text", () => {
    expect(hasUsableLyrics(geniusText)).toBe(true);
    expect(hasUsableLyrics(binimumSynced)).toBe(true);
  });

  it("does not cache an unusable provider", () => {
    lyricsCache.delete("drake-intro-cache");
    lyricsCache.setProvider("drake-intro-cache", lrclibEmpty);
    expect(lyricsCache.get("drake-intro-cache")).toBeNull();
    lyricsCache.set("drake-intro-cache", lrclibEmpty, [
      option(lrclibEmpty),
      option(geniusText),
    ]);
    const item = lyricsCache.get("drake-intro-cache");
    expect(item?.candidate.provider).toBe("genius");
    expect(item?.availableProviders?.map((p) => p.provider)).toEqual(["genius"]);
    lyricsCache.delete("drake-intro-cache");
  });
});

describe("provider switching with a provider that has no text", () => {
  beforeEach(() => {
    useLyricsStore.getState().reset();
  });

  it("never lists a provider without text and falls back to one with text", () => {
    showCandidate(lrclibEmpty, [option(lrclibEmpty), option(geniusText)]);
    const state = useLyricsStore.getState();
    expect(state.availableProviders.map((p) => p.provider)).toEqual(["genius"]);
    expect(state.activeProvider).toBe("genius");
    expect(state.braccatoLyrics.length).toBeGreaterThan(0);
  });

  it("switches away from the stream's first empty answer once a provider with text arrives", () => {
    showCandidate(lrclibEmpty, [option(lrclibEmpty)]);
    expect(useLyricsStore.getState().availableProviders).toHaveLength(0);
    expect(useLyricsStore.getState().braccatoLyrics).toHaveLength(0);

    useLyricsStore.getState().setLyricsState({
      availableProviders: [option(lrclibEmpty), option(geniusText)],
    });
    const state = useLyricsStore.getState();
    expect(state.activeProvider).toBe("genius");
    expect(state.braccatoLyrics.length).toBeGreaterThan(0);
  });

  it("refuses to select a provider without text and can always switch back", () => {
    showCandidate(binimumSynced, [option(binimumSynced), option(geniusText)]);
    useLyricsStore.setState({
      availableProviders: [
        option(binimumSynced),
        option(lrclibEmpty),
        option(geniusText),
      ],
    });

    useLyricsStore.getState().selectProvider("lrclib");
    expect(useLyricsStore.getState().activeProvider).toBe("binimum");
    expect(useLyricsStore.getState().braccatoLyrics.length).toBeGreaterThan(0);

    useLyricsStore.getState().selectProvider("genius");
    expect(useLyricsStore.getState().activeProvider).toBe("genius");
    useLyricsStore.getState().selectProvider("binimum");
    expect(useLyricsStore.getState().activeProvider).toBe("binimum");
    expect(useLyricsStore.getState().braccatoLyrics.length).toBeGreaterThan(0);
  });
});

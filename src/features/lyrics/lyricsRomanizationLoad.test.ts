import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lyric } from "@braccato/parsers";

const lyric = (words: string): Lyric => ({
  startTimeMs: 0,
  durationMs: 1000,
  words,
});

describe("lazy chinese romanizer", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("./engine/japaneseRomanization", () => ({
      prepareJapaneseLyrics: vi.fn(async () => {}),
      readJapaneseRomanization: vi.fn(() => null),
    }));
  });

  it("does not romanize chinese until the library is loaded", async () => {
    const mod = await import("./engine/lyricsRomanization");
    expect(mod.romanizeLine("我爱你")).toBeNull();
    await mod.loadRomanizers([lyric("我爱你")]);
    expect(mod.romanizeLine("我爱你")).toBe("wǒ ài nǐ");
  });

  it("does not load it for a japanese song", async () => {
    const mod = await import("./engine/lyricsRomanization");
    await mod.loadRomanizers([lyric("夜に駆ける"), lyric("君")]);
    expect(mod.romanizeLine("我爱你")).toBeNull();
  });

  it("does not load it for a korean song", async () => {
    const mod = await import("./engine/lyricsRomanization");
    await mod.loadRomanizers([lyric("사랑해")]);
    expect(mod.romanizeLine("我爱你")).toBeNull();
  });
});

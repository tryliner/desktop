import { beforeEach, describe, expect, it } from "vitest";
import type { Lyric } from "@braccato/parsers";
import {
  romanizationKey,
  type LanguageLyric,
} from "./engine/romanizationPreference";
import { useLyricsDisplayStore } from "./store/lyricsDisplayStore";
import { debouncedStorage } from "@/shared/utils/storage";

const song: Lyric[] = [{ words: "未来", startTimeMs: 0, durationMs: 1000 }];

beforeEach(() => {
  useLyricsDisplayStore.setState({
    romanization: false,
    languageOverrides: {},
  });
  useLyricsDisplayStore.persist.clearStorage();
});

describe("per-song reading preferences", () => {
  it("distinguishes tracks and lyric versions without depending on timestamps", () => {
    const key = romanizationKey("track", song);
    expect(romanizationKey("other-track", song)).not.toBe(key);
    expect(romanizationKey("track", [{ ...song[0], words: "世界" }])).not.toBe(
      key,
    );
    expect(
      romanizationKey("track", [
        { ...song[0], language: "ja" } as LanguageLyric,
      ]),
    ).not.toBe(key);
    expect(romanizationKey("track", [{ ...song[0], startTimeMs: 500 }])).toBe(
      key,
    );
  });

  it("keeps overrides separate from the global toggle and removes Auto overrides", () => {
    const store = useLyricsDisplayStore.getState();
    const first = romanizationKey("first", song);
    const second = romanizationKey("second", song);
    store.setLanguageOverride(first, "ja");
    store.setLanguageOverride(second, "off");
    store.setRomanization(true);
    expect(useLyricsDisplayStore.getState().languageOverrides).toEqual({
      [first]: "ja",
      [second]: "off",
    });
    store.setLanguageOverride(first, "auto");
    expect(useLyricsDisplayStore.getState().languageOverrides).toEqual({
      [second]: "off",
    });
  });

  it("restores choices after rehydration", async () => {
    const key = romanizationKey("track", song);
    useLyricsDisplayStore.getState().setLanguageOverride(key, "ja");
    debouncedStorage.flush();
    const stored = localStorage.getItem("liner_lyrics_display_v1")!;
    useLyricsDisplayStore.setState({ languageOverrides: {} });
    debouncedStorage.setItem("liner_lyrics_display_v1", stored);
    await useLyricsDisplayStore.persist.rehydrate();
    expect(useLyricsDisplayStore.getState().languageOverrides[key]).toBe("ja");
  });

  it("loads old settings and rejects invalid saved modes", async () => {
    debouncedStorage.setItem(
      "liner_lyrics_display_v1",
      JSON.stringify({ state: { romanization: true }, version: 0 }),
    );
    await useLyricsDisplayStore.persist.rehydrate();
    expect(useLyricsDisplayStore.getState().romanization).toBe(true);
    expect(useLyricsDisplayStore.getState().languageOverrides).toEqual({});
    debouncedStorage.setItem(
      "liner_lyrics_display_v1",
      JSON.stringify({
        state: { languageOverrides: { valid: "ja", invalid: "bogus" } },
        version: 0,
      }),
    );
    await useLyricsDisplayStore.persist.rehydrate();
    expect(useLyricsDisplayStore.getState().languageOverrides).toEqual({
      valid: "ja",
    });
  });
});
